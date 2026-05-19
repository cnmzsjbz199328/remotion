import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { IntroScript } from "../types";

interface OverviewProps {
  intro: IntroScript;
}

export const Overview: React.FC<OverviewProps> = ({ intro }) => {
  const frame = useCurrentFrame();

  const headerOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)",
        padding: "80px 120px",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          color: "#60a5fa",
          fontSize: 13,
          letterSpacing: 5,
          marginBottom: 40,
          textTransform: "uppercase",
          opacity: headerOpacity,
          fontWeight: 600,
        }}
      >
        Today's Stories
      </div>

      {intro.overview.map((item, i) => {
        const delay = i * 12;
        const itemOpacity = interpolate(frame, [delay, delay + 20], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const itemX = interpolate(frame, [delay, delay + 20], [-28, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={item.newsId}
            style={{
              display: "flex",
              alignItems: "flex-start",
              marginBottom: 30,
              opacity: itemOpacity,
              transform: `translateX(${itemX}px)`,
            }}
          >
            <div
              style={{
                minWidth: 34,
                height: 34,
                background: "rgba(59,130,246,0.9)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
                marginRight: 22,
                marginTop: 3,
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>
            <div
              style={{
                color: "#e5e7eb",
                fontSize: 24,
                lineHeight: 1.4,
              }}
            >
              {item.oneLiner}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
