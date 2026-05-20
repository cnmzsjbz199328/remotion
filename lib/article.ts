/**
 * Minimal article-text extractor.
 *
 * Per the pipeline spec (Issue 14): stories without retrievable original
 * article text get dropped before the LLM ranking / summary stages. Abstracts
 * and bare titles are not enough — narration must be grounded in the real
 * article body.
 *
 * Strategy: fetch HTML, prefer <article> / <main> tag content, fall back to
 * the entire <body>. Strip script/style/svg, strip remaining tags, decode
 * common HTML entities, and normalise whitespace. This is intentionally a
 * hand-rolled extractor rather than a full readability dependency — daily
 * usage is small (~15 URLs) and a 70%-correct extractor is enough to filter
 * out paywalled / 404 / non-article pages.
 */

const MIN_ARTICLE_CHARS = 500;
const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; AI-News-Pipeline/1.0; +https://github.com/)";

export interface ExtractResult {
  ok: boolean;
  text: string;         // empty when !ok
  reason?: string;      // explanation when !ok
  charCount: number;
}

const tagStripRegex = /<[^>]+>/g;

const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">",
  "&quot;": '"', "&#39;": "'", "&apos;": "'",
  "&mdash;": "—", "&ndash;": "–", "&hellip;": "…",
  "&ldquo;": '"', "&rdquo;": '"', "&lsquo;": "'", "&rsquo;": "'",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&[a-z]+;|&#\d+;/g, (m) => HTML_ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCodePoint(parseInt(code, 10)),
    );
}

function stripBlocks(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, "")
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

function htmlToText(htmlFragment: string): string {
  const stripped = htmlFragment.replace(tagStripRegex, " ");
  const decoded = decodeEntities(stripped);
  return decoded.replace(/\s+/g, " ").trim();
}

export function extractFromHtml(html: string): string {
  const cleaned = stripBlocks(html);
  const articleMatch = cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) {
    const t = htmlToText(articleMatch[1]);
    if (t.length >= MIN_ARTICLE_CHARS) return t;
  }
  const mainMatch = cleaned.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    const t = htmlToText(mainMatch[1]);
    if (t.length >= MIN_ARTICLE_CHARS) return t;
  }
  const bodyMatch = cleaned.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) return htmlToText(bodyMatch[1]);
  return htmlToText(cleaned);
}

export async function extractArticleText(url: string): Promise<ExtractResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, "Accept": "text/html,*/*;q=0.8" },
      redirect: "follow",
    });
    if (!res.ok) {
      return { ok: false, text: "", reason: `HTTP ${res.status}`, charCount: 0 };
    }
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      return { ok: false, text: "", reason: `non-html (${ct})`, charCount: 0 };
    }
    const html = await res.text();
    const text = extractFromHtml(html);
    if (text.length < MIN_ARTICLE_CHARS) {
      return {
        ok: false,
        text,
        reason: `extracted ${text.length} chars < ${MIN_ARTICLE_CHARS}`,
        charCount: text.length,
      };
    }
    return { ok: true, text, charCount: text.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, text: "", reason: msg, charCount: 0 };
  } finally {
    clearTimeout(timer);
  }
}
