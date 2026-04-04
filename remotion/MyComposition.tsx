import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const MyComposition = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0c0c0c",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
      }}
    >
      <span style={{ color: "#4ade80", fontSize: 64, fontWeight: 700 }}>
        Vopy
      </span>
    </AbsoluteFill>
  );
};
