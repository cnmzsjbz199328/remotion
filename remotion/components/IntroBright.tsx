import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

interface IntroProps {
  date: string;
  mascotMode?: boolean; // when true, MascotSystem owns the title — only render background
}

const formatDate = (date: string): string => {
  if (date === "test") return "May 19, 2026";
  try {
    return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return date;
  }
};

export const IntroBright: React.FC<IntroProps> = ({ date, mascotMode = false }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 30, 110, 150], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [10, 40], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subtitleOpacity = interpolate(frame, [25, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(160deg, #fff8ed 0%, #ffefd4 50%, #fff8ed 100%)",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        opacity,
      }}
    >
      {!mascotMode && (
        <>
          <div
            style={{
              color: "#c2660a",
              fontSize: 16,
              letterSpacing: 8,
              marginBottom: 24,
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            AI News Daily
          </div>
          <div
            style={{
              color: "#1e293b",
              fontSize: 60,
              fontWeight: 700,
              transform: `translateY(${titleY}px)`,
            }}
          >
            {formatDate(date)}
          </div>
        </>
      )}
      <div
        style={{
          color: "#92400e",
          fontSize: 20,
          marginTop: mascotMode ? 0 : 20,
          opacity: subtitleOpacity,
          letterSpacing: 1,
        }}
      >
        Your daily AI intelligence briefing
      </div>
    </AbsoluteFill>
  );
};
