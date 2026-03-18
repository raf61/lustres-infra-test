"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Eye, FileText, Filter, Users, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { estados_cidades } from "@/components/leads/leads-geral"
import { formatRazaoSocial } from "@/lib/formatters"
import { ClienteDetailDialog } from "@/components/leads/cliente-detail-dialog"
import { EditarOrcamentoDialog } from "@/components/orcamentos/editar-orcamento-dialog"

type OrcamentoItem = {
  id: number
  createdAt: string
  status: string | null
  cliente: {
    id: number
    razaoSocial: string
    nomeSindico: string | null
    estado: string | null
    cidade: string | null
    bairro: string | null
  }
  vendedor: { id: string; name: string | null } | null
  empresa: { id: number; nome: string | null } | null
  totalValor: number
}

type PaginationMeta = {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNextPage: boolean
}

type SummaryData = {
  totalValue: number
  totalValueAprovado: number
  byStatus: Record<string, number>
  byStatusFiltered: Record<string, number>
  byEstado: Array<{ estado: string; count: number; totalValor: number }>
  byVendedor: Array<{
    vendedorId: string | null
    vendedorName: string
    count: number
    totalValor: number
    countAprovado: number
    totalValorAprovado: number
  }>
}

type Vendedor = { id: string; name: string }

const statusLabels: Record<string, string> = {
  EM_ABERTO: "Em aberto",
  APROVADO: "Aprovado",
  REPROVADO: "Reprovado",
  CANCELADO: "Cancelado",
}

// Badge com background sólido
const statusStyles: Record<string, string> = {
  EM_ABERTO: "bg-secondary0 text-white",
  APROVADO: "bg-emerald-500 text-white",
  REPROVADO: "bg-orange-500 text-white",
  CANCELADO: "bg-red-500 text-white",
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
})

const formatCurrency = (value: number) => currencyFormatter.format(value)

const months = [
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
]

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1
const years = Array.from({ length: 10 }, (_, i) => ({
  value: String(currentYear - i),
  label: String(currentYear - i),
}))

export function OrcamentosRelatorio() {
  const [orcamentos, setOrcamentos] = useState<OrcamentoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
  })
  const [summary, setSummary] = useState<SummaryData | null>(null)

  // Filter state - selects auto-filter, text input requires clicking filter
  const [selectedEstado, setSelectedEstado] = useState("all")
  const [selectedCidade, setSelectedCidade] = useState("all")
  const [searchNome, setSearchNome] = useState("")
  const [bairroInput, setBairroInput] = useState("")
  const [appliedBairro, setAppliedBairro] = useState("") // Only updated on filter click
  const [appliedSearchNome, setAppliedSearchNome] = useState("")
  const [selectedVendedor, setSelectedVendedor] = useState("all")
  const [selectedMonth, setSelectedMonth] = useState(String(currentMonth))
  const [selectedYear, setSelectedYear] = useState(String(currentYear))

  // Data for selects
  const [vendedores, setVendedores] = useState<Vendedor[]>([])

  // UI state
  const [showEstadoChart, setShowEstadoChart] = useState(false)
  const [showVendedorChart, setShowVendedorChart] = useState(false)
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null)
  const [selectedOrcamentoId, setSelectedOrcamentoId] = useState<number | null>(null)
  const [selectedOrcamentoClienteId, setSelectedOrcamentoClienteId] = useState<number | null>(null)

  // Click handlers for distribution charts (toggle: click again to remove filter)
  const handleEstadoClick = (estado: string) => {
    const sigla = estado === "Não informado" ? "all" : estadoOptions.find(e => e.sigla === estado || e.nome === estado)?.sigla ?? estado
    const newSigla = selectedEstado === sigla ? "all" : sigla
    setSelectedEstado(newSigla)
    setSelectedCidade("all")
    setPage(1)
  }

  const handleVendedorClick = (vendedorId: string | null) => {
    const id = vendedorId ?? "all"
    const newId = selectedVendedor === id ? "all" : id
    setSelectedVendedor(newId)
    setPage(1)
  }

  const estadoOptions = useMemo(
    () =>
      estados_cidades.estados
        .map((estado) => ({
          sigla: estado.sigla,
          nome: estado.nome,
          cidades: [...estado.cidades].sort((a, b) => a.localeCompare(b, "pt-BR")),
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [],
  )

  const selectedEstadoInfo =
    selectedEstado === "all" ? null : estadoOptions.find((e) => e.sigla === selectedEstado) ?? null
  const cidadeOptions = selectedEstadoInfo?.cidades ?? []

  // Load vendedores
  useEffect(() => {
    const loadVendedores = async () => {
      try {
        const res = await fetch("/api/vendedores")
        const json = await res.json()
        if (res.ok && Array.isArray(json.data)) {
          setVendedores(json.data.map((u: any) => ({ id: u.id, name: u.name ?? u.fullname ?? "Sem nome" })))
        }
      } catch (err) {
        console.error("Erro ao carregar vendedores", err)
      }
    }
    loadVendedores()
  }, [])

  const fetchOrcamentos = useCallback(
    async (targetPage: number) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.set("page", String(targetPage))
        if (selectedEstado !== "all") params.set("estado", selectedEstado)
        if (selectedCidade !== "all") params.set("cidade", selectedCidade)
        if (appliedSearchNome.trim()) params.set("search", appliedSearchNome.trim())
        if (appliedBairro.trim()) params.set("bairro", appliedBairro.trim())
        if (selectedVendedor !== "all") params.set("vendedorId", selectedVendedor)
        // Year is always required
        params.set("year", selectedYear)
        if (selectedMonth !== "all") params.set("month", selectedMonth)

        const response = await fetch(`/api/orcamentos/list?${params.toString()}`)
        if (!response.ok) {
          throw new Error("Erro ao carregar orçamentos")
        }

        const payload = await response.json()
        setOrcamentos(payload.data ?? [])
        setPagination(payload.pagination ?? { page: 1, pageSize: 50, total: 0, totalPages: 1, hasNextPage: false })
        setSummary(payload.summary ?? null)
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : "Erro desconhecido")
      } finally {
        setLoading(false)
      }
    },
    [selectedEstado, selectedCidade, appliedSearchNome, appliedBairro, selectedVendedor, selectedMonth, selectedYear],
  )

  useEffect(() => {
    fetchOrcamentos(page)
  }, [fetchOrcamentos, page])

  const handleApplyFilters = () => {
    setAppliedSearchNome(searchNome)
    setAppliedBairro(bairroInput)
    setPage(1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleApplyFilters()
    }
  }

  const handleClearFilters = () => {
    setSelectedEstado("all")
    setSelectedCidade("all")
    setSearchNome("")
    setBairroInput("")
    setAppliedBairro("")
    setAppliedSearchNome("")
    setSelectedVendedor("all")
    setSelectedMonth(String(currentMonth))
    setSelectedYear(String(currentYear))
    setPage(1)
  }

  const handleEstadoChange = (value: string) => {
    setSelectedEstado(value)
    setSelectedCidade("all")
    setPage(1)
  }

  const handleCidadeChange = (value: string) => {
    setSelectedCidade(value)
    setPage(1)
  }

  const handleVendedorChange = (value: string) => {
    setSelectedVendedor(value)
    setPage(1)
  }

  const handleMonthChange = (value: string) => {
    setSelectedMonth(value)
    setPage(1)
  }

  const handleYearChange = (value: string) => {
    setSelectedYear(value)
    setPage(1)
  }

  const startItem = orcamentos.length > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0
  const endItem = orcamentos.length > 0 ? startItem + orcamentos.length - 1 : 0

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6 text-blue-600" />
              Relatório de Orçamentos
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Visualize e analise todos os orçamentos do sistema
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
          <div className="bg-card rounded-lg border border-border p-3 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</p>
            <p className="text-xl font-bold text-foreground mt-1">{pagination.total}</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-3 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor Total</p>
            <p className="text-xl font-bold text-foreground/80 mt-1">{formatCurrency(summary?.totalValue ?? 0)}</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-3 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor Aprovado</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(summary?.totalValueAprovado ?? 0)}</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-3 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Em Aberto</p>
            <p className="text-xl font-bold text-muted-foreground mt-1">{summary?.byStatusFiltered?.EM_ABERTO ?? 0}</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-3 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Aprovados</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">{summary?.byStatusFiltered?.APROVADO ?? 0}</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-3 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cancelados</p>
            <p className="text-xl font-bold text-red-600 mt-1">{summary?.byStatusFiltered?.CANCELADO ?? 0}</p>
          </div>
        </div>

        {/* Filters - Ultra Compact */}
        <div className="bg-card rounded-lg border border-border shadow-sm px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground/60 shrink-0" />

            <Input
              placeholder="Buscar por nome"
              value={searchNome}
              onChange={(e) => setSearchNome(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-7 text-xs w-[14rem]"
            />

            <Select value={selectedYear} onValueChange={handleYearChange}>
              <SelectTrigger className="h-7 text-xs ">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedMonth} onValueChange={handleMonthChange}>
              <SelectTrigger className="h-7 text-xs ">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo ano</SelectItem>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="w-px h-5 bg-border mx-1" />

            <Select value={selectedEstado} onValueChange={handleEstadoChange}>
              <SelectTrigger className="h-7 text-xs w-[9rem]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Estados</SelectItem>
                {estadoOptions.map((estado) => (
                  <SelectItem key={estado.sigla} value={estado.sigla}>{estado.sigla}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedCidade} onValueChange={handleCidadeChange} disabled={selectedEstado === "all"}>
              <SelectTrigger className="h-7 text-xs w-[10rem]">
                <SelectValue placeholder="Cidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as cidades</SelectItem>
                {cidadeOptions.map((cidade) => (
                  <SelectItem key={cidade} value={cidade}>{cidade}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Bairro"
              value={bairroInput}
              onChange={(e) => setBairroInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-7 text-xs w-[10rem]"
            />

            <div className="w-px h-5 bg-border mx-1" />

            <Select value={selectedVendedor} onValueChange={handleVendedorChange}>
              <SelectTrigger className="h-7 text-xs w-[11rem]">
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os vendedores</SelectItem>
                {vendedores.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="w-px h-5 bg-border mx-1" />

            <Button onClick={handleApplyFilters} size="sm" className="h-7 px-3 text-xs">
              Filtrar
            </Button>
            <Button onClick={handleClearFilters} variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground">
              Limpar
            </Button>
          </div>
        </div>

        {/* Distribution Toggles */}
        <div className="flex gap-2">
          <Button
            variant={showEstadoChart ? "default" : "outline"}
            size="sm"
            onClick={() => setShowEstadoChart(!showEstadoChart)}
            className="h-7 text-xs gap-1"
          >
            <MapPin className="h-3 w-3" />
            Por Estado
          </Button>
          <Button
            variant={showVendedorChart ? "default" : "outline"}
            size="sm"
            onClick={() => setShowVendedorChart(!showVendedorChart)}
            className="h-7 text-xs gap-1"
          >
            <Users className="h-3 w-3" />
            Por Vendedor
          </Button>
        </div>

        {/* Distribution Charts - Compact inline style */}
        {showEstadoChart && summary?.byEstado && summary.byEstado.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 py-2">
            <span className="text-xs text-muted-foreground mr-1">Estados:</span>
            {summary.byEstado.slice(0, 15).map((item) => (
              <button
                key={item.estado}
                type="button"
                onClick={() => handleEstadoClick(item.estado)}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all ${selectedEstado === item.estado
                  ? "bg-blue-600 text-white"
                  : "bg-secondary text-foreground/80 hover:bg-border"
                  }`}
              >
                <span className="font-medium">{item.estado}</span>
                <span className={`${selectedEstado === item.estado ? "text-blue-100" : "text-muted-foreground"}`}>
                  {item.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {showVendedorChart && summary?.byVendedor && summary.byVendedor.length > 0 && (
          <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground/80 mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              Distribuição por Vendedor
              <span className="text-xs font-normal text-muted-foreground/60 ml-2">Clique para filtrar</span>
            </h3>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {summary.byVendedor.slice(0, 12).map((item, idx) => (
                <button
                  key={item.vendedorId ?? idx}
                  type="button"
                  onClick={() => handleVendedorClick(item.vendedorId)}
                  className={`bg-secondary rounded-md p-3 border border-green-500 text-left transition-all hover:border-blue-300 hover:bg-blue-50 ${selectedVendedor === item.vendedorId ? "border-blue-400 bg-blue-50 ring-1 ring-blue-200" : "border-slate-100"
                    }`}
                >
                  <p className="text-xs font-semibold text-foreground/80 truncate mb-2">{item.vendedorName}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] uppercase text-foreground">Total</p>
                      <p className="text-sm font-bold text-foreground">{item.count}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(item.totalValor)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-emerald-600">Aprovados</p>
                      <p className="text-sm font-bold text-emerald-600">{item.countAprovado}</p>
                      <p className="text-xs text-emerald-500">{formatCurrency(item.totalValorAprovado)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between">
              {error}
              <Button variant="outline" size="sm" onClick={() => fetchOrcamentos(page)}>
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Table */}
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary hover:bg-secondary">
                  <TableHead className="text-xs font-semibold text-muted-foreground w-10">Ver</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground w-14">ID</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground w-20">Data</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground w-70">Cliente</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground w-24">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Vendedor</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground w-24">Valor</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Empresa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orcamentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-sm text-muted-foreground">
                      Nenhum orçamento encontrado com os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  orcamentos.map((orc, idx) => (
                    <TableRow
                      key={orc.id}
                      className={`hover:bg-secondary ${idx % 2 === 0 ? "bg-card" : "bg-secondary/50"}`}
                    >
                      <TableCell className="py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            setSelectedOrcamentoId(orc.id)
                            setSelectedOrcamentoClienteId(orc.cliente.id)
                          }}
                        >
                          <Eye className="h-4 w-4 text-blue-600" />
                        </Button>
                      </TableCell>
                      <TableCell className="py-2 text-xs font-mono text-foreground">#{orc.id}</TableCell>
                      <TableCell className="py-2 text-xs text-foreground">{formatDate(orc.createdAt)}</TableCell>
                      <TableCell className="py-2 max-w-[176px]">
                        <button
                          type="button"
                          onClick={() => setSelectedClienteId(orc.cliente.id)}
                          className="text-xs font-medium text-foreground hover:text-blue-600 hover:underline transition-colors text-left truncate block w-full"
                          title={orc.cliente.nomeSindico || orc.cliente.razaoSocial}
                        >
                          {orc.cliente.nomeSindico || formatRazaoSocial(orc.cliente.razaoSocial)}
                        </button>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge
                          className={`text-xs ${statusStyles[orc.status ?? ""] ?? "bg-secondary0 text-white"}`}
                        >
                          {statusLabels[orc.status ?? ""] ?? orc.status ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-xs text-foreground">
                        {orc.vendedor?.name ?? "—"}
                      </TableCell>
                      <TableCell className="py-2 text-xs font-semibold text-foreground text-left">
                        {formatCurrency(orc.totalValor)}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-foreground">
                        {orc.empresa?.id ? `Unidade ${orc.empresa.id}` : "—"}
                      </TableCell>

                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Mostrando {orcamentos.length === 0 ? "0" : `${startItem}-${endItem}`} de {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1 || loading}
              >
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">
                Página {pagination.page} de {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= pagination.totalPages || loading}
              >
                Próxima
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Cliente Detail Dialog */}
      <ClienteDetailDialog
        clienteId={selectedClienteId !== null ? String(selectedClienteId) : ""}
        open={selectedClienteId !== null}
        onClose={() => setSelectedClienteId(null)}
      />

      {/* Orçamento Detail Dialog */}
      <EditarOrcamentoDialog
        orcamentoId={selectedOrcamentoId}
        clienteId={selectedOrcamentoClienteId ?? 0}
        open={selectedOrcamentoId !== null}
        onClose={() => {
          setSelectedOrcamentoId(null)
          setSelectedOrcamentoClienteId(null)
        }}
        onSuccess={() => fetchOrcamentos(page)}
      />
    </DashboardLayout>
  )
}

