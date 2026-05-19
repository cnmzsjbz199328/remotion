export interface VideoInputProps {
  date: string;
  fps: number;
  width: number;
  height: number;
  script: VideoScript;
  ttsManifest: TtsManifest;
  assets: AssetsManifest;
  timeline: TimelineEntry[];
  totalFrames: number;
}

export interface TimelineEntry {
  id: string;
  from: number;
  durationInFrames: number;
  progressLabel: string;
}

// ── Script ────────────────────────────────────────────────────────────────────

export interface VideoScript {
  date: string;
  intro: IntroScript;
  segments: NewsSegment[];
  outro: OutroScript;
}

export interface IntroScript {
  narration: string;
  estimatedDurationS: number;
  overview: OverviewItem[];
}

export interface OverviewItem {
  newsId: string;
  oneLiner: string;
}

export interface NewsSegment {
  newsId: string;
  progressLabel: string;
  narration: string;
  estimatedDurationS: number;
  keyPoints: string[];
  transitionLine: string;
  category?: string;
  sourceUrl?: string;
}

export interface OutroScript {
  narration: string;
  estimatedDurationS: number;
}

// ── TTS manifest ──────────────────────────────────────────────────────────────

export interface TtsManifest {
  date: string;
  engine: string;
  voiceId: string;
  fps: number;
  segments: TtsSegment[];
  totalDurationMs: number;
  totalFrames: number;
}

export interface TtsSegment {
  id: string;
  newsId?: string;
  progressLabel?: string;
  audioFile: string;
  durationMs: number;
  durationFrames: number;
  text: string;
  captions?: Caption[];
}

export interface Caption {
  text: string;
  startMs: number;
  endMs: number;
}

// ── Assets manifest ───────────────────────────────────────────────────────────

export interface AssetsManifest {
  date: string;
  segments: SegmentAssets[];
}

export interface SegmentAssets {
  newsId: string;
  images: AssetImage[];
}

export interface AssetImage {
  file: string;
  source: "generated" | "og-image" | "pexels" | "unsplash" | "fallback";
  credit: string | null;
}
