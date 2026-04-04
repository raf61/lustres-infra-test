import { interpolate, spring, useCurrentFrame, useVideoConfig, Img, staticFile } from "remotion";
import { BG, GREEN, FONT } from "./shared";

export function Cover() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logosOpacity = interpolate(frame, [0, 24], [0, 1], { extrapolateRight: "clamp" });
  const logoScale = interpolate(
    spring({ frame, fps, config: { damping: 200 } }),
    [0, 1], [0.85, 1]
  );

  const titleP = spring({ frame: frame - 22, fps, config: { damping: 200 } });
  const subP   = spring({ frame: frame - 44, fps, config: { damping: 200 } });
  const lineW  = interpolate(spring({ frame: frame - 50, fps, config: { damping: 200 } }), [0,1],[0,180]);

  return (
    <div style={{
      width: "100%", height: "100%",
      background: BG,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: FONT,
      position: "relative",
    }}>
      {/* Logos */}
      <div style={{
        opacity: logosOpacity,
        transform: `scale(${logoScale})`,
        display: "flex",
        alignItems: "center",
        gap: 40,
        marginBottom: 64,
      }}>
        <Img src={staticFile("petfun.png")}
          style={{ height: 72, width: "auto", objectFit: "contain" }} />
        <div style={{ width: 1, height: 52, background: "rgba(255,255,255,0.15)" }} />
        <Img src={staticFile("vopy.jpeg")}
          style={{ height: 52, width: "auto", objectFit: "contain", opacity: 0.88 }} />
      </div>

      {/* Title */}
      <div style={{
        textAlign: "center",
        opacity: interpolate(titleP, [0,1],[0,1]),
        transform: `translateY(${interpolate(titleP, [0,1],[44,0])}px)`,
      }}>
        <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.03em", color: "#fff" }}>
          Infraestrutura de I.A
        </div>
        <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.03em", color: GREEN }}>
          para a Pet Fun.
        </div>
      </div>

      {/* Line */}
      <div style={{
        width: lineW,
        height: 2,
        background: `linear-gradient(90deg, transparent, ${GREEN}, transparent)`,
        borderRadius: 2,
        marginTop: 40,
        marginBottom: 28,
      }} />

      {/* Tagline */}
      <div style={{
        opacity: interpolate(subP, [0,1],[0,1]),
        transform: `translateY(${interpolate(subP, [0,1],[18,0])}px)`,
        fontSize: 22,
        color: "rgba(255,255,255,0.35)",
        letterSpacing: "0.01em",
        textAlign: "center",
      }}>
        Apresentação Inicial · 2026
      </div>
    </div>
  );
}
