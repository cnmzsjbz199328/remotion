# AI News Video Generation — Development Guide

> Skill-driven architecture built on Remotion + Claude API + TTS  
> Each Skill is independent, reviewable, and individually re-runnable — supports manual step-by-step execution or full AI orchestration

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Video Structure](#2-video-structure)
3. [Skill Overview](#3-skill-overview)
4. [Cache File Specifications](#4-cache-file-specifications)
5. [Skill Detailed Specifications](#5-skill-detailed-specifications)
6. [Remotion Component Design](#6-remotion-component-design)
7. [Key Technique: Audio-Video Sync](#7-key-technique-audio-video-sync)
8. [Key Technique: Progress Bar and Chapters](#8-key-technique-progress-bar-and-chapters)
9. [Reference Projects and Ecosystem](#9-reference-projects-and-ecosystem)
10. [Environment Setup](#10-environment-setup)
11. [Development Phases](#11-development-phases)

---

## 1. Design Philosophy

### Core Principles

This project is not a black-box automated pipeline — it is a set of **independent Skills with well-defined contracts**:

```
Reviewable  — Every Skill's output is a human-readable JSON file that can be
              inspected and edited before the next step runs
Re-runnable — Any Skill can be re-run independently; its output is persisted
              to disk without affecting other Skills' existing outputs
Orchestrable — Claude (or any AI) can drive each Skill like a tool call; a
              human can also advance the workflow manually step by step
Idempotent  — The same input produces the same output; existing cache is
              skipped automatically, saving API costs
```

### Workflow Overview

```
[skill: fetch-news]     →  cache/news-2026-05-19.json
                                      ↓ human review / edit (adjust selections, add info)
[skill: gen-script]     →  cache/script-2026-05-19.json
                                      ↓ human review / edit (refine wording, adjust length)
[skill: gen-tts]        →  cache/tts/2026-05-19/*.mp3  +  tts-manifest.json
                                      ↓ optional: listen to each audio segment
[skill: collect-assets] →  cache/assets-2026-05-19.json
                                      ↓ optional: preview image list, replace any unwanted images
[skill: render]         →  output/2026-05-19.mp4
                                      ↓ watch the finished video
[skill: publish]        →  YouTube / Bilibili / WeChat Channels
```

### Alignment with Remotion

Remotion's core model is: **given a set of Props, deterministically render every frame**.  
The Skill architecture aligns naturally with this model: the first four Skills prepare high-quality Props (JSON), and the `render` Skill injects those Props into Remotion to complete a pure deterministic render. Human review happens during the Props preparation phase; the render itself is entirely deterministic.

---

## 2. Video Structure

```
┌──────────────────────────────────────────────────────────┐
│  00:00  Intro (5s)      — date + show title animation    │
│  00:05  Overview (~30s) — 5 news titles + one-line recap │
│  00:35  Story 1 (~90s)  — images + voice + word captions │
│  02:05  Story 2 (~90s)                                   │
│  03:35  Story 3 (~90s)                                   │
│  05:05  Story 4 (~90s)                                   │
│  06:35  Story 5 (~90s)                                   │
│  08:05  Outro (10s)     — subscribe CTA                  │
└──────────────────────────────────────────────────────────┘
  Bottom progress bar: segmented by story, showing titles,
  highlighting the current segment in real time
```

**Note**: Actual segment durations are determined dynamically by the TTS output. The durations above are estimates only. Remotion frame counts are driven entirely by TTS audio length — nothing is hardcoded.

---

## 3. Skill Overview

| Skill | Trigger | Reads | Writes | Review Point |
|-------|---------|-------|--------|-------------|
| `fetch-news` | manual / AI | network (RSS/API) | `news-{date}.json` | ✅ review story selection |
| `gen-script` | manual / AI | `news-{date}.json` | `script-{date}.json` | ✅ review narration copy |
| `gen-tts` | manual / AI | `script-{date}.json` | `tts/` + `tts-manifest-{date}.json` | optional (listen) |
| `collect-assets` | manual / AI | `script-{date}.json` | `assets-{date}.json` | optional (preview images) |
| `render` | manual / AI | `script` + `tts-manifest` + `assets` | `output/{date}.mp4` | ✅ watch the video |
| `publish` | manual (confirm required) | `output/{date}.mp4` | platforms | ✅ confirm before upload |

**Calling convention**:

```bash
# Specify a date (defaults to yesterday)
npx tsx skills/fetch-news.ts --date 2026-05-19

# Force re-run, ignoring existing cache
npx tsx skills/gen-script.ts --date 2026-05-19 --force

# When AI-orchestrated, called via MCP / Claude Tool Use with the same parameters
```

---

## 4. Cache File Specifications

All intermediate artifacts are stored in `cache/` as **human-readable, human-editable JSON**.

### 4.1 `news-{date}.json` — Story Selection

```jsonc
{
  "date": "2026-05-19",
  "generatedAt": "2026-05-19T22:00:00Z",
  "source": "fetch-news@1.0",
  "items": [
    {
      "id": "hn-12345678",
      "rank": 1,                           // AI ranking
      "aiScore": 9.2,                      // importance score 1–10
      "aiScoreReason": "OpenAI released a new model with major industry impact",
      "title": "OpenAI releases GPT-5 with extended thinking",
      "url": "https://openai.com/blog/gpt-5",
      "source": "HackerNews",
      "publishedAt": "2026-05-18T15:30:00Z",
      "hnPoints": 1240,
      "excerpt": "Original article excerpt...",
      "imageUrl": "https://...",           // og:image; can be null
      "category": "model-release",         // model-release / research / product / policy
      "selected": true                     // set to false to exclude this story
    }
    // ... 10–15 candidates; confirm 5 as selected: true
  ]
}
```

**Human review checklist**:
- Verify the 5 `selected: true` stories are the right picks
- Adjust the `title` wording if needed
- Replace `imageUrl` if the original image is low quality

---

### 4.2 `script-{date}.json` — Video Script

```jsonc
{
  "date": "2026-05-19",
  "generatedAt": "2026-05-19T22:05:00Z",
  "source": "gen-script@1.0",
  "intro": {
    "narration": "Welcome to today's AI news briefing for May 19, 2026...",
    "estimatedDurationS": 30,
    "overview": [
      { "newsId": "hn-12345678", "oneLiner": "OpenAI drops GPT-5 with longer, stronger chain-of-thought" }
      // ... 5 items
    ]
  },
  "segments": [
    {
      "newsId": "hn-12345678",
      "progressLabel": "GPT-5 Release",  // shown in the progress bar, ≤10 words
      "narration": "OpenAI today officially...", // detailed narration, ~225 words, ~90s
      "estimatedDurationS": 90,
      "keyPoints": [                     // bullet-point cards shown on screen (optional)
        "128K context window",
        "40% average improvement in chain-of-thought",
        "API available today"
      ],
      "transitionLine": "Now let's move on to our second story." // closing transition sentence
    }
    // ... 5 segments
  ],
  "outro": {
    "narration": "That's all for today's AI news briefing...",
    "estimatedDurationS": 10
  }
}
```

**Human review checklist**:
- Check that `narration` reads naturally and flows well for TTS (no stiff translation tone)
- Verify `progressLabel` is concise and accurate
- Adjust `estimatedDurationS` as a reference — the `gen-tts` Skill uses the actual audio duration

---

### 4.3 `tts-manifest-{date}.json` — TTS Manifest

```jsonc
{
  "date": "2026-05-19",
  "generatedAt": "2026-05-19T22:15:00Z",
  "source": "gen-tts@1.0",
  "engine": "elevenlabs",
  "voiceId": "your-voice-id",
  "fps": 30,
  "segments": [
    {
      "id": "intro",
      "audioFile": "cache/tts/2026-05-19/intro.mp3",
      "durationMs": 28400,
      "durationFrames": 853,             // ceil(durationMs / (1000 / fps))
      "text": "Welcome to today's..."    // original text, for verification
    },
    {
      "id": "segment-1",
      "newsId": "hn-12345678",
      "progressLabel": "GPT-5 Release",
      "audioFile": "cache/tts/2026-05-19/segment-1.mp3",
      "durationMs": 91200,
      "durationFrames": 2736,
      "text": "OpenAI today officially..."
    }
    // ... intro / segment-1~5 / outro
  ],
  "totalDurationMs": 512000,
  "totalFrames": 15510                   // includes intro animation, outro, and transition frames
}
```

---

### 4.4 `assets-{date}.json` — Asset Manifest

```jsonc
{
  "date": "2026-05-19",
  "generatedAt": "2026-05-19T22:12:00Z",
  "source": "collect-assets@1.0",
  "segments": [
    {
      "newsId": "hn-12345678",
      "images": [
        {
          "file": "cache/assets/2026-05-19/hn-12345678-0.jpg",
          "source": "og-image",          // og-image / pexels / unsplash / fallback
          "credit": null
        },
        {
          "file": "cache/assets/2026-05-19/hn-12345678-1.jpg",
          "source": "pexels",
          "credit": "Photo by John Doe on Pexels"
        }
      ]
    }
  ]
}
```

**Human review checklist**:
- Preview images for relevance to each story
- `source: "fallback"` entries (solid-color backgrounds) mean image collection failed — replace the `file` path manually if needed

---

## 5. Skill Detailed Specifications

### Skill 1: `fetch-news`

**Responsibility**: Fetch AI-related news from multiple sources, score with Claude, and output a candidate list.

**Input parameters**:

```typescript
interface FetchNewsOptions {
  date?: string;          // YYYY-MM-DD, defaults to yesterday
  force?: boolean;        // re-run even if cache exists
  maxCandidates?: number; // number of candidates, default 15
}
```

**Source list**:

```typescript
const SOURCES = [
  // HackerNews: only posts with 100+ points and AI-related keywords
  { type: 'hn-api', minPoints: 100, keywords: ['AI', 'LLM', 'GPT', 'Claude', 'model', 'agent', 'neural'] },
  // arXiv: daily cs.AI papers
  { type: 'rss', url: 'https://rss.arxiv.org/rss/cs.AI' },
  // Product Hunt: AI products
  { type: 'rss', url: 'https://www.producthunt.com/feed', keywords: ['AI', 'artificial intelligence'] },
  // Hugging Face Blog: model releases
  { type: 'rss', url: 'https://huggingface.co/blog/feed.xml' },
  // OpenAI Blog
  { type: 'rss', url: 'https://openai.com/blog/rss.xml' },
];
```

**Claude scoring call** (batch submission with Prompt Cache to minimize API cost):

```typescript
const response = await claude.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 2000,
  system: [
    {
      type: 'text',
      text: SCORING_SYSTEM_PROMPT,
      cache_control: { type: 'ephemeral' }, // cache the system prompt
    },
  ],
  messages: [{ role: 'user', content: JSON.stringify(candidates) }],
});
```

**Output**: `cache/news-{date}.json` — prints a summary after writing and prompts for human review.

---

### Skill 2: `gen-script`

**Responsibility**: Read the reviewed story selection and call Claude to generate the video script.

**Input**: `cache/news-{date}.json` (only processes items with `selected: true`)

**Validation**: If fewer than 3 items have `selected: true`, exit with an error and prompt the user to update the selection.

**Claude prompt design**:

```
Role: You are a professional tech host specialising in AI. Style: concise, accurate, and insightful.
Tone: Conversational, suitable for TTS narration (no brackets, asterisks, or math symbols).
Length: Intro ~30s (~75 words), each story ~90s (~225 words).
Structure: Each segment ends with a natural transition sentence to the next.
Output: Strict JSON conforming to the VideoScript schema.
```

**Output**: `cache/script-{date}.json` — prints estimated duration for each segment and prompts for human review.

---

### Skill 3: `gen-tts`

**Responsibility**: Read the script, generate audio files for all segments in parallel, and record precise durations.

**Input**: `cache/script-{date}.json`

**Parallelism**: All segments are requested concurrently (`Promise.all`). Total time equals the slowest single segment — typically 5–15 seconds.

**Caching**: Audio files are named by the MD5 hash of their text content. If the file already exists it is skipped. Re-running after editing only one segment regenerates that segment's audio only.

**Duration measurement** — use `ffprobe` for accuracy (TTS API-reported durations can be imprecise):

```typescript
import { execSync } from 'child_process';

function getAudioDurationMs(filePath: string): number {
  const output = execSync(
    `ffprobe -v quiet -print_format json -show_streams "${filePath}"`
  ).toString();
  const info = JSON.parse(output);
  return Math.round(parseFloat(info.streams[0].duration) * 1000);
}
```

**Loudness normalisation**: Applied to every segment after generation (EBU R128, −14 LUFS) to prevent volume jumps between segments:

```bash
ffmpeg -i raw.mp3 -af "loudnorm=I=-14:TP=-2:LRA=11" normalized.mp3
```

**TTS engine options** (switched via `.env`):

| Engine | Quality | Cost | Use case |
|--------|---------|------|----------|
| ElevenLabs `eleven_multilingual_v2` | ★★★★★ | from $5/mo | production |
| OpenAI TTS `tts-1-hd` | ★★★★☆ | $15/1M chars | fallback |
| Edge TTS `en-US-JennyNeural` | ★★★☆☆ | free | development / testing |

**Output**: `cache/tts/2026-05-19/*.mp3` + `cache/tts-manifest-2026-05-19.json`

---

### Skill 4: `collect-assets`

**Responsibility**: Collect images for each story — preferring original article images with Pexels as fallback.

**Input**: `cache/script-{date}.json` (story URLs and title keywords) + `cache/news-{date}.json` (existing `imageUrl`)

**Collection priority**:

```
1. imageUrl already in news-{date}.json (og:image from source article)
2. First large image (width > 600px) scraped from the article page
3. Pexels API search using keywords from the story title
4. Fallback: generate a solid-colour placeholder (no error thrown, but marked
   source: "fallback" in the manifest as a flag for manual replacement)
```

**Output**: `cache/assets/2026-05-19/*.jpg` + `cache/assets-2026-05-19.json`

---

### Skill 5: `render`

**Responsibility**: Assemble all JSON cache files into `VideoInputProps` and call Remotion to render the output MP4.

**Input**: automatically reads `cache/script-{date}.json` + `cache/tts-manifest-{date}.json` + `cache/assets-{date}.json`

**Pre-render validation**:

```typescript
function validateRenderInputs(props: VideoInputProps): void {
  // Confirm all audio files exist on disk
  // Confirm all image files exist on disk
  // Confirm totalFrames > 0
  // On any missing file, exit with an error naming which Skill to re-run
}
```

**Calling Remotion**:

```typescript
import { renderMedia, selectComposition } from '@remotion/renderer';

await renderMedia({
  composition: await selectComposition({ serveUrl, id: 'NewsVideo', inputProps }),
  serveUrl,
  codec: 'h264',
  outputLocation: `output/${date}.mp4`,
  inputProps,
  concurrency: 4,
});
```

**Output**: `output/{date}.mp4`

---

### Skill 6: `publish`

**Responsibility**: Upload the finished video to distribution platforms.

**Input parameters**:

```typescript
interface PublishOptions {
  date: string;
  platforms: ('youtube' | 'bilibili' | 'wechat')[];
  scheduledAt?: string; // ISO 8601 — supports scheduled publishing
  dryRun?: boolean;     // print the planned actions without actually uploading
}
```

**Safety requirement**: This Skill requires explicit human confirmation before executing. When AI-orchestrated, the caller must display the upload parameters to the user and wait for approval before invoking this Skill.

---

## 6. Remotion Component Design

### 6.1 Props Types (the contract between the pipeline and components)

```typescript
// remotion/types.ts

export interface VideoInputProps {
  date: string;
  fps: 30;
  width: 1920;
  height: 1080;

  script: VideoScript;         // from script-{date}.json
  ttsManifest: TtsManifest;    // from tts-manifest-{date}.json
  assets: AssetsManifest;      // from assets-{date}.json
  timeline: TimelineEntry[];   // calculated by the render Skill
  totalFrames: number;
}

export interface TimelineEntry {
  id: string;                  // 'intro' | 'segment-1' … 'segment-5' | 'outro'
  from: number;                // start frame
  durationInFrames: number;    // driven by ttsManifest.durationFrames
  progressLabel: string;       // text shown in the progress bar
}
```

### 6.2 Main Composition

```tsx
// remotion/NewsVideo.tsx
export const NewsVideo: React.FC<VideoInputProps> = ({ script, ttsManifest, assets, timeline, totalFrames }) => {
  return (
    <>
      <AbsoluteFill style={{ background: '#0a0a0f' }} />

      {/* Fixed 150-frame (5s) intro */}
      <Sequence from={0} durationInFrames={150}>
        <Intro date={script.date} />
      </Sequence>

      {/* Overview */}
      <Sequence from={timeline[0].from} durationInFrames={timeline[0].durationInFrames}>
        <Audio src={ttsManifest.segments[0].audioFile} />
        <Overview intro={script.intro} />
        <Captions segment={ttsManifest.segments[0]} />
      </Sequence>

      {/* Stories with fade transitions between them */}
      <TransitionSeries>
        {script.segments.map((seg, i) => {
          const t = timeline[i + 1];
          const tts = ttsManifest.segments[i + 1];
          const segAssets = assets.segments[i];
          return (
            <React.Fragment key={seg.newsId}>
              <TransitionSeries.Sequence durationInFrames={t.durationInFrames}>
                <Audio src={tts.audioFile} />
                <NewsSegmentScene segment={seg} assets={segAssets} tts={tts} />
                <Captions segment={tts} />
              </TransitionSeries.Sequence>
              {i < script.segments.length - 1 && (
                <TransitionSeries.Transition
                  timing={linearTiming({ durationInFrames: 15 })}
                  presentation={fade()}
                />
              )}
            </React.Fragment>
          );
        })}
      </TransitionSeries>

      {/* Progress bar — overlaid for the full duration */}
      <ProgressBar timeline={timeline} totalFrames={totalFrames} />

      {/* Outro */}
      <Sequence from={totalFrames - 180} durationInFrames={180}>
        <Outro />
      </Sequence>
    </>
  );
};
```

### 6.3 NewsSegmentScene

```tsx
// remotion/components/NewsSegmentScene.tsx
export const NewsSegmentScene: React.FC<SegmentSceneProps> = ({ segment, assets, tts }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Cycle through images every 150 frames
  const imageIndex = Math.floor(frame / 150) % assets.images.length;

  // Ken Burns: subtle zoom for visual interest
  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.06]);

  // Title entrance animation
  const titleY = interpolate(frame, [0, 20], [20, 0], { extrapolateLeft: 'clamp' });
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: 'clamp' });

  return (
    <AbsoluteFill>
      <Img
        src={assets.images[imageIndex].file}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})` }}
      />
      {/* Gradient overlay for text legibility */}
      <AbsoluteFill style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.75) 100%)' }} />

      {/* Story title */}
      <div style={{ position: 'absolute', bottom: 130, left: 60, right: 60,
                    opacity: titleOpacity, transform: `translateY(${titleY}px)` }}>
        <div style={{ fontSize: 14, color: '#60a5fa', marginBottom: 8, letterSpacing: 2 }}>
          {segment.category.toUpperCase()}
        </div>
        <h2 style={{ color: '#fff', fontSize: 40, lineHeight: 1.35, margin: 0,
                     textShadow: '0 2px 12px rgba(0,0,0,0.9)' }}>
          {segment.progressLabel}
        </h2>
      </div>
    </AbsoluteFill>
  );
};
```

---

## 7. Key Technique: Audio-Video Sync

### Core Formula

```
durationInFrames = Math.ceil(durationMs / (1000 / fps)) + 2  // +2 frames safety buffer
```

### Timeline Construction (executed in the render Skill, result written into VideoInputProps)

```typescript
function buildTimeline(ttsManifest: TtsManifest): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  let cursor = 150; // fixed 5s intro

  for (const seg of ttsManifest.segments) {
    entries.push({
      id: seg.id,
      from: cursor,
      durationInFrames: seg.durationFrames,
      progressLabel: seg.progressLabel ?? (seg.id === 'intro' ? 'Intro' : 'Outro'),
    });
    cursor += seg.durationFrames;
    if (seg.id !== 'outro') cursor += 15; // 0.5s transition gap between segments
  }

  return entries;
}
```

### Troubleshooting Common Sync Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Audio consistently early/late | incorrect `startFrom` | check `<Audio startFrom={0} />`; default is 0 |
| Audio drifts over time | inconsistent sample rates | run all TTS output through FFmpeg to normalise to `44100 Hz stereo` |
| Audio cuts off mid-segment | `durationInFrames` calculated too low | always use `Math.ceil` and add the 2-frame buffer |
| Lambda render audio/video out of sync | concurrent frame sampling variance | use `<Html5Audio>` instead of `<Audio>` in the Lambda environment |

---

## 8. Key Technique: Progress Bar and Chapters

Remotion has no built-in progress bar component — this is a custom implementation pinned to the bottom of the frame.

```tsx
// remotion/components/ProgressBar.tsx
export const ProgressBar: React.FC<{ timeline: TimelineEntry[]; totalFrames: number }> = ({
  timeline, totalFrames,
}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ top: 'auto', bottom: 0, height: 40 }}>
      <div style={{ display: 'flex', width: '100%', height: '100%', background: 'rgba(0,0,0,0.65)' }}>
        {timeline.map((t) => {
          const segStart = t.from / totalFrames;
          const segWidth = t.durationInFrames / totalFrames;
          const globalProgress = frame / totalFrames;
          const isActive = globalProgress >= segStart && globalProgress < segStart + segWidth;

          // Fraction of this segment already played (0–1)
          const fill = isActive
            ? Math.min(1, (globalProgress - segStart) / segWidth)
            : globalProgress >= segStart + segWidth ? 1 : 0;

          return (
            <div key={t.id} style={{ flex: t.durationInFrames, position: 'relative',
                                      borderRight: '1px solid rgba(255,255,255,0.15)' }}>
              {/* Playback fill */}
              <div style={{
                position: 'absolute', inset: 0, right: `${(1 - fill) * 100}%`,
                background: isActive ? '#3b82f6' : 'rgba(255,255,255,0.25)',
              }} />
              {/* Chapter label */}
              <div style={{
                position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                fontSize: 11, color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                whiteSpace: 'nowrap', overflow: 'hidden', zIndex: 1,
                maxWidth: 'calc(100% - 12px)',
              }}>
                {t.progressLabel}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
```

---

## 9. Reference Projects and Ecosystem

### Key References

| Project | What to borrow |
|---------|----------------|
| [video-podcast-maker](https://github.com/Agents365-ai/video-podcast-maker) | Production-grade multi-TTS architecture, Bilibili/YouTube upload |
| [podcast-maker](https://github.com/FelippeChemello/podcast-maker) | Fully automated Newsletter → video pipeline |
| [template-prompt-to-video](https://github.com/remotion-dev/template-prompt-to-video) | Official AI + ElevenLabs video starter template |

### Core Remotion Packages

```
@remotion/core          — useCurrentFrame / interpolate / Sequence / AbsoluteFill
@remotion/transitions   — scene transitions (fade / slide / wipe, etc.)
@remotion/captions      — word-level captions + Whisper alignment
@remotion/renderer      — Node.js render API (used by the render Skill)
```

### News Source Quality Assessment

| Source | Update frequency | Quality | Notes |
|--------|-----------------|---------|-------|
| HackerNews (100+ pts) | real-time | ★★★★★ | Community-filtered; low noise |
| Hugging Face Blog | several times/week | ★★★★★ | Authoritative source for model releases |
| OpenAI / Anthropic Blog | occasional | ★★★★★ | First-hand official announcements |
| arXiv cs.AI | daily | ★★★★☆ | Paper quality varies; AI filtering required |
| Product Hunt | daily | ★★★☆☆ | Product launches; needs keyword filtering |

---

## 10. Environment Setup

### `.env`

```env
# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# TTS (set which engine to use)
TTS_ENGINE=elevenlabs               # elevenlabs | openai | edge-tts
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
OPENAI_API_KEY=sk-...

# Assets
PEXELS_API_KEY=...

# Publishing (configure as needed)
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
YOUTUBE_REFRESH_TOKEN=...

# Paths
CACHE_DIR=./cache
OUTPUT_DIR=./output

# Render settings
FPS=30
VIDEO_WIDTH=1920
VIDEO_HEIGHT=1080
```

### Directory Structure

```
ai-news-video/
├── skills/
│   ├── fetch-news.ts
│   ├── gen-script.ts
│   ├── gen-tts.ts
│   ├── collect-assets.ts
│   ├── render.ts
│   └── publish.ts
├── remotion/
│   ├── Root.tsx
│   ├── NewsVideo.tsx
│   ├── components/
│   │   ├── Intro.tsx
│   │   ├── Overview.tsx
│   │   ├── NewsSegmentScene.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── Captions.tsx
│   │   └── Outro.tsx
│   └── types.ts
├── lib/
│   ├── claude.ts              # Claude API wrapper
│   ├── tts.ts                 # unified TTS engine interface
│   ├── timeline.ts            # buildTimeline function
│   └── ffmpeg.ts              # FFmpeg utilities
├── cache/                     # runtime cache (.gitignore)
├── output/                    # rendered output (.gitignore)
├── assets/
│   ├── fonts/
│   └── music/                 # background music tracks
├── .env
├── remotion.config.ts
└── package.json
```

### Core `package.json` Dependencies

```json
{
  "dependencies": {
    "remotion": "^4.0.0",
    "@remotion/renderer": "^4.0.0",
    "@remotion/transitions": "^4.0.0",
    "@remotion/captions": "^4.0.0",
    "@anthropic-ai/sdk": "^0.x",
    "elevenlabs": "^1.x",
    "rss-parser": "^3.x",
    "axios": "^1.x",
    "fluent-ffmpeg": "^2.x",
    "commander": "^12.x"
  },
  "scripts": {
    "studio": "remotion studio",
    "fetch-news": "tsx skills/fetch-news.ts",
    "gen-script": "tsx skills/gen-script.ts",
    "gen-tts": "tsx skills/gen-tts.ts",
    "collect-assets": "tsx skills/collect-assets.ts",
    "render": "tsx skills/render.ts",
    "publish": "tsx skills/publish.ts"
  }
}
```

---

## 11. Development Phases

### Phase 1: Remotion Visual Skeleton (3–4 days)

**Goal**: Render a complete video from static JSON — validate all visual components before touching any live APIs.

- [ ] Scaffold the Remotion project and define `VideoInputProps` types
- [ ] Implement `ProgressBar` component (test with static timeline)
- [ ] Implement `NewsSegmentScene` (static images + Ken Burns effect)
- [ ] Implement `Overview` (intro overview animation)
- [ ] Implement `Captions` (static caption text)
- [ ] Render a full video from hardcoded Props and verify the visual output

**Milestone**: Full video structure renders correctly; progress bar displays as expected; scene transitions are smooth.

### Phase 2: TTS and Audio-Video Sync (2–3 days)

**Goal**: Render with real TTS audio and verify frame-accurate sync.

- [ ] Implement the `gen-tts` Skill (single-segment TTS + ffprobe duration)
- [ ] Implement `buildTimeline`
- [ ] Verify `<Sequence>` frame counts align exactly with TTS durations
- [ ] Test 5 consecutive audio segments — confirm no noise at transitions
- [ ] Integrate `@remotion/captions` (Whisper-aligned word-level captions)

**Milestone**: Audio-video sync without drift; captions align word-by-word with speech.

### Phase 3: Content Skills (3–4 days)

**Goal**: Run the complete workflow from real news data.

- [ ] Implement `fetch-news` Skill (HackerNews API + arXiv RSS)
- [ ] Implement `gen-script` Skill (Claude script generation)
- [ ] Implement `collect-assets` Skill (og:image + Pexels fallback)
- [ ] Run the full chain: fetch → script → TTS → render
- [ ] Verify that each JSON cache file can be manually edited and the video re-rendered from the edited file

**Milestone**: Manually trigger each Skill in sequence and produce a complete episode from real news.

### Phase 4: Polish and Publishing (2–3 days)

- [ ] Refine intro and outro animations
- [ ] Background music mixing (FFmpeg)
- [ ] Implement `publish` Skill (YouTube upload)
- [ ] Improve error handling — clear messages that name the exact Skill to re-run
