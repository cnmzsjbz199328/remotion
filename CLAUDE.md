# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

This is a **greenfield project**. The only file currently present is `AI_NEWS_VIDEO_DEV_GUIDE.md`, which is the authoritative design document. Read it before starting any implementation work.

## What This Project Is

An automated AI news video generator. The pipeline ingests daily AI news, the AI assistant running the pipeline (Claude Code, GPT-CLI, Gemini-CLI, …) writes a narrated script, then deterministic scripts synthesise TTS audio, collect images, and render a structured MP4 using Remotion (a React-based programmatic video framework).

## Architecture: Skill-Based Pipeline

The project is built as **six independent Skills**, not a monolithic pipeline. Each Skill:
- reads from and writes to a dated JSON file in `cache/`
- can be run individually with `--date` and `--force` flags
- is idempotent (re-running with the same input skips already-cached work)

```
skills/fetch-news.ts      →  cache/news-{date}.json
skills/gen-script.ts      →  cache/script-{date}.json
skills/gen-tts.ts         →  cache/tts/{date}/*.mp3  +  cache/tts-manifest-{date}.json
skills/collect-assets.ts  →  cache/assets-{date}.json
skills/render.ts          →  output/{date}.mp4
skills/publish.ts         →  YouTube / Bilibili
```

Human review is expected between `fetch-news` → `gen-script` (story selection) and `gen-script` → `gen-tts` (narration copy). The cache JSON files are designed to be edited by hand.

## Remotion's Role

Remotion is the video renderer. Its only job is: **given a `VideoInputProps` object, deterministically render every frame**. It does not call any APIs. All Props are prepared by the preceding Skills and passed in as a single JSON object at render time.

The `VideoInputProps` type in `remotion/types.ts` is the contract between the pipeline and the Remotion components. Any change to the cache file schemas must be reflected there.

## Visual Style

There is **one composition** — `NewsVideo` in `remotion/NewsVideo.tsx`. Earlier "dark" and "vibe" variants have been removed; do not reintroduce style branches without explicit direction.

- **Palette**: warm light cards on a `#fff8ed → #ffefd4` gradient. Per-story accent colors live in `THEMES` in `remotion/components/NewsSegmentScene.tsx`.
- **Mascot**: `remotion/components/MascotSystem.tsx` owns three roles for the same Lottie horse (`remotion/assets/horse-walk.json`):
  1. **Intro** — gallops in from the right (mirrored via `scaleX(-1)`), pauses center under the title, then shrinks to the bottom-left corner of the progress bar.
  2. **Progress** — walks left→right along the bottom bar through all story segments, position derived from `frame / totalFrames`.
  3. **Outro** — leaps from the progress bar back to center, grows, and breathes (sine-wave Y offset).
  The mascot also renders the intro title text — when `mascotMode` is true, `Intro.tsx` only paints the background.
- **Background music**: `public/bgm.wav` plays at `volume={0.18}` for the entire video as a single top-level `<Audio>` element in `NewsVideo.tsx`. The file was derived from "Happy Pride month.m4a" via `ffmpeg loudnorm=I=-20`. There are no per-segment transition SFX — the 2-second gaps between segments are intentional silence over BGM.
- **`progressLabel`** drives the chapter labels in the progress bar and is truncated to 16 characters there. Keep gen-script output ≤16 characters per label.

Audio-video sync is achieved by calculating `durationInFrames` from the TTS audio duration measured by `ffprobe`:
```
durationInFrames = Math.ceil(durationMs / (1000 / fps)) + 2
```
The `+2` frame buffer prevents audio cut-off. Never hardcode segment durations.

## Commands

```bash
# Remotion Studio (live preview during component development)
npm run studio

# Run individual Skills
npm run fetch-news -- --date 2026-05-19
npm run gen-script -- --date 2026-05-19
npm run gen-tts    -- --date 2026-05-19
npm run collect-assets -- --date 2026-05-19
npm run render     -- --date 2026-05-19
npm run publish    -- --date 2026-05-19 --platforms youtube --dry-run

# Force re-run a Skill (ignore existing cache)
npm run gen-script -- --date 2026-05-19 --force
```

All Skills use `tsx` (TypeScript execution via `npx tsx`). No separate build step is needed for development.

## Key Implementation Constraints

**TTS**: All TTS output must be normalised to `44100 Hz stereo` via FFmpeg before duration measurement. Skipping this causes audio drift in the final render. Loudness normalisation target: EBU R128 −14 LUFS.

**`publish` Skill**: Must never execute without explicit human confirmation — display planned actions and await approval before uploading to any platform.

**`render` Skill**: Must validate that all referenced audio and image files exist on disk before invoking Remotion. On failure, the error message must name the exact Skill to re-run.

**No LLM API calls in skill scripts.** The cognitive work in this pipeline —
ranking news candidates, summarising articles into Chinese narration, picking
progress labels — is done by the AI assistant that invokes the skills (Claude
Code, GPT-CLI, Gemini-CLI, etc.) using its own session. The `skills/*.ts`
files are intentionally deterministic plumbing: HTTP fetching, dedup, article
extraction, TTS, render. `gen-script.ts` validates inputs and writes a stub
script; the assistant then edits the stub with its Edit/Write tools.

That's why nothing in `skills/` or `lib/` imports an LLM SDK and why CLAUDE.md
and SKILL.md descriptions avoid naming a specific vendor.

**Image sourcing priority**: og:image from article → scraped first large image → Pexels keyword search → solid-colour placeholder (marked `source: "fallback"` in the manifest, not an error).

## Development Order

Start with **Phase 1** (Remotion visual skeleton using hardcoded static Props) before connecting any live APIs. This lets all visual components be validated in Remotion Studio without API costs or network dependencies. See `AI_NEWS_VIDEO_DEV_GUIDE.md` §11 for the full phase breakdown.
