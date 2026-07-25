/**
 * Import people into the directory from a CSV or JSON file.
 *
 * Usage:
 *   npx tsx scripts/import.ts data/uncsus.json          # upsert into Supabase
 *   npx tsx scripts/import.ts people.csv --dry          # preview, no writes
 *
 * CSV columns: name (required), school, headline, linkedin_url, photo_url,
 * website_url, blurb. Any other columns are folded into raw_profile.
 * JSON: an array of objects with the same fields (scrape-uncsus.ts output).
 *
 * Every row is validated against PersonInputSchema; invalid rows are reported
 * and skipped. Rows WITHOUT a linkedin_url are skipped by default (dummy
 * accounts) — pass --allow-no-linkedin to keep them (they'll sit in the table
 * but stay excluded from matchups/leaderboard by the DB-level gate anyway).
 * Matches existing people by name — profile fields are updated,
 * Elo/wins/losses/vote_count are never touched. Inserts are batched (500/req)
 * so a 1k-person import is a handful of requests, not thousands.
 */
import fs from "fs";
import { parse } from "csv-parse/sync";
import { PersonInput, PersonInputSchema, requireAdminClient } from "./lib";

const KNOWN_FIELDS = new Set([
  "name",
  "school",
  "headline",
  "photo_url",
  "linkedin_url",
  "website_url",
  "blurb",
]);

const BATCH_SIZE = 500;

function loadRows(file: string): Record<string, unknown>[] {
  const raw = fs.readFileSync(file, "utf8");
  if (file.endsWith(".json")) return JSON.parse(raw);
  return parse(raw, { columns: true, skip_empty_lines: true, trim: true });
}

function toInputs(rows: Record<string, unknown>[]): {
  people: PersonInput[];
  invalid: number;
} {
  const people: PersonInput[] = [];
  let invalid = 0;
  for (const row of rows) {
    const shaped: Record<string, unknown> = { raw_profile: {} };
    for (const [key, value] of Object.entries(row)) {
      if (value === "" || value == null) continue;
      if (KNOWN_FIELDS.has(key)) shaped[key] = value;
      else if (key === "raw_profile" && typeof value === "object") {
        shaped.raw_profile = value;
      } else {
        (shaped.raw_profile as Record<string, unknown>)[key] = value;
      }
    }
    const parsed = PersonInputSchema.safeParse(shaped);
    if (parsed.success) people.push(parsed.data);
    else {
      invalid++;
      console.warn(`  ✗ invalid row (${JSON.stringify(row).slice(0, 80)}…): ${parsed.error.issues[0]?.message}`);
    }
  }
  return { people, invalid };
}

async function main() {
  const [file, ...flags] = process.argv.slice(2);
  if (!file) {
    console.error("Usage: npx tsx scripts/import.ts <file.csv|file.json> [--dry]");
    process.exit(1);
  }
  const dry = flags.includes("--dry");
  const allowNoLinkedin = flags.includes("--allow-no-linkedin");
  const parsed = toInputs(loadRows(file));
  let people = parsed.people;
  const { invalid } = parsed;

  // Gate: dummy accounts without a LinkedIn don't belong in the arena.
  let noLinkedin = 0;
  if (!allowNoLinkedin) {
    const before = people.length;
    people = people.filter((p) => p.linkedin_url);
    noLinkedin = before - people.length;
  }
  console.log(
    `Parsed ${people.length} valid people from ${file}` +
      `${invalid ? ` (${invalid} invalid skipped)` : ""}` +
      `${noLinkedin ? ` (${noLinkedin} without LinkedIn skipped — use --allow-no-linkedin to keep)` : ""}`
  );
  if (dry) {
    console.log(JSON.stringify(people.slice(0, 5), null, 2));
    console.log("(dry run — showing first 5)");
    return;
  }

  const supabase = requireAdminClient();

  // One query to find who already exists (by name).
  const { data: existingRows, error: existingError } = await supabase
    .from("people")
    .select("id, name");
  if (existingError) throw new Error(existingError.message);
  const existingByName = new Map(
    (existingRows ?? []).map((r) => [r.name as string, r.id as string])
  );

  const toInsert = people.filter((p) => !existingByName.has(p.name));
  const toUpdate = people.filter((p) => existingByName.has(p.name));

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("people").insert(batch);
    if (error) throw new Error(`insert batch failed: ${error.message}`);
    console.log(`  inserted ${Math.min(i + BATCH_SIZE, toInsert.length)}/${toInsert.length}`);
  }

  let updated = 0;
  for (const person of toUpdate) {
    // Profile fields only — never touch elo/wins/losses/vote_count.
    const { error } = await supabase
      .from("people")
      .update({
        school: person.school,
        headline: person.headline,
        photo_url: person.photo_url,
        linkedin_url: person.linkedin_url,
        website_url: person.website_url,
        raw_profile: person.raw_profile,
      })
      .eq("id", existingByName.get(person.name)!);
    if (error) console.error(`  ✗ update ${person.name}: ${error.message}`);
    else updated++;
  }

  console.log(`Done: ${toInsert.length} inserted, ${updated} updated.`);
}

main();
