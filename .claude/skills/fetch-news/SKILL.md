---
name: fetch-news
description: Fetches AI news candidates from HackerNews for the specified date, classifies each by source-domain authority, near-duplicates dedupes them, fetches each URL and extracts the article body, then pre-selects the top items. Writes a reviewable list to cache/news-{date}.json. Use when the user wants to collect today's or yesterday's AI news, start the video pipeline, or refresh the story selection for a given date.
argument-hint: [YYYY-MM-DD]
---

# fetch-news

Collects, filters, and dedupes AI news candidates for the specified date
(defaults to yesterday).

## Usage

```bash
npx tsx skills/fetch-news.ts --date $ARGUMENTS
```

Pass `--force` to overwrite an existing cache file.

## Source

| Source | Filter |
|--------|--------|
| HackerNews API (Algolia) | AI-related title keywords; minimum points depends on source-domain tier (see below) |

The pipeline previously also pulled from arXiv. That source was dropped — arXiv
only provides abstracts and the pipeline now requires the full article body
(see Step 4 below). Other sources (Product Hunt, Hugging Face blog, etc.) can
be added later; they're not implemented today.

## What this skill actually does

1. **Search HackerNews** across ~10 AI-keyword queries within the date window.
2. **Classify each hit's domain** as `high` / `neutral` / `low` /
   `non-article`. Lists live in [lib/sources.ts](../../../lib/sources.ts):
   - `high` (Nature, OpenAI blog, Anthropic, WSJ, Reuters, …) → keep at ≥5 points.
   - `neutral` (most ordinary outlets) → keep at ≥30 points.
   - `low` (`*.substack.com`, `*.github.io`, `*.medium.com`, `*.pages.dev`, …)
     → keep at ≥200 points (personal-publishing platforms need to be a viral hit).
   - `non-article` (twitter.com, x.com, youtube.com, reddit.com) → drop entirely.
3. **Near-duplicate dedupe**: two stories are considered duplicates if their
   normalised title token sets overlap by ≥0.55 (or ≥0.40 when sharing the same
   host). The highest-scoring item wins. See [lib/dedup.ts](../../../lib/dedup.ts).
4. **Fetch and extract article text** from each surviving URL using a
   hand-rolled readability heuristic in [lib/article.ts](../../../lib/article.ts).
   Items where extraction fails or yields fewer than 500 characters are
   dropped. Paywalled / 404 / non-HTML pages all fall out here.
5. **Pre-select** the top 5 by HN score as `selected: true`. The
   provider-agnostic LLM ranking step that should override this selection is
   not yet implemented — once it is, it replaces step 5.

## What it produces

`cache/news-{date}.json` — survivors with full article text and a `selected`
flag. Top-level `droppedCounts` records how many items each filter removed.

See [../render/cache-schema.md](../render/cache-schema.md) for the full JSON schema.

## After running

Review `cache/news-{date}.json` and confirm:
- The 3–5 `"selected": true` stories are the right picks (toggle the flag to override).
- `articleText` looks reasonable for each selected story.
- Open `url` in a browser to grab images for `/collect-assets` (the skill prints these URLs again).

Then run `/gen-script` to generate the narration script.
