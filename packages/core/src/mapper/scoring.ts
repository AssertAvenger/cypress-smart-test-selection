/** Combines heuristic signals; the result is not a probability of coverage. */
export function combineScores(scores: number[], weights: number[] = []): number {
  if (weights.length && weights.length !== scores.length) throw new Error("Weights must match scores");
  if (scores.some((s) => !Number.isFinite(s)) || weights.some((w) => !Number.isFinite(w) || w < 0)) {
    throw new Error("Scores must be finite and weights must be finite and non-negative");
  }
  return 1 - scores.reduce((product, score, i) =>
    product * (1 - normalizeScore(score * (weights[i] ?? 1))), 1);
}

export function normalizeScore(score: number): number {
  if (!Number.isFinite(score)) throw new Error("Score must be finite");
  return Math.max(0, Math.min(1, score));
}
