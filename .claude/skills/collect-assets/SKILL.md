---
name: collect-assets
description: Downloads background images for each news story. Tries the article's og:image first, then scrapes the first large image from the article page, then falls back to a Pexels keyword search, then a solid-colour placeholder. Writes local paths and attribution to cache/assets-{date}.json. Use when the user wants to collect images before rendering, or to refresh the image selection for a given date.
argument-hint: [YYYY-MM-DD]
---

# collect-assets

Collects background images for each news segment.

## Usage

```bash
npx tsx skills/collect-assets.ts --date $ARGUMENTS
```

Pass `--force` to re-download even if cached images exist.

## Prerequisites

- `cache/news-{date}.json` — provides `imageUrl` values per story
- `cache/script-{date}.json` — provides article URLs and title keywords
- `PEXELS_API_KEY` in `.env` (optional; falls back to placeholder if absent)

## Collection priority

1. `imageUrl` already in `news-{date}.json` (the article's og:image)
2. First large image scraped from the article page (width > 600 px)
3. Pexels keyword search using the story title
4. Solid-colour placeholder (marked `"source": "fallback"` in the manifest)

## What it produces

- `cache/assets/{date}/*.jpg` — downloaded images (max 1920×1080, JPEG quality 90)
- `cache/assets-{date}.json` — local paths and Pexels attribution per segment

Items with `"source": "fallback"` mean no suitable image was found. Replace the `"file"` path manually with a better local image before rendering.

See [../render/cache-schema.md](../render/cache-schema.md) for the full JSON schema.
