import React from "react";
import {
  AbsoluteFill, Audio, Sequence,
  useCurrentFrame, interpolate, staticFile,
} from "remotion";
import type { VideoInputProps } from "./types";
import { Intro } from "./components/Intro";
import { Overview } from "./components/Overview";
import { NewsSegmentScene } from "./components/NewsSegmentScene";
import { MascotSystem } from "./components/MascotSystem";
import { Captions } from "./components/Captions";
import { Outro } from "./components/Outro";

const FADE_FRAMES = 15; // fade in/out on each story segment

/** Wraps children with opacity fade-in at start and fade-out at end. */
const FadeInOut: React.FC<{
  durationInFrames: number;
  children: React.ReactNode;
}> = ({ durationInFrames, children }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, FADE_FRAMES, durationInFrames - FADE_FRAMES, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

export const NewsVideo: React.FC<VideoInputProps> = ({
  script,
  ttsManifest,
  assets,
  timeline,
  totalFrames,
}) => {
  const introTts   = ttsManifest.segments[0];
  const storyTts   = ttsManifest.segments.slice(1, ttsManifest.segments.length - 1);
  const outroTts   = ttsManifest.segments[ttsManifest.segments.length - 1];

  const introTimeline = timeline[0];
  const outroTimeline = timeline[timeline.length - 1];

  const bgmSrc = staticFile("bgm.wav");

  return (
    <>
      <AbsoluteFill style={{ background: "linear-gradient(160deg, #fff8ed 0%, #ffefd4 100%)" }} />

      {/* ── Background music — full video, low volume ─────── */}
      <Audio src={bgmSrc} volume={0.18} />

      {/* ── Intro animation (5 s) ─────────────────────────── */}
      <Sequence from={0} durationInFrames={150}>
        <Intro date={script.date} mascotMode />
      </Sequence>

      {/* ── Intro narration + overview card ───────────────── */}
      <Sequence from={introTimeline.from} durationInFrames={introTimeline.durationInFrames}>
        {introTts.audioFile ? <Audio src={introTts.audioFile} /> : null}
        <Overview intro={script.intro} />
        <Captions segment={introTts} />
      </Sequence>

      {/* ── Story segments: audio + captions + visuals ────── */}
      {storyTts.map((tts, i) => {
        const entry     = timeline[i + 1]; // timeline[0]=intro, [1..3]=stories
        const segAssets = assets.segments[i];
        if (!tts?.audioFile || !entry || !segAssets) return null;
        return (
          <React.Fragment key={tts.id}>
            {/* Audio + captions — pinned to exact timeline slot */}
            <Sequence from={entry.from} durationInFrames={entry.durationInFrames}>
              <Audio src={tts.audioFile} />
              <Captions segment={tts} />
            </Sequence>

            {/* Visuals — same slot, with fade in/out */}
            <Sequence from={entry.from} durationInFrames={entry.durationInFrames}>
              <FadeInOut durationInFrames={entry.durationInFrames}>
                <NewsSegmentScene
                  segment={script.segments[i]}
                  assets={segAssets}
                  tts={tts}
                  storyIndex={i}
                  totalStories={script.segments.length}
                />
              </FadeInOut>
            </Sequence>
          </React.Fragment>
        );
      })}

      {/* ── Outro ─────────────────────────────────────────── */}
      <Sequence from={outroTimeline.from} durationInFrames={180}>
        {outroTts.audioFile ? <Audio src={outroTts.audioFile} /> : null}
        <Outro />
      </Sequence>

      {/* ── Mascot + progress bar ─────────────────────────── */}
      <MascotSystem
        timeline={timeline}
        totalFrames={totalFrames}
        introEnd={150}
        outroStart={outroTimeline.from}
        introTitle="AI News Daily"
        introDate={script.date}
      />
    </>
  );
};
