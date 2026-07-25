/**
 * Import people into the directory from a CSV or JSON file.
 *
 * Usage:
 *   npx tsx scripts/import.ts data/uncsus.json          # upsert into Supabase
 *   npx tsx scripts/import.ts people.csv --dry          # print what would happen
 *
 * CSV columns: name (required), school, headline, linkedin_url, photo_url,
 * website_url, blurb. Any other columns are folded into raw_profile.
 * JSON: an array of objects with the same fields.
 *
 * Upserts match on name+linkedin_url so re-running is safe; Elo/votes are
 * never overwritten for existing people.
 */
import fs from "fs";
import { parse } from "csv-parse/sync";
import { PersonInput, requireAdminClient } from "./lib";

const KNOWN_FIELDS = new Set([
  "name",
  "school",
  "headline",
  "photo_url",
  "linkedin_url",
  "website_url",
  "blurb",
]);

function loadPeople(file: string): PersonInput[] {
  const raw = fs.readFileSync(file, "utf8");
  let rows: Record<string, unknown>[];
  if (file.endsWith(".json")) {
    rows = JSON.parse(raw);
  } else {
    rows = parse(raw, { columns: true, skip_empty_lines: true, trim: true });
  }
  return rows
    .filter((row) => typeof row.name === "string" && row.name)
    .map((row) => {
      const person: PersonInput = { name: row.name as string, raw_profile: {} };
      for (const [key, value] of Object.entries(row)) {
        if (value === "" || value == null || key === "name") continue;
        if (KNOWN_FIELDS.has(key)) {
          (person as unknown as Record<string, unknown>)[key] = value;
        } else {
          person.raw_profile![key] = value;
        }
      }
      return person;
    });
}

async function main() {
  const [file, ...flags] = process.argv.slice(2);
  if (!file) {
    console.error("Usage: npx tsx scripts/import.ts <file.csv|file.json> [--dry]");
    process.exit(1);
  }
  const dry = flags.includes("--dry");
  const people = loadPeople(file);
  console.log(`Parsed ${people.length} people from ${file}`);
  if (dry) {
    console.log(JSON.stringify(people.slice(0, 5), null, 2));
    console.log(`(dry run — showing first 5)`);
    return;
  }

  const supabase = requireAdminClient();
  let inserted = 0;
  let skipped = 0;
  for (const person of people) {
    const { data: existing } = await supabase
      .from("people")
      .select("id")
      .eq("name", person.name)
      .maybeSingle();
    if (existing) {
      // Update profile fields only — never touch elo/wins/losses.
      await supabase
        .from("people")
        .update({
          school: person.school ?? undefined,
          headline: person.headline ?? undefined,
          photo_url: person.photo_url ?? undefined,
          linkedin_url: person.linkedin_url ?? undefined,
          website_url: person.website_url ?? undefined,
          raw_profile: person.raw_profile ?? undefined,
        })
        .eq("id", existing.id);
      skipped++;
      continue;
    }
    const { error } = await supabase.from("people").insert(person);
    if (error) {
      console.error(`  ✗ ${person.name}: ${error.message}`);
      continue;
    }
    inserted++;
  }
  console.log(`Done: ${inserted} inserted, ${skipped} updated (already existed).`);
}

main();
