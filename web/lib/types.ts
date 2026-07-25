export interface Person {
  id: string;
  name: string;
  school: string | null;
  headline: string | null;
  photo_url: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  /** AI-compiled accomplishments blurb shown on the vote card */
  blurb: string | null;
  /** Raw enrichment data (scraped/imported) the blurb is generated from */
  raw_profile: Record<string, unknown>;
  elo: number;
  wins: number;
  losses: number;
  vote_count: number;
}

export interface Matchup {
  a: Person;
  b: Person;
}

export interface VoteResult {
  winner_elo: number;
  loser_elo: number;
  delta: number;
}

export function pairKey(idA: string, idB: string): string {
  return [idA, idB].sort().join(":");
}
