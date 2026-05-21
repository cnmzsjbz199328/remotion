/**
 * collect-assets: Scan cache/assets/{date}/ for manually placed images.
 *
 * Convention:
 *   - Single image:  NN.ext           (e.g. 01.jpg, 02.png)
 *   - Multi-image:   NN-MM.ext        (e.g. 01-01.jpg, 01-02.jpg, 01-03.png)
 *   NN = story index (1-based), MM = image order within the story.
 *   Multi-image stories play as a crossfade carousel in NewsSegmentScene.
 * Supported extensions: jpg, jpeg, png, webp, gif.
 *
 * Also prints each story's source URL so you know where to fetch images from.
 */

import fs from "fs";
import path from "path";

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag: string) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
};
const date = getArg("--date") ?? new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const force = args.includes("--force");

// ─── Paths ───────────────────────────────────────────────────────────────────
const scriptPath  = path.resolve(`cache/script-${date}.json`);
const manifestPath = path.resolve(`cache/assets-${date}.json`);
const imageDir    = path.resolve(`cache/assets/${date}`);

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

interface ScriptSegment {
  newsId: string;
  progressLabel: string;
  sourceUrl?: string;
}

interface VideoScript {
  date: string;
  segments: ScriptSegment[];
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function main(): void {
  console.log(`[collect-assets] date=${date}`);

  if (!fs.existsSync(scriptPath)) {
    console.error(`✗ Script not found: ${scriptPath}`);
    console.error(`  Run first: npm run gen-script -- --date ${date}`);
    process.exit(1);
  }

  if (fs.existsSync(manifestPath) && !force) {
    console.log(`✓ Manifest already exists (use --force to rescan): ${manifestPath}`);
    process.exit(0);
  }

  const script: VideoScript = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));

  // Print source URLs for manual image collection
  console.log("\nSource URLs — visit to pick images:\n");
  script.segments.forEach((seg, i) => {
    const idx = String(i + 1).padStart(2, "0");
    const url = seg.sourceUrl ?? "(no URL)";
    console.log(`  [${idx}] ${seg.progressLabel}`);
    console.log(`       ${url}`);
    console.log(`       → single image: cache/assets/${date}/${idx}.jpg`);
    console.log(`       → multi-image:  cache/assets/${date}/${idx}-01.jpg, ${idx}-02.jpg, …\n`);
  });

  // Scan image directory for numbered files
  fs.mkdirSync(imageDir, { recursive: true });
  const found = fs.existsSync(imageDir)
    ? fs.readdirSync(imageDir).filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
    : [];

  // Group files by story index. `NN.ext` is the lone image; `NN-MM.ext` is one
  // of several in a carousel — sort by MM. If both shapes are present for the
  // same story, the multi-image group wins (the lone NN.ext is ignored).
  const single = new Map<number, string>();
  const multi  = new Map<number, { order: number; path: string }[]>();
  for (const file of found) {
    const base = path.basename(file, path.extname(file));
    const full = path.join(imageDir, file).replace(/\\/g, "/");
    const m = /^(\d+)(?:-(\d+))?$/.exec(base);
    if (!m) continue;
    const story = parseInt(m[1], 10);
    if (!story || story < 1) continue;
    if (m[2] !== undefined) {
      const order = parseInt(m[2], 10);
      const list = multi.get(story) ?? [];
      list.push({ order, path: full });
      multi.set(story, list);
    } else {
      single.set(story, full);
    }
  }
  for (const list of multi.values()) list.sort((a, b) => a.order - b.order);

  // Build manifest — one entry per story segment
  const segments = script.segments.map((seg, i) => {
    const idx = i + 1;
    const group = multi.get(idx);
    const lone  = single.get(idx);
    const paths = group ? group.map((g) => g.path) : (lone ? [lone] : []);
    return {
      newsId: seg.newsId,
      images: paths.map((file) => ({ file, source: "manual" as const, credit: null })),
    };
  });

  const covered = segments.filter((s) => s.images.length > 0).length;
  const total   = segments.length;

  const manifest = { date, segments };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`✅ Manifest written: ${manifestPath}`);
  console.log(`   Stories with images : ${covered} / ${total}`);
  if (covered < total) {
    const missing = segments
      .map((s, i) => (s.images.length === 0 ? String(i + 1).padStart(2, "0") : null))
      .filter(Boolean);
    console.log(`   Missing             : ${missing.join(", ")} — will use plain colour background`);
  }
}

main();
