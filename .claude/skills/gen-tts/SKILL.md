---
name: gen-tts
description: Reads cache/script-{date}.json and synthesises TTS audio for every segment in parallel. Normalises loudness to EBU R128 –14 LUFS with FFmpeg, measures precise durations using ffprobe, and writes audio files plus a frame-accurate timing manifest to cache/tts-manifest-{date}.json. Use when the user has approved the narration script and wants to generate voice audio.
argument-hint: [YYYY-MM-DD]
---

# gen-tts

Synthesises TTS audio for all script segments and records their precise frame counts.

## Usage

```bash
npx tsx skills/gen-tts.ts --date $ARGUMENTS
```

Pass `--force` to regenerate all segments, ignoring cached audio.

## Prerequisites

- `cache/script-{date}.json` must exist
- `ELEVENLABS_API_KEY` (or `OPENAI_API_KEY`, or set `TTS_ENGINE=edge-tts` for free)
- FFmpeg + ffprobe on PATH

## TTS engines

| Engine | `TTS_ENGINE` value | Quality | Cost |
|--------|--------------------|---------|------|
| ElevenLabs `eleven_multilingual_v2` | `elevenlabs` | ★★★★★ | from $5/mo |
| OpenAI `tts-1-hd` | `openai` | ★★★★☆ | $15/1M chars |
| Edge TTS | `edge-tts` | ★★★☆☆ | free |

## Caching

Audio files are named by the MD5 hash of their text content. Editing one segment and re-running only regenerates that segment's audio — unchanged segments are skipped.

## What it produces

- `cache/tts/{date}/*.mp3` — loudness-normalised audio files (44100 Hz, stereo)
- `cache/tts-manifest-{date}.json` — `durationFrames` per segment for Remotion

`durationFrames = ceil(durationMs / (1000 / fps)) + 2`

See [../render/cache-schema.md](../render/cache-schema.md) for the full JSON schema.

## After running

Listen to each segment to check voice quality and pacing. Then run `/collect-assets` or go straight to `/render`.
