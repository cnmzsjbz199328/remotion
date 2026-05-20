---
name: gen-script
description: Read cache/news-insights-{date}.json, WebFetch the primary article URL for each insight marked `selected: true`, and write cache/script-{date}.json — the day's full video narration script. Fixed intro/outro narration come from lib/narration-constants.ts. This is the DEEP phase of the pipeline — the calling AI assistant fetches each selected article, summarises it into Chinese narration, and writes the script directly.
argument-hint: [YYYY-MM-DD]
---

# gen-script

Generate the day's video narration script from the user-selected AI insights.

This skill has no `.ts` implementation. All cognitive work — fetching the
article body, turning each insight into a 180–260 字 Chinese segment,
choosing a tight `progressLabel`, drafting a transition sentence, picking 3
key points — is done by the AI assistant that invoked the skill via its
Read / WebFetch / Write / Edit tools.

## Two-phase pipeline — this is the DEEP phase

`/fetch-ai-insights` produced a lightweight shortlist (topic + significance
+ source URLs, no article body, no narration). The user then toggled
`selected: true` on the 3–5 candidates they want in the video. Now this
skill does the heavy work that was deferred: fetch each selected article,
write the Chinese narration grounded in the real article text.

## When to invoke

After `/fetch-ai-insights` and after the user has marked ≥3 candidates
`selected: true`.

## Pre-flight

1. Resolve the target date (`YYYY-MM-DD`, defaults to yesterday).
2. Read `cache/news-insights-{date}.json`.
   - If it's missing → tell the user to run `/fetch-ai-insights` first.
   - Filter to `selected: true`. If fewer than 3 → tell the user to pick
     more candidates and re-run.
3. Check whether `cache/script-{date}.json` already exists. If yes and the
   user didn't say `--force`, stop and tell them.
4. For each selected insight, WebFetch `sourceUrls[0]` to retrieve the
   article body. If it fails (paywall, 404, redirect), try `sourceUrls[1]`,
   then `[2]`, etc. If none of the sources yield ≥500 字 of usable text,
   tell the user that insight needs to be replaced or its sources fixed,
   and stop.

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

The source of fact for each segment's narration is the **article body
fetched in step 4 of pre-flight** — not the `topic`, not the `significance`,
not your memory. The `significance` field is useful only as a sanity check
("did I pick the right angle?"), not as the body of the narration.

If WebFetch yields a clean article body but it's in English / another
language, translate the facts into Chinese as you summarise — do NOT
machine-paste machine-translated text.

If WebFetch repeatedly fails for a selected insight, that's a signal the
insight's sources are weak. Tell the user, suggest swapping the selection,
and stop. Do not invent facts to fill the gap.

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
