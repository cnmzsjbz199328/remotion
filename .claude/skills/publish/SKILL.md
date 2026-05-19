---
name: publish
description: Uploads output/{date}.mp4 to YouTube, Bilibili, or WeChat Channels. Supports --dry-run to preview upload parameters without sending. Requires explicit human confirmation before uploading to any platform. Use only when the user has watched the final video and explicitly asks to publish it.
argument-hint: [YYYY-MM-DD]
disable-model-invocation: true
---

# publish

Uploads the rendered video to distribution platforms.

## IMPORTANT

Always run with `--dry-run` first to verify the upload parameters before committing.
Do not proceed without explicit user confirmation.

## Usage

```bash
# Preview the planned upload — no actual network request
npx tsx skills/publish.ts --date $ARGUMENTS --dry-run

# Upload to one or more platforms
npx tsx skills/publish.ts --date $ARGUMENTS --platforms youtube
npx tsx skills/publish.ts --date $ARGUMENTS --platforms youtube bilibili

# Schedule a future upload (ISO 8601 datetime)
npx tsx skills/publish.ts --date $ARGUMENTS --platforms youtube \
  --scheduled-at 2026-05-20T07:00:00+08:00
```

## Prerequisites by platform

| Platform | Required env vars |
|----------|-------------------|
| YouTube | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN` |
| Bilibili | `BILIBILI_SESSDATA`, `BILIBILI_BILI_JCT` |

Run `npx tsx skills/publish.ts --setup` to start the OAuth flow for YouTube.

## What it does

1. Verifies `output/{date}.mp4` exists
2. Reads title and description from `cache/script-{date}.json`
3. Uploads to each specified platform
4. Prints the published URL(s) on success
