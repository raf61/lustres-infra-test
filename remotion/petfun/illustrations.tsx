import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const G = "#4ade80";
const GD = "#16a34a";

function useSP(delay = 0, damping = 200) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config: { damping } });
}

/* ─── Reativação ─── dormant grid → pulse → light up ─── */
export function IlluReativacao() {
  const f = useCurrentFrame();
  const pulseP = useSP(10, 60);
  const activateP = useSP(24);

  const COLS = 7, ROWS = 5;
  const R = 7, GAP = 44;
  const W = COLS * GAP, H = ROWS * GAP;
  const OX = (420 - W) / 2 + GAP / 2;
  const OY = (320 - H) / 2 + GAP / 2;

  const pulseR = interpolate(pulseP, [0,1],[0, 180]);
  const pulseOp = interpolate(pulseP, [0,0.3,0.8,1],[0,0.5,0.5,0]);

  return (
    <svg width="420" height="320" viewBox="0 0 420 320" fill="none">
      <defs>
        <filter id="glow-r">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <radialGradient id="pulse-r" cx="50%" cy="50%">
          <stop offset="0%" stopColor={G} stopOpacity="0"/>
          <stop offset="70%" stopColor={G} stopOpacity="0.12"/>
          <stop offset="100%" stopColor={G} stopOpacity="0"/>
        </radialGradient>
      </defs>

      {/* Pulse ring */}
      <circle cx="210" cy="160" r={pulseR}
        stroke={G} strokeWidth="1" strokeOpacity={pulseOp} fill="none"/>
      <circle cx="210" cy="160" r={pulseR * 0.6}
        stroke={G} strokeWidth="0.5" strokeOpacity={pulseOp * 0.6} fill="none"/>

      {/* Dot grid */}
      {Array.from({ length: ROWS }).map((_, row) =>
        Array.from({ length: COLS }).map((_, col) => {
          const cx = OX + col * GAP;
          const cy = OY + row * GAP;
          const dist = Math.sqrt((cx - 210) ** 2 + (cy - 160) ** 2);
          const maxDist = 180;
          const threshold = interpolate(activateP, [0,1],[0, maxDist]);
          const isActive = dist < threshold;
          const dotOp = isActive
            ? interpolate(activateP, [0,1],[0.15, 1], { extrapolateLeft: "clamp" })
            : 0.12;
          return (
            <circle key={`${row}-${col}`}
              cx={cx} cy={cy} r={isActive ? R * 1.1 : R * 0.8}
              fill={isActive ? G : "rgba(255,255,255,0.18)"}
              opacity={dotOp}
              filter={isActive ? "url(#glow-r)" : undefined}
            />
          );
        })
      )}

      {/* Center origin */}
      <circle cx="210" cy="160" r="12"
        fill={`rgba(22,163,74,0.15)`} stroke={G} strokeWidth="1.5"
        opacity={interpolate(useSP(8), [0,1],[0,1])}/>
      <circle cx="210" cy="160" r="4" fill={G} opacity="0.9"
        filter="url(#glow-r)"/>
    </svg>
  );
}

/* ─── Atendimento 24h ─── real chat screen ─── */
export function IlluAtendimento() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  const msgs = [
    { from: "client", text: "Oi! Vocês fazem banho e tosa para golden?" },
    { from: "ai",     text: "Oi! Sim, fazemos 😊 Qual o tamanho do seu golden?" },
    { from: "client", text: "Médio porte, uns 30kg" },
    { from: "ai",     text: "Perfeito! Temos horário amanhã às 9h ou 14h. Qual prefere?" },
  ];

  const FONT = "system-ui, -apple-system, sans-serif";
  const W = 300, H = 310;

  return (
    <div style={{ width: W, height: H, position: "relative" }}>
      {/* Phone frame */}
      <div style={{
        width: W, height: H,
        background: "#111",
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.1)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          background: "#1a1a1a",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          opacity: interpolate(spring({ frame: f, fps, config: { damping: 200 } }), [0,1],[0,1]),
        }}>
          <div style={{ width: 32, height: 32, borderRadius: 16, background: "rgba(74,222,128,0.2)", border: "1px solid rgba(74,222,128,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 14 }}>🐾</div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: FONT }}>Pet Fun</div>
            <div style={{ fontSize: 10, color: G, fontFamily: FONT }}>● online agora</div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, padding: "12px 12px", display: "flex", flexDirection: "column", gap: 8, overflowY: "hidden" }}>
          {msgs.map((msg, i) => {
            const p = spring({ frame: f - (6 + i * 18), fps, config: { damping: 200 } });
            const isAI = msg.from === "ai";
            return (
              <div key={i} style={{
                display: "flex",
                justifyContent: isAI ? "flex-end" : "flex-start",
                opacity: interpolate(p, [0,1],[0,1]),
                transform: `translateY(${interpolate(p,[0,1],[10,0])}px)`,
              }}>
                <div style={{
                  maxWidth: "78%",
                  background: isAI ? "rgba(22,163,74,0.22)" : "rgba(255,255,255,0.07)",
                  border: isAI ? "1px solid rgba(74,222,128,0.25)" : "1px solid rgba(255,255,255,0.08)",
                  borderRadius: isAI ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
                  padding: "8px 12px",
                  fontSize: 11,
                  color: isAI ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.65)",
                  fontFamily: FONT,
                  lineHeight: 1.4,
                }}>
                  {msg.text}
                </div>
              </div>
            );
          })}
        </div>

        {/* Input bar */}
        <div style={{
          background: "#1a1a1a",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          padding: "8px 12px",
          display: "flex",
          gap: 8,
          alignItems: "center",
          opacity: interpolate(f, [30,46],[0,1],{ extrapolateLeft:"clamp", extrapolateRight:"clamp" }),
        }}>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 16, height: 28 }}/>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: "rgba(74,222,128,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize: 12 }}>↑</div>
        </div>
      </div>
    </div>
  );
}

/* ─── Agendamento ─── clean isometric calendar ─── */
export function IlluAgendamento() {
  const frameP = useSP(6);
  const cellsP = useSP(18);
  const checkP = useSP(40, 120);

  const COLS = 5, ROWS = 4;
  const CW = 52, CH = 38, GX = 6, GY = 6;
  const OX = (420 - (COLS * CW + (COLS-1) * GX)) / 2;
  const OY = 100;
  const TARGET_COL = 3, TARGET_ROW = 2;

  return (
    <svg width="420" height="320" viewBox="0 0 420 320" fill="none">
      <defs>
        <filter id="glow-c">
          <feGaussianBlur stdDeviation="5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <linearGradient id="cell-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={G} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={GD} stopOpacity="0.1"/>
        </linearGradient>
      </defs>

      {/* Frame */}
      <g opacity={interpolate(frameP,[0,1],[0,1])}>
        <rect x={OX - 14} y={OY - 44} width={COLS * (CW+GX) + 22} height={ROWS * (CH+GY) + 64} rx="14"
          fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.09)" strokeWidth="1"/>
        <rect x={OX - 14} y={OY - 44} width={COLS * (CW+GX) + 22} height="36" rx="14"
          fill="rgba(255,255,255,0.04)"/>
        <rect x={OX - 14} y={OY - 22} width={COLS * (CW+GX) + 22} height="14"
          fill="rgba(255,255,255,0.04)"/>
        <circle cx={OX + 10} cy={OY - 26} r="5" fill="rgba(255,255,255,0.15)"/>
        <circle cx={OX + COLS*(CW+GX) - 4} cy={OY - 26} r="5" fill="rgba(255,255,255,0.15)"/>
      </g>

      {/* Cells */}
      {Array.from({length: ROWS}).map((_, row) =>
        Array.from({length: COLS}).map((_, col) => {
          const x = OX + col * (CW + GX);
          const y = OY + row * (CH + GY);
          const isTarget = col === TARGET_COL && row === TARGET_ROW;
          const cellOp = interpolate(cellsP,[0,1],[0,1]);
          return (
            <rect key={`${row}-${col}`} x={x} y={y} width={CW} height={CH} rx="7"
              fill={isTarget ? "url(#cell-g)" : "rgba(255,255,255,0.04)"}
              stroke={isTarget ? `rgba(74,222,128,0.45)` : "rgba(255,255,255,0.07)"}
              strokeWidth={isTarget ? "1.5" : "1"}
              opacity={cellOp}
              filter={isTarget ? "url(#glow-c)" : undefined}
            />
          );
        })
      )}

      {/* Checkmark on target */}
      <g opacity={interpolate(checkP,[0,1],[0,1])}
         transform={`scale(${interpolate(checkP,[0,1],[0.4,1])})`}
         style={{ transformOrigin: `${OX + TARGET_COL*(CW+GX) + CW/2}px ${OY + TARGET_ROW*(CH+GY) + CH/2}px` }}>
        {(() => {
          const cx = OX + TARGET_COL*(CW+GX) + CW/2;
          const cy = OY + TARGET_ROW*(CH+GY) + CH/2;
          return <>
            <line x1={cx-10} y1={cy} x2={cx-3} y2={cy+8} stroke={G} strokeWidth="2.5" strokeLinecap="round"/>
            <line x1={cx-3} y1={cy+8} x2={cx+10} y2={cy-8} stroke={G} strokeWidth="2.5" strokeLinecap="round"/>
          </>;
        })()}
      </g>
    </svg>
  );
}

/* ─── Gestor ─── search input screen ─── */
export function IlluGestor() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const FONT = "system-ui, -apple-system, sans-serif";

  const QUESTION = "Quantos leads entraram no WhatsApp da loja hoje?";
  const charsVisible = Math.floor(interpolate(f, [12, 44], [0, QUESTION.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const typedText = QUESTION.slice(0, charsVisible);

  const frameOp = interpolate(spring({ frame: f, fps, config: { damping: 200 } }), [0,1],[0,1]);
  const resultP = spring({ frame: f - 52, fps, config: { damping: 200 } });

  return (
    <div style={{ width: 340, fontFamily: FONT }}>
      {/* Window frame */}
      <div style={{
        background: "#111",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.1)",
        overflow: "hidden",
        opacity: frameOp,
        transform: `translateY(${interpolate(frameOp,[0,1],[16,0])}px)`,
      }}>
        {/* Title bar */}
        <div style={{ background: "#1a1a1a", padding: "10px 14px", display: "flex", alignItems: "center", gap: 6, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: "rgba(239,68,68,0.5)" }}/>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: "rgba(251,191,36,0.5)" }}/>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: "rgba(74,222,128,0.5)" }}/>
          <div style={{ flex: 1, textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Vopy — I.A do Gestor</div>
        </div>

        {/* Search area */}
        <div style={{ padding: "16px 14px" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>Pergunte sobre o seu negócio</div>
          <div style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(74,222,128,0.3)",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 12,
            color: "rgba(255,255,255,0.85)",
            lineHeight: 1.5,
            minHeight: 48,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}>
            <span>{typedText}</span>
            <span style={{ width: 1.5, height: 14, background: G, opacity: f % 20 < 10 ? 1 : 0 }}/>
          </div>
        </div>

        {/* Result */}
        <div style={{
          margin: "0 14px 14px",
          background: "rgba(22,163,74,0.1)",
          border: "1px solid rgba(74,222,128,0.2)",
          borderRadius: 10,
          padding: "12px 14px",
          opacity: interpolate(resultP,[0,1],[0,1]),
          transform: `translateY(${interpolate(resultP,[0,1],[12,0])}px)`,
        }}>
          <div style={{ fontSize: 10, color: "rgba(74,222,128,0.6)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>Resposta</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: G, lineHeight: 1 }}>47 leads</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>↑ 12 a mais que ontem</div>
        </div>
      </div>
    </div>
  );
}

/* ─── ERP Integration ─── data sync visualization ─── */
export function IlluERP() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const FONT = "system-ui, -apple-system, sans-serif";

  const frameOp = spring({ frame: f, fps, config: { damping: 200 } });

  const rows = [
    { label: "Estoque", value: "342 itens", icon: "📦" },
    { label: "Última compra", value: "Maria · R$189", icon: "🧾" },
    { label: "Histórico", value: "14 visitas", icon: "📋" },
    { label: "Pet", value: "Luna, Golden", icon: "🐾" },
  ];

  return (
    <div style={{
      width: 340, fontFamily: FONT,
      opacity: interpolate(frameOp,[0,1],[0,1]),
      transform: `translateY(${interpolate(frameOp,[0,1],[16,0])}px)`,
    }}>
      <div style={{ background: "#111", borderRadius: 16, border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden" }}>
        {/* Title bar */}
        <div style={{ background: "#1a1a1a", padding: "10px 14px", display: "flex", alignItems: "center", gap: 6, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: "rgba(239,68,68,0.5)" }}/>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: "rgba(251,191,36,0.5)" }}/>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: "rgba(74,222,128,0.5)" }}/>
          <div style={{ flex: 1, textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>ERP · Sincronizado</div>
          <div style={{ fontSize: 9, color: G, background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 4, padding: "2px 6px" }}>● ao vivo</div>
        </div>

        {/* Data rows */}
        <div style={{ padding: "8px 0" }}>
          {rows.map((row, i) => {
            const rowP = spring({ frame: f - (8 + i * 14), fps, config: { damping: 200 } });
            return (
              <div key={i} style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 14px",
                borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                opacity: interpolate(rowP,[0,1],[0,1]),
                transform: `translateX(${interpolate(rowP,[0,1],[-12,0])}px)`,
              }}>
                <div style={{ fontSize: 16, marginRight: 10 }}>{row.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>{row.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{row.value}</div>
                </div>
                <div style={{
                  width: 6, height: 6, borderRadius: 3,
                  background: G,
                  opacity: interpolate(rowP,[0,1],[0,0.8]),
                  boxShadow: `0 0 6px ${G}`,
                }}/>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          background: "rgba(22,163,74,0.06)",
          borderTop: "1px solid rgba(74,222,128,0.12)",
          padding: "8px 14px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          opacity: interpolate(spring({ frame: f - 60, fps, config: { damping: 200 } }), [0,1],[0,1]),
        }}>
          <div style={{ fontSize: 11, color: "rgba(74,222,128,0.7)" }}>↓ puxado direto do ERP</div>
        </div>
      </div>
    </div>
  );
}

/* ─── CRM ─── lead card auto-created ─── */
export function IlluCRM() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const FONT = "system-ui, -apple-system, sans-serif";

  const frameOp = spring({ frame: f, fps, config: { damping: 200 } });

  const fields = [
    { label: "Lead", value: "Maria Fernanda", color: "rgba(255,255,255,0.9)" },
    { label: "Serviço", value: "Banho + Tosa", color: "rgba(255,255,255,0.75)" },
    { label: "Status", value: "🟢 Qualificado", color: G },
    { label: "Próximo passo", value: "Confirmar agendamento", color: "rgba(255,255,255,0.6)" },
  ];

  const tagP = spring({ frame: f - 52, fps, config: { damping: 200 } });

  return (
    <div style={{
      width: 340, fontFamily: FONT,
      opacity: interpolate(frameOp,[0,1],[0,1]),
      transform: `translateY(${interpolate(frameOp,[0,1],[16,0])}px)`,
    }}>
      <div style={{ background: "#111", borderRadius: 16, border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ background: "#1a1a1a", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>CRM · Novo lead</span>
          <span style={{
            fontSize: 9, color: G,
            background: "rgba(74,222,128,0.1)",
            border: "1px solid rgba(74,222,128,0.25)",
            borderRadius: 4, padding: "2px 6px",
            opacity: interpolate(tagP,[0,1],[0,1]),
            transform: `scale(${interpolate(tagP,[0,1],[0.8,1])})`,
            display: "inline-block",
          }}>criado automaticamente</span>
        </div>

        {/* Avatar + name */}
        <div style={{ padding: "14px 14px 6px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 20,
            background: "rgba(74,222,128,0.15)",
            border: "1px solid rgba(74,222,128,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>🐾</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>Maria Fernanda</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>via WhatsApp · agora</div>
          </div>
        </div>

        {/* Fields */}
        <div style={{ padding: "4px 0 8px" }}>
          {fields.slice(1).map((field, i) => {
            const fP = spring({ frame: f - (18 + i * 14), fps, config: { damping: 200 } });
            return (
              <div key={i} style={{
                padding: "8px 14px",
                borderTop: "1px solid rgba(255,255,255,0.04)",
                opacity: interpolate(fP,[0,1],[0,1]),
                transform: `translateX(${interpolate(fP,[0,1],[-10,0])}px)`,
              }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 2 }}>{field.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: field.color }}>{field.value}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Visibilidade ─── real dashboard ─── */
export function IlluVisibilidade() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const FONT = "system-ui, -apple-system, sans-serif";

  const frameP = spring({ frame: f, fps, config: { damping: 200 } });
  const kpisP  = spring({ frame: f - 10, fps, config: { damping: 200 } });
  const chartP = spring({ frame: f - 28, fps, config: { damping: 200 } });

  const kpis = [
    { label: "Leads hoje",    val: "47",   delta: "+12",  color: G },
    { label: "Conversão",     val: "34%",  delta: "+4%",  color: G },
    { label: "Tempo resposta",val: "< 1m", delta: "✓",    color: G },
    { label: "Perdas",        val: "8",    delta: "-3",   color: "#f87171" },
  ];

  const bars = [28, 42, 35, 58, 47, 62, 54];

  return (
    <div style={{
      width: 340,
      fontFamily: FONT,
      opacity: interpolate(frameP,[0,1],[0,1]),
      transform: `translateY(${interpolate(frameP,[0,1],[16,0])}px)`,
    }}>
      <div style={{
        background: "#111",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.1)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ background: "#1a1a1a", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>Dashboard</span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>Hoje · em tempo real</span>
        </div>

        {/* KPI grid */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 1, background: "rgba(255,255,255,0.05)",
          opacity: interpolate(kpisP,[0,1],[0,1]),
          transform: `translateY(${interpolate(kpisP,[0,1],[10,0])}px)`,
        }}>
          {kpis.map((k, i) => (
            <div key={i} style={{ background: "#111", padding: "12px 14px" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>{k.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.val}</span>
                <span style={{ fontSize: 10, color: i === 3 ? "rgba(248,113,113,0.7)" : "rgba(74,222,128,0.7)" }}>{k.delta}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <div style={{
          padding: "12px 14px",
          opacity: interpolate(chartP,[0,1],[0,1]),
          transform: `translateY(${interpolate(chartP,[0,1],[10,0])}px)`,
        }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginBottom: 8 }}>Leads por dia (últimos 7 dias)</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 48 }}>
            {bars.map((h, i) => (
              <div key={i} style={{
                flex: 1,
                height: `${(h / 70) * 100}%`,
                background: i === 5 ? G : `rgba(74,222,128,${0.2 + (h/70)*0.3})`,
                borderRadius: "3px 3px 0 0",
              }}/>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
