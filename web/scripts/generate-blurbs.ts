/**
 * Generate the AI card copy for every person missing it, in ONE Claude call
 * per person (structured output):
 *   - blurb:     the 1-2 sentence accomplishments blurb on vote cards
 *   - one_liner: the short descriptor under the name (e.g. "Sports analytics
 *                founder") — used to fill `headline` when the scraped /
 *                LinkedIn headline is missing or noisy
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... npx tsx scripts/generate-blurbs.ts            # Supabase
 *   ANTHROPIC_API_KEY=... npx tsx scripts/generate-blurbs.ts data/uncsus.json
 *   ... --rewrite-headlines   also replace existing headlines with the clean
 *                             one-liner (for raw "X | Y | Z" LinkedIn ones)
 */
import fs from "fs";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { PersonInput, createAdminClient } from "./lib";

const MODEL = "claude-opus-5";

const SYSTEM = `You write card copy for a head-to-head voting site about
startup-minded students. From the profile data, produce:

- "blurb": 1-2 punchy sentences, max 40 words. Lead with the most impressive
  verifiable thing (shipped products, revenue, users, papers, competitive
  wins, notable internships). No fluff, no emojis, no hedging.
- "one_liner": a short descriptor for under their name, max 7 words, no
  ending punctuation. Style: "Sports analytics founder", "GPU kernels, ex-
  NVIDIA", "Dropped out to build dev-tools". Never include their name or
  school.

Never invent facts not present in the data.`;

const CardCopySchema = z.object({
  blurb: z.string().min(1),
  one_liner: z.string().min(1),
});
type CardCopy = z.infer<typeof CardCopySchema>;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    blurb: { type: "string" },
    one_liner: { type: "string" },
  },
  required: ["blurb", "one_liner"],
  additionalProperties: false,
} as const;

const client = new Anthropic();

/** The subset of a person the card copy is generated from. */
interface CopySource {
  name: string;
  school?: string | null;
  headline?: string | null;
  raw_profile?: Record<string, unknown>;
}

async function generateCardCopy(person: CopySource): Promise<CardCopy | null> {
  const profile = {
    name: person.name,
    school: person.school,
    linkedin_headline: person.headline,
    ...person.raw_profile,
  };
  // Server-side refusal fallback on by default (see README to disable).
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 1024,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    messages: [
      {
        role: "user",
        content: `Write the card copy for this person:\n${JSON.stringify(profile, null, 2)}`,
      },
    ],
  });
  if (response.stop_reason === "refusal") {
    console.warn(`  ! refusal for ${person.name}, skipping`);
    return null;
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || !("text" in text)) return null;
  const parsed = CardCopySchema.safeParse(JSON.parse(text.text));
  return parsed.success ? parsed.data : null;
}

/**
 * A headline is worth replacing when we have nothing, or when it's a raw
 * LinkedIn headline ("Building X | prev @ Y | CS @ Z") rather than copy.
 */
function shouldReplaceHeadline(
  current: string | null | undefined,
  rewriteAll: boolean
): boolean {
  if (!current) return true;
  if (rewriteAll) return true;
  return current.includes("|") || current.includes("@") || current.length > 60;
}

async function main() {
  const args = process.argv.slice(2);
  const rewriteHeadlines = args.includes("--rewrite-headlines");
  const file = args.find((a) => !a.startsWith("--"));

  if (file) {
    // JSON mode: enrich a local file in place
    const people: PersonInput[] = JSON.parse(fs.readFileSync(file, "utf8"));
    let done = 0;
    for (const person of people) {
      if (person.blurb && !rewriteHeadlines) continue;
      const copy = await generateCardCopy(person as CopySource);
      if (!copy) continue;
      person.blurb = person.blurb && rewriteHeadlines ? person.blurb : copy.blurb;
      if (shouldReplaceHeadline(person.headline, rewriteHeadlines)) {
        person.headline = copy.one_liner;
      }
      done++;
      console.log(`  ✓ ${person.name}: [${person.headline}] ${person.blurb}`);
      fs.writeFileSync(file, JSON.stringify(people, null, 2));
    }
    console.log(`Wrote card copy for ${done} people to ${file}`);
    return;
  }

  // Supabase mode
  const supabase = createAdminClient();
  if (!supabase) {
    console.error(
      "No Supabase configured — pass a JSON file instead: npx tsx scripts/generate-blurbs.ts data/uncsus.json"
    );
    process.exit(1);
  }
  let query = supabase
    .from("people")
    .select("id, name, school, headline, raw_profile, blurb");
  if (!rewriteHeadlines) query = query.is("blurb", null);
  const { data: people, error } = await query;
  if (error) throw new Error(error.message);

  console.log(`${people.length} people need card copy`);
  for (const person of people) {
    const copy = await generateCardCopy(person as CopySource);
    if (!copy) continue;
    const update: { blurb?: string; headline?: string } = {};
    if (!person.blurb) update.blurb = copy.blurb;
    if (shouldReplaceHeadline(person.headline, rewriteHeadlines)) {
      update.headline = copy.one_liner;
    }
    if (Object.keys(update).length === 0) continue;
    await supabase.from("people").update(update).eq("id", person.id);
    console.log(`  ✓ ${person.name}: [${update.headline ?? person.headline}] ${update.blurb ?? "(blurb kept)"}`);
  }
  console.log("Done.");
}

main();
