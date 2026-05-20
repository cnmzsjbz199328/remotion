/**
 * Source-authority signals for news candidates.
 *
 * Items from high-trust domains pass through with the default points threshold.
 * Items from explicit low-signal hosts (personal blogs, generic publishing
 * platforms, social) must clear a much higher points bar to survive.
 *
 * Lists are intentionally small and conservative — easier to extend than to
 * walk back a false-positive ban.
 */

const HIGH_TRUST_HOSTS = new Set<string>([
  // Research / institutional
  "nature.com", "science.org",
  "deepmind.com", "research.google", "ai.googleblog.com",
  "openai.com", "anthropic.com", "huggingface.co", "mistral.ai",
  "research.facebook.com", "ai.meta.com",
  // Major tech / business press
  "wsj.com", "ft.com", "bloomberg.com", "reuters.com", "nytimes.com",
  "theverge.com", "wired.com", "arstechnica.com", "technologyreview.com",
  "fortune.com", "theinformation.com", "axios.com",
  // Developer / industry
  "github.blog", "stackoverflow.blog",
]);

// Hosts where anyone can publish — apply a higher floor.
const LOW_SIGNAL_PATTERNS: RegExp[] = [
  /(^|\.)substack\.com$/,
  /(^|\.)medium\.com$/,
  /(^|\.)github\.io$/,
  /(^|\.)pages\.dev$/,
  /(^|\.)vercel\.app$/,
  /(^|\.)netlify\.app$/,
  /(^|\.)blogspot\.com$/,
  /(^|\.)wordpress\.com$/,
  /(^|\.)tumblr\.com$/,
];

// Hosts that aren't articles at all — drop entirely (a story can't be a tweet,
// and abstract-only sources like arXiv can't satisfy the article-text requirement).
const NON_ARTICLE_HOSTS = new Set<string>([
  "twitter.com", "x.com", "t.co",
  "youtube.com", "youtu.be",
  "reddit.com",
  "news.ycombinator.com",
  // Abstract-only / paper hosts — surface as references inside other stories,
  // but never use them as the primary news item.
  "arxiv.org", "openreview.net",
]);

export type SourceTier = "high" | "neutral" | "low" | "non-article";

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function classifySource(url: string): SourceTier {
  const host = hostOf(url);
  if (!host) return "neutral";
  if (NON_ARTICLE_HOSTS.has(host)) return "non-article";
  if (HIGH_TRUST_HOSTS.has(host)) return "high";
  if (LOW_SIGNAL_PATTERNS.some((re) => re.test(host))) return "low";
  return "neutral";
}

/**
 * Minimum HN points required for a story to survive, given its source tier.
 * Returns `Infinity` to mean "always drop".
 */
export function pointsFloorFor(tier: SourceTier): number {
  switch (tier) {
    case "high":         return 1;     // Nature / OpenAI blog / Anthropic / WSJ etc. — surface any
    case "neutral":      return 10;    // ordinary news outlets — needs minimal upvote signal
    case "low":          return 100;   // personal-publishing platforms must be viral hits
    case "non-article":  return Infinity;
  }
}
