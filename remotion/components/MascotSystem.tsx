import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Lottie } from "@remotion/lottie";
import type { LottieAnimationData } from "@remotion/lottie";
import type { TimelineEntry } from "../types";
import horseWalkData from "../assets/horse-walk.json";

interface MascotSystemProps {
  timeline: TimelineEntry[];
  totalFrames: number;
  introEnd: number;    // frame where intro horse finishes shrinking to corner (= end of Intro)
  outroStart: number;  // frame where outro horse leaps to center (= outroTimeline.from)
  introTitle?: string;
  introDate?: string;
}

const truncate = (s: string, n: number) =>
  s.length > n ? s.slice(0, n - 1) + "…" : s;

const BAR_H = 40;
const MASCOT_S = 80;    // small size (progress bar)
const MASCOT_L = 200;   // large size (intro / outro)

// How many frames each animation stage takes
const ENTER_F = 35;     // horse gallops from right to center
const TITLE_F = 60;     // title stays visible at center
const SHRINK_F = 55;    // shrink + move to corner
const LEAP_F = 48;      // outro leap to center
const GROW_F = 72;      // grow to full size

export const MascotSystem: React.FC<MascotSystemProps> = ({
  timeline,
  totalFrames,
  introEnd,
  outroStart,
  introTitle = "AI News Daily",
  introDate,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const globalProgress = frame / totalFrames;

  // ─── INTRO HORSE ─────────────────────────────────────────────────────
  // Enters from right (facing left), pauses at center, shrinks to bottom-left

  const shrinkStart = introEnd - SHRINK_F;

  const introX = interpolate(
    frame,
    [0, ENTER_F, shrinkStart, introEnd],
    [width + MASCOT_L, width / 2 - MASCOT_L / 2, width / 2 - MASCOT_L / 2, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const introY = interpolate(
    frame,
    [shrinkStart, introEnd],
    [height / 2 - MASCOT_L / 2, height - BAR_H - MASCOT_S + 8],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const introSize = interpolate(
    frame,
    [shrinkStart, introEnd],
    [MASCOT_L, MASCOT_S],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const introOpacity = interpolate(
    frame,
    [introEnd - 8, introEnd],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Title fades in after horse arrives, fades out as horse starts shrinking
  const titleOpacity = interpolate(
    frame,
    [ENTER_F + 5, ENTER_F + 20, shrinkStart - 10, shrinkStart + 10],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // ─── PROGRESS HORSE ─────────────────────────────────────────────────
  // Walks left→right along bottom bar (faces right — no transform)

  const progressX = Math.max(
    0,
    Math.min(width - MASCOT_S, globalProgress * width - MASCOT_S / 2)
  );
  const progressOpacity = interpolate(
    frame,
    [introEnd, introEnd + 12, outroStart - 12, outroStart],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // ─── OUTRO HORSE ──────────────────────────────────────────────────────
  // Leaps from right side of progress bar to center, grows, sleeps

  const outroStartX = Math.max(
    0,
    Math.min(width - MASCOT_S, (outroStart / totalFrames) * width - MASCOT_S / 2)
  );
  const leapEnd = outroStart + LEAP_F;
  const growEnd = outroStart + GROW_F;

  const outroX = interpolate(
    frame,
    [outroStart, leapEnd],
    [outroStartX, width / 2 - MASCOT_L / 2],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const outroY = interpolate(
    frame,
    [outroStart, leapEnd],
    [height - BAR_H - MASCOT_S + 8, height / 2 - MASCOT_L / 2],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const outroSize = interpolate(
    frame,
    [outroStart, growEnd],
    [MASCOT_S, MASCOT_L],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  // Gentle breathing oscillation once fully grown
  const breathY =
    frame >= growEnd ? 5 * Math.sin((2 * Math.PI * (frame - growEnd)) / 45) : 0;

  const outroOpacity = interpolate(
    frame,
    [outroStart, outroStart + 8],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const outroTextOpacity = interpolate(
    frame,
    [growEnd + 5, growEnd + 25],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // ─── PROGRESS BAR segments ───────────────────────────────────────────
  const segments = timeline.map((t) => {
    const segStart = t.from / totalFrames;
    const segW = t.durationInFrames / totalFrames;
    const isActive = globalProgress >= segStart && globalProgress < segStart + segW;
    const isPast = globalProgress >= segStart + segW;
    const fill = isActive
      ? Math.min(1, (globalProgress - segStart) / segW)
      : isPast ? 1 : 0;
    return { t, isActive, isPast, fill };
  });

  return (
    <>
      {/* ── Full-canvas layer: intro horse + outro horse ── */}
      <AbsoluteFill style={{ pointerEvents: "none", zIndex: 50 }}>

        {/* INTRO horse — faces LEFT */}
        {frame < introEnd + 5 && (
          <div
            style={{
              position: "absolute",
              left: introX,
              top: introY,
              width: introSize,
              height: introSize,
              opacity: introOpacity,
              transform: "scaleX(-1)",
              filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.18))",
            }}
          >
            <Lottie animationData={horseWalkData as LottieAnimationData} loop />
          </div>
        )}

        {/* Intro title text — appears after horse arrives */}
        {frame < introEnd && (
          <div
            style={{
              position: "absolute",
              top: height / 2 - 60,
              left: 0,
              right: 0,
              textAlign: "center",
              opacity: titleOpacity,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                fontSize: 52,
                fontWeight: 800,
                color: "#1e293b",
                letterSpacing: -1,
                textShadow: "0 0 24px rgba(255,248,237,1), 0 0 48px rgba(255,248,237,0.9)",
              }}
            >
              {introTitle}
            </div>
            {introDate && (
              <div
                style={{
                  fontSize: 22,
                  color: "#92400e",
                  marginTop: 10,
                  fontWeight: 500,
                  textShadow: "0 0 16px rgba(255,248,237,0.95)",
                }}
              >
                {introDate}
              </div>
            )}
          </div>
        )}

        {/* OUTRO horse — faces LEFT (leaping toward center from right) */}
        {frame >= outroStart - 5 && (
          <div
            style={{
              position: "absolute",
              left: outroX,
              top: outroY + breathY,
              width: outroSize,
              height: outroSize,
              opacity: outroOpacity,
              transform: "scaleX(-1)",
              filter: "drop-shadow(0 4px 18px rgba(0,0,0,0.15))",
            }}
          >
            {/* Stop looping after fully grown — horse "settles" */}
            <Lottie
              animationData={horseWalkData as LottieAnimationData}
              loop={frame < growEnd + 5}
            />
          </div>
        )}

        {/* Outro text floats above the sleeping horse */}
        {frame >= growEnd && (
          <div
            style={{
              position: "absolute",
              top: height / 2 - MASCOT_L / 2 - 64,
              left: 0,
              right: 0,
              textAlign: "center",
              opacity: outroTextOpacity,
            }}
          >
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: "#92400e",
                letterSpacing: 1,
                textShadow: "0 2px 8px rgba(255,248,237,0.9)",
              }}
            >
              See you tomorrow! 🌅
            </div>
          </div>
        )}
      </AbsoluteFill>

      {/* ── Bottom bar layer: progress bar + walking horse ── */}
      <AbsoluteFill
        style={{ top: "auto", bottom: 0, height: BAR_H + MASCOT_S, pointerEvents: "none" }}
      >
        {/* PROGRESS horse — faces RIGHT */}
        <div
          style={{
            position: "absolute",
            bottom: BAR_H - 8,
            left: progressX,
            width: MASCOT_S,
            height: MASCOT_S,
            opacity: progressOpacity,
            zIndex: 2,
            filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.18))",
          }}
        >
          <Lottie animationData={horseWalkData as LottieAnimationData} loop />
        </div>

        {/* Progress bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: BAR_H,
            display: "flex",
            background: "rgba(255, 248, 237, 0.94)",
            borderTop: "1px solid rgba(200, 150, 60, 0.22)",
          }}
        >
          {segments.map(({ t, isActive, isPast, fill }) => (
            <div
              key={t.id}
              style={{
                flex: t.durationInFrames,
                position: "relative",
                borderRight: "1px solid rgba(200, 150, 60, 0.15)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  right: `${(1 - fill) * 100}%`,
                  background: isActive
                    ? "rgba(217, 119, 6, 0.26)"
                    : isPast
                    ? "rgba(217, 119, 6, 0.11)"
                    : "transparent",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 7,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 10,
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? "#92400e" : "rgba(146, 64, 14, 0.48)",
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
          ))}
        </div>
      </AbsoluteFill>
    </>
  );
};
