---
name: gen-script
description: Read cache/news-insights-{date}.json and write cache/script-{date}.json — the day's full video narration script. Fixed intro/outro narration come from lib/narration-constants.ts; per-segment narration is written by the AI assistant based on each insight's `summary`. This is a pure-markdown skill — no Node script runs.
argument-hint: [YYYY-MM-DD]
---

# gen-script

Generate the day's video narration script from the curated AI insights.

This skill has no `.ts` implementation. All cognitive work — turning each
insight into a 180–260 字 Chinese segment, choosing a tight `progressLabel`,
drafting a transition sentence, picking 3 key points — is done by the AI
assistant that invoked the skill via its Read / Write / Edit tools.

## When to invoke

After `/fetch-ai-insights` has produced `cache/news-insights-{date}.json` and
the user has signed off on the insight list.

## Pre-flight

1. Resolve the target date (`YYYY-MM-DD`, defaults to yesterday).
2. Read `cache/news-insights-{date}.json`.
   - If it's missing → tell the user to run `/fetch-ai-insights` first.
   - If `insights.length < 3` → tell the user; ask if they want to go back
     and add more.
3. Check whether `cache/script-{date}.json` already exists. If yes and the
   user didn't say `--force`, stop and tell them.

## Output schema

Write `cache/script-{date}.json` matching
[remotion/types.ts → VideoScript](../../../remotion/types.ts):

```ts
interface VideoScript {
  date: string;                  // "2026-05-20"
  intro: {
    narration: string;           // FIXED — see below
    estimatedDurationS: number;  // FIXED — INTRO_ESTIMATED_S
    overview: { newsId: string; oneLiner: string }[]; // one per segment
  };
  segments: {
    newsId: string;              // matches an insight.id
    progressLabel: string;       // ≤16-char Chinese noun phrase
    narration: string;           // 180–260 汉字, see rules below
    estimatedDurationS: number;  // ≈ 汉字-count ÷ 4
    keyPoints: string[];         // exactly 3, ≤30 chars each
    transitionLine: string;      // bridge to next; generic on last segment
    category?: string;           // optional Chinese label
    sourceUrl?: string;          // first item of insight.sourceUrls
  }[];
  outro: {
    narration: string;           // FIXED — see below
    estimatedDurationS: number;  // FIXED — OUTRO_ESTIMATED_S
  };
}
```

## Fixed boilerplate — DO NOT regenerate

Read from `lib/narration-constants.ts`:

- `intro.narration`  = `FIXED_INTRO_NARRATION`  ("大家好，欢迎收看今日AI资讯。首先是资讯速览。")
- `intro.estimatedDurationS` = `INTRO_ESTIMATED_S` (8)
- `outro.narration`  = `FIXED_OUTRO_NARRATION`  ("以上是AI相关资讯的全部内容，我们下期再见。")
- `outro.estimatedDurationS` = `OUTRO_ESTIMATED_S` (6)

## Per-segment writing rules

| Field             | Rule |
|-------------------|------|
| `newsId`          | Copy `insight.id` verbatim. |
| `progressLabel`   | ≤16 半角 chars (≤8 汉字 ≈ safe). Chinese noun phrase, no punctuation. Example: `Google I/O 2026`, `Anthropic G轮融资`, `CAISI安全评估`. |
| `narration`       | 180–260 汉字, faithful expansion of `insight.summary` ONLY. No outside knowledge. |
| `estimatedDurationS` | Round (汉字 count ÷ 4). gen-tts re-measures the real duration. |
| `keyPoints`       | Exactly 3 short factual bullets, ≤30 字 each. |
| `transitionLine`  | One sentence bridging to the next story. For the LAST segment use a generic closing such as `以上就是今天的全部要闻。`. |
| `category`        | Optional. Map `insight.category` to Chinese: model-release→产品, industry-shift→产业, research-breakthrough→研究, policy→政策. |
| `sourceUrl`       | `insight.sourceUrls[0]`. |

## intro.overview[i].oneLiner

≤30-char Chinese one-sentence summary of segment `i` — shown on the片头资讯速览 card. Distinct from `progressLabel` (which is a short noun phrase) — `oneLiner` is a full sentence.

## Forbidden phrasings (commentary check)

The narration must NOT contain any of these — they are editorial / opinion,
not summary. Re-read the file once after writing and search for these:

- 分析人士认为 / 专家表示 / 业界认为 / 据悉
- 这意味着 / 引发了…讨论 / 引发…争议 / 引发…关注
- 深远影响 / 在…的当下 / 值得关注 / 凸显 / 折射 / 彰显
- 未来可能 / 或将 / 有望 / 恐将 / 无疑

If any match, rewrite the offending sentence into a plain factual statement.

## Source of fact

The only source of fact is each insight's `summary` field plus optionally the
`significance` field as background. Do NOT consult `sourceUrls` again, do NOT
re-search the web, do NOT add knowledge not present in the insight.

If a summary is too thin to expand into 180+ 汉字, that's a signal the insight
itself was under-cooked — go back to `/fetch-ai-insights --force` and improve
the summary, don't paper over it with filler.

## TTS-safety

The narration is read by a TTS engine. Avoid:
- Markdown (`*`, `_`, `\``, `#`, …)
- Square brackets, curly brackets
- Emoji
- Multiple consecutive punctuation marks (e.g. `……！！！`)
- English acronyms longer than 4 letters without spelling them out

## After running

1. Re-open `cache/script-{date}.json` and read each segment aloud (mentally).
2. Self-check the forbidden-phrasings list.
3. Confirm intro / outro narration is EXACTLY the fixed boilerplate.
4. Tell the user the script is ready and offer to run `/gen-tts`.

See [../render/cache-schema.md](../render/cache-schema.md) for the full JSON
schema validated by render.
