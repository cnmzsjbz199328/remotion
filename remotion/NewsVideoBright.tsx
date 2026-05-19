import React from "react";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import type { VideoInputProps } from "./types";
// IntroBright kept for background/structure; title is now animated by MascotSystem
import { IntroBright } from "./components/IntroBright";
import { OverviewBright } from "./components/OverviewBright";
import { NewsSegmentSceneBright } from "./components/NewsSegmentSceneBright";
import { MascotSystem } from "./components/MascotSystem";
import { Captions } from "./components/Captions";
import { OutroBright } from "./components/OutroBright";

export const NewsVideoBright: React.FC<VideoInputProps> = ({
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
      <AbsoluteFill style={{ background: "linear-gradient(160deg, #fff8ed 0%, #ffefd4 100%)" }} />

      <Sequence from={0} durationInFrames={150}>
        <IntroBright date={script.date} mascotMode />
      </Sequence>

      <Sequence from={introTimeline.from} durationInFrames={introTimeline.durationInFrames}>
        {introTts.audioFile ? <Audio src={introTts.audioFile} /> : null}
        <OverviewBright intro={script.intro} />
        <Captions segment={introTts} />
      </Sequence>

      {/* Audio + captions: positioned by timeline (frame-accurate, no overlap) */}
      {storyTts.map((tts, i) => {
        const entry = timeline[i + 1];
        if (!tts?.audioFile || !entry) return null;
        return (
          <Sequence key={tts.id} from={entry.from} durationInFrames={tts.durationFrames}>
            <Audio src={tts.audioFile} />
            <Captions segment={tts} />
          </Sequence>
        );
      })}

      {/* Visuals: TransitionSeries handles fade-only, no audio */}
      <Sequence from={storiesStart}>
        <TransitionSeries>
          {script.segments.map((seg, i) => {
            const tts = storyTts[i];
            const segAssets = assets.segments[i];
            if (!tts || !segAssets) return null;
            return (
              <React.Fragment key={seg.newsId}>
                <TransitionSeries.Sequence durationInFrames={tts.durationFrames}>
                  <NewsSegmentSceneBright
                    segment={seg}
                    assets={segAssets}
                    tts={tts}
                    storyIndex={i}
                    totalStories={script.segments.length}
                  />
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
        <OutroBright />
      </Sequence>

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
