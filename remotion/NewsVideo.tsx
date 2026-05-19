import React from "react";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import type { VideoInputProps } from "./types";
import { Intro } from "./components/Intro";
import { Overview } from "./components/Overview";
import { NewsSegmentScene } from "./components/NewsSegmentScene";
import { ProgressBar } from "./components/ProgressBar";
import { Captions } from "./components/Captions";
import { Outro } from "./components/Outro";

export const NewsVideo: React.FC<VideoInputProps> = ({
  script,
  ttsManifest,
  assets,
  timeline,
  totalFrames,
}) => {
  // Segment layout:
  //   ttsManifest.segments[0]      = intro narration
  //   ttsManifest.segments[1..5]   = story segments
  //   ttsManifest.segments[last]   = outro
  const introTts = ttsManifest.segments[0];
  const storyTts = ttsManifest.segments.slice(1, ttsManifest.segments.length - 1);
  const outroTts = ttsManifest.segments[ttsManifest.segments.length - 1];

  // timeline[0] = intro, timeline[1..n-1] = stories, timeline[n] = outro
  const introTimeline = timeline[0];
  const storiesStart = timeline[1]?.from ?? introTimeline.from + introTimeline.durationInFrames;
  const outroTimeline = timeline[timeline.length - 1];

  return (
    <>
      <AbsoluteFill style={{ background: "#0a0a0f" }} />

      {/* 1. Fixed intro animation: frames 0–149 */}
      <Sequence from={0} durationInFrames={150}>
        <Intro date={script.date} />
      </Sequence>

      {/* 2. Overview narration */}
      <Sequence from={introTimeline.from} durationInFrames={introTimeline.durationInFrames}>
        {introTts.audioFile ? <Audio src={introTts.audioFile} /> : null}
        <Overview intro={script.intro} />
        <Captions segment={introTts} />
      </Sequence>

      {/* 3. Story segments with fade transitions */}
      <Sequence from={storiesStart}>
        <TransitionSeries>
          {script.segments.map((seg, i) => {
            const tts = storyTts[i];
            const segAssets = assets.segments[i];
            if (!tts || !segAssets) return null;
            return (
              <React.Fragment key={seg.newsId}>
                <TransitionSeries.Sequence durationInFrames={tts.durationFrames}>
                  {tts.audioFile ? <Audio src={tts.audioFile} /> : null}
                  <NewsSegmentScene segment={seg} assets={segAssets} tts={tts} />
                  <Captions segment={tts} />
                </TransitionSeries.Sequence>
                {i < script.segments.length - 1 && (
                  <TransitionSeries.Transition
                    timing={linearTiming({ durationInFrames: 15 })}
                    presentation={fade()}
                  />
                )}
              </React.Fragment>
            );
          })}
        </TransitionSeries>
      </Sequence>

      {/* 4. Outro */}
      <Sequence from={outroTimeline.from} durationInFrames={180}>
        {outroTts.audioFile ? <Audio src={outroTts.audioFile} /> : null}
        <Outro />
      </Sequence>

      {/* 5. Progress bar overlay — always on top */}
      <ProgressBar timeline={timeline} totalFrames={totalFrames} />
    </>
  );
};
