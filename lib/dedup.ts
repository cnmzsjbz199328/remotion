/**
 * Near-duplicate detection for news candidates.
 *
 * Two stories are considered duplicates if they share the same URL host AND
 * their title token sets overlap by ≥ JACCARD_THRESHOLD. When duplicates are
 * found, we keep the one with the highest sort key (e.g. HN points).
 */

const JACCARD_THRESHOLD = 0.55;

// Stop words that don't carry topical meaning — exclude from the comparison.
const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "at", "for", "with",
  "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "do", "does", "did", "will", "would", "could", "should",
  "this", "that", "these", "those", "it", "its", "as", "by",
  "from", "into", "about", "after", "before", "over", "under",
  "how", "what", "why", "when", "where", "who", "which",
  "new", "ai", "llm", "model", "models",
]);

function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !STOP.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

import { hostOf } from "./sources";

export interface DedupItem {
  title: string;
  url: string;
  score: number;
}

/** Remove near-duplicates, keeping the highest-scoring item in each group. */
export function dedupeByTitle<T extends DedupItem>(items: T[]): T[] {
  // Sort descending by score so the first item we encounter in a group wins.
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const tokens = sorted.map((it) => tokenize(it.title));
  const hosts = sorted.map((it) => hostOf(it.url));
  const kept: T[] = [];
  const dropped = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (dropped.has(i)) continue;
    kept.push(sorted[i]);
    for (let j = i + 1; j < sorted.length; j++) {
      if (dropped.has(j)) continue;
      // Same-host stories with overlapping titles are dups (e.g. two tweets
      // about the same incident on twitter.com). Cross-host stories need a
      // higher overlap bar to count as the same event.
      const sameHost = hosts[i] === hosts[j] && hosts[i] !== "";
      const sim = jaccard(tokens[i], tokens[j]);
      const threshold = sameHost ? 0.4 : JACCARD_THRESHOLD;
      if (sim >= threshold) dropped.add(j);
    }
  }
  return kept;
}
