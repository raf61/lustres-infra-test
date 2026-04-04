import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BG, GREEN, FONT } from "./shared";

type Props = {
  num: string;
  title: string;
  body: string;
};

export function ProcessSlide({ num, title, body }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const numOp  = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const titleP = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const bodyP  = spring({ frame: frame - 26, fps, config: { damping: 200 } });
  const lineW  = interpolate(
    spring({ frame: frame - 6, fps, config: { damping: 200 } }),
    [0, 1], [0, 56]
  );

  return (
    <div style={{
      width: "100%", height: "100%",
      background: BG,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      fontFamily: FONT,
      padding: "0 160px",
    }}>
      {/* Green accent line */}
      <div style={{
        width: lineW,
        height: 2,
        background: GREEN,
        borderRadius: 1,
        marginBottom: 36,
        opacity: 0.5,
      }} />

      {/* Number */}
      <div style={{
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.2em",
        textTransform: "uppercase" as const,
        color: "rgba(74,222,128,0.55)",
        marginBottom: 20,
        opacity: numOp,
      }}>
        {num}
      </div>

      {/* Title */}
      <div style={{
        fontSize: 88,
        fontWeight: 700,
        color: "#fff",
        letterSpacing: "-0.03em",
        lineHeight: 1.05,
        marginBottom: 36,
        opacity: interpolate(titleP, [0,1],[0,1]),
        transform: `translateY(${interpolate(titleP, [0,1],[30,0])}px)`,
      }}>
        {title}
      </div>

      {/* Divider */}
      <div style={{
        width: 48,
        height: 1,
        background: "rgba(74,222,128,0.2)",
        marginBottom: 28,
        opacity: interpolate(bodyP,[0,1],[0,1]),
      }} />

      {/* Body */}
      <div style={{
        fontSize: 38,
        color: "rgba(255,255,255,0.45)",
        lineHeight: 1.55,
        letterSpacing: "-0.01em",
        whiteSpace: "pre-line",
        maxWidth: 900,
        opacity: interpolate(bodyP,[0,1],[0,1]),
        transform: `translateY(${interpolate(bodyP,[0,1],[18,0])}px)`,
      }}>
        {body}
      </div>
    </div>
  );
}
