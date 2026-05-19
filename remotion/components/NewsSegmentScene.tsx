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

// Per-story color themes — assigned by storyIndex mod 5
const THEMES = [
  { accent: "#ef4444", r: 239, g: 68,  b: 68  },  // 0 red      — legal/controversy
  { accent: "#10b981", r: 16,  g: 185, b: 129 },  // 1 emerald  — deals/growth
  { accent: "#f59e0b", r: 245, g: 158, b: 11  },  // 2 amber    — corporate/industry
  { accent: "#8b5cf6", r: 139, g: 92,  b: 246 },  // 3 violet   — culture/policy
  { accent: "#3b82f6", r: 59,  g: 130, b: 246 },  // 4 blue     — tech/model
];

export interface NewsSegmentSceneProps {
  segment: NewsSegment;
  assets: SegmentAssets;   // kept for future image use; not rendered in this phase
  tts: TtsSegment;
  storyIndex: number;      // 0-based position in the story list
  totalStories: number;
}

// ── Big-number detection ──────────────────────────────────────────────────────

interface BigNum {
  display: string;       // e.g. "7,000" or "$65B"
  numericValue: number;  // raw number for counting
  shouldCount: boolean;  // only count up when no B/M/K suffix and ≤ 100,000
  context: string;       // remainder of the key-point after the number is removed
  kpIndex: number;       // index in keyPoints array
}

function findBigNumber(keyPoints: string[]): BigNum | null {
  for (let i = 0; i < keyPoints.length; i++) {
    const kp = keyPoints[i];
    // Match optional $, digits-with-commas, optional B/M/K suffix
    const m = kp.match(/(\$?)([\d,]+(?:\.\d+)?)(\s*[BMKbmk])?/);
    if (!m) continue;
    const raw = parseFloat(m[2].replace(/,/g, ""));
    const suffix = m[3] ? m[3].trim().charAt(0).toUpperCase() : "";
    if (raw < 100 && !suffix) continue; // skip small incidental numbers
    const display = `${m[1]}${m[2]}${suffix}`;
    const context = kp.replace(m[0], "").replace(/^[\s\-–—,]+/, "").trim();
    return {
      display,
      numericValue: raw,
      shouldCount: !suffix && raw <= 100_000,
      context,
      kpIndex: i,
    };
  }
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const NewsSegmentScene: React.FC<NewsSegmentSceneProps> = ({
  segment,
  storyIndex,
  totalStories,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const theme = THEMES[storyIndex % THEMES.length];
  const { r, g, b } = theme;

  // Convenience spring helper — delays entry by `delay` frames
  const sp = (
    delay: number,
    cfg?: { damping: number; stiffness: number; mass?: number }
  ) =>
    spring({
      frame: Math.max(0, frame - delay),
      fps,
      config: cfg ?? { damping: 18, stiffness: 220, mass: 0.85 },
    });

  // ── Shared animated values ────────────────────────────────────────────────

  // Left accent bar: grows from centre outward
  const barSp = sp(0, { damping: 24, stiffness: 120, mass: 1.5 });
  const barPct = interpolate(barSp, [0, 1], [0, 60]);

  const badgeOpacity = interpolate(frame, [3, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const counterOpacity = interpolate(frame, [5, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Transition line appears near the end of the segment
  const transitionOpacity = interpolate(
    frame,
    [durationInFrames - 52, durationInFrames - 22],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // ── Layout decision ───────────────────────────────────────────────────────

  const bigNum = findBigNumber(segment.keyPoints ?? []);
  const useBigNum = bigNum !== null;

  // ── Standard layout: word-by-word headline ────────────────────────────────

  const words = segment.progressLabel.split(" ");
  const wordSprings = words.map((_, wi) =>
    sp(8 + wi * 4, { damping: 13, stiffness: 310, mass: 0.6 })
  );

  // Key points: slide from left + blur-to-sharp
  const kpSprings = (segment.keyPoints ?? []).slice(0, 3).map((_, i) =>
    sp(30 + i * 15, { damping: 20, stiffness: 190, mass: 0.9 })
  );

  // ── Big-number layout ─────────────────────────────────────────────────────

  // Number entrance: scale from 0.5 + glow
  const numSp = useBigNum ? sp(8, { damping: 32, stiffness: 130, mass: 2.2 }) : 0;
  const numScale = interpolate(numSp, [0, 1], [0.55, 1]);
  const numOpacity = interpolate(numSp, [0, 0.5], [0, 1]);

  // Counting animation (only for non-abbreviated numbers)
  const counted = useBigNum && bigNum!.shouldCount
    ? Math.round(
        interpolate(frame, [10, 68], [0, bigNum!.numericValue], {
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

  // Context line below number
  const ctxSp = useBigNum ? sp(52, { damping: 18, stiffness: 200, mass: 0.85 }) : 0;

  // Remaining key points (those that aren't the big number)
  const remainingKps = (segment.keyPoints ?? []).filter(
    (_, i) => !useBigNum || i !== bigNum!.kpIndex
  );
  const remSprings = remainingKps.map((_, i) =>
    sp((useBigNum ? 66 : 30) + i * 13, { damping: 20, stiffness: 190, mass: 0.9 })
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(ellipse at 10% 48%, rgba(${r},${g},${b},0.18) 0%, transparent 52%),
          linear-gradient(162deg, #080c18 0%, #0d1226 55%, #080c18 100%)
        `,
      }}
    >
      {/* ── Left accent bar ── */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: `${(100 - barPct) / 2}%`,
          width: 4,
          height: `${barPct}%`,
          background: `linear-gradient(to bottom, transparent 0%, ${theme.accent} 20%, ${theme.accent} 80%, transparent 100%)`,
          borderRadius: 2,
        }}
      />

      {/* ── Category badge (top-left) ── */}
      <div
        style={{
          position: "absolute",
          top: 58,
          left: 64,
          opacity: badgeOpacity,
          background: `rgba(${r},${g},${b},0.14)`,
          border: `1px solid rgba(${r},${g},${b},0.38)`,
          color: theme.accent,
          padding: "5px 14px",
          borderRadius: 3,
          fontSize: 11,
          letterSpacing: 3,
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        {segment.category ?? "AI News"}
      </div>

      {/* ── Story counter (top-right) ── */}
      <div
        style={{
          position: "absolute",
          top: 50,
          right: 72,
          opacity: counterOpacity,
          display: "flex",
          alignItems: "baseline",
          gap: 6,
        }}
      >
        <span
          style={{
            color: theme.accent,
            fontSize: 50,
            fontWeight: 800,
            lineHeight: 1,
            fontFeatureSettings: '"tnum"',
          }}
        >
          {String(storyIndex + 1).padStart(2, "0")}
        </span>
        <span style={{ color: "rgba(255,255,255,0.20)", fontSize: 19 }}>
          / {String(totalStories).padStart(2, "0")}
        </span>
      </div>

      {/* ── Main content area ── */}
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
          /* ════ Big-Number Layout ════════════════════════════════════════════ */
          <>
            {/* Number */}
            <div
              style={{
                textAlign: "center",
                opacity: numOpacity,
                transform: `scale(${numScale})`,
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  color: "#ffffff",
                  fontSize: 168,
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: -3,
                  fontFeatureSettings: '"tnum"',
                  textShadow: `
                    0 0 60px rgba(${r},${g},${b},0.7),
                    0 0 140px rgba(${r},${g},${b},0.3)
                  `,
                }}
              >
                {numDisplayStr}
              </span>
            </div>

            {/* Context label */}
            <div
              style={{
                textAlign: "center",
                color: `rgba(${r},${g},${b},0.88)`,
                fontSize: 26,
                fontWeight: 500,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                marginBottom: 48,
                opacity: ctxSp as number,
                transform: `translateY(${interpolate(ctxSp as number, [0, 1], [14, 0])}px)`,
              }}
            >
              {bigNum!.context || segment.progressLabel}
            </div>

            {/* Thin divider */}
            {remainingKps.length > 0 && (
              <div
                style={{
                  alignSelf: "center",
                  width: `${interpolate(ctxSp as number, [0, 1], [0, 28])}%`,
                  height: 1,
                  background: `rgba(${r},${g},${b},0.30)`,
                  marginBottom: 28,
                }}
              />
            )}

            {/* Remaining key points */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                paddingLeft: 100,
                paddingRight: 100,
              }}
            >
              {remainingKps.map((kp, i) => {
                const s = remSprings[i];
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      opacity: s,
                      transform: `translateY(${interpolate(s, [0, 1], [10, 0])}px)`,
                      filter: `blur(${interpolate(s, [0, 1], [4, 0])}px)`,
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: theme.accent,
                        marginTop: 10,
                        marginRight: 14,
                        flexShrink: 0,
                        opacity: 0.7,
                      }}
                    />
                    <span style={{ color: "#94a3b8", fontSize: 20, lineHeight: 1.5 }}>
                      {kp}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* ════ Standard Layout ══════════════════════════════════════════════ */
          <>
            {/* Headline — word by word with spring physics */}
            <div style={{ marginBottom: 44, marginTop: 24 }}>
              <h2
                style={{
                  color: "#f1f5f9",
                  fontSize: 60,
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
                        transform: `translateY(${interpolate(s, [0, 1], [30, 0])}px)`,
                      }}
                    >
                      {word}
                    </span>
                  );
                })}
              </h2>
            </div>

            {/* Key points — slide from right + blur-to-sharp */}
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {(segment.keyPoints ?? []).slice(0, 3).map((kp, i) => {
                const s = kpSprings[i];
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      opacity: s,
                      transform: `translateX(${interpolate(s, [0, 1], [22, 0])}px)`,
                      filter: `blur(${interpolate(s, [0, 1], [5, 0])}px)`,
                    }}
                  >
                    {/* Accent dot */}
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: theme.accent,
                        marginTop: 11,
                        marginRight: 18,
                        flexShrink: 0,
                        boxShadow: `0 0 8px rgba(${r},${g},${b},0.6)`,
                      }}
                    />
                    <span style={{ color: "#cbd5e1", fontSize: 24, lineHeight: 1.5 }}>
                      {kp}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Transition line — bottom of content, fades in near segment end ── */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            opacity: transitionOpacity,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 22,
              height: 1,
              background: `rgba(${r},${g},${b},0.55)`,
              flexShrink: 0,
            }}
          />
          <span style={{ color: "#475569", fontSize: 15, fontStyle: "italic", lineHeight: 1.4 }}>
            {segment.transitionLine}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
