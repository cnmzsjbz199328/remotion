import type { TtsManifest, TimelineEntry } from "../remotion/types";

const TRANSITION_FRAMES = 15;
const INTRO_ANIM_FRAMES = 150; // 5s fixed intro animation

export function buildTimeline(manifest: TtsManifest): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  let cursor = INTRO_ANIM_FRAMES;

  for (const seg of manifest.segments) {
    entries.push({
      id: seg.id,
      from: cursor,
      durationInFrames: seg.durationFrames,
      progressLabel:
        seg.progressLabel ??
        (seg.id === "intro" ? "Intro" : "Outro"),
    });
    cursor += seg.durationFrames;
    if (seg.id !== "outro") cursor += TRANSITION_FRAMES;
  }

  return entries;
}

export function computeTotalFrames(timeline: TimelineEntry[]): number {
  const last = timeline[timeline.length - 1];
  return last.from + last.durationInFrames + 180; // +180 for outro fade
}
