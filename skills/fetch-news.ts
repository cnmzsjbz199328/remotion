import path from "path";
import fs from "fs";
import { XMLParser } from "fast-xml-parser";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: "hackernews" | "arxiv";
  score?: number;
  commentCount?: number;
  summary?: string;
  authors?: string[];
  publishedAt: string;
}

export interface NewsCache {
  date: string;
  fetchedAt: string;
  items: NewsItem[];
}

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag: string) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : undefined; };
const date = getArg("--date") ?? new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const force = args.includes("--force");

const cacheFile = path.resolve(`cache/news-${date}.json`);

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (fs.existsSync(cacheFile) && !force) {
    console.log(`Already cached: ${cacheFile}`);
    console.log("Use --force to re-fetch.");
    process.exit(0);
  }

  console.log(`Fetching AI news for ${date}…`);

  const [hnItems, arxivItems] = await Promise.all([
    fetchHackerNews(date).catch(e => { console.warn(`⚠  HN fetch failed: ${e.message}`); return [] as NewsItem[]; }),
    fetchArxiv(date).catch(e => { console.warn(`⚠  arXiv fetch failed: ${e.message}`); return [] as NewsItem[]; }),
  ]);

  const cache: NewsCache = {
    date,
    fetchedAt: new Date().toISOString(),
    items: [...hnItems, ...arxivItems],
  };

  fs.mkdirSync("cache", { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2), "utf-8");

  console.log(`✅  ${hnItems.length} HN stories + ${arxivItems.length} arXiv papers`);
  console.log(`   → ${cacheFile}`);
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

async function fetchHackerNews(date: string): Promise<NewsItem[]> {
  const dayStart = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
  const dayEnd = Math.floor(new Date(`${date}T23:59:59Z`).getTime() / 1000);

  // Run parallel searches for individual AI keywords (Algolia treats multi-word as AND)
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

  return allHits
    .filter(h => h.url && (h.points ?? 0) >= 3)
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .slice(0, 25)
    .map(h => ({
      id: `hn-${h.objectID}`,
      title: h.title,
      url: h.url!,
      source: "hackernews" as const,
      score: h.points ?? 0,
      commentCount: h.num_comments ?? 0,
      summary: h.story_text ? stripHtml(h.story_text).slice(0, 600) : undefined,
      publishedAt: h.created_at,
    }));
}

// ── arXiv (cs.AI + cs.LG + cs.CL) ────────────────────────────────────────────

async function fetchArxiv(date: string): Promise<NewsItem[]> {
  const query = "cat:cs.AI OR cat:cs.LG OR cat:cs.CL";
  const url =
    `https://export.arxiv.org/api/query` +
    `?search_query=${encodeURIComponent(query)}` +
    `&sortBy=submittedDate&sortOrder=descending&max_results=40`;

  let res = await fetch(url);
  if (res.status === 429) {
    await new Promise(r => setTimeout(r, 5000));
    res = await fetch(url);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();

  const parser = new XMLParser({ ignoreAttributes: false, isArray: (name) => name === "entry" || name === "author" });
  const parsed = parser.parse(xml) as ArxivFeed;
  const entries = parsed?.feed?.entry ?? [];

  // Accept papers from the target date or the day before (arXiv batches submissions)
  const prev = new Date(new Date(`${date}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
  const accept = new Set([date, prev]);

  return entries
    .filter(e => accept.has((e.published ?? "").slice(0, 10)))
    .slice(0, 15)
    .map(e => {
      const rawId = (e.id ?? "").split("/abs/").pop() ?? e.id ?? "";
      const authors = (e.author ?? []).map(a => a.name).filter(Boolean).slice(0, 3);
      return {
        id: `arxiv-${rawId}`,
        title: normaliseWhitespace(e.title ?? ""),
        url: (e.id ?? "").trim(),
        source: "arxiv" as const,
        summary: normaliseWhitespace(e.summary ?? "").slice(0, 600),
        authors,
        publishedAt: e.published ?? date,
      };
    });
}

interface ArxivFeed {
  feed?: {
    entry?: ArxivEntry[];
  };
}

interface ArxivEntry {
  id?: string;
  title?: string;
  summary?: string;
  author?: { name: string }[];
  published?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

function normaliseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// ── Run ───────────────────────────────────────────────────────────────────────

main().catch(e => {
  console.error("fetch-news failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
