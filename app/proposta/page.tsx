import type { Metadata } from "next"
import Image from "next/image"

export const metadata: Metadata = {
  title: "Proposta: Vopy — Casarão Lustres",
  description: "Infraestrutura de Inteligência Artificial para a operação comercial da Casarão Lustres",
}

/* ─── Illustrations ────────────────────────────────────────────────── */

function IlluResponseTime() {
  return (
    <svg width="52" height="40" viewBox="0 0 52 40" fill="none" aria-hidden>
      <rect x="2" y="2" width="28" height="18" rx="3" stroke="#4ade80" strokeWidth="1.5" fill="none"/>
      <circle cx="9" cy="11" r="2" fill="#4ade80" opacity=".5"/>
      <circle cx="15" cy="11" r="2" fill="#4ade80" opacity=".5"/>
      <circle cx="21" cy="11" r="2" fill="#4ade80" opacity=".5"/>
      <path d="M7 20l3-3" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="40" cy="26" r="11" stroke="white" strokeWidth="1.5" strokeOpacity=".2" fill="none"/>
      <path d="M40 20v6.5l3 3" stroke="white" strokeWidth="1.5" strokeOpacity=".4" strokeLinecap="round"/>
    </svg>
  )
}

function IlluBase() {
  return (
    <svg width="52" height="40" viewBox="0 0 52 40" fill="none" aria-hidden>
      <ellipse cx="26" cy="9" rx="16" ry="5" stroke="#4ade80" strokeWidth="1.5" fill="none"/>
      <path d="M10 9v9c0 2.761 7.163 5 16 5s16-2.239 16-5V9" stroke="#4ade80" strokeWidth="1.5" strokeOpacity=".5" fill="none"/>
      <path d="M10 18v7c0 2.761 7.163 5 16 5s16-2.239 16-5v-7" stroke="#4ade80" strokeWidth="1.5" strokeOpacity=".25" fill="none"/>
      <path d="M36 5h5M38 2.5h3" stroke="white" strokeWidth="1.5" strokeOpacity=".3" strokeLinecap="round"/>
    </svg>
  )
}

function IlluControl() {
  return (
    <svg width="52" height="40" viewBox="0 0 52 40" fill="none" aria-hidden>
      <rect x="2" y="4" width="48" height="30" rx="3" stroke="white" strokeWidth="1.5" strokeOpacity=".15" fill="none"/>
      <rect x="8" y="22" width="7" height="8" rx="1" fill="#4ade80" opacity=".3"/>
      <rect x="19" y="15" width="7" height="15" rx="1" fill="#4ade80" opacity=".5"/>
      <rect x="30" y="18" width="7" height="12" rx="1" fill="#4ade80" opacity=".4"/>
      <rect x="41" y="11" width="7" height="19" rx="1" fill="#4ade80" opacity=".7"/>
      <path d="M23 9l5 5M28 9l-5 5" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeOpacity=".6"/>
    </svg>
  )
}

function IlluAI() {
  return (
    <svg width="72" height="48" viewBox="0 0 72 48" fill="none" aria-hidden>
      <circle cx="10" cy="16" r="7" stroke="white" strokeWidth="1.5" strokeOpacity=".3" fill="none"/>
      <path d="M3 36c0-5 3.134-9 7-9s7 4 7 9" stroke="white" strokeWidth="1.5" strokeOpacity=".3" strokeLinecap="round" fill="none"/>
      <path d="M22 24h10" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M28 20l4 4-4 4" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="34" y="16" width="16" height="16" rx="4" fill="#16a34a" opacity=".2" stroke="#16a34a" strokeWidth="1.5"/>
      <path d="M38 24h8M42 20v8" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M52 24h10" stroke="white" strokeWidth="1.5" strokeOpacity=".4" strokeLinecap="round"/>
      <path d="M58 20l4 4-4 4" stroke="white" strokeWidth="1.5" strokeOpacity=".4" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="68" cy="16" r="5" stroke="white" strokeWidth="1.5" strokeOpacity=".5" fill="none"/>
      <path d="M62 36c0-4 2.686-7 6-7s6 3 6 7" stroke="white" strokeWidth="1.5" strokeOpacity=".5" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

function IlluKanban() {
  return (
    <svg width="72" height="48" viewBox="0 0 72 48" fill="none" aria-hidden>
      {[8, 28, 48].map((x, i) => (
        <g key={x}>
          <rect x={x} y="4" width="16" height="6" rx="2" fill="white" opacity=".1"/>
          <rect x={x} y="14" width="16" height="8" rx="2" fill="#4ade80" opacity={0.15 + i * 0.1}/>
          <rect x={x} y="26" width="16" height="8" rx="2" fill="#4ade80" opacity={0.1 + i * 0.08}/>
          {i < 2 && <rect x={x} y="38" width="16" height="6" rx="2" fill="white" opacity=".06"/>}
        </g>
      ))}
    </svg>
  )
}

function IlluWhatsApp() {
  return (
    <svg width="72" height="48" viewBox="0 0 72 48" fill="none" aria-hidden>
      <rect x="28" y="12" width="16" height="24" rx="4" stroke="#4ade80" strokeWidth="1.5" fill="none"/>
      <circle cx="36" cy="32" r="2" fill="#4ade80" opacity=".6"/>
      <rect x="31" y="16" width="10" height="2" rx="1" fill="#4ade80" opacity=".3"/>
      <path d="M10 14h16" stroke="white" strokeWidth="1.25" strokeOpacity=".3" strokeLinecap="round"/>
      <path d="M10 24h16" stroke="white" strokeWidth="1.25" strokeOpacity=".3" strokeLinecap="round"/>
      <path d="M10 34h16" stroke="white" strokeWidth="1.25" strokeOpacity=".3" strokeLinecap="round"/>
      <path d="M46 14h16" stroke="white" strokeWidth="1.25" strokeOpacity=".3" strokeLinecap="round"/>
      <path d="M46 24h16" stroke="white" strokeWidth="1.25" strokeOpacity=".3" strokeLinecap="round"/>
      <path d="M46 34h16" stroke="white" strokeWidth="1.25" strokeOpacity=".3" strokeLinecap="round"/>
      {[14, 24, 34].map(y => <circle key={y} cx="10" cy={y} r="3" fill="white" opacity=".2"/>)}
      {[14, 24, 34].map(y => <circle key={y + "r"} cx="62" cy={y} r="3" fill="white" opacity=".2"/>)}
    </svg>
  )
}

function IlluDashboard() {
  return (
    <svg width="72" height="48" viewBox="0 0 72 48" fill="none" aria-hidden>
      <rect x="4" y="4" width="64" height="40" rx="4" stroke="white" strokeWidth="1.25" strokeOpacity=".15" fill="none"/>
      <rect x="9" y="9" width="18" height="11" rx="2" fill="#4ade80" opacity=".12"/>
      <rect x="31" y="9" width="18" height="11" rx="2" fill="#4ade80" opacity=".12"/>
      <rect x="53" y="9" width="11" height="11" rx="2" fill="#4ade80" opacity=".12"/>
      <rect x="9" y="24" width="55" height="16" rx="2" fill="white" opacity=".04"/>
      <polyline points="12,36 22,30 32,33 42,26 52,29 62,24" stroke="#4ade80" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity=".7"/>
    </svg>
  )
}

function IlluReativacao() {
  return (
    <svg width="72" height="48" viewBox="0 0 72 48" fill="none" aria-hidden>
      {[38, 30, 22].map((y, i) => (
        <rect key={y} x="10" y={y} width="28" height="9" rx="2" fill="white" opacity={0.05 + i * 0.04} stroke="white" strokeWidth="1" strokeOpacity={0.1 + i * 0.05}/>
      ))}
      <path d="M42 24h12" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M50 20l4 4-4 4" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M58 14l-3 8h5l-3 8" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".8"/>
    </svg>
  )
}

function IlluTreinamento() {
  return (
    <svg width="72" height="48" viewBox="0 0 72 48" fill="none" aria-hidden>
      {/* people */}
      {[16, 36, 56].map((cx, i) => (
        <g key={cx}>
          <circle cx={cx} cy="16" r="6" stroke="#4ade80" strokeWidth="1.25" strokeOpacity={0.3 + i * 0.15} fill="none"/>
          <path d={`M${cx - 7} 36c0-4 3.134-7 7-7s7 3 7 7`} stroke="#4ade80" strokeWidth="1.25" strokeOpacity={0.3 + i * 0.15} strokeLinecap="round" fill="none"/>
        </g>
      ))}
      {/* connection lines */}
      <path d="M23 20l10 0" stroke="white" strokeWidth="1" strokeOpacity=".15" strokeLinecap="round"/>
      <path d="M43 20l10 0" stroke="white" strokeWidth="1" strokeOpacity=".15" strokeLinecap="round"/>
    </svg>
  )
}

/* ─── Check icon ───────────────────────────────────────────────────── */
function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 mt-0.5" aria-hidden>
      <circle cx="7" cy="7" r="6.25" stroke="#16a34a" strokeWidth="1.25"/>
      <path d="M4.5 7l2 2 3-3.5" stroke="#4ade80" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

/* ─── Page ─────────────────────────────────────────────────────────── */
export default function PropostaPage() {
  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>

      {/* ── HEADER ── */}
      <header className="border-b border-white/[0.07] px-5 py-5 md:px-14">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Image src="/casarao.jpg" alt="Casarão Lustres" width={200} height={64} className="h-20 w-auto object-contain" />
          <div className="h-5 w-px bg-white/10" />
          <Image src="/vopy.jpeg" alt="Vopy" width={100} height={32} className="h-8 w-auto object-contain" />
        </div>
      </header>

      {/* ── CAPA ── */}
      <section className="px-5 pt-14 pb-16 md:px-14 md:pt-20 md:pb-24 border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto">
          <p className="text-white/30 text-xs tracking-widest uppercase mb-8">Proposta Comercial · Abril 2025</p>
          <h1 className="text-[2rem] md:text-[2.75rem] font-bold leading-[1.2] tracking-tight mb-5 max-w-2xl">
            Infraestrutura de I.A para a operação comercial da Casarão Lustres
          </h1>
        </div>
      </section>

      {/* ── 01 · PONTOS CENTRAIS ── */}
      <section className="px-5 py-14 md:px-14 md:py-20 border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto">
          <p className="text-[#16a34a] text-xs font-medium uppercase tracking-[0.15em] mb-2">01</p>
          <h2 className="text-xl md:text-2xl font-bold mb-2">Pontos centrais</h2>
          <p className="text-white/35 text-sm mb-10">O que identificamos na operação atual.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                Ilu: IlluResponseTime,
                title: "Velocidade de atendimento",
                desc: "O intervalo entre o contato do cliente e a resposta do vendedor é onde as oportunidades se perdem. Velocidade é conversão.",
              },
              {
                Ilu: IlluControl,
                title: "Falta de controle sobre atendimentos",
                desc: "Sem visibilidade centralizada, fica difícil acompanhar o time, identificar gargalos e tomar decisões com base em dados reais.",
              },
              {
                Ilu: IlluBase,
                title: "Base de clientes inexplorada",
                desc: "Há uma carteira com histórico de compra sem ativação sistemática. Reativação estruturada transforma contatos dormentes em receita recorrente.",
              },
            ].map(({ Ilu, title, desc }) => (
              <div key={title} className="p-5 rounded-xl border border-white/[0.07] bg-white/[0.02] flex flex-col gap-5">
                <Ilu />
                <div>
                  <p className="font-semibold text-white text-sm mb-2">{title}</p>
                  <p className="text-white/40 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 02 · O QUE IMPLEMENTAMOS ── */}
      <section className="px-5 py-14 md:px-14 md:py-20 border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto">
          <p className="text-[#16a34a] text-xs font-medium uppercase tracking-[0.15em] mb-2">02</p>
          <h2 className="text-xl md:text-2xl font-bold mb-2">O que implementamos</h2>
          <p className="text-white/35 text-sm mb-10">Cada entregável resolve um ponto da operação.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              {
                Ilu: IlluAI,
                title: "I.A de atendimento",
                desc: "Agente treinado com o processo de venda da Casarão. Atende imediatamente, qualifica o lead e entrega a conversa pronta para o vendedor fechar.",
              },
              {
                Ilu: IlluKanban,
                title: "CRM centralizado",
                desc: "Pipeline Kanban por vendedor, com visão consolidada para gestão. Carteira, histórico e andamento de cada negócio em um só lugar.",
              },
              {
                Ilu: IlluWhatsApp,
                title: "WhatsApp centralizado",
                desc: "Roteamento inteligente — cada cliente vai para o vendedor certo, com histórico completo.",
              },
              {
                Ilu: IlluDashboard,
                title: "Dashboards de performance",
                desc: "Leads por dia, conversão por vendedor, tempo de resposta, carteira ativa. A operação se torna mensurável.",
              },
              {
                Ilu: IlluReativacao,
                title: "Reativação da base",
                desc: "Campanhas automatizadas e segmentadas para contatos antigos e leads em aberto. Mais receita com a base que vocês já têm.",
              },
              {
                Ilu: IlluTreinamento,
                title: "Treinamento e suporte",
                desc: "Entramos na operação, treinamos o time e acompanhamos o uso no dia a dia — até a estrutura estar rodando de forma autônoma.",
              },
            ].map(({ Ilu, title, desc }) => (
              <div key={title} className="flex flex-col gap-4 p-5 rounded-xl border border-white/[0.07] bg-white/[0.02]">
                <Ilu />
                <div>
                  <p className="font-semibold text-white text-sm mb-1.5">{title}</p>
                  <p className="text-white/40 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 03 · IMPLANTAÇÃO ── */}
      <section className="px-5 py-14 md:px-14 md:py-20 border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto">
          <p className="text-[#16a34a] text-xs font-medium uppercase tracking-[0.15em] mb-2">03</p>
          <h2 className="text-xl md:text-2xl font-bold mb-2">Implantação</h2>
          <p className="text-white/35 text-sm mb-10">Processo em três fases, com escopo claro em cada uma.</p>

          {/* timeline desktop */}
          <div className="mb-10 hidden md:flex items-center">
            {[
              { label: "Diagnóstico", sub: "4–7 dias" },
              { label: "Implantação", sub: "30–50 dias" },
              { label: "Acompanhamento", sub: "10 dias" },
            ].map((item, i, arr) => (
              <div key={item.label} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full border-2 border-[#16a34a] bg-[#0c0c0c] flex items-center justify-center">
                    <span className="text-[#4ade80] text-xs font-bold">{i}</span>
                  </div>
                  <p className="text-white text-xs font-semibold mt-2 whitespace-nowrap">{item.label}</p>
                  <p className="text-white/30 text-xs mt-0.5">{item.sub}</p>
                </div>
                {i < arr.length - 1 && (
                  <div className="flex-1 h-px bg-gradient-to-r from-[#16a34a]/50 to-[#16a34a]/20 mx-2 mb-6" />
                )}
              </div>
            ))}
          </div>

          <div className="divide-y divide-white/[0.06]">
            {[
              {
                num: "00",
                phase: "Diagnóstico",
                duration: "4–7 dias",
                desc: "Mapeamos a operação completa — atendimento, time comercial, integrações e base de dados. Saímos com o plano de implantação fechado.",
                resp: "Participação da equipe para alinhamento de processo.",
              },
              {
                num: "01",
                phase: "Implantação",
                duration: "30–50 dias",
                desc: "Plataforma configurada, I.A parametrizada com o processo de venda da Casarão, integrações ativas e time treinado. Go-live com acompanhamento próximo.",
                resp: "Acesso ao Protheus, números de WhatsApp, base de contatos e catálogo de produtos.",
              },
              {
                num: "02",
                phase: "Acompanhamento",
                duration: "10 dias",
                desc: "Primeiros ciclos monitorados de perto. Ajustes finos no comportamento da I.A e na operação até tudo rodar no nível esperado.",
                resp: "Feedback do time sobre o uso no dia a dia.",
              },
            ].map((item) => (
              <div key={item.num} className="py-7 flex flex-col sm:flex-row gap-4 sm:gap-8">
                <div className="flex-shrink-0 w-16">
                  <span className="font-mono text-[#16a34a]/50 text-xs font-bold">{item.num}</span>
                </div>
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mb-3">
                    <span className="font-bold text-white text-base">{item.phase}</span>
                    <span className="text-white/25 text-xs hidden sm:block">·</span>
                    <span className="text-white/35 text-xs">{item.duration}</span>
                  </div>
                  <p className="text-white/50 text-sm leading-relaxed mb-3">{item.desc}</p>
                  <div className="flex items-start gap-2 text-xs text-white/25 border-l-2 border-white/10 pl-3">
                    <span className="font-medium text-white/20 flex-shrink-0">Requer:</span>
                    <span>{item.resp}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 04 · ESCOPO TÉCNICO ── */}
      <section className="px-5 py-14 md:px-14 md:py-20 border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto">
          <p className="text-[#16a34a] text-xs font-medium uppercase tracking-[0.15em] mb-2">04</p>
          <h2 className="text-xl md:text-2xl font-bold mb-2">Escopo técnico</h2>
          <p className="text-white/35 text-sm mb-10">Tudo que está incluído no contrato.</p>

          <div className="space-y-8">
            {[
              {
                area: "Atendimento",
                items: ["Agente de I.A no WhatsApp", "Handoff automático para vendedor", "Padronização do processo de venda"],
              },
              {
                area: "Gestão comercial",
                items: ["CRM Kanban por vendedor", "Visão gerencial consolidada", "Dashboards de performance"],
              },
              {
                area: "Base de clientes",
                items: ["Banco de dados comercial unificado", "Segmentação por perfil e histórico", "Campanhas de reativação e follow-up"],
              },
              {
                area: "Integrações",
                items: ["WhatsApp Business centralizado", "Integração com Protheus"],
              },
              {
                area: "Implantação",
                items: ["Treinamento do time", "Documentação dos processos", "Suporte durante a vigência"],
              },
            ].map(({ area, items }) => (
              <div key={area} className="flex flex-col sm:flex-row gap-4 sm:gap-8 py-5 border-b border-white/[0.05]">
                <p className="text-white/30 text-xs font-semibold uppercase tracking-widest flex-shrink-0 w-32 pt-0.5">{area}</p>
                <div className="flex flex-col gap-2">
                  {items.map((item) => (
                    <div key={item} className="flex items-start gap-2.5 text-sm text-white/55">
                      <Check />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 05 · RESULTADOS ESPERADOS ── */}
      <section className="px-5 py-14 md:px-14 md:py-20 border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto">
          <p className="text-[#16a34a] text-xs font-medium uppercase tracking-[0.15em] mb-2">05</p>
          <h2 className="text-xl md:text-2xl font-bold mb-2">Resultados esperados</h2>
          <p className="text-white/35 text-sm mb-10">O que a operação entrega ao final da implantação.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              {
                value: "Atendimento imediato",
                desc: "Todo cliente respondido na hora — sem depender da disponibilidade do vendedor.",
                Ilu: () => (
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
                    <circle cx="16" cy="16" r="13" stroke="#16a34a" strokeWidth="1.5" fill="none" strokeOpacity=".4"/>
                    <path d="M16 9v7.5l4 4" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ),
              },
              {
                value: "Maior conversão no WhatsApp",
                desc: "I.A qualifica e entrega leads prontos para o vendedor fechar.",
                Ilu: () => (
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
                    <polyline points="4,24 10,18 16,21 22,12 28,7" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity=".8"/>
                    <path d="M24 7h4v4" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity=".5"/>
                  </svg>
                ),
              },
              {
                value: "Receita recuperada da base",
                desc: "Contatos antigos e leads frios reativados de forma automática e segmentada.",
                Ilu: () => (
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
                    <path d="M8 22c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" fill="none" strokeOpacity=".4"/>
                    <path d="M16 14V8" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M13 11l3-3 3 3" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ),
              },
              {
                value: "Clientes organizados",
                desc: "Base de dados limpa, segmentada e com histórico completo de cada contato.",
                Ilu: () => (
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
                    <rect x="5" y="7" width="22" height="4" rx="2" fill="#4ade80" opacity=".15" stroke="#16a34a" strokeWidth="1.25" strokeOpacity=".5"/>
                    <rect x="5" y="14" width="22" height="4" rx="2" fill="#4ade80" opacity=".1" stroke="#16a34a" strokeWidth="1.25" strokeOpacity=".35"/>
                    <rect x="5" y="21" width="22" height="4" rx="2" fill="#4ade80" opacity=".06" stroke="#16a34a" strokeWidth="1.25" strokeOpacity=".2"/>
                  </svg>
                ),
              },
              {
                value: "Dados claros sobre tudo",
                desc: "Performance do time, leads, conversão e receita — tudo mensurável e visível.",
                Ilu: () => (
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
                    <rect x="5" y="20" width="5" height="8" rx="1" fill="#4ade80" opacity=".3"/>
                    <rect x="13" y="14" width="5" height="14" rx="1" fill="#4ade80" opacity=".5"/>
                    <rect x="21" y="8" width="5" height="20" rx="1" fill="#4ade80" opacity=".7"/>
                  </svg>
                ),
              },
            ].map(({ value, desc, Ilu }) => (
              <div key={value} className="p-5 rounded-xl border border-white/[0.07] bg-white/[0.02] flex flex-col gap-4">
                <Ilu />
                <div>
                  <p className="font-semibold text-white text-sm mb-1.5">{value}</p>
                  <p className="text-white/40 text-xs leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 06 · INVESTIMENTO ── */}
      <section className="px-5 py-14 md:px-14 md:py-20 border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto">
          <p className="text-[#16a34a] text-xs font-medium uppercase tracking-[0.15em] mb-2">06</p>
          <h2 className="text-xl md:text-2xl font-bold mb-2">Investimento</h2>
          <p className="text-white/35 text-sm mb-10">Condições comerciais sem taxas ocultas.</p>

          <div className="rounded-2xl border border-white/[0.09] overflow-hidden">
            <div className="p-7 md:p-10 border-b border-white/[0.07]">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-4xl md:text-5xl font-bold">R$ 3.150</span>
                <span className="text-white/30 text-sm">/mês</span>
              </div>
              <p className="text-[#4ade80] text-sm mt-2">12 parcelas mensais · Sem taxa de implantação separada</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 divide-x divide-white/[0.07]">
              {[
                { label: "Prazo", value: "12 meses" },
                { label: "Total", value: "R$ 37.800" },
                { label: "Vigência", value: "A partir da assinatura" },
              ].map((item) => (
                <div key={item.label} className="p-5 md:p-6">
                  <p className="text-white/25 text-xs mb-2">{item.label}</p>
                  <p className="text-white font-semibold text-sm">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="px-5 py-7 md:px-14 border-t border-white/[0.07]">
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-white/20 text-xs">
          <Image src="/vopy.jpeg" alt="Vopy" width={52} height={18} className="h-4 w-auto object-contain opacity-30" />
          <span>Proposta válida por 30 dias · Confidencial</span>
        </div>
      </footer>

    </main>
  )
}
