---
name: gen-script
description: Reads the reviewed news selection from cache/news-{date}.json and calls the Claude API to generate the full video narration script. Writes intro, per-story narration (~90s each), and outro to cache/script-{date}.json. Use when the user has reviewed the story selection and wants to generate or regenerate the narration script.
argument-hint: [YYYY-MM-DD]
---

# gen-script

Generates video narration from the reviewed story selection.

## Usage

```bash
npx tsx skills/gen-script.ts --date $ARGUMENTS
```

Pass `--force` to overwrite an existing script file.

## Prerequisites

`cache/news-{date}.json` must exist with at least 3 items where `"selected": true`.
If it is missing, run `/fetch-news` first.

## Prompt design

- Role: professional AI tech host — concise, accurate, no filler words
- Length targets: intro ~75 words (~30s), each story ~225 words (~90s)
- TTS-safe output: no brackets, asterisks, markdown, or special characters
- Every story segment ends with a transition sentence to the next
- Uses `cache_control: ephemeral` on the system prompt for prompt caching

## What it produces

`cache/script-{date}.json` — narration for intro, all 5 stories, and outro.

See [../render/cache-schema.md](../render/cache-schema.md) for the full JSON schema.

## After running

Review `cache/script-{date}.json` and check:
- `narration` reads naturally — edit any stiff or robotic phrasing
- `progressLabel` for each segment is ≤10 words and accurate
- No special characters that would break TTS

Then run `/gen-tts` to synthesise audio.
