import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { TtsSegment } from "../types";

interface CaptionsProps {
  segment: TtsSegment;
}

export const Captions: React.FC<CaptionsProps> = ({ segment }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!segment.captions || segment.captions.length === 0) return null;

  const currentMs = (frame / fps) * 1000;
  const current = segment.captions.find(
    (c) => currentMs >= c.startMs && currentMs < c.endMs
  );

  if (!current) return null;

  return (
    <AbsoluteFill
      style={{
        alignItems: "flex-end",
        justifyContent: "center",
        paddingBottom: 58,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          background: "rgba(0,0,0,0.72)",
          borderRadius: 6,
          padding: "10px 28px",
          maxWidth: "76%",
          textAlign: "center",
          fontSize: 28,
          color: "#fff",
          lineHeight: 1.45,
        }}
      >
        {current.text}
      </div>
    </AbsoluteFill>
  );
};
