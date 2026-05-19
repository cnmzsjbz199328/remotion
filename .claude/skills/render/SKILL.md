---
name: render
description: Validates all pipeline cache files for the given date, assembles VideoInputProps, and invokes Remotion to render output/{date}.mp4 at 1920x1080 H.264 30fps. Exits with a clear error naming which skill to re-run if any required file is missing. Use only when the user explicitly asks to render the video.
argument-hint: [YYYY-MM-DD]
disable-model-invocation: true
---

# render

Renders the final MP4 for the specified date (defaults to yesterday).

## Usage

```bash
# Render from pipeline cache files
npx tsx skills/render.ts --date $ARGUMENTS

# Render from hardcoded static test data (no cache files required)
npx tsx skills/render.ts --static

# Overwrite an existing output file
npx tsx skills/render.ts --date $ARGUMENTS --force
```

## Current cache state

```!
node scripts/check-cache.js $ARGUMENTS
```

## Required files

All four files must be present (see cache state above):

| File | Produced by |
|------|-------------|
| `cache/news-{date}.json` | `/fetch-news` |
| `cache/script-{date}.json` | `/gen-script` |
| `cache/tts-manifest-{date}.json` | `/gen-tts` |
| `cache/assets-{date}.json` | `/collect-assets` |

## What it produces

`output/{date}.mp4` — 1920×1080 H.264 video at 30 fps

Rendering ~8 minutes of video takes approximately 5–15 minutes on a modern CPU (4 concurrent workers).

## Schema reference

For full schemas of all four cache files, see [cache-schema.md](cache-schema.md).
