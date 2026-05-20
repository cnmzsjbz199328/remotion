/**
 * gen-script: prepare the day's narration script for the AI assistant to fill in.
 *
 * IMPORTANT: this skill does NOT call any LLM API. The cognitive work
 * (summarising each article into Chinese narration without commentary,
 * picking a tight progressLabel, drafting transition lines) is done by the
 * AI assistant that invoked /gen-script — Claude Code, GPT-CLI, Gemini-CLI,
 * etc. — by reading the news cache + article text and writing the segment
 * fields directly into cache/script-{date}.json via its Edit/Write tools.
 *
 * What this script does (the deterministic parts):
 *   1. Validate cache/news-{date}.json exists and has ≥3 items marked
 *      `selected: true` with `articleText` ≥500 chars (Issues 3a + 14).
 *   2. Write a stub cache/script-{date}.json that already contains:
 *        - intro.narration  = FIXED_INTRO_NARRATION  (Issue 16)
 *        - outro.narration  = FIXED_OUTRO_NARRATION  (Issue 16)
 *        - segments[]       = one entry per selected story, with newsId /
 *                              sourceUrl pre-filled and narration / keyPoints /
 *                              progressLabel / transitionLine set to empty
 *                              strings for the assistant to fill in.
 *        - intro.overview[] = one entry per story with oneLiner=""
 *   3. Print a context block (title + host + article text) for each selected
 *      story so the assistant has everything needed in its current context.
 *   4. Print the editorial rules (no commentary, ≤16-char progressLabel,
 *      narration grounded only in articleText, transition sentences, …) so
 *      the assistant doesn't need to re-read SKILL.md.
 *
 * Run as:  npm run gen-script -- --date YYYY-MM-DD [--force]
 */

import path from "path";
import fs from "fs";
import {
  FIXED_INTRO_NARRATION,
  FIXED_OUTRO_NARRATION,
  INTRO_ESTIMATED_S,
  OUTRO_ESTIMATED_S,
} from "../lib/narration-constants";

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag: string) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
};
const date  = getArg("--date") ?? new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const force = args.includes("--force");

const newsPath   = path.resolve(`cache/news-${date}.json`);
const scriptPath = path.resolve(`cache/script-${date}.json`);

// ── News cache types (subset) ─────────────────────────────────────────────────

interface NewsItem {
  id: string;
  title: string;
  url: string;
  host?: string;
  articleText?: string;
  articleChars?: number;
  selected: boolean;
}

interface NewsCache {
  date: string;
  items: NewsItem[];
}

// ── Script stub shape (matches remotion/types.ts VideoScript) ─────────────────

interface OverviewItem  { newsId: string; oneLiner: string; }
interface IntroScript   { narration: string; estimatedDurationS: number; overview: OverviewItem[]; }
interface OutroScript   { narration: string; estimatedDurationS: number; }
interface NewsSegmentScript {
  newsId: string;
  progressLabel: string;
  narration: string;
  estimatedDurationS: number;
  keyPoints: string[];
  transitionLine: string;
  category?: string;
  sourceUrl?: string;
}
interface VideoScript {
  date: string;
  intro: IntroScript;
  segments: NewsSegmentScript[];
  outro: OutroScript;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(newsPath)) {
    fail(`news cache missing: ${newsPath}\n    Run: npm run fetch-news -- --date ${date}`);
  }
  if (fs.existsSync(scriptPath) && !force) {
    console.log(`Script already exists: ${scriptPath}`);
    console.log("Use --force to overwrite with a fresh stub.");
    process.exit(0);
  }

  const news: NewsCache = JSON.parse(fs.readFileSync(newsPath, "utf-8"));
  const selected = news.items.filter((i) => i.selected);

  if (selected.length < 3) {
    fail(
      `Only ${selected.length} item(s) marked \`selected: true\` in ${newsPath}.\n` +
      `    Open the file and toggle \`selected\` to true on at least 3 stories,\n` +
      `    then re-run.`,
    );
  }
  if (selected.length > 5) {
    console.warn(`⚠  ${selected.length} items selected — only the first 5 will be used.`);
  }
  const top = selected.slice(0, 5);

  const missingArticle = top.filter((i) => !i.articleText || i.articleText.length < 500);
  if (missingArticle.length > 0) {
    fail(
      `These selected items have no usable articleText (need ≥500 chars):\n` +
      missingArticle.map((i) => `      - ${i.id}  ${i.title}  (${i.articleChars ?? 0} chars)`).join("\n") +
      `\n    Re-run fetch-news with --force, or unselect these items.`,
    );
  }

  // ── Write a stub script with fixed intro/outro and empty per-segment fields ──
  const stub: VideoScript = {
    date,
    intro: {
      narration: FIXED_INTRO_NARRATION,
      estimatedDurationS: INTRO_ESTIMATED_S,
      overview: top.map((it) => ({ newsId: it.id, oneLiner: "" })),
    },
    segments: top.map((it): NewsSegmentScript => ({
      newsId: it.id,
      progressLabel: "",
      narration: "",
      estimatedDurationS: 0,
      keyPoints: [],
      transitionLine: "",
      sourceUrl: it.url,
    })),
    outro: {
      narration: FIXED_OUTRO_NARRATION,
      estimatedDurationS: OUTRO_ESTIMATED_S,
    },
  };
  fs.mkdirSync("cache", { recursive: true });
  fs.writeFileSync(scriptPath, JSON.stringify(stub, null, 2), "utf-8");

  // ── Print the assistant's working context ──
  console.log(`[gen-script] ${date}  ${top.length} stories ready for narration`);
  console.log(`Stub written: ${scriptPath}`);
  console.log("");
  console.log("================ EDITORIAL RULES ================");
  console.log("• Output language: Simplified Chinese.");
  console.log("• narration: 180–260 汉字 per segment, faithful summary of articleText only.");
  console.log("• NO commentary / speculation. Forbidden phrasings include:");
  console.log("    分析人士认为、专家表示、引发讨论、深远影响、值得关注、");
  console.log("    在...的当下、未来可能、或将、有望、恐将、无疑");
  console.log("• progressLabel: ≤16-char Chinese noun phrase, no punctuation.");
  console.log("• keyPoints: 3 short factual bullets, ≤30 chars each.");
  console.log("• transitionLine: one sentence bridging to the next story.");
  console.log("  Last segment uses a generic closing (e.g. 以上就是今天的全部要闻。).");
  console.log("• oneLiner (in intro.overview): ≤30-char summary line per story.");
  console.log("• intro.narration and outro.narration are FIXED — do not edit.");
  console.log("• Output must be TTS-safe: no markdown, no asterisks, no brackets.");
  console.log("");
  console.log("================ STORIES ================");
  for (let i = 0; i < top.length; i++) {
    const it = top[i];
    console.log(`\n## ${i + 1}/${top.length}  newsId=${it.id}`);
    console.log(`   title: ${it.title}`);
    console.log(`   host:  ${it.host ?? "(unknown)"}`);
    console.log(`   url:   ${it.url}`);
    console.log(`   articleText (${it.articleChars} chars):`);
    console.log(`     ${truncateLog(it.articleText!, 1200)}`);
  }
  console.log("");
  console.log("Next: edit the empty fields in cache/script-" + date + ".json,");
  console.log("then run /gen-tts.");
}

function truncateLog(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n) + ` … [+${s.length - n} chars truncated for log; full text is in news-${date}.json]`;
}

function fail(msg: string): never {
  console.error(`❌  ${msg}`);
  process.exit(1);
}

main();
