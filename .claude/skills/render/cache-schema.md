# Cache File Schemas

Reference for all four JSON files produced by the pipeline skills. All files are human-readable and human-editable.

## Contents

- [news-insights-{date}.json](#news-insights-datejson)
- [script-{date}.json](#script-datejson)
- [tts-manifest-{date}.json](#tts-manifest-datejson)
- [assets-{date}.json](#assets-datejson)

---

## news-insights-{date}.json

Output of the `/fetch-ai-insights` skill. The AI assistant invoking the skill
runs WebSearch across four tiers (frontier labs / Chinese platforms /
infrastructure / catch-all), cross-references each candidate against ≥2
authoritative sources, and writes 3–5 high-impact insights.

```typescript
{
  date: string;                  // "2026-05-20"
  fetchedAt: string;             // ISO 8601
  method: "ai-search-synthesis";
  insights: {
    id: string;                  // kebab-case, e.g. "insight-google-io-2026"
    topic: string;               // Chinese headline (≤30 字)
    significance: string;        // 1-2 Chinese sentences — the deep "why"
    impactScore: number;         // 1-10 (see fetch-ai-insights SKILL.md rubric)
    sourceUrls: string[];        // ≥2 authoritative URLs
    category: "model-release" | "industry-shift" | "research-breakthrough" | "policy";
    summary: string;             // 100–200 汉字 factual body — feeds gen-script directly
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
