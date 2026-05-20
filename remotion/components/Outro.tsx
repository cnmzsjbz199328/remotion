import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

// Outro background. The MascotSystem owns the centered farewell title (revealed
// left→right as the horse walks across), so this component just paints the
// gradient backdrop and a discreet subscribe pill near the bottom.
export const Outro: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 24, 150, 180], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const btnOpacity = interpolate(frame, [60, 95], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(160deg, #fff8ed 0%, #ffefd4 50%, #fff8ed 100%)",
        alignItems: "center",
        justifyContent: "flex-end",
        flexDirection: "column",
        paddingBottom: 180,
        opacity,
      }}
    >
      <div
        style={{
          background: "#d97706",
          color: "#fff",
          padding: "14px 42px",
          borderRadius: 50,
          fontSize: 18,
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
