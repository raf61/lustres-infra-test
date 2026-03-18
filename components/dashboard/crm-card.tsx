"use client"

import React, { memo, useCallback } from "react"
import { Bot, CalendarDays, CheckCircle2, MoreHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { formatPhone, formatRazaoSocial } from "@/lib/formatters"

// ─── Types (inline to avoid circular imports) ────────────────────────────────

export type CrmCardClient = {
  id: number
  razaoSocial: string
  nomeSindico: string | null
  telefoneSindico: string | null
  telefoneCondominio: string | null
  celularCondominio: string | null
  telefonePorteiro: string | null
  dataContatoAgendado: string | null
  ultimaManutencao: string | null
  categoria: "ativo" | "agendado" | "explorado"
  kanbanCode?: number | null
  lastOrcamentoValor?: number | null
  ultimoPedidoValor?: number | null
  recentlyResearched?: boolean
  hasRecentOrcamento?: boolean
  totalPedidos?: number
}

export type CrmCardChatSummary = {
  lastMessage: string | null
  lastMessageType: "incoming" | "outgoing" | "template" | null
  lastActivityAt: string | null
  unreadCount: number
  waitingSince: string | null
  status: string
  chatbotActive: boolean
  lastMessageStatus?: string | null
}

const KANBAN_STAGES = [
  { code: 0, title: "A fazer contato", dotColor: "bg-slate-400" },
  { code: 1, title: "Contato feito", dotColor: "bg-blue-500" },
  { code: 2, title: "Follow-up 1", dotColor: "bg-amber-500" },
  { code: 3, title: "Follow-up 2", dotColor: "bg-orange-500" },
  { code: 4, title: "Perda", dotColor: "bg-red-500" },
]

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
})
const formatCurrency = (v: number) => currencyFormatter.format(v)

function formatDisplayDateTime(value: string | null, fallback = "Sem data") {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ─── Props ────────────────────────────────────────────────────────────────────

type CrmCardProps = {
  client: CrmCardClient
  columnId: string
  isSelected: boolean
  chatSummary: CrmCardChatSummary | undefined
  onSelect: (id: number) => void
  onViewDetails: (id: number) => void
  onOpenPerda: (client: CrmCardClient) => void
  onChatClick: (client: CrmCardClient) => void
  onChatContextMenu: (e: React.MouseEvent, client: CrmCardClient) => void
  onMoveKanban: (clientId: number, code: number) => void
  onDragStart: (clientId: number, e: React.DragEvent) => void
  onDragEnd: (e: React.DragEvent) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export const CrmCard = memo(function CrmCard({
  client,
  columnId,
  isSelected,
  chatSummary,
  onSelect,
  onViewDetails,
  onOpenPerda,
  onChatClick,
  onChatContextMenu,
  onMoveKanban,
  onDragStart,
  onDragEnd,
}: CrmCardProps) {
  const isLivresCol = columnId.startsWith("livres-")
  const isOrcadosCol = columnId === "orcados"
  const isRenovacoesCol = columnId === "renovacoes"

  const getBadgeInfo = () => {
    if (isOrcadosCol) return { label: "ORÇADO", style: "bg-sky-600 text-white border-sky-600" }
    if (isRenovacoesCol) return { label: "VENDA", style: "bg-emerald-600 text-white border-emerald-600" }
    return null
  }
  const badgeInfo = !isLivresCol ? getBadgeInfo() : null

  const orcamentoValor = isOrcadosCol
    ? (client.lastOrcamentoValor ?? client.ultimoPedidoValor ?? null)
    : null

  const handleClick = useCallback(() => onViewDetails(client.id), [client.id, onViewDetails])
  const handleSelect = useCallback(() => onSelect(client.id), [client.id, onSelect])
  const handleSelectClick = useCallback((e: React.MouseEvent) => e.stopPropagation(), [])
  const handlePerdaClick = useCallback(() => onOpenPerda(client), [client, onOpenPerda])
  const handleChatClick = useCallback(() => onChatClick(client), [client, onChatClick])
  const handleChatCtxMenu = useCallback(
    (e: React.MouseEvent) => onChatContextMenu(e, client),
    [client, onChatContextMenu]
  )
  const handleDragStart = useCallback(
    (e: React.DragEvent) => onDragStart(client.id, e),
    [client.id, onDragStart]
  )

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onClick={handleClick}
      className={cn(
        "group/card rounded-lg p-3 space-y-2 cursor-grab active:cursor-grabbing select-none",
        "bg-card border border-border",
        "hover:border-primary/30 transition-colors",
        isSelected && "border-primary/60 ring-1 ring-primary/30"
      )}
    >
      {/* Linha 1: Checkbox + nome + badge/menu */}
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-start gap-2 min-w-0">
          <Checkbox
            checked={isSelected}
            onCheckedChange={handleSelect}
            onClick={handleSelectClick}
            className="h-3.5 w-3.5 mt-0.5 shrink-0"
            aria-label={`Selecionar ${client.razaoSocial}`}
          />
          <p className="text-xs font-medium text-foreground leading-tight line-clamp-2">
            {client.nomeSindico || formatRazaoSocial(client.razaoSocial)}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isLivresCol && (
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 p-0 hover:bg-slate-700"
                  >
                    <MoreHorizontal className="h-3 w-3 text-slate-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[180px]">
                  {KANBAN_STAGES.map((stage) => (
                    <DropdownMenuItem
                      key={stage.code}
                      onClick={() => onMoveKanban(client.id, stage.code)}
                      className="cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", stage.dotColor)} />
                        {stage.title}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          {badgeInfo && (
            <Badge className={cn("text-[9px] px-1.5 py-0", badgeInfo.style)}>
              {badgeInfo.label}
            </Badge>
          )}
        </div>
      </div>

      {/* Telefone */}
      <div className="text-[10px] text-slate-300 leading-tight flex items-center gap-1 mt-0.5">
        <span>{client.telefoneSindico ? formatPhone(client.telefoneSindico) : "Sem telefone"}</span>
      </div>

      {/* Próximo contato */}
      {client.dataContatoAgendado && (
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-sky-300 bg-blue-900/40 rounded px-2 py-1">
          <CalendarDays className="h-3 w-3 shrink-0" />
          <span>Próximo: {formatDisplayDateTime(client.dataContatoAgendado)}</span>
        </div>
      )}

      {/* Valor do orçamento – só Em Negociação */}
      {orcamentoValor != null && (
        <div className="flex items-center gap-1 text-[10px] font-bold text-success">
          <span className="text-muted-foreground font-normal">Orç.</span>
          <span>{formatCurrency(orcamentoValor)}</span>
        </div>
      )}

      {/* Última mensagem */}
      {chatSummary && chatSummary.lastActivityAt && (
        <div className="flex items-center justify-between gap-2 text-[10px]">
          <div className="flex-1 min-w-0 flex items-center justify-between gap-1 overflow-hidden">
            <span
              className={cn(
                "truncate flex-1 font-medium text-[10px]",
                chatSummary.lastMessageStatus === "failed"
                  ? "text-destructive"
                  : chatSummary.lastMessageType === "incoming"
                    ? "text-sky-300"
                    : "text-slate-300"
              )}
              title={chatSummary.lastMessage || undefined}
            >
              {chatSummary.lastMessage ? (
                <span>{chatSummary.lastMessage}</span>
              ) : (
                <span>{formatDisplayDateTime(chatSummary.lastActivityAt)}</span>
              )}
            </span>
            {chatSummary.lastMessage && (
              <span
                className={cn(
                  "shrink-0 whitespace-nowrap ml-1 opacity-70 font-normal text-[10px]",
                  chatSummary.lastMessageStatus === "failed"
                    ? "text-destructive"
                    : chatSummary.lastMessageType === "incoming"
                      ? "text-sky-300"
                      : "text-slate-400"
                )}
              >
                • {formatDisplayDateTime(chatSummary.lastActivityAt)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {chatSummary.chatbotActive && (
              <Bot className="h-3 w-3 text-emerald-500" aria-label="Chatbot ativo" />
            )}
            {chatSummary.unreadCount > 0 && (
              <Badge className="h-4 px-1.5 text-[10px] bg-blue-600 text-white border-blue-700 shrink-0">
                {chatSummary.unreadCount}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Botões de ação */}
      <div className="flex items-center justify-between gap-1 text-[10px] text-slate-500">
        <div
          className="flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 p-0 hover:bg-slate-700"
            onClick={handleChatClick}
            onContextMenu={handleChatCtxMenu}
            title="Abrir conversa"
          >
            <img src="/icone-zap.png" alt="WhatsApp" className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {client.recentlyResearched && (
            <div
              className="flex items-center gap-1 text-[9px] font-bold text-success bg-success/10 px-1.5 py-0.5 rounded border border-success/20"
              title="Cliente retornou da pesquisa nos últimos 15 dias"
            >
              <CheckCircle2 className="h-2.5 w-2.5" />
              <span>PESQUISADO</span>
            </div>
          )}
          {/* Botão Perda: só visível ao hover (group/card) */}
          {columnId !== "renovados" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover/card:opacity-100 transition-opacity"
              onClick={handlePerdaClick}
            >
              <X className="h-3 w-3 mr-0.5" />
              Perda
            </Button>
          )}
        </div>
      </div>
    </div>
  )
})
