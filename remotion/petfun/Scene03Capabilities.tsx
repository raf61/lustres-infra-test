import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BG, GREEN, GREEN_DARK } from "./shared";

const CAPABILITIES = [
  {
    num: "01",
    title: "Reativação de base",
    desc: "Milhares de clientes inativos reativados de forma personalizada — segmentados por serviço ou produto que já usaram. Em escala, sem nenhum esforço da equipe.",
  },
  {
    num: "02",
    title: "Atendimento 24h — lead pronto para o vendedor",
    desc: "Nenhum cliente espera. A I.A responde na hora, qualifica e entrega para o vendedor com o histórico e o pedido já estruturado. O vendedor só precisa fechar.",
  },
  {
    num: "03",
    title: "Agendamento automático",
    desc: "Consulta, banho e tosa marcados pelo WhatsApp. Sem formulário, sem link. A I.A verifica disponibilidade, confirma e lembra o cliente na hora certa.",
  },
  {
    num: "04",
    title: "I.A que responde sobre o negócio",
    desc: "Para o gestor: \"Quantos clientes compraram ração esse mês? Quantos desses voltaram?\" — resposta em segundos. Conectada ao ERP, sem precisar abrir relatório nenhum.",
  },
  {
    num: "05",
    title: "Dashboards sobre tudo",
    desc: "Quantidade de leads, tempo de resposta, taxa de conversão, motivos de perda — em dashboards em tempo real. Para tomar decisões com base no que realmente acontece.",
  },
];

// Show 2 at a time, paginating through with stagger
function CapabilityCard({ num, title, desc, delay }: { num: string; title: string; desc: string; delay: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(255,255,255,0.02)",
        borderRadius: 16,
        padding: "28px 32px",
        display: "flex",
        gap: 20,
        alignItems: "flex-start",
        opacity: interpolate(progress, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(progress, [0, 1], [28, 0])}px)`,
      }}
    >
      <span style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(74,222,128,0.4)", fontWeight: 700, flexShrink: 0, paddingTop: 3 }}>{num}</span>
      <div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.42)", lineHeight: 1.65 }}>{desc}</div>
      </div>
    </div>
  );
}

export function Scene03Capabilities() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleProgress = spring({ frame: frame - 5, fps, config: { damping: 200 } });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: BG,
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "60px 160px",
        justifyContent: "center",
        gap: 0,
      }}
    >
      <div style={{ opacity: interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" }), fontSize: 12, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase" as const, color: "#16a34a", marginBottom: 10 }}>03</div>
      <div
        style={{
          fontSize: 40,
          fontWeight: 700,
          color: "#fff",
          letterSpacing: "-0.01em",
          marginBottom: 32,
          opacity: interpolate(titleProgress, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(titleProgress, [0, 1], [24, 0])}px)`,
        }}
      >
        O que podemos construir para a Pet Fun
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {CAPABILITIES.map((cap, i) => (
          <CapabilityCard key={cap.num} {...cap} delay={18 + i * 22} />
        ))}
      </div>
    </div>
  );
}
