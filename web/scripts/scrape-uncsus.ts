/**
 * Scrape the community-built Startup School 2026 attendee list at
 * https://www.uncsus.com/ into data/uncsus.json, ready for import.ts.
 *
 * Run this on YOUR machine (the cloud sandbox blocks the domain):
 *   npx tsx scripts/scrape-uncsus.ts
 *   npx tsx scripts/import.ts data/uncsus.json
 *
 * The site's exact markup is unknown from here, so this tries, in order:
 *   1. Next.js __NEXT_DATA__ / self.__next_f payloads (JSON in the HTML)
 *   2. Any inline JSON that looks like an array of people
 *   3. A dump of the HTML to data/uncsus.html so you can eyeball selectors
 *
 * Heads up: these are real people. Only import folks you're comfortable
 * putting on a public leaderboard, and honor removal requests.
 */
import fs from "fs";
import path from "path";

const URL = "https://www.uncsus.com/";
const OUT = path.join("data", "uncsus.json");

interface Candidate {
  name?: unknown;
  fullName?: unknown;
  full_name?: unknown;
  school?: unknown;
  university?: unknown;
  college?: unknown;
  linkedin?: unknown;
  linkedin_url?: unknown;
  linkedinUrl?: unknown;
  bio?: unknown;
  headline?: unknown;
  title?: unknown;
  photo?: unknown;
  image?: unknown;
  avatar?: unknown;
  [key: string]: unknown;
}

function looksLikePerson(obj: unknown): obj is Candidate {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Candidate;
  return Boolean(o.name || o.fullName || o.full_name);
}

function normalize(c: Candidate) {
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const name = str(c.name) ?? str(c.fullName) ?? str(c.full_name);
  if (!name) return null;
  const known = new Set([
    "name", "fullName", "full_name", "school", "university", "college",
    "linkedin", "linkedin_url", "linkedinUrl", "bio", "headline", "title",
    "photo", "image", "avatar",
  ]);
  const raw_profile: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(c)) {
    if (!known.has(k) && v != null && v !== "") raw_profile[k] = v;
  }
  if (str(c.bio)) raw_profile.bio = str(c.bio);
  return {
    name,
    school: str(c.school) ?? str(c.university) ?? str(c.college),
    headline: str(c.headline) ?? str(c.title),
    linkedin_url: str(c.linkedin_url) ?? str(c.linkedinUrl) ?? str(c.linkedin),
    photo_url: str(c.photo) ?? str(c.image) ?? str(c.avatar),
    raw_profile,
  };
}

/** Recursively collect every array of person-shaped objects in a JSON blob. */
function findPeopleArrays(node: unknown, found: Candidate[][]): void {
  if (Array.isArray(node)) {
    if (node.length >= 5 && node.filter(looksLikePerson).length >= node.length * 0.8) {
      found.push(node as Candidate[]);
    }
    for (const item of node) findPeopleArrays(item, found);
  } else if (node && typeof node === "object") {
    for (const value of Object.values(node)) findPeopleArrays(value, found);
  }
}

async function main() {
  console.log(`Fetching ${URL} …`);
  const res = await fetch(URL, {
    headers: { "User-Agent": "Mozilla/5.0 (SUSranking importer)" },
  });
  if (!res.ok) {
    console.error(`HTTP ${res.status} — site may be blocking bots; open it in a browser and save the HTML to data/uncsus.html, then re-run.`);
    process.exit(1);
  }
  const html = await res.text();

  const jsonBlobs: unknown[] = [];

  // 1. Classic Next.js data payload
  const nextData = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (nextData) {
    try { jsonBlobs.push(JSON.parse(nextData[1])); } catch {}
  }

  // 2. App-router flight payloads + any other inline JSON arrays
  for (const match of html.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g)) {
    try {
      const unescaped = JSON.parse(`"${match[1]}"`);
      for (const arrayMatch of unescaped.matchAll(/\[\{[\s\S]*?\}\]/g)) {
        try { jsonBlobs.push(JSON.parse(arrayMatch[0])); } catch {}
      }
    } catch {}
  }
  for (const match of html.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try { jsonBlobs.push(JSON.parse(match[1])); } catch {}
  }

  const arrays: Candidate[][] = [];
  for (const blob of jsonBlobs) findPeopleArrays(blob, arrays);

  // Take the biggest person-shaped array found
  arrays.sort((a, b) => b.length - a.length);
  const best = arrays[0];

  if (!best) {
    const dump = path.join("data", "uncsus.html");
    fs.writeFileSync(dump, html);
    console.error(
      `Couldn't find a people array in the page's embedded JSON.\n` +
        `Saved raw HTML to ${dump} — the list is probably fetched from an API at\n` +
        `runtime. Open DevTools → Network on ${URL}, find the JSON request that\n` +
        `returns the attendee list, save it as data/uncsus.json (an array of\n` +
        `objects with at least a "name"), then run scripts/import.ts on it.`
    );
    process.exit(1);
  }

  const people = best.map(normalize).filter(Boolean);
  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(people, null, 2));
  console.log(`Wrote ${people.length} people to ${OUT}`);
  console.log(`Next: npx tsx scripts/import.ts ${OUT}`);
}

main();
