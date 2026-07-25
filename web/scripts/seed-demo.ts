/**
 * Push the bundled mock profiles (data/seed.json) into Supabase — handy for
 * testing the real stack before you have the actual attendee list.
 *
 *   npx tsx scripts/seed-demo.ts
 */
import { execSync } from "child_process";

execSync("npx tsx scripts/import.ts data/seed.json", { stdio: "inherit" });
