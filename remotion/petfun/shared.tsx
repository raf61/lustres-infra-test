import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { inter } from "./fonts";
import React from "react";

export const BG = "#0c0c0c";
export const GREEN = "#4ade80";
export const GREEN_DARK = "#16a34a";
export const FONT = inter;

export function useFadeUp(delay = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return {
    opacity: interpolate(p, [0, 1], [0, 1], { extrapolateLeft: "clamp" }),
    transform: `translateY(${interpolate(p, [0, 1], [32, 0])}px)`,
  };
}

export function useFadeIn(delay = 0, dur = 18) {
  const frame = useCurrentFrame();
  return {
    opacity: interpolate(frame, [delay, delay + dur], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  };
}

export function SceneNum({ num, delay = 0 }: { num: string; delay?: number }) {
  const style = useFadeIn(delay);
  return (
    <div style={{
      ...style,
      fontFamily: FONT,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.18em",
      textTransform: "uppercase" as const,
      color: GREEN_DARK,
      marginBottom: 14,
    }}>
      {num}
    </div>
  );
}
