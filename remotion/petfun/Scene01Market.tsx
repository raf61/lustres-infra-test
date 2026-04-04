import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BG, FONT } from "./shared";

const CARDS = [
  {
    num: "01",
    title: "Entregam a mesma solução\npara empresas completamente diferentes.",
    sub: "A mesma I.A vendida para veterinária, academia e escritório de advocacia\nnão conhece nada sobre o seu negócio.",
  },
  {
    num: "02",
    title: "O sistema é fixo.\nA sua equipe que se adapta.",
    sub: "Sua equipe passa semanas aprendendo a usar o software.\nO sistema não se molda à sua operação.",
  },
  {
    num: "03",
    title: "Após a entrega,\nvocê está por conta própria.",
    sub: "Qualquer problema que surgir depois da implementação\nserá de responsabilidade sua resolver.",
  },
];

const CARD_FRAMES = 95;
const FADE = 14;

function ProblemSlide({ index }: { index: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = index * CARD_FRAMES;
  const isLast = index === CARDS.length - 1;
  const end = start + CARD_FRAMES;

  const opacity = isLast
    ? interpolate(frame, [start, start + FADE], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : interpolate(frame, [start, start + FADE, end - FADE, end], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  if (!isLast && (frame < start - 2 || frame > end + 2)) return null;
  if (isLast && frame < start - 2) return null;

  const enterP = spring({ frame: frame - start, fps, config: { damping: 200 } });
  const subP   = spring({ frame: frame - start - 14, fps, config: { damping: 200 } });
  const card = CARDS[index];

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      opacity,
    }}>
      <div style={{
        width: 980,
        transform: `translateY(${interpolate(enterP, [0,1],[28,0])}px)`,
      }}>
        {/* Red top accent line */}
        <div style={{
          width: 48,
          height: 2,
          background: "rgba(239,68,68,0.5)",
          borderRadius: 1,
          marginBottom: 28,
        }} />

        {/* Num label */}
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.2em",
          textTransform: "uppercase" as const,
          color: "rgba(239,68,68,0.55)",
          marginBottom: 22,
          fontFamily: FONT,
        }}>
          Problema {card.num}
        </div>

        {/* Title */}
        <div style={{
          fontSize: 68,
          fontWeight: 700,
          color: "rgba(255,255,255,0.9)",
          letterSpacing: "-0.025em",
          lineHeight: 1.1,
          whiteSpace: "pre-line",
          fontFamily: FONT,
          marginBottom: 32,
        }}>
          {card.title}
        </div>

        {/* Divider */}
        <div style={{
          width: 64,
          height: 1,
          background: "rgba(239,68,68,0.2)",
          marginBottom: 28,
          opacity: interpolate(subP,[0,1],[0,1]),
        }} />

        {/* Sub */}
        <div style={{
          fontSize: 36,
          color: "rgba(255,255,255,0.4)",
          lineHeight: 1.5,
          whiteSpace: "pre-line",
          fontFamily: FONT,
          letterSpacing: "-0.01em",
          opacity: interpolate(subP,[0,1],[0,1]),
          transform: `translateY(${interpolate(subP,[0,1],[14,0])}px)`,
        }}>
          {card.sub}
        </div>
      </div>

      {/* Progress indicator */}
      <div style={{
        position: "absolute",
        bottom: 52,
        display: "flex",
        gap: 10,
        alignItems: "center",
      }}>
        {CARDS.map((_, i) => (
          <div key={i} style={{
            width: i === index ? 32 : 6,
            height: 2,
            borderRadius: 1,
            background: i === index ? "rgba(239,68,68,0.55)" : "rgba(255,255,255,0.1)",
          }} />
        ))}
      </div>
    </div>
  );
}

export function Scene01Market() {
  return (
    <div style={{
      width: "100%", height: "100%",
      background: BG,
      position: "relative",
      overflow: "hidden",
    }}>
      {CARDS.map((_, i) => (
        <ProblemSlide key={i} index={i} />
      ))}
    </div>
  );
}

export const SCENE01_DURATION = CARDS.length * CARD_FRAMES + 24;
