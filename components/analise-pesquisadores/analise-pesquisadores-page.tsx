"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ChevronLeft, ChevronRight, RefreshCw, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { ClienteDetailDialog } from "@/components/leads/cliente-detail-dialog"

type PesquisadorResumo = {
  id: string
  nome: string
  totalFichas: number
}

type ApuracaoRow = {
  fichaId: number
  cnpj: string
  razaoSocial: string
  clienteId: number | null
  apuradoEm: string
  day: string // YYYY-MM-DD (Brazil)
  vendedorNome: string | null
}

type ApiMonthResponse = {
  data: PesquisadorResumo[]
  totalFichasGlobal?: number
  periodo: "mes" | "trimestre" | "semestre" | "ano" | "total"
  mes: number
  ano: number
  tipo: "ENVIADO" | "RETORNADO"
  selectedPesquisadorId: string | null
  detail?: {
    totalDistinctClients: number
    byDay: Array<{ date: string; label: string; total: number }>
    entries: ApuracaoRow[]
  }
}

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
]

const safeInt = (value: string | null, fallback: number) => {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function AnalisePesquisadoresPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const now = new Date()
  const nowMonth = now.getMonth() + 1
  const nowYear = now.getFullYear()

  const clampMonth = (m: number) => Math.min(12, Math.max(1, m))
  const clampYear = (y: number) => Math.min(2100, Math.max(2000, y))

  const queryString = searchParams?.toString() ?? ""
  const query = useMemo(() => {
    const qMes = clampMonth(safeInt(searchParams?.get("mes") ?? null, nowMonth))
    const qAno = clampYear(safeInt(searchParams?.get("ano") ?? null, nowYear))
    const qPesquisadorId = searchParams?.get("pesquisadorId")
    const qDay = safeInt(searchParams?.get("day") ?? null, 0)
    const qPage = Math.max(1, safeInt(searchParams?.get("page") ?? null, 1))
    return {
      mes: qMes,
      ano: qAno,
      pesquisadorId: qPesquisadorId && qPesquisadorId.length > 0 ? qPesquisadorId : null,
      day: qDay > 0 ? qDay : null,
      page: qPage,
    }
  }, [queryString, nowMonth, nowYear, searchParams])

  const [mes, setMes] = useState(query.mes)
  const [ano, setAno] = useState(query.ano)
  const [selectedDay, setSelectedDay] = useState<number | null>(query.day) // 1-31
  const [page, setPage] = useState(query.page)
  const PAGE_SIZE = 50

  const [pesquisadores, setPesquisadores] = useState<PesquisadorResumo[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [byDay, setByDay] = useState<Array<{ date: string; label: string; total: number }>>([])
  const [entries, setEntries] = useState<ApuracaoRow[]>([])
  const [totalDistinctClients, setTotalDistinctClients] = useState(0)
  const [loading, setLoading] = useState(true)
  const [clienteDialogId, setClienteDialogId] = useState<string | null>(null)
  const [totalFichasGlobal, setTotalFichasGlobal] = useState(0)

  const selectedPesquisador = useMemo(
    () => pesquisadores.find((p) => p.id === selectedId) ?? null,
    [pesquisadores, selectedId],
  )

  const dayGrid = useMemo(
    () => byDay.map((d, idx) => ({ ...d, day: idx + 1 })),
    [byDay],
  )

  const selectedDayKey = useMemo(() => {
    if (!selectedDay) return null
    return dayGrid[selectedDay - 1]?.date ?? null
  }, [dayGrid, selectedDay])

  const filteredEntries = useMemo(() => {
    if (!selectedDayKey) return []
    return entries.filter((e) => e.day === selectedDayKey)
  }, [entries, selectedDayKey])

  const pagedEntries = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredEntries.slice(start, start + PAGE_SIZE)
  }, [PAGE_SIZE, filteredEntries, page])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE)), [PAGE_SIZE, filteredEntries])

  const updateUrl = useCallback(
    (next?: Partial<{
      pesquisadorId: string | null
      mes: number
      ano: number
      page: number
      day: number | null
    }>) => {
      const nextState = {
        pesquisadorId: next?.pesquisadorId ?? selectedId,
        mes: next?.mes ?? mes,
        ano: next?.ano ?? ano,
        page: next?.page ?? page,
        day: next?.day ?? selectedDay,
      }

      const currentPesquisadorId = searchParams?.get("pesquisadorId") || null
      const currentMes = safeInt(searchParams?.get("mes") ?? null, nextState.mes)
      const currentAno = safeInt(searchParams?.get("ano") ?? null, nextState.ano)
      const currentPage = Math.max(1, safeInt(searchParams?.get("page") ?? null, nextState.page))
      const currentDayRaw = searchParams?.get("day")
      const currentDay = currentDayRaw ? Math.max(1, safeInt(currentDayRaw, 0)) : null

      const isSame =
        currentPesquisadorId === (nextState.pesquisadorId ?? null) &&
        currentMes === nextState.mes &&
        currentAno === nextState.ano &&
        currentPage === nextState.page &&
        (currentDay ?? null) === (nextState.day ?? null)

      if (isSame) return

      const params = new URLSearchParams()
      if (nextState.pesquisadorId) params.set("pesquisadorId", nextState.pesquisadorId)
      params.set("mes", String(nextState.mes))
      params.set("ano", String(nextState.ano))
      params.set("page", String(nextState.page))
      params.set("pageSize", String(PAGE_SIZE))
      if (nextState.day) params.set("day", String(nextState.day))

      router.replace(`/dashboard/analise-pesquisadores?${params.toString()}`)
    },
    [PAGE_SIZE, ano, mes, page, router, searchParams, selectedDay, selectedId],
  )

  const loadMonth = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({
        periodo: "mes",
        tipo: "ENVIADO",
        mes: String(mes),
        ano: String(ano),
      })

      const pesquisadorIdToFetch = query.pesquisadorId ?? selectedId
      if (pesquisadorIdToFetch) qs.set("pesquisadorId", pesquisadorIdToFetch)

      const response = await fetch(`/api/pesquisadores/analise?${qs.toString()}`, { cache: "no-store" })
      const payload = (await response.json()) as ApiMonthResponse

      const list = payload.data ?? []
      setPesquisadores(list)

      const resolvedId = payload.selectedPesquisadorId ?? null
      setSelectedId(resolvedId)
      if (resolvedId && resolvedId !== query.pesquisadorId) {
        updateUrl({ pesquisadorId: resolvedId, page: 1 })
      }

      const detail = payload.detail
      setByDay(detail?.byDay ?? [])
      setEntries(detail?.entries ?? [])
      setTotalDistinctClients(detail?.totalDistinctClients ?? 0)
      setTotalFichasGlobal(payload.totalFichasGlobal ?? 0)

      // Se não tem dia selecionado, escolhe o último com atividade (ou 1) sem refetch
      if (detail?.byDay?.length) {
        const hasAny = detail.byDay.some((d) => (d.total ?? 0) > 0)
        const lastActiveIdx = hasAny ? [...detail.byDay].reverse().findIndex((d) => (d.total ?? 0) > 0) : -1
        const idxFromStart = lastActiveIdx >= 0 ? detail.byDay.length - 1 - lastActiveIdx : 0
        const nextDay = idxFromStart + 1
        const resolvedDay = query.day ?? nextDay
        if (resolvedDay !== selectedDay || page !== 1) {
          setSelectedDay(resolvedDay)
          setPage(1)
          updateUrl({ day: resolvedDay, page: 1 })
        }
      }
    } catch (error) {
      console.error("Erro ao carregar análise de pesquisadores:", error)
      setPesquisadores([])
      setSelectedId(null)
      setByDay([])
      setEntries([])
      setTotalDistinctClients(0)
    } finally {
      setLoading(false)
    }
  }, [ano, mes, query.pesquisadorId, selectedId, updateUrl])

  useEffect(() => {
    // Sincroniza estado com query (sem navegar daqui, só refletir)
    setMes((prev) => (prev === query.mes ? prev : query.mes))
    setAno((prev) => (prev === query.ano ? prev : query.ano))
    setPage((prev) => (prev === query.page ? prev : query.page))
    setSelectedDay((prev) => (prev === query.day ? prev : query.day))
    setSelectedId((prev) => (prev === query.pesquisadorId ? prev : query.pesquisadorId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString])

  useEffect(() => {
    // IMPORTANTE: este fetch deve rodar apenas quando muda mês/ano/pesquisador.
    // Clique no dia/página é filtragem client-side e NÃO pode disparar nova request.
    loadMonth().catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.mes, query.ano, query.pesquisadorId])

  const navegarMes = (direcao: "anterior" | "proximo") => {
    let nextMes = mes + (direcao === "anterior" ? -1 : 1)
    let nextAno = ano
    if (nextMes < 1) {
      nextMes = 12
      nextAno -= 1
    }
    if (nextMes > 12) {
      nextMes = 1
      nextAno += 1
    }
    setMes(nextMes)
    setAno(nextAno)
    setPage(1)
    setSelectedDay(null)
    updateUrl({ mes: nextMes, ano: nextAno, page: 1, day: null })
  }

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setPage(1)
    setSelectedDay(null)
    updateUrl({ pesquisadorId: id, page: 1, day: null })
  }

  const periodoLabel = `${MESES[mes - 1]} ${ano}`

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Button asChild variant="ghost" className="px-0">
              <Link href="/dashboard">&lt; Voltar ao master</Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Análise de Pesquisadores</h1>
              <p className="text-muted-foreground">Fichas apuradas (log de saída: ENVIADO)</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm text-muted-foreground">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navegarMes("anterior")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[110px] text-center text-xs font-medium">{periodoLabel}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navegarMes("proximo")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button
              variant="outline"
              onClick={() => {
                loadMonth()
              }}
              className="w-full sm:w-auto"
            >
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
                Pesquisadores
              </CardTitle>
              <CardDescription className="text-muted-foreground">Clique para detalhar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : pesquisadores.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum pesquisador disponível.</p>
              ) : (
                pesquisadores.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelect(p.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition",
                      p.id === selectedId
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border/70 text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    <span className="font-medium">{p.nome}</span>
                    <Badge variant="secondary">{p.totalFichas}</Badge>
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
                    {selectedPesquisador ? `Clientes apurados por ${selectedPesquisador.nome}` : "Clientes apurados"}
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Total no mês: {query.pesquisadorId ? totalDistinctClients : totalFichasGlobal}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-md border p-3">
                    <div className="text-xs font-semibold text-foreground">Dias do mês</div>
                    <div className="mt-2 grid grid-cols-7 gap-2">
                      {dayGrid.map((d) => (
                        <button
                          key={d.date}
                          type="button"
                          onClick={() => {
                            setSelectedDay(d.day)
                            setPage(1)
                            updateUrl({ day: d.day, page: 1 })
                          }}
                          className={cn(
                            "rounded-md border px-2 py-1 text-xs text-muted-foreground transition",
                            selectedDay === d.day
                              ? "border-primary bg-primary/5 text-foreground"
                              : "border-border/70 hover:border-primary/40",
                          )}
                          title={`${d.label} — ${d.total}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span>{d.day}</span>
                            <span className="font-semibold text-foreground tabular-nums">{d.total}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {!selectedDayKey ? (
                    <p className="text-sm text-muted-foreground">Selecione um dia no calendário.</p>
                  ) : filteredEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum cliente encontrado no dia selecionado.</p>
                  ) : (
                    <div className="w-full overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cliente</TableHead>
                            <TableHead>CNPJ</TableHead>
                            <TableHead>Vendedor</TableHead>
                            <TableHead>Apurado em</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagedEntries.map((row) => (
                            <TableRow key={`${row.fichaId}-${row.cnpj}-${row.day}`}>
                              <TableCell>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!row.clienteId) return
                                    setClienteDialogId(String(row.clienteId))
                                  }}
                                  className={cn(
                                    "text-left font-medium",
                                    row.clienteId ? "text-foreground hover:underline" : "text-muted-foreground",
                                  )}
                                  title={row.clienteId ? "Abrir detalhes do cliente" : "Cliente ainda não vinculado"}
                                >
                                  {row.razaoSocial || "—"}
                                </button>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{row.cnpj}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{row.vendedorNome || "—"}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(row.apuradoEm).toLocaleDateString("pt-BR")}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {selectedDayKey && filteredEntries.length > 0 ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <Button
                        variant="outline"
                        onClick={() => {
                          const nextPage = Math.max(1, page - 1)
                          setPage(nextPage)
                          updateUrl({ page: nextPage })
                        }}
                        disabled={page <= 1}
                        className="w-full sm:w-auto"
                      >
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Anterior
                      </Button>
                      <div className="text-xs text-muted-foreground">
                        Página {page} de {totalPages}
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const nextPage = Math.min(totalPages, page + 1)
                          setPage(nextPage)
                          updateUrl({ page: nextPage })
                        }}
                        disabled={page >= totalPages}
                        className="w-full sm:w-auto"
                      >
                        Próxima
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
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

