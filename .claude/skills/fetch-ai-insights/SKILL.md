---
name: fetch-ai-insights
description: Use your own web-search / browsing capabilities to identify 3–5 high-impact AI developments for the target date, cross-reference them against authoritative sources, and write the result to cache/news-insights-{date}.json. This is a pure-markdown skill — no Node script runs. The AI assistant that invokes the skill does all the work via WebSearch / WebFetch / Write tools.
argument-hint: [YYYY-MM-DD]
---

# fetch-ai-insights

Collect the day's most significant AI developments from authoritative sources
and write them into the pipeline cache.

This skill has no `.ts` implementation. The intelligence is the calling
assistant (Claude Code / GPT-CLI / Gemini-CLI, …). The skill's contract is
purely: "follow these instructions and write a JSON file in this schema".

## When to invoke

User asks to start the day's pipeline, refresh story selection, or
re-collect insights for a specific date. Default target date is the previous
day (relative to today) unless the user specifies one.

## Pre-flight

1. Resolve the target date — argument in `YYYY-MM-DD` form, defaulting to
   yesterday.
2. Check whether `cache/news-insights-{date}.json` already exists. If yes
   and the user did NOT say `--force`, stop and tell them the file is
   already there.

## Search strategy — tiered, no skipping

Run searches in tier order. After each tier, hold the candidate stories you've
found and continue. Don't stop after tier 1 even if you found "enough" — the
whole point of tier 2 and 3 is to surface the stories that English-centric
search misses.

### Tier 1 — International frontier labs

`OpenAI`, `Anthropic`, `Google DeepMind`, `Microsoft AI`, `Meta AI`, `xAI`,
`Mistral`.

Example queries:
- `OpenAI announcement {date}`
- `Anthropic news {date}`
- `Google DeepMind {date}`
- `xAI {date}`

### Tier 2 — Chinese top AI platforms

The current must-cover list. These are the players that ship frontier-class
models and have meaningful user / commercial scale today:

- **阿里巴巴 / 通义千问 (Qwen)** — frontier open-weights series, Qwen3 / Qwen-Omni etc.
- **字节跳动 / 火山引擎 / 豆包 (Doubao)** — fastest-growing domestic user base, full app matrix.
- **智谱 AI / 智谱清言 / GLM** — top large-model unicorn, broad commercial deployments.
- **月之暗面 (Moonshot) / Kimi** — leader in long-context and multimodal generation; Kimi is the flagship consumer AI assistant.
- **MiniMax (稀宇极智)** — same-generation peer to Moonshot; strong in voice / video generation (海螺).
- **DeepSeek** — open-weights frontier reasoning models, viral global adoption.

Lower-priority but still worth a sweep query: `Baidu / ERNIE 文心`,
`Tencent / Hunyuan 混元`, `01.AI / Yi 零一万物`, `Stepfun 阶跃星辰`.

Example queries:
- `通义千问 Qwen 发布 {date}`
- `字节 豆包 火山引擎 {date}`
- `智谱清言 GLM {date}`
- `Kimi Moonshot {date}`
- `MiniMax 海螺 {date}`
- `DeepSeek release {date}`

### Tier 3 — Infrastructure / hardware

`NVIDIA`, `AMD`, `TSMC`, `Broadcom`, `ASML`, `Cerebras`, `Groq`, `SambaNova`,
`SMIC 中芯国际`, `寒武纪`, `华为昇腾`.

Example queries:
- `NVIDIA AI chip {date}`
- `TSMC AI fab {date}`
- `华为 昇腾 {date}`

### Tier 4 — Catch-all sweep (anti-miss)

Broaden the search to catch important stories that didn't surface on
keyword-name queries.

Example queries:
- `AI news {date}`
- `AI policy {date}` / `AI regulation {date}`
- `AI lawsuit ruling {date}` / `AI court {date}`
- `AI funding round {date}` / `AI acquisition {date}`
- `AI safety incident {date}`

## Cross-referencing — every insight needs ≥2 authoritative sources

For each candidate story, fetch ≥2 independent sources to triangulate facts.
Authoritative sources include:

- Tier-1 business press: Bloomberg, Reuters, WSJ, FT, The Information, CNBC
- Tier-1 tech press: The Verge, Wired, Ars Technica, MIT Technology Review
- Tier-1 industry blogs: openai.com/news, anthropic.com/news,
  ai.googleblog.com, deepmind.com/blog, microsoft.com/source
- Tier-1 Chinese press: 新华社, 财新, 36 氪 (for industry), 量子位 / 机器之心
- Peer-reviewed venues for research insights: Nature, Science, NeurIPS, ICLR

If you can only find a single source for a story (and that source isn't a
top-3 outlet like Bloomberg / Nature / openai.com), drop the story — single
sources are how rumours get into the pipeline.

## Avoid (these are NOT insights)

- Self-promotion posts (Show HN, individual GitHub Pages blogs without
  significant institutional backing).
- Generic listicles ("10 things you didn't know about ChatGPT").
- Pure opinion / op-eds without new factual content.
- Tangential events (e.g. "someone was booed during an AI speech",
  "billionaire X tweeted about AI").
- Anything where you could only find one source.

## Output schema

Write to `cache/news-insights-{date}.json`:

```ts
interface InsightsCache {
  date: string;                          // e.g. "2026-05-20"
  fetchedAt: string;                     // ISO 8601 timestamp
  method: "ai-search-synthesis";
  insights: AIInsight[];                 // 3–5 items
}

interface AIInsight {
  id: string;                            // kebab-case, e.g. "insight-google-io-2026"
  topic: string;                         // Chinese headline (≤30 字)
  significance: string;                  // 1-2 sentences in Chinese — the deep "why"
  impactScore: number;                   // 1-10 (see rubric below)
  sourceUrls: string[];                  // ≥2 authoritative URLs
  category: "model-release" | "industry-shift" | "research-breakthrough" | "policy";
  summary: string;                       // 100-200 字 Chinese factual body. Fed into gen-script.
}
```

## Impact-score rubric

| Score | Meaning                                                                 |
|-------|-------------------------------------------------------------------------|
| 10    | Industry-defining (flagship model launch, $100B+ funding, paradigm shift) |
| 8–9   | Major shift (new agentic platform, government regulatory action)         |
| 6–7   | Solid news (enterprise partnership, large but expected funding)          |
| 4–5   | Worth covering only on slow news days                                    |
| 1–3   | Skip                                                                     |

Aim for an average impact score ≥7 across the 3–5 insights you keep.

## Summary writing rules — the `summary` field feeds gen-script directly

- **Language**: Simplified Chinese.
- **Length**: 100–200 汉字 per insight. Dense factual content, no padding.
- **Source of fact**: only what the cited sources say. Do NOT add outside
  knowledge or "industry context" not present in the sources.
- **Forbidden phrasings** — the script's narration is built from these
  summaries, so the editorial-no-commentary rule starts here:
  - 分析人士认为 / 专家表示 / 业界认为
  - 这意味着 / 引发了…讨论 / 引发…关注 / 深远影响
  - 在…的当下 / 值得关注 / 凸显 / 折射 / 彰显
  - 未来可能 / 或将 / 有望 / 恐将 / 无疑
- **TTS-safe**: no markdown, no asterisks, no brackets, no emoji.

## ID naming

Use kebab-case, stable across the day's runs. Examples:
- `insight-google-io-2026`
- `insight-anthropic-funding-g`
- `insight-caisi-evals`
- `insight-deepseek-v4`

The `id` must be unique per file and gets referenced by `script-{date}.json`.

## After running

1. Confirm `cache/news-insights-{date}.json` has 3–5 insights, average impact
   score ≥7.
2. Optionally surface the list back to the user for sign-off before running
   `/gen-script`.
