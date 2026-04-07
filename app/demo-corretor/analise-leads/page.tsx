"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Users, Bot, TrendingUp, MessageSquare,
  ArrowUpRight, ArrowDownRight, Zap, Send, RefreshCcw,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Mock Data ────────────────────────────────────────────────────────────────

const PERIODS = ["Hoje", "7 dias", "30 dias", "3 meses"] as const
type Period = typeof PERIODS[number]

const VENDEDORES_FILTER = ["Todos", "Rodrigo Silva", "Ana Beatriz", "Marcos Oliveira"] as const

// Leads por dia (últimos 30 dias simulados)
const LEADS_POR_DIA = [
  { dia: "09/03", leads: 22, convertidos: 6 },
  { dia: "10/03", leads: 18, convertidos: 5 },
  { dia: "11/03", leads: 31, convertidos: 10 },
  { dia: "12/03", leads: 27, convertidos: 8 },
  { dia: "13/03", leads: 24, convertidos: 7 },
  { dia: "14/03", leads: 15, convertidos: 4 },
  { dia: "15/03", leads: 12, convertidos: 3 },
  { dia: "16/03", leads: 29, convertidos: 9 },
  { dia: "17/03", leads: 34, convertidos: 11 },
  { dia: "18/03", leads: 38, convertidos: 12 },
  { dia: "19/03", leads: 32, convertidos: 10 },
  { dia: "20/03", leads: 28, convertidos: 9 },
  { dia: "21/03", leads: 21, convertidos: 6 },
  { dia: "22/03", leads: 14, convertidos: 4 },
  { dia: "23/03", leads: 33, convertidos: 10 },
  { dia: "24/03", leads: 41, convertidos: 13 },
  { dia: "25/03", leads: 36, convertidos: 12 },
  { dia: "26/03", leads: 30, convertidos: 9 },
  { dia: "27/03", leads: 26, convertidos: 8 },
  { dia: "28/03", leads: 19, convertidos: 6 },
  { dia: "29/03", leads: 13, convertidos: 3 },
  { dia: "30/03", leads: 38, convertidos: 12 },
  { dia: "31/03", leads: 44, convertidos: 14 },
  { dia: "01/04", leads: 39, convertidos: 13 },
  { dia: "02/04", leads: 33, convertidos: 11 },
  { dia: "03/04", leads: 27, convertidos: 8 },
  { dia: "04/04", leads: 20, convertidos: 6 },
  { dia: "05/04", leads: 14, convertidos: 4 },
  { dia: "06/04", leads: 42, convertidos: 14 },
  { dia: "07/04", leads: 38, convertidos: 12 },
]

const FUNIL_STEPS = [
  { label: "Leads recebidos",    value: 847, pct: 100, color: "bg-slate-400",   desc: "Total de leads no período" },
  { label: "Contato realizado",  value: 791, pct: 93,  color: "bg-blue-500",    desc: "IA iniciou conversa" },
  { label: "Qualificados pela IA", value: 631, pct: 74, color: "bg-sky-500",   desc: "Dados coletados pela Sofia" },
  { label: "Cotação gerada",     value: 324, pct: 38,  color: "bg-amber-400",   desc: "Multicálculo consultado" },
  { label: "Proposta enviada",   value: 248, pct: 29,  color: "bg-orange-500",  desc: "Proposta formalizada" },
  { label: "Fechamento",         value: 266, pct: 31,  color: "bg-emerald-500", desc: "Apólice emitida" },
]

const INTENCAO_LEADS = [
  { label: "Alta intenção",   value: 234, pct: 28, color: "bg-emerald-500", desc: "Score IA ≥ 75 — prontos para cotação" },
  { label: "Média intenção",  value: 389, pct: 46, color: "bg-amber-400",   desc: "Score IA 40–74 — em nutrição" },
  { label: "Baixa intenção",  value: 147, pct: 17, color: "bg-slate-400",   desc: "Score IA 20–39 — jornada longa" },
  { label: "Sem intenção",    value:  77, pct:  9, color: "bg-red-400",     desc: "Score IA < 20 — base fria" },
]

const CANAIS = [
  { canal: "Tráfego Pago (Meta)",  leads: 312, pct: 37, conv: 34, color: "bg-blue-500" },
  { canal: "Base Inativa (IA)",    leads: 198, pct: 23, conv: 18, color: "bg-violet-500" },
  { canal: "WhatsApp Orgânico",    leads: 168, pct: 20, conv: 29, color: "bg-emerald-500" },
  { canal: "Instagram Direto",     leads:  93, pct: 11, conv: 22, color: "bg-rose-500" },
  { canal: "Indicação",            leads:  76, pct:  9, conv: 47, color: "bg-amber-500" },
]

const LEADS_POR_VENDEDOR = [
  { nome: "Rodrigo Silva",  leads: 287, convertidos: 91, taxa: 31.7, avatar: "RS", color: "bg-blue-500" },
  { nome: "Ana Beatriz",    leads: 241, convertidos: 78, taxa: 32.4, avatar: "AB", color: "bg-emerald-500" },
  { nome: "Marcos Oliveira",leads: 198, convertidos: 58, taxa: 29.3, avatar: "MO", color: "bg-amber-500" },
  { nome: "Sofia (IA)",     leads: 121, convertidos: 39, taxa: 32.2, avatar: "IA", color: "bg-sky-500" },
]

// Performance da nutrição por tentativa
const NUTRICAO_PERFORMANCE = [
  { tentativa: "1ª mensagem (Dia 0)", respondeu: 38.2, seguiu: 100, cor: "bg-blue-500" },
  { tentativa: "2ª mensagem (Dia 3)", respondeu: 22.4, seguiu: 61.8, cor: "bg-sky-500" },
  { tentativa: "3ª mensagem (Dia 7)", respondeu: 14.1, seguiu: 39.4, cor: "bg-amber-400" },
  { tentativa: "4ª mensagem (Dia 14)",respondeu:  8.7, seguiu: 25.3, cor: "bg-orange-400" },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const maxLeads = Math.max(...LEADS_POR_DIA.map(d => d.leads))

function pct(a: number, b: number) { return b > 0 ? Math.round((a/b)*100) : 0 }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnaliseLeadsPage() {
  const [period, setPeriod]         = useState<Period>("30 dias")
  const [vendedor, setVendedor]     = useState<string>("Todos")

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground tracking-tight">Análise de Leads</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">Performance de captação, qualificação e conversão</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Vendedor filter */}
          <div className="flex items-center gap-1 bg-muted/60 border border-border rounded-md p-1">
            {VENDEDORES_FILTER.map(v => (
              <button
                key={v}
                onClick={() => setVendedor(v)}
                className={cn(
                  "h-6 px-2 text-[10px] font-medium rounded transition-all",
                  vendedor === v
                    ? "bg-card border border-border shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v === "Todos" ? "Todos" : v.split(" ")[0]}
              </button>
            ))}
          </div>

          {/* Period filter */}
          <div className="flex items-center gap-1 bg-muted/60 border border-border rounded-md p-1">
            {PERIODS.map(p => (
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
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-6 gap-2.5">
        {[
          { label: "Leads recebidos",   value: "847",    sub: "↑ 12% vs. mês ant.",    icon: Users,       accent: "bg-blue-500",    icolor: "text-blue-500",    up: true },
          { label: "Qualificados (IA)", value: "631",    sub: "74,5% do total",         icon: Bot,         accent: "bg-sky-500",     icolor: "text-sky-500",     up: null },
          { label: "Cotações geradas",  value: "324",    sub: "51,3% dos qualificados", icon: MessageSquare, accent: "bg-amber-400", icolor: "text-amber-500",   up: null },
          { label: "Taxa fechamento",   value: "31,4%",  sub: "↑ 6,2pp vs. sem IA",    icon: TrendingUp,  accent: "bg-emerald-500", icolor: "text-emerald-500", up: true },
          { label: "Follow-ups IA",     value: "1.247",  sub: "38% taxa de resposta",   icon: Send,        accent: "bg-violet-500",  icolor: "text-violet-500",  up: null },
          { label: "Nutrição → retorno","value": "25,5%", sub: "jornadas ativas",       icon: RefreshCcw,  accent: "bg-orange-400",  icolor: "text-orange-500",  up: null },
        ].map((k) => (
          <Card key={k.label} className="relative overflow-hidden border-border bg-card rounded-lg">
            <div className={cn("absolute left-0 top-0 bottom-0 w-[2px]", k.accent)} />
            <CardContent className="p-3 pl-4">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">{k.label}</p>
                <k.icon className={cn("h-3 w-3 shrink-0", k.icolor)} />
              </div>
              <p className="text-lg font-bold text-foreground leading-none">{k.value}</p>
              <p className="text-[9px] text-muted-foreground mt-1 flex items-center gap-0.5">
                {k.up === true && <ArrowUpRight className="h-2.5 w-2.5 text-emerald-500 shrink-0" />}
                {k.sub}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Timeline + Funil */}
      <div className="grid grid-cols-12 gap-3">

        {/* Timeline — leads por dia */}
        <Card className="col-span-8 border-border bg-card rounded-lg">
          <CardHeader className="px-4 py-3 border-b border-border flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[12px] font-semibold text-foreground">Leads por dia</CardTitle>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500" />Leads</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" />Convertidos</span>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex items-end gap-[3px] h-28 overflow-hidden">
              {LEADS_POR_DIA.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-px min-w-0">
                  <div className="w-full flex flex-col gap-px" style={{ height: `${Math.round((d.leads / maxLeads) * 96)}px` }}>
                    {/* Leads bar */}
                    <div className="flex-1 w-full bg-blue-500/80 rounded-sm" />
                  </div>
                  {/* Converted overlay conceptually shown as number */}
                </div>
              ))}
            </div>
            {/* Show a simplified bar chart with both leads and converted */}
            <div className="flex items-end gap-[3px] h-28 overflow-hidden -mt-28 pointer-events-none">
              {LEADS_POR_DIA.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end min-w-0" style={{ height: `${Math.round((d.leads / maxLeads) * 96)}px` }}>
                  <div
                    className="w-full bg-emerald-500/90 rounded-sm"
                    style={{ height: `${Math.round((d.convertidos / d.leads) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
            {/* X-axis labels — sparse */}
            <div className="flex items-center mt-1.5 overflow-hidden">
              {LEADS_POR_DIA.filter((_, i) => i % 5 === 0).map((d, i) => (
                <div key={i} className="flex-1 text-[8px] text-muted-foreground text-center">{d.dia}</div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-border flex items-center gap-6 text-[10px] text-muted-foreground">
              <span>Média diária: <strong className="text-foreground">28,2 leads</strong></span>
              <span>Melhor dia: <strong className="text-foreground">44 leads (31/03)</strong></span>
              <span>Pior dia: <strong className="text-foreground">12 leads (15/03)</strong></span>
              <span className="ml-auto flex items-center gap-1 text-emerald-600 font-medium">
                <ArrowUpRight className="h-3 w-3" />32% acima do mês anterior
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Funil de conversão */}
        <Card className="col-span-4 border-border bg-card rounded-lg">
          <CardHeader className="px-4 py-3 border-b border-border">
            <CardTitle className="text-[12px] font-semibold text-foreground">Funil de Conversão</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-1.5">
            {FUNIL_STEPS.map((s, i) => (
              <div key={s.label}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-foreground truncate pr-2">{s.label}</span>
                  <span className="text-[10px] font-semibold text-foreground shrink-0">{s.value}</span>
                </div>
                <div className="h-4 bg-muted rounded-sm overflow-hidden">
                  <div
                    className={cn("h-full flex items-center px-1.5 rounded-sm", s.color)}
                    style={{ width: `${s.pct}%` }}
                  >
                    <span className="text-[8px] font-semibold text-white">{s.pct}%</span>
                  </div>
                </div>
                {i < FUNIL_STEPS.length - 1 && (
                  <p className="text-[8px] text-muted-foreground/60 mt-0.5">{s.desc}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Intenção + Canais + Nutrição */}
      <div className="grid grid-cols-12 gap-3">

        {/* Intenção dos leads */}
        <Card className="col-span-4 border-border bg-card rounded-lg">
          <CardHeader className="px-4 py-3 border-b border-border flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[12px] font-semibold text-foreground">Intenção dos Leads</CardTitle>
            <span className="text-[10px] text-muted-foreground">Score IA</span>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5">
            {INTENCAO_LEADS.map((il) => (
              <div key={il.label}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("w-2 h-2 rounded-full", il.color)} />
                    <span className="text-[10px] font-medium text-foreground">{il.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-foreground">{il.value}</span>
                    <span className="text-[9px] text-muted-foreground w-8 text-right">{il.pct}%</span>
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full", il.color)} style={{ width: `${il.pct}%` }} />
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5">{il.desc}</p>
              </div>
            ))}
            <div className="mt-2 pt-2 border-t border-border">
              <p className="text-[10px] text-muted-foreground">
                <strong className="text-emerald-600">74%</strong> dos leads de alta intenção são cotados em menos de 10 min pela Sofia
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Leads por canal */}
        <Card className="col-span-4 border-border bg-card rounded-lg">
          <CardHeader className="px-4 py-3 border-b border-border">
            <CardTitle className="text-[12px] font-semibold text-foreground">Leads por Canal</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5">
            {CANAIS.map((c) => (
              <div key={c.canal}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-foreground truncate pr-2">{c.canal}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[9px] text-muted-foreground">{c.leads} leads</span>
                    <span className={cn(
                      "text-[9px] font-medium",
                      c.conv >= 30 ? "text-emerald-600" : c.conv >= 20 ? "text-amber-600" : "text-muted-foreground"
                    )}>{c.conv}% conv.</span>
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full", c.color)} style={{ width: `${c.pct}%` }} />
                </div>
              </div>
            ))}
            <div className="mt-2 pt-2 border-t border-border">
              <p className="text-[10px] text-muted-foreground">
                Indicação tem <strong className="text-emerald-600">47% de conversão</strong> — maior ROI do funil
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Performance da nutrição */}
        <Card className="col-span-4 border-border bg-card rounded-lg">
          <CardHeader className="px-4 py-3 border-b border-border flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[12px] font-semibold text-foreground">Performance da Nutrição</CardTitle>
            <div className="flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
              <Zap className="h-2.5 w-2.5" />25,5% retorno
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {/* By attempt */}
            <div className="space-y-2">
              {NUTRICAO_PERFORMANCE.map((n, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] text-muted-foreground">{n.tentativa}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-muted-foreground">{n.seguiu}% chegaram</span>
                      <span className="text-[10px] font-semibold text-foreground">{n.respondeu}% resp.</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", n.cor)} style={{ width: `${n.respondeu * 2}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-border space-y-1.5">
              {[
                { label: "Jornada 90d",    taxa: "34%", clientes: 842, cor: "text-blue-600" },
                { label: "Jornada 60d",    taxa: "28%", clientes: 614, cor: "text-amber-600" },
                { label: "Jornada 30d",    taxa: "19%", clientes: 347, cor: "text-orange-600" },
                { label: "Base inativa",   taxa: "12%", clientes: 913, cor: "text-violet-600" },
              ].map(j => (
                <div key={j.label} className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">{j.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{j.clientes.toLocaleString("pt-BR")} leads</span>
                    <span className={cn("font-semibold", j.cor)}>{j.taxa} retorno</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leads por vendedor */}
      <Card className="border-border bg-card rounded-lg">
        <CardHeader className="px-4 py-3 border-b border-border flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-[12px] font-semibold text-foreground">Leads por Vendedor</CardTitle>
          <span className="text-[10px] text-muted-foreground">abril 2026</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-4 gap-px bg-border">
            {/* Header */}
            {["Vendedor", "Leads atribuídos", "Convertidos", "Taxa"].map(h => (
              <div key={h} className="bg-muted/30 px-4 py-2 text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">
                {h}
              </div>
            ))}
            {/* Rows */}
            {LEADS_POR_VENDEDOR.map((v, i) => (
              <>
                <div key={`${v.nome}-nome`} className={cn("bg-card px-4 py-3 flex items-center gap-2.5", i % 2 !== 0 && "bg-muted/10")}>
                  <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0", v.color)}>
                    {v.avatar}
                  </div>
                  <span className="text-[12px] font-medium text-foreground">{v.nome}</span>
                  {v.avatar === "IA" && (
                    <span className="text-[8px] font-medium text-sky-700 bg-sky-50 border border-sky-200 px-1 py-px rounded">AUTO</span>
                  )}
                </div>
                <div key={`${v.nome}-leads`} className={cn("bg-card px-4 py-3 flex items-center", i % 2 !== 0 && "bg-muted/10")}>
                  <div className="flex items-center gap-2 w-full">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", v.color)} style={{ width: `${pct(v.leads, 287)}%` }} />
                    </div>
                    <span className="text-[12px] font-semibold text-foreground shrink-0">{v.leads}</span>
                  </div>
                </div>
                <div key={`${v.nome}-conv`} className={cn("bg-card px-4 py-3 flex items-center", i % 2 !== 0 && "bg-muted/10")}>
                  <span className="text-[12px] font-semibold text-foreground">{v.convertidos}</span>
                </div>
                <div key={`${v.nome}-taxa`} className={cn("bg-card px-4 py-3 flex items-center gap-1.5", i % 2 !== 0 && "bg-muted/10")}>
                  <span className={cn(
                    "text-[12px] font-bold",
                    v.taxa >= 32 ? "text-emerald-600" : "text-foreground"
                  )}>{v.taxa}%</span>
                  {v.taxa >= 32 && <ArrowUpRight className="h-3 w-3 text-emerald-500" />}
                </div>
              </>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* IA Performance */}
      <div className="grid grid-cols-4 gap-2.5">
        {[
          { label: "Conversas gerenciadas pela IA",  value: "1.891",  sub: "este mês",            accent: "bg-sky-500",     icolor: "text-sky-500",    icon: Bot },
          { label: "Tempo médio qualificação",       value: "4m 12s", sub: "↓ 38s vs. mês ant.",  accent: "bg-blue-500",    icolor: "text-blue-500",   icon: Zap },
          { label: "Transferências para humano",     value: "312",    sub: "16,5% das conversas", accent: "bg-amber-400",   icolor: "text-amber-500",  icon: Users },
          { label: "Cotações autônomas (sem humano)","value": "187",  sub: "proposta aceita na IA",accent: "bg-emerald-500", icolor: "text-emerald-500",icon: TrendingUp },
        ].map(k => (
          <Card key={k.label} className="relative overflow-hidden border-border bg-card rounded-lg">
            <div className={cn("absolute left-0 top-0 bottom-0 w-[2px]", k.accent)} />
            <CardContent className="p-3 pl-4">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">{k.label}</p>
                <k.icon className={cn("h-3 w-3 shrink-0", k.icolor)} />
              </div>
              <p className="text-xl font-bold text-foreground leading-none">{k.value}</p>
              <p className="text-[9px] text-muted-foreground mt-1">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
