/**
 * fetch-news: collect candidate AI news stories for a date and pre-filter them.
 *
 * Pipeline:
 *   1. Search HackerNews (Algolia) for AI-keyword stories within the date window.
 *   2. Classify each hit by source-domain authority (high / neutral / low /
 *      non-article) and apply tier-specific HN-points thresholds.
 *   3. Near-duplicate dedupe by title token overlap.
 *   4. Fetch each surviving URL, extract article text via the hand-rolled
 *      readability heuristic in lib/article.ts. Drop stories where extraction
 *      fails or yields fewer than 500 characters — narration must be grounded
 *      in real article body, not titles or abstracts (per Issue 14).
 *   5. Mark the top items (max 5) as `selected: true` for human review.
 *
 * Arxiv source has been removed: it only provides abstracts and so cannot
 * satisfy the "must have article text" requirement.
 */

import path from "path";
import fs from "fs";

import { classifySource, hostOf, pointsFloorFor, type SourceTier } from "../lib/sources";
import { dedupeByTitle } from "../lib/dedup";
import { extractArticleText } from "../lib/article";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: "hackernews";
  score: number;
  commentCount: number;
  publishedAt: string;
  // Populated by the source-authority classifier
  host: string;
  sourceTier: SourceTier;
  // Populated by the article extraction step
  articleText?: string;
  articleChars?: number;
  // Set by the selection step (top-N picks)
  selected: boolean;
  // Reserved for the LLM ranking step (Issue 2 / Batch B follow-up).
  // Items keep `aiScore: null` until that step is wired in.
  aiScore: number | null;
  aiScoreReason: string | null;
}

export interface NewsCache {
  date: string;
  fetchedAt: string;
  items: NewsItem[];
  droppedCounts: {
    belowThreshold: number;
    nonArticleHost: number;
    duplicate: number;
    extractionFailed: number;
  };
}

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag: string) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
};
const date  = getArg("--date") ?? new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const force = args.includes("--force");
const MAX_SELECTED = 5;
const EXTRACTION_CONCURRENCY = 4;

const cacheFile = path.resolve(`cache/news-${date}.json`);

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (fs.existsSync(cacheFile) && !force) {
    console.log(`Already cached: ${cacheFile}`);
    console.log("Use --force to re-fetch.");
    process.exit(0);
  }

  console.log(`Fetching AI news for ${date}…`);

  // Step 1: HN
  const hnRaw = await fetchHackerNews(date)
    .catch((e) => { console.warn(`⚠  HN fetch failed: ${e.message}`); return [] as HNHit[]; });
  console.log(`  HN raw hits: ${hnRaw.length}`);

  // Step 2: Source authority + points threshold
  const authoritative: NewsItem[] = [];
  let belowThreshold = 0;
  let nonArticle = 0;
  for (const h of hnRaw) {
    if (!h.url) continue;
    const tier = classifySource(h.url);
    if (tier === "non-article") { nonArticle++; continue; }
    const floor = pointsFloorFor(tier);
    if ((h.points ?? 0) < floor) { belowThreshold++; continue; }
    authoritative.push({
      id: `hn-${h.objectID}`,
      title: h.title,
      url: h.url,
      source: "hackernews",
      score: h.points ?? 0,
      commentCount: h.num_comments ?? 0,
      publishedAt: h.created_at,
      host: hostOf(h.url),
      sourceTier: tier,
      selected: false,
      aiScore: null,
      aiScoreReason: null,
    });
  }
  console.log(`  after authority filter: ${authoritative.length}  (dropped: ${belowThreshold} below threshold, ${nonArticle} non-article)`);

  // Step 3: Dedupe near-duplicates by title
  const deduped = dedupeByTitle(authoritative);
  const dupCount = authoritative.length - deduped.length;
  console.log(`  after dedupe: ${deduped.length}  (dropped: ${dupCount})`);

  // Step 4: Article-text extraction in parallel batches
  console.log(`  extracting article text (${deduped.length} URLs, concurrency=${EXTRACTION_CONCURRENCY})…`);
  await runWithConcurrency(deduped, EXTRACTION_CONCURRENCY, async (item) => {
    const r = await extractArticleText(item.url);
    if (r.ok) {
      item.articleText = r.text;
      item.articleChars = r.charCount;
      console.log(`    ✓ ${item.score.toString().padStart(4)} pts  ${item.host}  (${r.charCount} chars)  ${item.title.slice(0, 60)}`);
    } else {
      item.articleChars = r.charCount;
      console.log(`    ✗ ${item.score.toString().padStart(4)} pts  ${item.host}  (${r.reason})  ${item.title.slice(0, 60)}`);
    }
  });
  const withArticle = deduped.filter((i) => i.articleText && i.articleText.length >= 500);
  const extractionFailed = deduped.length - withArticle.length;
  console.log(`  with article text ≥500 chars: ${withArticle.length}  (failed: ${extractionFailed})`);

  // Step 5: pre-select top N by score (LLM ranking will override later — Issue 2).
  withArticle.sort((a, b) => b.score - a.score);
  for (let i = 0; i < Math.min(MAX_SELECTED, withArticle.length); i++) {
    withArticle[i].selected = true;
  }

  const cache: NewsCache = {
    date,
    fetchedAt: new Date().toISOString(),
    items: withArticle,
    droppedCounts: {
      belowThreshold,
      nonArticleHost: nonArticle,
      duplicate: dupCount,
      extractionFailed,
    },
  };

  fs.mkdirSync("cache", { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2), "utf-8");

  const selectedCount = cache.items.filter((i) => i.selected).length;
  console.log(`✅  ${cache.items.length} stories survived (${selectedCount} pre-selected)`);
  console.log(`   → ${cacheFile}`);
  console.log("");
  console.log("Next: open the file, adjust `selected` flags, then run /gen-script.");
}

// ── HackerNews via Algolia ────────────────────────────────────────────────────

interface HNHit {
  objectID: string;
  title: string;
  url?: string;
  story_text?: string;
  points?: number;
  num_comments?: number;
  created_at: string;
}

async function fetchHackerNews(date: string): Promise<HNHit[]> {
  const dayStart = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
  const dayEnd   = Math.floor(new Date(`${date}T23:59:59Z`).getTime() / 1000);

  const keywords = ["AI", "LLM", "OpenAI", "Anthropic", "Claude", "Gemini", "GPT", "DeepMind", "Mistral", "machine learning"];
  const seen = new Set<string>();
  const allHits: HNHit[] = [];

  await Promise.all(keywords.map(async (kw) => {
    const url =
      `https://hn.algolia.com/api/v1/search_by_date` +
      `?query=${encodeURIComponent(kw)}` +
      `&tags=story` +
      `&numericFilters=created_at_i>${dayStart},created_at_i<${dayEnd}` +
      `&hitsPerPage=30`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json() as { hits: HNHit[] };
    for (const hit of data.hits) {
      if (!seen.has(hit.objectID)) {
        seen.add(hit.objectID);
        allHits.push(hit);
      }
    }
  }));

  return allHits;
}

// ── Concurrency helper ────────────────────────────────────────────────────────

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const it = queue.shift();
      if (it === undefined) break;
      await fn(it);
    }
  });
  await Promise.all(workers);
}

// ── Run ───────────────────────────────────────────────────────────────────────

main().catch(e => {
  console.error("fetch-news failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
