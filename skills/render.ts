import path from "path";
import fs from "fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { buildTimeline, computeTotalFrames } from "../lib/timeline";
import type { VideoInputProps, TtsManifest, AssetsManifest, VideoScript } from "../remotion/types";

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag: string) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
};

const dateArg = getArg("--date") ??
  new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const useStatic = args.includes("--static");
const force = args.includes("--force");

const outputPath = path.resolve(`output/${dateArg}.mp4`);

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (fs.existsSync(outputPath) && !force) {
    console.log(`Output already exists: ${outputPath}`);
    console.log("Use --force to overwrite.");
    process.exit(0);
  }

  const inputProps: VideoInputProps = useStatic
    ? await loadStaticProps()
    : loadFromCache(dateArg);

  fs.mkdirSync("output", { recursive: true });

  console.log("Bundling Remotion project…");
  const serveUrl = await bundle({
    entryPoint: path.resolve("remotion/index.tsx"),
    webpackOverride: (config) => config,
  });

  const propsForRemotionApi = inputProps as unknown as Record<string, unknown>;

  const composition = await selectComposition({
    serveUrl,
    id: "NewsVideo",
    inputProps: propsForRemotionApi,
  });

  console.log(
    `Rendering ${composition.durationInFrames} frames at ${composition.fps} fps…`
  );

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: outputPath,
    inputProps: propsForRemotionApi,
    imageFormat: "jpeg",
    jpegQuality: 85,
    concurrency: 4,
    onProgress: ({ renderedFrames, progress }) => {
      process.stdout.write(
        `\r  ${renderedFrames} frames (${Math.round(progress * 100)}%)`
      );
    },
  });

  console.log(`\nDone → ${outputPath}`);
}

// ── Data loaders ──────────────────────────────────────────────────────────────

async function loadStaticProps(): Promise<VideoInputProps> {
  console.log("Using static test data…");
  const { staticProps } = await import("../remotion/test-data");
  return staticProps;
}

function loadFromCache(date: string): VideoInputProps {
  const read = <T>(name: string, skill: string): T => {
    const filePath = path.resolve(`cache/${name}-${date}.json`);
    if (!fs.existsSync(filePath)) {
      console.error(`\n❌  Missing: ${filePath}`);
      console.error(`    Run: npm run ${skill} -- --date ${date}`);
      process.exit(1);
    }
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  };

  const script = read<VideoScript>("script", "gen-script");
  const ttsManifest = read<TtsManifest>("tts-manifest", "gen-tts");
  const assets = read<AssetsManifest>("assets", "collect-assets");

  const timeline = buildTimeline(ttsManifest);
  const totalFrames = computeTotalFrames(timeline);

  return {
    date,
    fps: ttsManifest.fps,
    width: 1920,
    height: 1080,
    script,
    ttsManifest,
    assets,
    timeline,
    totalFrames,
  };
}

main().catch((err) => {
  console.error("\nRender failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
