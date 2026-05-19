/**
 * Quick smoke test for Qwen3-TTS (ModelScope Gradio space).
 * Usage: npx tsx skills/test-qwen3-tts.ts [voiceName]
 * Saves output to output/qwen3-tts-test-<voice>.wav
 */
import fs from "fs";
import path from "path";

const BASE_URL = "https://qwen-qwen3-tts-demo.ms.show";
const API      = `${BASE_URL}/gradio_api`;
const FN_INDEX = 1; // tts_interface dependency id

const TEST_TEXT = "各位好，欢迎收看AI科技速报。今天，我们将带来三则重磅新闻，一起来看看。";
const VOICE     = process.argv[2] ?? "Cherry / 芊悦";
const LANGUAGE  = "Auto / 自动";

function randomHash(len = 10) {
  return Math.random().toString(36).slice(2, 2 + len);
}

async function joinQueue(sessionHash: string): Promise<void> {
  const res = await fetch(`${API}/queue/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: [TEST_TEXT, VOICE, LANGUAGE],
      event_data: null,
      fn_index: FN_INDEX,
      trigger_id: 7,
      session_hash: sessionHash,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`queue/join failed: ${res.status} ${await res.text()}`);
  }
}

interface GradioFileData {
  path?: string;
  url?: string | null;
  orig_name?: string;
}

async function waitForResult(sessionHash: string): Promise<GradioFileData> {
  const url = `${API}/queue/data?session_hash=${sessionHash}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok || !res.body) throw new Error(`SSE stream failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const dataLine = part.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const json = JSON.parse(dataLine.slice(5).trim()) as {
        msg: string;
        output?: { data: GradioFileData[] };
        success?: boolean;
      };

      if (json.msg === "process_completed") {
        if (!json.success || !json.output?.data?.[0]) {
          throw new Error(`TTS failed: ${JSON.stringify(json)}`);
        }
        return json.output.data[0];
      }
    }
  }
  throw new Error("SSE stream ended without completion");
}

async function main() {
  console.log(`Voice : ${VOICE}`);
  console.log(`Text  : ${TEST_TEXT}`);
  console.log("Joining queue…");

  const sessionHash = randomHash();
  const t0 = Date.now();

  await joinQueue(sessionHash);
  console.log(`Queue joined in ${Date.now() - t0}ms — waiting for result via SSE…`);

  const fileData = await waitForResult(sessionHash);
  console.log(`Done in ${Date.now() - t0}ms`);
  console.log(`FileData:`, JSON.stringify(fileData));

  const audioUrl = fileData.url ?? (fileData.path ? `${BASE_URL}/gradio_api/file=${fileData.path}` : null);
  if (!audioUrl) throw new Error("No audio URL in response");

  console.log(`Downloading: ${audioUrl}`);
  const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(30_000) });
  if (!audioRes.ok) throw new Error(`Download failed: ${audioRes.status}`);

  const buffer = await audioRes.arrayBuffer();
  fs.mkdirSync("output", { recursive: true });
  const safeName = VOICE.replace(/[^\w一-鿿]/g, "_").replace(/_+/g, "_");
  const outPath  = path.resolve(`output/qwen3-tts-test-${safeName}.wav`);
  fs.writeFileSync(outPath, Buffer.from(buffer));

  const totalMs = Date.now() - t0;
  console.log(`\nSaved ${(buffer.byteLength / 1024).toFixed(1)} KB → ${outPath}`);
  console.log(`Total RTT: ${totalMs}ms  (${(totalMs / 1000).toFixed(1)}s)`);
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
