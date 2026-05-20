---
name: collect-assets
description: Scans cache/assets/{date}/ for manually placed background images named to match story order (01.jpg, 02.png, …) and writes their paths to cache/assets-{date}.json. Prints each story's source URL so the operator knows where to fetch images from. Use when the user wants to (re)build the image manifest before rendering.
argument-hint: [YYYY-MM-DD]
---

# collect-assets

Builds the image manifest for the day's segments by scanning a numbered-image
folder. Image collection itself is **manual** — the operator visits each
story's source URL, downloads a suitable image, and drops it into the folder
with the matching index.

## Usage

```bash
npx tsx skills/collect-assets.ts --date $ARGUMENTS
```

Pass `--force` to rescan after adding or replacing images (otherwise the
existing manifest is left alone).

## How it works

1. Reads `cache/script-{date}.json` to know story order and source URLs.
2. Prints each story's index, label, and source URL, plus the exact target path:
   `cache/assets/{date}/01.jpg` (or `.jpeg / .png / .webp / .gif`).
3. Creates `cache/assets/{date}/` if it doesn't exist.
4. Scans that folder for numbered files (`1.png`, `01.jpg`, `2.webp`, …);
   `parseInt` is used, so both `1.png` and `01.png` map to slot 1.
5. Writes `cache/assets-{date}.json` with one entry per story:
   - `images: [{ file, source: "manual", credit: null }]` when an image was found
   - `images: []` when missing — the renderer falls back to a plain colour background

## Multi-image segments

The renderer supports a multi-image carousel per segment (Issue 11). To use it,
drop additional numbered files for the same slot using a letter suffix:

- `01.jpg`         → first image of segment 1
- `01b.jpg`        → second image of segment 1
- `01c.jpg`        → third image of segment 1

*(NB: today the skill only reads the leading-integer file per slot — multi-image
collection is on the roadmap. Manifest hand-edits are the workaround.)*

## Auto-fetching is not implemented

An earlier spec described an automatic download chain (og:image → article-page
scrape → Pexels keyword search → solid-colour placeholder). That chain is **not
implemented** today; the skill is intentionally manual so the operator can pick
images that are accurate and rights-cleared. The auto chain may be revived
later as a separate `gen-image` step (which does exist for AI-generated
backgrounds).

## What it produces

`cache/assets-{date}.json` — one entry per story segment, ready for the render
skill to consume.

See [../render/cache-schema.md](../render/cache-schema.md) for the full JSON schema.
