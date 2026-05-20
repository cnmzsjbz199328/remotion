---
name: fetch-ai-insights
description: Use your own web-search capabilities to surface a lightweight shortlist of 10 high-impact AI candidates for the target date, cross-reference each against authoritative sources, and write the result to cache/news-insights-{date}.json. This is the FAST phase — no article body extraction, no narration writing. Deep analysis happens later in /gen-script, after the user has marked which candidates to keep.
argument-hint: [YYYY-MM-DD]
---

# fetch-ai-insights

Surface a fresh, ranked shortlist of the day's significant AI developments
so the user can pick which ones to turn into a video.

This skill has no `.ts` implementation. The intelligence is the calling
assistant (Claude Code / GPT-CLI / Gemini-CLI, …). The skill's contract is
purely: "follow these instructions and write a JSON file in this schema".

## Two-phase pipeline — this is the FAST phase

| Phase | Skill | Cost per candidate | Output |
|-------|-------|---------------------|--------|
| **Fast (this skill)** | `/fetch-ai-insights` | low: title + 1–2 sentence significance + ≥2 source URLs | 10 candidates ranked by impact |
| Deep | `/gen-script` | high: WebFetch each `selected:true` candidate's article, write narration | Per-segment Chinese narration |

The point: don't spend the deep-analysis budget on candidates the user will
reject. Surface them light, let the user filter, deep-dive only on winners.

## Freshness — this matters

Target the previous-day window (relative to the `--date` argument). Older
than 48 hours and it's no longer "news" — drop it. If the catch-all sweep
in Tier 4 surfaces a story from a week ago, it's not for this video.

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

Write to `cache/news-insights-{date}.json`. Sort `insights[]` by
`impactScore` descending.

```ts
interface InsightsCache {
  date: string;                          // e.g. "2026-05-20"
  fetchedAt: string;                     // ISO 8601 timestamp
  method: "ai-search-synthesis";
  insights: AIInsight[];                 // 10 candidates
}

interface AIInsight {
  id: string;                            // kebab-case, e.g. "insight-google-io-2026"
  topic: string;                         // Chinese headline (≤30 字)
  significance: string;                  // 1-2 short Chinese sentences — the "why"
  impactScore: number;                   // 1-10 (see rubric below)
  sourceUrls: string[];                  // ≥2 authoritative URLs
  category: "model-release" | "industry-shift" | "research-breakthrough" | "policy";
  selected: boolean;                     // default false — user toggles to pick the 3–5 winners
}
```

**Do NOT include a `summary` field.** Article-body fetching and Chinese
narration drafting happens in `/gen-script`, after the user has decided
which candidates are worth the deep-dive. Putting a `summary` here would
both waste budget on rejected candidates and force the eventual narration
to be a summary-of-a-summary instead of grounded in the real article.

## Impact-score rubric

| Score | Meaning                                                                 |
|-------|-------------------------------------------------------------------------|
| 10    | Industry-defining (flagship model launch, $100B+ funding, paradigm shift) |
| 8–9   | Major shift (new agentic platform, government regulatory action)         |
| 6–7   | Solid news (enterprise partnership, large but expected funding)          |
| 4–5   | Worth surfacing as a backup pick on slow news days                       |
| 1–3   | Skip                                                                     |

Aim for an average impact score ≥7 across the candidates you keep. If a
score-4 candidate is the only fresh story from Tier 2 / Tier 3, surface it
anyway — geographic diversity matters more than the marginal score.

## Significance field — keep it tight

- **Language**: Simplified Chinese.
- **Length**: 1–2 sentences, roughly 30–60 字. Enough for the user to
  decide whether this story belongs in today's slate.
- **What it should answer**: *why does this matter beyond the headline?*
  Not the facts (those will come from the article in gen-script) — the
  significance.
- **Avoid** editorial phrasing here too (no 引发讨论 / 深远影响 / 凸显 / 值得关注). Plain factual reasoning.

## ID naming

Use kebab-case, stable across the day's runs. Examples:
- `insight-google-io-2026`
- `insight-anthropic-funding-g`
- `insight-caisi-evals`
- `insight-deepseek-v4`

The `id` must be unique per file and gets referenced by `script-{date}.json`
later.

## After running

1. Confirm `cache/news-insights-{date}.json` has 10 candidates, sorted by
   impactScore descending, every one with `selected: false`.
2. Print the shortlist back to the user — one line per candidate with
   impact score, topic, and significance. Ask them to pick 3–5 winners.
3. The user can either reply with picks (you toggle `selected: true` via
   Edit) or open the file and toggle directly.
4. Once 3–5 items have `selected: true`, the user can invoke `/gen-script`
   to do the deep-dive.
