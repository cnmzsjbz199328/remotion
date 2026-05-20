import React from "react";
import { AbsoluteFill, Composition } from "remotion";
import {
  loadFont as loadInter,
  fontFamily as interFamily,
} from "@remotion/google-fonts/Inter";
import {
  loadFont as loadNotoSC,
  fontFamily as notoSCFamily,
} from "@remotion/google-fonts/NotoSansSC";
import { NewsVideo } from "./NewsVideo";
import { staticProps } from "./test-data";
import type { VideoInputProps } from "./types";

// Load Inter for Latin glyphs and Noto Sans SC for CJK glyphs.
// Inter has no Chinese characters, so without Noto Sans SC the renderer falls back
// to a Windows system font with poor headless-Chrome hinting → visible aliasing.
loadInter("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});
loadNotoSC("normal", {
  // CJK fonts are ~500KB–1MB per weight; load only the ones actually used.
  weights: ["400", "500", "700", "900"],
  subsets: ["chinese-simplified"],
});

// Browser picks per-character: Latin runs through Inter; CJK falls through to Noto Sans SC.
const FONT_STACK = `${interFamily}, ${notoSCFamily}, sans-serif`;

type AnyProps = Record<string, unknown>;

const makeComposition = (
  id: string,
  component: React.ComponentType<AnyProps>
) => {
  const Wrapped: React.FC<AnyProps> = (props) => (
    <AbsoluteFill
      style={{
        fontFamily: FONT_STACK,
        // Force grayscale anti-aliasing — headless Chrome on Windows otherwise uses
        // subpixel rendering tuned for LCD panels, which looks jagged when rasterized
        // to video frames.
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        textRendering: "geometricPrecision",
      }}
    >
      {React.createElement(component, props)}
    </AbsoluteFill>
  );
  Wrapped.displayName = `WithFont(${id})`;

  return (
  <Composition
    id={id}
    component={Wrapped}
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
};

export const RemotionRoot: React.FC = () => {
  return makeComposition("NewsVideo", NewsVideo as unknown as React.ComponentType<AnyProps>);
};
