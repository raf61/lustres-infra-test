"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
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
import { Calendar, Loader2, MapPin, ShieldAlert, Building2, FileText } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatCNPJ, formatRazaoSocial } from "@/lib/formatters"
import { cn } from "@/lib/utils"

type TecnicoVisitaStatus = "AGUARDANDO" | "EM_EXECUCAO" | "FINALIZADO" | "CANCELADO" | "ANALISE_NAO_AUTORIZADO"

type TecnicoVisita = {
  id: number
  tecnicoId: string
  observacao?: string | null
  pedidoId: number | null
  pedidoObservacoes?: string | null
  pedidoTipoEspecial?: "OS" | null
  pedidoDetalhamento?: string | null
  orcamentoId: number
  clienteId: number
  clienteRazaoSocial: string
  clienteCnpj: string
  endereco: string
  dataMarcada: string
  status: TecnicoVisitaStatus
  dataRegistroInicio: string | null
  dataRegistroFim: string | null
  tipoVisita?: string | null
  sacMaterials?: Array<{ nome: string; quantidade: number }> | null
}

const statusStyles: Record<
  TecnicoVisitaStatus,
  {
    label: string
    className: string
    cardBorder: string
  }
> = {
  AGUARDANDO: {
    label: "Aguardando",
    className: "bg-emerald-50 text-emerald-700 border border-emerald-100",
    cardBorder: "border-l-emerald-500"
  },
  EM_EXECUCAO: {
    label: "Em execução",
    className: "bg-amber-50 text-amber-700 border border-amber-100",
    cardBorder: "border-l-amber-500"
  },
  FINALIZADO: {
    label: "Finalizado",
    className: "bg-slate-100 text-slate-700 border border-slate-200",
    cardBorder: "border-l-slate-400"
  },
  CANCELADO: {
    label: "Cancelado",
    className: "bg-rose-50 text-rose-700 border border-rose-100",
    cardBorder: "border-l-rose-500"
  },
  ANALISE_NAO_AUTORIZADO: {
    label: "Em análise",
    className: "bg-orange-50 text-orange-700 border border-orange-100",
    cardBorder: "border-l-orange-500"
  },
}

const formatDisplayDate = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "--" : date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
}

export function ServicosTecnicos() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const userRole = (session?.user as { role?: string })?.role ?? null
  const urlTecnicoId = searchParams.get("tecnicoId")
  const isImpersonating = Boolean(urlTecnicoId) && ["MASTER", "ADMINISTRADOR"].includes(userRole ?? "")
  const [impersonatedTecnicoName, setImpersonatedTecnicoName] = useState<string | null>(null)
  const [visitas, setVisitas] = useState<TecnicoVisita[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [deniedVisita, setDeniedVisita] = useState<TecnicoVisita | null>(null)
  const [deniedReason, setDeniedReason] = useState("")
  const [savingDenial, setSavingDenial] = useState(false)
  const [startVisita, setStartVisita] = useState<TecnicoVisita | null>(null)
  const [starting, setStarting] = useState(false)

  const fetchVisitas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (isImpersonating && urlTecnicoId) params.set("tecnicoId", urlTecnicoId)
      const response = await fetch(`/api/tecnico/visitas?${params.toString()}`, { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Erro ao carregar visitas do técnico.")
      }
      const result = await response.json()
      setVisitas(result.data ?? [])
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Não foi possível carregar as visitas.")
      setVisitas([])
    } finally {
      setLoading(false)
    }
  }, [isImpersonating, urlTecnicoId])

  useEffect(() => {
    fetchVisitas().catch(console.error)
  }, [fetchVisitas])

  useEffect(() => {
    if (isImpersonating && urlTecnicoId) {
      fetch(`/api/usuarios/${urlTecnicoId}`)
        .then((res) => res.json())
        .then((result) => {
          const user = result.data ?? result
          setImpersonatedTecnicoName(user.fullname ?? user.name ?? "Técnico")
        })
        .catch(() => setImpersonatedTecnicoName("Técnico"))
    } else {
      setImpersonatedTecnicoName(null)
    }
  }, [isImpersonating, urlTecnicoId])

  const todayBoundaries = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }, [])

  const isPendingVisit = (visita: TecnicoVisita) => {
    const visitDate = new Date(visita.dataMarcada)
    if (Number.isNaN(visitDate.getTime())) return false
    const beforeToday = visitDate < todayBoundaries.start
    if (visita.status === "AGUARDANDO" && beforeToday) return true
    if (visita.status === "EM_EXECUCAO" && beforeToday && !visita.dataRegistroFim) return true
    return false
  }

  const activeStatuses: TecnicoVisitaStatus[] = ["AGUARDANDO", "EM_EXECUCAO"]

  const todayVisits = useMemo(() => {
    return visitas.filter((visita) => {
      const visitDate = new Date(visita.dataMarcada)
      if (Number.isNaN(visitDate.getTime())) return false
      const inTodayWindow =
        visitDate >= todayBoundaries.start &&
        visitDate <= todayBoundaries.end &&
        activeStatuses.includes(visita.status)
      return inTodayWindow || isPendingVisit(visita)
    })
  }, [visitas, todayBoundaries.start, todayBoundaries.end])

  // Verifica se já existe uma manutenção em execução
  const visitaEmExecucao = useMemo(() => {
    return visitas.find((visita) => visita.status === "EM_EXECUCAO") ?? null
  }, [visitas])


  const handleIniciarManutencao = () => {
    if (!startVisita) return
    const visitaIdToRedirect = startVisita.id
    setStarting(true)
    fetch(`/api/tecnico/visitas/${startVisita.id}/start`, { method: "POST" })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload?.error || "Erro ao iniciar manutenção.")
        }
      })
      .then(() => {
        toast({ description: "Manutenção iniciada." })
        setStartVisita(null)
        // Redireciona automaticamente para a tela da visita
        window.location.assign(`/dashboard/tecnico/visitas/${visitaIdToRedirect}`)
      })
      .catch((error) => {
        toast({
          title: "Não foi possível iniciar",
          description: error instanceof Error ? error.message : "Tente novamente.",
          variant: "destructive",
        })
      })
      .finally(() => setStarting(false))
  }

  const handleSubmitDenial = async () => {
    if (!deniedVisita) return
    if (!deniedReason.trim()) {
      toast({
        title: "Informe uma justificativa",
        description: "Descreva por que não foi autorizado antes de enviar.",
        variant: "destructive",
      })
      return
    }
    setSavingDenial(true)
    try {
      const response = await fetch(`/api/tecnico/visitas/${deniedVisita.id}/nao-autorizado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: deniedReason.trim() }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível registrar não autorização.")
      }
      toast({ description: "Não autorizado registrado e enviado para supervisão." })
      setDeniedReason("")
      setDeniedVisita(null)
      fetchVisitas().catch(console.error)
    } catch (error) {
      toast({
        title: "Erro ao registrar",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setSavingDenial(false)
    }
  }

  const renderVisitCard = (visita: TecnicoVisita, options: { showActions: boolean }) => {
    const isPending = isPendingVisit(visita)
    const statusInfo = statusStyles[visita.status] ?? {
      label: visita.status ?? "Status",
      className: "bg-slate-100 text-slate-700 border border-slate-200",
      cardBorder: "border-l-slate-400"
    }

    return (
      <Card
        key={visita.id}
        className={`border-l-4 ${isPending ? "border-l-red-500 bg-red-50/30" : statusInfo.cardBorder}`}
      >
        <CardContent className="p-4 space-y-3">
          {/* Header: Cliente + Status */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
                <h3 className="font-semibold text-foreground truncate">
                  {formatRazaoSocial(visita.clienteRazaoSocial)}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 ml-6">
                {formatCNPJ(visita.clienteCnpj)}
              </p>
              <div className="flex items-center gap-2 mt-1 ml-6">
                {visita.tipoVisita ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] uppercase font-bold",
                      visita.tipoVisita === "SAC" && "border-orange-400 text-orange-600 bg-orange-50",
                      (visita.tipoVisita === "Primeira visita" || visita.tipoVisita === "Primeira visita com peças") && "border-blue-400 text-blue-600 bg-blue-50",
                      visita.tipoVisita === "Ord. Serv." && "border-yellow-400 text-yellow-700 bg-yellow-50"
                    )}
                  >
                    {visita.tipoVisita}
                  </Badge>
                ) : (
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Pedido
                  </p>
                )}
              </div>
            </div>
            <Badge className={`shrink-0 text-[11px] ${isPending ? "bg-red-600 text-white border-red-600" : statusInfo.className}`}>
              {isPending ? "Pendência" : statusInfo.label}
            </Badge>
          </div>

          {/* Endereço */}
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <span className="leading-tight">{visita.endereco}</span>
          </div>

          {visita.pedidoTipoEspecial === "OS" ? (
            <div className="text-sm text-foreground">
              <span className="font-semibold">Serviço a ser executado: </span>
              <span>{visita.pedidoDetalhamento?.trim() || "—"}</span>
            </div>
          ) : null}

          <div className="text-sm text-foreground">
            <span className="font-semibold">Observação da visita (para o técnico): </span>
            <span>{visita.observacao?.trim() || "—"}</span>
          </div>

          {visita.pedidoTipoEspecial !== "OS" && visita.pedidoObservacoes && visita.pedidoObservacoes.trim() !== "" && (
            <div className="text-sm text-foreground">
              <span className="font-semibold">Observação do pedido (venda): </span>
              <span>{visita.pedidoObservacoes.trim()}</span>
            </div>
          )}

          {visita.pedidoTipoEspecial !== "OS" && visita.sacMaterials && visita.sacMaterials.length > 0 && (
            <div className="mt-2 rounded-lg border border-orange-100 bg-orange-50/50 p-3">
              <p className="text-[11px] font-bold uppercase text-orange-700 mb-2">
                {visita.tipoVisita === "SAC" ? "Todas as peças incluidas no pedido" : "Peças incluidas no pedido"}:
              </p>
              <ul className="space-y-1">
                {visita.sacMaterials.map((mat, idx) => (
                  <li key={idx} className="flex justify-between text-xs text-orange-900">
                    <span>{mat.nome}</span>
                    <span className="font-bold">x{mat.quantidade}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Data + Identificadores */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm">
              <Calendar className="h-4 w-4 text-slate-500" />
              <span className="font-medium">{formatDisplayDate(visita.dataMarcada)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                Pedido {visita.pedidoId ? `#${visita.pedidoId}` : "—"}
              </Badge>
              {visita.pedidoTipoEspecial === "OS" ? (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-700 bg-amber-50">
                  Ordem de Serviço
                </Badge>
              ) : null}
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                Orç #{visita.orcamentoId}
              </Badge>
            </div>
          </div>

          {/* Ações */}
          {options.showActions && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
              {visita.status === "AGUARDANDO" ? (
                <Button
                  size="sm"
                  className="flex-1 min-w-[140px]"
                  onClick={() => setStartVisita(visita)}
                  disabled={!!visitaEmExecucao}
                  title={visitaEmExecucao ? "Finalize a manutenção em execução antes de iniciar outra" : undefined}
                >
                  Iniciar
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant={visita.status === "CANCELADO" ? "outline" : "secondary"}
                  className="flex-1 min-w-[140px]"
                  onClick={() => window.location.assign(`/dashboard/tecnico/visitas/${visita.id}`)}
                >
                  Mais detalhes
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setDeniedVisita(visita)}
              >
                <ShieldAlert className="h-4 w-4" />
                Não autorizado
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderVisitsCards = (
    dataset: TecnicoVisita[],
    emptyLabel: string,
    options: { showActions: boolean },
  ) => (
    <div className="space-y-3">
      {loading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando visitas...
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-3 text-sm">
            {error}
            <Button size="sm" variant="outline" onClick={() => fetchVisitas().catch(console.error)}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      ) : dataset.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <div className="text-center text-sm text-muted-foreground">
              {emptyLabel}
            </div>
          </CardContent>
        </Card>
      ) : (
        dataset.map((visita) => renderVisitCard(visita, options))
      )}
    </div>
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {isImpersonating ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Visualizando como {impersonatedTecnicoName ?? "Técnico"} (impersonação)
          </div>
        ) : null}
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Agenda técnica</h1>
          <p className="text-sm text-muted-foreground">Visualize suas visitas e reporte ocorrências rapidamente.</p>
        </header>

        <div className="space-y-3">
          <CardHeader className="px-0 pt-0">
            <CardTitle>Hoje & pendências</CardTitle>
            <CardDescription>Visitas para hoje e pendências em aberto.</CardDescription>
          </CardHeader>
          {renderVisitsCards(todayVisits, "Nenhuma visita para hoje.", { showActions: true })}
        </div>
      </div>

      <AlertDialog open={Boolean(deniedVisita)} onOpenChange={(open) => (!open ? setDeniedVisita(null) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Informar não autorização</AlertDialogTitle>
            <AlertDialogDescription>
              Descreva o motivo de não ter sido autorizado a entrar no condomínio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              {deniedVisita ? formatRazaoSocial(deniedVisita.clienteRazaoSocial) : ""}
            </p>
            <Textarea
              placeholder="Explique o que aconteceu..."
              value={deniedReason}
              onChange={(event) => setDeniedReason(event.target.value)}
              rows={4}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeniedVisita(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmitDenial} disabled={savingDenial}>
              {savingDenial ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar justificativa"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={Boolean(startVisita)} onOpenChange={(open) => (!open ? setStartVisita(null) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Iniciar visita</AlertDialogTitle>
            <AlertDialogDescription>
              Confirme o início da visita técnica. Isso registrará a data/hora de início e mudará o status para em execução.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="text-sm text-muted-foreground">
            {startVisita ? formatRazaoSocial(startVisita.clienteRazaoSocial) : ""}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setStartVisita(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleIniciarManutencao} disabled={starting}>
              {starting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando...
                </>
              ) : (
                "Confirmar início"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
