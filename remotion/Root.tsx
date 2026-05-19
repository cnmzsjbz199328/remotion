import React from "react";
import { Composition } from "remotion";
import { NewsVideo } from "./NewsVideo";
import { NewsVideoBright } from "./NewsVideoBright";
import { NewsVideoVibe } from "./NewsVideoVibe";
import { staticProps } from "./test-data";
import type { VideoInputProps } from "./types";

type AnyProps = Record<string, unknown>;

const makeComposition = (
  id: string,
  component: React.ComponentType<AnyProps>
) => (
  <Composition
    id={id}
    component={component}
    fps={30}
    width={1920}
    height={1080}
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

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Dark broadcast style — original */}
      {makeComposition("NewsVideo", NewsVideo as unknown as React.ComponentType<AnyProps>)}

      {/* Light card style — white bg, colored cards */}
      {makeComposition("NewsVideo-Bright", NewsVideoBright as unknown as React.ComponentType<AnyProps>)}

      {/* Vivid gradient style — glassmorphism cards, bouncy */}
      {makeComposition("NewsVideo-Vibe", NewsVideoVibe as unknown as React.ComponentType<AnyProps>)}
    </>
  );
};
