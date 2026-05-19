import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { NewsSegment, SegmentAssets, TtsSegment } from "../types";

// Light card palette — one tint per story
const THEMES = [
  { accent: "#ef4444", r: 239, g: 68,  b: 68  },
  { accent: "#10b981", r: 16,  g: 185, b: 129 },
  { accent: "#f59e0b", r: 245, g: 158, b: 11  },
  { accent: "#8b5cf6", r: 139, g: 92,  b: 246 },
  { accent: "#3b82f6", r: 59,  g: 130, b: 246 },
];

// Split-layout constants (px, for 1920-wide canvas)
const IMG_PANEL_W  = 820;  // left photo panel width
const CONTENT_LEFT_SPLIT = 900;  // content area left edge when image present

export interface NewsSegmentSceneBrightProps {
  segment: NewsSegment;
  assets: SegmentAssets;
  tts: TtsSegment;
  storyIndex: number;
  totalStories: number;
}

interface BigNum {
  display: string;
  numericValue: number;
  shouldCount: boolean;
  context: string;
  kpIndex: number;
}

function findBigNumber(keyPoints: string[]): BigNum | null {
  for (let i = 0; i < keyPoints.length; i++) {
    const kp = keyPoints[i];
    const m = kp.match(/(\$?)([\d,]+(?:\.\d+)?)(\s*[BMKbmk])?/);
    if (!m) continue;
    const raw = parseFloat(m[2].replace(/,/g, ""));
    const suffix = m[3] ? m[3].trim().charAt(0).toUpperCase() : "";
    if (raw < 100 && !suffix) continue;
    const display = `${m[1]}${m[2]}${suffix}`;
    const context = kp.replace(m[0], "").replace(/^[\s\-–—,]+/, "").trim();
    return { display, numericValue: raw, shouldCount: !suffix && raw <= 100_000, context, kpIndex: i };
  }
  return null;
}

export const NewsSegmentSceneBright: React.FC<NewsSegmentSceneBrightProps> = ({
  segment,
  assets,
  storyIndex,
  totalStories,
}) => {
  const heroImage = assets?.images?.[0] ?? null;
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const theme = THEMES[storyIndex % THEMES.length];
  const { r, g, b } = theme;

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
  const imgKbScale  = interpolate(panProgress, [0, 1], [1.08, 1.0]);
  const imgKbTransY = interpolate(panProgress, [0, 1], [0, -30]);

  // ── Text + UI animations ────────────────────────────────────────────────────
  const topBarWidth = interpolate(
    spring({ frame, fps, config: { damping: 22, stiffness: 180, mass: 1.4 } }),
    [0, 1], [0, 100],
  );

  const badgeOpacity = interpolate(frame, [5, 22], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const counterSp = sp(6, { damping: 14, stiffness: 320, mass: 0.7 });

  const transitionOpacity = interpolate(
    frame,
    [durationInFrames - 52, durationInFrames - 22],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const bigNum = findBigNumber(segment.keyPoints ?? []);
  const useBigNum = bigNum !== null;

  const words = segment.progressLabel.split(" ");
  const wordSprings = words.map((_, wi) =>
    sp(8 + wi * 3, { damping: 10, stiffness: 440, mass: 0.5 }),
  );
  const kpSprings = (segment.keyPoints ?? []).slice(0, 3).map((_, i) =>
    sp(28 + i * 14, { damping: 15, stiffness: 300, mass: 0.75 }),
  );

  const numSp     = useBigNum ? sp(8, { damping: 26, stiffness: 150, mass: 2.0 }) : 0;
  const numScale  = interpolate(numSp, [0, 1], [0.6, 1]);
  const numOpacity = interpolate(numSp, [0, 0.4], [0, 1]);

  const counted = useBigNum && bigNum!.shouldCount
    ? Math.round(
        interpolate(frame, [10, 68], [0, bigNum!.numericValue], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        }),
      )
    : 0;

  const numDisplayStr = useBigNum
    ? bigNum!.shouldCount
      ? (bigNum!.display.startsWith("$") ? "$" : "") + counted.toLocaleString()
      : bigNum!.display
    : "";

  const ctxSp = useBigNum ? sp(52, { damping: 16, stiffness: 220, mass: 0.85 }) : 0;
  const remainingKps = (segment.keyPoints ?? []).filter((_, i) => !useBigNum || i !== bigNum!.kpIndex);
  const remSprings = remainingKps.map((_, i) =>
    sp((useBigNum ? 66 : 28) + i * 12, { damping: 15, stiffness: 300, mass: 0.75 }),
  );

  // Content area left edge shifts right when image is present
  const contentLeft = heroImage ? CONTENT_LEFT_SPLIT : 80;

  return (
    <AbsoluteFill style={{ background: "linear-gradient(160deg, #fff8ed 0%, #ffefd4 100%)" }}>

      {/* ── Left photo panel — slides in from the left ───────────────────── */}
      {heroImage && (
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
          <Img
            src={heroImage.file}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${imgKbScale}) translateY(${imgKbTransY}px)`,
              transformOrigin: "center center",
            }}
          />
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

      {/* ── Watermark number — bottom-right, very subtle ─────────────────── */}
      <div
        style={{
          position: "absolute",
          right: -10,
          bottom: -40,
          fontSize: 340,
          fontWeight: 900,
          color: theme.accent,
          opacity: 0.055,
          lineHeight: 1,
          userSelect: "none",
          fontFeatureSettings: '"tnum"',
          pointerEvents: "none",
        }}
      >
        {String(storyIndex + 1).padStart(2, "0")}
      </div>

      {/* ── Category badge ────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 56,
          left: contentLeft,
          opacity: badgeOpacity,
          background: theme.accent,
          color: "#ffffff",
          padding: "6px 18px",
          borderRadius: 100,
          fontSize: 11,
          letterSpacing: 2.5,
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        {segment.category ?? "AI News"}
      </div>

      {/* ── Story counter (always top-right) ─────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 46,
          right: 72,
          opacity: counterSp,
          transform: `translateY(${interpolate(counterSp, [0, 1], [-14, 0])}px)`,
          display: "flex",
          alignItems: "baseline",
          gap: 5,
        }}
      >
        <span style={{ color: theme.accent, fontSize: 50, fontWeight: 900, lineHeight: 1, fontFeatureSettings: '"tnum"' }}>
          {String(storyIndex + 1).padStart(2, "0")}
        </span>
        <span style={{ color: "#94a3b8", fontSize: 19 }}>
          / {String(totalStories).padStart(2, "0")}
        </span>
      </div>

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
          justifyContent: useBigNum ? "center" : "flex-start",
        }}
      >
        {useBigNum ? (
          <>
            <div style={{ textAlign: "center", opacity: numOpacity, transform: `scale(${numScale})`, marginBottom: 8 }}>
              <span
                style={{
                  color: theme.accent,
                  fontSize: heroImage ? 128 : 164,
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: -3,
                  fontFeatureSettings: '"tnum"',
                  filter: `drop-shadow(0 0 32px rgba(${r},${g},${b},0.35))`,
                }}
              >
                {numDisplayStr}
              </span>
            </div>

            <div
              style={{
                textAlign: "center",
                color: "#475569",
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: 2.5,
                textTransform: "uppercase",
                marginBottom: 44,
                opacity: ctxSp as number,
                transform: `translateY(${interpolate(ctxSp as number, [0, 1], [14, 0])}px)`,
              }}
            >
              {bigNum!.context || segment.progressLabel}
            </div>

            {remainingKps.length > 0 && (
              <div
                style={{
                  alignSelf: "center",
                  width: `${interpolate(ctxSp as number, [0, 1], [0, 26])}%`,
                  height: 2,
                  background: theme.accent,
                  opacity: 0.28,
                  marginBottom: 28,
                  borderRadius: 1,
                }}
              />
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {remainingKps.map((kp, i) => {
                const s = remSprings[i];
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      background: "rgba(255, 255, 255, 0.62)",
                      backdropFilter: "blur(16px)",
                      borderRadius: 14,
                      padding: "14px 22px",
                      border: "1px solid rgba(255, 255, 255, 0.88)",
                      boxShadow: "0 4px 28px rgba(180, 120, 40, 0.09)",
                      opacity: s,
                      transform: `translateX(${interpolate(s, [0, 1], [28, 0])}px)`,
                    }}
                  >
                    <span style={{ color: "#334155", fontSize: 21, lineHeight: 1.5, fontWeight: 500 }}>{kp}</span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* Headline — words drop in from above */}
            <div style={{ marginBottom: 42, marginTop: 22 }}>
              <h2
                style={{
                  color: "#0f172a",
                  fontSize: heroImage ? 52 : 60,
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
          </>
        )}

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
