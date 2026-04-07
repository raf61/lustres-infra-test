"use client"

import { useState, useMemo } from "react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  TrendingUp, Users, DollarSign, Clock, MessageSquare, Bot,
  ArrowUpRight, ArrowDownRight, Minus, AlertTriangle, ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "Hoje" | "Semana" | "Mês"

// ─── Mock Data ────────────────────────────────────────────────────────────────

const KPIs = {
  comissaoMes:       94_800,
  comissaoMeta:     110_000,
  comissaoAnterior:  81_200,
  leadsMes:            847,
  leadsAnterior:       741,
  leadsHoje:            38,
  leadsOntem:           31,
  leadsSemana:         214,
  taxaFechamento:     31.4,
  taxaFechamentoAnt:  25.2,
  renovacoes30d:       142,
  renovacoesCritical:   38,
  conversasIA:          47,
  followupsIA:       1_247,
  followupsAnt:        980,
  recuperacaoIA:      25.5,
  coberturaIA:          82,
}

function getChartData(period: Period) {
  if (period === "Hoje") {
    return [
      { t:"08h", leads:4,  cot:1  },
      { t:"09h", leads:8,  cot:2  },
      { t:"10h", leads:14, cot:4  },
      { t:"11h", leads:11, cot:3  },
      { t:"12h", leads:7,  cot:2  },
      { t:"13h", leads:5,  cot:1  },
      { t:"14h", leads:12, cot:4  },
      { t:"15h", leads:16, cot:5  },
      { t:"16h", leads:9,  cot:3  },
      { t:"17h", leads:6,  cot:2  },
    ]
  }
  if (period === "Semana") {
    return [
      { t:"Seg", leads:42, cot:13 },
      { t:"Ter", leads:38, cot:12 },
      { t:"Qua", leads:51, cot:17 },
      { t:"Qui", leads:44, cot:14 },
      { t:"Sex", leads:60, cot:20 },
      { t:"Sáb", leads:28, cot:8  },
      { t:"Dom", leads:19, cot:5  },
    ]
  }
  const base = [42,38,51,44,60,28,19,55,48,63,41,58,36,47,52,40,66,44,58,35,49,61,38,55,48,42,67,53,46,38]
  return base.map((v, i) => ({ t:`${i+1}`, leads:v, cot:Math.round(v*0.31) }))
}

const PIPELINE = [
  { name:"Prospecção",        count:420, color:"bg-slate-400",   textColor:"text-slate-600"  },
  { name:"Qualificado IA",    count:284, color:"bg-blue-500",    textColor:"text-blue-700"   },
  { name:"Cotação enviada",   count:198, color:"bg-sky-500",     textColor:"text-sky-700"    },
  { name:"Em negociação",     count:124, color:"bg-amber-500",   textColor:"text-amber-700"  },
  { name:"Proposta aceita",   count: 88, color:"bg-orange-500",  textColor:"text-orange-700" },
  { name:"Fechado",           count: 62, color:"bg-emerald-500", textColor:"text-emerald-700"},
  { name:"Renovação ativa",   count:642, color:"bg-violet-500",  textColor:"text-violet-700" },
  { name:"Perdido / Churn",   count: 93, color:"bg-red-400",     textColor:"text-red-600"    },
]

const VENDEDORES = [
  { name:"Rodrigo S.",  initials:"RS", leads:287, fechados:91,  comissao:28_400 },
  { name:"Ana Beatriz", initials:"AB", leads:241, fechados:78,  comissao:23_800 },
  { name:"Marcos O.",   initials:"MO", leads:198, fechados:58,  comissao:19_200 },
  { name:"Larissa P.",  initials:"LP", leads:162, fechados:47,  comissao:15_600 },
  { name:"Eduardo C.",  initials:"EC", leads:134, fechados:39,  comissao:12_400 },
  { name:"Camila F.",   initials:"CF", leads:118, fechados:32,  comissao:10_100 },
  { name:"Felipe A.",   initials:"FA", leads: 89, fechados:25,  comissao: 7_800 },
]

const VENCIMENTOS = [
  { name:"Juliana Costa",            seguro:"Auto",        dias:4,  premio:"R$ 287/mês" },
  { name:"Marcelo Ferreira",         seguro:"Residencial", dias:7,  premio:"R$ 124/mês" },
  { name:"TecnoFlex Indústria Ltda", seguro:"Empresarial", dias:9,  premio:"R$ 1.840/mês" },
  { name:"Amanda Pereira",           seguro:"Vida",        dias:11, premio:"R$ 198/mês" },
  { name:"Bruno Teixeira",           seguro:"Auto",        dias:12, premio:"R$ 342/mês" },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtCurrency = (v: number) =>
  v >= 1_000_000 ? `R$ ${(v/1_000_000).toFixed(1)}M` : `R$ ${(v/1000).toFixed(0)}k`

function Trend({ value, suffix = "%" }: { value: number; suffix?: string }) {
  if (value > 0)
    return <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600"><ArrowUpRight className="h-3 w-3" />+{value}{suffix}</span>
  if (value < 0)
    return <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-500"><ArrowDownRight className="h-3 w-3" />{value}{suffix}</span>
  return <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground"><Minus className="h-3 w-3" />0{suffix}</span>
}

function KPICard({ label, value, sub, icon: Icon, accentCls, iconCls, trend, trendSuffix, trendLabel }: {
  label: string; value: string; sub?: string; icon: React.ElementType
  accentCls: string; iconCls: string; trend?: number; trendSuffix?: string; trendLabel?: string
}) {
  return (
    <Card className="relative overflow-hidden border-border bg-card rounded-lg">
      <div className={cn("absolute left-0 top-0 bottom-0 w-[2px]", accentCls)} />
      <CardContent className="p-3 pl-4">
        <div className="flex items-start justify-between mb-1.5">
          <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide leading-none">{label}</p>
          <Icon className={cn("h-3 w-3 shrink-0", iconCls)} />
        </div>
        <p className="text-xl font-bold text-foreground leading-none">{value}</p>
        {(sub || trend !== undefined) && (
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {sub && <span className="text-[9px] text-muted-foreground">{sub}</span>}
            {trend !== undefined && <Trend value={trend} suffix={trendSuffix} />}
            {trendLabel && <span className="text-[9px] text-muted-foreground">{trendLabel}</span>}
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
    <div className="bg-card border border-border rounded-md px-3 py-2 shadow-lg text-xs">
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>("Mês")

  const chartData   = useMemo(() => getChartData(period), [period])
  const pipelineMax = PIPELINE[0].count

  const leadsTrend  = Math.round(((KPIs.leadsMes - KPIs.leadsAnterior) / KPIs.leadsAnterior) * 100)
  const fupTrend    = Math.round(((KPIs.followupsIA - KPIs.followupsAnt) / KPIs.followupsAnt) * 100)
  const fatTrend    = Math.round(((KPIs.comissaoMes - KPIs.comissaoAnterior) / KPIs.comissaoAnterior) * 100)
  const convTrend   = Math.round((KPIs.taxaFechamento - KPIs.taxaFechamentoAnt) * 10) / 10

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">Visão estratégica · Abril 2026</p>
        </div>
      </div>

      {/* ── 6 KPI Cards ── */}
      <div className="grid grid-cols-6 gap-2.5">
        <KPICard
          label="Comissão do Mês"
          value={fmtCurrency(KPIs.comissaoMes)}
          sub={`Meta: ${fmtCurrency(KPIs.comissaoMeta)}`}
          icon={DollarSign}
          accentCls="bg-emerald-500" iconCls="text-emerald-500"
          trend={fatTrend} trendLabel="vs mês ant."
        />
        <KPICard
          label="Leads este Mês"
          value={KPIs.leadsMes.toLocaleString("pt-BR")}
          sub={`Hoje: ${KPIs.leadsHoje} · Ontem: ${KPIs.leadsOntem}`}
          icon={Users}
          accentCls="bg-primary" iconCls="text-primary"
          trend={leadsTrend} trendLabel="vs mês ant."
        />
        <KPICard
          label="Taxa de Fechamento"
          value={`${KPIs.taxaFechamento}%`}
          sub={`Anterior: ${KPIs.taxaFechamentoAnt}%`}
          icon={TrendingUp}
          accentCls="bg-sky-500" iconCls="text-sky-500"
          trend={convTrend} trendSuffix=" pp"
        />
        <KPICard
          label="Renovações em 30d"
          value={KPIs.renovacoes30d.toString()}
          sub={`${KPIs.renovacoesCritical} em risco de churn`}
          icon={AlertTriangle}
          accentCls="bg-amber-500" iconCls="text-amber-500"
        />
        <KPICard
          label="Conversas I.A."
          value={KPIs.conversasIA.toString()}
          sub="em atendimento agora"
          icon={MessageSquare}
          accentCls="bg-violet-500" iconCls="text-violet-500"
        />
        <KPICard
          label="Follow-ups I.A."
          value={KPIs.followupsIA.toLocaleString("pt-BR")}
          sub={`Recuperação: ${KPIs.recuperacaoIA}%`}
          icon={Bot}
          accentCls="bg-orange-500" iconCls="text-orange-500"
          trend={fupTrend} trendLabel="vs mês ant."
        />
      </div>

      {/* ── Intermediate Grey Boxes ── */}
      <div className="grid grid-cols-4 gap-2.5">
        {[
          { label:"Leads hoje",             value:KPIs.leadsHoje,    compare:KPIs.leadsOntem,                             compareLabel:"ontem",       unit:"leads" },
          { label:"Cotações hoje",          value:63,                compare:49,                                          compareLabel:"ontem",       unit:"cotações IA" },
          { label:"Fechamentos esta semana",value:21,                compare:17,                                          compareLabel:"sem. ant.",   unit:"apólices" },
          { label:"Renovações próximas 30d",value:KPIs.renovacoes30d,compare:KPIs.renovacoesCritical,                     compareLabel:"em risco",    unit:"renovações" },
        ].map((item) => {
          const diff = item.value - item.compare
          const diffPct = Math.round((diff / item.compare) * 100)
          const isRisk = item.label.includes("Renovações")
          return (
            <div key={item.label} className="bg-muted/30 border border-border rounded-lg px-4 py-3">
              <p className="text-[10px] text-muted-foreground font-medium mb-1.5">{item.label}</p>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-foreground leading-none">
                  {item.value.toLocaleString("pt-BR")}
                </span>
                <span className="text-[10px] text-muted-foreground mb-0.5">{item.unit}</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                {!isRisk ? (
                  <>
                    <span className={cn(
                      "text-[10px] font-semibold inline-flex items-center gap-0.5",
                      diffPct > 0 ? "text-emerald-600" : diffPct < 0 ? "text-red-500" : "text-muted-foreground"
                    )}>
                      {diffPct > 0 ? <ArrowUpRight className="h-3 w-3" /> : diffPct < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                      {Math.abs(diffPct)}%
                    </span>
                    <span className="text-[9px] text-muted-foreground">vs {item.compareLabel}</span>
                  </>
                ) : (
                  <span className="text-[10px] font-semibold text-amber-600 inline-flex items-center gap-0.5">
                    <AlertTriangle className="h-3 w-3" />
                    {item.compare} {item.compareLabel}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Chart + Pipeline ── */}
      <div className="grid grid-cols-12 gap-3">

        {/* Area Chart */}
        <Card className="col-span-7 border-border bg-card rounded-lg">
          <CardHeader className="px-5 pt-4 pb-0 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-semibold text-foreground">Leads &amp; Cotações</CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">Volume de oportunidades no período</p>
            </div>
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-md border border-border">
              {(["Hoje","Semana","Mês"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "h-6 px-2.5 text-[10px] font-medium rounded transition-all",
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
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-3 h-[2px] rounded-full bg-primary inline-block" />Leads
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-3 h-[2px] rounded-full bg-emerald-500 inline-block" />Cotações I.A.
              </span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top:4, right:4, left:-20, bottom:0 }}>
                <defs>
                  <linearGradient id="gLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gCot" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="t" tick={{ fontSize:10, fill:"hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize:10, fill:"hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="leads" name="Leads"         stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gLeads)" dot={false} />
                <Area type="monotone" dataKey="cot"   name="Cotações I.A." stroke="#10b981"             strokeWidth={2} fill="url(#gCot)"   dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pipeline */}
        <Card className="col-span-5 border-border bg-card rounded-lg">
          <CardHeader className="px-5 pt-4 pb-2">
            <CardTitle className="text-sm font-semibold text-foreground">Pipeline de Leads</CardTitle>
            <p className="text-[11px] text-muted-foreground">Distribuição por estágio</p>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-2">
            {PIPELINE.map((s) => {
              const w = Math.round((s.count / pipelineMax) * 100)
              return (
                <div key={s.name}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-muted-foreground">{s.name}</span>
                    <span className={cn("text-[10px] font-semibold", s.textColor)}>{s.count}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", s.color)} style={{ width:`${w}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* ── Vendor Ranking + IA Activity ── */}
      <div className="grid grid-cols-12 gap-3">

        {/* Vendor Ranking */}
        <Card className="col-span-8 border-border bg-card rounded-lg group cursor-pointer hover:border-primary/30 transition-all">
          <CardHeader className="px-5 pt-4 pb-0 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                Ranking de Corretores
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">Top 7 · este mês</p>
            </div>
            <span className="text-[10px] text-muted-foreground underline underline-offset-2">Ver análise completa</span>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-3">
            <div className="grid grid-cols-12 gap-2 px-2 py-1.5 text-[9px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border mb-1">
              <div className="col-span-1">#</div>
              <div className="col-span-4">Corretor</div>
              <div className="col-span-2 text-right">Leads</div>
              <div className="col-span-2 text-right">Fechados</div>
              <div className="col-span-3 text-right">Comissão</div>
            </div>
            {VENDEDORES.map((v, i) => (
              <div key={v.name} className="grid grid-cols-12 gap-2 px-2 py-1.5 text-[11px] hover:bg-muted/40 rounded-md transition-colors">
                <div className="col-span-1 flex items-center">
                  <span className={cn(
                    "w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold",
                    i===0 ? "bg-amber-100 text-amber-700" : i===1 ? "bg-slate-100 text-slate-600" : i===2 ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground"
                  )}>{i+1}</span>
                </div>
                <div className="col-span-4 flex items-center gap-2">
                  <div className={cn(
                    "w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0",
                    i===0 ? "bg-primary" : i===1 ? "bg-sky-500" : i===2 ? "bg-violet-500" : "bg-slate-400"
                  )}>{v.initials}</div>
                  <span className="font-medium text-foreground">{v.name}</span>
                </div>
                <div className="col-span-2 text-right text-muted-foreground font-medium">{v.leads}</div>
                <div className="col-span-2 text-right text-emerald-700 font-semibold">{v.fechados}</div>
                <div className="col-span-3 text-right font-bold text-foreground">{fmtCurrency(v.comissao)}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* I.A. Activity */}
        <Card className="col-span-4 border-border bg-card rounded-lg">
          <CardHeader className="px-5 pt-4 pb-2">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5 text-orange-500" />
              Atividade da I.A.
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">Automação e eficiência</p>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-3">
            {[
              { label:"Cobertura I.A.",        value:`${KPIs.coberturaIA}%`,                  sub:"dos leads atendidos",   valueCls:"text-orange-600", barCls:"bg-orange-500", pct:KPIs.coberturaIA },
              { label:"Conversas ativas",      value:KPIs.conversasIA.toString(),              sub:"em atendimento agora",  valueCls:"text-violet-600", barCls:"bg-violet-500", pct:Math.min(100, KPIs.conversasIA*2) },
              { label:"Follow-ups enviados",   value:KPIs.followupsIA.toLocaleString("pt-BR"), sub:"este mês",              valueCls:"text-primary",    barCls:"bg-primary",    pct:78 },
              { label:"Taxa de recuperação",   value:`${KPIs.recuperacaoIA}%`,                 sub:"leads reengajados",     valueCls:"text-emerald-600",barCls:"bg-emerald-500", pct:Math.min(100, KPIs.recuperacaoIA*3) },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-muted-foreground">{item.label}</span>
                  <span className={cn("text-[11px] font-bold", item.valueCls)}>{item.value}</span>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full", item.barCls)} style={{ width:`${Math.min(100,item.pct)}%` }} />
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5">{item.sub}</p>
              </div>
            ))}

            <div className="pt-1 border-t border-border">
              <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5">
                <p className="text-[9px] text-amber-600 font-semibold uppercase tracking-wide mb-0.5">Atenção</p>
                <p className="text-sm font-bold text-amber-700">38 apólices</p>
                <p className="text-[10px] text-amber-600">vencem em menos de 15 dias</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
