import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

export const OutroBright: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 24, 150, 180], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [0, 24], [0.95, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const btnOpacity = interpolate(frame, [30, 55], [0, 1], {
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
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          color: "#1e293b",
          fontSize: 52,
          fontWeight: 700,
          marginBottom: 18,
          textAlign: "center",
        }}
      >
        Thanks for watching
      </div>
      <div
        style={{
          color: "#92400e",
          fontSize: 22,
          marginBottom: 48,
          letterSpacing: 0.5,
        }}
      >
        Stay current — subscribe for daily AI news
      </div>
      <div
        style={{
          background: "#d97706",
          color: "#fff",
          padding: "16px 48px",
          borderRadius: 50,
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: 1,
          opacity: btnOpacity,
        }}
      >
        Subscribe
      </div>
    </AbsoluteFill>
  );
};
