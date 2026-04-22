"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Users, Shield, Clock, AlertTriangle, Search, Bot, User, X } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientType = "PF" | "PJ"
type ClientStatus = "Ativo" | "Renovando" | "Inativo" | "Em cotação"
type InteracaoType = "IA" | "Humano"

interface Cliente {
  id: string
  nome: string
  tipo: ClientType
  cnpj?: string
  seguro: string
  seguradora: string
  vencimento: string
  premio: string
  status: ClientStatus
  ultimaInteracao: string
  tipoInteracao: InteracaoType
  scoreIA: number
  // Detail fields
  email?: string
  telefone: string
  apolice?: string
  historico?: string[]
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const CLIENTES: Cliente[] = [
  {
    id: "1", nome: "Carlos Eduardo Mendes", tipo: "PF", seguro: "Auto", seguradora: "HDI Seguros",
    vencimento: "30/06/2026", premio: "R$ 247/mês", status: "Em cotação", scoreIA: 87,
    ultimaInteracao: "Hoje 14:09", tipoInteracao: "IA",
    telefone: "(11) 9 9876-5432", email: "carlos.mendes@gmail.com",
    apolice: "HDI-2026-00142",
    historico: ["14:09 — IA transferiu para corretor Rodrigo", "14:06 — Sofia consultou 5 seguradoras", "14:02 — Lead entrou via WhatsApp"],
  },
  {
    id: "2", nome: "Metalúrgica Soares Ltda", tipo: "PJ", cnpj: "12.345.678/0001-99",
    seguro: "Empresarial", seguradora: "Mapfre",
    vencimento: "15/05/2026", premio: "R$ 4.200/mês", status: "Renovando", scoreIA: 74,
    ultimaInteracao: "Hoje 14:28", tipoInteracao: "IA",
    telefone: "(11) 3456-7890", email: "financeiro@soares.com.br",
    apolice: "MAP-EMP-2025-8847",
    historico: ["14:28 — Sofia coletando dados para renovação", "30/03 — Renovação iniciada automaticamente"],
  },
  {
    id: "3", nome: "Fernanda Lima", tipo: "PF", seguro: "Residencial", seguradora: "HDI Seguros",
    vencimento: "12/08/2026", premio: "R$ 89/mês", status: "Ativo", scoreIA: 62,
    ultimaInteracao: "Hoje 14:19", tipoInteracao: "IA",
    telefone: "(21) 9 8765-4321",
    historico: ["14:19 — Proposta aceita · Apólice emitida", "14:15 — Sofia enviou cotações"],
  },
  {
    id: "4", nome: "TecnoFlex Indústria Ltda", tipo: "PJ", cnpj: "55.678.901/0001-23",
    seguro: "Saúde Coletiva", seguradora: "Bradesco Seguros",
    vencimento: "01/04/2026", premio: "R$ 14.800/mês", status: "Renovando", scoreIA: 91,
    ultimaInteracao: "Ontem 16:00", tipoInteracao: "Humano",
    telefone: "(11) 4567-8901",
    apolice: "BRAD-SC-2025-4420",
    historico: ["Ontem — Corretor Rodrigo enviou proposta de renovação", "28/03 — Sofia disparou follow-up D30"],
  },
  {
    id: "5", nome: "Ricardo Alves", tipo: "PF", seguro: "Auto", seguradora: "Porto Seguro",
    vencimento: "20/07/2026", premio: "R$ 312/mês", status: "Ativo", scoreIA: 55,
    ultimaInteracao: "Ontem 13:55", tipoInteracao: "IA",
    telefone: "(11) 9 7654-3210",
    historico: ["13:55 — Em negociação com corretor", "13:30 — Sofia qualificou e cotou"],
  },
  {
    id: "6", nome: "Agropecuária Horizonte Ltda", tipo: "PJ", cnpj: "91.234.567/0001-88",
    seguro: "Empresarial / RC", seguradora: "Allianz",
    vencimento: "30/09/2026", premio: "R$ 9.600/mês", status: "Em cotação", scoreIA: 83,
    ultimaInteracao: "Hoje 13:28", tipoInteracao: "Humano",
    telefone: "(11) 3789-0123",
    historico: ["13:28 — Proposta Allianz enviada ao corretor Marcos"],
  },
  {
    id: "7", nome: "Juliana Costa", tipo: "PF", seguro: "Vida", seguradora: "SulAmérica",
    vencimento: "11/04/2026", premio: "R$ 198/mês", status: "Renovando", scoreIA: 78,
    ultimaInteracao: "07/04 09:00", tipoInteracao: "IA",
    telefone: "(21) 9 6543-2109",
    historico: ["09:00 — Follow-up D30 disparado pela Sofia", "07/03 — Follow-up D60 enviado"],
  },
  {
    id: "8", nome: "Logística Meridian Ltda", tipo: "PJ", cnpj: "42.345.678/0001-11",
    seguro: "Frota (8 veíc.)", seguradora: "Tokio Marine",
    vencimento: "01/03/2027", premio: "R$ 12.800/mês", status: "Ativo", scoreIA: 95,
    ultimaInteracao: "Hoje 13:15", tipoInteracao: "Humano",
    telefone: "(11) 3890-1234",
    apolice: "TM-FROTA-2026-0088",
    historico: ["13:15 — Apólice emitida · Frota 8 veículos Tokio Marine"],
  },
  {
    id: "9", nome: "Amanda Pereira", tipo: "PF", seguro: "Auto", seguradora: "HDI Seguros",
    vencimento: "15/03/2027", premio: "R$ 380/mês", status: "Ativo", scoreIA: 69,
    ultimaInteracao: "06/04 11:20", tipoInteracao: "IA",
    telefone: "(21) 9 5432-1098",
  },
  {
    id: "10", nome: "Construtora Vega S.A.", tipo: "PJ", cnpj: "78.901.234/0001-56",
    seguro: "RC / Patrimonial", seguradora: "Allianz",
    vencimento: "30/06/2026", premio: "R$ 8.200/mês", status: "Em cotação", scoreIA: 76,
    ultimaInteracao: "Hoje 13:41", tipoInteracao: "IA",
    telefone: "(11) 3901-2345",
    historico: ["13:41 — Sofia consultando Allianz, Mapfre, SulAmérica"],
  },
  {
    id: "11", nome: "Eduardo Rocha", tipo: "PF", seguro: "Vida", seguradora: "—",
    vencimento: "—", premio: "—", status: "Inativo", scoreIA: 41,
    ultimaInteracao: "06/04 08:00", tipoInteracao: "IA",
    telefone: "(11) 9 4321-0987",
    historico: ["06/04 — Reativado pela jornada D180 · Aguardando resposta"],
  },
  {
    id: "12", nome: "Marcelo Ferreira", tipo: "PF", seguro: "Residencial", seguradora: "HDI Seguros",
    vencimento: "14/04/2026", premio: "R$ 124/mês", status: "Renovando", scoreIA: 82,
    ultimaInteracao: "07/04 08:30", tipoInteracao: "IA",
    telefone: "(21) 9 3210-9876",
    historico: ["08:30 — Follow-up D7 enviado · Apólice vence em 7 dias"],
  },
  {
    id: "13", nome: "Distribuidora Pareto Ltda", tipo: "PJ", cnpj: "34.567.890/0001-44",
    seguro: "Empresarial", seguradora: "Porto Seguro",
    vencimento: "30/05/2026", premio: "R$ 6.400/mês", status: "Ativo", scoreIA: 67,
    ultimaInteracao: "05/04 14:00", tipoInteracao: "Humano",
    telefone: "(11) 3012-3456",
  },
  {
    id: "14", nome: "Patrícia Souza", tipo: "PF", seguro: "Auto", seguradora: "Porto Seguro",
    vencimento: "05/05/2026", premio: "R$ 312/mês", status: "Renovando", scoreIA: 73,
    ultimaInteracao: "Hoje 09:30", tipoInteracao: "IA",
    telefone: "(11) 9 2109-8765",
    historico: ["09:30 — Follow-up D28 enviado"],
  },
  {
    id: "15", nome: "Larissa Nunes", tipo: "PF", seguro: "Saúde", seguradora: "Bradesco Seguros",
    vencimento: "22/04/2026", premio: "R$ 876/mês", status: "Renovando", scoreIA: 88,
    ultimaInteracao: "Hoje 08:00", tipoInteracao: "IA",
    telefone: "(21) 9 1098-7654",
    historico: ["08:00 — Follow-up D15 enviado · Risco de churn identificado"],
  },
  {
    id: "16", nome: "Tatiana Correia", tipo: "PF", seguro: "Vida", seguradora: "SulAmérica",
    vencimento: "10/10/2026", premio: "R$ 520/mês", status: "Ativo", scoreIA: 58,
    ultimaInteracao: "03/04 10:00", tipoInteracao: "IA",
    telefone: "(11) 9 0987-6543",
  },
  {
    id: "17", nome: "Thiago Gomes", tipo: "PF", seguro: "Auto", seguradora: "—",
    vencimento: "—", premio: "—", status: "Inativo", scoreIA: 32,
    ultimaInteracao: "01/04 08:00", tipoInteracao: "IA",
    telefone: "(21) 9 8901-2345",
    historico: ["01/04 — Jornada reativação iniciada · Inativo há 210 dias"],
  },
  {
    id: "18", nome: "Transpetro Serviços Ltda", tipo: "PJ", cnpj: "67.890.123/0001-77",
    seguro: "Frota (12 veíc.) / RC", seguradora: "Liberty Seguros",
    vencimento: "15/08/2026", premio: "R$ 18.400/mês", status: "Ativo", scoreIA: 89,
    ultimaInteracao: "04/04 16:00", tipoInteracao: "Humano",
    telefone: "(11) 3123-4567",
    apolice: "LIB-FROTA-2026-0234",
  },
  {
    id: "19", nome: "Bruno Teixeira", tipo: "PF", seguro: "Auto", seguradora: "Mapfre",
    vencimento: "19/04/2026", premio: "R$ 342/mês", status: "Renovando", scoreIA: 80,
    ultimaInteracao: "Hoje 08:00", tipoInteracao: "IA",
    telefone: "(11) 9 7890-1234",
    historico: ["08:00 — Follow-up D12 · Apólice vence em 12 dias"],
  },
  {
    id: "20", nome: "Gustavo Barbosa", tipo: "PF", seguro: "Auto", seguradora: "HDI Seguros",
    vencimento: "01/09/2026", premio: "R$ 290/mês", status: "Em cotação", scoreIA: 65,
    ultimaInteracao: "Hoje 14:00", tipoInteracao: "IA",
    telefone: "(21) 9 6789-0123",
    historico: ["14:00 — Cotação em andamento"],
  },
]

const STATUS_CONFIG: Record<ClientStatus, { cls: string; dot: string }> = {
  "Ativo":      { cls: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  "Renovando":  { cls: "bg-amber-100 text-amber-700 border-amber-200",       dot: "bg-amber-500" },
  "Inativo":    { cls: "bg-slate-100 text-slate-600 border-slate-200",       dot: "bg-slate-400" },
  "Em cotação": { cls: "bg-sky-100 text-sky-700 border-sky-200",             dot: "bg-sky-500" },
}

const TIPO_BADGE: Record<ClientType, string> = {
  PF: "bg-slate-100 text-slate-700 border-slate-200",
  PJ: "bg-violet-100 text-violet-700 border-violet-200",
}

type FilterKey = "todos" | "PF" | "PJ" | "renovando" | "inativos" | "prioridade"

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "todos",      label: "Todos" },
  { key: "PF",         label: "PF" },
  { key: "PJ",         label: "PJ" },
  { key: "renovando",  label: "Renovando em 30d" },
  { key: "inativos",   label: "Inativos" },
  { key: "prioridade", label: "Alta Prioridade" },
]

// ─── Client Side Panel ────────────────────────────────────────────────────────

function ClientPanel({ cliente, onClose }: { cliente: Cliente; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[85vh] p-0 border-border bg-background flex flex-col overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b border-border flex flex-row items-start gap-3 space-y-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border", TIPO_BADGE[cliente.tipo])}>
                {cliente.tipo}
              </span>
              <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded border", STATUS_CONFIG[cliente.status].cls)}>
                {cliente.status}
              </span>
            </div>
            <DialogTitle className="text-sm font-semibold text-foreground">{cliente.nome}</DialogTitle>
            {cliente.cnpj && <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{cliente.cnpj}</p>}
          </div>
          {/* Score */}
          <div className="flex flex-col items-center shrink-0">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center border-2",
              cliente.scoreIA >= 75 ? "border-emerald-400 bg-emerald-50" : cliente.scoreIA >= 50 ? "border-amber-400 bg-amber-50" : "border-slate-300 bg-slate-50"
            )}>
              <span className={cn("text-sm font-bold", cliente.scoreIA >= 75 ? "text-emerald-700" : cliente.scoreIA >= 50 ? "text-amber-700" : "text-slate-600")}>
                {cliente.scoreIA}
              </span>
            </div>
            <span className="text-[9px] text-muted-foreground mt-0.5">Score IA</span>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-5">
            {/* Contact */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Contato</p>
              {[
                { label: "WhatsApp", value: cliente.telefone },
                ...(cliente.email ? [{ label: "E-mail", value: cliente.email }] : []),
              ].map(f => (
                <div key={f.label} className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{f.label}</span>
                  <span className="text-[11px] font-medium text-foreground">{f.value}</span>
                </div>
              ))}
            </div>

            {/* Policy */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Apólice Atual</p>
              {[
                { label: "Seguro",      value: cliente.seguro },
                { label: "Seguradora",  value: cliente.seguradora },
                { label: "Vencimento",  value: cliente.vencimento },
                { label: "Prêmio",      value: cliente.premio },
                ...(cliente.apolice ? [{ label: "Nº Apólice", value: cliente.apolice }] : []),
              ].map(f => (
                <div key={f.label} className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{f.label}</span>
                  <span className="text-[11px] font-medium text-foreground">{f.value}</span>
                </div>
              ))}
            </div>

            {/* IA log */}
            {cliente.historico && cliente.historico.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Log de Interações</p>
                <div className="space-y-1.5">
                  {cliente.historico.map((h, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/40 border border-border">
                      <Bot className="h-3 w-3 text-sky-500 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-foreground leading-snug">{h}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next actions */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Próximas Ações IA</p>
              {cliente.status === "Renovando" ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-[11px] font-semibold text-amber-800">Jornada de renovação ativa</p>
                  <p className="text-[10px] text-amber-600 mt-0.5">Sofia irá intensificar contatos até o vencimento</p>
                </div>
              ) : cliente.status === "Inativo" ? (
                <div className="p-3 rounded-xl bg-violet-50 border border-violet-200">
                  <p className="text-[11px] font-semibold text-violet-800">Jornada de reativação em andamento</p>
                  <p className="text-[10px] text-violet-600 mt-0.5">3 mensagens programadas nos próximos 15 dias</p>
                </div>
              ) : cliente.status === "Em cotação" ? (
                <div className="p-3 rounded-xl bg-sky-50 border border-sky-200">
                  <p className="text-[11px] font-semibold text-sky-800">Aguardando retorno do cliente</p>
                  <p className="text-[10px] text-sky-600 mt-0.5">Follow-up automático em 24h se não responder</p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <p className="text-[11px] font-semibold text-emerald-800">Cliente ativo — sem ação urgente</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">Jornada de renovação será iniciada 90 dias antes do vencimento</p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientesPage() {
  const [filter, setFilter] = useState<FilterKey>("todos")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Cliente | null>(null)

  const filtered = useMemo(() => {
    return CLIENTES.filter(c => {
      const matchSearch = c.nome.toLowerCase().includes(search.toLowerCase()) ||
                          (c.cnpj?.includes(search) ?? false) ||
                          c.seguradora.toLowerCase().includes(search.toLowerCase())

      const matchFilter =
        filter === "todos" ? true :
        filter === "PF" ? c.tipo === "PF" :
        filter === "PJ" ? c.tipo === "PJ" :
        filter === "renovando" ? c.status === "Renovando" :
        filter === "inativos" ? c.status === "Inativo" :
        filter === "prioridade" ? c.scoreIA >= 75 : true

      return matchSearch && matchFilter
    })
  }, [filter, search])

  const totalAtivos   = CLIENTES.filter(c => c.status === "Ativo").length
  const totalRenov    = CLIENTES.filter(c => c.status === "Renovando").length
  const totalInativos = CLIENTES.filter(c => c.status === "Inativo").length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Base de Clientes</h1>
        <p className="text-xs text-muted-foreground mt-0.5">CRM integrado com IA — visão completa da carteira</p>
      </div>

      {/* Stats top bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total da Base", value: "3.847", sub: "clientes cadastrados", icon: Users, accentCls: "bg-blue-500", iconCls: "text-blue-500" },
          { label: "Ativos", value: String(totalAtivos), sub: "apólices perdidas", icon: Shield, accentCls: "bg-emerald-500", iconCls: "text-emerald-500" },
          { label: "Próx. Renovações", value: String(totalRenov), sub: "nos próximos 30 dias", icon: Clock, accentCls: "bg-amber-500", iconCls: "text-amber-500" },
          { label: "Sem Seguro Ativo", value: String(totalInativos), sub: "candidatos à reativação", icon: AlertTriangle, accentCls: "bg-slate-400", iconCls: "text-slate-500" },
        ].map(kpi => (
          <Card key={kpi.label} className="relative overflow-hidden border-border bg-card">
            <div className={cn("absolute left-0 top-0 bottom-0 w-[3px]", kpi.accentCls)} />
            <CardContent className="p-4 pl-5">
              <div className="flex items-start justify-between mb-2">
                <p className="text-[10px] font-medium text-muted-foreground">{kpi.label}</p>
                <kpi.icon className={cn("h-3.5 w-3.5 shrink-0", kpi.iconCls)} />
              </div>
              <p className="text-xl font-bold text-foreground">{kpi.value}</p>
              <p className="text-[10px] text-muted-foreground mt-1.5">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table card */}
      <Card className="border-border bg-card">
        <CardHeader className="px-5 pt-4 pb-3 border-b border-border flex flex-row items-center gap-3 space-y-0 flex-wrap">
          {/* Filters */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border flex-wrap">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "h-6 px-2.5 text-[10px] font-medium rounded-md transition-all",
                  filter === f.key
                    ? "bg-card border border-border shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="ml-auto relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar cliente, seguradora..."
              className="h-7 pl-8 pr-3 text-[11px] bg-muted/60 border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary/30 w-52"
            />
          </div>
        </CardHeader>

        {/* Column headers */}
        <div className="grid grid-cols-12 gap-2 px-5 py-2 border-b border-border bg-muted/10">
          {[
            ["col-span-2","Nome / Razão Social"],
            ["col-span-1","Tipo"],
            ["col-span-1","Seguro"],
            ["col-span-2","Seguradora"],
            ["col-span-1","Vencimento"],
            ["col-span-1","Prêmio"],
            ["col-span-1","Status"],
            ["col-span-2","Última Interação"],
            ["col-span-1","Score"],
          ].map(([cls, label]) => (
            <div key={label} className={cn("text-[9px] font-semibold text-muted-foreground uppercase tracking-wide", cls)}>
              {label}
            </div>
          ))}
        </div>

        {/* Rows */}
        <div>
          {filtered.map((c, i) => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className={cn(
                "w-full grid grid-cols-12 gap-2 px-5 py-3 items-center border-b border-border/40 last:border-0 text-left transition-colors hover:bg-muted/30",
                i % 2 === 0 ? "bg-background" : "bg-muted/10"
              )}
            >
              <div className="col-span-2">
                <p className="text-[11px] font-semibold text-foreground truncate leading-tight">{c.nome}</p>
                {c.cnpj && <p className="text-[9px] font-mono text-muted-foreground">{c.cnpj}</p>}
              </div>
              <div className="col-span-1">
                <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border", TIPO_BADGE[c.tipo])}>
                  {c.tipo}
                </span>
              </div>
              <div className="col-span-1">
                <span className="text-[10px] text-muted-foreground truncate">{c.seguro}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] text-muted-foreground truncate">{c.seguradora}</span>
              </div>
              <div className="col-span-1">
                <span className={cn(
                  "text-[10px] font-medium",
                  c.status === "Renovando" ? "text-amber-600" : "text-muted-foreground"
                )}>
                  {c.vencimento}
                </span>
              </div>
              <div className="col-span-1">
                <span className="text-[10px] font-medium text-foreground">{c.premio}</span>
              </div>
              <div className="col-span-1">
                <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded border", STATUS_CONFIG[c.status].cls)}>
                  {c.status}
                </span>
              </div>
              <div className="col-span-2">
                <div className="flex items-center gap-1.5">
                  {c.tipoInteracao === "IA" ? (
                    <Bot className="h-3 w-3 text-sky-500 shrink-0" />
                  ) : (
                    <User className="h-3 w-3 text-amber-500 shrink-0" />
                  )}
                  <span className="text-[10px] text-muted-foreground truncate">{c.ultimaInteracao}</span>
                </div>
              </div>
              <div className="col-span-1 flex items-center gap-1.5">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", c.scoreIA >= 75 ? "bg-emerald-500" : c.scoreIA >= 50 ? "bg-amber-500" : "bg-slate-400")}
                    style={{ width: `${c.scoreIA}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-foreground w-5 text-right">{c.scoreIA}</span>
              </div>
            </button>
          ))}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Users className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhum cliente encontrado</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-border bg-muted/20">
          <p className="text-[10px] text-muted-foreground">
            Exibindo <strong className="text-foreground">{filtered.length}</strong> de {CLIENTES.length} clientes (amostra) · Base total: 3.847 clientes
          </p>
        </div>
      </Card>

      {selected && <ClientPanel cliente={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
