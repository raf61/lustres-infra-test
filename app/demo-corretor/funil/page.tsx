"use client"

import { cn } from "@/lib/utils"
import { Bot, User } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type LeadType = "PF" | "PJ"
type MoverType = "IA" | "humano"

interface Lead {
  id: string
  name: string
  tipo: LeadType
  seguro: string
  comissao: string
  tempo: string
  mover: MoverType
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const COLUNAS: { id: string; label: string; count: number; color: string; leads: Lead[] }[] = [
  {
    id: "prospeccao", label: "Prospecção", count: 412,
    color: "border-t-slate-400",
    leads: [
      { id: "1",  name: "Carlos Mendonça",          tipo: "PF", seguro: "Auto",        comissao: "R$ 420", tempo: "1h",    mover: "IA" },
      { id: "2",  name: "Larissa Ferreira",          tipo: "PF", seguro: "Vida",        comissao: "R$ 310", tempo: "2h",    mover: "IA" },
      { id: "3",  name: "Distribuidora Pareto Ltda", tipo: "PJ", seguro: "Empresarial", comissao: "R$ 2.400", tempo: "45min", mover: "IA" },
      { id: "4",  name: "Eduardo Rocha",             tipo: "PF", seguro: "Residencial", comissao: "R$ 180", tempo: "3h",    mover: "IA" },
    ],
  },
  {
    id: "qualificacao", label: "Qualificação", count: 287,
    color: "border-t-blue-400",
    leads: [
      { id: "5",  name: "Patrícia Souza",            tipo: "PF", seguro: "Auto",        comissao: "R$ 380", tempo: "30min", mover: "IA" },
      { id: "6",  name: "Metalúrgica Soares Ltda",   tipo: "PJ", seguro: "Empresarial", comissao: "R$ 5.800", tempo: "1h",  mover: "IA" },
      { id: "7",  name: "Rafaela Correia",           tipo: "PF", seguro: "Saúde",       comissao: "R$ 560", tempo: "2h",    mover: "IA" },
      { id: "8",  name: "Bruno Teixeira",            tipo: "PF", seguro: "Auto",        comissao: "R$ 290", tempo: "4h",    mover: "IA" },
    ],
  },
  {
    id: "cotacao", label: "Cotação", count: 198,
    color: "border-t-sky-400",
    leads: [
      { id: "9",  name: "Thiago Gomes",             tipo: "PF", seguro: "Auto",          comissao: "R$ 310", tempo: "15min", mover: "IA" },
      { id: "10", name: "Construtora Vega S.A.",     tipo: "PJ", seguro: "RC/Patrimonial",comissao: "R$ 8.200", tempo: "1h", mover: "IA" },
      { id: "11", name: "Vanessa Oliveira",          tipo: "PF", seguro: "Residencial",  comissao: "R$ 210", tempo: "20min", mover: "IA" },
      { id: "12", name: "Leandro Santos",            tipo: "PF", seguro: "Vida",         comissao: "R$ 480", tempo: "1h",   mover: "IA" },
    ],
  },
  {
    id: "proposta", label: "Proposta", count: 164,
    color: "border-t-amber-400",
    leads: [
      { id: "13", name: "Carlos Eduardo Mendes",    tipo: "PF", seguro: "Auto",          comissao: "R$ 364", tempo: "2h",  mover: "humano" },
      { id: "14", name: "Camila Martins",           tipo: "PF", seguro: "Residencial",   comissao: "R$ 145", tempo: "5h",  mover: "humano" },
      { id: "15", name: "TecnoFlex Indústria Ltda", tipo: "PJ", seguro: "Saúde Coletiva",comissao: "R$ 14.400", tempo: "1d", mover: "humano" },
      { id: "16", name: "Gustavo Barbosa",          tipo: "PF", seguro: "Auto",          comissao: "R$ 290", tempo: "3h",  mover: "IA" },
    ],
  },
  {
    id: "negociacao", label: "Negociação", count: 93,
    color: "border-t-orange-400",
    leads: [
      { id: "17", name: "Renata Carvalho",          tipo: "PF", seguro: "Vida",          comissao: "R$ 620", tempo: "1d",  mover: "humano" },
      { id: "18", name: "Felipe Araújo",            tipo: "PF", seguro: "Auto",          comissao: "R$ 410", tempo: "2d",  mover: "humano" },
      { id: "19", name: "Agropecuária Horizonte",   tipo: "PJ", seguro: "Empresarial",   comissao: "R$ 9.600", tempo: "3d", mover: "humano" },
      { id: "20", name: "Mônica Pinto",             tipo: "PF", seguro: "Saúde",         comissao: "R$ 740", tempo: "1d",  mover: "humano" },
    ],
  },
  {
    id: "fechado", label: "Fechado", count: 312,
    color: "border-t-emerald-400",
    leads: [
      { id: "21", name: "Amanda Pereira",           tipo: "PF", seguro: "Auto",          comissao: "R$ 380", tempo: "fechado", mover: "IA" },
      { id: "22", name: "Rafael Cardoso",           tipo: "PF", seguro: "Residencial",   comissao: "R$ 168", tempo: "fechado", mover: "IA" },
      { id: "23", name: "Logística Meridian Ltda",  tipo: "PJ", seguro: "Frota",         comissao: "R$ 12.800", tempo: "fechado", mover: "humano" },
      { id: "24", name: "Tatiana Correia",          tipo: "PF", seguro: "Vida",          comissao: "R$ 520", tempo: "fechado", mover: "IA" },
    ],
  },
  {
    id: "renovacao", label: "Renovação", count: 642,
    color: "border-t-violet-400",
    leads: [
      { id: "25", name: "Marcelo Ferreira",         tipo: "PF", seguro: "Residencial",   comissao: "R$ 124", tempo: "7d",  mover: "IA" },
      { id: "26", name: "Juliana Costa",            tipo: "PF", seguro: "Vida",          comissao: "R$ 198", tempo: "30d", mover: "IA" },
      { id: "27", name: "Transpetro Serviços Ltda", tipo: "PJ", seguro: "Frota",         comissao: "R$ 18.400", tempo: "15d", mover: "IA" },
      { id: "28", name: "Larissa Nunes",            tipo: "PF", seguro: "Saúde",         comissao: "R$ 876", tempo: "22d", mover: "IA" },
    ],
  },
]

// ─── Lead Card ────────────────────────────────────────────────────────────────

function LeadCard({ lead }: { lead: Lead }) {
  return (
    <div className="border border-border rounded-md bg-card p-2.5 hover:border-primary/30 transition-all cursor-pointer">
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <p className="text-[11px] font-medium text-foreground leading-tight truncate">{lead.name}</p>
        <span className={cn(
          "text-[8px] font-medium px-1 py-px rounded border shrink-0",
          lead.tipo === "PJ"
            ? "bg-violet-50 text-violet-700 border-violet-200"
            : "bg-slate-50 text-slate-600 border-slate-200"
        )}>{lead.tipo}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground truncate">{lead.seguro}</span>
        <span className="text-[10px] font-semibold text-emerald-600 shrink-0 ml-1">{lead.comissao}</span>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[9px] text-muted-foreground">
          {lead.tempo !== "fechado" ? `há ${lead.tempo}` : "fechado"}
        </span>
        {lead.mover === "IA" ? (
          <span className="text-[8px] text-sky-600 flex items-center gap-0.5">
            <Bot className="h-2.5 w-2.5" />I.A.
          </span>
        ) : (
          <span className="text-[8px] text-amber-600 flex items-center gap-0.5">
            <User className="h-2.5 w-2.5" />Corretor
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FunilPage() {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Pipeline de Vendas</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Abril 2026 · I.A. moveu 1.847 leads automaticamente este mês (82%)
          </p>
        </div>
      </div>

      {/* Kanban — full height scrollable */}
      <div className="overflow-x-auto pb-3" style={{ height: "calc(100vh - 180px)" }}>
        <div className="flex gap-3 h-full" style={{ minWidth: "max-content" }}>
          {COLUNAS.map((col) => (
            <div key={col.id} className="flex-shrink-0 w-52 flex flex-col h-full">
              {/* Column wrapper with top accent border */}
              <div className={cn("border border-border rounded-md overflow-hidden flex flex-col h-full", col.color, "border-t-2")}>
                {/* Column header */}
                <div className="bg-card px-3 py-2 border-b border-border flex items-center justify-between flex-shrink-0">
                  <span className="text-[11px] font-semibold text-foreground leading-tight">{col.label}</span>
                  <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">{col.count.toLocaleString("pt-BR")}</span>
                </div>
                {/* Cards — scrollable */}
                <div className="bg-muted/20 p-2 space-y-2 overflow-y-auto flex-1">
                  {col.leads.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} />
                  ))}
                  {col.count > col.leads.length && (
                    <p className="text-center text-[10px] text-muted-foreground py-1">
                      +{(col.count - col.leads.length).toLocaleString("pt-BR")} mais
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
