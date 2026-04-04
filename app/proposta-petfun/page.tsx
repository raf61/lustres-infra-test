import type { Metadata } from "next"
import Image from "next/image"

export const metadata: Metadata = {
  title: "Apresentação Inicial · Vopy × Pet Fun",
  description: "O que a Vopy pode construir para a rede Pet Fun.",
}

/* ─── SVG Illustrations ─────────────────────────────────────────────── */

function IlluCookieCutter() {
  return (
    <svg width="80" height="56" viewBox="0 0 80 56" fill="none" aria-hidden>
      {[4, 32, 60].map((x) => (
        <g key={x}>
          <rect x={x} y="10" width="16" height="22" rx="3" stroke="white" strokeWidth="1.2" strokeOpacity=".3" fill="white" fillOpacity=".04"/>
          <circle cx={x + 8} cy="20" r="4" stroke="white" strokeWidth="1" strokeOpacity=".25" fill="white" fillOpacity=".06"/>
          <rect x={x + 3} y="29" width="10" height="2" rx="1" fill="white" fillOpacity=".15"/>
        </g>
      ))}
    </svg>
  )
}

function IlluLocked() {
  return (
    <svg width="80" height="56" viewBox="0 0 80 56" fill="none" aria-hidden>
      <rect x="22" y="26" width="36" height="24" rx="4" stroke="white" strokeWidth="1.2" strokeOpacity=".3" fill="none"/>
      <path d="M30 26v-7a10 10 0 0120 0v7" stroke="white" strokeWidth="1.2" strokeOpacity=".3" strokeLinecap="round" fill="none"/>
      <circle cx="40" cy="37" r="4" fill="white" fillOpacity=".12" stroke="white" strokeWidth="1.2" strokeOpacity=".3"/>
      <rect x="39" y="40" width="2" height="5" rx="1" fill="white" fillOpacity=".2"/>
    </svg>
  )
}

function IlluDropped() {
  return (
    <svg width="80" height="56" viewBox="0 0 80 56" fill="none" aria-hidden>
      <rect x="8" y="18" width="30" height="22" rx="3" stroke="white" strokeWidth="1.2" strokeOpacity=".3" fill="none"/>
      <path d="M8 30h30" stroke="white" strokeWidth="1" strokeOpacity=".2"/>
      <path d="M23 22v8M20 24l3-3 3 3" stroke="white" strokeWidth="1.2" strokeOpacity=".3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M48 29h22" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeOpacity=".5"/>
      <path d="M62 23l8 6-8 6" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity=".5"/>
    </svg>
  )
}

function IlluReativacao() {
  return (
    <svg width="100" height="72" viewBox="0 0 100 72" fill="none" aria-hidden>
      {[50, 39, 28].map((y, i) => (
        <g key={y}>
          <rect x="4" y={y} width="46" height="10" rx="2.5"
            fill="white" fillOpacity={0.03 + i * 0.03}
            stroke="white" strokeWidth="1" strokeOpacity={0.1 + i * 0.05}/>
          <circle cx="12" cy={y + 5} r="3" fill="white" fillOpacity={0.08 + i * 0.05}/>
          <rect x="18" y={y + 3} width="20" height="2" rx="1" fill="white" fillOpacity={0.08 + i * 0.04}/>
        </g>
      ))}
      <path d="M54 44h20" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M68 38l6 6-6 6" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M78 22l-4 12h6l-4 12" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".6"/>
    </svg>
  )
}

function IlluAtendimento() {
  return (
    <svg width="100" height="72" viewBox="0 0 100 72" fill="none" aria-hidden>
      <rect x="4" y="8" width="40" height="28" rx="5" stroke="#4ade80" strokeWidth="1.5" strokeOpacity=".5" fill="#4ade80" fillOpacity=".03"/>
      <circle cx="16" cy="22" r="3.5" fill="#4ade80" opacity=".35"/>
      <circle cx="24" cy="22" r="3.5" fill="#4ade80" opacity=".55"/>
      <circle cx="32" cy="22" r="3.5" fill="#4ade80" opacity=".35"/>
      <path d="M7 36l4-4" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeOpacity=".5"/>
      <rect x="56" y="36" width="40" height="28" rx="5" stroke="white" strokeWidth="1.2" strokeOpacity=".25" fill="none"/>
      <rect x="63" y="43" width="26" height="2.5" rx="1.25" fill="white" fillOpacity=".2"/>
      <rect x="63" y="49" width="18" height="2" rx="1" fill="white" fillOpacity=".12"/>
      <rect x="63" y="54" width="22" height="2" rx="1" fill="white" fillOpacity=".1"/>
      <path d="M93 64l-4-4" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeOpacity=".25"/>
    </svg>
  )
}

function IlluAgendamento() {
  return (
    <svg width="100" height="72" viewBox="0 0 100 72" fill="none" aria-hidden>
      <rect x="10" y="10" width="56" height="52" rx="5" stroke="white" strokeWidth="1.2" strokeOpacity=".2" fill="none"/>
      <path d="M10 22h56" stroke="white" strokeWidth="1" strokeOpacity=".12"/>
      <rect x="19" y="14" width="3" height="10" rx="1.5" fill="white" fillOpacity=".2"/>
      <rect x="54" y="14" width="3" height="10" rx="1.5" fill="white" fillOpacity=".2"/>
      {[[18,28],[30,28],[42,28],[18,40],[30,40]].map(([x,y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="9" height="8" rx="2" fill="white" fillOpacity=".06" stroke="white" strokeWidth=".8" strokeOpacity=".12"/>
      ))}
      <rect x="42" y="40" width="9" height="8" rx="2" fill="#16a34a" fillOpacity=".3" stroke="#4ade80" strokeWidth="1.2" strokeOpacity=".7"/>
      <path d="M44.5 44l2 2 4-4" stroke="#4ade80" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="84" cy="22" r="10" fill="#16a34a" fillOpacity=".1" stroke="#4ade80" strokeWidth="1.2" strokeOpacity=".35"/>
      <circle cx="80" cy="18" r="2.5" fill="#4ade80" fillOpacity=".25"/>
      <circle cx="88" cy="18" r="2.5" fill="#4ade80" fillOpacity=".25"/>
      <circle cx="77" cy="26" r="2" fill="#4ade80" fillOpacity=".2"/>
      <circle cx="84" cy="28" r="2" fill="#4ade80" fillOpacity=".25"/>
      <circle cx="91" cy="26" r="2" fill="#4ade80" fillOpacity=".2"/>
    </svg>
  )
}

function IlluBI() {
  return (
    <svg width="100" height="72" viewBox="0 0 100 72" fill="none" aria-hidden>
      <rect x="4" y="20" width="44" height="34" rx="5" stroke="#4ade80" strokeWidth="1.5" strokeOpacity=".4" fill="#4ade80" fillOpacity=".025"/>
      <rect x="11" y="28" width="30" height="3" rx="1.5" fill="white" fillOpacity=".18"/>
      <rect x="11" y="34" width="22" height="2" rx="1" fill="white" fillOpacity=".1"/>
      <rect x="11" y="39" width="26" height="2" rx="1" fill="white" fillOpacity=".1"/>
      <path d="M7 54l4-4" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeOpacity=".4"/>
      <path d="M50 37h10" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M56 32l4 5-4 5" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="62" y="12" width="34" height="48" rx="5" stroke="white" strokeWidth="1.2" strokeOpacity=".2" fill="none"/>
      <rect x="68" y="19" width="22" height="8" rx="2" fill="#4ade80" fillOpacity=".08" stroke="#4ade80" strokeWidth="1" strokeOpacity=".25"/>
      <polyline points="68,44 75,38 82,41 89,33 96,35" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".7" clipPath="url(#chartclip)"/>
      <clipPath id="chartclip"><rect x="62" y="12" width="34" height="48" rx="5"/></clipPath>
    </svg>
  )
}

function IlluDados() {
  return (
    <svg width="100" height="72" viewBox="0 0 100 72" fill="none" aria-hidden>
      <rect x="4" y="6" width="92" height="60" rx="5" stroke="white" strokeWidth="1.2" strokeOpacity=".14" fill="none"/>
      <rect x="10" y="12" width="24" height="16" rx="3" fill="#4ade80" fillOpacity=".08"/>
      <rect x="38" y="12" width="24" height="16" rx="3" fill="#4ade80" fillOpacity=".06"/>
      <rect x="66" y="12" width="22" height="16" rx="3" fill="#4ade80" fillOpacity=".04"/>
      <rect x="12" y="14" width="12" height="2" rx="1" fill="#4ade80" fillOpacity=".4"/>
      <rect x="12" y="19" width="18" height="2" rx="1" fill="white" fillOpacity=".14"/>
      <rect x="10" y="33" width="78" height="28" rx="3" fill="white" fillOpacity=".02"/>
      <polyline points="14,55 24,46 36,50 50,40 64,44 78,35 88,38" stroke="#4ade80" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity=".65"/>
      <circle cx="50" cy="40" r="3" fill="#4ade80" fillOpacity=".5"/>
      <circle cx="78" cy="35" r="3" fill="#4ade80" fillOpacity=".7"/>
    </svg>
  )
}

/* ─── Page ─────────────────────────────────────────────────────────── */
export default function PropostaPetFunPage() {
  return (
    <main className="min-h-screen bg-[#0c0c0c] text-white" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .fu { animation: fadeUp 0.7s cubic-bezier(.22,1,.36,1) both; }
        .fi { animation: fadeIn 0.7s ease both; }
        .d1 { animation-delay: .05s; }
        .d2 { animation-delay: .12s; }
        .d3 { animation-delay: .20s; }
        .d4 { animation-delay: .28s; }
        .d5 { animation-delay: .36s; }
        .d6 { animation-delay: .44s; }
        .card-g { transition: border-color .3s, background .3s; }
        .card-g:hover { border-color: rgba(74,222,128,.2); background: rgba(74,222,128,.02); }
      `}</style>

      {/* ── HEADER ── */}
      <header className="fi border-b border-white/[0.07] px-5 py-5 md:px-14">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Image src="/petfun.png" alt="Pet Fun" width={120} height={40} className="h-9 w-auto object-contain" />
          <div className="h-4 w-px bg-white/10" />
          <Image src="/vopy.jpeg" alt="Vopy" width={100} height={32} className="h-7 w-auto object-contain" />
        </div>
      </header>

      {/* ── CAPA ── */}
      <section className="px-5 pt-16 pb-20 md:px-14 md:pt-24 md:pb-28 border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto">
          <p className="fi d1 text-[#4ade80]/60 text-xs tracking-[.18em] uppercase mb-7">Apresentação Inicial · Vopy × Pet Fun</p>
          <h1 className="fu d2 text-[2rem] md:text-[2.8rem] font-bold leading-[1.18] tracking-tight mb-5 max-w-2xl">
            Infraestrutura de I.A<br />para a Pet Fun.
          </h1>
          <p className="fu d3 text-white/45 text-base md:text-lg leading-relaxed max-w-xl">
            Uma solução construída do zero para a sua operação — integrada ao seu sistema, treinada com o seu negócio.
          </p>
        </div>
      </section>

      {/* ── 01 · O PADRÃO DO MERCADO ── */}
      <section className="px-5 py-16 md:px-14 md:py-20 border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto">
          <p className="fu d1 text-[#16a34a] text-xs font-medium uppercase tracking-[.15em] mb-2">01</p>
          <h2 className="fu d2 text-xl md:text-2xl font-bold mb-2">O padrão do mercado</h2>
          <p className="fu d2 text-white/35 text-sm mb-10">É assim que a maioria das soluções funciona hoje.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { Ilu: IlluCookieCutter, title: "Escopo fixo para todos", desc: "A mesma I.A vendida para veterinária, varejo e escritório. Sem nenhum contexto do seu negócio." },
              { Ilu: IlluLocked,       title: "Você se adapta ao produto", desc: "O sistema tem um fluxo. A sua empresa aprende a caber nele — não o contrário." },
              { Ilu: IlluDropped,      title: "Entrega e vai embora", desc: "Acesso, manual, suporte. A responsabilidade pelo resultado é sua." },
            ].map(({ Ilu, title, desc }, i) => (
              <div key={title} className={`fu d${i + 2} p-5 rounded-2xl border border-red-500/[0.15] bg-red-500/[0.03] flex flex-col gap-5`}>
                <div className="flex items-center justify-between">
                  <Ilu />
                  <span className="text-red-400/50 text-lg font-light leading-none">✕</span>
                </div>
                <div>
                  <p className="font-semibold text-red-300/60 text-sm mb-1.5">{title}</p>
                  <p className="text-white/40 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 02 · FEITA SOB MEDIDA ── */}
      <section className="px-5 py-16 md:px-14 md:py-20 border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto">
          <p className="fu d1 text-[#16a34a] text-xs font-medium uppercase tracking-[.15em] mb-2">02</p>
          <h2 className="fu d2 text-xl md:text-2xl font-bold mb-3">Nossa solução é feita sob medida.</h2>
          <p className="fu d3 text-white/40 text-sm mb-10 max-w-xl">
            Antes de construir qualquer coisa, conhecemos a operação por completo. A solução nasce desse entendimento — não de um catálogo.
          </p>

          <div className="space-y-px rounded-2xl overflow-hidden border border-white/[0.07]">
            {[
              {
                n: "01",
                title: "Diagnóstico completo primeiro",
                desc: "Mapeamos como a Pet Fun funciona — atendimento, time, serviços, gargalos, sistemas. Só depois construímos.",
              },
              {
                n: "02",
                title: "Solução construída para vocês",
                desc: "A I.A conhece os serviços, produtos e linguagem da Pet Fun. Cada detalhe é feito sob medida para a sua operação.",
              },
              {
                n: "03",
                title: "Integração com o seu ERP",
                desc: "Lemos estoque, histórico de clientes e dados do seu sistema de gestão em tempo real. A I.A sabe o que está disponível agora.",
              },
              {
                n: "04",
                title: "Treinamento do time incluído",
                desc: "Treinamos toda a equipe. Realizamos todos os ajustes necessários. Acompanhamos até a operação rodar no nível esperado.",
              },
              {
                n: "05",
                title: "Nossa visão sobre I.A — não só o software",
                desc: "Não entregamos uma ferramenta. Compartilhamos como inteligência artificial pode transformar a operação da Pet Fun — e implementamos junto.",
              },
            ].map(({ n, title, desc }, i) => (
              <div key={n} className={`fu d${Math.min(i + 2, 6)} bg-white/[0.015] hover:bg-white/[0.03] transition-colors px-6 py-5 flex gap-5 items-start`}>
                <span className="font-mono text-[#4ade80]/40 text-xs font-bold flex-shrink-0 pt-0.5">{n}</span>
                <div>
                  <p className="font-semibold text-white text-sm mb-1">{title}</p>
                  <p className="text-white/40 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 03 · O QUE PODEMOS FAZER ── */}
      <section className="px-5 py-16 md:px-14 md:py-20">
        <div className="max-w-3xl mx-auto">
          <p className="fu d1 text-[#16a34a] text-xs font-medium uppercase tracking-[.15em] mb-2">03</p>
          <h2 className="fu d2 text-xl md:text-2xl font-bold mb-10">O que podemos construir para a Pet Fun</h2>

          <div className="space-y-4">
            {[
              {
                Ilu: IlluReativacao,
                title: "Reativação de base",
                desc: "Milhares de clientes inativos reativados de forma personalizada — segmentados por serviço ou produto que já usaram. Em escala, sem nenhum esforço da equipe.",
              },
              {
                Ilu: IlluAtendimento,
                title: "Atendimento 24h — lead pronto para o vendedor",
                desc: "Nenhum cliente espera. A I.A responde na hora, qualifica e entrega para o vendedor com o histórico e o pedido já estruturado. O vendedor só precisa fechar.",
              },
              {
                Ilu: IlluAgendamento,
                title: "Agendamento automático",
                desc: "Consulta, banho e tosa marcados pelo WhatsApp. Sem formulário, sem link. A I.A verifica disponibilidade, confirma e lembra o cliente na hora certa.",
              },
              {
                Ilu: IlluBI,
                title: "I.A que responde sobre o negócio",
                desc: "Para o gestor: \"Quantos clientes compraram ração esse mês? Quantos desses voltaram?\" — resposta em segundos. Conectada ao ERP, sem precisar abrir relatório nenhum.",
              },
              {
                Ilu: IlluDados,
                title: "Dashboards sobre tudo",
                desc: "Quantidade de leads, tempo de resposta, taxa de conversão, motivos de perda — em dashboards em tempo real. Para tomar decisões com base no que realmente acontece, não no feeling.",
              },
            ].map(({ Ilu, title, desc }, i) => (
              <div key={title} className={`fu d${Math.min(i + 2, 6)} card-g rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 md:p-8`}>
                <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
                  <div className="flex-shrink-0 pt-1"><Ilu /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-base mb-2">{title}</p>
                    <p className="text-white/45 text-sm leading-relaxed">{desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FECHAMENTO ── */}
      <section className="px-5 py-16 md:px-14 md:py-20 border-t border-white/[0.07]">
        <div className="max-w-3xl mx-auto">
          <p className="fu d1 text-white/20 text-xs font-medium uppercase tracking-[.15em] mb-8">Em resumo</p>

          <p className="fu d2 text-2xl md:text-3xl font-bold leading-snug mb-10 max-w-2xl">
            Nossa solução é diferente porque é<br />
            <span className="text-[#4ade80]">100% personalizada para a sua empresa.</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-px bg-white/[0.06] rounded-2xl overflow-hidden">
            {[
              { step: "01", label: "Diagnóstico", desc: "Conhecemos a operação por completo — antes de tocar em qualquer coisa." },
              { step: "02", label: "Construção", desc: "Aplicamos a solução sob medida para a Pet Fun, integrada ao seu sistema." },
              { step: "03", label: "Implementação", desc: "Treinamos o time, acompanhamos a operação e garantimos que funcione." },
            ].map(({ step, label, desc }, i) => (
              <div key={step} className={`fu d${i + 3} bg-[#0c0c0c] flex-1 p-6 md:p-8`}>
                <p className="font-mono text-[#4ade80]/40 text-xs mb-3">{step}</p>
                <p className="font-bold text-white text-sm mb-2">{label}</p>
                <p className="text-white/35 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="px-5 py-7 md:px-14 border-t border-white/[0.07] mt-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-white/20 text-xs">
          <Image src="/vopy.jpeg" alt="Vopy" width={52} height={18} className="h-4 w-auto object-contain opacity-25" />
          <span>Confidencial · 2026</span>
        </div>
      </footer>

    </main>
  )
}
