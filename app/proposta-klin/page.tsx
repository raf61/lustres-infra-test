import type { Metadata } from "next"
import Image from "next/image"

export const metadata: Metadata = {
  title: "Proposta · Vopy × Dental Klin",
  description: "Credenciamento de dentistas parceiros em massa para a Dental Klin.",
}

/* ─── Illustrations ────────────────────────────────────────────────── */

function IlluDisparo() {
  return (
    <svg width="72" height="48" viewBox="0 0 72 48" fill="none" aria-hidden>
      {[12, 22, 32].map((y, i) => (
        <g key={y}>
          <rect x="4" y={y} width="24" height="8" rx="2" fill="white" opacity={0.04 + i * 0.03} stroke="white" strokeWidth="1" strokeOpacity={0.08 + i * 0.04}/>
          <circle cx="10" cy={y + 4} r="2.5" fill="white" opacity={0.06 + i * 0.04}/>
        </g>
      ))}
      <path d="M34 24h14" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M44 20l4 4-4 4" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="52" y="14" width="16" height="20" rx="4" stroke="#4ade80" strokeWidth="1.5" fill="#4ade80" fillOpacity=".04"/>
      <path d="M56 20h8M56 24h5M56 28h7" stroke="#4ade80" strokeWidth="1" strokeLinecap="round" strokeOpacity=".5"/>
    </svg>
  )
}

function IlluIA() {
  return (
    <svg width="72" height="48" viewBox="0 0 72 48" fill="none" aria-hidden>
      <rect x="4" y="6" width="32" height="22" rx="5" stroke="#4ade80" strokeWidth="1.5" strokeOpacity=".5" fill="#4ade80" fillOpacity=".03"/>
      <circle cx="14" cy="17" r="2.5" fill="#4ade80" opacity=".4"/>
      <circle cx="20" cy="17" r="2.5" fill="#4ade80" opacity=".55"/>
      <circle cx="26" cy="17" r="2.5" fill="#4ade80" opacity=".4"/>
      <path d="M8 28l3-3" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeOpacity=".4"/>
      <rect x="38" y="20" width="30" height="22" rx="5" stroke="white" strokeWidth="1.2" strokeOpacity=".2" fill="none"/>
      <rect x="44" y="26" width="18" height="2.5" rx="1" fill="white" fillOpacity=".18"/>
      <rect x="44" y="31" width="12" height="2" rx="1" fill="white" fillOpacity=".1"/>
      <rect x="44" y="35" width="15" height="2" rx="1" fill="white" fillOpacity=".08"/>
      <path d="M65 42l-3-3" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeOpacity=".2"/>
    </svg>
  )
}

function IlluKanban() {
  return (
    <svg width="72" height="48" viewBox="0 0 72 48" fill="none" aria-hidden>
      {[8, 28, 48].map((x, i) => (
        <g key={x}>
          <rect x={x} y="4" width="16" height="5" rx="2" fill="white" opacity=".08"/>
          <rect x={x} y="12" width="16" height="8" rx="2" fill="#4ade80" opacity={0.12 + i * 0.1}/>
          <rect x={x} y="23" width="16" height="8" rx="2" fill="#4ade80" opacity={0.08 + i * 0.08}/>
          {i < 2 && <rect x={x} y="34" width="16" height="6" rx="2" fill="white" opacity=".04"/>}
        </g>
      ))}
      <path d="M26 16l18 0" stroke="#4ade80" strokeWidth="1" strokeLinecap="round" strokeDasharray="2 3" strokeOpacity=".35"/>
      <path d="M46 27l18 0" stroke="#4ade80" strokeWidth="1" strokeLinecap="round" strokeDasharray="2 3" strokeOpacity=".35"/>
    </svg>
  )
}

function IlluChat() {
  return (
    <svg width="72" height="48" viewBox="0 0 72 48" fill="none" aria-hidden>
      <rect x="16" y="6" width="40" height="36" rx="6" stroke="#4ade80" strokeWidth="1.5" fill="#4ade80" fillOpacity=".025"/>
      <circle cx="36" cy="12" r="3" fill="#4ade80" opacity=".3"/>
      <rect x="22" y="18" width="28" height="2" rx="1" fill="white" fillOpacity=".15"/>
      <rect x="22" y="24" width="20" height="8" rx="3" fill="white" fillOpacity=".06" stroke="white" strokeWidth="1" strokeOpacity=".1"/>
      <rect x="34" y="34" width="16" height="6" rx="3" fill="#4ade80" fillOpacity=".12" stroke="#4ade80" strokeWidth="1" strokeOpacity=".3"/>
      {[6, 60].map(x => (
        <g key={x}>
          <circle cx={x} cy="16" r="4" fill="white" opacity=".06"/>
          <circle cx={x} cy="30" r="4" fill="white" opacity=".06"/>
        </g>
      ))}
      <path d="M12 16h-2M12 30h-2M60 16h2M60 30h2" stroke="white" strokeWidth="1" strokeOpacity=".12" strokeLinecap="round"/>
    </svg>
  )
}

function IlluERP() {
  return (
    <svg width="72" height="48" viewBox="0 0 72 48" fill="none" aria-hidden>
      <rect x="4" y="8" width="26" height="32" rx="4" stroke="white" strokeWidth="1.2" strokeOpacity=".2" fill="white" fillOpacity=".02"/>
      <rect x="8" y="14" width="18" height="3" rx="1" fill="white" fillOpacity=".12"/>
      <rect x="8" y="20" width="14" height="2" rx="1" fill="white" fillOpacity=".07"/>
      <rect x="8" y="25" width="16" height="2" rx="1" fill="white" fillOpacity=".07"/>
      <rect x="8" y="30" width="12" height="2" rx="1" fill="white" fillOpacity=".07"/>
      <path d="M34 24h8" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M38 20l4 4-4 4" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="46" y="8" width="22" height="32" rx="4" stroke="#4ade80" strokeWidth="1.5" fill="#4ade80" fillOpacity=".04"/>
      <rect x="50" y="14" width="14" height="3" rx="1" fill="#4ade80" fillOpacity=".3"/>
      <rect x="50" y="20" width="10" height="2" rx="1" fill="#4ade80" fillOpacity=".15"/>
      <rect x="50" y="25" width="12" height="2" rx="1" fill="#4ade80" fillOpacity=".15"/>
      <rect x="50" y="30" width="8" height="2" rx="1" fill="#4ade80" fillOpacity=".15"/>
    </svg>
  )
}

function IlluConsulta() {
  return (
    <svg width="72" height="48" viewBox="0 0 72 48" fill="none" aria-hidden>
      <rect x="8" y="4" width="56" height="40" rx="5" stroke="white" strokeWidth="1.2" strokeOpacity=".15" fill="none"/>
      <rect x="14" y="10" width="44" height="8" rx="3" fill="white" fillOpacity=".04" stroke="white" strokeWidth="1" strokeOpacity=".1"/>
      <circle cx="52" cy="14" r="3" stroke="#4ade80" strokeWidth="1.2" fill="none"/>
      <path d="M54.5 16.5l2 2" stroke="#4ade80" strokeWidth="1.2" strokeLinecap="round"/>
      <rect x="14" y="22" width="44" height="4" rx="1.5" fill="white" fillOpacity=".06"/>
      <rect x="14" y="29" width="44" height="4" rx="1.5" fill="white" fillOpacity=".04"/>
      <rect x="14" y="36" width="30" height="4" rx="1.5" fill="white" fillOpacity=".03"/>
      <circle cx="17" cy="24" r="1.5" fill="#4ade80" opacity=".5"/>
      <circle cx="17" cy="31" r="1.5" fill="#4ade80" opacity=".35"/>
    </svg>
  )
}

/* ─── Page ─────────────────────────────────────────────────────────── */
export default function PropostaKlinPage() {
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
      `}</style>

      {/* ── HEADER ── */}
      <header className="fi border-b border-white/[0.07] px-5 py-5 md:px-14">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="text-white/80 text-lg font-bold tracking-tight">Dental Klin</span>
          <div className="h-4 w-px bg-white/10" />
          <Image src="/vopy.jpeg" alt="Vopy" width={100} height={32} className="h-7 w-auto object-contain" />
        </div>
      </header>

      {/* ── CAPA ── */}
      <section className="px-5 pt-16 pb-20 md:px-14 md:pt-24 md:pb-28 border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto">
          <p className="fi d1 text-[#4ade80]/60 text-xs tracking-[.18em] uppercase mb-7">Proposta · Vopy × Dental Klin</p>
          <h1 className="fu d2 text-[2rem] md:text-[2.8rem] font-bold leading-[1.18] tracking-tight mb-5 max-w-2xl">
            Dental Klin — credenciamento de dentistas parceiros em massa.
          </h1>
          <p className="fu d3 text-white/45 text-base md:text-lg leading-relaxed max-w-xl">
            Disparo em massa, I.A conversacional, organização de oportunidades e WhatsApp centralizado — integrado ao ERP.
          </p>
        </div>
      </section>

      {/* ── OBJETIVO ── */}
      <section className="px-5 py-16 md:px-14 md:py-20 border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto">
          <p className="fu d1 text-[#16a34a] text-xs font-medium uppercase tracking-[.15em] mb-2">Objetivo</p>
          <h2 className="fu d2 text-xl md:text-2xl font-bold mb-6">Credenciar dentistas parceiros em escala</h2>
          <p className="fu d3 text-white/40 text-sm md:text-base leading-relaxed max-w-xl">
            A equipe já sabe conduzir o credenciamento. A I.A amplia o alcance — milhares de primeiros contatos simultâneos, qualificando e entregando o dentista pronto para a representante finalizar.
          </p>
        </div>
      </section>

      {/* ── 01 · COMO FUNCIONA ── */}
      <section className="px-5 py-16 md:px-14 md:py-20 border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto">
          <p className="fu d1 text-[#16a34a] text-xs font-medium uppercase tracking-[.15em] mb-2">01</p>
          <h2 className="fu d2 text-xl md:text-2xl font-bold mb-10">Como funciona</h2>

          <div className="space-y-px rounded-2xl overflow-hidden border border-white/[0.07]">
            {[
              {
                n: "01",
                title: "Base de dentistas puxada do ERP",
                desc: "Importa e segmenta por região, especialidade e perfil.",
              },
              {
                n: "02",
                title: "Disparo em massa pelo WhatsApp",
                desc: "Mensagens personalizadas via API oficial. Sem risco de bloqueio.",
              },
              {
                n: "03",
                title: "I.A conversa com cada dentista",
                desc: "Tira dúvidas sobre a operadora, coleta dados e qualifica o interesse.",
              },
              {
                n: "04",
                title: "I.A organiza por status e prioridade",
                desc: "Cada dentista é categorizado automaticamente: novo contato, interesse confirmado, dados coletados, pronto para cadastro.",
              },
              {
                n: "05",
                title: "I.A passa para a representante quando o dentista está pronto",
                desc: "A representante recebe o dentista qualificado, com dados coletados e dúvidas respondidas. Finaliza o cadastro.",
              },
            ].map(({ n, title, desc }, i) => (
              <div key={n} className={`fu d${Math.min(i + 2, 6)} bg-white/[0.015] px-6 py-5 flex gap-5 items-start`}>
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

      {/* ── 02 · MÓDULOS ── */}
      <section className="px-5 py-16 md:px-14 md:py-20 border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto">
          <p className="fu d1 text-[#16a34a] text-xs font-medium uppercase tracking-[.15em] mb-2">02</p>
          <h2 className="fu d2 text-xl md:text-2xl font-bold mb-10">O que compõe o sistema</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                Ilu: IlluDisparo,
                title: "Disparo em massa com I.A",
                desc: "Envio segmentado para milhares de dentistas. Por região, especialidade ou qualquer critério da base.",
              },
              {
                Ilu: IlluIA,
                title: "I.A conversacional",
                desc: "Conversa com cada dentista, coleta dados, responde dúvidas e passa para a representante quando está pronto.",
              },
              {
                Ilu: IlluKanban,
                title: "Organização automática de oportunidades",
                desc: "A I.A categoriza cada dentista por status e prioridade. Sem input manual.",
              },
              {
                Ilu: IlluChat,
                title: "WhatsApp centralizado",
                desc: "Todas as conversas em um só painel — via API oficial. Representantes e I.A operam juntas.",
              },
              {
                Ilu: IlluConsulta,
                title: "Consulta de base",
                desc: "Busca e filtra dentistas por qualquer critério. Dados sempre atualizados do ERP.",
              },
              {
                Ilu: IlluERP,
                title: "Integração com o ERP",
                desc: "Conexão direta com o sistema da Dental Klin. Mesma base. Sem duplicação.",
              },
            ].map(({ Ilu, title, desc }, i) => (
              <div key={title} className={`fu d${Math.min(i + 2, 6)} flex flex-col gap-4 p-5 rounded-xl border border-white/[0.07] bg-white/[0.02]`}>
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
      <section className="px-5 py-16 md:px-14 md:py-20 border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto">
          <p className="fu d1 text-[#16a34a] text-xs font-medium uppercase tracking-[.15em] mb-2">03</p>
          <h2 className="fu d2 text-xl md:text-2xl font-bold mb-3">Implantação em 7 dias</h2>
          <p className="fu d3 text-white/35 text-sm mb-10">Da integração ao primeiro disparo.</p>

          {/* timeline desktop */}
          <div className="mb-10 hidden md:flex items-center">
            {[
              { label: "Integração ERP" },
              { label: "Setup WhatsApp" },
              { label: "Definição da I.A" },
              { label: "Go-live" },
            ].map((item, i, arr) => (
              <div key={item.label} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full border-2 border-[#16a34a] bg-[#0c0c0c] flex items-center justify-center">
                    <span className="text-[#4ade80] text-xs font-bold">{i + 1}</span>
                  </div>
                  <p className="text-white text-xs font-semibold mt-2 whitespace-nowrap">{item.label}</p>
                </div>
                {i < arr.length - 1 && (
                  <div className="flex-1 h-px bg-gradient-to-r from-[#16a34a]/50 to-[#16a34a]/20 mx-2 mb-2" />
                )}
              </div>
            ))}
          </div>

          <div className="divide-y divide-white/[0.06]">
            {[
              {
                num: "01",
                phase: "Integração com o ERP",
                desc: "Conectamos ao sistema da Dental Klin para puxar a base de dentistas e sincronizar dados.",
              },
              {
                num: "02",
                phase: "Setup do WhatsApp",
                desc: "Configuramos os números na API oficial da Meta — criação da Business Manager, verificação da empresa, registro dos números e aprovação dos templates de mensagem.",
              },
              {
                num: "03",
                phase: "Definição do processo da I.A",
                desc: "Definimos o que a I.A vai falar, quais perguntas fazer, como qualificar o interesse, quando passar para a representante e o tom de cada etapa da conversa.",
              },
              {
                num: "04",
                phase: "Go-live",
                desc: "Primeiro disparo real com acompanhamento. Ajustes na I.A e nas respostas conforme os resultados chegam.",
              },
            ].map((item) => (
              <div key={item.num} className="py-6 flex gap-6 items-start">
                <span className="font-mono text-[#16a34a]/50 text-xs font-bold flex-shrink-0 pt-0.5">{item.num}</span>
                <div>
                  <p className="font-bold text-white text-sm mb-1.5">{item.phase}</p>
                  <p className="text-white/40 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── O QUE CONFIGURAMOS ── */}
      <section className="px-5 py-16 md:px-14 md:py-20 border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto">
          <p className="fu d1 text-[#16a34a] text-xs font-medium uppercase tracking-[.15em] mb-2">Detalhes</p>
          <h2 className="fu d2 text-xl md:text-2xl font-bold mb-8">Também cuidamos dos detalhes</h2>

          <div className="fu d3 space-y-3">
            {[
              "Criação e configuração da Business Manager (Meta)",
              "Verificação da empresa junto à Meta",
              "Registro e configuração dos números de WhatsApp na API oficial",
              "Criação e aprovação dos templates de mensagem",
              "Integração com o ERP para importação da base de dentistas",
              "Configuração completa da I.A — tom, perguntas, qualificação e regras de passagem",
              "Testes de disparo e ajustes antes do go-live",
            ].map((t) => (
              <div key={t} className="flex items-start gap-3">
                <span className="text-[#4ade80]/40 text-sm mt-px">-</span>
                <p className="text-white/45 text-sm leading-relaxed">{t}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DISCLAIMER ── */}
      <section className="px-5 py-12 md:px-14 md:py-16 border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto">
          <div className="fu d2 rounded-xl border border-white/[0.05] bg-white/[0.015] px-6 py-5">
            <p className="text-white/30 text-sm leading-relaxed">
              Em casos raros, a Meta pode demorar mais que o normal para verificar a empresa ou aprovar templates de mensagem. Não depende de nós, mas vale o aviso.
            </p>
          </div>
        </div>
      </section>

      {/* ── INVESTIMENTO ── */}
      <section className="px-5 py-16 md:px-14 md:py-20 border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto">
          <p className="fu d1 text-[#16a34a] text-xs font-medium uppercase tracking-[.15em] mb-2">Investimento</p>
          <h2 className="fu d2 text-xl md:text-2xl font-bold mb-10">Duas opções</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Opção A */}
            <div className="fu d3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-6 flex flex-col">
              <p className="text-[#4ade80]/50 text-xs uppercase tracking-[.15em] mb-4">Opção A · Fixo</p>
              <p className="text-white text-3xl font-bold mb-6">2× de R$ 6.550</p>
              <div className="space-y-3 flex-1">
                {[
                  "Implantação completa em até 7 dias",
                  "Todos os módulos incluídos",
                  "Sistema posteriormente adaptável para CRM",
                ].map((t) => (
                  <div key={t} className="flex items-start gap-3">
                    <span className="text-[#4ade80]/40 text-sm mt-px">-</span>
                    <p className="text-white/45 text-sm leading-relaxed">{t}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Opção B */}
            <div className="fu d4 rounded-xl border border-[#4ade80]/15 bg-[#4ade80]/[0.02] p-6 flex flex-col">
              <p className="text-[#4ade80]/50 text-xs uppercase tracking-[.15em] mb-4">Opção B · Fixo + Variável</p>
              <p className="text-white text-3xl font-bold mb-2">Fixo + por dentista credenciado</p>
              <p className="text-white/25 text-xs mb-6">valor fixo menor + variável por resultado</p>
              <div className="space-y-3 flex-1">
                {[
                  "Valor fixo reduzido pela implantação",
                  "Valor por dentista parceiro vindo dos disparos",
                  "Alinha o investimento ao resultado real",
                  "Valores e formato abertos para conversa",
                ].map((t) => (
                  <div key={t} className="flex items-start gap-3">
                    <span className="text-[#4ade80]/40 text-sm mt-px">-</span>
                    <p className="text-white/45 text-sm leading-relaxed">{t}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── NEGOCIAÇÃO ── */}
      <section className="px-5 py-12 md:px-14 md:py-16 border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto">
          <p className="fu d2 text-white/40 text-sm md:text-base leading-relaxed max-w-xl">
            Nosso objetivo é trazer dentistas credenciados. O trabalho só faz sentido se isso acontecer — então estamos abertos a alternativas.
          </p>
        </div>
      </section>

      {/* ── GARANTIA ── */}
      <section className="px-5 py-12 md:px-14 md:py-16 border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto">
          <p className="fu d1 text-[#16a34a] text-xs font-medium uppercase tracking-[.15em] mb-2">Garantia</p>
          <h2 className="fu d2 text-xl md:text-2xl font-bold mb-6">Garantia por contrato</h2>
          <p className="fu d3 text-white/40 text-sm md:text-base leading-relaxed mb-4 max-w-xl">
            Se o sistema não funcionar como descrito nesta proposta — disparos em massa, I.A conversacional, organização automática de oportunidades, integração com o ERP e WhatsApp centralizado — devolvemos o valor integral.
          </p>
          <p className="fu d4 text-white/30 text-sm leading-relaxed max-w-xl">
            Condicionada ao cumprimento das etapas da Dental Klin: acesso ao ERP, dados da empresa para verificação na Meta e disponibilidade para definição do processo da I.A.
          </p>
        </div>
      </section>

      {/* ── FECHAMENTO ── */}
      <section className="px-5 py-16 md:px-14 md:py-20 border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto">
          <p className="fu d1 text-2xl md:text-3xl font-bold leading-snug max-w-2xl">
            Mais dentistas parceiros, em menos tempo,<br />
            <span className="text-[#4ade80]">com menos esforço da sua equipe.</span>
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="px-5 py-7 md:px-14 border-t border-white/[0.07]">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-white/20 text-xs">
          <Image src="/vopy.jpeg" alt="Vopy" width={52} height={18} className="h-4 w-auto object-contain opacity-25" />
          <span>Confidencial · 2026</span>
        </div>
      </footer>
    </main>
  )
}
