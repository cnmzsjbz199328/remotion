import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { TimelineEntry } from "../types";

interface ProgressBarProps {
  timeline: TimelineEntry[];
  totalFrames: number;
}

const truncate = (s: string, n: number) =>
  s.length > n ? s.slice(0, n - 1) + "…" : s;

export const ProgressBar: React.FC<ProgressBarProps> = ({ timeline, totalFrames }) => {
  const frame = useCurrentFrame();
  const globalProgress = frame / totalFrames;

  return (
    <AbsoluteFill style={{ top: "auto", bottom: 0, height: 40 }}>
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "rgba(0,0,0,0.72)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
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
                borderRight: "1px solid rgba(255,255,255,0.08)",
                overflow: "hidden",
              }}
            >
              {/* Playback fill */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  right: `${(1 - fill) * 100}%`,
                  background: isActive
                    ? "#3b82f6"
                    : isPast
                    ? "rgba(255,255,255,0.18)"
                    : "transparent",
                }}
              />
              {/* Chapter label */}
              <div
                style={{
                  position: "absolute",
                  left: 7,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 10,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#fff" : "rgba(255,255,255,0.42)",
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
