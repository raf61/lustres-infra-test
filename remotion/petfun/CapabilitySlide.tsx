import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BG, GREEN, FONT } from "./shared";
import React from "react";

type Props = {
  num: string;
  title: string;
  line1?: string;
  line2?: string;
  illustration: React.ReactNode;
};

export function CapabilitySlide({ num, title, line1, line2, illustration }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const numOp = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const titleP = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const line1P = spring({ frame: frame - 26, fps, config: { damping: 200 } });
  const line2P = spring({ frame: frame - 38, fps, config: { damping: 200 } });
  const illuP  = spring({ frame: frame - 14, fps, config: { damping: 200 } });

  const lineH = interpolate(
    spring({ frame: frame - 8, fps, config: { damping: 200 } }),
    [0,1],[0,130]
  );

  return (
    <div style={{
      width: "100%", height: "100%",
      background: BG,
      display: "flex",
      alignItems: "center",
      fontFamily: FONT,
      padding: "0 160px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Left accent bar */}
      <div style={{
        position: "absolute",
        left: 0, top: "50%",
        transform: "translateY(-50%)",
        width: 4,
        height: lineH,
        background: `linear-gradient(180deg, transparent, ${GREEN}, transparent)`,
        borderRadius: 2,
      }} />

      {/* Left: text */}
      <div style={{ flex: 1, paddingRight: 60 }}>
        {/* Label */}
        <div style={{
          opacity: numOp,
          fontSize: 11, fontWeight: 600,
          letterSpacing: "0.18em", textTransform: "uppercase" as const,
          color: "rgba(22,163,74,0.7)", marginBottom: 14,
        }}>
          03 · {num}
        </div>

        {/* Big background number */}
        <div style={{
          position: "absolute",
          right: 440, bottom: 40,
          fontSize: 260, fontWeight: 700,
          color: "rgba(22,163,74,0.035)",
          lineHeight: 1, letterSpacing: "-0.04em",
          opacity: numOp, fontFamily: FONT,
          userSelect: "none",
          pointerEvents: "none",
        }}>
          {num}
        </div>

        {/* Title */}
        <div style={{
          fontSize: 72,
          fontWeight: 700,
          color: "#fff",
          letterSpacing: "-0.025em",
          lineHeight: 1.1,
          marginBottom: 32,
          opacity: interpolate(titleP, [0,1],[0,1]),
          transform: `translateY(${interpolate(titleP, [0,1],[36,0])}px)`,
        }}>
          {title}
        </div>

        {/* Lines */}
        <div style={{
          fontSize: 26,
          color: "rgba(255,255,255,0.5)",
          lineHeight: 1.55,
          opacity: interpolate(line1P, [0,1],[0,1]),
          transform: `translateY(${interpolate(line1P, [0,1],[18,0])}px)`,
          marginBottom: line2 ? 4 : 0,
        }}>
          {line1}
        </div>
        {line2 && (
          <div style={{
            fontSize: 26,
            color: "rgba(255,255,255,0.5)",
            lineHeight: 1.55,
            opacity: interpolate(line2P, [0,1],[0,1]),
            transform: `translateY(${interpolate(line2P, [0,1],[18,0])}px)`,
          }}>
            {line2}
          </div>
        )}
      </div>

      {/* Right: illustration */}
      <div style={{
        flexShrink: 0,
        width: 420,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: interpolate(illuP, [0,1],[0,1]),
        transform: `translateX(${interpolate(illuP, [0,1],[30,0])}px) scale(${interpolate(illuP,[0,1],[0.92,1])})`,
      }}>
        {illustration}
      </div>
    </div>
  );
}
