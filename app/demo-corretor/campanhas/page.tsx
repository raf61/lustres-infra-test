"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import {
  Send, MessageSquare, RefreshCcw, DollarSign, Bot,
  Eye, UserCheck, UserMinus, Search, Megaphone,
  ChevronRight, Sparkles, ArrowRight, BarChart3,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Mock Data ────────────────────────────────────────────────────────────────

const TIPO_SEGUROS = ["Auto", "Vida", "Empresarial", "Residencial", "Saúde", "Frota", "RC"]
const SEGURADORAS = ["Porto Seguro", "HDI Seguros", "Mapfre", "SulAmérica", "Allianz", "Tokio Marine", "Bradesco Seg.", "Liberty"]

const NOMES_LEADS = [
  "Carlos Mendonça","Fernanda Lima","Ricardo Alves","Patrícia Souza","Eduardo Rocha",
  "Juliana Costa","Marcelo Ferreira","Amanda Pereira","Bruno Teixeira","Larissa Nunes",
  "Rafael Cardoso","Camila Martins","Gustavo Barbosa","Renata Carvalho","Felipe Araújo",
  "Mônica Pinto","Thiago Gomes","Vanessa Oliveira","Leandro Santos","Tatiana Correia",
]

function makePhone(i: number) {
  return `(11) 9${(10000000 + (i * 31337) % 90000000).toString().padStart(8, "0")}`
}

const LEADS_MOCK = Array.from({ length: 160 }, (_, i) => ({
  id: String(i + 1),
  name: NOMES_LEADS[i % NOMES_LEADS.length] + (i >= NOMES_LEADS.length ? ` ${Math.floor(i / NOMES_LEADS.length) + 1}` : ""),
  phone: makePhone(i),
  tipo: TIPO_SEGUROS[i % TIPO_SEGUROS.length],
  seguradoraAtual: SEGURADORAS[i % SEGURADORAS.length],
  cotacaoIA: `R$ ${((180 + (i * 37) % 800)).toFixed(0)}/mês`,
  status: (["respondeu", "leu", "enviado", "cotando"] as const)[i % 4],
  scoreIA: 30 + (i * 17) % 68,
}))

const CAMPAIGNS = [
  {
    id: "1", name: "Reativação Base Inativa Q1 2026",
    status: "active" as const, type: "AI_ASSISTED",
    sent: 2840, read: 1970, replied: 680, interested: 410, ignored: 270, followups: 520,
    revenue: 67200, recoveryRate: 29.4, salesRate: 14.4,
    date: "03/01", audience: "Base inativa +180 dias",
  },
  {
    id: "2", name: "Vencimentos Abril 2026",
    status: "active" as const, type: "AI_ASSISTED",
    sent: 142, read: 127, replied: 89, interested: 62, ignored: 27, followups: 38,
    revenue: 48600, recoveryRate: 43.7, salesRate: 32.4,
    date: "01/04", audience: "Apólices vencendo em abril",
  },
  {
    id: "3", name: "Prospecção PJ — Empresas SP",
    status: "active" as const, type: "AI_ASSISTED",
    sent: 580, read: 412, replied: 194, interested: 128, ignored: 66, followups: 140,
    revenue: 134000, recoveryRate: 34.0, salesRate: 22.1,
    date: "15/03", audience: "CNPJs porte médio — SP capital",
  },
  {
    id: "4", name: "Leads Frios Nov–Dez 2025",
    status: "completed" as const, type: "STANDARD",
    sent: 1200, read: 840, replied: 210, interested: 95, ignored: 115, followups: 0,
    revenue: 23400, recoveryRate: 9.8, salesRate: 7.9,
    date: "10/01", audience: "Leads sem interação há 90 dias",
  },
  {
    id: "5", name: "Frota de Veículos — Transportadoras",
    status: "active" as const, type: "AI_ASSISTED",
    sent: 89, read: 78, replied: 52, interested: 38, ignored: 14, followups: 24,
    revenue: 218000, recoveryRate: 42.7, salesRate: 31.5,
    date: "20/03", audience: "Transportadoras com frota 5+ veículos",
  },
]

type Campaign = typeof CAMPAIGNS[0]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0

const fmtCurrency = (v: number) =>
  v >= 1_000_000 ? `R$ ${(v / 1_000_000).toFixed(1)}M` : `R$ ${(v / 1000).toFixed(0)}k`

const STATUS_BADGE = {
  respondeu: "bg-emerald-100 text-emerald-700 border-emerald-200",
  leu:       "bg-blue-100 text-blue-700 border-blue-200",
  enviado:   "bg-slate-100 text-slate-600 border-slate-200",
  cotando:   "bg-sky-100 text-sky-700 border-sky-200",
}

const STATUS_LABEL = {
  respondeu: "Respondeu",
  leu:       "Leu",
  enviado:   "Enviado",
  cotando:   "Cotando",
}

// ─── Campaign Details Dialog ──────────────────────────────────────────────────

function CampaignDetailsDialog({ campaign, open, onClose }: {
  campaign: Campaign; open: boolean; onClose: () => void
}) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "respondeu" | "leu" | "enviado" | "cotando">("all")

  const filtered = useMemo(() => LEADS_MOCK.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) || r.phone.includes(search)
    const matchStatus = statusFilter === "all" || r.status === statusFilter
    return matchSearch && matchStatus
  }), [search, statusFilter])

  const openPct  = pct(campaign.read,      campaign.sent)
  const replyPct = pct(campaign.replied,   campaign.sent)
  const interPct = pct(campaign.interested,campaign.sent)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[78vw] max-h-[90vh] p-0 border-border bg-background flex flex-col overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border flex flex-row items-start justify-between space-y-0 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn(
                "text-[10px] font-medium px-2 py-0.5 rounded border",
                campaign.status === "active"
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                  : "bg-muted text-muted-foreground border-border"
              )}>
                {campaign.status === "active" ? "Ativa" : "Concluída"}
              </span>
              {campaign.type === "AI_ASSISTED" && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded border bg-sky-100 text-sky-700 border-sky-200 flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" />IA Assistida
                </span>
              )}
            </div>
            <DialogTitle className="text-base font-semibold text-foreground">{campaign.name}</DialogTitle>
            <DialogDescription className="text-[11px] text-muted-foreground mt-0.5">
              {campaign.audience} · Início: {campaign.date}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex flex-col flex-1 overflow-hidden min-h-0 p-5 gap-4">
          {/* KPIs */}
          <div className="grid grid-cols-7 gap-3">
            {[
              { label: "Disparados",   value: campaign.sent,                            accentCls: "bg-slate-400",    valueCls: "text-foreground",   icon: Send },
              { label: "Lidos",        value: `${campaign.read} (${openPct}%)`,         accentCls: "bg-blue-500",     valueCls: "text-blue-700",     icon: Eye },
              { label: "Responderam",  value: `${campaign.replied} (${replyPct}%)`,     accentCls: "bg-sky-500",      valueCls: "text-sky-700",      icon: MessageSquare },
              { label: "Interessados", value: `${campaign.interested} (${interPct}%)`,  accentCls: "bg-emerald-500",  valueCls: "text-emerald-700",  icon: UserCheck },
              { label: "Ignoraram",    value: campaign.ignored,                         accentCls: "bg-red-400",      valueCls: "text-red-600",      icon: UserMinus },
              { label: "Follow-ups",   value: campaign.followups,                       accentCls: "bg-amber-500",    valueCls: "text-amber-700",    icon: RefreshCcw },
              { label: "Conversão",    value: `${campaign.salesRate}%`,                 accentCls: "bg-primary",      valueCls: "text-primary",      icon: Bot },
            ].map(s => (
              <div key={s.label} className="relative overflow-hidden border border-border rounded-xl bg-card p-3">
                <div className={cn("absolute left-0 top-0 bottom-0 w-[3px]", s.accentCls)} />
                <div className="pl-1">
                  <div className="flex items-start justify-between mb-1.5">
                    <p className="text-[9px] font-medium text-muted-foreground">{s.label}</p>
                    <s.icon className="h-3 w-3 text-muted-foreground/50" />
                  </div>
                  <p className={cn("text-sm font-bold leading-none", s.valueCls)}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Funil */}
          <div className="border border-border rounded-xl bg-card p-4">
            <p className="text-[11px] font-semibold text-muted-foreground mb-3">Funil de conversão</p>
            <div className="flex items-center gap-1">
              {[
                { label: "Enviados",     value: campaign.sent,        color: "bg-slate-400",   pct: 100 },
                { label: "Lidos",        value: campaign.read,        color: "bg-blue-500",    pct: openPct },
                { label: "Responderam",  value: campaign.replied,     color: "bg-sky-500",     pct: replyPct },
                { label: "Interessados", value: campaign.interested,  color: "bg-emerald-500", pct: interPct },
              ].map((step, i) => (
                <div key={step.label} className="flex items-center gap-1 flex-1">
                  {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="h-6 rounded-md overflow-hidden bg-muted">
                      <div
                        className={cn("h-full rounded-md flex items-center px-2", step.color)}
                        style={{ width: `${step.pct}%` }}
                      >
                        <span className="text-[9px] font-bold text-white whitespace-nowrap">{step.value}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[9px] text-muted-foreground">{step.label}</span>
                      <span className="text-[9px] font-semibold text-foreground">{step.pct}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Leads table */}
          <div className="flex-1 flex flex-col border border-border rounded-xl overflow-hidden min-h-0">
            <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center gap-3 shrink-0">
              <p className="text-[11px] font-semibold text-foreground flex-1">
                Leads <span className="text-muted-foreground font-normal ml-1">({filtered.length})</span>
              </p>
              <div className="flex items-center gap-2">
                {(["all", "respondeu", "leu", "enviado", "cotando"] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      "h-6 px-2 text-[10px] font-medium rounded-md transition-all",
                      statusFilter === s
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {s === "all" ? "Todos" : STATUS_LABEL[s]}
                  </button>
                ))}
                <div className="relative ml-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar..."
                    className="h-6 pl-7 pr-2 text-[10px] bg-muted/60 border border-border rounded-md outline-none focus:ring-1 focus:ring-primary/30 w-32"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-2 px-4 py-1.5 border-b border-border bg-muted/10 shrink-0">
              {[
                ["col-span-2","Nome"],["col-span-2","WhatsApp"],["col-span-1","Seguro"],
                ["col-span-2","Seg. Atual"],["col-span-2","Cotação IA"],["col-span-1","Status"],["col-span-2","Score IA"],
              ].map(([cls, label]) => (
                <div key={label} className={cn("text-[9px] font-semibold text-muted-foreground uppercase tracking-wide", cls)}>
                  {label}
                </div>
              ))}
            </div>

            <ScrollArea className="flex-1">
              {filtered.map((r, i) => (
                <div
                  key={r.id}
                  className={cn(
                    "grid grid-cols-12 gap-2 px-4 py-2.5 items-center border-b border-border/40 transition-colors hover:bg-muted/30",
                    i % 2 === 0 ? "bg-background" : "bg-muted/10"
                  )}
                >
                  <div className="col-span-2 text-[11px] font-medium text-foreground truncate">{r.name}</div>
                  <div className="col-span-2 text-[10px] font-mono text-muted-foreground">{r.phone}</div>
                  <div className="col-span-1">
                    <span className="text-[9px] font-medium px-1 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200">
                      {r.tipo}
                    </span>
                  </div>
                  <div className="col-span-2 text-[10px] text-muted-foreground truncate">{r.seguradoraAtual}</div>
                  <div className="col-span-2 text-[10px] font-semibold text-emerald-600">{r.cotacaoIA}</div>
                  <div className="col-span-1">
                    <span className={cn("text-[9px] font-medium px-1 py-0.5 rounded border", STATUS_BADGE[r.status])}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", r.scoreIA >= 70 ? "bg-emerald-500" : r.scoreIA >= 50 ? "bg-amber-500" : "bg-red-400")}
                        style={{ width: `${r.scoreIA}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-foreground w-5 text-right">{r.scoreIA}</span>
                  </div>
                </div>
              ))}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Campaign Card ────────────────────────────────────────────────────────────

function CampaignCard({ campaign, onAnalyze }: { campaign: Campaign; onAnalyze: () => void }) {
  const openPct  = pct(campaign.read,      campaign.sent)
  const replyPct = pct(campaign.replied,   campaign.sent)
  const interPct = pct(campaign.interested,campaign.sent)

  return (
    <div className={cn(
      "relative overflow-hidden border rounded-xl bg-card p-4 transition-all hover:border-primary/30",
      campaign.status === "active" ? "border-border" : "border-border"
    )}>
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-[3px]",
        campaign.status === "active" ? "bg-emerald-500" : "bg-slate-300"
      )} />

      <div className="pl-2">
        {/* Row 1 */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded border",
                campaign.status === "active"
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                  : "bg-muted text-muted-foreground border-border"
              )}>
                {campaign.status === "active" ? "Ativa" : "Concluída"}
              </span>
              {campaign.type === "AI_ASSISTED" && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-sky-100 text-sky-700 border-sky-200 flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" />IA Assistida
                </span>
              )}
            </div>
            <p className="text-[13px] font-semibold text-foreground truncate">{campaign.name}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{campaign.audience} · {campaign.date}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <p className="text-[9px] text-muted-foreground">Receita / Pipeline</p>
              <p className="text-sm font-bold text-emerald-600">{fmtCurrency(campaign.revenue)}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-[10px] font-medium border-border hover:bg-muted gap-1"
              onClick={onAnalyze}
            >
              <BarChart3 className="h-3 w-3" />Ver detalhes
            </Button>
          </div>
        </div>

        {/* Row 2: mini funnel */}
        <div className="flex items-center gap-0 text-[10px]">
          {[
            { label: "Disparados",    value: campaign.sent,       rate: null,     dotCls: "bg-slate-400" },
            { label: "Lidos",         value: campaign.read,       rate: openPct,  dotCls: "bg-blue-500" },
            { label: "Responderam",   value: campaign.replied,    rate: replyPct, dotCls: "bg-sky-500" },
            { label: "Interessados",  value: campaign.interested, rate: interPct, dotCls: "bg-emerald-500" },
            { label: "FUPs",          value: campaign.followups,  rate: null,     dotCls: "bg-amber-500" },
          ].map((step, i) => (
            <div key={step.label} className="flex items-center gap-0">
              {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/30 mx-1" />}
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1">
                  <span className={cn("w-1.5 h-1.5 rounded-full", step.dotCls)} />
                  <span className="font-bold text-foreground">{step.value.toLocaleString("pt-BR")}</span>
                  {step.rate !== null && <span className="text-muted-foreground">({step.rate}%)</span>}
                </div>
                <span className="text-[9px] text-muted-foreground">{step.label}</span>
              </div>
            </div>
          ))}

          <div className="ml-auto flex items-center gap-3 text-[10px]">
            <div className="text-center">
              <p className="font-semibold text-amber-600">{campaign.recoveryRate}%</p>
              <p className="text-[9px] text-muted-foreground">Recup. FUP</p>
            </div>
            <div className="text-center">
              <p className="font-semibold text-sky-600">{campaign.salesRate}%</p>
              <p className="text-[9px] text-muted-foreground">Conversão</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CampanhasPage() {
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed">("all")

  const filtered = useMemo(() => CAMPAIGNS.filter(c => {
    const matchStatus = statusFilter === "all" || c.status === statusFilter
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                        c.audience.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  }), [statusFilter, search])

  const totalSent    = CAMPAIGNS.reduce((s, c) => s + c.sent, 0)
  const totalRevenue = CAMPAIGNS.reduce((s, c) => s + c.revenue, 0)
  const avgReply     = Math.round(CAMPAIGNS.reduce((s, c) => s + pct(c.replied, c.sent), 0) / CAMPAIGNS.length)
  const avgConv      = (CAMPAIGNS.reduce((s, c) => s + c.salesRate, 0) / CAMPAIGNS.length).toFixed(1)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Campanhas</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Disparos, engajamento e receita gerada pela IA</p>
        </div>
        <Button className="h-8 px-4 text-xs font-medium gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground">
          <Megaphone className="h-3.5 w-3.5" />Nova Campanha
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total de Disparos",  value: totalSent.toLocaleString("pt-BR"), sub: `${CAMPAIGNS.length} campanhas`, icon: Send,         accentCls: "bg-slate-400", iconCls: "text-slate-500" },
          { label: "Taxa Média Resposta",value: `${avgReply}%`,                    sub: "engajamento médio",             icon: MessageSquare, accentCls: "bg-sky-500",   iconCls: "text-sky-500" },
          { label: "Conversão Média",    value: `${avgConv}%`,                     sub: "lead → apólice fechada",        icon: RefreshCcw,    accentCls: "bg-amber-500", iconCls: "text-amber-500" },
          { label: "Receita / Pipeline", value: fmtCurrency(totalRevenue),         sub: "todas as campanhas",            icon: DollarSign,    accentCls: "bg-emerald-500",iconCls: "text-emerald-500" },
        ].map(s => (
          <Card key={s.label} className="relative overflow-hidden border-border bg-card">
            <div className={cn("absolute left-0 top-0 bottom-0 w-[3px]", s.accentCls)} />
            <CardContent className="p-3 pl-4">
              <div className="flex items-start justify-between mb-1.5">
                <p className="text-[10px] font-medium text-muted-foreground">{s.label}</p>
                <s.icon className={cn("h-3.5 w-3.5 shrink-0", s.iconCls)} />
              </div>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Campaign list */}
      <Card className="border-border bg-card">
        <CardHeader className="px-5 pt-4 pb-3 border-b border-border flex flex-row items-center gap-3 space-y-0">
          <CardTitle className="text-sm font-semibold text-foreground flex-1">Campanhas</CardTitle>
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border">
            {(["all", "active", "completed"] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "h-6 px-2.5 text-[10px] font-medium rounded-md transition-all",
                  statusFilter === s
                    ? "bg-card border border-border shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s === "all" ? "Todas" : s === "active" ? "Ativas" : "Concluídas"}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar campanha..."
              className="h-7 pl-8 pr-3 text-[11px] bg-muted/60 border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary/30 w-44"
            />
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {filtered.map(campaign => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onAnalyze={() => setDetailCampaign(campaign)}
            />
          ))}
        </CardContent>
      </Card>

      {detailCampaign && (
        <CampaignDetailsDialog
          campaign={detailCampaign}
          open={!!detailCampaign}
          onClose={() => setDetailCampaign(null)}
        />
      )}
    </div>
  )
}
