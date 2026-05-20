import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Lottie } from "@remotion/lottie";
import type { LottieAnimationData } from "@remotion/lottie";
import type { TimelineEntry } from "../types";
import horseWalkData from "../assets/horse-walk.json";

interface MascotSystemProps {
  timeline: TimelineEntry[];
  totalFrames: number;
  introEnd: number;    // frame where intro mascot finishes and progress bar takes over
  outroStart: number;  // frame where outro animation begins
  introTitle?: string;
  introDate?: string;
  outroTitle?: string;
}

const BAR_H = 40;
const MASCOT_S = 80;    // small size (progress bar)
const MASCOT_L = 200;   // large size (intro / outro)

// Animation stages — shared by intro and outro.
// Horse walks left→right across the screen, "pulling" the title in behind it via
// a clip-path reveal. After it passes the title it pauses, then either descends
// to the progress bar (intro) or fades out (outro).
const WALK_F = 80;      // horse traverses the canvas
const HOLD_F = 20;      // hold horse at the end of the walk, full title visible
const TRANSITION_F = 50; // intro: descend to progress bar / outro: fade out

// Title geometry (centred horizontally)
const TITLE_W_FRAC = 0.62; // 62% of canvas width

interface RevealedTitleProps {
  title: string;
  subtitle?: string;
  width: number;
  height: number;
  horseX: number;
  titleStartX: number;
  titleEndX: number;
  textOpacity: number;
}

// Title text revealed left→right as the horse passes over its bounds.
const RevealedTitle: React.FC<RevealedTitleProps> = ({
  title, subtitle, width, height, horseX, titleStartX, titleEndX, textOpacity,
}) => {
  // Clip-right % goes 100 → 0 as horse moves from titleStartX → titleEndX.
  const clipRightPct = interpolate(
    horseX,
    [titleStartX, titleEndX],
    [100, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return (
    <div
      style={{
        position: "absolute",
        top: height / 2 - 60,
        left: 0,
        right: 0,
        textAlign: "center",
        opacity: textOpacity,
        pointerEvents: "none",
        clipPath: `inset(0 ${clipRightPct}% 0 0)`,
        WebkitClipPath: `inset(0 ${clipRightPct}% 0 0)`,
      }}
    >
      <div
        style={{
          fontSize: 64,
          fontWeight: 800,
          color: "#1e293b",
          letterSpacing: -1,
          textShadow: "0 0 24px rgba(255,248,237,1), 0 0 48px rgba(255,248,237,0.9)",
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: 22,
            color: "#92400e",
            marginTop: 12,
            fontWeight: 500,
            textShadow: "0 0 16px rgba(255,248,237,0.95)",
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
};

const truncate = (s: string, n: number) =>
  s.length > n ? s.slice(0, n - 1) + "…" : s;

export const MascotSystem: React.FC<MascotSystemProps> = ({
  timeline,
  totalFrames,
  introEnd,
  outroStart,
  introTitle = "AI News Daily",
  introDate,
  outroTitle = "See you tomorrow",
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const globalProgress = frame / totalFrames;

  // Title geometry shared by intro + outro
  const titleW = width * TITLE_W_FRAC;
  const titleStartX = (width - titleW) / 2;
  const titleEndX = titleStartX + titleW;

  // ─── INTRO: horse walks L→R across canvas, title reveals behind ──────────
  //
  // Stages (relative to frame 0):
  //   [0 .. WALK_F]                walk: x = -MASCOT_L → titleEndX + MASCOT_L
  //   [WALK_F .. WALK_F+HOLD_F]    hold at end-of-walk position, title fully revealed
  //   [WALK_F+HOLD_F .. introEnd]  descend to progress-bar corner, shrink
  const introWalkEndX = titleEndX + MASCOT_L * 0.3; // horse stops just past title's right edge
  const introHoldEnd = WALK_F + HOLD_F;
  const introShrinkStart = introHoldEnd;
  // Centre vertically slightly below the title
  const introWalkY = height / 2 - MASCOT_L / 2 + 40;

  const introX = interpolate(
    frame,
    [0, WALK_F, introHoldEnd, introEnd],
    [-MASCOT_L, introWalkEndX, introWalkEndX, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // Monotonic reveal X for the title clip — never reverses, so the title stays
  // fully revealed once the horse has walked past it (even when introX descends
  // back toward 0 during the shrink stage).
  const introRevealX = interpolate(
    frame,
    [0, WALK_F],
    [-MASCOT_L, introWalkEndX],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const introY = interpolate(
    frame,
    [introShrinkStart, introEnd],
    [introWalkY, height - BAR_H - MASCOT_S + 8],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const introSize = interpolate(
    frame,
    [introShrinkStart, introEnd],
    [MASCOT_L, MASCOT_S],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const introOpacity = interpolate(
    frame,
    [introEnd - 8, introEnd],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const introTitleOpacity = interpolate(
    frame,
    [4, 12, introShrinkStart, introEnd - 10],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // ─── PROGRESS HORSE: walks left→right along bottom bar ───────────────────
  const progressX = Math.max(
    0,
    Math.min(width - MASCOT_S, globalProgress * width - MASCOT_S / 2),
  );
  const progressOpacity = interpolate(
    frame,
    [introEnd, introEnd + 12, outroStart - 12, outroStart],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // ─── OUTRO: same animation pattern as intro, no breathing ────────────────
  //
  // Stages (relative to outroStart):
  //   [outroStart .. outroStart+WALK_F]                walk: x = -MASCOT_L → introWalkEndX
  //   [.. + HOLD_F]                                    hold, title fully revealed
  //   [.. + TRANSITION_F]                              fade everything out
  const outroWalkEnd = outroStart + WALK_F;
  const outroHoldEnd = outroWalkEnd + HOLD_F;
  const outroFadeEnd = outroHoldEnd + TRANSITION_F;

  const outroX = interpolate(
    frame,
    [outroStart, outroWalkEnd],
    [-MASCOT_L, introWalkEndX],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const outroOpacity = interpolate(
    frame,
    [outroStart, outroStart + 6, outroHoldEnd, outroFadeEnd],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const outroTitleOpacity = interpolate(
    frame,
    [outroStart + 4, outroStart + 12, outroHoldEnd, outroFadeEnd - 5],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // ─── PROGRESS BAR segments ───────────────────────────────────────────────
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
      {/* ── Full-canvas layer: intro horse + outro horse + revealed titles ── */}
      <AbsoluteFill style={{ pointerEvents: "none", zIndex: 50 }}>

        {/* INTRO horse — faces RIGHT (no scaleX flip), walks left→right */}
        {frame < introEnd + 5 && (
          <div
            style={{
              position: "absolute",
              left: introX,
              top: introY,
              width: introSize,
              height: introSize,
              opacity: introOpacity,
              filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.18))",
            }}
          >
            <Lottie animationData={horseWalkData as LottieAnimationData} loop />
          </div>
        )}

        {/* Intro title — revealed left→right as the horse passes */}
        {frame < introEnd && (
          <RevealedTitle
            title={introTitle}
            subtitle={introDate}
            width={width}
            height={height}
            horseX={introRevealX + MASCOT_L / 2}
            titleStartX={titleStartX}
            titleEndX={titleEndX}
            textOpacity={introTitleOpacity}
          />
        )}

        {/* OUTRO horse — same direction, no breathing */}
        {frame >= outroStart - 5 && frame < outroFadeEnd + 5 && (
          <div
            style={{
              position: "absolute",
              left: outroX,
              top: introWalkY,
              width: MASCOT_L,
              height: MASCOT_L,
              opacity: outroOpacity,
              filter: "drop-shadow(0 4px 18px rgba(0,0,0,0.15))",
            }}
          >
            <Lottie animationData={horseWalkData as LottieAnimationData} loop />
          </div>
        )}

        {/* Outro title — same reveal pattern */}
        {frame >= outroStart - 5 && frame < outroFadeEnd + 5 && (
          <RevealedTitle
            title={outroTitle}
            width={width}
            height={height}
            horseX={outroX + MASCOT_L / 2}
            titleStartX={titleStartX}
            titleEndX={titleEndX}
            textOpacity={outroTitleOpacity}
          />
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
