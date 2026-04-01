"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  TrendingUp,
  Users,
  DollarSign,
  Clock,
  MessageSquare,
  Bot,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ──────────────────────────────────────────────────────────────────

type UnitId = "global" | "u1" | "u2" | "u3"
type Period = "Hoje" | "Semana" | "Mês"

const UNITS: { id: UnitId; label: string; city: string }[] = [
  { id: "global", label: "Global",  city: "Todas"   },
  { id: "u1",     label: "Benfica", city: "RJ"      },
  { id: "u2",     label: "Recreio", city: "RJ"      },
  { id: "u3",     label: "Barra",   city: "RJ"      },
]

// Revenue-based lead multipliers (proportional to faturamento)
const LEAD_M: Record<UnitId, number> = { global: 1.0, u1: 0.71, u2: 0.18, u3: 0.12 }

const UNIT_REVENUE: Record<UnitId, { fat: number; fatMeta: number; fatAnt: number }> = {
  global: { fat: 1_700_000, fatMeta: 1_850_000, fatAnt: 1_580_000 },
  u1:     { fat: 1_200_000, fatMeta: 1_300_000, fatAnt: 1_120_000 },
  u2:     { fat:   300_000, fatMeta:   340_000, fatAnt:   275_000 },
  u3:     { fat:   200_000, fatMeta:   220_000, fatAnt:   185_000 },
}

const rl = (v: number, unit: UnitId) => Math.round(v * LEAD_M[unit])
const rp = (v: number) => Math.round(v * 10) / 10

// ─── Mock Data ───────────────────────────────────────────────────────────────

function getKPIs(unit: UnitId) {
  const rev = UNIT_REVENUE[unit]
  return {
    faturamento: rev.fat,
    faturamentoMeta: rev.fatMeta,
    faturamentoAnterior: rev.fatAnt,
    leadsHoje: rl(38, unit),
    leadsOntem: rl(31, unit),
    leadsSemana: rl(214, unit),
    leadsMes: rl(1840, unit),
    leadsAnterior: rl(1620, unit),
    conversao: unit === "global" ? 12.4 : unit === "u1" ? 13.8 : unit === "u2" ? 11.2 : 10.5,
    conversaoAnterior: unit === "global" ? 11.1 : unit === "u1" ? 12.0 : unit === "u2" ? 10.8 : 9.9,
    tempoResp: unit === "global" ? "4m 32s" : unit === "u1" ? "3m 58s" : unit === "u2" ? "5m 12s" : "6m 04s",
    conversasAbertas: rl(47, unit),
    followupsIA: rl(384, unit),
    followupAnterior: rl(320, unit),
    iaCobertura: unit === "global" ? 78 : unit === "u1" ? 82 : unit === "u2" ? 74 : 71,
    recuperacaoFup: unit === "global" ? 22.4 : unit === "u1" ? 24.1 : unit === "u2" ? 21.0 : 19.8,
    melhorVendedor: unit === "u3" ? "Carlos M." : unit === "u2" ? "Beatriz F." : "Rafael S.",
    melhorVendedorLeads: rl(142, unit),
  }
}

function getChartData(period: Period, unit: UnitId) {
  if (period === "Hoje") {
    return [
      { t: "08h", leads: rl(4, unit),  conv: rl(1, unit) },
      { t: "09h", leads: rl(8, unit),  conv: rl(1, unit) },
      { t: "10h", leads: rl(14, unit), conv: rl(2, unit) },
      { t: "11h", leads: rl(11, unit), conv: rl(2, unit) },
      { t: "12h", leads: rl(7, unit),  conv: rl(1, unit) },
      { t: "13h", leads: rl(5, unit),  conv: rl(0, unit) },
      { t: "14h", leads: rl(12, unit), conv: rl(1, unit) },
      { t: "15h", leads: rl(16, unit), conv: rl(2, unit) },
      { t: "16h", leads: rl(9, unit),  conv: rl(1, unit) },
      { t: "17h", leads: rl(6, unit),  conv: rl(1, unit) },
    ]
  }
  if (period === "Semana") {
    return [
      { t: "Seg", leads: rl(42, unit), conv: rl(5, unit) },
      { t: "Ter", leads: rl(38, unit), conv: rl(4, unit) },
      { t: "Qua", leads: rl(51, unit), conv: rl(7, unit) },
      { t: "Qui", leads: rl(44, unit), conv: rl(6, unit) },
      { t: "Sex", leads: rl(60, unit), conv: rl(9, unit) },
      { t: "Sáb", leads: rl(28, unit), conv: rl(3, unit) },
      { t: "Dom", leads: rl(19, unit), conv: rl(2, unit) },
    ]
  }
  const base = [42,38,51,44,60,28,19,55,48,63,41,58,36,47,52,40,66,44,58,35,49,61,38,55,48,42,67,53,46,38]
  return base.map((v, i) => ({
    t: `${i + 1}`,
    leads: rl(v, unit),
    conv: rl(Math.round(v * 0.12), unit),
  }))
}

function getPipeline(unit: UnitId) {
  return [
    { name: "A fazer contato", count: rl(420, unit), color: "bg-slate-400",    textColor: "text-slate-600" },
    { name: "Contato feito",   count: rl(284, unit), color: "bg-blue-500",     textColor: "text-blue-700" },
    { name: "Follow-up 1",     count: rl(198, unit), color: "bg-amber-500",    textColor: "text-amber-700" },
    { name: "Follow-up 2",     count: rl(124, unit), color: "bg-orange-500",   textColor: "text-orange-700" },
    { name: "Interessado",     count: rl(88,  unit), color: "bg-violet-500",   textColor: "text-violet-700" },
    { name: "Negociando",      count: rl(62,  unit), color: "bg-sky-500",      textColor: "text-sky-700" },
    { name: "Venda Realizada", count: rl(47,  unit), color: "bg-emerald-500",  textColor: "text-emerald-700" },
    { name: "Perdido",         count: rl(110, unit), color: "bg-red-400",      textColor: "text-red-600" },
  ]
}

function getVendors(unit: UnitId) {
  const r = UNIT_REVENUE[unit]
  const totalFat = r.fat
  const shares = [0.195, 0.170, 0.155, 0.130, 0.115, 0.100, 0.095]
  const names = [
    { name: "Rafael S.",   initials: "RS" },
    { name: "Beatriz F.",  initials: "BF" },
    { name: "Carlos M.",   initials: "CM" },
    { name: "Daniela P.",  initials: "DP" },
    { name: "Eduardo L.",  initials: "EL" },
    { name: "Fernanda K.", initials: "FK" },
    { name: "Gabriel T.",  initials: "GT" },
  ]
  return names.map((n, i) => ({
    ...n,
    leads:       rl(Math.round(142 * (1 - i * 0.1)), unit),
    vendas:      rl(Math.round(18  * (1 - i * 0.1)), unit),
    faturamento: Math.round(totalFat * shares[i]),
  }))
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatCurrency = (v: number) =>
  v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toFixed(1)}M`
    : `R$ ${(v / 1000).toFixed(0)}k`

function Trend({ value, suffix = "%" }: { value: number; suffix?: string }) {
  if (value > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600">
        <ArrowUpRight className="h-3 w-3" />+{value}{suffix}
      </span>
    )
  if (value < 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-500">
        <ArrowDownRight className="h-3 w-3" />{value}{suffix}
      </span>
    )
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground">
      <Minus className="h-3 w-3" />0{suffix}
    </span>
  )
}

function KPICard({
  label,
  value,
  sub,
  icon: Icon,
  accentCls,
  iconCls,
  trend,
  trendSuffix,
  trendLabel,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  accentCls: string
  iconCls: string
  trend?: number
  trendSuffix?: string
  trendLabel?: string
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
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
            {trend !== undefined && <Trend value={trend} suffix={trendSuffix} />}
            {trendLabel && <span className="text-[10px] text-muted-foreground">{trendLabel}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ dataKey: string; name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DashboardMaster() {
  const router = useRouter()
  const [unit, setUnit] = useState<UnitId>("global")
  const [period, setPeriod] = useState<Period>("Mês")

  const kpis    = useMemo(() => getKPIs(unit),              [unit])
  const chartData = useMemo(() => getChartData(period, unit), [period, unit])
  const pipeline  = useMemo(() => getPipeline(unit),          [unit])
  const vendors   = useMemo(() => getVendors(unit),           [unit])

  const pipelineMax = pipeline[0].count
  const leadsTrend  = Math.round(((kpis.leadsMes - kpis.leadsAnterior) / kpis.leadsAnterior) * 100)
  const fupTrend    = Math.round(((kpis.followupsIA - kpis.followupAnterior) / kpis.followupAnterior) * 100)
  const fatTrend    = Math.round(((kpis.faturamento - kpis.faturamentoAnterior) / kpis.faturamentoAnterior) * 100)
  const convTrend   = rp(kpis.conversao - kpis.conversaoAnterior)

  return (
    <DashboardLayout>
      <div className="space-y-4">

        {/* ── Header + Unit Filter ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Dashboard</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Visão estratégica · Casarão Lustres</p>
          </div>
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border">
            {UNITS.map((u) => (
              <button
                key={u.id}
                onClick={() => setUnit(u.id)}
                className={cn(
                  "h-7 px-3 text-xs font-medium rounded-lg transition-all flex items-center gap-1",
                  unit === u.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                )}
              >
                {u.label}
                {u.city !== "Todas" && (
                  <span className={cn("text-[9px]", unit === u.id ? "opacity-70" : "opacity-50")}>
                    {u.city}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── 6 KPI Cards ── */}
        <div className="grid grid-cols-6 gap-3">
          <KPICard
            label="Faturamento do Mês"
            value={formatCurrency(kpis.faturamento)}
            sub={`Meta: ${formatCurrency(kpis.faturamentoMeta)}`}
            icon={DollarSign}
            accentCls="bg-emerald-500"
            iconCls="text-emerald-500"
            trend={fatTrend}
            trendLabel="vs mês ant."
          />
          <KPICard
            label="Leads este Mês"
            value={kpis.leadsMes.toLocaleString("pt-BR")}
            sub={`Hoje: ${kpis.leadsHoje} leads · Ontem: ${kpis.leadsOntem}`}
            icon={Users}
            accentCls="bg-primary"
            iconCls="text-primary"
            trend={leadsTrend}
            trendLabel="vs mês ant."
          />
          <KPICard
            label="Taxa de Conversão"
            value={`${kpis.conversao}%`}
            sub={`Anterior: ${kpis.conversaoAnterior}%`}
            icon={TrendingUp}
            accentCls="bg-sky-500"
            iconCls="text-sky-500"
            trend={convTrend}
            trendSuffix=" pp"
          />
          <KPICard
            label="Tempo Médio Resposta"
            value={kpis.tempoResp}
            sub="Meta: < 5 min"
            icon={Clock}
            accentCls="bg-amber-500"
            iconCls="text-amber-500"
          />
          <KPICard
            label="Conversas Abertas"
            value={kpis.conversasAbertas.toString()}
            sub="em atendimento agora"
            icon={MessageSquare}
            accentCls="bg-violet-500"
            iconCls="text-violet-500"
          />
          <KPICard
            label="Follow-ups I.A."
            value={kpis.followupsIA.toLocaleString("pt-BR")}
            sub={`Recuperação: ${kpis.recuperacaoFup}%`}
            icon={Bot}
            accentCls="bg-orange-500"
            iconCls="text-orange-500"
            trend={fupTrend}
            trendLabel="vs mês ant."
          />
        </div>

        {/* ── Leads Period Breakdown ── */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Leads hoje",         unit: "novos leads",  value: kpis.leadsHoje,   compare: kpis.leadsOntem,                     compareLabel: "ontem" },
            { label: "Leads ontem",        unit: "leads",        value: kpis.leadsOntem,  compare: Math.round(kpis.leadsOntem * 1.06),  compareLabel: "anteontem" },
            { label: "Esta semana",        unit: "leads",        value: kpis.leadsSemana, compare: Math.round(kpis.leadsSemana * 0.92), compareLabel: "sem. ant." },
            { label: "Este mês",           unit: "leads",        value: kpis.leadsMes,    compare: kpis.leadsAnterior,                  compareLabel: "mês ant." },
          ].map((item) => {
            const diff = item.value - item.compare
            const pct = Math.round((diff / item.compare) * 100)
            return (
              <div key={item.label} className="bg-muted/30 border border-border rounded-xl px-4 py-3">
                <p className="text-[10px] text-muted-foreground font-medium mb-1.5">{item.label}</p>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold text-foreground leading-none">
                    {item.value.toLocaleString("pt-BR")}
                  </span>
                  <span className="text-[10px] text-muted-foreground mb-0.5">{item.unit}</span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className={cn(
                    "text-[10px] font-semibold inline-flex items-center gap-0.5",
                    pct > 0 ? "text-emerald-600" : pct < 0 ? "text-red-500" : "text-muted-foreground"
                  )}>
                    {pct > 0 ? <ArrowUpRight className="h-3 w-3" /> : pct < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    {Math.abs(pct)}%
                  </span>
                  <span className="text-[9px] text-muted-foreground">vs {item.compareLabel}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Chart + Pipeline ── */}
        <div className="grid grid-cols-12 gap-4">

          {/* Area Chart */}
          <Card className="col-span-7 border-border bg-card">
            <CardHeader className="px-5 pt-4 pb-0 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">Leads &amp; Conversões</CardTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">Volume de oportunidades no período</p>
              </div>
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border">
                {(["Hoje", "Semana", "Mês"] as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={cn(
                      "h-6 px-2.5 text-[10px] font-medium rounded-md transition-all",
                      period === p
                        ? "bg-card border border-border shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4 pt-3">
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-[3px] rounded-full bg-primary" />
                  <span className="text-[10px] text-muted-foreground">Leads</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-[3px] rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-muted-foreground">Conversões</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gConv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="t"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="leads" name="Leads"      stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gLeads)" dot={false} />
                  <Area type="monotone" dataKey="conv"  name="Conversões" stroke="#10b981"             strokeWidth={2} fill="url(#gConv)"  dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Pipeline */}
          <Card className="col-span-5 border-border bg-card">
            <CardHeader className="px-5 pt-4 pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">Pipeline de Leads</CardTitle>
              <p className="text-[11px] text-muted-foreground">Distribuição por estágio</p>
            </CardHeader>
            <CardContent className="px-5 pb-4 space-y-2.5">
              {pipeline.map((stage) => {
                const pct = Math.round((stage.count / pipelineMax) * 100)
                return (
                  <div key={stage.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-muted-foreground">{stage.name}</span>
                      <span className={cn("text-[11px] font-semibold", stage.textColor)}>
                        {stage.count}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", stage.color)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>

        {/* ── Vendor Ranking + AI Activity ── */}
        <div className="grid grid-cols-12 gap-4">

          {/* Vendor Ranking — top 7 */}
          <Card
            className="col-span-8 border-border bg-card cursor-pointer hover:border-primary/30 transition-all group"
            onClick={() => router.push("/dashboard/analise-vendedores")}
          >
            <CardHeader className="px-5 pt-4 pb-0 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  Ranking de Vendedores
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                </CardTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">Top 7 · este mês</p>
              </div>
              <button
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                onClick={(e) => { e.stopPropagation(); router.push("/dashboard/analise-vendedores") }}
              >
                Ver análise completa
              </button>
            </CardHeader>
            <CardContent className="px-5 pb-4 pt-3">
              <div className="grid grid-cols-12 gap-2 px-2 py-1.5 text-[10px] font-medium text-muted-foreground border-b border-border mb-1">
                <div className="col-span-1">#</div>
                <div className="col-span-4">Vendedor</div>
                <div className="col-span-2 text-right">Leads</div>
                <div className="col-span-2 text-right">Vendas</div>
                <div className="col-span-3 text-right">Faturamento</div>
              </div>
              {vendors.map((v, i) => (
                <div
                  key={v.name}
                  className="grid grid-cols-12 gap-2 px-2 py-1.5 text-[11px] hover:bg-muted/40 rounded-lg transition-colors"
                >
                  <div className="col-span-1 flex items-center">
                    <span className={cn(
                      "w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold",
                      i === 0 ? "bg-amber-100 text-amber-700" :
                      i === 1 ? "bg-slate-100 text-slate-600" :
                      i === 2 ? "bg-orange-100 text-orange-700" :
                                "bg-muted text-muted-foreground"
                    )}>
                      {i + 1}
                    </span>
                  </div>
                  <div className="col-span-4 flex items-center gap-2">
                    <div className={cn(
                      "w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0",
                      i === 0 ? "bg-primary" : i === 1 ? "bg-sky-500" : i === 2 ? "bg-violet-500" : "bg-slate-400"
                    )}>
                      {v.initials}
                    </div>
                    <span className="font-medium text-foreground">{v.name}</span>
                  </div>
                  <div className="col-span-2 text-right text-muted-foreground font-medium">{v.leads}</div>
                  <div className="col-span-2 text-right text-emerald-700 font-semibold">{v.vendas}</div>
                  <div className="col-span-3 text-right font-bold text-foreground">{formatCurrency(v.faturamento)}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* AI Activity */}
          <Card className="col-span-4 border-border bg-card">
            <CardHeader className="px-5 pt-4 pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5 text-orange-500" />
                Atividade da I.A.
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">Automação e eficiência</p>
            </CardHeader>
            <CardContent className="px-5 pb-4 space-y-3">
              {[
                {
                  label: "Cobertura I.A.",
                  value: `${kpis.iaCobertura}%`,
                  sub: "dos leads atendidos",
                  valueCls: "text-orange-600",
                  barCls: "bg-orange-500",
                  pct: kpis.iaCobertura,
                },
                {
                  label: "Conversas ativas",
                  value: kpis.conversasAbertas.toString(),
                  sub: "em atendimento agora",
                  valueCls: "text-violet-600",
                  barCls: "bg-violet-500",
                  pct: Math.min(100, kpis.conversasAbertas * 2),
                },
                {
                  label: "Follow-ups enviados",
                  value: kpis.followupsIA.toLocaleString("pt-BR"),
                  sub: "este mês",
                  valueCls: "text-primary",
                  barCls: "bg-primary",
                  pct: Math.min(100, Math.round((kpis.followupsIA / rl(500, unit)) * 100)),
                },
                {
                  label: "Taxa de recuperação",
                  value: `${kpis.recuperacaoFup}%`,
                  sub: "leads reengajados",
                  valueCls: "text-emerald-600",
                  barCls: "bg-emerald-500",
                  pct: Math.min(100, kpis.recuperacaoFup * 3),
                },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground">{item.label}</span>
                    <span className={cn("text-[11px] font-bold", item.valueCls)}>{item.value}</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", item.barCls)}
                      style={{ width: `${Math.min(100, item.pct)}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{item.sub}</p>
                </div>
              ))}

              <div className="pt-1 border-t border-border">
                <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2.5">
                  <p className="text-[9px] text-orange-600 font-semibold uppercase tracking-wide mb-0.5">
                    Destaque do mês
                  </p>
                  <p className="text-sm font-bold text-orange-700">{kpis.melhorVendedor}</p>
                  <p className="text-[10px] text-orange-600">{kpis.melhorVendedorLeads} leads captados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
