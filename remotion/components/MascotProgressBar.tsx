import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Lottie } from "@remotion/lottie";
import type { LottieAnimationData } from "@remotion/lottie";
import type { TimelineEntry } from "../types";
import horseWalkData from "../assets/horse-walk.json";

interface MascotProgressBarProps {
  timeline: TimelineEntry[];
  totalFrames: number;
}

const truncate = (s: string, n: number) =>
  s.length > n ? s.slice(0, n - 1) + "…" : s;

const BAR_H = 40;
const MASCOT_W = 80;
const MASCOT_H = 80;

export const MascotProgressBar: React.FC<MascotProgressBarProps> = ({
  timeline,
  totalFrames,
}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const globalProgress = frame / totalFrames;

  const mascotLeft = Math.max(
    0,
    Math.min(width - MASCOT_W, globalProgress * width - MASCOT_W / 2)
  );

  return (
    <AbsoluteFill style={{ top: "auto", bottom: 0, height: BAR_H + MASCOT_H }}>

      {/* Walking mascot — rides along the bar top */}
      <div
        style={{
          position: "absolute",
          bottom: BAR_H - 8,
          left: mascotLeft,
          width: MASCOT_W,
          height: MASCOT_H,
          zIndex: 2,
          filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.18))",
        }}
      >
        <Lottie animationData={horseWalkData as LottieAnimationData} loop />
      </div>

      {/* Progress bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: BAR_H,
          display: "flex",
          background: "rgba(255, 248, 237, 0.94)",
          borderTop: "1px solid rgba(200, 150, 60, 0.22)",
        }}
      >
        {timeline.map((t) => {
          const segStart = t.from / totalFrames;
          const segWidth = t.durationInFrames / totalFrames;
          const isActive =
            globalProgress >= segStart && globalProgress < segStart + segWidth;
          const isPast = globalProgress >= segStart + segWidth;
          const fill = isActive
            ? Math.min(1, (globalProgress - segStart) / segWidth)
            : isPast
            ? 1
            : 0;

          return (
            <div
              key={t.id}
              style={{
                flex: t.durationInFrames,
                position: "relative",
                borderRight: "1px solid rgba(200, 150, 60, 0.15)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  right: `${(1 - fill) * 100}%`,
                  background: isActive
                    ? "rgba(217, 119, 6, 0.26)"
                    : isPast
                    ? "rgba(217, 119, 6, 0.11)"
                    : "transparent",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 7,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 10,
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? "#92400e" : "rgba(146, 64, 14, 0.48)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  maxWidth: "calc(100% - 10px)",
                  zIndex: 1,
                  letterSpacing: 0.3,
                }}
              >
                {truncate(t.progressLabel, 16)}
              </div>
            </div>
          );
        })}
      </div>

    </AbsoluteFill>
  );
};
