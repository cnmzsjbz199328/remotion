import path from "path";
import fs from "fs";
import http from "http";
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

const COMPOSITION_ID = "NewsVideo";
const outputPath = path.resolve(`output/${dateArg}.mp4`);

// ── Static file server ────────────────────────────────────────────────────────
// Remotion's webpack server only serves its own bundle dir. We run a tiny
// local HTTP server so audio files in cache/ are reachable via http://.

function startStaticServer(root: string): Promise<{ baseUrl: string; close: () => void }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url ?? "/").replace(/^\//, "");
      const filePath = path.join(root, rel);
      try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) { res.writeHead(404); res.end(); return; }
        res.writeHead(200);
        fs.createReadStream(filePath).pipe(res);
      } catch {
        res.writeHead(404);
        res.end();
      }
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve({ baseUrl: `http://127.0.0.1:${addr.port}`, close: () => server.close() });
    });
    server.on("error", reject);
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (fs.existsSync(outputPath) && !force) {
    console.log(`Output already exists: ${outputPath}`);
    console.log("Use --force to overwrite.");
    process.exit(0);
  }

  const projectRoot = path.resolve(".");
  const { baseUrl, close: closeServer } = await startStaticServer(projectRoot);

  try {
    const inputProps: VideoInputProps = useStatic
      ? await loadStaticProps()
      : loadFromCache(dateArg, baseUrl);

    fs.mkdirSync("output", { recursive: true });

    console.log("Bundling Remotion project…");
    const serveUrl = await bundle({
      entryPoint: path.resolve("remotion/index.tsx"),
      webpackOverride: (config) => config,
      publicDir: path.resolve("public"),
    });

    const propsForRemotionApi = inputProps as unknown as Record<string, unknown>;

    const composition = await selectComposition({
      serveUrl,
      id: COMPOSITION_ID,
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
      jpegQuality: 95,
      concurrency: 4,
      onProgress: ({ renderedFrames, progress }) => {
        process.stdout.write(
          `\r  ${renderedFrames} frames (${Math.round(progress * 100)}%)`
        );
      },
    });

    console.log(`\nDone → ${outputPath}`);
  } finally {
    closeServer();
  }
}

// ── Data loaders ──────────────────────────────────────────────────────────────

async function loadStaticProps(): Promise<VideoInputProps> {
  console.log("Using static test data…");
  const { staticProps } = await import("../remotion/test-data");
  return staticProps;
}

function loadFromCache(date: string, assetBaseUrl: string): VideoInputProps {
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

  // Rewrite local file paths to http:// URLs served by our local static server.
  // Remotion's Chromium refuses file:/// URLs ("Not allowed to load local resource").
  const projectRootFwd = path.resolve(".").replace(/\\/g, "/");
  const toHttp = (p: string): string => {
    if (!p || p.startsWith("http")) return p;
    let s = p.replace(/\\/g, "/");
    if (s.toLowerCase().startsWith(projectRootFwd.toLowerCase())) {
      s = s.slice(projectRootFwd.length);
    }
    s = s.replace(/^\//, "");
    return `${assetBaseUrl}/${s}`;
  };

  for (const seg of ttsManifest.segments) {
    if (seg.audioFile) seg.audioFile = toHttp(seg.audioFile);
  }
  for (const seg of assets.segments) {
    for (const img of seg.images ?? []) {
      if (img?.file) img.file = toHttp(img.file);
    }
  }

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
