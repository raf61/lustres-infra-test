"use client"

import { useState, useMemo } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Megaphone, Users, MessageSquare, CheckCircle, 
  ArrowUpRight, Clock, User, Zap, Eye, MousePointer2,
  TrendingUp, Activity, Filter, Search, MoreVertical,
  Calendar, CheckCircle2, AlertCircle, Sparkles,
  RefreshCcw, ChevronRight, Pause, Play, Square,
  Mail, Phone, ExternalLink, ArrowRight, Bot,
  TrendingDown, Info, BarChart3, Settings2, SlidersHorizontal,
  DollarSign, ListFilter, Trash2, Send, Laptop, ShoppingCart,
  MinusCircle, Heart, UserMinus, UserCheck, BarChart
} from "lucide-react"
import { cn } from "@/lib/utils"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { CampaignDialog } from "@/components/leads/campaign-dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

// ============================================================================
// MOCKS SÓBRIOS & AMPLIADOS
// ============================================================================

const GEN_200_RECIPIENTS = () => {
  return Array.from({ length: 200 }, (_, i) => ({
    id: String(i + 1),
    name: `Síndico Exemplo ${i + 1}`,
    phone: `(11) 9${Math.floor(Math.random() * 90000000 + 10000000)}`,
    status: ["replied", "read", "sent", "failed"][Math.floor(Math.random() * 4)],
    ai_status: ["active", "handoff", "concluded", "none"][Math.floor(Math.random() * 4)],
    vendor: ["Rodrigo Silva", "Ana Beatriz", "Marcos Oliveira"][Math.floor(Math.random() * 3)],
    followups: Math.floor(Math.random() * 3),
    engagement: ["interested", "ignored", "none"][Math.floor(Math.random() * 3)]
  }))
}

const RECIPIENTS_MOCK = GEN_200_RECIPIENTS()

const CAMPAIGNS_MOCK = [
  {
    id: "1",
    name: "Recuperação de Orçamentos - Março",
    status: "active",
    type: "AI_ASSISTED",
    sent: 1250,
    read: 980,
    replied: 420,
    interested: 280,
    ignored: 140,
    followups: 340,
    revenue: "R$ 142.500",
    recoveryRate: "27.2%",
    salesRate: "12.5%",
    date: "12/03/2024",
    vendor: "Rodrigo Silva",
    progress: 78,
    audience: "Clientes com orçamento em aberto"
  },
  {
    id: "2",
    name: "Reativação Base Inativa 2023",
    status: "completed",
    type: "STANDARD",
    sent: 3400,
    read: 2100,
    replied: 150,
    interested: 45,
    ignored: 105,
    followups: 0,
    revenue: "R$ 48.200",
    recoveryRate: "8.5%",
    salesRate: "3.2%",
    date: "05/03/2024",
    vendor: "Ana Beatriz",
    progress: 100,
    audience: "Inativos há mais de 180 dias"
  },
  {
    id: "3",
    name: "Lançamento: Coleção Cristal Italiana",
    status: "active",
    type: "AI_ASSISTED",
    sent: 850,
    read: 720,
    replied: 310,
    interested: 210,
    ignored: 100,
    followups: 120,
    revenue: "R$ 89.900",
    recoveryRate: "22.1%",
    salesRate: "18.4%",
    date: "18/03/2024",
    vendor: "Marcos Oliveira",
    progress: 45,
    audience: "Base de alto ticket"
  },
  {
    id: "4",
    name: "Programa de Parceria: Arquitetos",
    status: "active",
    type: "AI_ASSISTED",
    sent: 420,
    read: 380,
    replied: 190,
    interested: 145,
    ignored: 45,
    followups: 85,
    revenue: "R$ 215.000",
    recoveryRate: "34.5%",
    salesRate: "22.1%",
    date: "20/03/2024",
    vendor: "Rodrigo Silva",
    progress: 30,
    audience: "Arquitetos e Decoradores"
  },
  {
    id: "5",
    name: "Promoção Relâmpago: Leds Blindados",
    status: "completed",
    type: "STANDARD",
    sent: 1800,
    read: 1540,
    replied: 340,
    interested: 180,
    ignored: 160,
    followups: 150,
    revenue: "R$ 62.300",
    recoveryRate: "19.8%",
    salesRate: "9.2%",
    date: "10/03/2024",
    vendor: "Ana Beatriz",
    progress: 100,
    audience: "Condomínios em área litorânea"
  },
]

// ============================================================================
// COMPONENTE: DETALHES DA CAMPANHA (DIÁLOGO AMPLIADO)
// ============================================================================

function CampaignDetailsDialog({ campaign }: { campaign: typeof CAMPAIGNS_MOCK[0] }) {
  return (
    <DialogContent className="sm:max-w-[70vw] max-h-[95vh] p-0 border-border shadow-2xl bg-background flex flex-col overflow-hidden">
      <DialogHeader className="p-6 border-b border-border bg-muted/20 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-600/10 rounded-xl flex items-center justify-center border border-blue-600/20 shadow-sm">
            <Bot className="h-7 w-7 text-blue-600" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold tracking-tight">{campaign.name}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-0.5">
              Público: {campaign.audience} • {campaign.type === 'AI_ASSISTED' ? 'Campanha Assistida' : 'Disparo Padrão'}
            </DialogDescription>
          </div>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div className="space-y-0.5">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none">Faturamento Realizado</p>
            <p className="text-2xl font-black text-blue-600 leading-none mt-1">{campaign.revenue}</p>
          </div>
        </div>
      </DialogHeader>

      <div className="p-6 flex flex-col flex-1 overflow-hidden min-h-0">
         {/* Métricas Principais - Estilo Dash Master */}
        <div className="grid grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
           {[
             { label: "Disparos", val: campaign.sent, sub: "Sucesso", color: "text-foreground", icon: Send },
             { label: "Abertura", val: `${Math.round((campaign.read / campaign.sent) * 100)}%`, sub: `${campaign.read} lidos`, color: "text-blue-600", icon: Eye },
             { label: "Interessados", val: campaign.interested, sub: `${Math.round((campaign.interested / campaign.sent) * 100)}% taxa`, color: "text-emerald-600", icon: UserCheck },
             { label: "Ignorados", val: campaign.ignored, sub: `${Math.round((campaign.ignored / campaign.sent) * 100)}% taxa`, color: "text-red-500", icon: UserMinus },
             { label: "Recup. FUP", val: campaign.recoveryRate, sub: `${campaign.followups} FUPs`, color: "text-amber-600", icon: RefreshCcw },
             { label: "Vendas OK", val: `${Math.round((campaign.salesRate).replace('%',''))}%`, sub: "Conversão", color: "text-blue-700", icon: ShoppingCart },
             { label: "Resultado", val: campaign.revenue, sub: "Vendas", color: "text-emerald-700", icon: DollarSign },
           ].map((s, i) => (
             <div key={i} className="bg-muted/10 border border-border p-3.5 rounded-xl flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                   <s.icon className="h-3.5 w-3.5 text-muted-foreground/50" />
                   <div className="w-1.5 h-1.5 rounded-full bg-blue-500/30" />
                </div>
                <div>
                   <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">{s.label}</p>
                   <p className={cn("text-base font-black leading-none mt-1", s.color)}>{s.val}</p>
                   <p className="text-[9px] font-bold text-muted-foreground/70 mt-1">{s.sub}</p>
                </div>
             </div>
           ))}
        </div>

        {/* Listagem de Destinatários e Histórico */}
        <div className="flex-1 flex flex-col border border-border rounded-xl overflow-hidden bg-background divide-y divide-border min-h-0 shadow-sm">
          <div className="bg-muted/10 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h4 className="text-sm font-bold text-foreground">Interface de Monitoramento</h4>
              <Badge variant="outline" className="text-[10px] bg-background font-black border-border">{RECIPIENTS_MOCK.length} TOTAL</Badge>
            </div>
            <div className="flex gap-2">
                <Search className="h-4 w-4 text-muted-foreground self-center" />
                <Input placeholder="Filtrar..." className="h-7 w-32 text-xs" />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <Table>
              <TableHeader className="bg-muted/5 sticky top-0 z-10 backdrop-blur-sm">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground h-10 pl-6">Síndico</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground h-10">WhatsApp</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground h-10">Envio</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground h-10">IA Status</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground h-10">Lead Status</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground h-10 pr-6">Follow-up</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {RECIPIENTS_MOCK.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/20 border-border/50 h-10 transition-colors">
                    <TableCell className="py-2 pl-6 text-[12px] font-bold text-foreground">{r.name}</TableCell>
                    <TableCell className="py-2 text-[11px] font-mono text-muted-foreground">{r.phone}</TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          r.status === 'replied' ? "bg-emerald-500" :
                            r.status === 'read' ? "bg-blue-500" :
                              r.status === 'sent' ? "bg-slate-400" : "bg-red-500"
                        )} />
                        <span className="text-[10px] font-bold uppercase">{r.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      {r.ai_status === 'active' && <Badge className="bg-blue-600 text-white text-[9px] font-bold px-2 h-4.5 rounded">FALANDO</Badge>}
                      {r.ai_status === 'none' && <span className="text-[9px] text-muted-foreground">AGUARDANDO</span>}
                      {r.ai_status === 'handoff' && <Badge className="bg-amber-500 text-white text-[9px] font-bold px-2 h-4.5 rounded">HUMANO</Badge>}
                       {r.ai_status === 'concluded' && <Badge className="bg-emerald-600 text-white text-[9px] font-bold px-2 h-4.5 rounded">CONCLUÍDO</Badge>}
                    </TableCell>
                    <TableCell className="py-2">
                       {r.engagement === 'interested' && <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-[9px] font-black">INTERESSADO</Badge>}
                       {r.engagement === 'ignored' && <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-[9px] font-black">IGNORADO</Badge>}
                       {r.engagement === 'none' && <span className="text-[9px] text-muted-foreground font-bold italic">Sem Retorno</span>}
                    </TableCell>
                    <TableCell className="py-2 text-right pr-6">
                       <div className="flex justify-end gap-1">
                          {Array.from({ length: r.followups }).map((_, i) => (
                             <div key={i} className="w-2 h-2 rounded-full bg-amber-500" />
                          ))}
                          {r.followups === 0 && <span className="text-[9px] text-muted-foreground">Nenhum</span>}
                       </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </div>
    </DialogContent>
  )
}

// ============================================================================
// COMPONENTE PRINCIPAL: PÁGINA DE CAMPANHAS
// ============================================================================

export default function CampaignsPage() {
  const [newCampaignOpen, setNewCampaignOpen] = useState(false)
  const [filterPeriod, setFilterPeriod] = useState("mês")

  const mockVendedores = [
    { id: "1", name: "Rodrigo Silva" },
    { id: "2", name: "Ana Beatriz" },
    { id: "3", name: "Marcos Oliveira" },
  ]

  const mockSelectedClients = [
    { id: "1", nomeSindico: "Síndico Eduardo", telefoneSindico: "(11) 98877-6655" },
    { id: "2", nomeSindico: "Síndico Fabiana", telefoneSindico: "(11) 97766-5544" },
    { id: "3", nomeSindico: "Síndico Roberto", telefoneSindico: "(11) 96655-4433" },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* HEADER SÓBRIO - IGUAL PEDIDOS */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Megaphone className="h-6 w-6 text-blue-600" />
              Monitoramento de Campanhas
            </h1>
            <p className="text-sm text-muted-foreground">Relatório de marketing assistido por inteligência artificial e follow-ups</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setNewCampaignOpen(true)}
              className="h-9 px-5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-widest shadow-sm gap-2 transition-all active:scale-95"
            >
              <Send className="h-4 w-4" />
              Nova Campanha
            </Button>
          </div>
        </div>

        {/* FILTROS E MÉTRICAS RÁPIDAS */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Envios", value: "8.420", icon: Send, color: "text-foreground", sub: "+12.5% vs mês ant." },
            { label: "Taxa de Resposta", value: "31.4%", icon: MessageSquare, color: "text-blue-600", sub: "Média de 35% por I.A." },
            { label: "Recuperação FUP", value: "27.2%", icon: RefreshCcw, color: "text-amber-600", sub: "Após o 2º contato" },
            { label: "Vendas Diretas", value: "R$ 557.900", icon: TrendingUp, color: "text-emerald-600", sub: "Faturamento gerado" },
          ].map((stat, i) => (
            <Card key={i} className="border-border shadow-sm bg-card transition-all hover:bg-muted/5">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                  <p className={cn("text-2xl font-black mt-1.5 leading-none", stat.color)}>{stat.value}</p>
                  <p className="text-[10px] font-medium text-muted-foreground mt-2">{stat.sub}</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border border-border shadow-inner">
                  <stat.icon className="h-5 w-5 text-muted-foreground/60" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* LISTA DE CAMPANHAS */}
        <Card className="border-border shadow-sm overflow-hidden bg-card">
          <CardHeader className="bg-muted/20 border-b border-border py-4 px-6 flex flex-row items-center justify-between gap-4 space-y-0">
            <div className="flex items-center gap-4">
              <h3 className="text-sm font-bold text-foreground">Campanhas em Análise</h3>
              <div className="flex bg-background border border-border p-0.5 rounded-lg shadow-inner">
                {["Mês", "Semana", "Dia"].map(t => (
                  <button
                    key={t}
                    onClick={() => setFilterPeriod(t.toLowerCase())}
                    className={cn(
                      "px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all",
                      filterPeriod === t.toLowerCase() ? "bg-white text-foreground shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-blue-600 transition-colors" />
              <input placeholder="Buscar campanha na base..." className="pl-9 h-9 bg-background border border-border rounded-lg text-[11px] font-medium w-72 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all" />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow className="hover:bg-transparent h-11">
                  <TableHead className="w-16 pl-6"></TableHead>
                  <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Campanha / Público</TableHead>
                  <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Status</TableHead>
                  <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Engajamento</TableHead>
                  <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Faturamento Gerado</TableHead>
                  <TableHead className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Início</TableHead>
                  <TableHead className="text-right text-[11px] font-black uppercase tracking-widest text-muted-foreground pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {CAMPAIGNS_MOCK.map((camp) => (
                  <TableRow key={camp.id} className="hover:bg-muted/20 h-20 group transition-colors">
                    <TableCell className="pl-6">
                      <div className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center border transition-all shadow-sm",
                        camp.status === 'active' ? "bg-blue-50 border-blue-200 text-blue-600 group-hover:bg-blue-600 group-hover:text-white" : "bg-muted border-border text-muted-foreground"
                      )}>
                        <Megaphone className="h-5 w-5" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="text-[13px] font-black text-foreground">{camp.name}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] font-bold px-1.5 h-4 bg-background border-border text-muted-foreground">
                            {camp.audience}
                          </Badge>
                          {camp.type === 'AI_ASSISTED' && <Sparkles className="h-3 w-3 text-blue-500" />}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full animate-pulse",
                          camp.status === 'active' ? "bg-emerald-500" : "bg-slate-300"
                        )} />
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-wider",
                          camp.status === 'active' ? "text-emerald-700" : "text-slate-500"
                        )}>
                          {camp.status === 'active' ? 'Ativa' : 'Finalizada'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="w-40 space-y-1.5">
                        <div className="flex justify-between text-[10px] font-black text-muted-foreground uppercase tracking-tight">
                          <span>{camp.sent} envios</span>
                          <span>{camp.progress}%</span>
                        </div>
                        <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="absolute top-0 left-0 h-full bg-blue-600 transition-all duration-1000"
                            style={{ width: `${camp.progress}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="text-sm font-black text-blue-600 leading-none">{camp.revenue}</p>
                        <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                          FUP: {camp.recoveryRate} <TrendingUp className="h-3 w-3" />
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-bold text-muted-foreground">{camp.date}</TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 px-4 text-[10px] font-black uppercase tracking-widest gap-2 border-border shadow-sm hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all" title="Analisar Campanha">
                              <BarChart className="h-3.5 w-3.5" /> Analisar
                            </Button>
                          </DialogTrigger>
                          <CampaignDetailsDialog campaign={camp} />
                        </Dialog>
                        <Button variant="outline" size="icon" className="h-9 w-9 text-muted-foreground hover:text-red-600 border-border hover:bg-red-50 hover:border-red-100 transition-all">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      </div>

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
