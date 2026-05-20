/**
 * publish: upload the rendered video to one or more platforms.
 *
 * Per CLAUDE.md §Key Implementation Constraints, this skill MUST NEVER upload
 * anything without explicit human confirmation. The default mode therefore
 * prints a plan of what would be uploaded and exits — the actual upload only
 * runs when the operator adds `--confirm`.
 *
 * Platform uploaders are stubbed today (Issue 7). The structure is in place
 * so each platform can be wired up one at a time: install the platform SDK,
 * fill in the corresponding function below, set the platform-specific
 * environment variables (e.g. YOUTUBE_REFRESH_TOKEN, BILIBILI_COOKIE).
 */

import path from "path";
import fs from "fs";

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag: string) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
};
const date    = getArg("--date") ?? new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const confirm = args.includes("--confirm");
const dryRun  = args.includes("--dry-run") || !confirm;
const platformsArg = getArg("--platforms") ?? "youtube";
const platforms = platformsArg.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

const SUPPORTED_PLATFORMS = new Set(["youtube", "bilibili", "wechat"]);

interface VideoScript {
  date: string;
  intro: { overview: { newsId: string; oneLiner: string }[] };
  segments: { newsId: string; progressLabel: string; sourceUrl?: string }[];
}

// ── Plan builder ──────────────────────────────────────────────────────────────

interface UploadPlan {
  date: string;
  videoFile: string;
  videoSizeBytes: number;
  title: string;
  description: string;
  tags: string[];
  platforms: string[];
}

function buildPlan(): UploadPlan {
  const videoFile = path.resolve(`output/${date}.mp4`);
  if (!fs.existsSync(videoFile)) {
    fail(`Rendered video missing: ${videoFile}\n    Run: npm run render -- --date ${date}`);
  }
  const scriptPath = path.resolve(`cache/script-${date}.json`);
  if (!fs.existsSync(scriptPath)) {
    fail(`Script cache missing: ${scriptPath}\n    Run: npm run gen-script -- --date ${date}`);
  }

  const script: VideoScript = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
  const stat = fs.statSync(videoFile);

  const title = `AI日报 ${date} — ${script.segments.map((s) => s.progressLabel).slice(0, 3).join(" / ")}`;
  const descriptionLines = [
    `今日 AI 资讯 — ${date}`,
    "",
    "本期内容：",
    ...script.intro.overview.map((o, i) => `${i + 1}. ${o.oneLiner}`),
    "",
    "原文链接：",
    ...script.segments.map((s, i) => `${i + 1}. ${s.sourceUrl ?? "(none)"}`),
  ];
  const description = descriptionLines.join("\n");

  return {
    date,
    videoFile,
    videoSizeBytes: stat.size,
    title,
    description,
    tags: ["AI", "人工智能", "AI日报", "科技新闻"],
    platforms,
  };
}

// ── Platform uploaders (stubs) ───────────────────────────────────────────────

async function uploadYouTube(_plan: UploadPlan): Promise<{ url: string }> {
  throw new Error(
    "YouTube uploader not yet implemented.\n" +
    "    Install `googleapis`, set YOUTUBE_REFRESH_TOKEN / YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET,\n" +
    "    and fill in the body of uploadYouTube() in skills/publish.ts.",
  );
}

async function uploadBilibili(_plan: UploadPlan): Promise<{ url: string }> {
  throw new Error(
    "Bilibili uploader not yet implemented.\n" +
    "    Bilibili has no official upload SDK; community SDKs require an SESSDATA cookie.\n" +
    "    Set BILIBILI_SESSDATA and fill in uploadBilibili() in skills/publish.ts.",
  );
}

async function uploadWechat(_plan: UploadPlan): Promise<{ url: string }> {
  throw new Error(
    "WeChat Channels uploader not yet implemented.\n" +
    "    Requires a WeChat MP (公众号) account with video upload permission.\n" +
    "    Set WECHAT_ACCESS_TOKEN and fill in uploadWechat() in skills/publish.ts.",
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const unknown = platforms.filter((p) => !SUPPORTED_PLATFORMS.has(p));
  if (unknown.length > 0) {
    fail(`Unknown platform(s): ${unknown.join(", ")}\n    Supported: ${[...SUPPORTED_PLATFORMS].join(", ")}`);
  }

  const plan = buildPlan();
  printPlan(plan, dryRun);

  if (dryRun) {
    console.log("\nDry-run mode. Re-run with `--confirm` to actually upload.");
    process.exit(0);
  }

  console.log("\n🚀 Uploading…");
  const results: { platform: string; ok: boolean; url?: string; error?: string }[] = [];
  for (const p of platforms) {
    try {
      let res: { url: string };
      if (p === "youtube") res = await uploadYouTube(plan);
      else if (p === "bilibili") res = await uploadBilibili(plan);
      else if (p === "wechat") res = await uploadWechat(plan);
      else throw new Error(`unreachable: ${p}`);
      results.push({ platform: p, ok: true, url: res.url });
      console.log(`   ✓ ${p}: ${res.url}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ platform: p, ok: false, error: msg });
      console.log(`   ✗ ${p}: ${msg.split("\n")[0]}`);
    }
  }
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`\n${failed.length} upload(s) failed.`);
    process.exit(1);
  }
}

function printPlan(plan: UploadPlan, isDryRun: boolean): void {
  console.log(`\n[publish] ${isDryRun ? "DRY-RUN" : "LIVE"}  date=${plan.date}`);
  console.log(`   file:        ${plan.videoFile}  (${(plan.videoSizeBytes / 1_048_576).toFixed(1)} MiB)`);
  console.log(`   title:       ${plan.title}`);
  console.log(`   platforms:   ${plan.platforms.join(", ")}`);
  console.log(`   tags:        ${plan.tags.join(", ")}`);
  console.log(`   description:`);
  for (const line of plan.description.split("\n")) console.log(`     ${line}`);
}

function fail(msg: string): never {
  console.error(`❌  ${msg}`);
  process.exit(1);
}

main().catch((e) => {
  console.error("publish failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
