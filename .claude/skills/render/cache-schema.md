# Cache File Schemas

Reference for all four JSON files produced by the pipeline skills. All files are human-readable and human-editable.

## Contents

- [news-{date}.json](#news-datejson)
- [script-{date}.json](#script-datejson)
- [tts-manifest-{date}.json](#tts-manifest-datejson)
- [assets-{date}.json](#assets-datejson)

---

## news-{date}.json

Output of `fetch-news`. Set `"selected": false` to exclude a story from the script.

```typescript
{
  date: string;
  generatedAt: string;       // ISO 8601
  source: string;            // "fetch-news@1.0"
  items: {
    id: string;              // "hn-12345678" | "arxiv-2401.00001" etc.
    rank: number;            // Claude ranking (1 = most important)
    aiScore: number;         // importance score 1–10
    aiScoreReason: string;
    title: string;
    url: string;
    source: string;          // "HackerNews" | "arXiv" | "ProductHunt" | ...
    publishedAt: string;     // ISO 8601
    hnPoints?: number;
    excerpt?: string;
    imageUrl?: string | null; // og:image — edit to supply a better URL
    category: "model-release" | "research" | "product" | "policy";
    selected: boolean;        // ← set false to exclude
  }[];
}
```

---

## script-{date}.json

Output of `gen-script`. Edit `narration` and `progressLabel` freely — these are read by `gen-tts` and Remotion.

```typescript
{
  date: string;
  generatedAt: string;
  source: string;            // "gen-script@1.0"
  intro: {
    narration: string;       // ~75 words, ~30s
    estimatedDurationS: number;
    overview: {
      newsId: string;
      oneLiner: string;      // one-sentence teaser per story
    }[];
  };
  segments: {
    newsId: string;
    progressLabel: string;   // ≤10 words — shown in the progress bar
    narration: string;       // ~225 words, ~90s — TTS input
    estimatedDurationS: number;
    keyPoints: string[];     // 3 bullet points for on-screen cards
    transitionLine: string;  // final sentence bridging to the next story
    category?: string;       // shown as a label on the video frame
    sourceUrl?: string;
  }[];
  outro: {
    narration: string;       // ~30 words, ~10s
    estimatedDurationS: number;
  };
}
```

---

## tts-manifest-{date}.json

Output of `gen-tts`. **Do not edit** — frame counts must exactly match the actual audio durations.

```typescript
{
  date: string;
  generatedAt: string;
  source: string;            // "gen-tts@1.0"
  engine: string;            // "elevenlabs" | "openai" | "edge-tts"
  voiceId: string;
  fps: number;               // always 30
  segments: {
    id: string;              // "intro" | "segment-1".."segment-5" | "outro"
    newsId?: string;
    progressLabel?: string;
    audioFile: string;       // absolute local path to the .mp3 file
    durationMs: number;      // measured by ffprobe
    durationFrames: number;  // ceil(durationMs / (1000/fps)) + 2
    text: string;            // original narration text
    captions?: {             // populated in Phase 2 (Whisper alignment)
      text: string;
      startMs: number;
      endMs: number;
    }[];
  }[];
  totalDurationMs: number;
  totalFrames: number;
}
```

---

## assets-{date}.json

Output of `collect-assets`. Edit `"file"` paths manually to replace any `"fallback"` images.

```typescript
{
  date: string;
  generatedAt: string;
  source: string;            // "collect-assets@1.0"
  segments: {
    newsId: string;
    images: {
      file: string;          // local absolute path — replace to use a custom image
      source: "og-image" | "pexels" | "unsplash" | "fallback";
      credit: string | null; // Pexels attribution if required
    }[];
  }[];
}
```
