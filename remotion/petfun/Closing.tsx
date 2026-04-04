import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BG, GREEN, FONT } from "./shared";

export function Closing() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const line1P = spring({ frame: frame - 8,  fps, config: { damping: 200 } });
  const line2P = spring({ frame: frame - 22, fps, config: { damping: 200 } });
  const lineW  = interpolate(
    spring({ frame: frame - 40, fps, config: { damping: 200 } }),
    [0, 1], [0, 160]
  );

  return (
    <div style={{
      width: "100%", height: "100%",
      background: BG,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: FONT,
      padding: "0 140px",
      textAlign: "center",
    }}>
      <div style={{
        fontSize: 78,
        fontWeight: 700,
        color: "#fff",
        letterSpacing: "-0.03em",
        lineHeight: 1.1,
        opacity: interpolate(line1P, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(line1P, [0, 1], [32, 0])}px)`,
      }}>
        Nossa solução é diferente
      </div>
      <div style={{
        fontSize: 78,
        fontWeight: 700,
        color: GREEN,
        letterSpacing: "-0.03em",
        lineHeight: 1.1,
        marginBottom: 48,
        opacity: interpolate(line2P, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(line2P, [0, 1], [32, 0])}px)`,
      }}>
        porque é feita para vocês.
      </div>

      <div style={{
        width: lineW,
        height: 1,
        background: `rgba(74,222,128,0.25)`,
        borderRadius: 1,
      }} />
    </div>
  );
}
