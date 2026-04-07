"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Search, Bot, CheckCheck, ArrowRight } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type Sender = "client" | "ai" | "system"
type ConvStatus = "ai" | "transferred" | "quote_sent"

interface Msg {
  id: string
  sender: Sender
  text?: string
  time: string
  special?: "loading" | "quote" | "transfer"
}

interface Conv {
  id: string
  name: string
  initials: string
  color: string
  preview: string
  time: string
  status: ConvStatus
  unread?: number
  tipo: string
  vendedor?: string
  messages: Msg[]
}

// ─── Conversations ────────────────────────────────────────────────────────────

const ALL_CONVS: Conv[] = [
  {
    id: "1", name: "Carlos Eduardo", initials: "CE", color: "bg-blue-500",
    preview: "Vou de HDI então!", time: "14:09", status: "transferred",
    tipo: "Auto", vendedor: "Rodrigo Silva",
    messages: [
      { id:"m1", sender:"client", text:"Boa tarde! Vi o anúncio de vocês. Quero cotar seguro pro meu carro", time:"14:02" },
      { id:"m2", sender:"ai",     text:"Boa tarde, Carlos! 😊 Sou a Sofia, assistente da SegureAI. Fico feliz em ajudar! Para fazer a melhor cotação, preciso de algumas informações. Qual o modelo e ano do seu veículo?", time:"14:02" },
      { id:"m3", sender:"client", text:"Honda Civic 2022, zero km praticamente", time:"14:03" },
      { id:"m4", sender:"ai",     text:"Ótimo! Civic 2022 é um veículo muito valorizado. Qual o CEP de pernoite? (onde o carro fica à noite)", time:"14:03" },
      { id:"m5", sender:"client", text:"01310-100", time:"14:04" },
      { id:"m6", sender:"ai",     text:"São Paulo capital — região central. Agora me conta: você tem filhos ou dependentes que também dirigem o veículo?", time:"14:04" },
      { id:"m7", sender:"client", text:"Só eu mesmo, tenho 34 anos", time:"14:05" },
      { id:"m8", sender:"ai",     text:"Perfeito! Você tem alguma apólice atual? Se sim, qual o valor que paga hoje?", time:"14:05" },
      { id:"m9", sender:"client", text:"Tenho pela Porto Seguro, pago R$ 320 por mês", time:"14:06" },
      { id:"m10", sender:"ai", time:"14:06", special:"loading" },
      { id:"m11", sender:"ai", time:"14:06", special:"quote" },
      { id:"m12", sender:"ai", text:"Com a HDI você economizaria R$ 73/mês (R$ 876/ano) comparado ao que paga hoje! Quer que eu formalize a proposta ou tem alguma dúvida sobre as coberturas?", time:"14:07" },
      { id:"m13", sender:"client", text:"Nossa, bem melhor! Qual a diferença entre HDI e Porto Seguro?", time:"14:08" },
      { id:"m14", sender:"ai", text:"Boa pergunta! A principal diferença é o carro reserva: 15 dias (HDI) vs 30 dias (Porto Seguro), e o app da Porto para serviços. Se carro reserva não é prioridade, a HDI entrega cobertura equivalente com R$ 73/mês de economia. Prefere a HDI ou a Porto Seguro?", time:"14:08" },
      { id:"m15", sender:"client", text:"Vou de HDI então!", time:"14:09" },
      { id:"m16", sender:"ai", text:"Ótimo! Vou transferir você para o nosso corretor Rodrigo, que vai formalizar a proposta e tirar as últimas dúvidas. Um momento! 📋", time:"14:09" },
      { id:"m17", sender:"system", time:"14:09", special:"transfer" },
    ],
  },
  {
    id: "2", name: "Metalúrgica Soares", initials: "MS", color: "bg-violet-600",
    preview: "Sofia está coletando dados do seguro empresarial...", time: "14:28",
    status: "ai", unread: 2, tipo: "Empresarial", vendedor: undefined,
    messages: [
      { id:"n1", sender:"client", text:"Bom dia! Quero cotar seguro para minha empresa. Metalúrgica Soares Ltda.", time:"14:20" },
      { id:"n2", sender:"ai", text:"Bom dia! Sou a Sofia da SegureAI. Para empresas temos soluções completas: Seguro Empresarial, Patrimonial, RC e Saúde Coletiva. Pode me passar o CNPJ para consulta?", time:"14:21" },
      { id:"n3", sender:"client", text:"12.345.678/0001-99", time:"14:23" },
      { id:"n4", sender:"ai", text:"Perfeito! Metalúrgica Soares Ltda — encontrei os dados. Qual o faturamento anual aproximado da empresa? (necessário para calcular a cobertura ideal)", time:"14:24" },
      { id:"n5", sender:"client", text:"Em torno de R$ 8 milhões por ano", time:"14:26" },
      { id:"n6", sender:"ai", text:"Entendido! Vocês já possuem algum seguro empresarial atualmente? E quantos funcionários?", time:"14:27" },
      { id:"n7", sender:"client", text:"Temos pela Mapfre mas está vencendo. 47 funcionários.", time:"14:28" },
    ],
  },
  {
    id: "3", name: "Fernanda Lima", initials: "FL", color: "bg-emerald-600",
    preview: "Proposta HDI enviada — R$ 89/mês ✓", time: "14:19",
    status: "quote_sent", tipo: "Residencial", vendedor: "Ana Beatriz",
    messages: [
      { id:"f1", sender:"client", text:"Quero ver o seguro da minha casa nova. Acabei de me mudar!", time:"14:10" },
      { id:"f2", sender:"ai", text:"Olá Fernanda! Parabéns pela casa nova! 🏠 Sou a Sofia. Para te passar as melhores opções, qual o endereço completo?", time:"14:11" },
      { id:"f3", sender:"client", text:"Rua das Flores, 123, apto 42. São Paulo.", time:"14:12" },
      { id:"f4", sender:"ai", text:"Encontrei o prédio aqui. É um apartamento de aproximadamente 80m², correto? Gostaria de cobertura para incêndio, roubo e danos elétricos?", time:"14:13" },
      { id:"f5", sender:"client", text:"Isso mesmo. E se tiver assistência 24h para chaveiro e encanador seria ótimo.", time:"14:15" },
      { id:"f6", sender:"ai", text:"Perfeito, todas as nossas opções residenciais já incluem o pacote 'Check-up Lar'. Estou calculando as melhores taxas para você...", time:"14:16" },
      { id:"f7", sender:"ai", time:"14:17", special:"loading" },
      { id:"f8", sender:"ai", text:"Consegui uma excelente proposta na HDI por apenas R$ 89/mês com todas as coberturas que você pediu! Posso te enviar o PDF com os detalhes?", time:"14:19" },
    ],
  },
  {
    id: "4", name: "Ricardo Alves", initials: "RA", color: "bg-amber-500",
    preview: "Entendido! Vou verificar com o corretor", time: "13:55",
    status: "transferred", tipo: "Auto", vendedor: "Rodrigo Silva",
    messages: [
      { id:"r1", sender:"client", text:"Meu seguro vence amanhã, preciso renovar urgente!", time:"13:45" },
      { id:"r2", sender:"ai", text:"Olá Ricardo! Vamos agilizar isso agora. Continua com o mesmo Corolla 2020?", time:"13:46" },
      { id:"r3", sender:"client", text:"Sim, o mesmo. Mas mudei de endereço, agora estou em Alphaville.", time:"13:48" },
      { id:"r4", sender:"ai", text:"Entendido. Qual o novo CEP para eu atualizar o risco?", time:"13:49" },
      { id:"r5", sender:"client", text:"06454-000", time:"13:50" },
      { id:"r6", sender:"ai", text:"Atualizei aqui. Por ser uma região diferente, as taxas mudaram um pouco. Vou passar para o Rodrigo Silva finalizar o fechamento com você em instantes.", time:"13:52" },
      { id:"r7", sender:"system", time:"13:55", special:"transfer" },
    ],
  },
  {
    id: "5", name: "Patrícia Souza", initials: "PS", color: "bg-rose-500",
    preview: "Sua apólice vence em 28 dias — quer comparar?", time: "13:54",
    status: "ai", unread: 1, tipo: "Auto", vendedor: undefined,
    messages: [
      { id:"p1", sender:"ai", text:"Oi Patrícia! Aqui é a Sofia. Notei que seu seguro da Porto vence em 28 dias. Queremos garantir que você continue protegida com o melhor preço. Vamos comparar?", time:"13:50" },
      { id:"p2", sender:"client", text:"Oi Sofia! Sim, a Porto subiu muito esse ano. Queria algo mais em conta.", time:"13:54" },
    ],
  },
  {
    id: "6", name: "TecnoFlex Indústria", initials: "TI", color: "bg-cyan-600",
    preview: "Saúde coletiva 47 vidas — cotando agora", time: "13:40",
    status: "ai", tipo: "Saúde Coletiva", vendedor: undefined,
    messages: [
      { id:"t1", sender:"client", text:"Preciso de cotação de plano de saúde para 47 funcionários.", time:"13:30" },
      { id:"t2", sender:"ai", text:"Olá! Atendemos empresas do seu porte com condições especiais. Qual a faixa etária média dos colaboradores e se desejam cobertura nacional ou regional?", time:"13:32" },
      { id:"t3", sender:"client", text:"Média de 32 anos. Queremos nacional com Bradesco ou SulAmérica.", time:"13:40" },
    ],
  },
  {
    id: "7", name: "Eduardo Rocha", initials: "ER", color: "bg-indigo-500",
    preview: "Base reativada — inativo há 7 meses", time: "13:28",
    status: "ai", tipo: "Vida", vendedor: undefined,
    messages: [
      { id:"e1", sender:"ai", text:"Olá Eduardo! Notei que você foi nosso cliente e está sem proteção há 7 meses. Temos uma oferta especial de reativação com 20% de desconto no Seguro de Vida. Quer conhecer?", time:"13:20" },
      { id:"e2", sender:"client", text:"Como funciona o desconto?", time:"13:28" },
    ],
  },
  {
    id: "8", name: "Logística Meridian", initials: "LM", color: "bg-orange-500",
    preview: "Frota fechada! Tokio Marine — 8 veículos", time: "13:15",
    status: "quote_sent", tipo: "Frota", vendedor: "Marcos Oliveira",
    messages: [
      { id:"l1", sender:"client", text:"Quero renovar a frota dos 8 caminhões.", time:"12:50" },
      { id:"l2", sender:"ai", text:"Bom dia! Já levantei o histórico de sinistros. Como foi baixo, consegui uma condição diferenciada na Tokio Marine.", time:"13:00" },
      { id:"l3", sender:"ai", time:"13:10", special:"loading" },
      { id:"l4", sender:"ai", text:"Conseguimos fechar a frota toda por R$ 98.400 anual. É o melhor valor do mercado hoje para RCF-V de 1 milhão. Aceita o fechamento?", time:"13:15" },
    ],
  },
  {
    id: "9", name: "André Passos", initials: "AP", color: "bg-teal-600",
    preview: "Ótimo, pode gerar a proposta da SulAmérica", time: "12:58",
    status: "transferred", tipo: "Vida", vendedor: "Ana Beatriz",
    messages: [
      { id:"a1", sender:"client", text:"Gostei da proposta de Vida Resgatável da SulAmérica.", time:"12:45" },
      { id:"a2", sender:"ai", text:"Excelente escolha! É um dos melhores produtos do mercado. Vou transferir para a Ana Beatriz para ela formalizar a assinatura digital.", time:"12:50" },
      { id:"a3", sender:"system", time:"12:58", special:"transfer" },
    ],
  },
  {
    id: "10", name: "Construtora Vega", initials: "CV", color: "bg-blue-700",
    preview: "Preciso de RC de obra + patrimonial", time: "12:43",
    status: "ai", unread: 3, tipo: "RC / Empresarial", vendedor: undefined,
    messages: [
      { id:"v1", sender:"client", text:"Temos uma obra nova na Paulista. Preciso de RC Obras e Seguro Patrimonial do canteiro.", time:"12:30" },
      { id:"v2", sender:"ai", text:"Entendido! Para o RC Obras, qual o valor total da obra e o prazo de execução estimado?", time:"12:35" },
      { id:"v3", sender:"client", text:"R$ 25 milhões, 18 meses.", time:"12:43" },
    ],
  },
]

const STATUS_CFG = {
  ai:          { label: "IA ativa",            cls: "text-sky-700 bg-sky-50 border-sky-200" },
  transferred: { label: "C/ corretor",         cls: "text-amber-700 bg-amber-50 border-amber-200" },
  quote_sent:  { label: "Cotação enviada",     cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
}

const VENDEDORES = ["Todos", "Rodrigo Silva", "Ana Beatriz", "Marcos Oliveira"]

// ─── Quote card ───────────────────────────────────────────────────────────────

function QuoteCard() {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3.5 w-72 space-y-2.5 shadow-sm">
      <div className="pb-2 border-b border-slate-100">
        <p className="text-[12px] font-bold text-slate-800">Cotação — Multicálculo SegureAI</p>
        <p className="text-[10px] text-slate-400 mt-0.5">Analizados 14 seguradoras · 07/04/2026</p>
      </div>
      {[
        { badge: "MELHOR CUSTO-BENEFÍCIO", badgeCls: "bg-emerald-100 text-emerald-700", wrapCls: "bg-emerald-50 border-emerald-200", seguradora: "HDI Seguros", price: "R$ 247", priceCls: "text-emerald-600", info: "FIPE 100% · Franquia R$ 2.800 · Carro reserva 15d" },
        { badge: "MAIS BARATA",             badgeCls: "bg-blue-100 text-blue-700",     wrapCls: "bg-blue-50 border-blue-200",     seguradora: "Mapfre",      price: "R$ 218", priceCls: "text-blue-600",    info: "FIPE 100% · Franquia R$ 3.200 · Assistência básica" },
        { badge: "COBERTURA PREMIUM",       badgeCls: "bg-slate-200 text-slate-600",   wrapCls: "bg-slate-50 border-slate-200",   seguradora: "Porto Seguro",price: "R$ 291", priceCls: "text-slate-700",   info: "FIPE 100% · Franquia R$ 2.400 · Carro reserva 30d" },
      ].map(o => (
        <div key={o.seguradora} className={cn("rounded-md p-2.5 border", o.wrapCls)}>
          <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded", o.badgeCls)}>{o.badge}</span>
          <p className="text-[12px] font-bold text-slate-800 mt-1.5">{o.seguradora}</p>
          <p className={cn("text-[16px] font-bold leading-none", o.priceCls)}>
            {o.price}<span className="text-[11px] font-normal text-slate-400">/mês</span>
          </p>
          <p className="text-[9px] text-slate-400 mt-1 leading-snug">{o.info}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function ChatMsg({ msg }: { msg: Msg }) {
  if (msg.sender === "system" && msg.special === "transfer") {
    return (
      <div className="flex justify-center my-3">
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 bg-slate-100/80 border border-slate-200 px-3 py-1.5 rounded-full">
          <ArrowRight className="h-3 w-3" />
          Lead transferido para o corretor responsável
        </div>
      </div>
    )
  }
  if (msg.special === "loading") {
    return (
      <div className="flex justify-start mb-2">
        <div className="bg-white rounded-xl rounded-tl-none border border-slate-200 px-3.5 py-2.5 shadow-sm max-w-xs">
          <div className="flex items-center gap-1.5">
            <Bot className="h-3.5 w-3.5 text-sky-500" />
            <p className="text-[11px] font-semibold text-sky-700">Consultando multicálculo...</p>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 leading-snug">
            Porto Seguro · HDI · Mapfre · SulAmérica · Bradesco
          </p>
          <div className="flex gap-1 mt-2">
            {["bg-orange-400","bg-blue-500","bg-red-400","bg-emerald-500","bg-cyan-500"].map((c, i) => (
              <span key={i} className={cn("h-1.5 w-1.5 rounded-full animate-pulse", c)} style={{ animationDelay: `${i*120}ms` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }
  if (msg.special === "quote") {
    return (
      <div className="flex justify-start mb-2">
        <QuoteCard />
      </div>
    )
  }

  const isClient = msg.sender === "client"
  return (
    <div className={cn("flex mb-1.5", isClient ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-xs lg:max-w-sm px-3 py-2 rounded-xl shadow-sm",
        isClient
          ? "bg-[#dcf8c6] text-slate-800 rounded-tr-none"
          : "bg-white text-slate-800 border border-slate-100 rounded-tl-none"
      )}>
        {!isClient && (
          <div className="flex items-center gap-1 mb-0.5">
            <Bot className="h-3 w-3 text-sky-500" />
            <span className="text-[9px] font-bold text-sky-600">Sofia — IA</span>
          </div>
        )}
        <p className="text-[12px] leading-relaxed">{msg.text}</p>
        <div className={cn("flex items-center gap-1 mt-0.5", isClient ? "justify-end" : "justify-start")}>
          <span className="text-[9px] text-slate-400">{msg.time}</span>
          {isClient && <CheckCheck className="h-3 w-3 text-sky-400" />}
        </div>
      </div>
    </div>
  )
}

// ─── Lead ficha ───────────────────────────────────────────────────────────────

function LeadFicha({ conv }: { conv: Conv }) {
  const details = useMemo(() => {
    const data: Record<string, string[]> = {
      "1": ["Carlos Eduardo Mendes", "378.***.***-**", "(11) 9 9876-5432", "Honda Civic 2022", "R$ 112.400", "Porto — R$ 320/mês", "HDI — R$ 247/mês", "R$ 876/ano"],
      "2": ["Metalúrgica Soares Ltda", "12.345.678/0001-99", "(11) 3344-5566", "Empresarial / RC", "R$ 8M (Fat. Anual)", "Mapfre (Vencendo)", "Calculando...", "—"],
      "3": ["Fernanda Lima", "221.***.***-**", "(11) 9 8877-6655", "Apartamento 80m²", "R$ 450k (Base)", "Nenhum", "HDI — R$ 89/mês", "—"],
      "4": ["Ricardo Alves", "112.***.***-**", "(11) 9 7766-5544", "Toyota Corolla 2020", "R$ 94.000", "Azul — R$ 280/mês", "Renovação", "—"],
      "5": ["Patrícia Souza", "098.***.***-**", "(11) 9 3322-1100", "Jeep Compass 2021", "R$ 145.000", "Porto — R$ 410/mês", "Comparando...", "—"],
      "6": ["TecnoFlex Indústria", "12.345.678/0001-99", "(11) 3344-5566", "Saúde 47 vidas", "—", "Nenhum", "Cotando SulA...", "—"],
      "7": ["Eduardo Rocha", "234.***.***-**", "(11) 9 9988-7766", "Seguro de Vida", "R$ 500k Capital", "Bradesco (Inat.)", "Oferta Reativ.", "—"],
      "8": ["Logística Meridian", "99.888.777/0001-66", "(11) 4004-9988", "Frota 8 Veículos", "R$ 1.2M (Total)", "Tokio — R$ 12k/veíc", "Fechado", "—"],
      "9": ["André Passos", "332.***.***-**", "(11) 9 5544-3322", "Vida Individual", "R$ 1M Capital", "Nenhum", "SulAmérica", "—"],
      "10": ["Construtora Vega", "11.222.333/0001-44", "(11) 2233-4455", "RC Obras / Patr.", "R$ 25M (Obra)", "Nenhum", "Cotando...", "—"],
    }
    return data[conv.id] || [conv.name, "***.***.***-**", "(11) 9 ****-****", conv.tipo, "—", "—", "—", "—"]
  }, [conv])

  const score = useMemo(() => {
    const scores: Record<string, number> = { "1": 87, "2": 95, "3": 92, "4": 78, "5": 64, "6": 88, "7": 45, "8": 91, "9": 83, "10": 76 }
    return scores[conv.id] || 70
  }, [conv])

  return (
    <div className="w-64 flex-shrink-0 border-l border-slate-200 bg-white flex flex-col">
      <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50">
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Ficha do Lead</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Score */}
        <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">{score}</span>
          </div>
          <div>
            <p className="text-[11px] font-bold text-emerald-800">Score IA</p>
            <p className="text-[9px] text-emerald-600">{score > 80 ? "Alta intenção de compra" : score > 50 ? "Interessado" : "Nutrição necessária"}</p>
          </div>
        </div>

        {/* Fields */}
        {[
          ["Nome",           details[0]],
          ["CPF/CNPJ",       details[1]],
          ["WhatsApp",       details[2]],
          ["Risco/Bem",      details[3]],
          ["Valor Est.",     details[4]],
          ["Seguro atual",   details[5]],
          ["Proposta IA",    details[6]],
          ["Economia Est.",  details[7]],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest">{label}</p>
            <p className="text-[11px] font-medium text-slate-800 mt-0.5">{value}</p>
          </div>
        ))}

        <div className="pt-2 border-t border-slate-100 space-y-2">
          <div>
            <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest">Status</p>
            <span className={cn(
              "inline-block mt-0.5 text-[9px] font-bold border px-1.5 py-0.5 rounded",
              STATUS_CFG[conv.status].cls
            )}>
              {STATUS_CFG[conv.status].label}
            </span>
          </div>
          {conv.vendedor && (
            <div>
              <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest">Atribuído a</p>
              <p className="text-[11px] font-medium text-slate-800 mt-0.5">{conv.vendedor}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WhatsAppPage() {
  const [activeId, setActiveId]           = useState("1")
  const [search, setSearch]               = useState("")
  const [statusFilter, setStatusFilter]   = useState<"all" | ConvStatus>("all")
  const [vendedorFilter, setVendedorFilter] = useState("Todos")

  const filtered = useMemo(() => ALL_CONVS.filter(c => {
    const matchStatus   = statusFilter === "all" || c.status === statusFilter
    const matchVendedor = vendedorFilter === "Todos" || c.vendedor === vendedorFilter
    const matchSearch   = c.name.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchVendedor && matchSearch
  }), [search, statusFilter, vendedorFilter])

  const active = ALL_CONVS.find(c => c.id === activeId) ?? ALL_CONVS[0]

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-[#f0f2f5]">

      {/* ── Left panel ── */}
      <div className="w-[320px] flex-shrink-0 flex flex-col border-r border-slate-200 bg-white">

        {/* WA Header */}
        <div className="px-4 py-3 bg-[#075e54] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-[12px] font-bold text-white leading-none">WhatsApp Business</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[9px] text-white/60">Sofia — IA ativa</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-md px-2.5 py-1.5">
            <Search className="h-3 w-3 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar conversa"
              className="flex-1 text-[11px] outline-none bg-transparent text-slate-700 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex-shrink-0 space-y-1.5">
          {/* Status filter */}
          <div className="flex gap-1">
            {(["all","ai","transferred","quote_sent"] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "flex-1 text-[9px] font-medium py-1 rounded transition-all",
                  statusFilter === s
                    ? "bg-[#075e54] text-white"
                    : "bg-white border border-slate-200 text-slate-500 hover:text-slate-700"
                )}
              >
                {s === "all" ? "Todos" : s === "ai" ? "IA ativa" : s === "transferred" ? "C/ corretor" : "Cotação"}
              </button>
            ))}
          </div>

          {/* Vendedor filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-slate-400 shrink-0">Vendedor:</span>
            <div className="flex gap-1 flex-wrap">
              {VENDEDORES.map(v => (
                <button
                  key={v}
                  onClick={() => setVendedorFilter(v)}
                  className={cn(
                    "text-[9px] font-medium px-1.5 py-0.5 rounded border transition-all",
                    vendedorFilter === v
                      ? "bg-[#128c7e] text-white border-[#128c7e]"
                      : "bg-white border-slate-200 text-slate-500 hover:text-slate-700"
                  )}
                >
                  {v === "Todos" ? "Todos" : v.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map(conv => (
            <button
              key={conv.id}
              onClick={() => setActiveId(conv.id)}
              className={cn(
                "w-full flex items-start gap-3 px-3 py-2.5 border-b border-slate-100 text-left transition-colors",
                activeId === conv.id ? "bg-slate-100" : "hover:bg-slate-50/80"
              )}
            >
              <div className={cn("w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-white", conv.color)}>
                {conv.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-semibold text-slate-800 truncate">{conv.name}</p>
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    <span className="text-[9px] text-slate-400">{conv.time}</span>
                    {conv.unread && (
                      <span className="w-4 h-4 rounded-full bg-[#25d366] flex items-center justify-center text-white text-[8px] font-bold">{conv.unread}</span>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">{conv.preview}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className={cn("text-[8px] font-medium px-1.5 py-px rounded border", STATUS_CFG[conv.status].cls)}>
                    {STATUS_CFG[conv.status].label}
                  </span>
                  <span className="text-[9px] text-slate-400">{conv.tipo}</span>
                </div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <p className="text-[11px] text-slate-400">Nenhuma conversa encontrada</p>
            </div>
          )}
        </div>

        {/* Bottom status */}
        <div className="px-3 py-2 bg-[#075e54]/8 border-t border-slate-200 flex-shrink-0">
          <p className="text-[9px] font-medium text-[#075e54]">
            Sofia gerencia <strong>{ALL_CONVS.filter(c => c.status === "ai").length} conversas</strong> agora ·{" "}
            {ALL_CONVS.filter(c => c.status === "transferred").length} com corretor
          </p>
        </div>
      </div>

      {/* ── Center — chat area ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#eae6df]">
        {/* Chat header */}
        <div className="px-4 py-2.5 bg-[#075e54] flex items-center gap-3 flex-shrink-0">
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-white", active.color)}>
            {active.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white leading-none">{active.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn("text-[9px] font-medium px-1.5 py-px rounded border", STATUS_CFG[active.status].cls)}>
                {STATUS_CFG[active.status].label}
              </span>
              <span className="text-[9px] text-white/50">{active.tipo}</span>
              {active.vendedor && (
                <span className="text-[9px] text-white/50">· {active.vendedor}</span>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5">
          {active.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 opacity-50">
              <Bot className="h-10 w-10 text-slate-400" />
              <p className="text-sm text-slate-500">Iniciando atendimento com Sofia...</p>
            </div>
          ) : (
            active.messages.map(msg => <ChatMsg key={msg.id} msg={msg} />)
          )}
        </div>

        {/* Input — demo */}
        <div className="px-4 py-2.5 bg-[#f0f2f5] border-t border-slate-200 flex-shrink-0">
          {active.status === "ai" ? (
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-2">
              <Bot className="h-3.5 w-3.5 text-sky-500 shrink-0" />
              <span className="text-[11px] text-slate-400 flex-1">Sofia está respondendo automaticamente...</span>
            </div>
          ) : (
             <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-2 shadow-sm">
                <input 
                  type="text" 
                  placeholder="Digite sua resposta como corretor..." 
                  className="flex-1 text-[12px] bg-transparent outline-none text-slate-700" 
                  disabled
                />
             </div>
          )}
        </div>
      </div>

      {/* ── Right panel — lead ficha ── */}
      <LeadFicha conv={active} />
    </div>
  )
}
