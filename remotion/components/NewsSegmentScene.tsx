import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { NewsSegment, SegmentAssets, TtsSegment } from "../types";

// Light card palette — one tint per story
const THEMES = [
  { accent: "#ef4444" },
  { accent: "#10b981" },
  { accent: "#f59e0b" },
  { accent: "#8b5cf6" },
  { accent: "#3b82f6" },
];

// Split-layout constants (px, for 1920-wide canvas)
const IMG_PANEL_W  = 820;  // left photo panel width
const CONTENT_LEFT_SPLIT = 900;  // content area left edge when image present

// ── Letterboxed image with blurred backdrop ──────────────────────────────────
// Avoids cropping tall/portrait sources (e.g. tweet screenshots). The foreground
// image uses `contain` so nothing is cut; the panel is filled by a blurred,
// scaled copy of the same image acting as a contextual backdrop.
const Letterbox: React.FC<{ src: string }> = ({ src }) => (
  <div style={{ position: "absolute", inset: 0 }}>
    <Img
      src={src}
      style={{
        position: "absolute", inset: 0,
        width: "100%", height: "100%",
        objectFit: "cover",
        filter: "blur(28px) brightness(0.78) saturate(0.9)",
        transform: "scale(1.12)",
      }}
    />
    <Img
      src={src}
      style={{
        position: "absolute", inset: 0,
        width: "100%", height: "100%",
        objectFit: "contain",
      }}
    />
  </div>
);

export interface NewsSegmentSceneProps {
  segment: NewsSegment;
  assets: SegmentAssets;
  tts: TtsSegment;
  storyIndex: number;
  totalStories?: number;
}

export const NewsSegmentScene: React.FC<NewsSegmentSceneProps> = ({
  segment,
  assets,
  storyIndex,
}) => {
  const images = assets?.images ?? [];
  const hasImage = images.length > 0;
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const theme = THEMES[storyIndex % THEMES.length];

  const sp = (delay: number, cfg?: { damping: number; stiffness: number; mass?: number }) =>
    spring({
      frame: Math.max(0, frame - delay),
      fps,
      config: cfg ?? { damping: 13, stiffness: 380, mass: 0.65 },
    });

  // ── Image panel animations ──────────────────────────────────────────────────
  const imgSlide = sp(0, { damping: 22, stiffness: 140, mass: 1.3 });
  const imgPanelX = interpolate(imgSlide, [0, 1], [-IMG_PANEL_W, 0]);

  const panProgress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // ── Text + UI animations ────────────────────────────────────────────────────
  const topBarWidth = interpolate(
    spring({ frame, fps, config: { damping: 22, stiffness: 180, mass: 1.4 } }),
    [0, 1], [0, 100],
  );

  const transitionOpacity = interpolate(
    frame,
    [durationInFrames - 52, durationInFrames - 22],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const words = segment.progressLabel.split(" ");
  const wordSprings = words.map((_, wi) =>
    sp(8 + wi * 3, { damping: 10, stiffness: 440, mass: 0.5 }),
  );
  const kpSprings = (segment.keyPoints ?? []).slice(0, 3).map((_, i) =>
    sp(28 + i * 14, { damping: 15, stiffness: 300, mass: 0.75 }),
  );

  // Content area left edge shifts right when image is present
  const contentLeft = hasImage ? CONTENT_LEFT_SPLIT : 80;

  // Multi-image carousel: split panProgress into N equal slots, slide the next
  // image up from the bottom in the last ~15% of each slot to partially cover
  // the current image. Single-image case degrades gracefully.
  const nImages = images.length;
  const slotFloat = panProgress * Math.max(1, nImages);
  const slotIdx = Math.min(Math.max(0, nImages - 1), Math.floor(slotFloat));
  const slotLocal = slotFloat - slotIdx;
  const SLIDE_START = 0.85;
  const isLastSlot = slotIdx >= nImages - 1;
  const inSlide = !isLastSlot && slotLocal > SLIDE_START;
  const nextTranslateYPct = inSlide
    ? interpolate(slotLocal, [SLIDE_START, 1], [100, 0])
    : 100;

  return (
    <AbsoluteFill style={{ background: "linear-gradient(160deg, #fff8ed 0%, #ffefd4 100%)" }}>

      {/* ── Left photo panel — slides in from the left, supports multi-image ─ */}
      {hasImage && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: IMG_PANEL_W,
            height: "100%",
            overflow: "hidden",
            transform: `translateX(${imgPanelX}px)`,
          }}
        >
          {/* Current image — stays in place */}
          <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
            <Letterbox src={images[slotIdx].file} />
          </div>
          {/* Next image — slides up from the bottom in the transition window */}
          {!isLastSlot && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 2,
                transform: `translateY(${nextTranslateYPct}%)`,
              }}
            >
              <Letterbox src={images[slotIdx + 1].file} />
            </div>
          )}
          {/* Gradient fade on the right edge: blends photo into background */}
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 140,
              height: "100%",
              background: "linear-gradient(to right, transparent, #fff8ed)",
            }}
          />
          {/* Thin vertical accent bar on the right edge */}
          <div
            style={{
              position: "absolute",
              top: "8%",
              right: 0,
              width: 4,
              height: "84%",
              background: theme.accent,
              borderRadius: 2,
              opacity: interpolate(imgSlide, [0, 1], [0, 0.7]),
            }}
          />
        </div>
      )}

      {/* ── Top accent stripe (spans full width) ─────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: `${topBarWidth}%`,
          height: 6,
          background: theme.accent,
        }}
      />

      {/* ── Main content area (right side in split mode) ──────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 140,
          left: contentLeft,
          right: 80,
          bottom: 80,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
        }}
      >
        {/* Headline — words drop in from above */}
        <div style={{ marginBottom: 42, marginTop: 22 }}>
          <h2
            style={{
              color: "#0f172a",
              fontSize: hasImage ? 52 : 60,
              fontWeight: 800,
              lineHeight: 1.18,
              margin: 0,
              letterSpacing: -1,
            }}
          >
            {words.map((word, wi) => {
              const s = wordSprings[wi];
              return (
                <span
                  key={wi}
                  style={{
                    display: "inline-block",
                    marginRight: "0.26em",
                    opacity: s,
                    transform: `translateY(${interpolate(s, [0, 1], [-28, 0])}px)`,
                  }}
                >
                  {word}
                </span>
              );
            })}
          </h2>
        </div>

        {/* Key point cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {(segment.keyPoints ?? []).slice(0, 3).map((kp, i) => {
            const s = kpSprings[i];
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "rgba(255, 255, 255, 0.62)",
                  backdropFilter: "blur(16px)",
                  borderRadius: 14,
                  padding: "16px 22px",
                  border: "1px solid rgba(255, 255, 255, 0.88)",
                  boxShadow: "0 4px 28px rgba(180, 120, 40, 0.09)",
                  opacity: s,
                  transform: `translateX(${interpolate(s, [0, 1], [36, 0])}px)`,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: theme.accent,
                    marginRight: 16,
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: "#334155", fontSize: 23, lineHeight: 1.5, fontWeight: 500 }}>{kp}</span>
              </div>
            );
          })}
        </div>

        {/* Transition line */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            opacity: transitionOpacity,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ color: theme.accent, fontSize: 20, fontWeight: 700 }}>›</span>
          <span style={{ color: "#64748b", fontSize: 15, fontStyle: "italic", lineHeight: 1.4 }}>
            {segment.transitionLine}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
