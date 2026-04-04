import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BG, FONT } from "./shared";

type Props = {
  label?: string;
  title: string;
  titleColor?: string;
};

export function SectionTitle({ label, title, titleColor = "rgba(255,255,255,0.88)" }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const lineW = interpolate(
    spring({ frame: frame - 4, fps, config: { damping: 200 } }),
    [0, 1], [0, 52]
  );
  const labelOp = interpolate(frame, [8, 22], [0, 1], { extrapolateRight: "clamp" });
  const titleP  = spring({ frame: frame - 14, fps, config: { damping: 200 } });

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
      <div style={{
        width: lineW,
        height: 1,
        background: "rgba(74,222,128,0.3)",
        marginBottom: 36,
      }} />

      {label && (
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.22em",
          textTransform: "uppercase" as const,
          color: "rgba(74,222,128,0.5)",
          marginBottom: 22,
          opacity: labelOp,
        }}>
          {label}
        </div>
      )}

      <div style={{
        fontSize: 92,
        fontWeight: 700,
        color: titleColor,
        letterSpacing: "-0.035em",
        textAlign: "center",
        lineHeight: 1.08,
        padding: "0 120px",
        opacity: interpolate(titleP, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(titleP, [0, 1], [30, 0])}px)`,
      }}>
        {title}
      </div>

      <div style={{
        width: lineW * 0.5,
        height: 1,
        background: "rgba(74,222,128,0.12)",
        marginTop: 40,
      }} />
    </div>
  );
}
