# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

This is a **greenfield project**. The only file currently present is `AI_NEWS_VIDEO_DEV_GUIDE.md`, which is the authoritative design document. Read it before starting any implementation work.

## What This Project Is

An automated AI news video generator. The pipeline ingests daily AI news, the AI assistant running the pipeline (Claude Code, GPT-CLI, Gemini-CLI, …) writes a narrated script, then deterministic scripts synthesise TTS audio, collect images, and render a structured MP4 using Remotion (a React-based programmatic video framework).

## Architecture: Skill-Based Pipeline

The project is built as **independent Skills**, not a monolithic pipeline.
Two kinds of skills coexist:

- **AI-driven skills (`.md` only, no `.ts`)** — the cognitive work is done by
  the calling AI assistant (Claude Code / GPT-CLI / Gemini-CLI) using its own
  WebSearch, Read, Write, and Edit tools. The skill is just a SKILL.md
  instruction sheet, invoked as a slash command. No `npm run` entry.
- **Deterministic skills (`.ts`)** — wrappers around tools the assistant
  can't do itself: TTS APIs, ffmpeg, ffprobe, Remotion bundler/renderer,
  filesystem scans, upload SDKs. Invoked via `npm run <skill> -- --date X`.

```
.claude/skills/fetch-ai-insights/SKILL.md  →  cache/news-insights-{date}.json   (AI-driven, WebSearch)
.claude/skills/gen-script/SKILL.md         →  cache/script-{date}.json          (AI-driven, Edit/Write)
skills/gen-tts.ts                          →  cache/tts/{date}/*.wav + tts-manifest-{date}.json
skills/collect-assets.ts                   →  cache/assets-{date}.json
skills/render.ts                           →  output/{date}.mp4
skills/publish.ts                          →  YouTube / Bilibili / WeChat
```

The natural review checkpoints are between `fetch-ai-insights` →
`gen-script` (does the insight list look right?) and `gen-script` →
`gen-tts` (does the narration read well?). All cache JSON files are
designed to be edited by hand.

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

# AI-driven skills — invoked as slash commands by the operator's CLI assistant
#   /fetch-ai-insights 2026-05-19
#   /gen-script 2026-05-19

# Deterministic skills — runnable via npm
npm run gen-tts        -- --date 2026-05-19
npm run collect-assets -- --date 2026-05-19
npm run render         -- --date 2026-05-19
npm run publish        -- --date 2026-05-19 --platforms youtube --dry-run

# Force re-run (ignore existing cache)
npm run gen-tts -- --date 2026-05-19 --force
```

Deterministic skills use `tsx` (TypeScript execution via `npx tsx`). No
separate build step is needed for development. AI-driven skills have no
runtime — they're SKILL.md instruction sheets only.

## Key Implementation Constraints

**TTS**: All TTS output must be normalised to `44100 Hz stereo` via FFmpeg before duration measurement. Skipping this causes audio drift in the final render. Loudness normalisation target: EBU R128 −14 LUFS.

**`publish` Skill**: Must never execute without explicit human confirmation — display planned actions and await approval before uploading to any platform.

**`render` Skill**: Must validate that all referenced audio and image files exist on disk before invoking Remotion. On failure, the error message must name the exact Skill to re-run.

**No LLM API calls anywhere in the codebase.** The cognitive work — finding
authoritative AI news, summarising into Chinese narration, picking progress
labels — is done by the AI assistant that invokes the skills (Claude Code /
GPT-CLI / Gemini-CLI / …) using its own session and WebSearch / WebFetch /
Read / Write / Edit tools. The `skills/*.ts` files are intentionally
deterministic plumbing only: TTS API + ffmpeg + ffprobe, filesystem scan,
Remotion render, upload SDKs.

That's why nothing in `skills/`, `lib/`, or `package.json` references an LLM
SDK, and why CLAUDE.md and SKILL.md descriptions avoid naming a specific
vendor.

**Image sourcing priority**: og:image from article → scraped first large image → Pexels keyword search → solid-colour placeholder (marked `source: "fallback"` in the manifest, not an error).

## Development Order

Start with **Phase 1** (Remotion visual skeleton using hardcoded static Props) before connecting any live APIs. This lets all visual components be validated in Remotion Studio without API costs or network dependencies. See `AI_NEWS_VIDEO_DEV_GUIDE.md` §11 for the full phase breakdown.
