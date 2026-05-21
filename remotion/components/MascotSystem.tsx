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

// ─── INTRO choreography stages (frames) ─────────────────────────────────────
// Horse walks left→right at CONSTANT speed across the whole canvas. As it
// passes the centred title position, the title's words run a wave animation —
// the horse does NOT stop for this. At the end of the walk a vertical-ellipse
// wormhole has already opened at the right edge; the horse fades into it and
// the hole closes.
const I_WALK_DURATION = 135;  // total frames the horse takes to traverse the canvas
const I_WAVE_F        = 30;   // duration of the word-wave (around the moment horse passes centre)
const I_ENTER_HOLE    = 18;   // horse opacity fade-out frames
const I_HOLE_CLOSE    = 14;   // hole shrink-out frames after horse is gone

// ─── OUTRO choreography (no horse — just word-wave title) ──────────────────
const O_WAVE_F      = 30;   // word-wave duration
const O_HOLD_F      = 70;   // title stays static
const O_FADE_OUT_F  = 30;   // title fades out

// Lottie playback rate tunes step cadence to horizontal velocity. Lower = slower
// stride cycle. Intro/outro horse moves fast across the canvas, progress horse
// crawls along the bar at ~0.2px/frame so its animation must be much slower.
const LOTTIE_RATE_INTRO    = 1.7;
const LOTTIE_RATE_PROGRESS = 0.35;

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

  // ─── INTRO choreography ──────────────────────────────────────────────────
  // The horse traverses the canvas at constant speed over I_WALK_DURATION
  // frames. As soon as it passes the centred title position, the word-wave
  // animation fires — but the horse never stops. After it reaches the right
  // edge it enters the wormhole and fades out.

  // Vertical alignment: horse's box is MASCOT_L tall, anchor its centre on the
  // title's optical centre (title font 64, top at height/2 - 60, so middle ≈ height/2 - 28).
  const introWalkY = height / 2 - MASCOT_L / 2 - 28;

  // Title geometry: keep the title positionally BEHIND the horse at all times.
  // The title is centred horizontally (right edge at titleRightAt0 when translateX=0).
  const TITLE_W_APPROX = 500; // visual width of "AI News Daily" at 64px (overestimate)
  const TITLE_GAP      = 30;  // px between title right edge and horse left edge
  const titleRightAt0  = width / 2 + TITLE_W_APPROX / 2;

  // The "centred" horse position used as the wave trigger — horse's left edge
  // sits TITLE_GAP px to the right of the title's right edge. The horse passes
  // through this position; it does NOT stop here.
  const centerHorseX = titleRightAt0 + TITLE_GAP;

  // Wormhole sits flush against the right edge. Horse walks until its RIGHT
  // edge (i.e. the head) reaches the hole's vertical centre line — never past
  // it — so the head never appears to poke through the hole.
  const HOLE_W = MASCOT_L * 0.55;
  const HOLE_H = MASCOT_L * 1.15;
  const HOLE_RIGHT_MARGIN = 24;
  const holeCenterX = width - HOLE_W / 2 - HOLE_RIGHT_MARGIN;
  const holeHorseX  = holeCenterX - MASCOT_L; // horse.left so horse.right == holeCenterX

  // Constant-speed horse motion: horse keeps walking past the hole until its
  // entire body has crossed the hole's vertical centre line — that's the point
  // at which the clip-path renders nothing. End-X for introX is therefore
  // holeCenterX (horse.left), at which moment horse.right is one MASCOT_L past
  // the line, fully invisible.
  const introX = interpolate(
    frame,
    [0, I_WALK_DURATION],
    [-MASCOT_L, holeCenterX],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Frame at which the horse reaches centerHorseX (used to time the word-wave).
  const sCenterReached = Math.round(
    ((centerHorseX - (-MASCOT_L)) / (holeCenterX - (-MASCOT_L))) * I_WALK_DURATION,
  );
  const sWaveStart  = sCenterReached - 6;
  const sWaveEnd    = sWaveStart + I_WAVE_F;

  // The "enter" phase starts when the horse's head (right edge) touches the
  // hole's centre line. From then until I_WALK_DURATION, the horse is being
  // progressively swallowed by the clip-path mask.
  const sEnterS     = Math.round(
    ((holeCenterX - MASCOT_L - (-MASCOT_L)) / (holeCenterX - (-MASCOT_L))) * I_WALK_DURATION,
  );
  const sEnterE     = I_WALK_DURATION;
  const sHoleOpenS  = sEnterS - 22;
  const sHoleOpenE  = sEnterS - 2;
  const sHoleCloseE = sEnterE + I_HOLE_CLOSE;

  const introY = introWalkY;
  const introSize = MASCOT_L;

  // Clip-path mask: hide the part of the horse whose document-x exceeds
  // holeCenterX. In horse-local coords (0..MASCOT_L), the visible width is
  // clamp(holeCenterX - introX, 0, MASCOT_L). The clip is "inset right by
  // (MASCOT_L - visibleWidth)".
  const visibleWidth = Math.max(0, Math.min(MASCOT_L, holeCenterX - introX));
  const clipRightPx  = MASCOT_L - visibleWidth;

  // Title trails the horse: its right edge sits TITLE_GAP px to the left of the
  // horse's left edge, never overtaking. Once the horse moves past the centred
  // position (introX ≥ centerHorseX), the title settles at translateX=0.
  const titleX = Math.min(0, introX - TITLE_GAP - titleRightAt0);
  const introTitleOpacity = interpolate(
    frame,
    [6, 18, sEnterE - 6, sEnterE + 6],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Per-word wave: each word bounces up (negative Y) then back, staggered.
  const titleWords = introTitle.split(" ");
  const wordBounceY = (i: number): number => {
    const local = frame - sWaveStart - i * 8;
    if (local < 0 || local > I_WAVE_F) return 0;
    return -22 * Math.sin((local / I_WAVE_F) * Math.PI);
  };

  // Vertical-ellipse hole at the right edge — opens before the horse arrives,
  // closes after it disappears inside.
  const holeOpen  = interpolate(frame, [sHoleOpenS, sHoleOpenE], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const holeClose = interpolate(frame, [sEnterE, sHoleCloseE], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const holeScale   = Math.max(0, holeOpen - holeClose);
  const holeCenterY = introWalkY + MASCOT_L / 2;

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

  // ─── OUTRO: word-wave title only, no horse ───────────────────────────────
  //
  // Stages (relative to outroStart):
  //   [outroStart           .. outroStart + O_WAVE_F]    words wave-in (per-word translateY + opacity)
  //   [outroStart + O_WAVE_F .. outroHoldEnd]            title sits static
  //   [outroHoldEnd          .. outroFadeEnd]            title fades out
  const outroWaveEnd = outroStart + O_WAVE_F;
  const outroHoldEnd = outroWaveEnd + O_HOLD_F;
  const outroFadeEnd = outroHoldEnd + O_FADE_OUT_F;

  const outroTitleOpacity = interpolate(
    frame,
    [outroStart, outroStart + 8, outroHoldEnd, outroFadeEnd],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const outroWords = outroTitle.split(" ");
  const outroWordY = (i: number): number => {
    const local = frame - outroStart - i * 8;
    if (local < 0 || local > O_WAVE_F) return 0;
    return -22 * Math.sin((local / O_WAVE_F) * Math.PI);
  };
  const outroWordOpacity = (i: number): number => {
    const local = frame - outroStart - i * 8;
    if (local <= 0) return 0;
    if (local >= 14) return 1;
    return local / 14;
  };

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

        {/* Intro title — slides in attached to the horse, with per-word wave. */}
        {/* Rendered BEFORE the horse so the horse paints on top (horse in front). */}
        {frame < introEnd && (
          <div
            style={{
              position: "absolute",
              top: height / 2 - 60,
              left: 0,
              right: 0,
              textAlign: "center",
              opacity: introTitleOpacity,
              pointerEvents: "none",
              transform: `translateX(${titleX}px)`,
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
              {titleWords.map((w, i) => (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    marginRight: "0.28em",
                    transform: `translateY(${wordBounceY(i)}px)`,
                  }}
                >
                  {w}
                </span>
              ))}
            </div>
            {introDate && (
              <div
                style={{
                  fontSize: 22,
                  color: "#92400e",
                  marginTop: 12,
                  fontWeight: 500,
                  textShadow: "0 0 16px rgba(255,248,237,0.95)",
                }}
              >
                {introDate}
              </div>
            )}
          </div>
        )}

        {/* INTRO horse — faces RIGHT, walks left→centre→right edge */}
        {frame < introEnd + 5 && (
          <div
            style={{
              position: "absolute",
              left: introX,
              top: introY,
              width: introSize,
              height: introSize,
              clipPath: `inset(0 ${clipRightPx}px 0 0)`,
              WebkitClipPath: `inset(0 ${clipRightPx}px 0 0)`,
              filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.18))",
            }}
          >
            <Lottie animationData={horseWalkData as LottieAnimationData} loop playbackRate={LOTTIE_RATE_INTRO} />
          </div>
        )}

        {/* Wormhole — vertical ellipse at the right edge. Painted AFTER the horse */}
        {/* so it covers the horse as it "enters" (combined with horse opacity fade). */}
        {frame >= sHoleOpenS && frame < sHoleCloseE && (
          <div
            style={{
              position: "absolute",
              left: holeCenterX - HOLE_W / 2,
              top: holeCenterY - HOLE_H / 2,
              width: HOLE_W,
              height: HOLE_H,
              borderRadius: "50%",
              background:
                "radial-gradient(ellipse at center, #050505 55%, #0c0c0c 78%, rgba(12,12,12,0.35) 100%)",
              opacity: holeScale,
              transform: `scaleY(${holeScale}) scaleX(${Math.min(1, holeScale * 1.2)})`,
              transformOrigin: "center center",
              boxShadow: "0 0 32px rgba(0,0,0,0.55), 0 0 6px rgba(80,40,100,0.4)",
            }}
          />
        )}

        {/* Outro title — centred, per-word wave-in, hold, fade out. No horse. */}
        {frame >= outroStart - 5 && frame < outroFadeEnd + 5 && (
          <div
            style={{
              position: "absolute",
              top: height / 2 - 60,
              left: 0,
              right: 0,
              textAlign: "center",
              opacity: outroTitleOpacity,
              pointerEvents: "none",
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
              {outroWords.map((w, i) => (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    marginRight: "0.28em",
                    opacity: outroWordOpacity(i),
                    transform: `translateY(${outroWordY(i)}px)`,
                  }}
                >
                  {w}
                </span>
              ))}
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
          <Lottie animationData={horseWalkData as LottieAnimationData} loop playbackRate={LOTTIE_RATE_PROGRESS} />
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
