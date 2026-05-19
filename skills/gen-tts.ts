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
const voice = getArg("--voice") ?? process.env.MOSS_TTS_VOICE ?? "zh_1";
const baseUrl = (process.env.MOSS_TTS_URL ?? "https://tom199328-moss-tts-nano.hf.space").replace(/\/$/, "");
const fps = 30;
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 120_000;

// Reference audio files are sourced from the MOSS-TTS-Nano GitHub repo
const VOICE_REPO_BASE = "https://raw.githubusercontent.com/cnmzsjbz199328/MOSS-TTS-Nano/main/assets/audio";

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

// ─── Voice reference file ─────────────────────────────────────────────────────
async function ensureVoiceFile(voiceId: string): Promise<string> {
  const voiceDir = path.join("cache", "voices");
  const voicePath = path.join(voiceDir, `${voiceId}.wav`);
  if (fs.existsSync(voicePath)) return voicePath;

  fs.mkdirSync(voiceDir, { recursive: true });
  console.log(`  → Downloading reference voice ${voiceId}.wav from GitHub…`);
  const res = await fetch(`${VOICE_REPO_BASE}/${voiceId}.wav`);
  if (!res.ok) throw new Error(`Failed to download voice ${voiceId}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(voicePath, buf);
  console.log(`  ✓ Voice saved: ${voicePath} (${(buf.length / 1024).toFixed(0)} KB)`);
  return voicePath;
}

// ─── MOSS-TTS-Nano API call ────────────────────────────────────────────────────
async function callTTS(text: string, voicePath: string): Promise<Buffer> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const audioBytes = fs.readFileSync(voicePath);
      const audioBlob = new Blob([audioBytes], { type: "audio/wav" });

      const form = new FormData();
      form.append("text", text);
      form.append("demo_id", "");
      form.append("prompt_audio", audioBlob, path.basename(voicePath));
      form.append("enable_text_normalization", "1");
      form.append("enable_normalize_tts_text", "1");

      const res = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        body: form,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        const msg = await res.text().catch(() => "(no body)");
        throw new Error(`HTTP ${res.status}: ${msg}`);
      }

      const json = (await res.json()) as { audio_base64?: string };
      if (!json.audio_base64) throw new Error("Response missing audio_base64");
      return Buffer.from(json.audio_base64, "base64");
    } catch (err: any) {
      clearTimeout(timer);
      if (attempt === MAX_RETRIES) throw err;
      const wait = attempt * 4000;
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
  console.log(`[gen-tts] date=${date}  voice=${voice}  url=${baseUrl}`);

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

  console.log(`\nProcessing ${jobs.length} segments…`);
  console.log(`(Note: the HF Space may take up to 60s to warm up on first request)\n`);

  const voicePath = await ensureVoiceFile(voice);

  const segments: object[] = [];
  let totalDurationMs = 0;

  for (const job of jobs) {
    console.log(`▶ [${job.id}] ${job.progressLabel}`);
    console.log(`  text: ${job.text.slice(0, 60)}…`);

    const rawPath = path.join(audioDir, `${job.id}_raw.wav`);
    const outPath = path.join(audioDir, `${job.id}.wav`);

    console.log(`  → Synthesizing via MOSS-TTS-Nano…`);
    const audioBuffer = await callTTS(job.text, voicePath);
    fs.writeFileSync(rawPath, audioBuffer);
    console.log(`  ✓ Raw WAV: ${(audioBuffer.length / 1024).toFixed(0)} KB`);

    console.log(`  → Normalizing (44100Hz stereo, EBU R128 -14 LUFS)…`);
    normalizeAudio(rawPath, outPath);

    const durationMs = getDurationMs(outPath);
    const durationFrames = Math.ceil(durationMs / (1000 / fps)) + 2;
    totalDurationMs += durationMs;
    console.log(`  ✓ ${(durationMs / 1000).toFixed(2)}s → ${durationFrames} frames\n`);

    segments.push({
      id: job.id,
      ...(job.newsId ? { newsId: job.newsId } : {}),
      progressLabel: job.progressLabel,
      audioFile: outPath.replace(/\\/g, "/"),
      durationMs,
      durationFrames,
      text: job.text,
      captions: [],
    });
  }

  const manifest = {
    date,
    engine: "moss-tts-nano",
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
