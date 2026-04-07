"use client"

import { useState, useMemo } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Send, MessageSquare, RefreshCcw, DollarSign,
  Bot, Eye, UserCheck, UserMinus, ShoppingCart,
  Search, Megaphone, AlertTriangle, ChevronRight,
  Sparkles, ArrowRight, Trash2, BarChart3, FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CampaignDialog } from "@/components/leads/campaign-dialog"

// ─── Mock Data ────────────────────────────────────────────────────────────────

const NOMES = [
  "Carlos Mendonça","Fernanda Lima","Ricardo Alves","Patrícia Souza","Eduardo Rocha",
  "Juliana Costa","Marcelo Ferreira","Amanda Pereira","Bruno Teixeira","Larissa Nunes",
  "Rafael Cardoso","Camila Martins","Gustavo Barbosa","Renata Carvalho","Felipe Araújo",
  "Mônica Pinto","Thiago Gomes","Vanessa Oliveira","Leandro Santos","Tatiana Correia",
]

const RECIPIENTS_MOCK = Array.from({ length: 200 }, (_, i) => ({
  id: String(i + 1),
  name: NOMES[i % NOMES.length] + (i >= NOMES.length ? ` ${Math.floor(i / NOMES.length) + 1}` : ""),
  phone: `(21) 9${(10000000 + (i * 31337) % 90000000).toString().padStart(8, "0")}`,
  status: (["replied", "read", "sent", "failed"] as const)[i % 4],
  ai_status: (["active", "handoff", "concluded", "none"] as const)[i % 4],
  engagement: (["interested", "ignored", "none"] as const)[i % 3],
  followups: i % 3,
}))

const CAMPAIGNS = [
  {
    id: "1", name: "Recuperação de Cotações — Março",
    status: "active" as const, type: "AI_ASSISTED",
    sent: 1250, read: 980, replied: 420, orcados: 350, interested: 280, ignored: 140, followups: 340,
    revenue: 142500, recoveryRate: 27.2, salesRate: 12.5,
    date: "12/03", vendor: "Rodrigo Silva",
    audience: "Cotações em aberto",
  },
  {
    id: "2", name: "Reativação de Apólices — Base Inativa",
    status: "completed" as const, type: "STANDARD",
    sent: 3400, read: 2100, replied: 150, orcados: 80, interested: 45, ignored: 105, followups: 0,
    revenue: 48200, recoveryRate: 8.5, salesRate: 3.2,
    date: "05/03", vendor: "Ana Beatriz",
    audience: "Inativos há +180 dias",
  },
  {
    id: "3", name: "Campanha: Renovação Seguro Auto",
    status: "active" as const, type: "AI_ASSISTED",
    sent: 850, read: 720, replied: 310, orcados: 260, interested: 210, ignored: 100, followups: 120,
    revenue: 89900, recoveryRate: 22.1, salesRate: 18.4,
    date: "18/03", vendor: "Marcos Oliveira",
    audience: "Vencimentos em 30 dias",
  },
  {
    id: "4", name: "Parceria Estratégica: Imobiliárias",
    status: "active" as const, type: "AI_ASSISTED",
    sent: 420, read: 380, replied: 190, orcados: 165, interested: 145, ignored: 45, followups: 85,
    revenue: 215000, recoveryRate: 34.5, salesRate: 22.1,
    date: "20/03", vendor: "Rodrigo Silva",
    audience: "Seguros Incêndio / Locação",
  },
  {
    id: "5", name: "Oferta: Seguro de Vida Resgatável",
    status: "completed" as const, type: "STANDARD",
    sent: 1800, read: 1540, replied: 340, orcados: 220, interested: 180, ignored: 160, followups: 150,
    revenue: 62300, recoveryRate: 19.8, salesRate: 9.2,
    date: "10/03", vendor: "Ana Beatriz",
    audience: "Empresas (PME)",
  },
]


type Campaign = typeof CAMPAIGNS[0]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtCurrency = (v: number) =>
  v >= 1_000_000 ? `R$ ${(v / 1_000_000).toFixed(1)}M` : `R$ ${(v / 1000).toFixed(0)}k`

const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0

function needsAttention(c: Campaign) {
  return pct(c.replied, c.sent) < 15 || pct(c.read, c.sent) < 50
}

// ─── Recipient status config ──────────────────────────────────────────────────

const SEND_STATUS = {
  replied:  { label: "Respondeu",  cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  read:     { label: "Leu",        cls: "bg-blue-100 text-blue-700 border-blue-200" },
  sent:     { label: "Enviado",    cls: "bg-slate-100 text-slate-600 border-slate-200" },
  failed:   { label: "Falhou",     cls: "bg-red-100 text-red-700 border-red-200" },
}
const AI_STATUS = {
  active:    { label: "I.A. ativa",  cls: "bg-sky-100 text-sky-700 border-sky-200" },
  handoff:   { label: "C/ vendedor", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  concluded: { label: "Concluído",   cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  none:      { label: "Aguardando",  cls: "bg-muted text-muted-foreground border-border" },
}
const ENGAGEMENT = {
  interested: { label: "Interessado", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  ignored:    { label: "Ignorou",     cls: "bg-red-100 text-red-700 border-red-200" },
  none:       { label: "—",           cls: "" },
}

// ─── Campaign Detail Dialog ───────────────────────────────────────────────────

function CampaignDetailsDialog({ campaign, open, onClose }: {
  campaign: Campaign; open: boolean; onClose: () => void
}) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "replied" | "read" | "sent" | "failed">("all")

  const filtered = useMemo(() => RECIPIENTS_MOCK.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
                        r.phone.includes(search)
    const matchStatus = statusFilter === "all" || r.status === statusFilter
    return matchSearch && matchStatus
  }), [search, statusFilter])

  const openPct    = pct(campaign.read,      campaign.sent)
  const replyPct   = pct(campaign.replied,   campaign.sent)
  const orcadosPct = pct(campaign.orcados,   campaign.sent)
  const interPct   = pct(campaign.interested,campaign.sent)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[75vw] max-h-[90vh] p-0 border-border bg-background flex flex-col overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border flex flex-row items-start justify-between space-y-0 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={cn(
                "text-[10px] px-2 py-0.5",
                campaign.status === "active"
                  ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                  : "bg-muted text-muted-foreground border border-border"
              )}>
                {campaign.status === "active" ? "Ativa" : "Concluída"}
              </Badge>
              {campaign.type === "AI_ASSISTED" && (
                <Badge className="text-[10px] px-2 py-0.5 bg-sky-100 text-sky-700 border border-sky-200">
                  <Sparkles className="h-2.5 w-2.5 mr-1" />I.A. Assistida
                </Badge>
              )}
            </div>
            <DialogTitle className="text-base font-semibold text-foreground leading-tight">
              {campaign.name}
            </DialogTitle>
            <DialogDescription className="text-[11px] text-muted-foreground mt-0.5">
              {campaign.audience} · Responsável: {campaign.vendor} · Início: {campaign.date}
            </DialogDescription>
          </div>
          <div className="text-right shrink-0 ml-6">
            <p className="text-[10px] text-muted-foreground font-medium">Início</p>
            <p className="text-sm font-semibold text-foreground leading-none mt-1">{campaign.date}</p>
          </div>
        </DialogHeader>

        <div className="flex flex-col flex-1 overflow-hidden min-h-0 p-5 gap-4">
          {/* KPIs */}
          <div className="grid grid-cols-7 gap-3">
            {[
              { label: "Disparados",  value: campaign.sent,            sub: "total enviado",              accentCls: "bg-slate-400",    valueCls: "text-foreground",     icon: Send },
              { label: "Lidos",       value: `${campaign.read} (${openPct}%)`, sub: "taxa de abertura",  accentCls: "bg-blue-500",     valueCls: "text-blue-700",       icon: Eye },
              { label: "Responderam", value: `${campaign.replied} (${replyPct}%)`, sub: "engajamento",   accentCls: "bg-sky-500",      valueCls: "text-sky-700",        icon: MessageSquare },
              { label: "Orçados",     value: `${campaign.orcados} (${orcadosPct}%)`, sub: "cotação enviada", accentCls: "bg-indigo-500", valueCls: "text-indigo-700",   icon: FileText },
              { label: "Interessados",value: `${campaign.interested} (${interPct}%)`, sub: "qualificados",accentCls: "bg-emerald-500", valueCls: "text-emerald-700",    icon: UserCheck },
              { label: "Ignoraram",   value: campaign.ignored,         sub: `${pct(campaign.ignored, campaign.sent)}% taxa`, accentCls: "bg-red-400", valueCls: "text-red-600", icon: UserMinus },
              { label: "Follow-ups",  value: campaign.followups,       sub: `recup. ${campaign.recoveryRate}%`, accentCls: "bg-amber-500", valueCls: "text-amber-700", icon: RefreshCcw },
              { label: "Conversão",   value: `${campaign.salesRate}%`, sub: "lead → venda",               accentCls: "bg-sky-500",      valueCls: "text-sky-700",        icon: ShoppingCart },
            ].map(s => (
              <div key={s.label} className="relative overflow-hidden border border-border rounded-xl bg-card p-3">
                <div className={cn("absolute left-0 top-0 bottom-0 w-[3px]", s.accentCls)} />
                <div className="pl-1">
                  <div className="flex items-start justify-between mb-1.5">
                    <p className="text-[9px] font-medium text-muted-foreground leading-none">{s.label}</p>
                    <s.icon className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                  </div>
                  <p className={cn("text-sm font-bold leading-none", s.valueCls)}>{s.value}</p>
                  <p className="text-[9px] text-muted-foreground mt-1">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Funil visual */}
          <div className="border border-border rounded-xl bg-card p-4">
            <p className="text-[11px] font-semibold text-muted-foreground mb-3">Funil de conversão</p>
            <div className="flex items-center gap-1">
              {[
                { label: "Enviados",    value: campaign.sent,            color: "bg-slate-400",    pct: 100 },
                { label: "Lidos",       value: campaign.read,            color: "bg-blue-500",     pct: openPct },
                { label: "Responderam", value: campaign.replied,         color: "bg-sky-500",      pct: replyPct },
                { label: "Orçados",     value: campaign.orcados,         color: "bg-indigo-500",   pct: orcadosPct },
                { label: "Interessados",value: campaign.interested,      color: "bg-emerald-500",  pct: interPct },
              ].map((step, i) => (
                <div key={step.label} className="flex items-center gap-1 flex-1">
                  {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="h-6 rounded-md overflow-hidden bg-muted">
                      <div
                        className={cn("h-full rounded-md flex items-center px-2 transition-all", step.color)}
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

          {/* Recipient table */}
          <div className="flex-1 flex flex-col border border-border rounded-xl overflow-hidden min-h-0">
            {/* Table header */}
            <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center gap-3 shrink-0">
              <p className="text-[11px] font-semibold text-foreground flex-1">
                Destinatários
                <span className="text-muted-foreground font-normal ml-1.5">({filtered.length} de {RECIPIENTS_MOCK.length})</span>
              </p>
              <div className="flex items-center gap-2">
                {(["all","replied","read","sent","failed"] as const).map(s => (
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
                    {s === "all" ? "Todos" : SEND_STATUS[s].label}
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

            {/* Cols header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-1.5 border-b border-border bg-muted/10 shrink-0">
              {[["col-span-3","Nome"],["col-span-2","Telefone"],["col-span-2","Envio"],["col-span-2","I.A."],["col-span-2","Engajamento"],["col-span-1 text-right","FUPs"]].map(([cls, label]) => (
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
                    "grid grid-cols-12 gap-2 px-4 py-3 items-center transition-colors hover:bg-muted/30 border-b border-border/40",
                    i % 2 === 0 ? "bg-background" : "bg-muted/10"
                  )}
                >
                  <div className="col-span-3 text-[11px] font-medium text-foreground truncate">{r.name}</div>
                  <div className="col-span-2 text-[10px] font-mono text-muted-foreground">{r.phone}</div>
                  <div className="col-span-2">
                    <span className={cn("inline-block text-[9px] font-medium px-1.5 py-0.5 rounded border", SEND_STATUS[r.status].cls)}>
                      {SEND_STATUS[r.status].label}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className={cn("inline-block text-[9px] font-medium px-1.5 py-0.5 rounded border", AI_STATUS[r.ai_status].cls)}>
                      {AI_STATUS[r.ai_status].label}
                    </span>
                  </div>
                  <div className="col-span-2">
                    {r.engagement !== "none" ? (
                      <span className={cn("inline-block text-[9px] font-medium px-1.5 py-0.5 rounded border", ENGAGEMENT[r.engagement].cls)}>
                        {ENGAGEMENT[r.engagement].label}
                      </span>
                    ) : (
                      <span className="text-[9px] text-muted-foreground/50">—</span>
                    )}
                  </div>
                  <div className="col-span-1 text-right">
                    {r.followups > 0 ? (
                      <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold border border-amber-200 ml-auto">
                        {r.followups}
                      </span>
                    ) : (
                      <span className="text-[9px] text-muted-foreground/40">—</span>
                    )}
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
  const orcadosPct = pct(campaign.orcados,   campaign.sent)
  const interPct = pct(campaign.interested,campaign.sent)
  const alert    = needsAttention(campaign)

  return (
    <div className={cn(
      "relative overflow-hidden border rounded-xl bg-card p-4 transition-all hover:border-primary/30",
      alert && campaign.status === "active" ? "border-amber-200" : "border-border"
    )}>
      {/* Left accent */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-[3px]",
        campaign.status === "active" ? "bg-emerald-500" : "bg-slate-300"
      )} />

      <div className="pl-2">
        {/* Row 1: name + badges + action */}
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
                  <Sparkles className="h-2.5 w-2.5" />I.A.
                </span>
              )}
              {alert && campaign.status === "active" && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-amber-100 text-amber-700 border-amber-200 flex items-center gap-1">
                  <AlertTriangle className="h-2.5 w-2.5" />Atenção
                </span>
              )}
            </div>
            <p className="text-[13px] font-semibold text-foreground leading-tight truncate">{campaign.name}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{campaign.audience} · {campaign.date}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <p className="text-[9px] text-muted-foreground">Faturamento</p>
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

        {/* Row 2: Mini funnel */}
        <div className="flex items-center gap-0 text-[10px]">
          {[
            { label: "Enviados",     value: campaign.sent,        rate: null,     dotCls: "bg-slate-400" },
            { label: "Lidos",        value: campaign.read,        rate: openPct,  dotCls: "bg-blue-500"  },
            { label: "Responderam",  value: campaign.replied,     rate: replyPct, dotCls: "bg-sky-500"   },
            { label: "Orçados",      value: campaign.orcados,     rate: orcadosPct, dotCls: "bg-indigo-500" },
            { label: "Interessados", value: campaign.interested,  rate: interPct, dotCls: "bg-emerald-500" },
            { label: "FUPs",         value: campaign.followups,   rate: null,     dotCls: "bg-amber-500" },
          ].map((step, i) => (
            <div key={step.label} className="flex items-center gap-0">
              {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/30 mx-1" />}
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1">
                  <span className={cn("w-1.5 h-1.5 rounded-full", step.dotCls)} />
                  <span className="font-bold text-foreground">{step.value}</span>
                  {step.rate !== null && (
                    <span className="text-muted-foreground">({step.rate}%)</span>
                  )}
                </div>
                <span className="text-[9px] text-muted-foreground">{step.label}</span>
              </div>
            </div>
          ))}

          {/* Recovery rate + conversion */}
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

export default function CampaignsPage() {
  const [newCampaignOpen, setNewCampaignOpen]   = useState(false)
  const [detailCampaign, setDetailCampaign]     = useState<Campaign | null>(null)
  const [search, setSearch]                     = useState("")
  const [statusFilter, setStatusFilter]         = useState<"all" | "active" | "completed">("all")

  const mockVendedores = [
    { id: "1", name: "Rodrigo Silva" },
    { id: "2", name: "Ana Beatriz" },
    { id: "3", name: "Marcos Oliveira" },
  ]
  const mockSelectedClients = [
    { id: "1", nomeSindico: "Eduardo Carvalho", telefoneSindico: "(21) 98877-6655" },
    { id: "2", nomeSindico: "Fabiana Monteiro", telefoneSindico: "(21) 97766-5544" },
    { id: "3", nomeSindico: "Roberto Alves",    telefoneSindico: "(21) 96655-4433" },
  ]

  const filtered = useMemo(() => CAMPAIGNS.filter(c => {
    const matchStatus = statusFilter === "all" || c.status === statusFilter
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                        c.audience.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  }), [statusFilter, search])

  const totalSent     = CAMPAIGNS.reduce((s, c) => s + c.sent, 0)
  const totalRevenue  = CAMPAIGNS.reduce((s, c) => s + c.revenue, 0)
  const avgReply      = Math.round(CAMPAIGNS.reduce((s, c) => s + pct(c.replied, c.sent), 0) / CAMPAIGNS.length)
  const avgRecovery   = (CAMPAIGNS.reduce((s, c) => s + c.recoveryRate, 0) / CAMPAIGNS.length).toFixed(1)
  const alertCount    = CAMPAIGNS.filter(c => c.status === "active" && needsAttention(c)).length

  return (
    <DashboardLayout>
      <div className="space-y-4">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Campanhas</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Monitoramento de disparos, engajamento e retorno por I.A.
              {alertCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-medium">
                  <AlertTriangle className="h-3 w-3" />{alertCount} campanha{alertCount > 1 ? "s" : ""} precisam de atenção
                </span>
              )}
            </p>
          </div>
          <Button
            onClick={() => setNewCampaignOpen(true)}
            className="h-8 px-4 text-xs font-medium gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Megaphone className="h-3.5 w-3.5" />
            Nova Campanha
          </Button>
        </div>

        {/* ── KPI Strip ── */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total de Disparos",  value: totalSent.toLocaleString("pt-BR"), sub: `${CAMPAIGNS.length} campanhas`, icon: Send,         accentCls: "bg-slate-400",    iconCls: "text-slate-500"   },
            { label: "Taxa Média Resposta",value: `${avgReply}%`,                     sub: "engajamento médio",              icon: MessageSquare, accentCls: "bg-sky-500",      iconCls: "text-sky-500"     },
            { label: "Recuperação FUP",    value: `${avgRecovery}%`,                  sub: "média entre campanhas",          icon: RefreshCcw,    accentCls: "bg-amber-500",    iconCls: "text-amber-500"   },
            { label: "Faturamento Gerado", value: fmtCurrency(totalRevenue),          sub: "todas as campanhas",             icon: DollarSign,    accentCls: "bg-emerald-500",  iconCls: "text-emerald-500" },
          ].map(s => (
            <Card key={s.label} className="relative overflow-hidden border-border bg-card">
              <div className={cn("absolute left-0 top-0 bottom-0 w-[3px]", s.accentCls)} />
              <CardContent className="p-3 pl-4">
                <div className="flex items-start justify-between mb-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground leading-none">{s.label}</p>
                  <s.icon className={cn("h-3.5 w-3.5 shrink-0", s.iconCls)} />
                </div>
                <p className="text-xl font-bold text-foreground leading-none">{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-1.5">{s.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Filters + List ── */}
        <Card className="border-border bg-card">
          <CardHeader className="px-5 pt-4 pb-3 border-b border-border flex flex-row items-center gap-3 space-y-0">
            <CardTitle className="text-sm font-semibold text-foreground flex-1">Campanhas</CardTitle>

            {/* Status filter */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border">
              {(["all","active","completed"] as const).map(s => (
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

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar campanha..."
                className="h-7 pl-8 pr-3 text-[11px] bg-muted/60 border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary/30 w-48"
              />
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-3">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Megaphone className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Nenhuma campanha encontrada</p>
              </div>
            ) : (
              filtered.map(campaign => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onAnalyze={() => setDetailCampaign(campaign)}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail dialog */}
      {detailCampaign && (
        <CampaignDetailsDialog
          campaign={detailCampaign}
          open={!!detailCampaign}
          onClose={() => setDetailCampaign(null)}
        />
      )}

      <CampaignDialog
        open={newCampaignOpen}
        onClose={() => setNewCampaignOpen(false)}
        selectedCount={120}
        selectedClients={mockSelectedClients}
        vendedores={mockVendedores}
      />
    </DashboardLayout>
  )
}
