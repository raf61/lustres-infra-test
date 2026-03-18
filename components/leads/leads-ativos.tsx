"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { formatCNPJ, formatRazaoSocial } from "@/lib/formatters"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Building2, MapPin, Calendar, Edit, AlertCircle, Check, ChevronsUpDown, Users, Loader2 } from "lucide-react"
import { ClienteDetailDialog } from "@/components/leads/cliente-detail-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { estados_cidades } from "./leads-geral"
import { LeadsFilterCard } from "./leads-filter-card"
import { LeadsStateDistribution } from "./leads-state-distribution"
import { LeadsVendorDistribution } from "./leads-vendor-distribution"
import { CriarOrcamentoDialog } from "@/components/orcamentos/criar-orcamento-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { CLIENTS_MAX_LIMIT } from "@/lib/constants"

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

const getMesLabel = (value: string | number | null | undefined): string => {
  if (!value) return "-"
  const monthNumber =
    typeof value === "string"
      ? String(value).padStart(2, "0")
      : String(value).padStart(2, "0")
  return MESES.find((mes) => mes.value === monthNumber)?.label ?? "-"
}

const PAGE_SIZE = 30

const DEFAULT_SUMMARY = {
  totalActive: "--",
  totalOverdue: "--",
  retentionRate: "--",
}

export function LeadsAtivos() {
  type RawLeadAtivo = {
    id: number
    cnpj: string
    razaoSocial: string
    logradouro: string | null
    numero: string | null
    complemento: string | null
    bairro: string | null
    cidade: string | null
    estado: string | null
    ultimaManutencao: string | null
    categoria: string | null
    vendedor?: { name: string | null } | null
    isContratoVigente: boolean
  }

  type LeadAtivo = {
    id: string
    cnpj: string
    nomeCondominio: string
    razaoSocial: string
    endereco: string
    bairro?: string
    cidade?: string
    estado?: string
    ultimaManutencao: string | null
    proximaManutencao: string | null
    renovacaoMes: number | null
    categoria: string
    vendedor?: string | null
    isContratoVigente: boolean
  }

  type MonthlyCounts = Record<string, number>

  type CategoriaFiltro = "explorado" | "ativo" | "agendado" | "perdida"

  type FetchFilters = {
    search?: string
    cnpj?: string
    estado?: string
    cidade?: string
    bairro?: string
    categoria?: CategoriaFiltro
    vendedorId?: string
    semVendedor?: boolean
    limit?: number
    contratoVigente?: string
  }

  const generalSearchRef = useRef<HTMLInputElement>(null)
  const cnpjSearchRef = useRef<HTMLInputElement>(null)
  const bairroInputRef = useRef<HTMLInputElement>(null)
  const limiteInputRef = useRef<HTMLInputElement>(null)
  const [selectedEstado, setSelectedEstado] = useState("all")
  const [selectedCidade, setSelectedCidade] = useState("all")
  const [selectedContratoVigente, setSelectedContratoVigente] = useState("all")
  const [submittedGeneralSearch, setSubmittedGeneralSearch] = useState("")
  const [submittedCnpjSearch, setSubmittedCnpjSearch] = useState("")
  const [submittedBairro, setSubmittedBairro] = useState("")
  const [submittedEstado, setSubmittedEstado] = useState("all")
  const [submittedCidade, setSubmittedCidade] = useState("all")
  const [submittedContratoVigente, setSubmittedContratoVigente] = useState("all")
  const [submittedLimit, setSubmittedLimit] = useState<number | null>(null)
  const [selectedCliente, setSelectedCliente] = useState<string | null>(null)
  const [orcamentoCliente, setOrcamentoCliente] = useState<{ id: string; nome: string } | null>(null)
  // null = ano todo, string = mês específico
  const [mesSelecionado, setMesSelecionado] = useState<string | null>(String(new Date().getMonth() + 1).padStart(2, "0"))
  const [anoSelecionado, setAnoSelecionado] = useState<number>(new Date().getFullYear())
  const [distributionType, setDistributionType] = useState<"none" | "state" | "vendor">("none")
  const [page, setPage] = useState(1)
  const [leads, setLeads] = useState<LeadAtivo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [monthlyCounts, setMonthlyCounts] = useState<MonthlyCounts>(() =>
    Object.fromEntries(MESES.map((mes) => [mes.value, 0]))
  )
  const [totalAtivosGeral, setTotalAtivosGeral] = useState(0)
  const [summary, setSummary] = useState(DEFAULT_SUMMARY)
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 30,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
  })

  // Lost Renewals Mode
  const [showLostRenewals, setShowLostRenewals] = useState(false)

  const latestRequestRef = useRef(0)
  const previousFiltersRef = useRef<{ filters: FetchFilters; month: string; year: number } | null>(null)
  const skipNextFetchRef = useRef(false)

  // Vendor filter states
  const [vendedores, setVendedores] = useState<{ id: string; name: string }[]>([])
  const [vendedorFiltro, setVendedorFiltro] = useState("all")
  const [semVendedor, setSemVendedor] = useState(false)
  const [vendedorFiltroOpen, setVendedorFiltroOpen] = useState(false)

  // Selection states for mass assignment
  const [selectAll, setSelectAll] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [excludedIds, setExcludedIds] = useState<string[]>([])
  const [vendedorAtribuicao, setVendedorAtribuicao] = useState<string>("")
  const [confirmAssignOpen, setConfirmAssignOpen] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [skippedClientsOpen, setSkippedClientsOpen] = useState(false)
  const [skippedClients, setSkippedClients] = useState<{ id: number; cnpj: string; razaoSocial: string }[]>([])

  const { toast } = useToast()

  const openCriarOrcamento = (lead: LeadAtivo) => {
    setOrcamentoCliente({
      id: lead.id,
      nome: lead.nomeCondominio || lead.razaoSocial,
    })
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
    []
  )

  const selectedEstadoInfo =
    selectedEstado === "all"
      ? null
      : estadoOptions.find((estado) => estado.sigla === selectedEstado) ?? null

  const cidadeOptions = selectedEstadoInfo?.cidades ?? []

  // Load vendedores on mount
  useEffect(() => {
    const loadVendedores = async () => {
      try {
        const response = await fetch("/api/vendedores")
        if (response.ok) {
          const result = await response.json()
          setVendedores(result.data ?? [])
        }
      } catch (err) {
        console.error("Erro ao carregar vendedores:", err)
      }
    }
    loadVendedores()
  }, [])

  const activeFilters = useMemo<FetchFilters>(() => {
    const filters: FetchFilters = { categoria: showLostRenewals ? "perdida" : "ativo" }
    const normalizedSearch = submittedGeneralSearch.trim()
    if (normalizedSearch.length > 0) {
      filters.search = normalizedSearch
    }
    const sanitizedCnpj = submittedCnpjSearch.trim()
    if (sanitizedCnpj.length > 0) {
      filters.cnpj = sanitizedCnpj
    }
    if (submittedEstado !== "all") {
      filters.estado = submittedEstado
    }
    if (submittedCidade !== "all") {
      filters.cidade = submittedCidade
    }
    const normalizedBairro = submittedBairro.trim()
    if (normalizedBairro.length > 0) {
      filters.bairro = normalizedBairro
    }
    if (vendedorFiltro !== "all") {
      filters.vendedorId = vendedorFiltro
    }
    if (semVendedor) {
      filters.semVendedor = true
    }
    if (submittedLimit && submittedLimit > 0) {
      filters.limit = submittedLimit
    }
    if (submittedContratoVigente !== "all") {
      filters.contratoVigente = submittedContratoVigente
    }
    return filters
  }, [
    showLostRenewals,
    submittedGeneralSearch,
    submittedCnpjSearch,
    submittedEstado,
    submittedCidade,
    submittedBairro,
    vendedorFiltro,
    semVendedor,
    submittedLimit,
  ])

  const filtersSignature = useMemo(
    () => ({ filters: activeFilters, month: mesSelecionado ?? "", year: anoSelecionado }),
    [activeFilters, mesSelecionado, anoSelecionado]
  )

  const loadMonthlyCounts = useCallback(async (filters: FetchFilters, year: number) => {
    // Atualiza contagens tanto para "ativo" quanto para "perdida" (renovações perdidas).
    if (filters.categoria !== "ativo" && filters.categoria !== "perdida") return
    try {
      const params = new URLSearchParams()
      params.set("categoria", filters.categoria)
      params.set("year", String(year))

      if (filters.search) params.set("search", String(filters.search))
      if (filters.cnpj) params.set("cnpj", String(filters.cnpj))
      if (filters.estado) params.set("estado", String(filters.estado))
      if (filters.cidade) params.set("cidade", String(filters.cidade))
      if (filters.bairro) params.set("bairro", String(filters.bairro))
      if (filters.vendedorId) params.set("vendedorId", String(filters.vendedorId))
      if (filters.semVendedor) params.set("semVendedor", "true")

      const res = await fetch(`/api/clients/stats/by-month?${params.toString()}`)
      if (!res.ok) return
      const json = await res.json()
      if (json?.counts && typeof json.counts === "object") {
        setMonthlyCounts((prev) => ({ ...prev, ...json.counts }))
      }
    } catch (err) {
      console.error("Erro ao carregar contagens por mês:", err)
    }
  }, [])

  // Carrega as contagens dos meses (badges) já na entrada e quando filtros/ano mudarem,
  // independente do mês atualmente selecionado.
  useEffect(() => {
    loadMonthlyCounts(activeFilters, anoSelecionado)
  }, [activeFilters, anoSelecionado, loadMonthlyCounts])

  const handleEstadoChange = (value: string) => {
    setSelectedEstado(value)
    setSelectedCidade("all")
  }

  const handleCidadeChange = (value: string) => {
    setSelectedCidade(value)
  }

  const handleSearchSubmit = useCallback(() => {
    const generalValue = generalSearchRef.current?.value ?? ""
    const cnpjValue = cnpjSearchRef.current?.value ?? ""
    const bairroValue = bairroInputRef.current?.value ?? ""
    const limiteValue = limiteInputRef.current?.value ?? ""
    const parsedLimit = Number.parseInt(limiteValue, 10)

    if (!Number.isNaN(parsedLimit) && parsedLimit > CLIENTS_MAX_LIMIT) {
      toast({ title: `Limite máximo é ${CLIENTS_MAX_LIMIT}`, variant: "destructive" })
      return
    }

    setSubmittedGeneralSearch(generalValue.trim())
    setSubmittedCnpjSearch(cnpjValue.replace(/\D/g, ""))
    setSubmittedBairro(bairroValue.trim())
    setSubmittedEstado(selectedEstado)
    setSubmittedCidade(selectedCidade)
    const sanitizedLimit =
      Number.isNaN(parsedLimit) || parsedLimit <= 0 ? null : Math.min(parsedLimit, CLIENTS_MAX_LIMIT)
    setSubmittedLimit(sanitizedLimit)
    setSubmittedContratoVigente(selectedContratoVigente)
    resetSelection()
  }, [selectedEstado, selectedCidade])

  // Selection functions
  const resetSelection = useCallback(() => {
    setSelectAll(false)
    setSelectedIds([])
    setExcludedIds([])
    setVendedorAtribuicao("")
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectAll) {
      setSelectAll(false)
      setSelectedIds([])
      setExcludedIds([])
    } else {
      setSelectAll(true)
      setSelectedIds([])
      setExcludedIds([])
    }
  }, [selectAll])

  const toggleLead = useCallback(
    (leadId: string) => {
      if (selectAll) {
        if (excludedIds.includes(leadId)) {
          setExcludedIds((prev) => prev.filter((id) => id !== leadId))
        } else {
          setExcludedIds((prev) => [...prev, leadId])
        }
      } else {
        if (selectedIds.includes(leadId)) {
          setSelectedIds((prev) => prev.filter((id) => id !== leadId))
        } else {
          setSelectedIds((prev) => [...prev, leadId])
        }
      }
    },
    [selectAll, excludedIds, selectedIds]
  )

  const isLeadSelected = useCallback(
    (leadId: string) => {
      if (selectAll) {
        return !excludedIds.includes(leadId)
      }
      return selectedIds.includes(leadId)
    },
    [selectAll, excludedIds, selectedIds]
  )

  const totalSelecionados = useMemo(() => {
    if (selectAll) {
      return pagination.total - excludedIds.length
    }
    return selectedIds.length
  }, [selectAll, pagination.total, excludedIds.length, selectedIds.length])

  // Reset selection when filters change
  useEffect(() => {
    resetSelection()
    setConfirmAssignOpen(false)
  }, [activeFilters, mesSelecionado, anoSelecionado, resetSelection])

  const handleAtribuirVendedor = async () => {
    if (!vendedorAtribuicao) {
      toast({ title: "Selecione um vendedor", variant: "destructive" })
      return
    }

    try {
      setAssigning(true)

      // Buscar IDs quando selectAll estiver ativo; caso contrário usar seleção manual
      let idsToAssign: number[] = []

      if (selectAll && pagination.total > 0) {
        const params = new URLSearchParams()
        Object.entries(activeFilters).forEach(([key, value]) => {
          if (value === undefined || value === null || value === "") return
          if (typeof value === "boolean") {
            params.set(key, value ? "true" : "false")
          } else {
            params.set(key, String(value))
          }
        })
        if (mesSelecionado) {
          params.set("month", mesSelecionado)
        }
        params.set("year", String(anoSelecionado))

        const idsResponse = await fetch(`/api/clients/ids?${params.toString()}`)
        if (!idsResponse.ok) {
          throw new Error("Erro ao buscar IDs para atribuição")
        }
        const allIds = (await idsResponse.json()) as number[]
        const excluded = new Set(excludedIds.map((id) => Number(id)))
        idsToAssign = allIds.filter((id) => !excluded.has(id))
      } else {
        idsToAssign = selectedIds.map((id) => Number(id))
      }

      if (idsToAssign.length === 0) {
        toast({ title: "Nenhum cliente para atribuir", variant: "destructive" })
        return
      }

      const payload = {
        vendedorId: vendedorAtribuicao,
        ids: idsToAssign,
      }

      const response = await fetch("/api/clients/atribuir-vendedor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Erro ao atribuir vendedor")
      }

      // Check if there were skipped clients due to Ficha in research
      if (data.skipped > 0 && data.skippedClients?.length > 0) {
        setSkippedClients(data.skippedClients)
        setSkippedClientsOpen(true)
        toast({
          title: "Vendedor atribuído parcialmente",
          description: `${data.updated} cliente(s) atualizado(s). ${data.skipped} ignorado(s) por estarem em pesquisa.`,
        })
      } else {
        toast({
          title: "Vendedor atribuído",
          description: `${data?.updated ?? 0} cliente(s) atualizados.`,
        })
      }

      resetSelection()
      fetchLeadsAtivos(page, activeFilters, mesSelecionado ?? "", anoSelecionado).catch(console.error)
      setConfirmAssignOpen(false)
    } catch (err) {
      console.error(err)
      toast({ title: "Erro ao atribuir vendedor", variant: "destructive" })
    } finally {
      setAssigning(false)
    }
  }

  const fetchLeadsAtivos = useCallback(
    async (requestedPage: number, filters: FetchFilters, month: string, year: number) => {
      const requestId = latestRequestRef.current + 1
      latestRequestRef.current = requestId

      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams()
        params.set("page", String(requestedPage))
        // Se month está vazio, não filtra por mês (ano todo)
        if (month) {
          params.set("month", month)
        }
        params.set("year", String(year))
        Object.entries(filters).forEach(([key, value]) => {
          if (value === undefined || value === null) return
          if (typeof value === "boolean") {
            if (value) params.set(key, "true")
          } else {
            params.set(key, String(value))
          }
        })

        const response = await fetch(`/api/clients?${params.toString()}`)
        if (!response.ok) {
          throw new Error("Erro ao buscar leads ativos")
        }

        const payload = await response.json()
        const rawLeads: RawLeadAtivo[] = Array.isArray(payload.data) ? payload.data : []
        const paginationPayload = payload.pagination ?? {}

        if (requestId !== latestRequestRef.current) {
          return
        }

        const mappedLeads: LeadAtivo[] = rawLeads.map((lead) => {
          const formattedRazao = formatRazaoSocial(lead.razaoSocial)
          const endereco = [lead.logradouro, lead.numero, lead.complemento]
            .filter((part): part is string => Boolean(part && part.trim().length))
            .join(", ")

          const ultimaManutencaoDate = lead.ultimaManutencao ? new Date(lead.ultimaManutencao) : null
          let proximaManutencaoDate: Date | null = null
          if (ultimaManutencaoDate) {
            const date = new Date(ultimaManutencaoDate)
            date.setFullYear(date.getFullYear() + 1)
            proximaManutencaoDate = date
          }

          const renovacaoMes = proximaManutencaoDate ? proximaManutencaoDate.getMonth() + 1 : null

          return {
            id: String(lead.id),
            cnpj: lead.cnpj,
            nomeCondominio: formattedRazao,
            razaoSocial: formattedRazao,
            endereco,
            bairro: lead.bairro ?? undefined,
            cidade: lead.cidade ?? undefined,
            estado: lead.estado ?? undefined,
            ultimaManutencao: ultimaManutencaoDate ? ultimaManutencaoDate.toISOString() : null,
            proximaManutencao: proximaManutencaoDate ? proximaManutencaoDate.toISOString() : null,
            renovacaoMes,
            categoria: lead.categoria ?? "ATIVO",
            vendedor: lead.vendedor?.name ?? null,
            isContratoVigente: lead.isContratoVigente,
          }
        })

        setLeads(mappedLeads)
        if (paginationPayload.page && paginationPayload.page !== requestedPage) {
          skipNextFetchRef.current = true
          setPage(paginationPayload.page)
        }
        setPagination({
          page: paginationPayload.page ?? requestedPage,
          pageSize: paginationPayload.pageSize ?? PAGE_SIZE,
          total: paginationPayload.total ?? mappedLeads.length,
          totalPages: paginationPayload.totalPages ?? 1,
          hasNextPage: paginationPayload.hasNextPage ?? false,
        })
        const totalAtivosPayload = payload?.summary?.ativo ?? 0
        if (!month) {
          setTotalAtivosGeral(totalAtivosPayload)
        } else {
          const summaryParams = new URLSearchParams()
          Object.entries(filters).forEach(([key, value]) => {
            if (value === undefined || value === null || value === "") return
            if (key === "limit") return
            if (typeof value === "boolean") {
              if (value) summaryParams.set(key, "true")
            } else {
              summaryParams.set(key, String(value))
            }
          })
          summaryParams.set("page", "1")
          const summaryResponse = await fetch(`/api/clients?${summaryParams.toString()}`)
          if (summaryResponse.ok) {
            const summaryPayload = await summaryResponse.json()
            if (requestId === latestRequestRef.current) {
              setTotalAtivosGeral(summaryPayload?.summary?.ativo ?? totalAtivosPayload)
            }
          } else {
            setTotalAtivosGeral(totalAtivosPayload)
          }
        }
        setSummary({ ...DEFAULT_SUMMARY })
        setHasLoadedOnce(true)
      } catch (err) {
        if (requestId === latestRequestRef.current) {
          setError(err instanceof Error ? err.message : "Erro desconhecido")
          console.error("Erro ao buscar leads ativos:", err)
        }
      } finally {
        if (requestId === latestRequestRef.current) {
          setLoading(false)
        }
      }
    },
    []
  )

  useEffect(() => {
    const filtersChanged = previousFiltersRef.current !== filtersSignature
    previousFiltersRef.current = filtersSignature

    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false
      return
    }

    if (filtersChanged && page !== 1) {
      setPage(1)
      return
    }

    fetchLeadsAtivos(page, filtersSignature.filters, filtersSignature.month, filtersSignature.year).catch((err) =>
      console.error(err)
    )
  }, [fetchLeadsAtivos, filtersSignature, page])

  const handleMesChange = (mes: string) => {
    // Se clicar no mês já selecionado, desseleciona (mostra ano todo)
    if (mesSelecionado === mes) {
      setMesSelecionado(null)
    } else {
      setMesSelecionado(mes)
    }
    setPage(1)
  }

  const handleAnoChange = (ano: string) => {
    setAnoSelecionado(Number.parseInt(ano, 10))
    setPage(1)
  }

  // Gerar lista de anos (últimos 5 anos até o próximo ano)
  const anosDisponiveis = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const anos: number[] = []
    for (let i = currentYear - 4; i <= currentYear + 1; i++) {
      anos.push(i)
    }
    return anos
  }, [])

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages || newPage === page) return
    setPage(newPage)
  }

  const renovacoesVencidasMes = useMemo(() => {
    const hoje = new Date()
    return leads.filter((lead) => {
      if (!lead.proximaManutencao) return false
      const dataRenovacao = new Date(lead.proximaManutencao)
      return dataRenovacao < hoje
    }).length
  }, [leads])

  const totalRenovacoesMes = pagination.total
  const retentionRateLabel = summary.retentionRate
  const startItem = useMemo(() => {
    if (leads.length === 0) return 0
    return (pagination.page - 1) * pagination.pageSize + 1
  }, [leads.length, pagination.page, pagination.pageSize])
  const endItem = useMemo(() => {
    if (leads.length === 0) return 0
    return Math.min(startItem + leads.length - 1, pagination.total)
  }, [leads.length, pagination.total, startItem])

  const showFullSkeleton = loading && !hasLoadedOnce && !error

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Calendar className="h-10 w-10 text-blue-600" />
              Clientes Ativos - Agenda de Renovação
            </h1>
            <p className="text-lg text-muted-foreground">Calendário de manutenções programadas nos últimos 12 meses</p>
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {showFullSkeleton ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="border-border bg-card">
                  <CardHeader className="pb-3">
                    <Skeleton className="h-4 w-32" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-20" />
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-border bg-card sm:gap-0">
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent className="space-y-4 sm:gap-0">
                <div className="grid grid-cols-6 lg:grid-cols-12 gap-2">
                  {Array.from({ length: 12 }).map((_, index) => (
                    <Skeleton key={index} className="h-9 w-full rounded-md" />
                  ))}
                </div>
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, rowIndex) => (
                    <div key={rowIndex} className="grid grid-cols-5 gap-3">
                      {Array.from({ length: 5 }).map((__, colIndex) => (
                        <Skeleton key={colIndex} className="h-6 w-full" />
                      ))}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 bg-muted/50 p-3 rounded-lg border border-border mb-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="lost-renewals"
                  checked={showLostRenewals}
                  onCheckedChange={setShowLostRenewals}
                  className="data-[state=checked]:bg-red-600"
                />
                <label htmlFor="lost-renewals" className="text-sm font-medium cursor-pointer select-none flex items-center gap-2">
                  <span className={cn(showLostRenewals ? "text-red-600 font-bold" : "text-muted-foreground")}>
                    Modo Renovações Perdidas
                  </span>
                  {showLostRenewals && <Badge variant="destructive" className="text-[10px] h-5">ATIVO</Badge>}
                </label>
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {showLostRenewals
                  ? "Exibindo clientes não-ativos com renovação prevista para o período selecionado."
                  : "Exibindo clientes ativos com renovações programadas."}
              </p>
            </div>

            <div className="flex flex-wrap items-stretch gap-2">
              <Card className="py-0 border border-black/30 bg-card">
                <CardContent className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-muted-foreground leading-tight">
                        Total Ativos (Geral)
                      </div>
                      <div className="text-lg font-bold text-foreground leading-tight">
                        {loading ? "--" : totalAtivosGeral}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="py-0 border border-black/30 bg-card">
                <CardContent className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-muted-foreground leading-tight truncate max-w-[320px]">
                        Renovações em{" "}
                        {mesSelecionado
                          ? MESES.find((m) => m.value === mesSelecionado)?.label
                          : `${anoSelecionado} (Ano Todo)`}
                      </div>
                      <div className="text-lg font-bold text-foreground leading-tight">
                        {totalRenovacoesMes}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <LeadsFilterCard
              totalCount={pagination.total}
              totalLabel="clientes na pesquisa"
              loading={loading}
              cnpjSearchRef={cnpjSearchRef}
              generalSearchRef={generalSearchRef}
              bairroInputRef={bairroInputRef}
              estadoOptions={estadoOptions}
              cidadeOptions={cidadeOptions}
              selectedEstado={selectedEstado}
              selectedCidade={selectedCidade}
              onEstadoChange={handleEstadoChange}
              onCidadeChange={handleCidadeChange}
              onSearchSubmit={handleSearchSubmit}
              onClearFilters={() => {
                if (generalSearchRef.current) generalSearchRef.current.value = ""
                if (cnpjSearchRef.current) cnpjSearchRef.current.value = ""
                if (bairroInputRef.current) bairroInputRef.current.value = ""
                setSubmittedGeneralSearch("")
                setSubmittedCnpjSearch("")
                setSubmittedBairro("")
                setSelectedEstado("all")
                setSelectedCidade("all")
                setSubmittedEstado("all")
                setSubmittedCidade("all")
                setSelectedContratoVigente("all")
                setSubmittedContratoVigente("all")
                setVendedorFiltro("all")
                setSemVendedor(false)
                if (limiteInputRef.current) limiteInputRef.current.value = ""
                setSubmittedLimit(null)
                resetSelection()
              }}
              activeFilters={{
                cnpj: submittedCnpjSearch !== "",
                search: submittedGeneralSearch !== "",
                estado: submittedEstado !== "all",
                cidade: submittedCidade !== "all",
                bairro: submittedBairro !== "",
                contratoVigente: submittedContratoVigente !== "all",
              }}
              onContratoVigenteChange={setSelectedContratoVigente}
              selectedContratoVigente={selectedContratoVigente}
              autoSubmitOnSelectChange={true}
              extraFilters={
                <>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Vendedor</div>
                    <Popover open={vendedorFiltroOpen} onOpenChange={setVendedorFiltroOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={vendedorFiltroOpen} className={cn("h-8 w-[150px] justify-between text-sm bg-background border-border", vendedorFiltro !== "all" && "ring-2 ring-blue-500 border-blue-500")}>
                          {vendedorFiltro === "all" ? "Todos" : vendedores.find((v) => v.id === vendedorFiltro)?.name ?? "..."}
                          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[240px] p-0">
                        <Command>
                          <CommandInput placeholder="Buscar..." />
                          <CommandList>
                            <CommandEmpty>Nenhum encontrado.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem value="all" onSelect={() => { setVendedorFiltro("all"); setVendedorFiltroOpen(false) }}>
                                <Check className={cn("mr-2 h-4 w-4", vendedorFiltro === "all" ? "opacity-100" : "opacity-0")} />
                                Todos
                              </CommandItem>
                              {vendedores.map((vendedor) => (
                                <CommandItem key={vendedor.id} value={vendedor.name} onSelect={() => { setVendedorFiltro(vendedor.id); setVendedorFiltroOpen(false) }}>
                                  <Check className={cn("mr-2 h-4 w-4", vendedorFiltro === vendedor.id ? "opacity-100" : "opacity-0")} />
                                  {vendedor.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Limite</div>
                    <Input placeholder="25" type="number" max={CLIENTS_MAX_LIMIT} ref={limiteInputRef} className={cn("h-8 w-[70px] text-sm bg-background border-border", submittedLimit !== null && "ring-2 ring-blue-500 border-blue-500")} />
                  </div>

                  <div className="flex items-center gap-2 self-end pb-1">
                    <Checkbox id="sem-vendedor" checked={semVendedor} onCheckedChange={(checked) => setSemVendedor(checked === true)} className="h-4 w-4 border-2 border-slate-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600" />
                    <label htmlFor="sem-vendedor" className="text-xs font-medium text-foreground cursor-pointer">Sem vendedor</label>
                  </div>
                </>
              }
            />

            {/* Botões de distribuição */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Distribuição:</span>
              <Button
                variant={distributionType === "state" ? "default" : "outline"}
                size="sm"
                onClick={() => setDistributionType(distributionType === "state" ? "none" : "state")}
                className="h-8"
              >
                <MapPin className="h-4 w-4 mr-1" />
                Por Estado
              </Button>
              <Button
                variant={distributionType === "vendor" ? "default" : "outline"}
                size="sm"
                onClick={() => setDistributionType(distributionType === "vendor" ? "none" : "vendor")}
                className="h-8"
              >
                <Users className="h-4 w-4 mr-1" />
                Por Vendedor
              </Button>
            </div>

            {/* Gráficos de distribuição */}
            {distributionType === "state" && (
              <LeadsStateDistribution
                filters={{
                  categoria: "ativo",
                  ...(mesSelecionado ? { month: mesSelecionado } : {}),
                  year: String(anoSelecionado),
                  ...(submittedEstado !== "all" ? { estado: submittedEstado } : {}),
                  ...(submittedCidade !== "all" ? { cidade: submittedCidade } : {}),
                  ...(submittedBairro ? { bairro: submittedBairro } : {}),
                  ...(vendedorFiltro !== "all" ? { vendedorId: vendedorFiltro } : {}),
                  ...(semVendedor ? { semVendedor: "true" } : {}),
                }}
                title="Distribuição por Estado"
              />
            )}

            {distributionType === "vendor" && (
              <LeadsVendorDistribution
                filters={{
                  categoria: "ativo",
                  ...(mesSelecionado ? { month: mesSelecionado } : {}),
                  year: String(anoSelecionado),
                  ...(submittedEstado !== "all" ? { estado: submittedEstado } : {}),
                  ...(submittedCidade !== "all" ? { cidade: submittedCidade } : {}),
                  ...(submittedBairro ? { bairro: submittedBairro } : {}),
                }}
                title="Distribuição por Vendedor"
              />
            )}

            <Card className="border-border bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold text-foreground">Calendário de Renovação</CardTitle>
                    <CardDescription className="text-base text-muted-foreground">
                      Selecione o mês e o ano para visualizar as renovações planejadas
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-foreground">Ano:</label>
                    <Select value={String(anoSelecionado)} onValueChange={handleAnoChange}>
                      <SelectTrigger className="w-32 border-border">
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
                </div>
              </CardHeader>
              <CardContent>
                {/* Indicador de filtro ativo */}
                {mesSelecionado === null && (
                  <div className="mb-4 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-700">
                      <span className="font-medium">Exibindo ano inteiro ({anoSelecionado})</span>
                      <span className="text-blue-500 ml-2">— Clique em um mês para filtrar</span>
                    </p>
                  </div>
                )}

                {/* Seletor de meses com botões */}
                <div className="grid grid-cols-6 lg:grid-cols-12 w-full gap-0 rounded-md overflow-hidden">
                  {MESES.map((mes, index) => (
                    <button
                      key={mes.value}
                      type="button"
                      onClick={() => handleMesChange(mes.value)}
                      className={`
                        flex items-center justify-center gap-1 px-2 py-2 text-xs font-medium transition-colors
                        ${index > 0 ? "border-l border-black" : ""}
                        ${mesSelecionado === mes.value
                          ? "bg-green-500 text-white"
                          : "bg-slate-100 text-foreground hover:bg-slate-200"
                        }
                      `}
                    >
                      {mes.label.substring(0, 3)}
                      <Badge
                        variant="secondary"
                        className={cn(
                          "ml-1 h-4 px-1 text-[10px] leading-none",
                          mesSelecionado === mes.value ? "bg-green-600 text-white" : "bg-slate-200 text-slate-700",
                          monthlyCounts[mes.value] === 0 && mesSelecionado !== mes.value ? "opacity-70" : ""
                        )}
                      >
                        {monthlyCounts[mes.value] ?? 0}
                      </Badge>
                    </button>
                  ))}
                </div>

                {/* Conteúdo da listagem (funciona para mês selecionado ou ano todo) */}
                <div className="mt-6 space-y-4">
                  {loading ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-sm font-semibold text-muted-foreground">Condomínio</TableHead>
                          <TableHead className="text-sm font-semibold text-muted-foreground min-w-[180px]">Localização</TableHead>
                          <TableHead className="text-sm font-semibold text-muted-foreground">Vendedor</TableHead>
                          <TableHead className="text-sm font-semibold text-muted-foreground">Mês</TableHead>
                          <TableHead className="text-sm font-semibold text-muted-foreground">Última Manutenção</TableHead>
                          <TableHead className="text-sm font-semibold text-muted-foreground">Status</TableHead>
                          <TableHead className="text-sm font-semibold text-muted-foreground">Ações</TableHead>
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
                              <Skeleton className="h-4 w-24" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-24" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-20" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-28" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-6 w-20" />
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Skeleton className="h-8 w-24" />
                                <Skeleton className="h-8 w-8" />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : leads.length === 0 ? (
                    <div className="text-center py-12">
                      <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <p className="text-muted-foreground">
                        Nenhuma renovação programada para {mesSelecionado ? MESES.find(m => m.value === mesSelecionado)?.label : `${anoSelecionado} (ano todo)`}
                      </p>
                    </div>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border hover:bg-transparent">
                            <TableHead className="w-10">
                              <Checkbox
                                checked={selectAll || (selectedIds.length > 0 && selectedIds.length === leads.length)}
                                // @ts-expect-error - indeterminate is a valid prop
                                indeterminate={
                                  !selectAll && selectedIds.length > 0 && selectedIds.length < leads.length
                                    ? true
                                    : selectAll && excludedIds.length > 0
                                      ? true
                                      : undefined
                                }
                                onCheckedChange={toggleSelectAll}
                              />
                            </TableHead>
                            <TableHead className="text-sm font-semibold text-muted-foreground">Condomínio</TableHead>
                            <TableHead className="text-sm font-semibold text-muted-foreground min-w-[180px]">Localização</TableHead>
                            <TableHead className="text-sm font-semibold text-muted-foreground">Vendedor</TableHead>
                            <TableHead className="text-sm font-semibold text-muted-foreground">Mês</TableHead>
                            <TableHead className="text-sm font-semibold text-muted-foreground">Última Manutenção</TableHead>
                            <TableHead className="text-sm font-semibold text-muted-foreground">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {leads.map((lead) => {
                            const proximaDate = lead.proximaManutencao ? new Date(lead.proximaManutencao) : null
                            const ultimaDate = lead.ultimaManutencao ? new Date(lead.ultimaManutencao) : null
                            const isVencida = proximaDate ? proximaDate < new Date() : false

                            return (
                              <TableRow key={lead.id} className="border-b border-black/30 hover:bg-accent/5">
                                <TableCell>
                                  <Checkbox
                                    checked={isLeadSelected(lead.id)}
                                    onCheckedChange={() => toggleLead(lead.id)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                                      <Building2 className="h-5 w-5 text-green-500" />
                                    </div>
                                    <div>
                                      <button
                                        type="button"
                                        onClick={() => setSelectedCliente(lead.id)}
                                        className="font-semibold text-sm text-foreground hover:text-blue-600 hover:underline transition-colors text-left"
                                      >
                                        {lead.nomeCondominio}
                                      </button>
                                      <p className="text-xs text-muted-foreground font-mono flex items-center gap-2">
                                        {formatCNPJ(lead.cnpj)}
                                        {lead.isContratoVigente && (
                                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 h-4 py-0 px-1.5 text-[9px] font-bold">
                                            CONTRATO ATIVO
                                          </Badge>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="w-[180px] min-w-[180px] max-w-[180px]">
                                  <div className="flex items-start gap-1 text-[11px] text-muted-foreground leading-tight">
                                    <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                                    <span className="whitespace-normal break-words">{[lead.bairro, lead.cidade, lead.estado].filter(Boolean).join(", ") || "—"}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-foreground">{lead.vendedor ?? "Não atribuído"}</TableCell>
                                <TableCell className="text-sm text-foreground">{lead.proximaManutencao ? getMesLabel(new Date(lead.proximaManutencao).getMonth() + 1) : getMesLabel(lead.renovacaoMes)}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <Calendar className="h-5 w-5 text-blue-500" />
                                    {ultimaDate ? ultimaDate.toLocaleDateString("pt-BR") : "-"}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={cn(
                                      "border-0",
                                      lead.categoria === "ativo" && "bg-green-500/10 text-green-600 hover:bg-green-500/20",
                                      lead.categoria === "agendado" && "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20",
                                      (lead.categoria === "explorado" || !["ativo", "agendado"].includes(lead.categoria)) && "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                                    )}
                                  >
                                    {lead.categoria ? lead.categoria.toUpperCase() : "DESCONHECIDO"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-4">
                        <p className="text-base text-muted-foreground">
                          Mostrando {leads.length === 0 ? "0" : `${startItem}-${endItem}`} de {pagination.total} clientes
                          ativos
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            className="border-border"
                            onClick={() => handlePageChange(page - 1)}
                            disabled={page <= 1 || loading}
                          >
                            Anterior
                          </Button>
                          <span className="text-base text-muted-foreground">
                            Página {pagination.page} de {pagination.totalPages}
                          </span>
                          <Button
                            variant="outline"
                            className="border-border"
                            onClick={() => handlePageChange(page + 1)}
                            disabled={page >= pagination.totalPages || loading}
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
          </>
        )}
      </div>

      {selectedCliente && (
        <ClienteDetailDialog
          clienteId={selectedCliente}
          open={!!selectedCliente}
          onClose={() => setSelectedCliente(null)}
        />
      )}

      {orcamentoCliente && (
        <CriarOrcamentoDialog
          open
          clienteId={orcamentoCliente.id}
          clienteNome={orcamentoCliente.nome}
          onClose={() => setOrcamentoCliente(null)}
        />
      )}

      {/* Mass assignment floating bar */}
      {totalSelecionados > 0 && (
        <Card className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 shadow-lg border-blue-200 bg-blue-50">
          <CardContent className="py-3 px-6 flex items-center gap-4">
            <span className="text-sm font-medium text-blue-800">
              {totalSelecionados} cliente(s) selecionado(s)
            </span>
            <div className="h-4 w-px bg-blue-200" />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 border-blue-300">
                  {vendedorAtribuicao
                    ? vendedores.find((v) => v.id === vendedorAtribuicao)?.name ?? "Vendedor"
                    : "Selecionar Vendedor"}
                  <ChevronsUpDown className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-0">
                <Command>
                  <CommandInput placeholder="Buscar vendedor..." />
                  <CommandList>
                    <CommandEmpty>Nenhum vendedor encontrado.</CommandEmpty>
                    <CommandGroup>
                      {vendedores.map((vendedor) => (
                        <CommandItem
                          key={vendedor.id}
                          value={vendedor.name}
                          onSelect={() => setVendedorAtribuicao(vendedor.id)}
                        >
                          <Check
                            className={cn("mr-2 h-4 w-4", vendedorAtribuicao === vendedor.id ? "opacity-100" : "opacity-0")}
                          />
                          {vendedor.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!vendedorAtribuicao}
              onClick={() => setConfirmAssignOpen(true)}
            >
              Atribuir Vendedor
            </Button>
            <Button size="sm" variant="ghost" onClick={resetSelection}>
              Cancelar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmAssignOpen} onOpenChange={setConfirmAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Atribuição</DialogTitle>
            <DialogDescription>
              Você está prestes a atribuir {totalSelecionados} cliente(s) para{" "}
              <strong>{vendedores.find((v) => v.id === vendedorAtribuicao)?.name ?? "o vendedor selecionado"}</strong>.
              <br />
              <span className="text-muted-foreground text-xs mt-2 block">
                Mês selecionado: {MESES.find((m) => m.value === mesSelecionado)?.label} / {anoSelecionado}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfirmAssignOpen(false)} disabled={assigning}>
              Cancelar
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleAtribuirVendedor}
              disabled={assigning || !vendedorAtribuicao}
            >
              {assigning ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Atribuindo...
                </span>
              ) : (
                "Confirmar"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Skipped clients dialog */}
      <Dialog open={skippedClientsOpen} onOpenChange={setSkippedClientsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-amber-600">Clientes em Pesquisa</DialogTitle>
            <DialogDescription>
              Os seguintes clientes não foram atribuídos porque possuem uma ficha em pesquisa:
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {skippedClients.map((client) => (
              <div
                key={client.id}
                className="flex items-center gap-3 rounded-lg border p-3 bg-amber-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{formatRazaoSocial(client.razaoSocial)}</p>
                  <p className="text-xs text-muted-foreground">{formatCNPJ(client.cnpj)}</p>
                </div>
                <Badge variant="outline" className="shrink-0 bg-yellow-100 text-yellow-800 border-yellow-300">
                  Em Pesquisa
                </Badge>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setSkippedClientsOpen(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
