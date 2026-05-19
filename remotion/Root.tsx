import React from "react";
import { Composition } from "remotion";
import { NewsVideo } from "./NewsVideo";
import { staticProps } from "./test-data";
import type { VideoInputProps } from "./types";

type AnyProps = Record<string, unknown>;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="NewsVideo"
      component={NewsVideo as unknown as React.ComponentType<AnyProps>}
      fps={30}
      width={1920}
      height={1080}
      // calculateMetadata makes the video duration dynamic —
      // it reads totalFrames from inputProps so render length tracks TTS audio.
      calculateMetadata={({ props }) => {
        const p = props as unknown as VideoInputProps;
        return {
          durationInFrames: p.totalFrames,
          fps: p.fps,
          width: p.width,
          height: p.height,
        };
      }}
      defaultProps={staticProps as unknown as AnyProps}
    />
  );
};
