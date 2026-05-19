---
name: fetch-news
description: Fetches the previous day's top AI news from HackerNews, arXiv, Product Hunt, and Hugging Face. Scores and ranks candidates with Claude, then writes a reviewable list to cache/news-{date}.json. Use when the user wants to collect today's or yesterday's AI news, start the video pipeline, or refresh the story selection for a given date.
argument-hint: [YYYY-MM-DD]
---

# fetch-news

Collects and scores AI news candidates for the specified date (defaults to yesterday).

## Usage

```bash
npx tsx skills/fetch-news.ts --date $ARGUMENTS
```

Pass `--force` to overwrite an existing cache file.

## Sources

| Source | Filter |
|--------|--------|
| HackerNews API | ≥100 points, AI-related title keywords |
| arXiv cs.AI RSS | All daily papers |
| Product Hunt RSS | AI-tagged posts |
| Hugging Face Blog RSS | All posts |
| OpenAI Blog RSS | All posts |

## What it produces

`cache/news-{date}.json` — 10–15 scored candidates. Open this file and set `"selected": false` on any story you want to exclude before running `/gen-script`.

See [../render/cache-schema.md](../render/cache-schema.md) for the full JSON schema.

## After running

Review `cache/news-{date}.json` and confirm:
- The 5 `"selected": true` stories are the right picks
- `imageUrl` is populated where possible (edit to add a better URL if needed)

Then run `/gen-script` to generate the narration script.
