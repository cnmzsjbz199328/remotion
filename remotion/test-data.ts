import { buildTimeline, computeTotalFrames } from "../lib/timeline";
import type { VideoInputProps, TtsManifest } from "./types";

const FPS = 30;

// durationMs → durationFrames with the standard formula
const toFrames = (ms: number) => Math.ceil(ms / (1000 / FPS)) + 2;

const ttsManifest: TtsManifest = {
  date: "test",
  engine: "static",
  voiceId: "none",
  fps: FPS,
  segments: [
    {
      id: "intro",
      progressLabel: "Intro",
      audioFile: "",
      durationMs: 4000,
      durationFrames: toFrames(4000),
      text: "Welcome to AI News Daily. Today we cover five major developments reshaping artificial intelligence.",
      captions: [],
    },
    {
      id: "segment-1",
      newsId: "story-1",
      progressLabel: "GPT-5 Released",
      audioFile: "",
      durationMs: 5000,
      durationFrames: toFrames(5000),
      text: "OpenAI today officially announced GPT-5 with extended thinking capabilities.",
      captions: [],
    },
    {
      id: "segment-2",
      newsId: "story-2",
      progressLabel: "Gemini Ultra 2",
      audioFile: "",
      durationMs: 5000,
      durationFrames: toFrames(5000),
      text: "Google DeepMind unveiled Gemini Ultra 2 with native multimodal reasoning.",
      captions: [],
    },
    {
      id: "segment-3",
      newsId: "story-3",
      progressLabel: "Open Source Rival",
      audioFile: "",
      durationMs: 5000,
      durationFrames: toFrames(5000),
      text: "A new open-source model from a European AI lab beats GPT-4 on coding benchmarks.",
      captions: [],
    },
    {
      id: "segment-4",
      newsId: "story-4",
      progressLabel: "EU AI Act",
      audioFile: "",
      durationMs: 5000,
      durationFrames: toFrames(5000),
      text: "The EU Parliament passed its landmark AI Act, setting global compliance standards.",
      captions: [],
    },
    {
      id: "segment-5",
      newsId: "story-5",
      progressLabel: "Agent Benchmark",
      audioFile: "",
      durationMs: 5000,
      durationFrames: toFrames(5000),
      text: "Stanford researchers published a new agent evaluation benchmark that exposes real-world failure modes.",
      captions: [],
    },
    {
      id: "outro",
      progressLabel: "Outro",
      audioFile: "",
      durationMs: 3000,
      durationFrames: toFrames(3000),
      text: "That's all for today's AI news briefing. Subscribe to stay up to date.",
      captions: [],
    },
  ],
  totalDurationMs:
    4000 + 5000 + 5000 + 5000 + 5000 + 5000 + 3000,
  totalFrames: 0, // filled below
};

const timeline = buildTimeline(ttsManifest);
const totalFrames = computeTotalFrames(timeline);
ttsManifest.totalFrames = totalFrames;

export const staticProps: VideoInputProps = {
  date: "test",
  fps: FPS,
  width: 1920,
  height: 1080,

  script: {
    date: "test",
    intro: {
      narration:
        "Welcome to AI News Daily. Today we cover five major developments reshaping the world of artificial intelligence.",
      estimatedDurationS: 28,
      overview: [
        { newsId: "story-1", oneLiner: "OpenAI drops GPT-5 with extended thinking chains" },
        { newsId: "story-2", oneLiner: "Google unveils Gemini Ultra 2 with native multimodal reasoning" },
        { newsId: "story-3", oneLiner: "European open-source model outperforms GPT-4 on coding" },
        { newsId: "story-4", oneLiner: "EU AI Act passes — what it means for developers" },
        { newsId: "story-5", oneLiner: "Stanford benchmark exposes agent failure modes at scale" },
      ],
    },
    segments: [
      {
        newsId: "story-1",
        progressLabel: "GPT-5 Released",
        narration:
          "OpenAI today officially announced GPT-5, featuring a significantly extended context window and a new extended thinking mode that lets the model reason step-by-step before producing an answer.",
        estimatedDurationS: 91,
        keyPoints: ["128K context window", "40% improvement in reasoning benchmarks", "API available today"],
        transitionLine: "Next, Google made its own major move.",
        category: "model-release",
        sourceUrl: "https://openai.com/blog/gpt-5",
      },
      {
        newsId: "story-2",
        progressLabel: "Gemini Ultra 2",
        narration:
          "Google DeepMind unveiled Gemini Ultra 2, its most powerful model yet. The standout feature is native multimodal reasoning across text, image, audio, and video within a single context.",
        estimatedDurationS: 88,
        keyPoints: ["Native video understanding", "1M token context", "Integrated with Google Workspace"],
        transitionLine: "Meanwhile, the open-source world is closing the gap.",
        category: "model-release",
        sourceUrl: "https://deepmind.google/technologies/gemini/ultra",
      },
      {
        newsId: "story-3",
        progressLabel: "Open Source Rival",
        narration:
          "A European AI lab released a new open-source language model that surpasses GPT-4 on several coding and mathematics benchmarks, raising the bar for what the community can build without proprietary APIs.",
        estimatedDurationS: 93,
        keyPoints: ["Apache 2.0 license", "Outperforms GPT-4 on HumanEval", "Runs on consumer hardware (24GB VRAM)"],
        transitionLine: "On the policy front, a landmark decision in Brussels.",
        category: "research",
        sourceUrl: "https://huggingface.co/blog",
      },
      {
        newsId: "story-4",
        progressLabel: "EU AI Act",
        narration:
          "The European Parliament formally passed the AI Act, the world's first comprehensive legal framework for artificial intelligence. High-risk AI systems now face mandatory audits and transparency requirements.",
        estimatedDurationS: 86,
        keyPoints: [
          "Effective from 2026",
          "Banned: real-time biometric surveillance in public spaces",
          "Fines up to 7% of global revenue",
        ],
        transitionLine: "Finally, a look at how we measure AI agent performance.",
        category: "policy",
        sourceUrl: "https://www.europarl.europa.eu/news/en/",
      },
      {
        newsId: "story-5",
        progressLabel: "Agent Benchmark",
        narration:
          "Researchers at Stanford published AgentBench v2, a new evaluation suite designed to test AI agents on real-world multi-step tasks. The results reveal that current agents fail on nearly half the tasks that require planning more than five steps ahead.",
        estimatedDurationS: 90,
        keyPoints: [
          "100 real-world task categories",
          "Current best agent scores 54%",
          "Open-source evaluation harness",
        ],
        transitionLine: "That brings us to the end of today's briefing.",
        category: "research",
        sourceUrl: "https://arxiv.org/abs/2308.03688",
      },
    ],
    outro: {
      narration:
        "That's all for today's AI news briefing. If you found this useful, subscribe for your daily dose of AI intelligence. See you tomorrow.",
      estimatedDurationS: 10,
    },
  },

  ttsManifest,

  assets: {
    date: "test",
    segments: [
      {
        newsId: "story-1",
        images: [
          { file: "https://picsum.photos/seed/gpt5openai/1920/1080", source: "fallback", credit: null },
          { file: "https://picsum.photos/seed/neural2026/1920/1080", source: "fallback", credit: null },
        ],
      },
      {
        newsId: "story-2",
        images: [
          { file: "https://picsum.photos/seed/geminiultra/1920/1080", source: "fallback", credit: null },
          { file: "https://picsum.photos/seed/deepmind26/1920/1080", source: "fallback", credit: null },
        ],
      },
      {
        newsId: "story-3",
        images: [
          { file: "https://picsum.photos/seed/opensource99/1920/1080", source: "fallback", credit: null },
          { file: "https://picsum.photos/seed/llmcode26/1920/1080", source: "fallback", credit: null },
        ],
      },
      {
        newsId: "story-4",
        images: [
          { file: "https://picsum.photos/seed/euaiact/1920/1080", source: "fallback", credit: null },
          { file: "https://picsum.photos/seed/regulation26/1920/1080", source: "fallback", credit: null },
        ],
      },
      {
        newsId: "story-5",
        images: [
          { file: "https://picsum.photos/seed/agentbench/1920/1080", source: "fallback", credit: null },
          { file: "https://picsum.photos/seed/stanford26/1920/1080", source: "fallback", credit: null },
        ],
      },
    ],
  },

  timeline,
  totalFrames,
};
