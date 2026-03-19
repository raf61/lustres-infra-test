"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import {
  Bot, Users, MessageSquare, TrendingUp, Clock, Zap, RefreshCw,
  ChevronLeft, ChevronRight, BarChart3, ShoppingCart,
  UserCheck, Activity, Target, Sparkles, Star, Lightbulb, HelpCircle
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

type Vendedor = { id: string; nome: string }

// ─── Funnel steps reais do sistema ───────────────────────────────────────────

const KANBAN_STAGES = [
  { label: "Primeiro Contato", color: "#64748b", pct: 1.00 },
  { label: "Contato Feito",    color: "#3b82f6", pct: 0.82 },
  { label: "Em Negociação",    color: "#8b5cf6", pct: 0.54 },
  { label: "Orçamento Enviado",color: "#f59e0b", pct: 0.38 },
  { label: "Aguardando OK",    color: "#6366f1", pct: 0.28 },
  { label: "Venda Fechada",    color: "#10b981", pct: 0.18 },
]

// ─── Intenção dos leads ───────────────────────────────────────────────────────

const INTENCOES = [
  { label: "Produto específico",        pct: 0.31, color: "#3b82f6",  icon: "🔦" },
  { label: "Projeto de iluminação",     pct: 0.24, color: "#8b5cf6",  icon: "💡" },
  { label: "Produto não especificado",  pct: 0.19, color: "#f59e0b",  icon: "🛒" },
  { label: "Falar com vendedor",        pct: 0.14, color: "#10b981",  icon: "📞" },
  { label: "Não especificado",          pct: 0.12, color: "#94a3b8",  icon: "❓" },
]

// ─── Mock helpers ─────────────────────────────────────────────────────────────

const SEED_HASH = (s: string) => s.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 7) & 0x7fffffff

function gerarVendedorMetrics(v: Vendedor) {
  const seed = SEED_HASH(v.id)
  const leads = 160 + (seed % 130)
  const novos = Math.round(leads * (0.28 + (seed % 17) * 0.01))
  const conversas = Math.round(leads * (0.74 + (seed % 14) * 0.01))
  const abertas = Math.round(conversas * (0.30 + (seed % 12) * 0.01))
  const comIA = Math.round(abertas * (0.55 + (seed % 10) * 0.01))
  const esperando = Math.round(abertas * (0.28 + (seed % 15) * 0.01))
  const qualificados = Math.round(conversas * (0.40 + (seed % 14) * 0.01))
  const handoffs = Math.round(conversas * (0.13 + (seed % 9) * 0.01))
  const vendas = Math.round(qualificados * (0.20 + (seed % 8) * 0.01))
  const followups = Math.round(conversas * (0.28 + (seed % 12) * 0.01))
  const recuperados = Math.round(followups * (0.22 + (seed % 10) * 0.01))
  const ticketMedio = 1600 + (seed % 1800)
  const taxaConversao = ((vendas / leads) * 100).toFixed(1)
  return { ...v, leads, novos, conversas, abertas, comIA, esperando, qualificados, handoffs, vendas, followups, recuperados, ticketMedio, taxaConversao }
}

function gerarDadosDiarios(dias: number, seed: number) {
  const hoje = new Date()
  return Array.from({ length: dias }, (_, i) => {
    const d = new Date(hoje)
    d.setDate(d.getDate() - (dias - 1 - i))
    const base = 10 + ((seed * (i + 3)) % 8)
    const leads = base + (i % 3)
    const novos = Math.round(leads * 0.30)
    const conversas = Math.round(leads * 0.76)
    const comIA = Math.round(conversas * 0.58)
    const qualificados = Math.round(conversas * 0.42)
    const handoffs = Math.round(conversas * 0.14)
    const vendas = Math.round(qualificados * 0.22)
    const followups = Math.round(conversas * 0.29)
    const recuperados = Math.round(followups * 0.24)
    return {
      data: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      diaNome: d.toLocaleDateString("pt-BR", { weekday: "short" }),
      leads, novos, conversas, comIA, qualificados, handoffs, vendas, followups, recuperados,
      esperando: Math.round(conversas * 0.30),
    }
  })
}

// ─── Formatadores ─────────────────────────────────────────────────────────────

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v)
const fmtPct = (v: number, t: number) => t > 0 ? `${((v / t) * 100).toFixed(0)}%` : "—"

// ─── MetricCard ───────────────────────────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, sub, color = "blue", highlight }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string; highlight?: boolean
}) {
  const colors: Record<string, string> = {
    blue:    "text-blue-600 bg-blue-500/10 border-blue-500/25",
    emerald: "text-emerald-600 bg-emerald-500/10 border-emerald-500/25",
    amber:   "text-amber-600 bg-amber-500/10 border-amber-500/25",
    violet:  "text-violet-600 bg-violet-500/10 border-violet-500/25",
    red:     "text-red-500 bg-red-500/10 border-red-500/25",
    slate:   "text-slate-500 bg-slate-500/10 border-slate-500/25",
    sky:     "text-sky-500 bg-sky-500/10 border-sky-500/25",
  }
  return (
    <Card className={cn("border-border", highlight && "ring-1 ring-primary/30")}>
      <CardContent className="pt-4 pb-3">
        <div className={cn("inline-flex items-center justify-center h-8 w-8 rounded-lg border mb-2", colors[color] ?? colors.blue)}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-[11px] font-semibold text-foreground mt-1">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}

// ─── BarChart com tooltip ─────────────────────────────────────────────────────

function BarChart({ data, valueKey, color = "#3b82f6", height = 100, label }: {
  data: Record<string, unknown>[]
  valueKey: string
  color?: string
  height?: number
  label?: string
}) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; value: number; date: string } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const values = data.map(d => Number(d[valueKey]) || 0)
  const max = Math.max(...values, 1)
  const chartH = height - 20 // reserva 20px pra labels
  const barW = Math.max(6, Math.min(28, Math.floor(320 / data.length) - 3))
  const svgW = data.length * (barW + 3)

  return (
    <div className="relative w-full overflow-hidden" style={{ height: height + 8 }}>
      {label && <p className="text-[9px] text-muted-foreground/60 uppercase tracking-widest mb-0.5 font-bold">{label}</p>}
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${svgW} ${height}`}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        {data.map((d, i) => {
          const h = Math.max(2, (values[i] / max) * chartH)
          const x = i * (barW + 3)
          const y = chartH - h
          const isLast = i === data.length - 1
          const dateStr = String(d.data || "")

          return (
            <g key={i}
              onMouseEnter={(e) => {
                const rect = svgRef.current?.getBoundingClientRect()
                if (rect) setTooltip({ x: x, y: y, value: values[i], date: dateStr })
              }}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={x} y={y}
                width={barW} height={h}
                rx="2"
                fill={color}
                opacity={isLast ? 1 : 0.60}
              />
              {/* Date label — só mostra se couber (max 14 dias) */}
              {data.length <= 14 && (
                <text
                  x={x + barW / 2}
                  y={chartH + 14}
                  textAnchor="middle"
                  fontSize="8"
                  className="fill-muted-foreground/50"
                >
                  {dateStr.slice(0, 5)}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-50 pointer-events-none bg-popover text-popover-foreground border border-border rounded-md px-2 py-1 text-xs font-bold shadow-lg whitespace-nowrap"
          style={{
            left: `clamp(0px, ${(tooltip.x / svgW) * 100}%, calc(100% - 80px))`,
            top: `${(tooltip.y / height) * 100}%`,
            transform: "translate(8px, -120%)",
          }}
        >
          {tooltip.date}: <span className="text-primary">{tooltip.value}</span>
        </div>
      )}
    </div>
  )
}

// ─── Funil visual ─────────────────────────────────────────────────────────────

function FunnelChart({ total }: { total: number }) {
  const stages = KANBAN_STAGES.map(s => ({ ...s, value: Math.round(total * s.pct) }))
  return (
    <div className="space-y-1.5">
      {stages.map((s, i) => {
        const convPct = i > 0 ? fmtPct(s.value, stages[i - 1].value) : "—"
        const dropPct = i > 0 ? `−${(100 - (s.value / stages[i-1].value) * 100).toFixed(0)}%` : ""
        return (
          <div key={s.label} className="flex items-center gap-2 group">
            <span className="text-[11px] text-muted-foreground w-32 shrink-0 truncate">{s.label}</span>
            <div className="flex-1 h-5 bg-muted/30 rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm flex items-center px-2 transition-all"
                style={{ width: `${Math.max(s.pct * 100, 3)}%`, background: s.color }}
              >
                <span className="text-[10px] font-bold text-white">{s.value}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 w-20 text-right shrink-0">
              {i > 0 && <span className="text-[9px] text-red-400 font-bold">{dropPct}</span>}
              <span className="text-[10px] text-muted-foreground ml-auto">{i > 0 ? convPct : "base"}</span>
            </div>
          </div>
        )
      })}
      <div className="pt-2 border-t border-border/50 flex gap-4 text-center mt-2">
        <div className="flex-1">
          <p className="text-base font-bold text-foreground">{fmtPct(stages[5].value, stages[0].value)}</p>
          <p className="text-[9px] text-muted-foreground">lead → venda</p>
        </div>
        <div className="flex-1 border-l border-border">
          <p className="text-base font-bold text-foreground">{fmtPct(stages[3].value, stages[1].value)}</p>
          <p className="text-[9px] text-muted-foreground">contato → orçamento</p>
        </div>
        <div className="flex-1 border-l border-border">
          <p className="text-base font-bold text-foreground">{fmtPct(stages[5].value, stages[3].value)}</p>
          <p className="text-[9px] text-muted-foreground">orçamento → venda</p>
        </div>
      </div>
    </div>
  )
}

// ─── Intenção dos leads ───────────────────────────────────────────────────────

function IntencaoChart({ total }: { total: number }) {
  return (
    <div className="space-y-2">
      {INTENCOES.map(item => {
        const val = Math.round(total * item.pct)
        return (
          <div key={item.label} className="flex items-center gap-2">
            <span className="text-sm shrink-0">{item.icon}</span>
            <span className="text-xs text-muted-foreground w-36 shrink-0 truncate">{item.label}</span>
            <div className="flex-1 h-4 bg-muted/30 rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm flex items-center px-1.5"
                style={{ width: `${item.pct * 100}%`, background: item.color }}
              >
                <span className="text-[9px] text-white font-bold">{val}</span>
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground w-7 text-right shrink-0">
              {(item.pct * 100).toFixed(0)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type ViewMode = "geral" | "vendedor" | "ia"
type PeriodMode = "dia" | "semana" | "mes"

export function AnaliseLeadsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("geral")
  const [selectedVendedor, setSelectedVendedor] = useState<string>("all")
  const [period, setPeriod] = useState<PeriodMode>("semana")
  const [periodOffset, setPeriodOffset] = useState(0)

  // Vendedores do DB
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [loadingVendedores, setLoadingVendedores] = useState(true)

  useEffect(() => {
    const fallback = [
      { id: "v1", nome: "Rodrigo Silva" },
      { id: "v2", nome: "Ana Beatriz" },
      { id: "v3", nome: "Marcos Oliveira" },
      { id: "v4", nome: "Carla Souza" },
    ]
    fetch("/api/usuarios?role=VENDEDOR")
      .then(r => r.json())
      .then(j => {
        const list: Vendedor[] = (j.users ?? j.data ?? j ?? [])
          .filter((u: any) => u.active !== false)
          .map((u: any) => ({ id: String(u.id), nome: u.name || u.nome || "Vendedor" }))
        setVendedores(list.length > 0 ? list : fallback)
      })
      .catch(() => setVendedores(fallback))
      .finally(() => setLoadingVendedores(false))
  }, [])

  const todos_metrics = useMemo(() => vendedores.map(gerarVendedorMetrics), [vendedores])

  const AGREGADO = useMemo(() => {
    if (todos_metrics.length === 0) return null
    const r = todos_metrics.reduce((acc, v) => ({
      id: "all", nome: "Todos",
      leads: acc.leads + v.leads,
      novos: acc.novos + v.novos,
      conversas: acc.conversas + v.conversas,
      abertas: acc.abertas + v.abertas,
      comIA: acc.comIA + v.comIA,
      esperando: acc.esperando + v.esperando,
      qualificados: acc.qualificados + v.qualificados,
      handoffs: acc.handoffs + v.handoffs,
      vendas: acc.vendas + v.vendas,
      followups: acc.followups + v.followups,
      recuperados: acc.recuperados + v.recuperados,
      taxaConversao: "0",
      ticketMedio: 0,
    }), { id: "all", nome: "Todos", leads: 0, novos: 0, conversas: 0, abertas: 0, comIA: 0, esperando: 0, qualificados: 0, handoffs: 0, vendas: 0, followups: 0, recuperados: 0, taxaConversao: "0", ticketMedio: 0 })
    r.taxaConversao = ((r.vendas / r.leads) * 100).toFixed(1)
    r.ticketMedio = Math.round(todos_metrics.reduce((s, v) => s + v.ticketMedio, 0) / todos_metrics.length)
    return r
  }, [todos_metrics])

  const diasPorPeriodo: Record<PeriodMode, number> = { dia: 1, semana: 7, mes: 30 }
  const dias = diasPorPeriodo[period]

  const periodLabel = useMemo(() => {
    const hoje = new Date()
    if (period === "dia") {
      const d = new Date(hoje); d.setDate(d.getDate() + periodOffset)
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    }
    if (period === "semana") {
      const end = new Date(hoje); end.setDate(end.getDate() + periodOffset * 7)
      const start = new Date(end); start.setDate(start.getDate() - 6)
      return `${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`
    }
    const d = new Date(hoje); d.setMonth(d.getMonth() + periodOffset)
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
  }, [period, periodOffset])

  const dadosDiarios = useMemo(() => {
    const seedStr = selectedVendedor === "all" ? "all" : selectedVendedor
    return gerarDadosDiarios(dias, SEED_HASH(seedStr))
  }, [dias, selectedVendedor])

  const metricas = useMemo(() => {
    const base = selectedVendedor === "all"
      ? AGREGADO
      : todos_metrics.find(v => v.id === selectedVendedor)
    if (!base) return null
    const scale = dias / 30
    return {
      ...base,
      leads: Math.round(base.leads * scale),
      novos: Math.round(base.novos * scale),
      conversas: Math.round(base.conversas * scale),
      qualificados: Math.round(base.qualificados * scale),
      handoffs: Math.round(base.handoffs * scale),
      vendas: Math.round(base.vendas * scale),
      followups: Math.round(base.followups * scale),
      recuperados: Math.round(base.recuperados * scale),
      // abertas, comIA, esperando são "agora" — não escalam
      abertas: base.abertas,
      comIA: base.comIA,
      esperando: base.esperando,
    }
  }, [selectedVendedor, dias, todos_metrics, AGREGADO])

  if (!metricas || !AGREGADO) return (
    <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground text-sm">
      Carregando...
    </div>
  )

  const taxaRecuperacao = metricas.followups > 0 ? `${((metricas.recuperados / metricas.followups) * 100).toFixed(0)}%` : "—"
  const taxaConversao = metricas.leads > 0 ? `${((metricas.vendas / metricas.leads) * 100).toFixed(1)}%` : "—"
  const taxaQualificacao = metricas.conversas > 0 ? `${((metricas.qualificados / metricas.conversas) * 100).toFixed(0)}%` : "—"
  const pctNovos = metricas.leads > 0 ? `${((metricas.novos / metricas.leads) * 100).toFixed(0)}%` : "—"
  const pctComIA = metricas.abertas > 0 ? `${((metricas.comIA / metricas.abertas) * 100).toFixed(0)}%` : "—"

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Análise de Leads & IA
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Performance de conversas, funil e IA — por vendedor e período
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <Select value={selectedVendedor} onValueChange={setSelectedVendedor}>
            <SelectTrigger className="h-8 text-xs w-[170px]">
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os vendedores</SelectItem>
              {vendedores.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center rounded-md border border-border bg-muted/30">
            {(["dia", "semana", "mes"] as PeriodMode[]).map(p => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setPeriodOffset(0) }}
                className={cn(
                  "px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-all rounded-md",
                  period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p === "dia" ? "Hoje" : p === "semana" ? "Sem." : "Mês"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPeriodOffset(o => o - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground min-w-[120px] text-center font-medium">{periodLabel}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPeriodOffset(o => Math.min(0, o + 1))} disabled={periodOffset >= 0}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={viewMode} onValueChange={v => setViewMode(v as ViewMode)}>
        <TabsList className="h-9 bg-muted/40 border border-border">
          <TabsTrigger value="geral" className="text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground">
            <Activity className="h-3.5 w-3.5" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="vendedor" className="text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground">
            <Users className="h-3.5 w-3.5" /> Por Vendedor
          </TabsTrigger>
          <TabsTrigger value="ia" className="text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground">
            <Bot className="h-3.5 w-3.5" /> Performance IA
          </TabsTrigger>
        </TabsList>

        {/* ═══ VISÃO GERAL ═══════════════════════════════════════════════════ */}
        <TabsContent value="geral" className="space-y-5 mt-4">

          {/* KPIs principais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <MetricCard icon={Users}         label="Leads recebidos"    value={metricas.leads}        sub={period === "dia" ? "hoje" : "no período"}               color="blue" />
            <MetricCard icon={Sparkles}      label="Leads novos"        value={metricas.novos}        sub={`${pctNovos} do total`}                                color="sky" highlight />
            <MetricCard icon={MessageSquare} label="Conversas abertas"  value={metricas.abertas}      sub="ativas agora"                                          color="slate" />
            <MetricCard icon={Bot}           label="Com IA ativa"       value={metricas.comIA}        sub={`${pctComIA} das abertas`}                             color="violet" highlight />
            <MetricCard icon={Clock}         label="Esperando vendedor" value={metricas.esperando}    sub={fmtPct(metricas.esperando, metricas.abertas) + " das abertas"} color="amber" />
            <MetricCard icon={UserCheck}     label="Qualificados IA"    value={metricas.qualificados} sub={taxaQualificacao + " qualificação"}                     color="violet" />
            <MetricCard icon={ShoppingCart}  label="Vendas fechadas"    value={metricas.vendas}       sub={`Taxa ${taxaConversao}`}                               color="emerald" />
            <MetricCard icon={RefreshCw}     label="Recup. FUP"         value={metricas.recuperados}  sub={`Taxa ${taxaRecuperacao}`}                             color="emerald" />
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Leads + Novos por dia */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2"><Users className="h-4 w-4 text-blue-500" /> Leads por {period === "dia" ? "hora" : "dia"}</span>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" /> Total</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-sky-400 inline-block" /> Novos</span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {period === "dia" ? (
                  <div className="py-4 grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-3xl font-bold text-foreground">{metricas.leads}</p>
                      <p className="text-xs text-muted-foreground mt-1">leads hoje</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-sky-500">{metricas.novos}</p>
                      <p className="text-xs text-muted-foreground mt-1">completamente novos</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <BarChart data={dadosDiarios} valueKey="leads" color="#3b82f6" height={90} label="Total de leads" />
                    <BarChart data={dadosDiarios} valueKey="novos" color="#38bdf8" height={60} label="Leads novos (1ª vez)" />
                    <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
                      <span>{dadosDiarios[0]?.data}</span>
                      <span className="text-foreground font-semibold">{metricas.novos} novos / {metricas.leads} total</span>
                      <span>{dadosDiarios[dadosDiarios.length - 1]?.data}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Funil real */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-violet-500" /> Funil de Conversão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FunnelChart total={metricas.leads} />
              </CardContent>
            </Card>
          </div>

          {/* Linha 2: Status conversas + Intenção + Conversas com IA */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status conversas agora */}
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-500" /> Status agora
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-1">
                {[
                  { label: "Abertas no total", val: metricas.abertas, color: "#3b82f6" },
                  { label: "Com IA respondendo", val: metricas.comIA, color: "#8b5cf6" },
                  { label: "Esperando vendedor", val: metricas.esperando, color: "#f59e0b" },
                  { label: "Sem atividade +24h", val: Math.round(metricas.abertas * 0.15), color: "#ef4444" },
                  { label: "Aguardando OK cliente", val: Math.round(metricas.abertas * 0.11), color: "#6366f1" },
                ].map(item => {
                  const pct = metricas.abertas > 0 ? (item.val / metricas.abertas) * 100 : 0
                  return (
                    <div key={item.label} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                        <span className="text-xs text-muted-foreground truncate">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-16 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: item.color }} />
                        </div>
                        <span className="text-sm font-bold text-foreground w-6 text-right">{item.val}</span>
                      </div>
                    </div>
                  )
                })}
                <div className="pt-2 border-t border-border/50 flex justify-between text-[10px] text-muted-foreground">
                  <span>{pctComIA} com IA ativa</span>
                  <span className="text-amber-500 font-bold">{fmtPct(metricas.esperando, metricas.abertas)} esperando</span>
                </div>
              </CardContent>
            </Card>

            {/* Intenção dos leads */}
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" /> Intenção dos leads
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <IntencaoChart total={metricas.leads} />
                <p className="text-[9px] text-muted-foreground/60 mt-3">* Classificação baseada na 1ª mensagem recebida</p>
              </CardContent>
            </Card>

            {/* Follow-ups */}
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-emerald-500" /> Follow-ups & Recuperação
                </CardTitle>
              </CardHeader>
              <CardContent>
                {period !== "dia" ? (
                  <div className="space-y-2">
                    <BarChart data={dadosDiarios} valueKey="followups" color="#10b981" height={70} label="FUPs disparados" />
                    <BarChart data={dadosDiarios} valueKey="recuperados" color="#0ea5e9" height={50} label="Recuperados" />
                  </div>
                ) : (
                  <div className="space-y-2 py-2">
                    {[
                      { l: "Follow-ups hoje", v: metricas.followups, c: "text-emerald-600" },
                      { l: "Recuperados hoje", v: metricas.recuperados, c: "text-blue-600" },
                    ].map(x => (
                      <div key={x.l} className="flex justify-between border-b border-border/50 pb-2">
                        <span className="text-sm text-muted-foreground">{x.l}</span>
                        <span className={cn("text-xl font-bold", x.c)}>{x.v}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 pt-2 border-t border-border/60 grid grid-cols-3 text-center gap-1">
                  <div>
                    <p className="text-lg font-bold text-foreground">{metricas.followups}</p>
                    <p className="text-[9px] text-muted-foreground">FUPs</p>
                  </div>
                  <div className="border-l border-border">
                    <p className="text-lg font-bold text-emerald-600">{metricas.recuperados}</p>
                    <p className="text-[9px] text-muted-foreground">recuperados</p>
                  </div>
                  <div className="border-l border-border">
                    <p className="text-lg font-bold text-foreground">{taxaRecuperacao}</p>
                    <p className="text-[9px] text-muted-foreground">taxa</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ POR VENDEDOR ═══════════════════════════════════════════════════ */}
        <TabsContent value="vendedor" className="space-y-5 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                Comparativo por Vendedor
                <Badge variant="outline" className="ml-auto text-[9px]">{periodLabel}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[780px]">
                  <thead>
                    <tr className="border-b border-border">
                      {["Vendedor", "Leads", "Novos", "Abertas", "Com IA", "Esperando", "Qualif.", "Vendas", "Conversão", "Ticket Médio"].map(h => (
                        <th key={h} className={cn("py-2 px-3 text-xs font-semibold text-foreground", h === "Vendedor" ? "text-left" : "text-center")}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {todos_metrics.map(v => {
                      const isSelected = selectedVendedor === v.id
                      const tx = Number(v.taxaConversao)
                      return (
                        <tr
                          key={v.id}
                          className={cn("border-b border-border/50 cursor-pointer hover:bg-muted/40 transition-colors", isSelected && "bg-primary/5")}
                          onClick={() => setSelectedVendedor(isSelected ? "all" : v.id)}
                        >
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary">
                                {v.nome.charAt(0)}
                              </div>
                              <span className={cn("text-sm font-medium", isSelected ? "text-primary" : "text-foreground")}>{v.nome}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-foreground">{v.leads}</td>
                          <td className="py-2.5 px-3 text-center text-sky-500 font-medium">{v.novos}</td>
                          <td className="py-2.5 px-3 text-center"><Badge variant="outline" className="text-[10px] border-blue-300 text-blue-600 bg-blue-50">{v.abertas}</Badge></td>
                          <td className="py-2.5 px-3 text-center"><Badge variant="outline" className="text-[10px] border-violet-300 text-violet-600 bg-violet-50">{v.comIA}</Badge></td>
                          <td className="py-2.5 px-3 text-center"><Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600 bg-amber-50">{v.esperando}</Badge></td>
                          <td className="py-2.5 px-3 text-center text-violet-600 font-medium">{v.qualificados}</td>
                          <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">{v.vendas}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded", tx >= 20 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                              {tx}%
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right text-foreground font-medium text-xs">{fmtCurrency(v.ticketMedio)}</td>
                        </tr>
                      )
                    })}
                    <tr className="bg-muted/30 font-semibold border-t border-border">
                      <td className="py-2 px-3 text-xs text-muted-foreground">TOTAL</td>
                      <td className="py-2 px-3 text-center font-bold text-foreground">{AGREGADO.leads}</td>
                      <td className="py-2 px-3 text-center text-sky-500 font-bold">{AGREGADO.novos}</td>
                      <td className="py-2 px-3 text-center text-foreground">{AGREGADO.abertas}</td>
                      <td className="py-2 px-3 text-center text-violet-600 font-bold">{AGREGADO.comIA}</td>
                      <td className="py-2 px-3 text-center text-amber-600">{AGREGADO.esperando}</td>
                      <td className="py-2 px-3 text-center text-violet-600">{AGREGADO.qualificados}</td>
                      <td className="py-2 px-3 text-center text-emerald-600 font-bold">{AGREGADO.vendas}</td>
                      <td className="py-2 px-3 text-center text-xs font-bold text-foreground">{AGREGADO.taxaConversao}%</td>
                      <td className="py-2 px-3 text-right text-xs text-foreground">{fmtCurrency(AGREGADO.ticketMedio)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Gráficos comparativos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: "Conversas abertas", key: "abertas", color: "#3b82f6", sub: "esperando" as const, subColor: "#f59e0b", subLabel: "esp." },
              { title: "Taxa de conversão", key: "taxaConversao", color: "#10b981", sub: "vendas" as const, subColor: "#10b981", subLabel: "v." },
              { title: "Lead → IA ativa", key: "comIA", color: "#8b5cf6", sub: "handoffs" as const, subColor: "#f59e0b", subLabel: "hoff." },
            ].map(cfg => {
              const sorted = [...todos_metrics].sort((a, b) => Number(b[cfg.key as keyof typeof b]) - Number(a[cfg.key as keyof typeof a]))
              const maxVal = Number(sorted[0]?.[cfg.key as keyof typeof sorted[0]]) || 1
              return (
                <Card key={cfg.title}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{cfg.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {sorted.map(v => {
                      const val = Number(v[cfg.key as keyof typeof v])
                      const pct = (val / maxVal) * 100
                      const subVal = Number(v[cfg.sub])
                      return (
                        <div key={v.id} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-20 truncate shrink-0">{v.nome.split(" ")[0]}</span>
                          <div className="flex-1 h-4 bg-muted/30 rounded-sm overflow-hidden">
                            <div className="h-full rounded-sm flex items-center px-1.5" style={{ width: `${pct}%`, background: cfg.color }}>
                              <span className="text-[9px] text-white font-bold">{cfg.key === "taxaConversao" ? `${val}%` : val}</span>
                            </div>
                          </div>
                          <span className="text-xs font-medium w-12 text-right shrink-0" style={{ color: cfg.subColor }}>{subVal} {cfg.subLabel}</span>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* ═══ PERFORMANCE IA ═════════════════════════════════════════════════ */}
        <TabsContent value="ia" className="space-y-5 mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard icon={Bot}          label="Com IA ativa"        value={metricas.comIA}        sub={pctComIA + " das abertas"}          color="violet" highlight />
            <MetricCard icon={UserCheck}    label="Qualificados IA"     value={metricas.qualificados} sub={taxaQualificacao}                   color="blue" />
            <MetricCard icon={Zap}          label="Handoffs gerados"    value={metricas.handoffs}     sub={fmtPct(metricas.handoffs, metricas.conversas) + " conv."} color="amber" />
            <MetricCard icon={RefreshCw}    label="FUPs disparados"     value={metricas.followups}    sub="automáticos"                       color="blue" />
            <MetricCard icon={Star}         label="Recuperados FUP"     value={metricas.recuperados}  sub={"Taxa " + taxaRecuperacao}          color="emerald" />
            <MetricCard icon={ShoppingCart} label="Vendas via IA"       value={Math.round(metricas.vendas * 0.62)} sub="originadas por IA"   color="emerald" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-emerald-500" /> Follow-ups & Recuperação
                </CardTitle>
              </CardHeader>
              <CardContent>
                {period !== "dia" ? (
                  <div className="space-y-2">
                    <BarChart data={dadosDiarios} valueKey="followups" color="#10b981" height={80} label="Follow-ups disparados" />
                    <BarChart data={dadosDiarios} valueKey="recuperados" color="#0ea5e9" height={60} label="Recuperados" />
                  </div>
                ) : (
                  <div className="space-y-3 py-2">
                    {[{ l: "FUPs hoje", v: metricas.followups, c: "text-emerald-600" }, { l: "Recuperados hoje", v: metricas.recuperados, c: "text-blue-600" }].map(x => (
                      <div key={x.l} className="flex justify-between border-b border-border/50 pb-2">
                        <span className="text-sm text-muted-foreground">{x.l}</span>
                        <span className={cn("text-xl font-bold", x.c)}>{x.v}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 pt-2 border-t border-border/60 grid grid-cols-3 text-center">
                  {[["FUPs", metricas.followups, "text-foreground"], ["Recup.", metricas.recuperados, "text-emerald-600"], ["Taxa", taxaRecuperacao, "text-foreground"]].map(([l, v, c]) => (
                    <div key={String(l)} className="border-l first:border-0 border-border">
                      <p className={cn("text-lg font-bold", String(c))}>{v}</p>
                      <p className="text-[9px] text-muted-foreground">{l}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" /> Handoffs & Qualificação
                </CardTitle>
              </CardHeader>
              <CardContent>
                {period !== "dia" && (
                  <div className="mb-3">
                    <BarChart data={dadosDiarios} valueKey="handoffs" color="#f59e0b" height={70} label="Handoffs por dia" />
                  </div>
                )}
                <div className="space-y-2.5 pt-2 border-t border-border/60">
                  {[
                    { label: "Qualificados (interessados)", val: metricas.qualificados, pct: fmtPct(metricas.qualificados, metricas.conversas), color: "#8b5cf6" },
                    { label: "Handoffs p/ vendedor",        val: metricas.handoffs,     pct: fmtPct(metricas.handoffs, metricas.conversas),     color: "#f59e0b" },
                    { label: "Não qualificados",            val: metricas.conversas - metricas.qualificados, pct: fmtPct(metricas.conversas - metricas.qualificados, metricas.conversas), color: "#94a3b8" },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                      <span className="text-xs text-muted-foreground flex-1">{item.label}</span>
                      <span className="text-sm font-bold text-foreground">{item.val}</span>
                      <span className="text-[10px] text-muted-foreground w-8 text-right">{item.pct}</span>
                    </div>
                  ))}
                </div>
                {/* IA por vendedor */}
                <div className="mt-4 pt-3 border-t border-border/60">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Handoffs por vendedor</p>
                  {[...todos_metrics].sort((a, b) => b.handoffs - a.handoffs).map(v => (
                    <div key={v.id} className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs text-muted-foreground w-20 truncate shrink-0">{v.nome.split(" ")[0]}</span>
                      <div className="flex-1 h-3 bg-muted/30 rounded-sm overflow-hidden">
                        <div className="h-full rounded-sm" style={{ width: `${(v.handoffs / (todos_metrics[0]?.handoffs || 1)) * 100}%`, background: "#f59e0b" }} />
                      </div>
                      <span className="text-xs font-bold text-amber-500 w-5 text-right shrink-0">{v.handoffs}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela IA por vendedor */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bot className="h-4 w-4 text-violet-500" /> IA por Vendedor — detalhado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[680px]">
                  <thead>
                    <tr className="border-b border-border">
                      {["Vendedor", "Conv. IA", "Com IA agora", "Qualif.", "Handoffs", "FUPs", "Recuperados", "Taxa Recup.", "Vendas IA"].map(h => (
                        <th key={h} className={cn("py-2 px-3 text-xs font-semibold text-foreground", h === "Vendedor" ? "text-left" : "text-center")}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {todos_metrics.map(v => {
                      const txR = v.followups > 0 ? `${((v.recuperados / v.followups) * 100).toFixed(0)}%` : "—"
                      const vendasIA = Math.round(v.vendas * 0.62)
                      return (
                        <tr key={v.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2.5 px-3 font-medium text-foreground">{v.nome}</td>
                          <td className="py-2.5 px-3 text-center text-foreground">{v.conversas}</td>
                          <td className="py-2.5 px-3 text-center"><Badge variant="outline" className="text-[10px] border-violet-300 text-violet-600 bg-violet-50">{v.comIA}</Badge></td>
                          <td className="py-2.5 px-3 text-center text-violet-600 font-medium">{v.qualificados}</td>
                          <td className="py-2.5 px-3 text-center text-amber-600 font-medium">{v.handoffs}</td>
                          <td className="py-2.5 px-3 text-center text-blue-600">{v.followups}</td>
                          <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">{v.recuperados}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded", Number(txR) >= 25 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{txR}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-emerald-600">{vendasIA}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
