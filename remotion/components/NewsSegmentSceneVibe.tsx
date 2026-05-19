import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { NewsSegment, SegmentAssets, TtsSegment } from "../types";

// Vivid gradients — one per story, cycling
const GRADIENTS = [
  { bg: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", glow: "rgba(102,126,234,0.5)" },
  { bg: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", glow: "rgba(240,147,251,0.5)" },
  { bg: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", glow: "rgba(79,172,254,0.5)" },
  { bg: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)", glow: "rgba(67,233,123,0.5)" },
  { bg: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)", glow: "rgba(250,112,154,0.5)" },
];

export interface NewsSegmentSceneVibeProps {
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

export const NewsSegmentSceneVibe: React.FC<NewsSegmentSceneVibeProps> = ({
  segment,
  storyIndex,
  totalStories,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const theme = GRADIENTS[storyIndex % GRADIENTS.length];

  // Very bouncy springs — noticeable overshoot
  const sp = (delay: number, cfg?: { damping: number; stiffness: number; mass?: number }) =>
    spring({
      frame: Math.max(0, frame - delay),
      fps,
      config: cfg ?? { damping: 9, stiffness: 400, mass: 0.6 },
    });

  const badgeOpacity = interpolate(frame, [4, 18], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const counterSp = sp(5, { damping: 10, stiffness: 380, mass: 0.65 });

  const transitionOpacity = interpolate(
    frame,
    [durationInFrames - 52, durationInFrames - 22],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const bigNum = findBigNumber(segment.keyPoints ?? []);
  const useBigNum = bigNum !== null;

  const words = segment.progressLabel.split(" ");
  const wordSprings = words.map((_, wi) =>
    sp(6 + wi * 4, { damping: 8, stiffness: 420, mass: 0.55 })
  );
  const kpSprings = (segment.keyPoints ?? []).slice(0, 3).map((_, i) =>
    sp(24 + i * 16, { damping: 12, stiffness: 340, mass: 0.7 })
  );

  // Big-number layout
  const numSp = useBigNum ? sp(8, { damping: 22, stiffness: 160, mass: 1.8 }) : 0;
  const numScale = interpolate(numSp, [0, 1], [0.5, 1]);
  const numOpacity = interpolate(numSp, [0, 0.35], [0, 1]);

  const counted = useBigNum && bigNum!.shouldCount
    ? Math.round(
        interpolate(frame, [10, 70], [0, bigNum!.numericValue], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        })
      )
    : 0;

  const numDisplayStr = useBigNum
    ? bigNum!.shouldCount
      ? (bigNum!.display.startsWith("$") ? "$" : "") + counted.toLocaleString()
      : bigNum!.display
    : "";

  const ctxSp = useBigNum ? sp(52, { damping: 14, stiffness: 240, mass: 0.85 }) : 0;
  const remainingKps = (segment.keyPoints ?? []).filter((_, i) => !useBigNum || i !== bigNum!.kpIndex);
  const remSprings = remainingKps.map((_, i) =>
    sp((useBigNum ? 66 : 24) + i * 14, { damping: 12, stiffness: 340, mass: 0.7 })
  );

  return (
    <AbsoluteFill style={{ background: theme.bg }}>

      {/* Giant decorative story number — watermark in center-left area */}
      <div
        style={{
          position: "absolute",
          left: -40,
          bottom: -60,
          fontSize: 380,
          fontWeight: 900,
          color: "#ffffff",
          opacity: 0.08,
          lineHeight: 1,
          userSelect: "none",
          fontFeatureSettings: '"tnum"',
          pointerEvents: "none",
        }}
      >
        {String(storyIndex + 1).padStart(2, "0")}
      </div>

      {/* Subtle radial glow — center */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.12) 0%, transparent 65%)`,
          pointerEvents: "none",
        }}
      />

      {/* Category badge — white bg, colored text not possible without knowing exact gradient color;
          use white with 85% opacity bg and dark text */}
      <div
        style={{
          position: "absolute",
          top: 56,
          left: 64,
          opacity: badgeOpacity,
          background: "rgba(255,255,255,0.22)",
          border: "1px solid rgba(255,255,255,0.40)",
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

      {/* Story counter */}
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
        <span
          style={{
            color: "#ffffff",
            fontSize: 50,
            fontWeight: 900,
            lineHeight: 1,
            fontFeatureSettings: '"tnum"',
          }}
        >
          {String(storyIndex + 1).padStart(2, "0")}
        </span>
        <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 19 }}>
          / {String(totalStories).padStart(2, "0")}
        </span>
      </div>

      {/* Main content */}
      <div
        style={{
          position: "absolute",
          top: 140,
          left: 80,
          right: 80,
          bottom: 80,
          display: "flex",
          flexDirection: "column",
          justifyContent: useBigNum ? "center" : "flex-start",
        }}
      >
        {useBigNum ? (
          <>
            {/* Big number — white with glow */}
            <div style={{ textAlign: "center", opacity: numOpacity, transform: `scale(${numScale})`, marginBottom: 8 }}>
              <span
                style={{
                  color: "#ffffff",
                  fontSize: 168,
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: -3,
                  fontFeatureSettings: '"tnum"',
                  textShadow: `0 0 60px rgba(255,255,255,0.6), 0 0 120px ${theme.glow}`,
                }}
              >
                {numDisplayStr}
              </span>
            </div>

            {/* Context */}
            <div
              style={{
                textAlign: "center",
                color: "rgba(255,255,255,0.80)",
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
                  width: `${interpolate(ctxSp as number, [0, 1], [0, 28])}%`,
                  height: 1,
                  background: "rgba(255,255,255,0.35)",
                  marginBottom: 28,
                  borderRadius: 1,
                }}
              />
            )}

            {/* Remaining KPs — glassmorphism cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingLeft: 100, paddingRight: 100 }}>
              {remainingKps.map((kp, i) => {
                const s = remSprings[i];
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      background: "rgba(255,255,255,0.18)",
                      border: "1px solid rgba(255,255,255,0.28)",
                      borderRadius: 14,
                      padding: "14px 22px",
                      backdropFilter: "blur(12px)",
                      opacity: s,
                      transform: `translateY(${interpolate(s, [0, 1], [18, 0])}px)`,
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#ffffff",
                        opacity: 0.8,
                        marginRight: 14,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ color: "rgba(255,255,255,0.92)", fontSize: 21, lineHeight: 1.5, fontWeight: 500 }}>
                      {kp}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* Headline — words bounce up from below */}
            <div style={{ marginBottom: 40, marginTop: 20 }}>
              <h2
                style={{
                  color: "#ffffff",
                  fontSize: 62,
                  fontWeight: 800,
                  lineHeight: 1.18,
                  margin: 0,
                  letterSpacing: -1,
                  textShadow: "0 2px 20px rgba(0,0,0,0.2)",
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
                        transform: `translateY(${interpolate(s, [0, 1], [36, 0])}px)`,
                      }}
                    >
                      {word}
                    </span>
                  );
                })}
              </h2>
            </div>

            {/* Key points — glassmorphism cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {(segment.keyPoints ?? []).slice(0, 3).map((kp, i) => {
                const s = kpSprings[i];
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      background: "rgba(255,255,255,0.18)",
                      border: "1px solid rgba(255,255,255,0.28)",
                      borderRadius: 14,
                      padding: "16px 22px",
                      backdropFilter: "blur(12px)",
                      opacity: s,
                      transform: `translateY(${interpolate(s, [0, 1], [22, 0])}px)`,
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.85)",
                        marginRight: 16,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ color: "rgba(255,255,255,0.92)", fontSize: 24, lineHeight: 1.5, fontWeight: 500 }}>
                      {kp}
                    </span>
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
            gap: 12,
          }}
        >
          <div style={{ width: 20, height: 1, background: "rgba(255,255,255,0.45)", flexShrink: 0 }} />
          <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 15, fontStyle: "italic", lineHeight: 1.4 }}>
            {segment.transitionLine}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
