"use client"

import { useState, useMemo } from "react"
import {
  Bot, Users, MessageSquare, TrendingUp, Clock, Zap, RefreshCw,
  ChevronLeft, ChevronRight, Filter, BarChart3, AlertCircle,
  CheckCircle2, XCircle, ArrowUpDown, Phone, ShoppingCart,
  UserCheck, UserMinus, Activity, Target
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// ─── Mock Data ────────────────────────────────────────────────────────────────

const VENDEDORES_MOCK = [
  { id: "v1", nome: "Rafael Mendes" },
  { id: "v2", nome: "Carla Souza" },
  { id: "v3", nome: "Bruno Lima" },
  { id: "v4", nome: "Aline Castro" },
]

// Gera métricas diárias para o período (últimos N dias)
function gerarDadosDiarios(dias: number, vendedorId: string | null) {
  const seed = vendedorId ? vendedorId.charCodeAt(1) : 7
  const hoje = new Date()
  return Array.from({ length: dias }, (_, i) => {
    const d = new Date(hoje)
    d.setDate(d.getDate() - (dias - 1 - i))
    const base = 10 + ((seed * (i + 3)) % 6)
    const leads = base + Math.floor(Math.random() * 4)
    const conversas = Math.round(leads * (0.72 + Math.random() * 0.18))
    const qualificados = Math.round(conversas * (0.38 + Math.random() * 0.22))
    const handoffs = Math.round(conversas * (0.12 + Math.random() * 0.1))
    const vendas = Math.round(qualificados * (0.18 + Math.random() * 0.12))
    const followups = Math.round(conversas * (0.28 + Math.random() * 0.12))
    const recuperados = Math.round(followups * (0.22 + Math.random() * 0.12))
    return {
      data: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      leads, conversas, qualificados, handoffs, vendas, followups, recuperados,
      esperando: Math.round(conversas * (0.28 + Math.random() * 0.18)),
    }
  })
}

// Gera snapshot atual por vendedor
function gerarVendedorMetrics(v: { id: string; nome: string }) {
  const seed = v.id.charCodeAt(1)
  const leads = 180 + (seed * 13 % 120)
  const conversas = Math.round(leads * 0.78)
  const abertas = Math.round(conversas * 0.35)
  const esperando = Math.round(abertas * (0.28 + (seed % 3) * 0.08))
  const qualificados = Math.round(conversas * 0.42)
  const handoffs = Math.round(conversas * 0.14)
  const vendas = Math.round(qualificados * 0.22)
  const followups = Math.round(conversas * 0.31)
  const recuperados = Math.round(followups * 0.25)
  const taxaConversao = ((vendas / leads) * 100).toFixed(1)
  const ticketMedio = 1800 + (seed * 37 % 1400)
  return {
    ...v, leads, conversas, abertas, esperando, qualificados, handoffs,
    vendas, followups, recuperados, taxaConversao, ticketMedio,
  }
}

const TODOS_VENDEDORES_METRICS = VENDEDORES_MOCK.map(gerarVendedorMetrics)

// Agrega todos
const AGREGADO = TODOS_VENDEDORES_METRICS.reduce((acc, v) => ({
  nome: "Todos", id: "all",
  leads: acc.leads + v.leads,
  conversas: acc.conversas + v.conversas,
  abertas: acc.abertas + v.abertas,
  esperando: acc.esperando + v.esperando,
  qualificados: acc.qualificados + v.qualificados,
  handoffs: acc.handoffs + v.handoffs,
  vendas: acc.vendas + v.vendas,
  followups: acc.followups + v.followups,
  recuperados: acc.recuperados + v.recuperados,
  taxaConversao: "0",
  ticketMedio: 0,
}), { nome: "Todos", id: "all", leads: 0, conversas: 0, abertas: 0, esperando: 0, qualificados: 0, handoffs: 0, vendas: 0, followups: 0, recuperados: 0, taxaConversao: "0", ticketMedio: 0 })

AGREGADO.taxaConversao = ((AGREGADO.vendas / AGREGADO.leads) * 100).toFixed(1)
AGREGADO.ticketMedio = Math.round(TODOS_VENDEDORES_METRICS.reduce((s, v) => s + v.ticketMedio, 0) / TODOS_VENDEDORES_METRICS.length)

// ─── Formatadores ─────────────────────────────────────────────────────────────

const fmtCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v)
const fmtPct = (v: number, t: number) => t > 0 ? `${((v / t) * 100).toFixed(0)}%` : "—"

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, sub, color = "blue" }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string
}) {
  const colors: Record<string, string> = {
    blue: "text-blue-600 bg-blue-500/10 border-blue-500/20",
    emerald: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-600 bg-amber-500/10 border-amber-500/20",
    violet: "text-violet-600 bg-violet-500/10 border-violet-500/20",
    red: "text-red-500 bg-red-500/10 border-red-500/20",
    slate: "text-slate-500 bg-slate-500/10 border-slate-500/20",
  }
  const cls = colors[color] ?? colors.blue
  return (
    <Card className="border-border">
      <CardContent className="pt-4 pb-3">
        <div className={cn("inline-flex items-center justify-center h-8 w-8 rounded-lg border mb-2", cls)}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-[11px] font-semibold text-foreground mt-1">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}

// Mini bar chart (SVG inline)
function BarChart({ data, valueKey, color = "#3b82f6", height = 80 }: {
  data: Record<string, unknown>[]
  valueKey: string
  color?: string
  height?: number
}) {
  const values = data.map(d => Number(d[valueKey]) || 0)
  const max = Math.max(...values, 1)
  const barW = Math.max(4, Math.floor(280 / data.length) - 2)

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${data.length * (barW + 2)} ${height}`} preserveAspectRatio="none">
      {data.map((d, i) => {
        const h = Math.max(2, (values[i] / max) * (height - 16))
        return (
          <g key={i}>
            <rect
              x={i * (barW + 2)} y={height - 16 - h}
              width={barW} height={h}
              rx="2" fill={color} opacity={i === data.length - 1 ? 1 : 0.65}
            />
            {data.length <= 14 && (
              <text x={i * (barW + 2) + barW / 2} y={height - 2} textAnchor="middle"
                fontSize="7" fill="currentColor" className="fill-muted-foreground/60">
                {String(d.data || "").slice(0, 5)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// Funil visual
function FunnelChart({ stages }: { stages: { label: string; value: number; color: string }[] }) {
  const max = stages[0]?.value || 1
  return (
    <div className="space-y-1.5">
      {stages.map((s, i) => {
        const pct = (s.value / max) * 100
        const convPct = i > 0 ? fmtPct(s.value, stages[i - 1].value) : "100%"
        return (
          <div key={s.label} className="flex items-center gap-2 group">
            <span className="text-[11px] text-muted-foreground w-28 shrink-0 truncate">{s.label}</span>
            <div className="flex-1 h-5 bg-muted/30 rounded-sm overflow-hidden relative">
              <div
                className="h-full rounded-sm transition-all flex items-center px-2"
                style={{ width: `${Math.max(pct, 3)}%`, background: s.color }}
              >
                <span className="text-[10px] font-bold text-white opacity-90 truncate">{s.value}</span>
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground w-8 text-right shrink-0">{convPct}</span>
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
  const [periodOffset, setPeriodOffset] = useState(0) // 0 = atual, -1 = anterior, etc.

  const diasPorPeriodo: Record<PeriodMode, number> = { dia: 1, semana: 7, mes: 30 }
  const dias = diasPorPeriodo[period]

  // Navegar período
  const periodLabel = useMemo(() => {
    const hoje = new Date()
    if (period === "dia") {
      const d = new Date(hoje)
      d.setDate(d.getDate() + periodOffset)
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    }
    if (period === "semana") {
      const end = new Date(hoje)
      end.setDate(end.getDate() + periodOffset * 7)
      const start = new Date(end)
      start.setDate(start.getDate() - 6)
      return `${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`
    }
    const d = new Date(hoje)
    d.setMonth(d.getMonth() + periodOffset)
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
  }, [period, periodOffset])

  const dadosDiarios = useMemo(
    () => gerarDadosDiarios(dias, selectedVendedor === "all" ? null : selectedVendedor),
    [dias, selectedVendedor]
  )

  // Métricas do período selecionado
  const metricas = useMemo(() => {
    const base = selectedVendedor === "all"
      ? AGREGADO
      : TODOS_VENDEDORES_METRICS.find(v => v.id === selectedVendedor) ?? AGREGADO

    // Escalar pelo período (simplificado para mock)
    const scale = dias / 30
    return {
      ...base,
      leads: Math.round(base.leads * scale),
      conversas: Math.round(base.conversas * scale),
      abertas: base.abertas, // sempre atual
      esperando: base.esperando,
      qualificados: Math.round(base.qualificados * scale),
      handoffs: Math.round(base.handoffs * scale),
      vendas: Math.round(base.vendas * scale),
      followups: Math.round(base.followups * scale),
      recuperados: Math.round(base.recuperados * scale),
    }
  }, [selectedVendedor, dias])

  const taxaRecuperacao = metricas.followups > 0
    ? `${((metricas.recuperados / metricas.followups) * 100).toFixed(0)}%`
    : "—"
  const taxaConversao = metricas.leads > 0
    ? `${((metricas.vendas / metricas.leads) * 100).toFixed(1)}%`
    : "—"
  const taxaQualificacao = metricas.conversas > 0
    ? `${((metricas.qualificados / metricas.conversas) * 100).toFixed(0)}%`
    : "—"

  const funnelStages = [
    { label: "Leads Recebidos", value: metricas.leads, color: "#64748b" },
    { label: "Conversas Iniciadas", value: metricas.conversas, color: "#3b82f6" },
    { label: "Qualificados pela IA", value: metricas.qualificados, color: "#8b5cf6" },
    { label: "Handoffs p/ Vendedor", value: metricas.handoffs, color: "#f59e0b" },
    { label: "Vendas Fechadas", value: metricas.vendas, color: "#10b981" },
  ]

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

        {/* Controles */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Filtro por vendedor */}
          <Select value={selectedVendedor} onValueChange={setSelectedVendedor}>
            <SelectTrigger className="h-8 text-xs w-[160px]">
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os vendedores</SelectItem>
              {VENDEDORES_MOCK.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Período */}
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

          {/* Nav de período */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPeriodOffset(o => o - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground min-w-[110px] text-center font-medium">{periodLabel}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPeriodOffset(o => Math.min(0, o + 1))} disabled={periodOffset >= 0}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs: Geral / Vendedores / IA */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
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

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB: VISÃO GERAL                                               */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="geral" className="space-y-5 mt-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard icon={Users}        label="Leads recebidos"       value={metricas.leads}        sub={period === "dia" ? "hoje" : `no período`}     color="blue" />
            <MetricCard icon={MessageSquare} label="Conversas abertas"    value={metricas.abertas}      sub="aguardando resposta"                          color="slate" />
            <MetricCard icon={Clock}         label="Esperando vendedor"   value={metricas.esperando}    sub={`${fmtPct(metricas.esperando, metricas.abertas)} das abertas`} color="amber" />
            <MetricCard icon={UserCheck}     label="Qualificados IA"      value={metricas.qualificados} sub={taxaQualificacao + " qualificação"}            color="violet" />
            <MetricCard icon={ShoppingCart}  label="Vendas fechadas"      value={metricas.vendas}       sub={`Taxa ${taxaConversao}`}                      color="emerald" />
            <MetricCard icon={TrendingUp}    label="Recup. follow-up"     value={metricas.recuperados}  sub={`Taxa ${taxaRecuperacao}`}                    color="emerald" />
          </div>

          {/* Gráfico de Leads por dia + Funil */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Leads por dia */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2"><Users className="h-4 w-4 text-blue-500" /> Leads por dia</span>
                  <Badge variant="outline" className="text-[9px]">{period}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {period === "dia" ? (
                  <div className="py-6 text-center text-muted-foreground text-sm">
                    <p className="font-bold text-3xl text-foreground">{metricas.leads}</p>
                    <p className="text-xs mt-1">leads recebidos hoje</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <BarChart data={dadosDiarios} valueKey="leads" color="#3b82f6" height={90} />
                    <div className="flex justify-between text-[9px] text-muted-foreground px-0.5 pt-1">
                      <span>{dadosDiarios[0]?.data}</span>
                      <span className="text-foreground font-semibold">{metricas.leads} leads total</span>
                      <span>{dadosDiarios[dadosDiarios.length - 1]?.data}</span>
                    </div>
                  </div>
                )}
                {/* Linha secundária: conversas */}
                {period !== "dia" && (
                  <div className="mt-3 pt-3 border-t border-border/60">
                    <p className="text-[10px] text-muted-foreground mb-1 font-medium">Conversas iniciadas</p>
                    <BarChart data={dadosDiarios} valueKey="conversas" color="#8b5cf6" height={50} />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Funil de Conversão */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-violet-500" /> Funil de Conversão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FunnelChart stages={funnelStages} />
                <div className="mt-4 pt-3 border-t border-border/60 grid grid-cols-2 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-foreground">{taxaConversao}</p>
                    <p className="text-[10px] text-muted-foreground">lead → venda</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">{taxaQualificacao}</p>
                    <p className="text-[10px] text-muted-foreground">conversa → qualif.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Segunda linha: Handoffs + Follow-ups + Conversas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Handoffs */}
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" /> Handoffs IA → Vendedor
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-foreground">{metricas.handoffs}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmtPct(metricas.handoffs, metricas.conversas)} das conversas</p>
                </div>
                <div className="w-16 h-16 rounded-full border-4 border-amber-500/30 flex items-center justify-center">
                  <span className="text-sm font-bold text-amber-400">{fmtPct(metricas.handoffs, metricas.conversas)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Follow-ups */}
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-emerald-500" /> Follow-ups IA
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-foreground">{metricas.followups}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{metricas.recuperados} recuperados ({taxaRecuperacao})</p>
                </div>
                <div className="w-16 h-16 rounded-full border-4 border-emerald-500/30 flex items-center justify-center">
                  <span className="text-sm font-bold text-emerald-400">{taxaRecuperacao}</span>
                </div>
              </CardContent>
            </Card>

            {/* Conversas em aberto */}
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-500" /> Status das Conversas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-1">
                {[
                  { label: "Abertas agora", val: metricas.abertas, color: "#3b82f6" },
                  { label: "Esperando vendedor", val: metricas.esperando, color: "#f59e0b" },
                  { label: "Com IA ativa", val: Math.round(metricas.abertas * 0.55), color: "#8b5cf6" },
                  { label: "Sem atividade +24h", val: Math.round(metricas.abertas * 0.18), color: "#ef4444" },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                    </div>
                    <span className="text-sm font-bold text-foreground">{item.val}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB: POR VENDEDOR                                              */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="vendedor" className="space-y-5 mt-4">
          {/* Comparativo por vendedor */}
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
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-foreground">Vendedor</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-foreground">Leads</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-foreground">Conversas</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-foreground">Abertas</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-foreground">Esperando</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-foreground">Qualif. IA</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-foreground">Vendas</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-foreground">Conversão</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-foreground">Ticket Médio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TODOS_VENDEDORES_METRICS.map((v, i) => {
                      const isSelected = selectedVendedor === v.id
                      const taxaConv = ((v.vendas / v.leads) * 100).toFixed(1)
                      return (
                        <tr
                          key={v.id}
                          className={cn(
                            "border-b border-border/50 cursor-pointer hover:bg-muted/40 transition-colors",
                            isSelected ? "bg-primary/5" : ""
                          )}
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
                          <td className="py-2.5 px-3 text-center font-semibold text-foreground">{v.leads}</td>
                          <td className="py-2.5 px-3 text-center text-foreground">{v.conversas}</td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-600 bg-blue-50">{v.abertas}</Badge>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600 bg-amber-50">{v.esperando}</Badge>
                          </td>
                          <td className="py-2.5 px-3 text-center text-violet-600 font-medium">{v.qualificados}</td>
                          <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">{v.vendas}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded", Number(taxaConv) >= 20 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                              {taxaConv}%
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right text-foreground font-medium text-xs">{fmtCurrency(v.ticketMedio)}</td>
                        </tr>
                      )
                    })}
                    {/* Linha total */}
                    <tr className="bg-muted/30 font-semibold">
                      <td className="py-2 px-3 text-xs text-muted-foreground">TOTAL</td>
                      <td className="py-2 px-3 text-center text-sm font-bold text-foreground">{AGREGADO.leads}</td>
                      <td className="py-2 px-3 text-center text-sm text-foreground">{AGREGADO.conversas}</td>
                      <td className="py-2 px-3 text-center text-sm text-foreground">{AGREGADO.abertas}</td>
                      <td className="py-2 px-3 text-center text-sm text-foreground">{AGREGADO.esperando}</td>
                      <td className="py-2 px-3 text-center text-sm text-violet-600">{AGREGADO.qualificados}</td>
                      <td className="py-2 px-3 text-center text-sm text-emerald-600 font-bold">{AGREGADO.vendas}</td>
                      <td className="py-2 px-3 text-center text-xs font-bold text-foreground">{AGREGADO.taxaConversao}%</td>
                      <td className="py-2 px-3 text-right text-xs text-foreground">{fmtCurrency(AGREGADO.ticketMedio)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Gráficos comparativos lado a lado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Conversas por vendedor */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-500" /> Conversas abertas por vendedor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {TODOS_VENDEDORES_METRICS.sort((a, b) => b.abertas - a.abertas).map(v => {
                  const maxAbertas = Math.max(...TODOS_VENDEDORES_METRICS.map(x => x.abertas))
                  const pct = (v.abertas / maxAbertas) * 100
                  return (
                    <div key={v.id} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-24 truncate shrink-0">{v.nome.split(" ")[0]}</span>
                      <div className="flex-1 h-4 bg-muted/30 rounded-sm overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-sm flex items-center px-1.5" style={{ width: `${pct}%` }}>
                          <span className="text-[9px] text-white font-bold">{v.abertas}</span>
                        </div>
                      </div>
                      <span className="text-xs text-amber-500 font-medium w-14 text-right shrink-0">{v.esperando} esp.</span>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Taxa de conversão por vendedor */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" /> Taxa de conversão por vendedor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {TODOS_VENDEDORES_METRICS.sort((a, b) => Number(b.taxaConversao) - Number(a.taxaConversao)).map(v => {
                  const tx = Number(v.taxaConversao)
                  const color = tx >= 22 ? "#10b981" : tx >= 16 ? "#f59e0b" : "#ef4444"
                  return (
                    <div key={v.id} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-24 truncate shrink-0">{v.nome.split(" ")[0]}</span>
                      <div className="flex-1 h-4 bg-muted/30 rounded-sm overflow-hidden">
                        <div className="h-full rounded-sm flex items-center px-1.5" style={{ width: `${Math.min(tx * 3, 100)}%`, background: color }}>
                          <span className="text-[9px] text-white font-bold">{tx}%</span>
                        </div>
                      </div>
                      <span className="text-xs font-bold w-10 text-right shrink-0" style={{ color }}>{v.vendas} v.</span>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB: PERFORMANCE IA                                            */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="ia" className="space-y-5 mt-4">
          {/* KPIs da IA */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard icon={Bot}           label="Conversas c/ IA"       value={metricas.conversas}    sub="tiveram IA ativa"             color="violet" />
            <MetricCard icon={UserCheck}     label="Qualificados pela IA"  value={metricas.qualificados}  sub={taxaQualificacao}             color="blue" />
            <MetricCard icon={Zap}           label="Handoffs gerados"      value={metricas.handoffs}      sub={fmtPct(metricas.handoffs, metricas.conversas) + " das conversas"} color="amber" />
            <MetricCard icon={RefreshCw}     label="Follow-ups disparados" value={metricas.followups}     sub="automáticos"                 color="blue" />
            <MetricCard icon={CheckCircle2}  label="Recuperados FUP"       value={metricas.recuperados}   sub={`Taxa ${taxaRecuperacao}`}   color="emerald" />
            <MetricCard icon={ShoppingCart}  label="Vendas via IA"         value={Math.round(metricas.vendas * 0.62)} sub="originadas por IA"  color="emerald" />
          </div>

          {/* Gráficos IA */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Follow-ups por dia */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-emerald-500" /> Follow-ups & Recuperação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {period !== "dia" ? (
                  <>
                    <p className="text-[10px] text-muted-foreground font-medium">Follow-ups disparados</p>
                    <BarChart data={dadosDiarios} valueKey="followups" color="#10b981" height={70} />
                    <div className="mt-2 pt-2 border-t border-border/60">
                      <p className="text-[10px] text-muted-foreground font-medium mb-1">Recuperados</p>
                      <BarChart data={dadosDiarios} valueKey="recuperados" color="#0ea5e9" height={50} />
                    </div>
                  </>
                ) : (
                  <div className="space-y-3 pt-2">
                    {[
                      { label: "Follow-ups hoje", val: metricas.followups, color: "text-emerald-600" },
                      { label: "Recuperados hoje", val: metricas.recuperados, color: "text-blue-600" },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between border-b border-border/50 pb-2">
                        <span className="text-sm text-muted-foreground">{item.label}</span>
                        <span className={cn("text-2xl font-bold", item.color)}>{item.val}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-border/60 flex gap-4 text-center">
                  <div className="flex-1">
                    <p className="text-xl font-bold text-foreground">{metricas.followups}</p>
                    <p className="text-[10px] text-muted-foreground">total FUPs</p>
                  </div>
                  <div className="flex-1 border-l border-border">
                    <p className="text-xl font-bold text-emerald-600">{metricas.recuperados}</p>
                    <p className="text-[10px] text-muted-foreground">recuperados</p>
                  </div>
                  <div className="flex-1 border-l border-border">
                    <p className="text-xl font-bold text-foreground">{taxaRecuperacao}</p>
                    <p className="text-[10px] text-muted-foreground">taxa recup.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Handoffs por origem */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" /> Handoffs & Qualificação
                </CardTitle>
              </CardHeader>
              <CardContent>
                {period !== "dia" && (
                  <div className="mb-3">
                    <p className="text-[10px] text-muted-foreground font-medium mb-1">Handoffs por dia</p>
                    <BarChart data={dadosDiarios} valueKey="handoffs" color="#f59e0b" height={60} />
                  </div>
                )}
                <div className="space-y-2.5 pt-2 border-t border-border/60">
                  {[
                    { label: "Qualificados (interessados)", val: metricas.qualificados, pct: fmtPct(metricas.qualificados, metricas.conversas), color: "#8b5cf6" },
                    { label: "Handoffs p/ vendedor", val: metricas.handoffs, pct: fmtPct(metricas.handoffs, metricas.conversas), color: "#f59e0b" },
                    { label: "Não qualificados", val: metricas.conversas - metricas.qualificados, pct: fmtPct(metricas.conversas - metricas.qualificados, metricas.conversas), color: "#94a3b8" },
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
                  {TODOS_VENDEDORES_METRICS.sort((a, b) => b.handoffs - a.handoffs).map(v => (
                    <div key={v.id} className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs text-muted-foreground w-20 truncate shrink-0">{v.nome.split(" ")[0]}</span>
                      <div className="flex-1 h-3 bg-muted/30 rounded-sm overflow-hidden">
                        <div className="h-full rounded-sm" style={{ width: `${(v.handoffs / TODOS_VENDEDORES_METRICS[0].handoffs) * 100}%`, background: "#f59e0b" }} />
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
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-foreground">Vendedor</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-foreground">Conv. IA</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-foreground">Qualif.</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-foreground">Handoffs</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-foreground">FUPs</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-foreground">Recuperados</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-foreground">Taxa Recup.</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-foreground">Vendas IA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TODOS_VENDEDORES_METRICS.map(v => {
                      const txRecup = v.followups > 0 ? `${((v.recuperados / v.followups) * 100).toFixed(0)}%` : "—"
                      const vendasIa = Math.round(v.vendas * 0.62)
                      return (
                        <tr key={v.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2.5 px-3 font-medium text-foreground">{v.nome}</td>
                          <td className="py-2.5 px-3 text-center text-foreground">{v.conversas}</td>
                          <td className="py-2.5 px-3 text-center text-violet-600 font-medium">{v.qualificados}</td>
                          <td className="py-2.5 px-3 text-center text-amber-600 font-medium">{v.handoffs}</td>
                          <td className="py-2.5 px-3 text-center text-blue-600">{v.followups}</td>
                          <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">{v.recuperados}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded", Number(txRecup) >= 25 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                              {txRecup}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-emerald-600">{vendasIa}</td>
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
