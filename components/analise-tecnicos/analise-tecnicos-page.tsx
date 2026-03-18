"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ChevronLeft, ChevronRight, RefreshCw, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { ClienteDetailDialog } from "@/components/leads/cliente-detail-dialog"
import { Checkbox } from "@/components/ui/checkbox"

type TecnicoResumo = {
  id: string
  nome: string
  totalVisitas: number
}

type VisitaRow = {
  id: number
  status: string
  dataMarcada: string
  clienteId: number
  clienteNome: string
  endereco: string
}

type ApiResponse = {
  tecnicos: TecnicoResumo[]
  visitas: VisitaRow[]
  totalVisitas: number
  page: number
  totalPages: number
}

const PAGE_SIZE = 30

const statusLabel: Record<string, string> = {
  AGUARDANDO: "Agendada",
  EM_EXECUCAO: "Em execução",
  FINALIZADO: "Concluída",
  CANCELADO: "Cancelada",
  ANALISE_NAO_AUTORIZADO: "Em análise",
}

const statusBadgeClass: Record<string, string> = {
  FINALIZADO: "bg-emerald-50 text-emerald-700 border-emerald-200",
  AGUARDANDO: "bg-slate-100 text-slate-700 border-slate-200",
  CANCELADO: "bg-rose-50 text-rose-700 border-rose-200",
  EM_EXECUCAO: "bg-amber-50 text-amber-700 border-amber-200",
  ANALISE_NAO_AUTORIZADO: "bg-orange-50 text-orange-700 border-orange-200",
  ATRASADO: "bg-rose-500 text-white-700 border-rose-200",
}

const isOverdue = (visita: VisitaRow) => {
  const visitDate = new Date(visita.dataMarcada)
  if (Number.isNaN(visitDate.getTime())) return false
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  return ["AGUARDANDO", "EM_EXECUCAO"].includes(visita.status) && visitDate < todayStart
}

export function AnaliseTecnicosPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [tecnicos, setTecnicos] = useState<TecnicoResumo[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [visitas, setVisitas] = useState<VisitaRow[]>([])
  const [totalVisitas, setTotalVisitas] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [clienteDialogId, setClienteDialogId] = useState<string | null>(null)
  const [pendentesOnly, setPendentesOnly] = useState(false)

  const selectedTecnico = useMemo(
    () => tecnicos.find((t) => t.id === selectedId) ?? null,
    [tecnicos, selectedId],
  )

  const syncUrl = useCallback(
    (id: string | null, nextPage: number) => {
      const params = new URLSearchParams(searchParams?.toString())
      if (id) params.set("tecnicoId", id)
      else params.delete("tecnicoId")
      params.set("page", String(nextPage))
      router.replace(`/dashboard/analise-tecnicos?${params.toString()}`)
    },
    [router, searchParams],
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams(searchParams?.toString())
      const tecnicoId = params.get("tecnicoId")
      const pageParam = Number(params.get("page") || 1)
      const pageNumber = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam
      params.set("page", String(pageNumber))
      params.set("pageSize", String(PAGE_SIZE))
      if (pendentesOnly) params.set("pendentes", "1")
      const response = await fetch(`/api/tecnicos/analise?${params.toString()}`, { cache: "no-store" })
      const payload = (await response.json()) as ApiResponse

      setTecnicos(payload.tecnicos ?? [])
      const firstId = payload.tecnicos?.[0]?.id ?? null
      const resolvedId = tecnicoId && payload.tecnicos?.some((t) => t.id === tecnicoId) ? tecnicoId : firstId
      setSelectedId(resolvedId)

      setVisitas(payload.visitas ?? [])
      setTotalVisitas(payload.totalVisitas ?? 0)
      setPage(payload.page ?? 1)
      setTotalPages(payload.totalPages ?? 1)

      if (resolvedId !== tecnicoId || pageNumber !== payload.page) {
        syncUrl(resolvedId, payload.page ?? pageNumber)
      }
    } catch (error) {
      console.error("Erro ao carregar análise de técnicos:", error)
      setTecnicos([])
      setVisitas([])
      setTotalVisitas(0)
      setPage(1)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }, [searchParams, syncUrl, pendentesOnly])

  useEffect(() => {
    loadData().catch(console.error)
  }, [loadData])

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setPage(1)
    syncUrl(id, 1)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Button asChild variant="ghost" className="px-0">
              <Link href="/dashboard">&lt; Voltar ao master</Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Análise de Técnicos</h1>
              <p className="text-muted-foreground">Visitas agendadas e status por técnico</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            
            <Button variant="outline" onClick={() => loadData()} className="w-full sm:w-auto">
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Users className="h-4 w-4 text-primary" />
                Técnicos
              </CardTitle>
              <CardDescription className="text-muted-foreground">Clique para detalhar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {tecnicos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum técnico disponível.</p>
              ) : (
                tecnicos.map((tecnico) => (
                  <button
                    key={tecnico.id}
                    type="button"
                    onClick={() => handleSelect(tecnico.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition",
                      tecnico.id === selectedId
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border/70 text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    <span className="font-medium">{tecnico.nome}</span>
                    <Badge variant="secondary">{tecnico.totalVisitas}</Badge>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-foreground">
                    {selectedTecnico ? `Visitas de ${selectedTecnico.nome}` : "Visitas"}
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {totalVisitas} visita(s) · Página {page} de {totalPages}
                  </CardDescription>
                </div>
                <div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox className="border-black"
                checked={pendentesOnly}
                onCheckedChange={(checked) => {
                  setPendentesOnly(Boolean(checked))
                  setPage(1)
                }}
              />
              Só Pendentes
            </label>
                </div>
                {selectedId ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/dashboard/tecnico?tecnicoId=${selectedId}`}>
                      Ver dashboard do técnico
                    </Link>
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando visitas...</p>
              ) : visitas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma visita encontrada.</p>
              ) : (
                <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Visita</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Agendamento</TableHead>
                        <TableHead className="hidden md:table-cell">Endereço</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visitas.map((visita) => (
                        <TableRow key={visita.id}>
                          <TableCell>#{visita.id}</TableCell>
                          <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              isOverdue(visita)
                                ? statusBadgeClass.ATRASADO
                                : statusBadgeClass[visita.status] ?? "border-slate-200 text-slate-700"
                            }
                          >
                            {isOverdue(visita) ? "Atrasada" : statusLabel[visita.status] ?? visita.status}
                          </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(visita.dataMarcada).toLocaleDateString("pt-BR")}
                            <div className="mt-1 text-xs text-muted-foreground md:hidden">
                              <button
                                type="button"
                                onClick={() => setClienteDialogId(String(visita.clienteId))}
                                className="block text-left font-medium text-foreground hover:underline"
                              >
                                {visita.clienteNome}
                              </button>
                              <div className="whitespace-normal break-words">{visita.endereco}</div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                            <button
                              type="button"
                              onClick={() => setClienteDialogId(String(visita.clienteId))}
                              className="text-left font-medium text-foreground hover:underline"
                            >
                              {visita.clienteNome}
                            </button>
                            <div className="mt-1 whitespace-normal break-words">
                              {visita.endereco}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  variant="outline"
                  onClick={() => {
                    const nextPage = Math.max(1, page - 1)
                    setPage(nextPage)
                    syncUrl(selectedId, nextPage)
                  }}
                  disabled={page <= 1}
                  className="w-full sm:w-auto"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const nextPage = Math.min(totalPages, page + 1)
                    setPage(nextPage)
                    syncUrl(selectedId, nextPage)
                  }}
                  disabled={page >= totalPages}
                  className="w-full sm:w-auto"
                >
                  Próxima
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <ClienteDetailDialog
          clienteId={clienteDialogId ?? ""}
          open={Boolean(clienteDialogId)}
          onClose={() => setClienteDialogId(null)}
        />
      </div>
    </DashboardLayout>
  )
}

