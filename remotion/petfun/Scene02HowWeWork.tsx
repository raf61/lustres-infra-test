import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BG, GREEN, FONT, SceneNum } from "./shared";

const STEPS = [
  { n: "01", title: "Diagnóstico completo primeiro", desc: "Mapeamos a operação inteira antes de construir qualquer coisa." },
  { n: "02", title: "Solução aplicada sob medida", desc: "Cada detalhe feito para a Pet Fun. Não adaptado — construído." },
  { n: "03", title: "Integrado ao seu ERP", desc: "Lemos estoque e histórico do seu sistema em tempo real." },
  { n: "04", title: "Treinamento do time incluído", desc: "Treinamos a equipe. Acompanhamos até funcionar no nível esperado." },
  { n: "05", title: "Nossa visão sobre I.A", desc: "Não só o software — a estratégia de como I.A transforma a operação." },
];

export function Scene02HowWeWork() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleP = spring({ frame: frame - 5, fps, config: { damping: 200 } });

  return (
    <div style={{
      width: "100%", height: "100%",
      background: BG,
      display: "flex",
      fontFamily: FONT,
      padding: "0 140px",
      alignItems: "center",
      gap: 100,
    }}>
      {/* Left */}
      <div style={{ width: 380, flexShrink: 0 }}>
        <SceneNum num="02" />
        <div style={{
          fontSize: 52,
          fontWeight: 700,
          color: "#fff",
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
          marginBottom: 20,
          opacity: interpolate(titleP, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(titleP, [0, 1], [28, 0])}px)`,
        }}>
          A diferença é que nossa solução é feita sob medida.
        </div>
        <div style={{
          fontSize: 18,
          color: "rgba(255,255,255,0.32)",
          lineHeight: 1.6,
          opacity: interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" }),
        }}>
          Antes de agir, conhecemos a operação por completo.
        </div>
        <div style={{
          marginTop: 32,
          height: 3,
          width: interpolate(
            spring({ frame: frame - 32, fps, config: { damping: 200 } }),
            [0, 1], [0, 80]
          ),
          background: GREEN,
          borderRadius: 2,
          opacity: 0.6,
        }} />
      </div>

      {/* Right: steps */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {STEPS.map((s, i) => {
          const p = spring({ frame: frame - (22 + i * 16), fps, config: { damping: 200 } });
          return (
            <div key={s.n} style={{
              display: "flex",
              gap: 28,
              alignItems: "flex-start",
              padding: "20px 0",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              opacity: interpolate(p, [0, 1], [0, 1]),
              transform: `translateX(${interpolate(p, [0, 1], [-20, 0])}px)`,
            }}>
              <span style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(74,222,128,0.4)", fontWeight: 700, paddingTop: 3, width: 26, flexShrink: 0 }}>{s.n}</span>
              <div>
                <div style={{ fontSize: 19, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 15, color: "rgba(255,255,255,0.36)", lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
