import { staticFile } from "remotion";
import { buildTimeline, computeTotalFrames } from "../lib/timeline";
import type { VideoInputProps, TtsManifest, AssetsManifest } from "./types";

// Studio fixture — loads the most recent real cache so Studio shows the actual
// video being produced, not synthetic placeholder data. The cache JSONs store
// absolute Windows paths from the deterministic skills (gen-tts, collect-assets);
// Studio cannot serve `C:/…` directly, so we rewrite each path to staticFile()
// form. `public/cache` is a junction → `./cache`, so cache/foo.png resolves.
import scriptRaw from "../cache/script-2026-05-20.json";
import ttsRaw    from "../cache/tts-manifest-2026-05-20.json";
import assetsRaw from "../cache/assets-2026-05-20.json";

const FPS = 30;
// Strip everything up to and including the first "cache/" segment (handles both
// absolute Windows paths from skills/render.ts and relative "cache/…" paths from
// gen-tts), then re-prefix with "cache/" so staticFile() resolves through the
// public/cache junction.
const toStatic = (absPath: string): string => {
  if (!absPath) return absPath;
  const tail = absPath.replace(/\\/g, "/").replace(/^.*?cache\//, "");
  return staticFile(`cache/${tail}`);
};

const ttsManifest: TtsManifest = {
  ...ttsRaw,
  segments: ttsRaw.segments.map((s) => ({
    ...s,
    audioFile: toStatic(s.audioFile),
  })),
};

const assets: AssetsManifest = {
  ...assetsRaw,
  segments: assetsRaw.segments.map((seg) => ({
    ...seg,
    images: seg.images.map((img) => ({
      ...img,
      file: toStatic(img.file),
    })),
  })),
};

const timeline = buildTimeline(ttsManifest);
const totalFrames = computeTotalFrames(timeline);
ttsManifest.totalFrames = totalFrames;

export const staticProps: VideoInputProps = {
  date: scriptRaw.date,
  fps: FPS,
  width: 1920,
  height: 1080,
  script: scriptRaw,
  ttsManifest,
  assets,
  timeline,
  totalFrames,
};
