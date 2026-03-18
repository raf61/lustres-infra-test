"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type PedidoStatusKey =
  | "AGUARDANDO"
  | "AGENDADO"
  | "EXECUCAO"
  | "SAC"
  | "AGUARDANDO_APROVACAO_SUPERVISAO"
  | "AGUARDANDO_APROVACAO_FINAL"
  | "CONCLUIDO"
  | "ANALISE_CANCELAMENTO"
  | "ANALISE_CANCELAMENTO_SUPERVISAO"
  | "CANCELADO"

export const PEDIDO_STATUS_INFO: Record<
  PedidoStatusKey,
  { label: string; description: string }
> = {
  AGUARDANDO: {
    label: "Aguardando marcar visita",
    description: "Aguardando a supervisão técnica marcar uma visita.",
  },
  AGENDADO: {
    label: "Visita agendada",
    description: "Visita técnica já está marcada.",
  },
  EXECUCAO: {
    label: "Visita em execução",
    description: "Técnico executando o serviço.",
  },
  SAC: {
    label: "SAC",
    description: "Chamado em acompanhamento pelo SAC.",
  },
  AGUARDANDO_APROVACAO_SUPERVISAO: {
    label: "Aguardando aprovação da supervisão",
    description: "Aguardando aprovação da supervisão técnica para conclusão.",
  },
  AGUARDANDO_APROVACAO_FINAL: {
    label: "Aguardando aprovação final",
    description: "Aguardando aprovação final do pedido para conclusão.",
  },
  CONCLUIDO: {
    label: "Concluído",
    description: "Pedido concluído.",
  },
  ANALISE_CANCELAMENTO: {
    label: "Análise de cancelamento gerência",
    description: "Em análise de cancelamento.",
  },
  ANALISE_CANCELAMENTO_SUPERVISAO: {
    label: "Análise cancelamento supervisão",
    description: "Em análise de cancelamento pela supervisão.",
  },
  CANCELADO: {
    label: "Cancelado",
    description: "Pedido cancelado (pode ocorrer a partir de qualquer etapa).",
  },
}

export const getPedidoStatusLabel = (status?: string | null) => {
  const key = status?.toUpperCase() as PedidoStatusKey | undefined
  return key && PEDIDO_STATUS_INFO[key] ? PEDIDO_STATUS_INFO[key].label : status ?? "—"
}

export const getPedidoStatusDescription = (status?: string | null) => {
  const key = status?.toUpperCase() as PedidoStatusKey | undefined
  return key && PEDIDO_STATUS_INFO[key]
    ? PEDIDO_STATUS_INFO[key].description
    : "Status fora do fluxo de pedido."
}

interface PedidoStatusMapDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentStatus: string | null
}

const getStatusColor = (status: PedidoStatusKey, isCurrent: boolean) => {
  if (isCurrent) {
    if (status === "CANCELADO") {
      return "bg-red-600 text-white border-gray-300 ring-2 ring-red-300"
    }
    if (status === "CONCLUIDO") {
      return "bg-emerald-600 text-white border-gray-300 ring-2 ring-emerald-300"
    }
    return "bg-blue-600 text-white border-gray-300 ring-2 ring-blue-300"
  }

  // Todos os demais ficam neutros (cinza)
  return "bg-secondary text-muted-foreground border-gray-300"
}

function StatusNode({
  status,
  isCurrent,
}: {
  status: PedidoStatusKey
  isCurrent: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "px-3 py-2 rounded-lg border-2 text-xs font-semibold text-center min-w-[90px] transition-all",
            getStatusColor(status, isCurrent),
          )}
        >
          {PEDIDO_STATUS_INFO[status].label}
        </div>
      </TooltipTrigger>
      <TooltipContent>{PEDIDO_STATUS_INFO[status].description}</TooltipContent>
    </Tooltip>
  )
}

function Arrow({ direction = "right" }: { direction?: "right" | "down" | "left" }) {
  if (direction === "down") {
    return (
      <div className="flex justify-center">
        <svg className="w-4 h-6 text-muted-foreground/60" fill="none" viewBox="0 0 16 24">
          <path d="M8 0v20M3 15l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    )
  }
  if (direction === "left") {
    return (
      <div className="flex items-center justify-center">
        <svg className="w-6 h-4 text-muted-foreground/60" fill="none" viewBox="0 0 24 16">
          <path d="M24 8H4M9 3l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center">
      <svg className="w-6 h-4 text-muted-foreground/60" fill="none" viewBox="0 0 24 16">
        <path d="M0 8h20M15 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export function PedidoStatusMapDialog({
  open,
  onOpenChange,
  currentStatus,
}: PedidoStatusMapDialogProps) {
  const normalizedStatus = currentStatus?.toUpperCase() as PedidoStatusKey | undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-lg">Mapa de Status do Pedido</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="rounded-md border border-border bg-secondary p-3">
            <p className="text-xs uppercase text-muted-foreground">Status atual</p>
            <p className="text-sm font-semibold">{getPedidoStatusLabel(currentStatus)}</p>
            <p className="text-xs text-muted-foreground">{getPedidoStatusDescription(currentStatus)}</p>
          </div>
          <div className="pb-10"></div>

          {/* Fluxo principal */}
          <div className="relative flex flex-col gap-2">
            {/* Seta superior: SAC retorna para Aguardando marcar visita */}
            <div className="pointer-events-none absolute -top-8 left-2 right-2 flex justify-center pl-20 pr-20">
              <svg className="h-6 w-full text-muted-foreground/60" fill="none" viewBox="0 0 400 24" preserveAspectRatio="none">
                <path
                  d="M10 4H390M10 4v16M390 4v16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M6 20 l4 4 4 -4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                
              </svg>
            </div>
            <div className="flex items-center gap-1 flex-wrap justify-center">
              <StatusNode status="AGUARDANDO" isCurrent={normalizedStatus === "AGUARDANDO"} />
              <Arrow />
              <StatusNode status="AGENDADO" isCurrent={normalizedStatus === "AGENDADO"} />
              <Arrow />
              <StatusNode status="EXECUCAO" isCurrent={normalizedStatus === "EXECUCAO"} />
              <Arrow />
              <StatusNode status="SAC" isCurrent={normalizedStatus === "SAC"} />
            </div>

            {/* Conexão direta SAC -> Aguardando aprovação supervisão */}
            <div className="flex flex-col items-end pr-20 gap-1">
              <Arrow direction="down" />
            </div>

            {/* Fluxo em sentido anti-horário após SAC */}
            <div className="flex items-center gap-1 flex-wrap justify-end w-full">
              <StatusNode status="CONCLUIDO" isCurrent={normalizedStatus === "CONCLUIDO"} />
              <Arrow direction="left" />
              <StatusNode
                status="AGUARDANDO_APROVACAO_FINAL"
                isCurrent={normalizedStatus === "AGUARDANDO_APROVACAO_FINAL"}
              />
              <Arrow direction="left" />
              <StatusNode
                status="AGUARDANDO_APROVACAO_SUPERVISAO"
                isCurrent={normalizedStatus === "AGUARDANDO_APROVACAO_SUPERVISAO"}
              />
            </div>
          </div>

          {/* Status externos */}
          <div className="mt-4 pt-4 border-t border-dashed border-slate-300 space-y-3">
            <p className="text-xs text-muted-foreground text-center font-medium">
              Status externos (podem ocorrer em qualquer momento)
            </p>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <StatusNode
                status="ANALISE_CANCELAMENTO_SUPERVISAO"
                isCurrent={normalizedStatus === "ANALISE_CANCELAMENTO_SUPERVISAO"}
              />
              <StatusNode status="ANALISE_CANCELAMENTO" isCurrent={normalizedStatus === "ANALISE_CANCELAMENTO"} />
              <StatusNode status="CANCELADO" isCurrent={normalizedStatus === "CANCELADO"} />
            </div>
          </div>

          {/* Legenda */}
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Legenda:</p>
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-blue-600 ring-2 ring-blue-300" />
                <span className="text-muted-foreground">Status atual</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

