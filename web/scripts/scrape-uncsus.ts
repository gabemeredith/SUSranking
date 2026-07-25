/**
 * Scrape the Startup School 2026 attendee list at https://www.uncsus.com/people
 * into data/uncsus.json (validated PersonInput[]), ready for import.ts.
 *
 * RUN THIS ON YOUR OWN MACHINE — cloud sandboxes typically block the domain.
 *
 * The /people page is behind login. Do NOT share your password with anyone
 * (including an AI) — the script only needs your browser session cookie:
 *
 *   1. Log in to uncsus.com in your browser.
 *   2. DevTools → Network tab → reload /people → click the `people` request.
 *   3. Request Headers → copy the full value of the `cookie:` header.
 *   4. Run:  UNCSUS_COOKIE='<paste here>' npx tsx scripts/scrape-uncsus.ts
 *
 * Discovery order (site markup is unknown ahead of time, so all are tried):
 *   1. JSON embedded in the page HTML (__NEXT_DATA__ / RSC flight payloads /
 *      <script type="application/json">)
 *   2. The Next.js data route (_next/data/<buildId>/people.json) and common
 *      API paths (/api/people, /api/attendees, /api/users, /people.json)
 *   3. Failing that: dumps HTML to data/uncsus.html and prints DevTools
 *      instructions for grabbing the JSON response by hand.
 *
 * Manual fallback always works: save the raw JSON the site fetches (any shape
 * containing an array of objects with names) as data/uncsus-raw.json and run
 *   npx tsx scripts/scrape-uncsus.ts data/uncsus-raw.json
 * to normalize it into data/uncsus.json.
 *
 * These are real people: only import folks you're comfortable putting on a
 * public leaderboard, and honor removal requests.
 */
import fs from "fs";
import path from "path";
import { PersonInput, PersonInputSchema } from "../lib/schemas";

const BASE = process.env.UNCSUS_URL ?? "https://www.uncsus.com";
const PAGE_URL = `${BASE}/people`;
const COOKIE = process.env.UNCSUS_COOKIE;
const OUT = path.join("data", "uncsus.json");

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
  ...(COOKIE ? { Cookie: COOKIE } : {}),
};

// --------------------------------------------------------------------------
// Candidate detection + normalization into PersonInput
// --------------------------------------------------------------------------
type Candidate = Record<string, unknown>;

const NAME_KEYS = ["name", "fullName", "full_name", "displayName"];
const FIELD_ALIASES: Record<keyof Omit<PersonInput, "raw_profile">, string[]> = {
  name: NAME_KEYS,
  school: ["school", "university", "college", "education"],
  headline: ["headline", "title", "tagline", "oneLiner", "one_liner", "role"],
  photo_url: ["photo_url", "photo", "image", "imageUrl", "avatar", "avatarUrl", "profilePic", "pfp"],
  linkedin_url: ["linkedin_url", "linkedinUrl", "linkedin", "linkedIn"],
  website_url: ["website_url", "websiteUrl", "website", "site", "url"],
  blurb: ["blurb"],
};

function looksLikePerson(obj: unknown): obj is Candidate {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const o = obj as Candidate;
  return NAME_KEYS.some((k) => typeof o[k] === "string" && (o[k] as string).trim());
}

function normalize(candidate: Candidate): PersonInput | null {
  const input: Record<string, unknown> = { raw_profile: {} };
  const consumed = new Set<string>();
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      const value = candidate[alias];
      if (typeof value === "string" && value.trim()) {
        input[field] = value;
        consumed.add(alias);
        break;
      }
    }
  }
  // Everything unconsumed (bio, experience arrays, socials, …) is preserved
  // in raw_profile for blurb generation.
  const raw: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(candidate)) {
    if (!consumed.has(key) && value != null && value !== "") raw[key] = value;
  }
  input.raw_profile = raw;

  const parsed = PersonInputSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

/** Recursively collect every array that is mostly person-shaped objects. */
function findPeopleArrays(node: unknown, found: Candidate[][]): void {
  if (Array.isArray(node)) {
    const personish = node.filter(looksLikePerson);
    if (node.length >= 5 && personish.length >= node.length * 0.8) {
      found.push(personish);
    }
    for (const item of node) findPeopleArrays(item, found);
  } else if (node && typeof node === "object") {
    for (const value of Object.values(node)) findPeopleArrays(value, found);
  }
}

function extractFromJsonBlobs(blobs: unknown[]): Candidate[] | null {
  const arrays: Candidate[][] = [];
  for (const blob of blobs) findPeopleArrays(blob, arrays);
  arrays.sort((x, y) => y.length - x.length);
  return arrays[0] ?? null;
}

function parseEmbeddedJson(html: string): unknown[] {
  const blobs: unknown[] = [];
  const nextData = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextData) {
    try { blobs.push(JSON.parse(nextData[1])); } catch {}
  }
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g)) {
    try {
      const unescaped = JSON.parse(`"${m[1]}"`);
      for (const arr of unescaped.matchAll(/\[\{[\s\S]*?\}\]/g)) {
        try { blobs.push(JSON.parse(arr[0])); } catch {}
      }
    } catch {}
  }
  for (const m of html.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try { blobs.push(JSON.parse(m[1])); } catch {}
  }
  return blobs;
}

async function tryJsonEndpoints(html: string): Promise<Candidate[] | null> {
  const endpoints: string[] = [];
  const buildId = html.match(/"buildId":"([^"]+)"/)?.[1];
  if (buildId) endpoints.push(`${BASE}/_next/data/${buildId}/people.json`);
  endpoints.push(
    `${BASE}/api/people`,
    `${BASE}/api/attendees`,
    `${BASE}/api/users`,
    `${BASE}/people.json`
  );
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: { ...HEADERS, Accept: "application/json" } });
      if (!res.ok) continue;
      const json = await res.json();
      const people = extractFromJsonBlobs([json]);
      if (people) {
        console.log(`  found ${people.length} people at ${url}`);
        return people;
      }
    } catch {}
  }
  return null;
}

function write(people: Candidate[]): void {
  const normalized = people
    .map(normalize)
    .filter((p): p is PersonInput => p !== null);
  const dropped = people.length - normalized.length;
  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(normalized, null, 2));
  console.log(`Wrote ${normalized.length} people to ${OUT}${dropped ? ` (${dropped} rows failed validation and were dropped)` : ""}`);
  console.log(`Next: npx tsx scripts/import.ts ${OUT}`);
}

async function main() {
  // Manual mode: normalize a JSON file you saved from DevTools.
  const localFile = process.argv[2];
  if (localFile) {
    const json = JSON.parse(fs.readFileSync(localFile, "utf8"));
    const people = extractFromJsonBlobs([json]);
    if (!people) {
      console.error(`No array of person-shaped objects found in ${localFile}`);
      process.exit(1);
    }
    write(people);
    return;
  }

  console.log(`Fetching ${PAGE_URL}${COOKIE ? " (with session cookie)" : " (no cookie set)"} …`);
  const res = await fetch(PAGE_URL, { headers: HEADERS, redirect: "follow" });
  const html = await res.text();
  const loginWall =
    res.status === 401 ||
    res.status === 403 ||
    res.url.includes("login") ||
    res.url.includes("signin") ||
    /sign[ -]?in|log[ -]?in/i.test(html.slice(0, 2000));
  if (!res.ok || (loginWall && !COOKIE)) {
    console.error(
      `Got HTTP ${res.status} (final URL ${res.url}) — looks like a login wall.\n` +
        `Set UNCSUS_COOKIE to your browser session cookie (see header of this file) and re-run.`
    );
    process.exit(1);
  }

  const embedded = extractFromJsonBlobs(parseEmbeddedJson(html));
  if (embedded) {
    console.log(`  found ${embedded.length} people embedded in page HTML`);
    write(embedded);
    return;
  }

  const fromApi = await tryJsonEndpoints(html);
  if (fromApi) {
    write(fromApi);
    return;
  }

  const dump = path.join("data", "uncsus.html");
  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync(dump, html);
  console.error(
    `Couldn't find the attendee data automatically. Saved the HTML to ${dump}.\n` +
      `The list is likely fetched at runtime: open DevTools → Network → Fetch/XHR\n` +
      `on ${PAGE_URL}, find the JSON response with the attendee array, right-click →\n` +
      `Copy response, save as data/uncsus-raw.json, then run:\n` +
      `  npx tsx scripts/scrape-uncsus.ts data/uncsus-raw.json`
  );
  process.exit(1);
}

main();
