/**
 * Enrich people via their LinkedIn URL using a profile-enrichment API, storing
 * the result in raw_profile.linkedin (which generate-blurbs.ts then uses).
 *
 * Default provider is Proxycurl (https://nubela.co/proxycurl) — LinkedIn URL
 * in, structured profile JSON out. Swap providers by adding a function that
 * matches the Provider signature below (ScrapIn, People Data Labs, Apollo,
 * etc. all have equivalent "person by LinkedIn URL" endpoints).
 *
 * Usage:
 *   PROXYCURL_API_KEY=... npx tsx scripts/enrich-linkedin.ts            # Supabase
 *   PROXYCURL_API_KEY=... npx tsx scripts/enrich-linkedin.ts data/uncsus.json
 *   ... --force        re-enrich people that already have linkedin data
 *   ... --limit 25     stop after N enrichments (watch your API credits)
 *
 * Also fills in headline / school / photo_url on the person when those are
 * empty. Never overwrites fields that already have values.
 */
import fs from "fs";
import { PersonInput, createAdminClient } from "./lib";

// ---------------------------------------------------------------------------
// Provider interface — return value is stored verbatim in raw_profile.linkedin
// ---------------------------------------------------------------------------
interface Enrichment {
  /** Full provider response (kept for blurb generation / future use) */
  raw: Record<string, unknown>;
  headline?: string;
  school?: string;
  photo_url?: string;
  /** Flattened "experience" lines for the blurb prompt */
  experience?: string[];
}
type Provider = (linkedinUrl: string) => Promise<Enrichment | null>;

const proxycurl: Provider = async (linkedinUrl) => {
  const key = process.env.PROXYCURL_API_KEY;
  if (!key) {
    console.error("Set PROXYCURL_API_KEY (or plug in a different provider).");
    process.exit(1);
  }
  const url = new URL("https://nubela.co/proxycurl/api/v2/linkedin");
  url.searchParams.set("url", linkedinUrl);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (res.status === 404) return null; // profile not found
  if (res.status === 429) {
    console.warn("  rate limited by provider — waiting 10s");
    await sleep(10_000);
    return proxycurl(linkedinUrl);
  }
  if (!res.ok) {
    console.warn(`  provider error ${res.status} for ${linkedinUrl}`);
    return null;
  }
  const raw = (await res.json()) as Record<string, unknown>;

  const experiences = Array.isArray(raw.experiences)
    ? (raw.experiences as Array<Record<string, unknown>>)
        .map((e) => [e.title, e.company].filter(Boolean).join(" @ "))
        .filter(Boolean)
        .slice(0, 8)
    : undefined;
  const education = Array.isArray(raw.education)
    ? (raw.education as Array<Record<string, unknown>>)
    : [];

  return {
    raw,
    headline: typeof raw.headline === "string" ? raw.headline : undefined,
    school:
      typeof education[0]?.school === "string"
        ? (education[0].school as string)
        : undefined,
    photo_url:
      typeof raw.profile_pic_url === "string" ? raw.profile_pic_url : undefined,
    experience: experiences,
  };
};

const PROVIDERS: Record<string, Provider> = { proxycurl };
const provider =
  PROVIDERS[process.env.ENRICH_PROVIDER ?? "proxycurl"] ?? proxycurl;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function applyEnrichment<T extends Partial<PersonInput>>(
  person: T,
  enrichment: Enrichment
): T {
  const raw_profile = {
    ...(person.raw_profile ?? {}),
    linkedin: enrichment.raw,
    ...(enrichment.experience ? { experience: enrichment.experience } : {}),
  };
  return {
    ...person,
    raw_profile,
    headline: person.headline ?? enrichment.headline ?? null,
    school: person.school ?? enrichment.school ?? null,
    photo_url: person.photo_url ?? enrichment.photo_url ?? null,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;
  const file = args.find((a) => !a.startsWith("--") && a !== String(limit));

  let enriched = 0;

  if (file) {
    // JSON mode: enrich a local file in place (before importing)
    const people: PersonInput[] = JSON.parse(fs.readFileSync(file, "utf8"));
    for (let i = 0; i < people.length && enriched < limit; i++) {
      const person = people[i];
      if (!person.linkedin_url) continue;
      if (person.raw_profile?.linkedin && !force) continue;
      const enrichment = await provider(person.linkedin_url);
      if (!enrichment) continue;
      people[i] = applyEnrichment(person, enrichment);
      enriched++;
      console.log(`  ✓ ${person.name}`);
      fs.writeFileSync(file, JSON.stringify(people, null, 2));
      await sleep(500);
    }
    console.log(`Enriched ${enriched} people in ${file}`);
    return;
  }

  // Supabase mode
  const supabase = createAdminClient();
  if (!supabase) {
    console.error(
      "No Supabase configured — pass a JSON file instead: npx tsx scripts/enrich-linkedin.ts data/uncsus.json"
    );
    process.exit(1);
  }
  let query = supabase
    .from("people")
    .select("id, name, school, headline, photo_url, linkedin_url, raw_profile")
    .not("linkedin_url", "is", null);
  if (!force) query = query.is("raw_profile->linkedin", null);
  const { data: people, error } = await query;
  if (error) throw new Error(error.message);

  console.log(`${people.length} people to enrich${limit < Infinity ? ` (limit ${limit})` : ""}`);
  for (const person of people) {
    if (enriched >= limit) break;
    const enrichment = await provider(person.linkedin_url as string);
    if (!enrichment) continue;
    const updated = applyEnrichment(person as Partial<PersonInput>, enrichment);
    const { error: updateError } = await supabase
      .from("people")
      .update({
        raw_profile: updated.raw_profile,
        headline: updated.headline,
        school: updated.school,
        photo_url: updated.photo_url,
      })
      .eq("id", person.id);
    if (updateError) console.error(`  ✗ ${person.name}: ${updateError.message}`);
    else {
      enriched++;
      console.log(`  ✓ ${person.name}`);
    }
    await sleep(500);
  }
  console.log(`Done — enriched ${enriched} people. Next: npm run blurbs`);
}

main();
