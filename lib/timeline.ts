import type { TtsManifest, TimelineEntry } from "../remotion/types";

const INTRO_ANIM_FRAMES = 150; // 5s fixed intro animation
export const SEGMENT_GAP_FRAMES = 60; // 2s transition gap between every segment

export function buildTimeline(manifest: TtsManifest): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  let cursor = INTRO_ANIM_FRAMES;

  for (let i = 0; i < manifest.segments.length; i++) {
    const seg = manifest.segments[i];
    entries.push({
      id: seg.id,
      from: cursor,
      durationInFrames: seg.durationFrames,
      progressLabel:
        seg.progressLabel ??
        (seg.id === "intro" ? "Intro" : "Outro"),
    });
    cursor += seg.durationFrames;
    if (i < manifest.segments.length - 1) {
      cursor += SEGMENT_GAP_FRAMES;
    }
  }

  return entries;
}

export function computeTotalFrames(timeline: TimelineEntry[]): number {
  const last = timeline[timeline.length - 1];
  return last.from + last.durationInFrames + 180; // +180 for outro fade
}
