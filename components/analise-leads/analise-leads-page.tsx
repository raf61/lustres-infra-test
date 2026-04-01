"use client"

import { useState, useMemo, useEffect } from "react"
import {
  AreaChart, Area,
  BarChart as ReBarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import {
  Bot, Users, MessageSquare, TrendingUp, Clock, Zap, RefreshCw,
  ChevronLeft, ChevronRight, Activity, Target, Sparkles, Star,
  ArrowUpRight, ArrowDownRight, Minus, UserCheck, ShoppingCart,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

type Vendedor = { id: string; nome: string }
type PeriodMode = "dia" | "semana" | "mes"
type ViewMode = "geral" | "vendedor" | "ia"

// ─── Pipeline stages (matches actual system) ─────────────────────────────────

const PIPELINE_STAGES = [
  { label: "A fazer contato",  color: "#64748b", pct: 1.00 },
  { label: "Contato feito",    color: "#3b82f6", pct: 0.82 },
  { label: "Follow-up 1",      color: "#f59e0b", pct: 0.58 },
  { label: "Follow-up 2",      color: "#f97316", pct: 0.42 },
  { label: "Interessado",      color: "#8b5cf6", pct: 0.28 },
  { label: "Negociando",       color: "#0ea5e9", pct: 0.18 },
  { label: "Venda Realizada",  color: "#10b981", pct: 0.12 },
  { label: "Perdido",          color: "#ef4444", pct: 0.08 },
]

// ─── Lead intent classification ───────────────────────────────────────────────

const INTENCOES = [
  { label: "Produto específico",       pct: 0.31, color: "#3b82f6" },
  { label: "Projeto de iluminação",    pct: 0.24, color: "#8b5cf6" },
  { label: "Produto não especificado", pct: 0.19, color: "#f59e0b" },
  { label: "Falar com vendedor",       pct: 0.14, color: "#10b981" },
  { label: "Não especificado",         pct: 0.12, color: "#94a3b8" },
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
    const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    const dayLabel = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")
    return {
      data: label,
      t: dias <= 7 ? dayLabel : label,
      leads, novos, conversas, comIA, qualificados, handoffs, vendas, followups, recuperados,
      esperando: Math.round(conversas * 0.30),
    }
  })
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v)
const fmtPct = (v: number, t: number) => t > 0 ? `${((v / t) * 100).toFixed(0)}%` : "—"

// ─── Shared Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPI({
  label, value, sub, icon: Icon, accentCls, iconCls, trend,
}: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; accentCls: string; iconCls: string; trend?: number
}) {
  return (
    <Card className="relative overflow-hidden border-border bg-card">
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px]", accentCls)} />
      <CardContent className="p-3 pl-4">
        <div className="flex items-start justify-between mb-1.5">
          <p className="text-[10px] font-medium text-muted-foreground leading-none">{label}</p>
          <Icon className={cn("h-3.5 w-3.5 shrink-0", iconCls)} />
        </div>
        <p className="text-xl font-bold text-foreground leading-none">{value}</p>
        {(sub || trend !== undefined) && (
          <div className="flex items-center gap-2 mt-1.5">
            {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
            {trend !== undefined && (
              <span className={cn(
                "inline-flex items-center gap-0.5 text-[10px] font-semibold",
                trend > 0 ? "text-emerald-600" : trend < 0 ? "text-red-500" : "text-muted-foreground"
              )}>
                {trend > 0 ? <ArrowUpRight className="h-3 w-3" /> : trend < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                {trend > 0 ? "+" : ""}{trend}%
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Pipeline Funnel ──────────────────────────────────────────────────────────

function PipelineFunnel({ total }: { total: number }) {
  const stages = PIPELINE_STAGES.map(s => ({ ...s, value: Math.round(total * s.pct) }))
  return (
    <div className="space-y-2">
      {stages.map((s, i) => {
        const dropPct = i > 0 ? Math.round((1 - s.value / stages[i - 1].value) * 100) : 0
        return (
          <div key={s.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground">{s.label}</span>
              <div className="flex items-center gap-2">
                {i > 0 && dropPct > 0 && (
                  <span className="text-[9px] text-red-500 font-semibold">−{dropPct}%</span>
                )}
                <span className="text-[11px] font-semibold text-foreground">{s.value}</span>
              </div>
            </div>
            <div className="h-4 bg-muted rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm flex items-center px-2 transition-all duration-500"
                style={{ width: `${Math.max(s.pct * 100, 4)}%`, background: s.color }}
              >
                <span className="text-[9px] font-bold text-white leading-none">
                  {Math.round(s.pct * 100)}%
                </span>
              </div>
            </div>
          </div>
        )
      })}
      <div className="pt-2 border-t border-border grid grid-cols-3 text-center gap-1 mt-2">
        <div>
          <p className="text-base font-bold text-foreground">{fmtPct(stages[6].value, stages[0].value)}</p>
          <p className="text-[9px] text-muted-foreground">lead → venda</p>
        </div>
        <div className="border-l border-border">
          <p className="text-base font-bold text-foreground">{fmtPct(stages[4].value, stages[1].value)}</p>
          <p className="text-[9px] text-muted-foreground">contato → interessado</p>
        </div>
        <div className="border-l border-border">
          <p className="text-base font-bold text-foreground">{fmtPct(stages[6].value, stages[5].value)}</p>
          <p className="text-[9px] text-muted-foreground">negociando → venda</p>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AnaliseLeadsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("geral")
  const [selectedVendedor, setSelectedVendedor] = useState<string>("all")
  const [period, setPeriod] = useState<PeriodMode>("semana")
  const [periodOffset, setPeriodOffset] = useState(0)

  const [vendedores, setVendedores] = useState<Vendedor[]>([])

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
          .filter((u: { active?: boolean }) => u.active !== false)
          .map((u: { id: unknown; name?: string; nome?: string }) => ({ id: String(u.id), nome: u.name || u.nome || "Vendedor" }))
        setVendedores(list.length > 0 ? list : fallback)
      })
      .catch(() => setVendedores(fallback))
  }, [])

  const todos_metrics = useMemo(() => vendedores.map(gerarVendedorMetrics), [vendedores])

  const AGREGADO = useMemo(() => {
    if (todos_metrics.length === 0) return null
    const acc = todos_metrics.reduce((a, v) => ({
      id: "all", nome: "Todos",
      leads: a.leads + v.leads, novos: a.novos + v.novos,
      conversas: a.conversas + v.conversas, abertas: a.abertas + v.abertas,
      comIA: a.comIA + v.comIA, esperando: a.esperando + v.esperando,
      qualificados: a.qualificados + v.qualificados, handoffs: a.handoffs + v.handoffs,
      vendas: a.vendas + v.vendas, followups: a.followups + v.followups,
      recuperados: a.recuperados + v.recuperados, taxaConversao: "0", ticketMedio: 0,
    }), { id: "all", nome: "Todos", leads: 0, novos: 0, conversas: 0, abertas: 0, comIA: 0, esperando: 0, qualificados: 0, handoffs: 0, vendas: 0, followups: 0, recuperados: 0, taxaConversao: "0", ticketMedio: 0 })
    acc.taxaConversao = ((acc.vendas / acc.leads) * 100).toFixed(1)
    acc.ticketMedio = Math.round(todos_metrics.reduce((s, v) => s + v.ticketMedio, 0) / todos_metrics.length)
    return acc
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
      abertas: base.abertas,
      comIA: base.comIA,
      esperando: base.esperando,
    }
  }, [selectedVendedor, dias, todos_metrics, AGREGADO])

  if (!metricas || !AGREGADO) return (
    <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground text-sm">Carregando...</div>
  )

  const taxaRecuperacao = metricas.followups > 0 ? `${((metricas.recuperados / metricas.followups) * 100).toFixed(0)}%` : "—"
  const taxaConversao   = metricas.leads > 0 ? `${((metricas.vendas / metricas.leads) * 100).toFixed(1)}%` : "—"
  const taxaQualif      = metricas.conversas > 0 ? `${((metricas.qualificados / metricas.conversas) * 100).toFixed(0)}%` : "—"
  const pctComIA        = metricas.abertas > 0 ? `${((metricas.comIA / metricas.abertas) * 100).toFixed(0)}%` : "—"
  const pctNovos        = metricas.leads > 0 ? `${((metricas.novos / metricas.leads) * 100).toFixed(0)}%` : "—"

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 max-w-[1400px] mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Análise de Leads &amp; I.A.</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Funil, conversão e performance de automação</p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <Select value={selectedVendedor} onValueChange={setSelectedVendedor}>
            <SelectTrigger className="h-8 text-xs w-[160px] bg-background border-border">
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os vendedores</SelectItem>
              {vendedores.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border">
            {(["dia", "semana", "mes"] as PeriodMode[]).map(p => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setPeriodOffset(0) }}
                className={cn(
                  "h-6 px-2.5 text-[10px] font-medium rounded-md transition-all",
                  period === p
                    ? "bg-card border border-border shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p === "dia" ? "Hoje" : p === "semana" ? "Semana" : "Mês"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPeriodOffset(o => o - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[11px] text-muted-foreground min-w-[120px] text-center font-medium">{periodLabel}</span>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPeriodOffset(o => Math.min(0, o + 1))} disabled={periodOffset >= 0}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs value={viewMode} onValueChange={v => setViewMode(v as ViewMode)}>
        <TabsList className="h-8 bg-muted/40 border border-border">
          <TabsTrigger value="geral"    className="text-[11px] gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground">
            <Activity className="h-3.5 w-3.5" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="vendedor" className="text-[11px] gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground">
            <Users className="h-3.5 w-3.5" /> Por Vendedor
          </TabsTrigger>
          <TabsTrigger value="ia"       className="text-[11px] gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground">
            <Bot className="h-3.5 w-3.5" /> Performance I.A.
          </TabsTrigger>
        </TabsList>

        {/* ═══ VISÃO GERAL ═════════════════════════════════════════════════════ */}
        <TabsContent value="geral" className="space-y-4 mt-4">

          {/* KPI Strip */}
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
            <KPI icon={Users}         label="Leads recebidos"   value={metricas.leads}        sub={`${pctNovos} são novos`}                               accentCls="bg-blue-500"    iconCls="text-blue-500" />
            <KPI icon={Sparkles}      label="Novos leads"       value={metricas.novos}        sub="1ª vez no sistema"                                     accentCls="bg-sky-500"     iconCls="text-sky-500" />
            <KPI icon={MessageSquare} label="Conv. abertas"     value={metricas.abertas}      sub="ativas agora"                                          accentCls="bg-slate-500"   iconCls="text-slate-500" />
            <KPI icon={Bot}           label="Com I.A. ativa"    value={metricas.comIA}        sub={`${pctComIA} das abertas`}                             accentCls="bg-violet-500"  iconCls="text-violet-500" />
            <KPI icon={Clock}         label="Esperando vendedor" value={metricas.esperando}  sub={fmtPct(metricas.esperando, metricas.abertas) + " ab."} accentCls="bg-amber-500"   iconCls="text-amber-500" />
            <KPI icon={UserCheck}     label="Qualificados"      value={metricas.qualificados} sub={taxaQualif + " qualificação"}                          accentCls="bg-indigo-500"  iconCls="text-indigo-500" />
            <KPI icon={ShoppingCart}  label="Vendas fechadas"   value={metricas.vendas}       sub={`Taxa ${taxaConversao}`}                               accentCls="bg-emerald-500" iconCls="text-emerald-500" />
            <KPI icon={RefreshCw}     label="Recuperados FUP"   value={metricas.recuperados}  sub={`Taxa ${taxaRecuperacao}`}                             accentCls="bg-teal-500"    iconCls="text-teal-500" />
          </div>

          {/* Main row: chart + funnel */}
          <div className="grid grid-cols-12 gap-4">

            {/* Leads trend chart */}
            <Card className="col-span-8 border-border bg-card">
              <CardHeader className="px-5 pt-4 pb-0 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-foreground">Evolução de Leads</CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {period === "dia" ? "Fluxo de hoje" : period === "semana" ? "Últimos 7 dias" : "Últimos 30 dias"}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-[3px] rounded-full bg-blue-500 inline-block" />Total</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-[3px] rounded-full bg-sky-400 inline-block" />Novos</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-[3px] rounded-full bg-emerald-500 inline-block" />Vendas</span>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-4 pt-3">
                {period === "dia" ? (
                  <div className="grid grid-cols-3 gap-4 py-6">
                    {[
                      { label: "Leads hoje",    value: metricas.leads,    cls: "text-blue-600" },
                      { label: "Novos clientes",value: metricas.novos,    cls: "text-sky-500"  },
                      { label: "Vendas hoje",   value: metricas.vendas,   cls: "text-emerald-600" },
                    ].map(x => (
                      <div key={x.label} className="text-center">
                        <p className={cn("text-3xl font-bold leading-none", x.cls)}>{x.value}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{x.label}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={dadosDiarios} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gLeads"  x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gNovos"  x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gVendas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="t" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="leads"  name="Total"  stroke="#3b82f6" strokeWidth={2} fill="url(#gLeads)"  dot={false} />
                      <Area type="monotone" dataKey="novos"  name="Novos"  stroke="#38bdf8" strokeWidth={2} fill="url(#gNovos)"  dot={false} />
                      <Area type="monotone" dataKey="vendas" name="Vendas" stroke="#10b981" strokeWidth={2} fill="url(#gVendas)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Pipeline Funnel */}
            <Card className="col-span-4 border-border bg-card">
              <CardHeader className="px-5 pt-4 pb-2">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-violet-500" />
                  Funil de Conversão
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">Estágios do pipeline</p>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <PipelineFunnel total={metricas.leads} />
              </CardContent>
            </Card>
          </div>

          {/* Bottom row: status + intent + followups */}
          <div className="grid grid-cols-3 gap-4">

            {/* Conversations now */}
            <Card className="border-border bg-card">
              <CardHeader className="px-5 pt-4 pb-2">
                <CardTitle className="text-sm font-semibold text-foreground">Status das Conversas</CardTitle>
                <p className="text-[11px] text-muted-foreground">Situação em tempo real</p>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-2">
                {[
                  { label: "Com I.A. respondendo",  val: metricas.comIA,     color: "#8b5cf6" },
                  { label: "Esperando vendedor",     val: metricas.esperando, color: "#f59e0b" },
                  { label: "Sem atividade +24h",     val: Math.round(metricas.abertas * 0.15), color: "#ef4444" },
                  { label: "Aguardando OK cliente",  val: Math.round(metricas.abertas * 0.11), color: "#6366f1" },
                  { label: "Total abertas",          val: metricas.abertas,   color: "#3b82f6" },
                ].map(item => {
                  const pct = metricas.abertas > 0 ? (item.val / metricas.abertas) * 100 : 0
                  return (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: item.color }} />
                      <span className="text-[11px] text-muted-foreground flex-1">{item.label}</span>
                      <div className="w-14 h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: item.color }} />
                      </div>
                      <span className="text-[11px] font-bold text-foreground w-5 text-right shrink-0">{item.val}</span>
                    </div>
                  )
                })}
                <div className="pt-2 border-t border-border flex justify-between text-[10px]">
                  <span className="text-muted-foreground">{pctComIA} com I.A.</span>
                  <span className="text-amber-600 font-semibold">{fmtPct(metricas.esperando, metricas.abertas)} esperando</span>
                </div>
              </CardContent>
            </Card>

            {/* Lead intent */}
            <Card className="border-border bg-card">
              <CardHeader className="px-5 pt-4 pb-2">
                <CardTitle className="text-sm font-semibold text-foreground">Intenção dos Leads</CardTitle>
                <p className="text-[11px] text-muted-foreground">Classificação pela 1ª mensagem</p>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-2">
                {INTENCOES.map(item => {
                  const val = Math.round(metricas.leads * item.pct)
                  return (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: item.color }} />
                      <span className="text-[11px] text-muted-foreground flex-1 truncate">{item.label}</span>
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${item.pct * 100}%`, background: item.color }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-6 text-right">{(item.pct * 100).toFixed(0)}%</span>
                      <span className="text-[11px] font-semibold text-foreground w-6 text-right">{val}</span>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Follow-ups */}
            <Card className="border-border bg-card">
              <CardHeader className="px-5 pt-4 pb-2">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5 text-emerald-500" />
                  Follow-ups &amp; Recuperação
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">Reengajamento automático</p>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                {period !== "dia" ? (
                  <ResponsiveContainer width="100%" height={110}>
                    <ReBarChart data={dadosDiarios} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="t" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="followups"   name="FUPs"        fill="#10b981" radius={[2,2,0,0]} />
                      <Bar dataKey="recuperados" name="Recuperados" fill="#0ea5e9" radius={[2,2,0,0]} />
                    </ReBarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="space-y-3 py-3">
                    {[
                      { l: "Follow-ups hoje",  v: metricas.followups,   cls: "text-emerald-600" },
                      { l: "Recuperados hoje", v: metricas.recuperados, cls: "text-sky-600" },
                    ].map(x => (
                      <div key={x.l} className="flex justify-between items-center border-b border-border pb-2">
                        <span className="text-[11px] text-muted-foreground">{x.l}</span>
                        <span className={cn("text-xl font-bold", x.cls)}>{x.v}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 pt-2 border-t border-border grid grid-cols-3 text-center gap-1">
                  {[
                    ["FUPs", metricas.followups, "text-foreground"],
                    ["Recup.", metricas.recuperados, "text-emerald-600"],
                    ["Taxa", taxaRecuperacao, "text-foreground"],
                  ].map(([l, v, c]) => (
                    <div key={String(l)} className="border-l first:border-0 border-border">
                      <p className={cn("text-base font-bold", String(c))}>{v}</p>
                      <p className="text-[9px] text-muted-foreground">{l}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ POR VENDEDOR ════════════════════════════════════════════════════ */}
        <TabsContent value="vendedor" className="space-y-4 mt-4">
          <Card className="border-border bg-card">
            <CardHeader className="px-5 pt-4 pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">Comparativo por Vendedor</CardTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">{periodLabel}</p>
              </div>
              <Badge variant="outline" className="text-[9px] border-border text-muted-foreground">{vendedores.length} vendedores</Badge>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[780px]">
                  <thead>
                    <tr className="border-b border-border">
                      {["Vendedor","Leads","Novos","Ab. agora","Com I.A.","Esperando","Qualif.","Vendas","Conversão","Ticket Médio"].map(h => (
                        <th key={h} className={cn("py-2 px-3 text-[10px] font-semibold text-muted-foreground", h === "Vendedor" ? "text-left" : "text-center")}>{h}</th>
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
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                {v.nome.charAt(0)}
                              </div>
                              <span className={cn("text-[11px] font-medium", isSelected ? "text-primary" : "text-foreground")}>{v.nome}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center text-[11px] font-bold text-foreground">{v.leads}</td>
                          <td className="py-2 px-3 text-center text-[11px] text-sky-600 font-medium">{v.novos}</td>
                          <td className="py-2 px-3 text-center"><Badge variant="outline" className="text-[9px] border-blue-200 text-blue-600 bg-blue-50">{v.abertas}</Badge></td>
                          <td className="py-2 px-3 text-center"><Badge variant="outline" className="text-[9px] border-violet-200 text-violet-600 bg-violet-50">{v.comIA}</Badge></td>
                          <td className="py-2 px-3 text-center"><Badge variant="outline" className="text-[9px] border-amber-200 text-amber-600 bg-amber-50">{v.esperando}</Badge></td>
                          <td className="py-2 px-3 text-center text-[11px] text-indigo-600 font-medium">{v.qualificados}</td>
                          <td className="py-2 px-3 text-center text-[11px] text-emerald-600 font-bold">{v.vendas}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", tx >= 12 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                              {tx}%
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-[11px] text-foreground font-medium">{fmtCurrency(v.ticketMedio)}</td>
                        </tr>
                      )
                    })}
                    <tr className="bg-muted/30 border-t border-border">
                      <td className="py-2 px-3 text-[10px] font-semibold text-muted-foreground">TOTAL</td>
                      <td className="py-2 px-3 text-center text-[11px] font-bold text-foreground">{AGREGADO.leads}</td>
                      <td className="py-2 px-3 text-center text-[11px] text-sky-600 font-bold">{AGREGADO.novos}</td>
                      <td className="py-2 px-3 text-center text-[11px] text-foreground">{AGREGADO.abertas}</td>
                      <td className="py-2 px-3 text-center text-[11px] text-violet-600 font-bold">{AGREGADO.comIA}</td>
                      <td className="py-2 px-3 text-center text-[11px] text-amber-600">{AGREGADO.esperando}</td>
                      <td className="py-2 px-3 text-center text-[11px] text-indigo-600">{AGREGADO.qualificados}</td>
                      <td className="py-2 px-3 text-center text-[11px] text-emerald-600 font-bold">{AGREGADO.vendas}</td>
                      <td className="py-2 px-3 text-center text-[11px] font-bold text-foreground">{AGREGADO.taxaConversao}%</td>
                      <td className="py-2 px-3 text-right text-[11px] text-foreground">{fmtCurrency(AGREGADO.ticketMedio)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Comparative bar charts */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { title: "Conversas abertas agora",  dataKey: "abertas",       color: "#3b82f6", label: "ab." },
              { title: "Taxa de conversão",         dataKey: "taxaConversao", color: "#10b981", label: "%" },
              { title: "I.A. ativa (conv. abertas)",dataKey: "comIA",         color: "#8b5cf6", label: "IA" },
            ].map(cfg => {
              const sorted = [...todos_metrics].sort((a, b) => Number(b[cfg.dataKey as keyof typeof b]) - Number(a[cfg.dataKey as keyof typeof a]))
              const maxVal = Number(sorted[0]?.[cfg.dataKey as keyof typeof sorted[0]]) || 1
              return (
                <Card key={cfg.title} className="border-border bg-card">
                  <CardHeader className="px-5 pt-4 pb-2">
                    <CardTitle className="text-[11px] font-semibold text-foreground">{cfg.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-4 space-y-2">
                    {sorted.map(v => {
                      const val = Number(v[cfg.dataKey as keyof typeof v])
                      const pct = (val / maxVal) * 100
                      return (
                        <div key={v.id} className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-16 truncate shrink-0">{v.nome.split(" ")[0]}</span>
                          <div className="flex-1 h-5 bg-muted rounded-sm overflow-hidden">
                            <div className="h-full rounded-sm flex items-center px-1.5 transition-all" style={{ width: `${pct}%`, background: cfg.color }}>
                              <span className="text-[9px] text-white font-bold">{cfg.dataKey === "taxaConversao" ? `${val}%` : val}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* ═══ PERFORMANCE I.A. ════════════════════════════════════════════════ */}
        <TabsContent value="ia" className="space-y-4 mt-4">

          {/* IA KPIs */}
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            <KPI icon={Bot}          label="Com I.A. ativa"   value={metricas.comIA}        sub={pctComIA + " das abertas"}          accentCls="bg-violet-500"  iconCls="text-violet-500" />
            <KPI icon={UserCheck}    label="Qualificados I.A."value={metricas.qualificados} sub={taxaQualif + " qualificação"}       accentCls="bg-indigo-500"  iconCls="text-indigo-500" />
            <KPI icon={Zap}          label="Handoffs gerados"  value={metricas.handoffs}    sub={fmtPct(metricas.handoffs, metricas.conversas) + " das conv."} accentCls="bg-amber-500" iconCls="text-amber-500" />
            <KPI icon={RefreshCw}    label="FUPs disparados"   value={metricas.followups}   sub="automáticos"                       accentCls="bg-blue-500"    iconCls="text-blue-500" />
            <KPI icon={Star}         label="Recuperados FUP"   value={metricas.recuperados} sub={"Taxa " + taxaRecuperacao}         accentCls="bg-emerald-500" iconCls="text-emerald-500" />
            <KPI icon={ShoppingCart} label="Vendas via I.A."   value={Math.round(metricas.vendas * 0.62)} sub="originadas por I.A." accentCls="bg-teal-500"    iconCls="text-teal-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">

            {/* FUP chart */}
            <Card className="border-border bg-card">
              <CardHeader className="px-5 pt-4 pb-2">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5 text-emerald-500" />
                  Follow-ups &amp; Recuperação
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">Volume automático no período</p>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                {period !== "dia" ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <ReBarChart data={dadosDiarios} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="t" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="followups"   name="FUPs"        fill="#10b981" radius={[2,2,0,0]} />
                      <Bar dataKey="recuperados" name="Recuperados" fill="#0ea5e9" radius={[2,2,0,0]} />
                    </ReBarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="grid grid-cols-2 gap-4 py-8 text-center">
                    <div>
                      <p className="text-3xl font-bold text-emerald-600">{metricas.followups}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">follow-ups hoje</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-sky-600">{metricas.recuperados}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">recuperados hoje</p>
                    </div>
                  </div>
                )}
                <div className="mt-3 pt-2 border-t border-border grid grid-cols-3 text-center">
                  {[["FUPs", metricas.followups, "text-foreground"], ["Recup.", metricas.recuperados, "text-emerald-600"], ["Taxa", taxaRecuperacao, "text-foreground"]].map(([l, v, c]) => (
                    <div key={String(l)} className="border-l first:border-0 border-border">
                      <p className={cn("text-base font-bold", String(c))}>{v}</p>
                      <p className="text-[9px] text-muted-foreground">{l}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Handoff breakdown */}
            <Card className="border-border bg-card">
              <CardHeader className="px-5 pt-4 pb-2">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  Qualificação &amp; Handoffs
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">IA → Vendedor</p>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-2.5">
                {[
                  { label: "Qualificados (interessados)",   val: metricas.qualificados, pct: fmtPct(metricas.qualificados, metricas.conversas), color: "#8b5cf6" },
                  { label: "Handoffs p/ vendedor",          val: metricas.handoffs,     pct: fmtPct(metricas.handoffs, metricas.conversas),     color: "#f59e0b" },
                  { label: "Não qualificados",              val: metricas.conversas - metricas.qualificados, pct: fmtPct(metricas.conversas - metricas.qualificados, metricas.conversas), color: "#94a3b8" },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: item.color }} />
                    <span className="text-[11px] text-muted-foreground flex-1">{item.label}</span>
                    <span className="text-[11px] font-bold text-foreground">{item.val}</span>
                    <span className="text-[10px] text-muted-foreground w-8 text-right">{item.pct}</span>
                  </div>
                ))}

                <div className="pt-3 mt-1 border-t border-border">
                  <p className="text-[10px] font-semibold text-muted-foreground mb-2">Handoffs por vendedor</p>
                  {[...todos_metrics].sort((a, b) => b.handoffs - a.handoffs).slice(0, 5).map(v => {
                    const maxH = todos_metrics.reduce((m, x) => Math.max(m, x.handoffs), 1)
                    return (
                      <div key={v.id} className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] text-muted-foreground w-16 truncate shrink-0">{v.nome.split(" ")[0]}</span>
                        <div className="flex-1 h-3 bg-muted rounded-sm overflow-hidden">
                          <div className="h-full rounded-sm" style={{ width: `${(v.handoffs / maxH) * 100}%`, background: "#f59e0b" }} />
                        </div>
                        <span className="text-[10px] font-bold text-amber-600 w-5 text-right">{v.handoffs}</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* IA detail table */}
          <Card className="border-border bg-card">
            <CardHeader className="px-5 pt-4 pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5 text-violet-500" />
                I.A. por Vendedor
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">Detalhe de automação individual</p>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-border">
                      {["Vendedor","Conv. c/ IA","Com IA agora","Qualif.","Handoffs","FUPs","Recuperados","Taxa Recup.","Vendas IA"].map(h => (
                        <th key={h} className={cn("py-2 px-3 text-[10px] font-semibold text-muted-foreground", h === "Vendedor" ? "text-left" : "text-center")}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {todos_metrics.map(v => {
                      const txR = v.followups > 0 ? `${((v.recuperados / v.followups) * 100).toFixed(0)}%` : "—"
                      return (
                        <tr key={v.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-2 px-3 text-[11px] font-medium text-foreground">{v.nome}</td>
                          <td className="py-2 px-3 text-center text-[11px] text-foreground">{v.conversas}</td>
                          <td className="py-2 px-3 text-center"><Badge variant="outline" className="text-[9px] border-violet-200 text-violet-600 bg-violet-50">{v.comIA}</Badge></td>
                          <td className="py-2 px-3 text-center text-[11px] text-indigo-600 font-medium">{v.qualificados}</td>
                          <td className="py-2 px-3 text-center text-[11px] text-amber-600 font-medium">{v.handoffs}</td>
                          <td className="py-2 px-3 text-center text-[11px] text-blue-600">{v.followups}</td>
                          <td className="py-2 px-3 text-center text-[11px] text-emerald-600 font-bold">{v.recuperados}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", Number(txR) >= 25 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{txR}</span>
                          </td>
                          <td className="py-2 px-3 text-center text-[11px] font-bold text-emerald-600">{Math.round(v.vendas * 0.62)}</td>
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
