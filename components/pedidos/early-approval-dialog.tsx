"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Loader2, AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface VisitPreview {
  id: number
  status: string
  dataMarcada: string | null
  tecnicoNome: string | null
  willBeCancelled: boolean
}

interface EarlyApprovalPreview {
  pedidoId: number
  currentStatus: string
  targetStatus: string
  visitsToCancel: VisitPreview[]
  canProceed: boolean
  blockingReasons: string[]
}

interface EarlyApprovalDialogProps {
  pedidoId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function EarlyApprovalDialog({
  pedidoId,
  open,
  onOpenChange,
  onSuccess,
}: EarlyApprovalDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [preview, setPreview] = useState<EarlyApprovalPreview | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Busca o preview quando o dialog abre
  const fetchPreview = useCallback(async () => {
    if (!pedidoId) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/pedidos/${pedidoId}/aprovacao-precoce`)
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao carregar preview")
      }

      setPreview(payload.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setLoading(false)
    }
  }, [pedidoId])

  useEffect(() => {
    if (open && pedidoId) {
      fetchPreview()
    }
  }, [open, pedidoId, fetchPreview])

  // Executa a aprovação precoce
  const handleConfirm = async () => {
    if (!preview?.canProceed) return

    setExecuting(true)

    try {
      const response = await fetch(`/api/pedidos/${pedidoId}/aprovacao-precoce`, {
        method: "POST",
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao executar aprovação")
      }

      toast({
        title: "Aprovação precoce realizada",
        description: `Pedido #${pedidoId} enviado para aprovação final. ${payload.data?.visitsCancelled || 0} visita(s) cancelada(s).`,
      })

      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: err instanceof Error ? err.message : "Erro ao executar aprovação",
      })
    } finally {
      setExecuting(false)
    }
  }

  // Formata data
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—"
    const date = new Date(dateStr)
    return date.toLocaleDateString("pt-BR")
  }

  // Formata status para exibição
  const formatStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      AGUARDANDO: "Aguardando",
      AGENDADO_OU_EXECUCAO: "Agendado/Execução",
      AGUARDANDO_APROVACAO_FINAL: "Aguardando Aprovação Final",
      PENDENTE: "Pendente",
      AGENDADA: "Agendada",
      EM_ANDAMENTO: "Em Andamento",
      EM_EXECUCAO: "Em Execução",
      FINALIZADO: "Finalizado",
      CANCELADO: "Cancelado",
    }
    return statusMap[status] || status
  }

  const visitsToCancel = preview?.visitsToCancel.filter((v) => v.willBeCancelled) || []

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Aprovação Precoce - Pedido #{pedidoId}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-left">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Carregando preview...</span>
                </div>
              ) : error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                  <p className="font-medium">Erro ao carregar preview</p>
                  <p className="text-sm">{error}</p>
                </div>
              ) : preview ? (
                <>
                  {/* Info do pedido */}
                  <div className="rounded-lg border border-border bg-secondary p-3">
                    <p className="text-xs uppercase font-semibold text-muted-foreground mb-2">
                      Mudança de Status
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="bg-card">
                        {formatStatus(preview.currentStatus)}
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge className="bg-amber-500 text-white">
                        {formatStatus(preview.targetStatus)}
                      </Badge>
                    </div>
                  </div>

                  {/* Visitas que serão canceladas */}
                  {visitsToCancel.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs uppercase font-semibold text-amber-700 mb-2 flex items-center gap-1">
                        <XCircle className="h-3.5 w-3.5" />
                        Visitas que serão CANCELADAS ({visitsToCancel.length})
                      </p>
                      <ul className="space-y-1.5">
                        {visitsToCancel.map((visit) => (
                          <li
                            key={visit.id}
                            className="flex items-center justify-between text-sm bg-card rounded px-2 py-1.5 border border-amber-100"
                          >
                            <span className="font-medium">Visita #{visit.id}</span>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{visit.tecnicoNome || "Sem técnico"}</span>
                              <span>•</span>
                              <span>{formatDate(visit.dataMarcada)}</span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] px-1.5 py-0",
                                  visit.status === "EM_EXECUCAO" || visit.status === "EM_ANDAMENTO"
                                    ? "border-amber-400 text-amber-700"
                                    : "border-slate-300"
                                )}
                              >
                                {formatStatus(visit.status)}
                              </Badge>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Visitas já finalizadas (não serão afetadas) */}
                  {preview.visitsToCancel.filter((v) => !v.willBeCancelled).length > 0 && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                      <p className="text-xs uppercase font-semibold text-green-700 mb-2 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Visitas já finalizadas (não afetadas)
                      </p>
                      <ul className="space-y-1">
                        {preview.visitsToCancel
                          .filter((v) => !v.willBeCancelled)
                          .map((visit) => (
                            <li key={visit.id} className="text-sm text-green-700">
                              Visita #{visit.id} - {formatStatus(visit.status)}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}

                  {/* Bloqueios */}
                  {!preview.canProceed && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-xs uppercase font-semibold text-red-700 mb-2">
                        ❌ Não é possível prosseguir
                      </p>
                      <ul className="list-disc list-inside text-sm text-red-600">
                        {preview.blockingReasons.map((reason, i) => (
                          <li key={i}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Avisos importantes sobre consequências */}
                  {preview.canProceed && (
                    <div className="rounded-lg border border-orange-300 bg-orange-50 p-3">
                      <p className="text-xs uppercase font-semibold text-orange-700 mb-2 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Consequências desta ação
                      </p>
                      <ul className="space-y-1.5 text-sm text-orange-800">
                        <li className="flex items-start gap-2">
                          <span className="text-orange-500 mt-0.5">•</span>
                          <span>
                            <strong>Documentos:</strong> Relatório de Vistoria e Termo de Conclusão podem não existir ou estar incompletos, 
                            pois a visita técnica pode não ter sido feita normalmente.
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-orange-500 mt-0.5">•</span>
                          <span>
                            <strong>Medição Ôhmica:</strong> Pode não estar registrada no pedido, 
                            pois normalmente é preenchida na finalização da visita técnica.
                          </span>
                        </li>
                        
                        {visitsToCancel.length > 0 && (
                          <li className="flex items-start gap-2">
                            <span className="text-orange-500 mt-0.5">•</span>
                            <span>
                              <strong>Visitas:</strong> {visitsToCancel.length} visita(s) técnica(s) será(ão) cancelada(s) automaticamente.
                            </span>
                          </li>
                        )}
                        <li className="flex items-start gap-2">
                          <span className="text-orange-500 mt-0.5">•</span>
                          <span>
                            <strong>Aprovação Supervisão:</strong> A etapa de aprovação da supervisão será pulada.
                          </span>
                        </li>
                      </ul>
                    </div>
                  )}

                  {/* O que vai acontecer */}
                  {preview.canProceed && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <p className="text-xs uppercase font-semibold text-blue-700 mb-2">
                        ✓ O que será feito
                      </p>
                      <ul className="space-y-1 text-sm text-blue-800">
                        <li>1. Status do pedido alterado para <strong>Aguardando Aprovação Final</strong></li>
                        {visitsToCancel.length > 0 && (
                          <li>2. {visitsToCancel.length} visita(s) cancelada(s)</li>
                        )}
                        <li>{visitsToCancel.length > 0 ? "3" : "2"}. Pedido disponível para aprovação da gerência e procedimentos finais(geração de débitos, boletos, etc)</li>
                      </ul>
                    </div>
                  )}

                  {/* Confirmação final */}
                  {preview.canProceed && (
                    <p className="text-sm text-red-600 font-medium border-t pt-3">
                      ⚠️ Esta ação não pode ser desfeita. Confirme apenas se tiver certeza.
                    </p>
                  )}
                </>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={executing}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading || !preview?.canProceed || executing}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {executing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processando...
              </>
            ) : (
              "Confirmar Aprovação Precoce"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

