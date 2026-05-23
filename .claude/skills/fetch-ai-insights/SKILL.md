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
| **Fast (this skill)** | `/fetch-ai-insights` | low: title + 1–2 sentence significance + ≥2 verified source URLs | 6–10 candidates ranked by impact |
| Deep | `/gen-script` | high: WebFetch each `selected:true` candidate's article, write narration | Per-segment Chinese narration |

The point: don't spend the deep-analysis budget on candidates the user will
reject. Surface them light, let the user filter, deep-dive only on winners.

## Freshness — this matters

Target the previous-day window (relative to the `--date` argument). Older
than 48 hours and it's no longer "news" — drop it. If the catch-all sweep
in Sweep 4 surfaces a story from a week ago, it's not for this video.

## Source authority hierarchy — Tier 1/2/3

Every candidate must be graded by where the fact ORIGINATES, not by where you
first saw it. The principle: **a story not traceable to an official, primary
publication is not allowed into the cache.**

| Tier | What it is | Trust | Rule |
|------|-----------|-------|------|
| **Tier 1** | Official: company blog / newsroom / press release / CEO-founder direct channel (`openai.com/news`, `anthropic.com/news`, `deepmind.google`, `blogs.nvidia.com`, `nvidianews.nvidia.com`, `blog.google`, `microsoft.com/source`, `ai.meta.com/blog`, 阿里/字节/智谱/月之暗面官方) | 100% — the fact baseline | Usable directly. |
| **Tier 2** | Technical primary: official papers (arXiv under the org's own authorship), official GitHub org repos, official developer forums | High — for technical detail | Must match a Tier 1 announcement or code-merge record. |
| **Tier 3** | Reputable trade press: Bloomberg, Reuters, WSJ, FT, The Information, CNBC, The Verge, MIT Tech Review, 财新/新华社 | Medium — timeliness lead ONLY | A Tier 3 report by itself is a *lead*, not a *fact*. You must locate Tier 1 (or Tier 2) confirmation. If none exists, the story is a RUMOUR — drop it. |

Self-media, personal blogs, content aggregators, forum threads, prediction
markets, and SEO listicles are **not** sources at any tier. A story whose only
trail leads to those is excluded outright.

When you write `sourceUrls[]`, the FIRST url must be the Tier 1 origin
whenever one exists. Tier 3 urls may follow as secondary, never lead.

## Noise filter — exclude the speculative

After collecting candidates, drop any whose core claim is speculative. A story
is speculative (and excluded) if its best available phrasing is:

- "is preparing to" / "plans to" / "is expected to" / "could" / "may"
- "in talks to" / "in discussions" / "reportedly considering" / "may not lead to"
- "leaked" / "rumour" / "sources say" with no official confirmation
- an event that was POSTPONED or has not yet happened

The test: *has the thing actually happened and been officially confirmed?*
"OpenAI filed its S-1" (filed, confirmed) passes. "OpenAI is preparing to file"
(not yet, not official) fails. "Anthropic in talks to use Microsoft chips"
(talks, may not lead) fails.

For a model release specifically, the candidate must carry at least one of:
official technical specs, an official access/download URL, or an official
release date — sourced from Tier 1. A model "announced" only through trade
press with no official page is a rumour.

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

## Search strategy — four sweeps, no skipping

Run the four topic sweeps below in order. After each sweep, hold the candidates
you've found and continue. Don't stop after Sweep 1 even if you found "enough" —
the whole point of Sweeps 2 and 3 is to surface stories English-centric search
misses.

These sweeps are TOPIC coverage. They are orthogonal to the Tier 1/2/3
*authority* grading above — every candidate from any sweep must still pass the
authority hierarchy and the noise filter.

### Domain-targeted queries — do this first in every sweep

Before broad keyword search, run domain-locked queries straight at the official
newsrooms. This is the fastest path to Tier 1 facts:

- `site:openai.com/news {month year}`
- `site:anthropic.com/news {month year}`
- `site:deepmind.google {month year}` / `site:blog.google {month year}`
- `site:blogs.nvidia.com {month year}` / `site:nvidianews.nvidia.com {month year}`
- `site:ai.meta.com/blog {month year}` / `site:microsoft.com/source {month year}`

Then widen to `"[Company] blog OR news OR release OR announcement {month year}"`.
Use trade-press queries only to discover *leads* — every lead must then be
chased back to a Tier 1 page before it can become a candidate.

### Sweep 1 — International frontier labs

`OpenAI`, `Anthropic`, `Google DeepMind`, `Microsoft AI`, `Meta AI`, `xAI`,
`Mistral`.

Example queries:
- `OpenAI announcement {date}`
- `Anthropic news {date}`
- `Google DeepMind {date}`
- `xAI {date}`

### Sweep 2 — Chinese top AI platforms

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

### Sweep 3 — Infrastructure / hardware

`NVIDIA`, `AMD`, `TSMC`, `Broadcom`, `ASML`, `Cerebras`, `Groq`, `SambaNova`,
`SMIC 中芯国际`, `寒武纪`, `华为昇腾`.

Example queries:
- `NVIDIA AI chip {date}`
- `TSMC AI fab {date}`
- `华为 昇腾 {date}`

### Sweep 4 — Catch-all (anti-miss)

Broaden the search to catch important stories that didn't surface on
keyword-name queries.

Example queries:
- `AI news {date}`
- `AI policy {date}` / `AI regulation {date}`
- `AI lawsuit ruling {date}` / `AI court {date}`
- `AI funding round {date}` / `AI acquisition {date}`
- `AI safety incident {date}`

## Cross-referencing & fact audit

Every candidate must clear a three-step audit before it goes in the cache:

1. **Origin match** — the fact must have a corresponding URL on an official
   Tier 1 page (company newsroom / blog / press release). If you cannot find
   that page, the story is a rumour — drop it.
2. **Fact consistency** — any number you cite (revenue, context window,
   benchmark score, valuation, release date) must match the Tier 1 source. If
   trade press and the official page disagree, the official page wins.
3. **Timezone alignment** — frontier labs publish across PST / CET / SGT.
   Normalise timestamps to UTC when ordering events, so the previous-day
   window is judged correctly and the evolution reads coherently.

`sourceUrls[]` must contain ≥2 urls and the first must be the Tier 1 origin.
A story whose only trail is trade press or aggregators — with no official
page anywhere — does not enter the cache, regardless of how big it sounds.

## URL hygiene — every link must be reachable AND on-topic

The `sourceUrls[]` you write end up being fetched by `/gen-script`. A bad link
breaks the deep-fetch and forces the user to swap the candidate. To prevent this:

1. **Only use URLs returned by an actual search.** Never reconstruct a URL from
   memory or guess based on a known slug pattern. WebSearch returned the slug —
   use that exact string. URLs of the form `blog.google/.../google-io-2026-keynote/`
   that look plausible but were never in the search results are the typical
   source of 404s.
2. **Verify before writing.** For every URL in `sourceUrls[]`, perform a
   lightweight WebFetch (just enough to see the page exists and is on-topic)
   BEFORE saving the cache file. If a URL returns 404 / 403 / a paywall page
   stripped of the relevant content / a redirect to an unrelated index page,
   drop that URL and substitute another from the same search results. Do this
   for every candidate, not just spot-check.
3. **At least one URL per candidate must pass the fetch.** If you cannot find
   ≥2 working URLs (with at least one Tier 1) for a candidate, drop the
   candidate rather than keep weak/broken sourcing — `/gen-script` will fail
   on it anyway.
4. **On-topic check.** A 200 response is necessary but not sufficient. The
   page content must actually be about the claim. A 200 page that turns out
   to be a news-index landing page (no article body) is just as bad as 404.

## Avoid (these are NOT insights)

- Anything that fails the noise filter — speculation, "in talks", leaks,
  postponed/not-yet-happened events.
- Anything with no Tier 1 official origin (trade-press-only stories).
- Self-promotion posts (Show HN, individual GitHub Pages blogs without
  significant institutional backing).
- Generic listicles ("10 things you didn't know about ChatGPT").
- Pure opinion / op-eds without new factual content.
- Tangential events (e.g. "someone was booed during an AI speech",
  "billionaire X tweeted about AI").
- Prediction-market odds, analyst price targets, stock-movement commentary.
- Anything where you could only find one source.

## Quantity vs quality — quality wins

The target is 10 candidates, but the authority hierarchy and noise filter come
first. If a given day genuinely only yields 4–6 stories that pass, surface 4–6.
Never pad the list with rumours or trade-press-only items to reach 10. Tell the
user plainly when the day was thin and why.

## Output schema

Write to `cache/news-insights-{date}.json`. Sort `insights[]` by
`impactScore` descending.

```ts
interface InsightsCache {
  date: string;                          // e.g. "2026-05-20"
  fetchedAt: string;                     // ISO 8601 timestamp
  method: "ai-search-synthesis";
  insights: AIInsight[];                 // 6–10 candidates (quality > quantity, see below)
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
score-4 candidate is the only fresh story from Sweep 2 / Sweep 3, surface it
anyway — geographic diversity matters more than the marginal score, provided
it still passes the authority hierarchy and noise filter.

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

1. Confirm `cache/news-insights-{date}.json` has 6–10 candidates, sorted by
   impactScore descending, every one with `selected: false`. Every candidate
   should have ≥2 sourceUrls that you actually fetched and confirmed are
   on-topic — if any candidate failed verification, it should have been dropped
   already, never written.
2. Print the shortlist back to the user — one line per candidate with
   impact score, topic, and significance. Ask them to pick 3–5 winners.
3. The user can either reply with picks (you toggle `selected: true` via
   Edit) or open the file and toggle directly.
4. Once 3–5 items have `selected: true`, the user can invoke `/gen-script`
   to do the deep-dive.
