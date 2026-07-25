export const K_FACTOR = 32;
export const STARTING_ELO = 1000;

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function applyVote(
  winnerElo: number,
  loserElo: number,
  k: number = K_FACTOR
): { winner: number; loser: number; delta: number } {
  const expectedWin = expectedScore(winnerElo, loserElo);
  const delta = Math.max(1, Math.round(k * (1 - expectedWin)));
  return { winner: winnerElo + delta, loser: loserElo - delta, delta };
}
