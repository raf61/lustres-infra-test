import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BG, FONT } from "./shared";

export function Scene00Intro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const lineW = interpolate(
    spring({ frame: frame - 4, fps, config: { damping: 200 } }),
    [0, 1], [0, 60]
  );
  const titleP = spring({ frame: frame - 16, fps, config: { damping: 200 } });
  const dotOp = interpolate(frame, [40, 56], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div style={{
      width: "100%", height: "100%",
      background: BG,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: FONT,
    }}>
      {/* top line */}
      <div style={{
        width: lineW,
        height: 1,
        background: "rgba(255,255,255,0.15)",
        marginBottom: 40,
      }} />

      <div style={{
        fontSize: 72,
        fontWeight: 700,
        color: "rgba(255,255,255,0.75)",
        letterSpacing: "-0.025em",
        textAlign: "center",
        lineHeight: 1.2,
        opacity: interpolate(titleP, [0,1],[0,1]),
        transform: `translateY(${interpolate(titleP, [0,1],[30,0])}px)`,
      }}>
        Como a maioria das<br />
        <span style={{ color: "rgba(255,255,255,0.35)" }}>empresas de I.A agem.</span>
      </div>

      {/* bottom dots */}
      <div style={{
        display: "flex", gap: 8, marginTop: 48,
        opacity: dotOp,
      }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: 3,
            background: "rgba(255,255,255,0.18)",
          }} />
        ))}
      </div>
    </div>
  );
}
