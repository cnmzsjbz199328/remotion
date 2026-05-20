---
name: gen-script
description: Prepares a stub cache/script-{date}.json with fixed intro/outro narration and one empty segment per selected news story, then prints each story's article text and the editorial rules. The AI assistant invoking this skill writes the segment narrations directly into the stub — no LLM API is called.
argument-hint: [YYYY-MM-DD]
---

# gen-script

Generates the day's video narration script.

This skill is **driven by the AI assistant** that runs it (Claude Code, GPT-CLI,
Gemini-CLI, …). The supporting Node script is intentionally inert on the
cognitive side: it validates inputs, writes a structured stub, and dumps the
article texts and editorial rules into the terminal. The assistant then reads
that context out of its own working session and edits the stub to fill in
narration, key points, transition lines, and progress labels.

No LLM API is involved.

## Usage

```bash
npm run gen-script -- --date $ARGUMENTS
```

Pass `--force` to overwrite an existing script with a fresh stub.

## Prerequisites

- `cache/news-{date}.json` exists.
- At least 3 items in that file have `selected: true` and `articleText` ≥500 chars.
- If those conditions aren't met, the script exits with a clear next step
  (toggle `selected` flags, or re-run `/fetch-news --force`).

## What the script writes

A stub at `cache/script-{date}.json` shaped like
[remotion/types.ts → VideoScript](../../../remotion/types.ts):

- `intro.narration`  = fixed boilerplate from `lib/narration-constants.ts`
- `outro.narration`  = fixed boilerplate from `lib/narration-constants.ts`
- `intro.overview[]` = one `{ newsId, oneLiner: "" }` per story
- `segments[]`       = one entry per story with `newsId` and `sourceUrl`
  pre-filled and `narration / progressLabel / keyPoints / transitionLine`
  set to empty strings / arrays.

The fixed intro/outro narration is editorial policy — never regenerate it.

## What the assistant must fill in

For each segment in the stub:

| Field            | Rule |
|------------------|------|
| `progressLabel`  | ≤16-char Simplified Chinese noun phrase, no punctuation. |
| `narration`      | 180–260 汉字, faithful summary of `articleText` ONLY. No commentary, no speculation, no "experts say…" "in the era of…" filler. TTS-safe (no markdown / brackets / asterisks). |
| `keyPoints`      | Exactly 3 short factual bullets, ≤30 chars each. |
| `transitionLine` | One sentence bridging to the next story. Last segment uses a generic closing (e.g. 以上就是今天的全部要闻。). |
| `estimatedDurationS` | Optional — `gen-tts` measures the real duration anyway. Rough estimate: 汉字 count ÷ 4. |
| `category`       | Optional — short Chinese label (e.g. 行业, 研究, 政策, 工具). |

Plus for each `intro.overview[i]`:

| Field      | Rule |
|------------|------|
| `oneLiner` | ≤30-char Chinese one-sentence summary. Shown on the intro overview card. |

## Forbidden phrasings (commentary check)

The narration must NOT contain any of these — they're editorial / opinion, not
summary. `gen-tts` does not enforce this; the assistant must self-check.

- 分析人士认为 / 专家表示 / 业界认为 / 据悉
- 这意味着 / 引发了…讨论 / 引发…争议 / 引发…关注
- 深远影响 / 在…的当下 / 值得关注 / 凸显 / 折射 / 彰显
- 未来可能 / 或将 / 有望 / 恐将 / 无疑

## Source of fact

The ONLY source of fact for each narration is the corresponding item's
`articleText` field in `cache/news-{date}.json`. The assistant must not
incorporate outside knowledge or anything beyond what the article actually
says.

## After running

1. Run `npm run gen-script -- --date YYYY-MM-DD` to create the stub and dump
   context.
2. Read each story's `articleText` from `cache/news-{date}.json` (the script
   only prints the first ~1200 chars — full text is in the JSON).
3. Edit `cache/script-{date}.json` to fill in every empty field.
4. Re-read the file once to self-check the commentary rules above.
5. Run `/gen-tts` to synthesise audio.

See [../render/cache-schema.md](../render/cache-schema.md) for the full JSON schema.
