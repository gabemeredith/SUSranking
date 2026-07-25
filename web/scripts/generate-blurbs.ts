/**
 * Generate the AI "accomplishments blurb" shown on vote cards, for every
 * person missing one. Reads raw_profile/headline/school, writes `blurb`.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... npx tsx scripts/generate-blurbs.ts          # Supabase
 *   ANTHROPIC_API_KEY=... npx tsx scripts/generate-blurbs.ts data/uncsus.json
 *     (JSON mode rewrites the file in place with blurbs added)
 */
import fs from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { PersonInput, createAdminClient } from "./lib";

const MODEL = "claude-opus-5";

const SYSTEM = `You write one-sentence-to-two-sentence "accomplishments blurbs" for a
head-to-head voting card about startup-minded students. Style: punchy, concrete,
no fluff. Lead with the most impressive verifiable thing (shipped products,
revenue, users, papers, competitive wins, notable internships). Never invent
facts not present in the data. No emojis, no hedging, max 40 words. Return ONLY
the blurb text.`;

const client = new Anthropic();

/** The subset of a person the blurb is generated from. */
interface BlurbSource {
  name: string;
  school?: string | null;
  headline?: string | null;
  raw_profile?: Record<string, unknown>;
}

async function blurbFor(person: BlurbSource): Promise<string | null> {
  const profile = {
    name: person.name,
    school: person.school,
    headline: person.headline,
    ...person.raw_profile,
  };
  // Server-side refusal fallback on by default (see README to disable).
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 1024,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Write the blurb for this person:\n${JSON.stringify(profile, null, 2)}`,
      },
    ],
  });
  if (response.stop_reason === "refusal") {
    console.warn(`  ! refusal for ${person.name}, skipping`);
    return null;
  }
  const text = response.content.find((b) => b.type === "text");
  return text && "text" in text ? text.text.trim() : null;
}

async function main() {
  const file = process.argv[2];

  if (file) {
    // JSON mode: enrich a local file in place
    const people: PersonInput[] = JSON.parse(fs.readFileSync(file, "utf8"));
    let done = 0;
    for (const person of people) {
      if (person.blurb) continue;
      const blurb = await blurbFor(person);
      if (blurb) {
        person.blurb = blurb;
        done++;
        console.log(`  ✓ ${person.name}: ${blurb}`);
        fs.writeFileSync(file, JSON.stringify(people, null, 2));
      }
    }
    console.log(`Wrote ${done} blurbs to ${file}`);
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
  const { data: people, error } = await supabase
    .from("people")
    .select("id, name, school, headline, raw_profile")
    .is("blurb", null);
  if (error) throw new Error(error.message);
  console.log(`${people.length} people need blurbs`);
  for (const person of people) {
    const blurb = await blurbFor(person as BlurbSource);
    if (!blurb) continue;
    await supabase.from("people").update({ blurb }).eq("id", person.id);
    console.log(`  ✓ ${person.name}: ${blurb}`);
  }
  console.log("Done.");
}

main();
