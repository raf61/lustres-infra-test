"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Calendar, Building2 } from "lucide-react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ClienteDetailDialog } from "@/components/leads/cliente-detail-dialog"
import { formatCNPJ, formatRazaoSocial } from "@/lib/formatters"
import { cn } from "@/lib/utils"

const MESES = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
]

type MandatoRow = {
  id: number
  cnpj: string
  razaoSocial: string
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  categoria: "ATIVO" | "AGENDADO" | "EXPLORADO" | null
  nomeSindico: string | null
  dataInicioMandato: string | null
  dataFimMandato: string | null
}

type MandatosResponse = {
  data: MandatoRow[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasNextPage: boolean
  }
  monthlyCounts: Record<string, number>
  summary: {
    semDados: number
    apenasInicio: number
    apenasFim: number
    ambos: number
  }
}

const PAGE_SIZE = 50

export default function MandatosPage() {
  const now = new Date()
  const [anoSelecionado, setAnoSelecionado] = useState<number>(now.getFullYear())
  const [mesSelecionado, setMesSelecionado] = useState<string | null>(
    String(now.getMonth() + 1).padStart(2, "0")
  )
  const [categoria, setCategoria] = useState<string>("all")
  const [status, setStatus] = useState<"only_inicio" | "only_fim" | "ambos">("ambos")
  const [sortValue, setSortValue] = useState("dataFimMandato:asc")
  const [dataInicioAte, setDataInicioAte] = useState<string>("")
  const [dataFimAte, setDataFimAte] = useState<string>("")
  const [page, setPage] = useState(1)
  const [data, setData] = useState<MandatoRow[]>([])
  const [pagination, setPagination] = useState<MandatosResponse["pagination"]>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
  })
  const [monthlyCounts, setMonthlyCounts] = useState<Record<string, number>>(
    Object.fromEntries(MESES.map((mes) => [mes.value, 0]))
  )
  const [summary, setSummary] = useState<MandatosResponse["summary"]>({
    semDados: 0,
    apenasInicio: 0,
    apenasFim: 0,
    ambos: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCliente, setSelectedCliente] = useState<string | null>(null)

  const anosDisponiveis = useMemo(() => {
    const currentYear = now.getFullYear()
    return Array.from({ length: 12 }, (_, index) => currentYear - 10 + index)
  }, [now])

  const fetchMandatos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set("year", String(anoSelecionado))
      if (mesSelecionado) {
        params.set("month", mesSelecionado)
      }
      if (categoria !== "all") {
        params.set("categoria", categoria)
      }
      params.set("status", status)
      const [sortBy, sortOrder] = sortValue.split(":")
      params.set("sortBy", sortBy)
      params.set("sortOrder", sortOrder)
      if (dataInicioAte) {
        params.set("dataInicioAte", dataInicioAte)
      }
      if (dataFimAte) {
        params.set("dataFimAte", dataFimAte)
      }
      params.set("page", String(page))
      params.set("limit", String(PAGE_SIZE))

      const response = await fetch(`/api/mandatos?${params.toString()}`, {
        cache: "no-store",
      })
      if (!response.ok) {
        throw new Error("Erro ao carregar mandatos")
      }
      const result: MandatosResponse = await response.json()
      setData(result.data)
      setPagination(result.pagination)
      setMonthlyCounts(result.monthlyCounts)
      setSummary(result.summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar mandatos")
    } finally {
      setLoading(false)
    }
  }, [anoSelecionado, mesSelecionado, categoria, status, sortValue, dataInicioAte, dataFimAte, page])

  useEffect(() => {
    setPage(1)
  }, [anoSelecionado, mesSelecionado, categoria, status, sortValue, dataInicioAte, dataFimAte])

  useEffect(() => {
    fetchMandatos()
  }, [fetchMandatos])

  const totalLabel = mesSelecionado
    ? MESES.find((mes) => mes.value === mesSelecionado)?.label
    : `${anoSelecionado} (Ano todo)`

  const buildEndereco = (mandato: MandatoRow) => {
    const partes = [
      mandato.logradouro,
      mandato.numero,
      mandato.complemento,
      mandato.bairro,
      mandato.cidade,
      mandato.estado,
    ].filter(Boolean)
    if (partes.length === 0) return "—"
    return partes.join(", ")
  }

  const formatCategoria = (value: MandatoRow["categoria"]) => {
    if (value === "ATIVO") return "ativo"
    if (value === "AGENDADO") return "livre c/ data"
    if (value === "EXPLORADO") return "livre sem data"
    return "—"
  }

  const totalPages = pagination.totalPages
  const startItem = data.length === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1
  const endItem = data.length === 0 ? 0 : startItem + data.length - 1

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Calendar className="h-10 w-10 text-blue-600" />
              Mandatos vencendo
            </h1>
            <p className="text-lg text-muted-foreground">
              Mandatos de síndico com vencimento no mês selecionado
            </p>
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sem dados de mandato</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{summary.semDados}</div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Apenas início cadastrado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{summary.apenasInicio}</div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Apenas fim cadastrado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{summary.apenasFim}</div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Início e fim cadastrados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{summary.ambos}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-semibold text-foreground">Calendário de Mandatos</CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  Selecione o mês e o ano para visualizar mandatos vencendo
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-foreground">Ano:</label>
                  <Select value={String(anoSelecionado)} onValueChange={(value) => setAnoSelecionado(Number(value))}>
                    <SelectTrigger className="w-28 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {anosDisponiveis.map((ano) => (
                        <SelectItem key={ano} value={String(ano)}>
                          {ano}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-foreground">Dados mandato:</label>
                  <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                    <SelectTrigger className="w-44 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="only_inicio">Apenas início</SelectItem>
                      <SelectItem value="only_fim">Apenas fim</SelectItem>
                      <SelectItem value="ambos">Início e fim cadastrados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-foreground">Categoria do cliente:</label>
                  <Select value={categoria} onValueChange={setCategoria}>
                    <SelectTrigger className="w-36 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="ATIVO">ativo</SelectItem>
                      <SelectItem value="AGENDADO">livre c/ data</SelectItem>
                      <SelectItem value="EXPLORADO">livre sem data</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-foreground">Ordenar:</label>
                  <Select value={sortValue} onValueChange={setSortValue}>
                    <SelectTrigger className="w-48 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dataFimMandato:asc">Data fim (asc)</SelectItem>
                      <SelectItem value="dataFimMandato:desc">Data fim (desc)</SelectItem>
                      <SelectItem value="dataInicioMandato:asc">Data início (asc)</SelectItem>
                      <SelectItem value="dataInicioMandato:desc">Data início (desc)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-foreground">Início até:</label>
                  <input
                    type="date"
                    value={dataInicioAte}
                    onChange={(event) => setDataInicioAte(event.target.value)}
                    className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-foreground">Fim até:</label>
                  <input
                    type="date"
                    value={dataFimAte}
                    onChange={(event) => setDataFimAte(event.target.value)}
                    className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                  />
                </div>
                <Button
                  variant={mesSelecionado === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMesSelecionado(null)}
                >
                  Ano todo
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {mesSelecionado === null && (
              <div className="mb-4 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-700">
                  <span className="font-medium">Exibindo ano inteiro ({anoSelecionado})</span>
                  <span className="text-blue-500 ml-2">— Clique em um mês para filtrar</span>
                </p>
              </div>
            )}

            <div className="grid grid-cols-6 lg:grid-cols-12 w-full gap-0 rounded-md overflow-hidden">
              {MESES.map((mes, index) => (
                <button
                  key={mes.value}
                  type="button"
                  onClick={() => setMesSelecionado(mes.value)}
                  className={cn(
                    "flex items-center justify-center gap-1 px-2 py-2 text-xs font-medium transition-colors",
                    index > 0 && "border-l border-black",
                    mesSelecionado === mes.value
                      ? "bg-green-500 text-white"
                      : "bg-slate-100 text-foreground hover:bg-slate-200"
                  )}
                >
                  {mes.label.substring(0, 3)}
                  {monthlyCounts[mes.value] > 0 && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "ml-1 h-4 px-1 text-xs",
                        mesSelecionado === mes.value && "bg-green-600 text-white"
                      )}
                    >
                      {monthlyCounts[mes.value]}
                    </Badge>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-4">
              {loading ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-sm font-semibold text-muted-foreground">Condomínio</TableHead>
                      <TableHead className="text-sm font-semibold text-muted-foreground min-w-[220px]">Endereço</TableHead>
                      <TableHead className="text-sm font-semibold text-muted-foreground">Categoria</TableHead>
                      <TableHead className="text-sm font-semibold text-muted-foreground">Síndico</TableHead>
                      <TableHead className="text-sm font-semibold text-muted-foreground">Início do mandato</TableHead>
                      <TableHead className="text-sm font-semibold text-muted-foreground">Fim do mandato</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 6 }).map((_, index) => (
                      <TableRow key={index} className="border-border">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-10 w-10 rounded-lg" />
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-36" />
                              <Skeleton className="h-3 w-24" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-40" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : data.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">
                    Nenhum mandato encontrado em {totalLabel}
                  </p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-sm font-semibold text-muted-foreground">Condomínio</TableHead>
                        <TableHead className="text-sm font-semibold text-muted-foreground min-w-[220px]">Endereço</TableHead>
                        <TableHead className="text-sm font-semibold text-muted-foreground">Categoria</TableHead>
                        <TableHead className="text-sm font-semibold text-muted-foreground">Síndico</TableHead>
                        <TableHead className="text-sm font-semibold text-muted-foreground">Início do mandato</TableHead>
                        <TableHead className="text-sm font-semibold text-muted-foreground">Fim do mandato</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.map((mandato) => (
                        <TableRow key={mandato.id} className="border-b border-black/30 hover:bg-accent/5">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                                <Building2 className="h-5 w-5 text-blue-500" />
                              </div>
                              <div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedCliente(String(mandato.id))}
                                  className="font-semibold text-sm text-foreground hover:text-blue-600 hover:underline transition-colors text-left"
                                >
                                  {formatRazaoSocial(mandato.razaoSocial)}
                                </button>
                                <p className="text-xs text-muted-foreground font-mono">{formatCNPJ(mandato.cnpj)}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="min-w-[220px]">
                            <div className="text-[11px] text-muted-foreground leading-tight whitespace-pre-wrap break-words">
                              {buildEndereco(mandato)}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-foreground">
                            {formatCategoria(mandato.categoria)}
                          </TableCell>
                          <TableCell className="text-sm text-foreground">
                            {mandato.nomeSindico ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm text-foreground">
                            {mandato.dataInicioMandato
                              ? new Date(mandato.dataInicioMandato).toLocaleDateString("pt-BR")
                              : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-foreground">
                            {mandato.dataFimMandato
                              ? new Date(mandato.dataFimMandato).toLocaleDateString("pt-BR")
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground">
                      Mostrando {startItem}–{endItem} de {pagination.total}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                        disabled={pagination.page <= 1}
                      >
                        Anterior
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Página {pagination.page} de {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={!pagination.hasNextPage}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedCliente && (
        <ClienteDetailDialog
          open
          clienteId={selectedCliente}
          onClose={() => setSelectedCliente(null)}
        />
      )}
    </DashboardLayout>
  )
}
