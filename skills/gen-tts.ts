import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag: string) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
};
const date = getArg("--date") ?? new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const force = args.includes("--force");
const voice = getArg("--voice") ?? process.env.QWEN_TTS_VOICE ?? "Serena / 苏瑶";
const fps = 30;
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 180_000;
// The public Qwen3 Gradio endpoint is flaky under parallel requests (Issue 4).
// Sequential calls are slower but far more reliable. Override with
// QWEN_TTS_CONCURRENCY env var when using a self-hosted / paid endpoint.
const CONCURRENCY = Number(process.env.QWEN_TTS_CONCURRENCY ?? 1);

// ─── Qwen3-TTS Gradio API ────────────────────────────────────────────────────
const GRADIO_BASE = (process.env.QWEN_TTS_URL ?? "https://qwen-qwen3-tts-demo.ms.show").replace(/\/$/, "");
const GRADIO_API  = `${GRADIO_BASE}/gradio_api`;
const GRADIO_FN   = 1; // tts_interface dependency id
const LANGUAGE    = "Auto / 自动";

// ─── Paths ───────────────────────────────────────────────────────────────────
const scriptPath = path.join("cache", `script-${date}.json`);
const manifestPath = path.join("cache", `tts-manifest-${date}.json`);
const audioDir = path.join("cache", "tts", date);

// ─── Minimal local types ──────────────────────────────────────────────────────
interface ScriptSegment {
  newsId: string;
  progressLabel: string;
  narration: string;
}

interface VideoScript {
  date: string;
  intro: { narration: string; estimatedDurationS: number };
  segments: ScriptSegment[];
  outro: { narration: string; estimatedDurationS: number };
}

interface SegmentJob {
  id: string;
  newsId?: string;
  progressLabel: string;
  text: string;
}

// ─── Qwen3-TTS API call (Gradio SSE queue) ───────────────────────────────────
function randomHash(len = 10): string {
  return Math.random().toString(36).slice(2, 2 + len);
}

interface GradioFileData {
  path?: string;
  url?: string | null;
}

async function callTTS(text: string): Promise<Buffer> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const sessionHash = randomHash();

      // 1. Join queue
      const joinRes = await fetch(`${GRADIO_API}/queue/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [text, voice, LANGUAGE],
          event_data: null,
          fn_index: GRADIO_FN,
          trigger_id: 7,
          session_hash: sessionHash,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!joinRes.ok) {
        throw new Error(`queue/join HTTP ${joinRes.status}: ${await joinRes.text()}`);
      }

      // 2. Stream SSE until process_completed
      const sseRes = await fetch(`${GRADIO_API}/queue/data?session_hash=${sessionHash}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!sseRes.ok || !sseRes.body) throw new Error(`SSE failed: ${sseRes.status}`);

      const reader = sseRes.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let fileData: GradioFileData | null = null;

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const dataLine = part.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          const evt = JSON.parse(dataLine.slice(5).trim()) as {
            msg: string;
            output?: { data: GradioFileData[] };
            success?: boolean;
          };
          if (evt.msg === "process_completed") {
            if (!evt.success || !evt.output?.data?.[0]) {
              throw new Error(`TTS failed: ${JSON.stringify(evt)}`);
            }
            fileData = evt.output.data[0];
            break outer;
          }
        }
      }

      if (!fileData) throw new Error("SSE stream ended without completion");

      // 3. Download the audio file
      const audioUrl = fileData.url
        ?? (fileData.path ? `${GRADIO_BASE}/gradio_api/file=${fileData.path}` : null);
      if (!audioUrl) throw new Error("No audio URL in TTS response");

      const dlRes = await fetch(audioUrl, { signal: AbortSignal.timeout(30_000) });
      if (!dlRes.ok) throw new Error(`Audio download HTTP ${dlRes.status}`);
      return Buffer.from(await dlRes.arrayBuffer());

    } catch (err: any) {
      if (attempt === MAX_RETRIES) throw err;
      const wait = attempt * 5000;
      const reason = err.name === "AbortError" ? "timeout" : err.message;
      console.log(`  ⚠ Attempt ${attempt}/${MAX_RETRIES} failed (${reason}), retrying in ${wait / 1000}s…`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error("unreachable");
}

// ─── Audio processing ─────────────────────────────────────────────────────────
function normalizeAudio(rawPath: string, outPath: string): void {
  // Normalize to EBU R128 -14 LUFS, resample to 44100 Hz stereo (CLAUDE.md constraint)
  const result = spawnSync(
    "ffmpeg",
    [
      "-y", "-i", rawPath,
      "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
      "-ar", "44100",
      "-ac", "2",
      outPath,
    ],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error(`FFmpeg normalization failed:\n${result.stderr}`);
  }
}

function getDurationMs(filePath: string): number {
  const result = spawnSync(
    "ffprobe",
    ["-v", "quiet", "-print_format", "json", "-show_format", filePath],
    { encoding: "utf8" }
  );
  if (result.status !== 0) throw new Error(`ffprobe failed:\n${result.stderr}`);
  const info = JSON.parse(result.stdout) as { format?: { duration?: string } };
  const duration = parseFloat(info.format?.duration ?? "0");
  if (!duration) throw new Error(`ffprobe returned 0 duration for ${filePath}`);
  return Math.round(duration * 1000);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(`[gen-tts] date=${date}  voice="${voice}"  api=${GRADIO_BASE}`);

  if (!fs.existsSync(scriptPath)) {
    console.error(`✗ Script not found: ${scriptPath}`);
    console.error(`  Run first: npm run gen-script -- --date ${date}`);
    process.exit(1);
  }

  if (fs.existsSync(manifestPath) && !force) {
    console.log(`✓ Manifest already exists (use --force to regenerate): ${manifestPath}`);
    process.exit(0);
  }

  const script: VideoScript = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
  fs.mkdirSync(audioDir, { recursive: true });

  const jobs: SegmentJob[] = [
    { id: "intro", progressLabel: "Intro", text: script.intro.narration },
    ...script.segments.map((s, i) => ({
      id: `segment-${i + 1}`,
      newsId: s.newsId,
      progressLabel: s.progressLabel,
      text: s.narration,
    })),
    { id: "outro", progressLabel: "Outro", text: script.outro.narration },
  ];

  console.log(`\nProcessing ${jobs.length} segments  voice="${voice}"…\n`);

  // Process segments with limited concurrency
  const results: Array<{ index: number; entry: object }> = [];

  async function processJob(job: SegmentJob, index: number): Promise<void> {
    console.log(`▶ [${job.id}] ${job.progressLabel} — synthesizing…`);
    const rawPath = path.join(audioDir, `${job.id}_raw.wav`);
    const outPath = path.join(audioDir, `${job.id}.wav`);

    const audioBuffer = await callTTS(job.text);
    fs.writeFileSync(rawPath, audioBuffer);
    console.log(`  ✓ [${job.id}] Raw WAV: ${(audioBuffer.length / 1024).toFixed(0)} KB — normalizing…`);

    normalizeAudio(rawPath, outPath);
    const durationMs = getDurationMs(outPath);
    const durationFrames = Math.ceil(durationMs / (1000 / fps)) + 2;
    console.log(`  ✓ [${job.id}] ${(durationMs / 1000).toFixed(2)}s → ${durationFrames} frames`);

    results.push({
      index,
      entry: {
        id: job.id,
        ...(job.newsId ? { newsId: job.newsId } : {}),
        progressLabel: job.progressLabel,
        audioFile: outPath.replace(/\\/g, "/"),
        durationMs,
        durationFrames,
        text: job.text,
        captions: [],
      },
    });
  }

  // Concurrency pool: run up to CONCURRENCY jobs at once
  let cursor = 0;
  const running = new Set<Promise<void>>();

  while (cursor < jobs.length || running.size > 0) {
    while (running.size < CONCURRENCY && cursor < jobs.length) {
      const job = jobs[cursor];
      const index = cursor++;
      const p = processJob(job, index).finally(() => running.delete(p));
      running.add(p);
    }
    if (running.size > 0) await Promise.race(running);
  }

  // Restore original order (results arrive out of order due to concurrency)
  const segments = results.sort((a, b) => a.index - b.index).map((r) => r.entry);
  const totalDurationMs = segments.reduce((sum, s: any) => sum + s.durationMs, 0);

  const manifest = {
    date,
    engine: "qwen3-tts",
    voiceId: voice,
    fps,
    segments,
    totalDurationMs,
    totalFrames: segments.reduce((sum, s: any) => sum + s.durationFrames, 0),
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`✅ Manifest written: ${manifestPath}`);
  console.log(`   Segments : ${segments.length}`);
  console.log(`   Duration : ${(totalDurationMs / 1000).toFixed(1)}s (${manifest.totalFrames} frames)`);
}

main().catch((err: Error) => {
  console.error(`\n✗ gen-tts failed: ${err.message}`);
  process.exit(1);
});
