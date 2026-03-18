"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Eye, FileText, Filter, Users, MapPin, FileDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { estados_cidades } from "@/components/leads/leads-geral"
import { cn } from "@/lib/utils"
import { formatRazaoSocial } from "@/lib/formatters"
import { type PeriodType, getNowBrazil, getComponentsBrazil, createBrazilDate } from "@/lib/date-utils"
import { ClienteDetailDialog } from "@/components/leads/cliente-detail-dialog"
import { PedidoDetailsDialog, type PedidoHistoricoItem } from "@/components/leads/pedido-details-dialog"
import { Can } from "@/components/auth/can"
import { PedidoStatusMapDialog, getPedidoStatusLabel, getPedidoStatusDescription } from "@/components/pedidos/pedido-status-map-dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ExportARTDialog } from "@/components/pedidos/export-art-dialog"

// Roles que podem ver métricas financeiras e distribuições
const FINANCIAL_ROLES = ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] as const

type PedidoItem = {
  id: number
  createdAt: string
  status: string | null
  tipoEspecial?: "OS" | null
  geradoART: boolean | null
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
  contratoId?: number | null
  isContratoVigente?: boolean
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
  totalValueConcluido: number
  byStatus: Record<string, number>
  byStatusFiltered: Record<string, number>
  byEstado: Array<{ estado: string; count: number; totalValor: number }>
  byVendedor: Array<{
    vendedorId: string | null
    vendedorName: string
    count: number
    totalValor: number
    countConcluido: number
    totalValorConcluido: number
  }>
}

type Vendedor = { id: string; name: string }

const statusLabels: Record<string, string> = {
  AGUARDANDO: "Aguardando marcar visita",
  AGENDADO: "Visita agendada",
  EXECUCAO: "Visita em execução",
  SAC: "SAC",
  AGUARDANDO_APROVACAO_SUPERVISAO: "Aguardando aprovação da supervisão",
  AGUARDANDO_APROVACAO_FINAL: "Aguardando aprovação final",
  CONCLUIDO: "Concluído",
  ANALISE_CANCELAMENTO: "Análise de cancelamento",
  ANALISE_CANCELAMENTO_SUPERVISAO: "Análise cancelamento supervisão",
  CANCELADO: "Cancelado",
}

// Badge com background sólido - todos cinza exceto CONCLUIDO (verde) e CANCELADO (vermelho)
const statusStyles: Record<string, string> = {
  AGUARDANDO: "bg-secondary0 text-white",
  AGENDADO: "bg-secondary0 text-white",
  EXECUCAO: "bg-secondary0 text-white",
  CONCLUIDO: "bg-emerald-500 text-white",
  CANCELADO: "bg-red-500 text-white",
  SAC: "bg-secondary0 text-white",
  AGUARDANDO_APROVACAO_SUPERVISAO: "bg-secondary0 text-white",
  AGUARDANDO_APROVACAO_FINAL: "bg-secondary0 text-white",
  ANALISE_CANCELAMENTO: "bg-secondary0 text-white",
  ANALISE_CANCELAMENTO_SUPERVISAO: "bg-secondary0 text-white",
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
})

const formatCurrency = (value: number) => currencyFormatter.format(value)

const getArtStatus = (value: boolean | null) => {
  if (value === true) {
    return { label: "S", className: "text-emerald-600" }
  }
  if (value === false) {
    return { label: "N", className: "text-amber-600" }
  }
  return { label: "—", className: "text-muted-foreground/60" }
}

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

export function PedidosRelatorio() {
  const [pedidos, setPedidos] = useState<PedidoItem[]>([])
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

  const brNow = getNowBrazil()
  const [periodo, setPeriodo] = useState<PeriodType>("mes")
  const [selectedEstado, setSelectedEstado] = useState("all")
  const [selectedCidade, setSelectedCidade] = useState("all")
  const [searchNome, setSearchNome] = useState("")
  const [bairroInput, setBairroInput] = useState("")
  const [selectedVendedor, setSelectedVendedor] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedMonth, setSelectedMonth] = useState(String(brNow.month))
  const [selectedYear, setSelectedYear] = useState(String(brNow.year))
  const [selectedDay, setSelectedDay] = useState(String(brNow.day))

  // Bairro applied (only updated when clicking filter button)
  const [appliedBairro, setAppliedBairro] = useState("")
  const [appliedSearchNome, setAppliedSearchNome] = useState("")

  // Data for selects
  const [vendedores, setVendedores] = useState<Vendedor[]>([])

  // UI state
  const [showEstadoChart, setShowEstadoChart] = useState(false)
  const [showVendedorChart, setShowVendedorChart] = useState(false)
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null)
  const [selectedPedidoId, setSelectedPedidoId] = useState<number | null>(null)
  const [selectedPedidoData, setSelectedPedidoData] = useState<PedidoHistoricoItem | null>(null)
  const [showExportARTDialog, setShowExportARTDialog] = useState(false)
  const [statusMapOpen, setStatusMapOpen] = useState(false)
  const [statusMapStatus, setStatusMapStatus] = useState<string | null>(null)

  // ART Preview Count
  const [artPreviewCount, setArtPreviewCount] = useState<number>(0)

  // Fetch ART preview function
  const fetchArtPreview = useCallback(async () => {
    try {
      const res = await fetch(`/api/pedidos/export-art`)
      const data = await res.json()
      if (res.ok && typeof data.quantidadePedidos === 'number') {
        setArtPreviewCount(data.quantidadePedidos)
      }
    } catch (err) {
      console.error("Erro ao buscar preview de ART", err)
    }
  }, [])

  // Fetch ART preview on mount
  useEffect(() => {
    fetchArtPreview()
  }, [fetchArtPreview])

  // Click handlers for distribution charts (toggle: click again to remove filter)
  const handleEstadoClick = (estado: string) => {
    const sigla = estado === "Não informado" ? "all" : estadoOptions.find(e => e.sigla === estado || e.nome === estado)?.sigla ?? estado
    const newSigla = selectedEstado === sigla ? "all" : sigla
    setSelectedEstado(newSigla)
    setSelectedCidade("all")
    setPage(1)
  }

  const handleVendedorClick = (vendedorId: string | null) => {
    // null significa "sem vendedor" - usa "none" como valor do filtro
    const id = vendedorId === null ? "none" : vendedorId
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

  const weeksOptions = useMemo(() => {
    if (periodo !== "semana") return []
    const y = parseInt(selectedYear, 10)
    const m = parseInt(selectedMonth, 10)
    if (isNaN(y) || isNaN(m)) return []

    const weeks = []
    let currentDate = createBrazilDate(y, m, 1)
    currentDate = new Date(currentDate.getTime() + 12 * 60 * 60 * 1000)

    let dayOfWeek = currentDate.getDay() // 0 = Domingo
    let currentSunday = new Date(currentDate.getTime() - dayOfWeek * 24 * 60 * 60 * 1000)

    for (let i = 0; i < 6; i++) {
      const sComps = getComponentsBrazil(currentSunday)
      // Parar se o domingo for de um mês futuro
      if (sComps.month !== m && sComps.year === y && i > 0) {
        if (sComps.month > m || (m === 12 && sComps.month === 1)) {
          break;
        }
      }
      // Parar se o domingo mudou de ano (ex: prevendo limite pro próximo ano)
      if (sComps.year > y) break;

      const saturday = new Date(currentSunday.getTime() + 6 * 24 * 60 * 60 * 1000)
      const eComps = getComponentsBrazil(saturday)

      let referenceDay = sComps.day
      if (sComps.month !== m) {
        referenceDay = 1
      }

      const label = `${String(sComps.day).padStart(2, "0")}/${String(sComps.month).padStart(2, "0")} - ${String(eComps.day).padStart(2, "0")}/${String(eComps.month).padStart(2, "0")}`
      weeks.push({ value: String(referenceDay), label })

      currentSunday = new Date(currentSunday.getTime() + 7 * 24 * 60 * 60 * 1000)
    }
    return weeks
  }, [periodo, selectedYear, selectedMonth])

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

  const fetchPedidos = useCallback(
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
        if (selectedStatus !== "all") params.set("status", selectedStatus)
        // Year is always required
        params.set("year", selectedYear)
        params.set("month", selectedMonth)
        params.set("day", selectedDay)
        params.set("periodo", periodo)

        const response = await fetch(`/api/pedidos/list?${params.toString()}`)
        if (!response.ok) {
          throw new Error("Erro ao carregar pedidos")
        }

        const payload = await response.json()
        setPedidos(payload.data ?? [])
        setPagination(payload.pagination ?? { page: 1, pageSize: 50, total: 0, totalPages: 1, hasNextPage: false })
        setSummary(payload.summary ?? null)
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : "Erro desconhecido")
      } finally {
        setLoading(false)
      }
    },
    [selectedEstado, selectedCidade, appliedSearchNome, appliedBairro, selectedVendedor, selectedStatus, selectedMonth, selectedYear, selectedDay, periodo],
  )

  // Auto-fetch when filters change (except bairroInput which requires clicking filter)
  useEffect(() => {
    fetchPedidos(page)
  }, [fetchPedidos, page])

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
    setSelectedStatus("all")
    setSelectedMonth(String(brNow.month))
    setSelectedYear(String(brNow.year))
    setSelectedDay(String(brNow.day))
    setPeriodo("mes")
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

  const handleStatusChange = (value: string) => {
    setSelectedStatus(value)
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

  const handleDayChange = (value: string) => {
    setSelectedDay(value)
    setPage(1)
  }

  const handlePeriodoChange = (value: string) => {
    setPeriodo(value as PeriodType)
    setPage(1)
  }

  const startItem = pedidos.length > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0
  const endItem = pedidos.length > 0 ? startItem + pedidos.length - 1 : 0

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
  }

  const openPedidoDialog = (pedido: PedidoItem) => {
    setSelectedPedidoId(pedido.id)
    // Passamos apenas o ID para forçar o fetch dos dados completos
    // (se passarmos status, o dialog assume que temos dados completos e não busca da API)
    setSelectedPedidoData({
      id: pedido.id,
      itens: [],
    })
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6 text-blue-600" />
              Relatório de Pedidos
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Visualize e analise todos os pedidos do sistema
            </p>
          </div>
          <Can roles={["MASTER", "ADMINISTRADOR", "FINANCEIRO", "SUPERVISOR", "VENDEDOR"]}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExportARTDialog(true)}
              className="gap-2"
            >
              <FileDown className="h-4 w-4" />
              Exportar para ART
              {artPreviewCount > 0 && (
                <span className="ml-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-sm">
                  {artPreviewCount}
                </span>
              )}
            </Button>
          </Can>
        </div>

        {/* Summary Cards - Valor Fechado = total sem cancelados */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
          <div className="bg-card rounded-lg border border-border p-3 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Pedidos</p>
            <p className="text-xl font-bold text-foreground mt-1">{pagination.total}</p>
          </div>
          <Can roles={[...FINANCIAL_ROLES]}>
            <div className="bg-card rounded-lg border border-border p-3 shadow-sm">
              <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Valor Fechado</p>
              <p className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(summary?.totalValue ?? 0)}</p>
            </div>
          </Can>
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
              placeholder="Buscar por nome ou número"
              value={searchNome}
              onChange={(e) => setSearchNome(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-7 text-xs w-[14rem]"
            />

            <Select value={periodo} onValueChange={handlePeriodoChange}>
              <SelectTrigger className="h-7 text-xs w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dia">Dia</SelectItem>
                <SelectItem value="semana">Semana</SelectItem>
                <SelectItem value="mes">Mês</SelectItem>
                <SelectItem value="ano">Ano</SelectItem>
                <SelectItem value="total">Total</SelectItem>
              </SelectContent>
            </Select>

            <div className="w-px h-5 bg-border mx-0.5" />

            {periodo !== "total" && (
              <Select value={selectedYear} onValueChange={handleYearChange}>
                <SelectTrigger className="h-7 text-xs w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {periodo !== "ano" && periodo !== "total" && (
              <Select value={selectedMonth} onValueChange={handleMonthChange}>
                <SelectTrigger className="h-7 text-xs w-[90px]">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {periodo === "dia" && (
              <Select value={selectedDay} onValueChange={handleDayChange}>
                <SelectTrigger className="h-7 text-xs w-[60px]">
                  <SelectValue placeholder="Dia" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
                    <SelectItem key={d} value={d}>{d.padStart(2, "0")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {periodo === "semana" && (
              <Select value={selectedDay} onValueChange={handleDayChange}>
                <SelectTrigger className="h-7 text-xs w-[120px]">
                  <SelectValue placeholder="Semana" />
                </SelectTrigger>
                <SelectContent>
                  {weeksOptions.map((w) => (
                    <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="w-px h-5 bg-border mx-1" />

            <Select value={selectedStatus} onValueChange={handleStatusChange}>
              <SelectTrigger className="h-7 text-xs w-[10rem]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
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
                <SelectItem value="none">Sem vendedor</SelectItem>
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

        {/* Distribution Toggles - apenas para roles financeiras */}
        <Can roles={[...FINANCIAL_ROLES]}>
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
        </Can>

        {/* Distribution Charts - apenas para roles financeiras */}
        <Can roles={[...FINANCIAL_ROLES]}>
          {showEstadoChart && summary?.byEstado && summary.byEstado.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 py-2">
              <span className="text-xs text-muted-foreground mr-1">Estados:</span>
              {summary.byEstado.slice(0, 15).map((item) => (
                <button
                  key={item.estado}
                  type="button"
                  onClick={() => handleEstadoClick(item.estado)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-all border ${selectedEstado === item.estado
                    ? "bg-blue-600 text-white border-blue-700"
                    : "bg-card text-foreground/80 border-border shadow-sm hover:bg-secondary hover:border-slate-300"
                    }`}
                >
                  <span className="font-medium">{item.estado}</span>
                  <span className={`${selectedEstado === item.estado ? "text-blue-100" : "text-muted-foreground"}`}>
                    {item.count}
                  </span>
                  <span className={`text-[10px] ${selectedEstado === item.estado ? "text-blue-200" : "text-emerald-600"}`}>
                    {formatCurrency(item.totalValor)}
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
                        <p className="text-[10px] uppercase text-emerald-600">Concluídos</p>
                        <p className="text-sm font-bold text-emerald-600">{item.countConcluido}</p>
                        <p className="text-xs text-emerald-500">{formatCurrency(item.totalValorConcluido)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Can>

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between">
              {error}
              <Button variant="outline" size="sm" onClick={() => fetchPedidos(page)}>
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
                  <TableHead className="text-xs font-semibold text-muted-foreground w-70">Cliente</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground w-28">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground w-12 text-center">ART</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Vendedor</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground w-24">Valor</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Empresa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-sm text-muted-foreground">
                      Nenhum pedido encontrado com os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  pedidos.map((ped, idx) => (
                    <TableRow
                      key={ped.id}
                      className={`hover:bg-secondary ${idx % 2 === 0 ? "bg-card" : "bg-secondary/50"}`}
                    >
                      <TableCell className="py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => openPedidoDialog(ped)}
                        >
                          <Eye className="h-4 w-4 text-blue-600" />
                        </Button>
                      </TableCell>
                      <TableCell className="py-2 text-xs font-mono text-foreground">#{ped.id}</TableCell>
                      <TableCell className="py-2 max-w-[176px]">
                        <button
                          type="button"
                          onClick={() => setSelectedClienteId(ped.cliente.id)}
                          className="text-xs font-medium text-foreground hover:text-blue-600 hover:underline transition-colors text-left truncate block w-full"
                          title={ped.cliente.nomeSindico || ped.cliente.razaoSocial}
                        >
                          {ped.cliente.nomeSindico || formatRazaoSocial(ped.cliente.razaoSocial)}
                        </button>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex flex-col items-start gap-1">
                          {ped.contratoId && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] h-4 px-1 uppercase font-bold",
                                ped.isContratoVigente
                                  ? "bg-blue-100 text-blue-700 border-blue-200"
                                  : "bg-secondary text-muted-foreground border-border"
                              )}
                            >
                              Contrato
                            </Badge>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                className={`text-xs cursor-pointer ${statusStyles[ped.status ?? ""] ?? "bg-secondary0 text-white"}`}
                                onClick={() => {
                                  setStatusMapStatus(ped.status ?? null)
                                  setStatusMapOpen(true)
                                }}
                              >
                                {getPedidoStatusLabel(ped.status ?? null)}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>{getPedidoStatusDescription(ped.status ?? null)}</TooltipContent>
                          </Tooltip>
                          {ped.tipoEspecial === "OS" ? (
                            <span className="mt-0.5 text-[10px] text-blue-600">Ord. Serv.</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-xs text-center font-medium">
                        <span className={getArtStatus(ped.geradoART).className}>
                          {getArtStatus(ped.geradoART).label}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 text-xs text-foreground">
                        {ped.vendedor?.name ?? "—"}
                      </TableCell>
                      <TableCell className="py-2 text-xs font-semibold text-foreground text-left">
                        {formatCurrency(ped.totalValor)}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-foreground">
                        {ped.empresa?.id ? `Unidade ${ped.empresa.id}` : "—"}
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
              Mostrando {pedidos.length === 0 ? "0" : `${startItem}-${endItem}`} de {pagination.total}
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

      {/* Pedido Detail Dialog */}
      <PedidoDetailsDialog
        pedidoData={selectedPedidoData}
        open={selectedPedidoId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPedidoId(null)
            setSelectedPedidoData(null)
          }
        }}
        onSuccess={async () => {
          await fetchPedidos(page)
        }}
      />

      <ExportARTDialog
        open={showExportARTDialog}
        onOpenChange={setShowExportARTDialog}
        onSuccess={() => {
          fetchPedidos(page)
          fetchArtPreview()
        }}
      />

      <PedidoStatusMapDialog
        open={statusMapOpen}
        onOpenChange={setStatusMapOpen}
        currentStatus={statusMapStatus}
      />
    </DashboardLayout>
  )
}

