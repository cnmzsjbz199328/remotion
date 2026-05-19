import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { NewsSegment, SegmentAssets, TtsSegment } from "../types";

// Switch between "split" (text panel left, image right) and "overlay" (text over fullscreen image)
const LAYOUT: "split" | "overlay" = "split";

interface NewsSegmentSceneProps {
  segment: NewsSegment;
  assets: SegmentAssets;
  tts: TtsSegment;
}

export const NewsSegmentScene: React.FC<NewsSegmentSceneProps> = ({ segment, assets }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const hasImage = assets.images.length > 0;
  const imageIndex = hasImage ? Math.floor(frame / 150) % assets.images.length : 0;
  const currentImage = hasImage ? assets.images[imageIndex] : null;

  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.08]);

  const tagOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleOpacity = interpolate(frame, [8, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleX = interpolate(frame, [8, 28], [-24, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Key points staggered: 0→frame15, 1→frame28, 2→frame41
  const kpOpacity = [15, 28, 41].map(d => interpolate(frame, [d, d + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const kpX = [15, 28, 41].map(d => interpolate(frame, [d, d + 14], [18, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  // Transition line appears near the end of the segment
  const transitionOpacity = interpolate(
    frame,
    [durationInFrames - 55, durationInFrames - 25],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const imageEl = currentImage ? (
    <Img
      src={currentImage.file}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        transform: `scale(${scale})`,
        transformOrigin: "center center",
      }}
    />
  ) : null;

  const textContent = (
    <>
      {/* Category badge */}
      <div style={{
        opacity: tagOpacity,
        background: "rgba(59,130,246,0.92)",
        color: "#fff",
        padding: "5px 14px",
        borderRadius: 3,
        fontSize: 11,
        letterSpacing: 3,
        textTransform: "uppercase" as const,
        fontWeight: 700,
        width: "fit-content",
        marginBottom: 28,
      }}>
        {segment.category ?? "AI News"}
      </div>

      {/* Headline */}
      <h2 style={{
        color: "#f1f5f9",
        fontSize: LAYOUT === "split" ? (hasImage ? 38 : 50) : 44,
        fontWeight: 700,
        lineHeight: 1.22,
        margin: "0 0 36px 0",
        opacity: titleOpacity,
        transform: `translateX(${titleX}px)`,
        textShadow: LAYOUT === "overlay" ? "0 2px 16px rgba(0,0,0,0.9)" : "none",
      }}>
        {segment.progressLabel}
      </h2>

      {/* Key points */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {(segment.keyPoints ?? []).slice(0, 3).map((point, i) => (
          <div key={i} style={{
            display: "flex",
            alignItems: "flex-start",
            opacity: kpOpacity[i],
            transform: `translateX(${kpX[i]}px)`,
          }}>
            <div style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#3b82f6",
              marginTop: 9,
              marginRight: 16,
              flexShrink: 0,
            }} />
            <div style={{
              color: LAYOUT === "overlay" ? "#e2e8f0" : "#cbd5e1",
              fontSize: 21,
              lineHeight: 1.5,
              textShadow: LAYOUT === "overlay" ? "0 1px 8px rgba(0,0,0,0.8)" : "none",
            }}>
              {point}
            </div>
          </div>
        ))}
      </div>

      {/* Transition line — appears near segment end, acts as a bridge to next story */}
      <div style={{
        marginTop: 40,
        color: LAYOUT === "overlay" ? "rgba(148,163,184,0.9)" : "#64748b",
        fontSize: 15,
        fontStyle: "italic",
        opacity: transitionOpacity,
        borderLeft: "3px solid rgba(59,130,246,0.5)",
        paddingLeft: 14,
        textShadow: LAYOUT === "overlay" ? "0 1px 6px rgba(0,0,0,0.8)" : "none",
      }}>
        {segment.transitionLine}
      </div>
    </>
  );

  if (LAYOUT === "split") {
    const textWidth = hasImage ? "56%" : "100%";
    return (
      <AbsoluteFill style={{ flexDirection: "row", background: "#0f172a" }}>
        {/* Text panel */}
        <div style={{
          width: textWidth,
          height: "100%",
          background: "linear-gradient(140deg, #0f172a 0%, #1e293b 100%)",
          padding: "64px 56px 64px 72px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          boxSizing: "border-box",
          position: "relative",
          zIndex: 2,
        }}>
          {textContent}
        </div>

        {/* Image panel — omitted when no image, text panel auto-expands to full width */}
        {hasImage && imageEl && (
          <div style={{ width: "44%", height: "100%", overflow: "hidden", position: "relative" }}>
            {imageEl}
            {/* Left-edge blend into text panel */}
            <div style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to right, rgba(15,23,42,0.65) 0%, transparent 40%)",
            }} />
          </div>
        )}
      </AbsoluteFill>
    );
  }

  // LAYOUT === "overlay": text over fullscreen image
  return (
    <AbsoluteFill style={{ background: "#0f172a" }}>
      {hasImage && imageEl && (
        <AbsoluteFill style={{ overflow: "hidden" }}>{imageEl}</AbsoluteFill>
      )}
      <AbsoluteFill style={{
        background: hasImage
          ? "linear-gradient(to right, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.15) 100%)"
          : "linear-gradient(140deg, #0f172a 0%, #1e293b 100%)",
      }} />
      <AbsoluteFill style={{
        padding: "64px 72px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        maxWidth: hasImage ? "60%" : "80%",
        boxSizing: "border-box",
      }}>
        {textContent}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
