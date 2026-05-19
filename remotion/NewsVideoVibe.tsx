import React from "react";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import type { VideoInputProps } from "./types";
import { Intro } from "./components/Intro";
import { Overview } from "./components/Overview";
import { NewsSegmentSceneVibe } from "./components/NewsSegmentSceneVibe";
import { ProgressBar } from "./components/ProgressBar";
import { Captions } from "./components/Captions";
import { Outro } from "./components/Outro";

export const NewsVideoVibe: React.FC<VideoInputProps> = ({
  script,
  ttsManifest,
  assets,
  timeline,
  totalFrames,
}) => {
  const introTts = ttsManifest.segments[0];
  const storyTts = ttsManifest.segments.slice(1, ttsManifest.segments.length - 1);
  const outroTts = ttsManifest.segments[ttsManifest.segments.length - 1];

  const introTimeline = timeline[0];
  const storiesStart = timeline[1]?.from ?? introTimeline.from + introTimeline.durationInFrames;
  const outroTimeline = timeline[timeline.length - 1];

  return (
    <>
      <AbsoluteFill style={{ background: "#667eea" }} />

      <Sequence from={0} durationInFrames={150}>
        <Intro date={script.date} />
      </Sequence>

      <Sequence from={introTimeline.from} durationInFrames={introTimeline.durationInFrames}>
        {introTts.audioFile ? <Audio src={introTts.audioFile} /> : null}
        <Overview intro={script.intro} />
        <Captions segment={introTts} />
      </Sequence>

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
                  <NewsSegmentSceneVibe
                    segment={seg}
                    assets={segAssets}
                    tts={tts}
                    storyIndex={i}
                    totalStories={script.segments.length}
                  />
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

      <Sequence from={outroTimeline.from} durationInFrames={180}>
        {outroTts.audioFile ? <Audio src={outroTts.audioFile} /> : null}
        <Outro />
      </Sequence>

      <ProgressBar timeline={timeline} totalFrames={totalFrames} />
    </>
  );
};
