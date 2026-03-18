"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { formatCNPJ, formatRazaoSocial } from "@/lib/formatters"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, MessageSquare, MapPin, Building2, Loader2, Users, FileText, Clock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { ClienteDetailDialog } from "@/components/leads/cliente-detail-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge as StatusBadge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { estados_cidades } from "./leads-geral"
import { LeadsFilterCard } from "./leads-filter-card"
import { LeadsStateDistribution } from "./leads-state-distribution"
import { LeadsVendorDistribution } from "./leads-vendor-distribution"
import { CriarOrcamentoDialog } from "@/components/orcamentos/criar-orcamento-dialog"
import { CLIENTS_MAX_LIMIT } from "@/lib/constants"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 30

type CategoriaFiltro = "explorado" | "ativo" | "agendado"

type RawLead = {
  id: number
  cnpj: string
  razaoSocial: string
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  categoria: string | null
  vendedor?: string | { name: string | null; role?: string | null } | null
}

export function LeadsExplorados() {
  return <LeadsCategoryPage config={LEADS_EXPLORADOS_CONFIG} />
}

type LeadItem = {
  id: string
  cnpj: string
  nomeCondominio: string
  razaoSocial: string
  endereco: string
  bairro?: string
  cidade?: string
  estado?: string
  categoria: string
  vendedor?: string | null
}

type FetchFilters = {
  search?: string
  cnpj?: string
  estado?: string
  cidade?: string
  bairro?: string
  categoria?: CategoriaFiltro
  vendedorId?: string
  semVendedor?: boolean
  temPedido?: "true" | "false"
  limit?: number
  orcamentoMode?: "sem" | "com"
  orcamentoMonths?: string
  historyMode?: "sem" | "com"
  historyValue?: string
  historyUnit?: 'h' | 'd' | 'm'
}

type LeadsCategoriaConfig = {
  categoriaFiltro: CategoriaFiltro
  title: string
  subtitle: string
  cardDescriptionSuffix: string
  emptyTableMessage: string
  badgeLabel: string
  badgeVariant: "default" | "secondary" | "destructive" | "outline"
  errorContext: string
}

const LEADS_EXPLORADOS_CONFIG: LeadsCategoriaConfig = {
  categoriaFiltro: "explorado",
  title: "Clientes Livres",
  subtitle: "Clientes que não renovam há mais de 12 meses",
  cardDescriptionSuffix: "clientes livres encontrados",
  emptyTableMessage: "Nenhum lead encontrado com os filtros selecionados.",
  badgeLabel: "Livre sem Data",
  badgeVariant: "secondary",
  errorContext: "clientes livres",
}

function LeadsCategoryPage({ config }: { config: LeadsCategoriaConfig }) {
  const { categoriaFiltro, title, subtitle, cardDescriptionSuffix, emptyTableMessage, badgeLabel, badgeVariant, errorContext } =
    config

  const generalSearchRef = useRef<HTMLInputElement>(null)
  const cnpjSearchRef = useRef<HTMLInputElement>(null)
  const bairroInputRef = useRef<HTMLInputElement>(null)
  const limiteInputRef = useRef<HTMLInputElement>(null)
  const [selectedEstado, setSelectedEstado] = useState("all")
  const [selectedCidade, setSelectedCidade] = useState("all")
  const [submittedGeneralSearch, setSubmittedGeneralSearch] = useState("")
  const [submittedCnpjSearch, setSubmittedCnpjSearch] = useState("")
  const [submittedBairro, setSubmittedBairro] = useState("")
  const [submittedEstado, setSubmittedEstado] = useState("all")
  const [submittedCidade, setSubmittedCidade] = useState("all")
  const [submittedLimit, setSubmittedLimit] = useState<number | null>(null)
  const [selectedCliente, setSelectedCliente] = useState<string | null>(null)
  const [orcamentoCliente, setOrcamentoCliente] = useState<{ id: string; nome: string } | null>(null)
  const [page, setPage] = useState(1)
  const [leads, setLeads] = useState<LeadItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
  })
  const latestRequestRef = useRef(0)
  const previousFiltersRef = useRef<FetchFilters | null>(null)
  const skipNextFetchRef = useRef(false)
  const [vendedores, setVendedores] = useState<{ id: string; name: string }[]>([])
  const [vendedorFiltro, setVendedorFiltro] = useState("all")
  const [semVendedor, setSemVendedor] = useState(false)
  const [filtroPedido, setFiltroPedido] = useState<"all" | "comPedido" | "semPedido">("all")
  const [vendedorAtribuicao, setVendedorAtribuicao] = useState<string>("")
  const [selectAll, setSelectAll] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [excludedIds, setExcludedIds] = useState<string[]>([])
  const [confirmAssignOpen, setConfirmAssignOpen] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [skippedClientsOpen, setSkippedClientsOpen] = useState(false)
  const [skippedClients, setSkippedClients] = useState<{ id: number; cnpj: string; razaoSocial: string }[]>([])
  const [distributionType, setDistributionType] = useState<"none" | "state" | "vendor">("none")
  const [filterOrcamentoMonths, setFilterOrcamentoMonths] = useState<number | null>(null)
  const [filterOrcamentoMode, setFilterOrcamentoMode] = useState<"sem" | "com">("sem")
  const [orcamentoContextMenu, setOrcamentoContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [orcamentoCustomInput, setOrcamentoCustomInput] = useState("4")

  // Filtro de histórico
  const [filterHistoryValue, setFilterHistoryValue] = useState(1)
  const [filterHistoryUnit, setFilterHistoryUnit] = useState<'h' | 'd' | 'm'>('m')
  const [filterHistoryMode, setFilterHistoryMode] = useState<'com' | 'sem' | null>(null)
  const [historyContextMenu, setHistoryContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [historyCustomInput, setHistoryCustomInput] = useState("1")

  const { toast } = useToast()

  const resetSelection = useCallback(() => {
    setSelectAll(false)
    setSelectedIds([])
    setExcludedIds([])
  }, [])

  const openCriarOrcamento = (lead: LeadItem) => {
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

  const activeFilters = useMemo<FetchFilters>(() => {
    const filters: FetchFilters = { categoria: categoriaFiltro }
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
    if (filtroPedido === "comPedido") {
      filters.temPedido = "true"
    } else if (filtroPedido === "semPedido") {
      filters.temPedido = "false"
    }
    if (submittedLimit && submittedLimit > 0) {
      filters.limit = submittedLimit
    }
    if (filterOrcamentoMonths !== null) {
      filters.orcamentoMode = filterOrcamentoMode
      filters.orcamentoMonths = filterOrcamentoMonths.toString()
    }
    if (filterHistoryMode !== null) {
      filters.historyMode = filterHistoryMode
      filters.historyValue = filterHistoryValue.toString()
      filters.historyUnit = filterHistoryUnit
    }

    return filters
  }, [
    submittedGeneralSearch,
    submittedCnpjSearch,
    submittedEstado,
    submittedCidade,
    submittedBairro,
    categoriaFiltro,
    vendedorFiltro,
    semVendedor,
    filtroPedido,
    submittedLimit,
    filterOrcamentoMonths,
    filterOrcamentoMode,
    filterHistoryMode,
    filterHistoryValue,
    filterHistoryUnit
  ])

  const handleEstadoChange = (value: string) => {
    setSelectedEstado(value)
    setSelectedCidade("all")
    setSubmittedEstado(value)
    setSubmittedCidade("all")
  }

  const handleCidadeChange = (value: string) => {
    setSelectedCidade(value)
    setSubmittedCidade(value)
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
    resetSelection()
  }, [resetSelection, selectedEstado, selectedCidade])

  const fetchLeads = useCallback(
    async (requestedPage: number, filters: FetchFilters) => {
      const requestId = latestRequestRef.current + 1
      latestRequestRef.current = requestId

      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams()
        params.set("page", String(requestedPage))
        Object.entries(filters).forEach(([key, value]) => {
          if (value === undefined || value === null) return
          if (typeof value === "boolean") {
            if (value) params.set(key, "true")
          } else {
            if (String(value).length > 0) params.set(key, String(value))
          }
        })

        const response = await fetch(`/api/clients?${params.toString()}`)
        if (!response.ok) {
          throw new Error(`Erro ao buscar ${errorContext}`)
        }

        const payload = await response.json()
        const rawLeads: RawLead[] = Array.isArray(payload.data) ? payload.data : []
        console.log(rawLeads.map(x => x.id))
        const paginationPayload = payload.pagination ?? {}

        if (requestId !== latestRequestRef.current) {
          return
        }

        const mappedLeads: LeadItem[] = rawLeads.map((lead) => {
          const formattedRazao = formatRazaoSocial(lead.razaoSocial)
          const endereco = [lead.logradouro, lead.numero, lead.complemento]
            .filter((part): part is string => Boolean(part && part.trim().length))
            .join(", ")

          const vendedorNome =
            typeof lead.vendedor === "string"
              ? lead.vendedor
              : lead.vendedor?.name?.trim() || null

          return {
            id: String(lead.id),
            cnpj: lead.cnpj,
            nomeCondominio: formattedRazao,
            razaoSocial: formattedRazao,
            endereco,
            bairro: lead.bairro ?? undefined,
            cidade: lead.cidade ?? undefined,
            estado: lead.estado ?? undefined,
            categoria: lead.categoria ?? badgeLabel,
            vendedor: vendedorNome,
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
        setHasLoadedOnce(true)
      } catch (err) {
        if (requestId === latestRequestRef.current) {
          setError(err instanceof Error ? err.message : "Erro desconhecido")
          console.error(`Erro ao buscar ${errorContext}:`, err)
        }
      } finally {
        if (requestId === latestRequestRef.current) {
          setLoading(false)
        }
      }
    },
    [badgeLabel, errorContext]
  )

  useEffect(() => {
    const loadVendedores = async () => {
      try {
        const res = await fetch("/api/vendedores")
        if (!res.ok) return
        const data = await res.json()
        setVendedores(
          (data?.data ?? data?.users ?? []).map((u: any) => ({
            id: u.id,
            name: u.name ?? `Vendedor ${u.id}`,
          })),
        )
      } catch (error) {
        console.error("Erro ao buscar vendedores", error)
      }
    }
    loadVendedores().catch(console.error)
  }, [])

  useEffect(() => {
    const filtersChanged = previousFiltersRef.current !== activeFilters
    previousFiltersRef.current = activeFilters

    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false
      return
    }

    if (filtersChanged && page !== 1) {
      setPage(1)
      return
    }

    fetchLeads(page, activeFilters).catch((err) => console.error(err))
  }, [activeFilters, fetchLeads, page])

  // Ao refazer a busca (filtros alterados), limpar seleções e fechar confirmação
  useEffect(() => {
    resetSelection()
    setConfirmAssignOpen(false)
  }, [activeFilters])

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages || newPage === page) return
    setPage(newPage)
  }

  const totalSelecionados = useMemo(
    () => (selectAll ? Math.max(pagination.total - excludedIds.length, 0) : selectedIds.length),
    [selectAll, pagination.total, excludedIds.length, selectedIds.length],
  )

  const toggleSelectAll = (checked: boolean | "indeterminate") => {
    if (checked) {
      setSelectAll(true)
      setSelectedIds([])
      setExcludedIds([])
    } else {
      setSelectAll(false)
      setSelectedIds([])
      setExcludedIds([])
    }
  }

  const toggleLead = (id: string) => {
    if (selectAll) {
      if (excludedIds.includes(id)) {
        setExcludedIds((prev) => prev.filter((x) => x !== id))
      } else {
        setExcludedIds((prev) => [...prev, id])
      }
    } else {
      setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    }
  }



  const handleAtribuirVendedor = async () => {
    if (!vendedorAtribuicao) {
      toast({ title: "Selecione um vendedor", variant: "destructive" })
      return
    }

    try {
      setAssigning(true)
      let idsToAssign: number[] = []

      if (selectAll && pagination.total > 0) {
        // Buscar todos os IDs que atendem aos filtros atuais
        const params = new URLSearchParams()
        Object.entries(activeFilters).forEach(([key, value]) => {
          if (value === undefined || value === null || value === "") return
          if (typeof value === "boolean") {
            params.set(key, value ? "true" : "false")
          } else {
            params.set(key, String(value))
          }
        })

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
      fetchLeads(page, activeFilters).catch(console.error)
      setConfirmAssignOpen(false)
    } catch (error) {
      console.error(error)
      toast({
        title: "Erro ao atribuir vendedor",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      })
    } finally {
      setAssigning(false)
    }
  }

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
              <Search className="h-10 w-10 text-primary" />
              {title}
            </h1>
            <p className="text-lg text-muted-foreground">{subtitle}</p>
          </div>
          <Button className="bg-primary hover:bg-primary/90">
            <MessageSquare className="mr-2 h-4 w-4" />
            Enviar Campanha Chatbot
          </Button>
        </div>

        <LeadsFilterCard
          totalCount={pagination.total}
          totalLabel={cardDescriptionSuffix}
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
          autoSubmitOnSelectChange={true}
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
            setVendedorFiltro("all")
            setSemVendedor(false)
            setFiltroPedido("all")
            if (limiteInputRef.current) limiteInputRef.current.value = ""
            setSubmittedLimit(null)
            setFilterOrcamentoMonths(null)
            setFilterOrcamentoMode("sem")
            setFilterHistoryMode(null)
            setFilterHistoryValue(1)
            setFilterHistoryUnit('m')
          }}
          activeFilters={{
            cnpj: submittedCnpjSearch !== "",
            search: submittedGeneralSearch !== "",
            estado: submittedEstado !== "all",
            cidade: submittedCidade !== "all",
            bairro: submittedBairro !== "",
          }}
          extraFilters={
            <>
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Vendedor</div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("h-8 w-[150px] justify-between text-sm bg-background border-border text-left", vendedorFiltro !== "all" && "ring-2 ring-blue-500 border-blue-500")}>
                      {vendedorFiltro === "all" ? "Todos" : vendedores.find((v) => v.id === vendedorFiltro)?.name ?? "..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[240px] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar..." />
                      <CommandList>
                        <CommandEmpty>Nenhum encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem onSelect={() => setVendedorFiltro("all")}>Todos</CommandItem>
                          {vendedores.map((v) => (
                            <CommandItem key={v.id} onSelect={() => setVendedorFiltro(v.id)}>{v.name}</CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Limite</div>
                <Input placeholder="25" type="number" min={1} max={CLIENTS_MAX_LIMIT} ref={limiteInputRef} className={cn("h-8 w-[70px] text-sm bg-background border-border", submittedLimit !== null && "ring-2 ring-blue-500 border-blue-500")} />
              </div>

              <div className="flex items-center gap-2 self-end pb-1">
                <Checkbox id="sem-vendedor" checked={semVendedor} onCheckedChange={(val) => setSemVendedor(Boolean(val))} className="h-4 w-4 border-2 border-slate-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600" />
                <label htmlFor="sem-vendedor" className="text-xs font-medium text-foreground cursor-pointer">Sem vendedor</label>
              </div>

              <div className="flex items-center gap-2 self-end pb-1">
                <Checkbox
                  id="sem-pedido-explorados"
                  checked={filtroPedido === "semPedido"}
                  onCheckedChange={(checked) => setFiltroPedido(checked ? "semPedido" : "all")}
                  className="h-4 w-4 border-2 border-slate-400 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                />
                <label htmlFor="sem-pedido-explorados" className="text-xs font-medium text-foreground cursor-pointer">Nunca fez pedido</label>
              </div>

              <div className="flex items-center gap-2 self-end pb-1">
                <Checkbox
                  id="com-pedido-explorados"
                  checked={filtroPedido === "comPedido"}
                  onCheckedChange={(checked) => setFiltroPedido(checked ? "comPedido" : "all")}
                  className="h-4 w-4 border-2 border-slate-400 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                />
                <label htmlFor="com-pedido-explorados" className="text-xs font-medium text-foreground cursor-pointer">Já fez pedido</label>
              </div>

              <div className="space-y-1 relative">
                <div className="text-xs font-medium text-muted-foreground">Orçamento</div>
                <Button
                  variant={filterOrcamentoMonths !== null ? "default" : "outline"}
                  size="sm"
                  className="h-8 gap-2 text-xs"
                  onClick={() => {
                    if (filterOrcamentoMonths === null) {
                      setFilterOrcamentoMonths(Number(orcamentoCustomInput) || 4)
                    } else {
                      setFilterOrcamentoMonths(null)
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setOrcamentoContextMenu({ x: e.clientX, y: e.clientY })
                  }}
                >
                  <FileText className="h-3.5 w-3.5" />
                  {filterOrcamentoMonths === null
                    ? "Filtrar"
                    : `${filterOrcamentoMode === "sem" ? "Sem" : "Com"} orç. ${filterOrcamentoMonths}m`}
                </Button>

                {orcamentoContextMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-[60]"
                      onClick={() => setOrcamentoContextMenu(null)}
                    />
                    <div
                      className="fixed z-[70] bg-popover border border-border rounded-lg shadow-xl p-3 space-y-2 min-w-[140px]"
                      style={{ left: orcamentoContextMenu.x, top: orcamentoContextMenu.y }}
                    >
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipo de Filtro</p>
                      <div className="flex gap-1">
                        <Button
                          variant={filterOrcamentoMode === "sem" ? "default" : "outline"}
                          size="sm"
                          className="h-7 flex-1 text-[10px]"
                          onClick={() => {
                            setFilterOrcamentoMode("sem")
                            if (filterOrcamentoMonths === null) setFilterOrcamentoMonths(Number(orcamentoCustomInput) || 4)
                          }}
                        >
                          SEM
                        </Button>
                        <Button
                          variant={filterOrcamentoMode === "com" ? "default" : "outline"}
                          size="sm"
                          className="h-7 flex-1 text-[10px]"
                          onClick={() => {
                            setFilterOrcamentoMode("com")
                            if (filterOrcamentoMonths === null) setFilterOrcamentoMonths(Number(orcamentoCustomInput) || 4)
                          }}
                        >
                          COM
                        </Button>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Últimos X meses</p>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            className="h-7 w-16 text-xs"
                            value={orcamentoCustomInput}
                            onChange={(e) => {
                              const v = e.target.value
                              setOrcamentoCustomInput(v)
                              if (filterOrcamentoMonths !== null) {
                                setFilterOrcamentoMonths(Number(v) || 1)
                              }
                            }}
                          />
                          <span className="text-[10px] text-muted-foreground">meses</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-full text-[10px] hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => {
                          setFilterOrcamentoMonths(null)
                          setOrcamentoContextMenu(null)
                        }}
                      >
                        Limpar Filtro
                      </Button>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-1 relative">
                <div className="text-xs font-medium text-muted-foreground">Histórico</div>
                <Button
                  variant={filterHistoryMode !== null ? "default" : "outline"}
                  size="sm"
                  className="h-8 gap-2 text-xs"
                  onClick={() => {
                    if (filterHistoryMode === null) {
                      setFilterHistoryMode("sem")
                      setFilterHistoryValue(Number(historyCustomInput) || 1)
                    } else {
                      setFilterHistoryMode(null)
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setHistoryContextMenu({ x: e.clientX, y: e.clientY })
                  }}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {filterHistoryMode === null
                    ? "Filtrar"
                    : `${filterHistoryMode === "sem" ? "Sem" : "Com"} hist. ${filterHistoryValue}${filterHistoryUnit}`}
                </Button>

                {historyContextMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-[60]"
                      onClick={() => setHistoryContextMenu(null)}
                    />
                    <div
                      className="fixed z-[70] bg-popover border border-border rounded-lg shadow-xl p-3 space-y-2 min-w-[170px]"
                      style={{ left: historyContextMenu.x, top: historyContextMenu.y }}
                    >
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Configurar Histórico</p>
                      <div className="flex gap-1">
                        <Button
                          variant={filterHistoryMode === "sem" ? "default" : "outline"}
                          size="sm"
                          className="h-7 flex-1 text-[10px]"
                          onClick={() => {
                            setFilterHistoryMode("sem")
                            if (filterHistoryMode === null) setFilterHistoryValue(Number(historyCustomInput) || 1)
                          }}
                        >
                          SEM
                        </Button>
                        <Button
                          variant={filterHistoryMode === "com" ? "default" : "outline"}
                          size="sm"
                          className="h-7 flex-1 text-[10px]"
                          onClick={() => {
                            setFilterHistoryMode("com")
                            if (filterHistoryMode === null) setFilterHistoryValue(Number(historyCustomInput) || 1)
                          }}
                        >
                          COM
                        </Button>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={1}
                          value={historyCustomInput}
                          onChange={(e) => setHistoryCustomInput(e.target.value)}
                          className="h-8 w-14 text-xs"
                          autoFocus
                        />
                        {(['h', 'd', 'm'] as const).map((u) => (
                          <Button
                            key={u}
                            variant={filterHistoryUnit === u ? "default" : "outline"}
                            size="sm"
                            className="h-7 w-7 p-0 text-[10px]"
                            onClick={() => setFilterHistoryUnit(u)}
                          >
                            {u}
                          </Button>
                        ))}
                        <Button
                          size="sm"
                          className="h-8 text-xs font-bold"
                          onClick={() => {
                            setFilterHistoryValue(Number(historyCustomInput) || 1)
                            setHistoryContextMenu(null)
                            if (filterHistoryMode === null) setFilterHistoryMode("sem")
                          }}
                        >
                          OK
                        </Button>
                      </div>
                      <div className="flex gap-1 flex-wrap max-w-[200px] justify-center">
                        {[
                          { v: 1, u: 'h', l: '1h' }, { v: 12, u: 'h', l: '12h' },
                          { v: 1, u: 'd', l: '1d' }, { v: 7, u: 'd', l: '7d' },
                          { v: 1, u: 'm', l: '1m' }, { v: 3, u: 'm', l: '3m' }, { v: 6, u: 'm', l: '6m' }
                        ].map(({ v, u, l }) => (
                          <Button
                            key={l}
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] px-2"
                            onClick={() => {
                              setHistoryCustomInput(String(v))
                              setFilterHistoryValue(v)
                              setFilterHistoryUnit(u as any)
                              setHistoryContextMenu(null)
                              if (filterHistoryMode === null) setFilterHistoryMode("sem")
                            }}
                          >
                            {l}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
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
              categoria: categoriaFiltro,
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
              categoria: categoriaFiltro,
              ...(submittedEstado !== "all" ? { estado: submittedEstado } : {}),
              ...(submittedCidade !== "all" ? { cidade: submittedCidade } : {}),
              ...(submittedBairro ? { bairro: submittedBairro } : {}),
            }}
            title="Distribuição por Vendedor"
          />
        )}

        {totalSelecionados > 0 && (
          <Card className="border-border bg-blue-50/40">
            <CardContent className="py-3 flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center gap-3">
                <StatusBadge className="bg-blue-600 text-white">{totalSelecionados} selecionado(s)</StatusBadge>
                {selectAll && (
                  <p className="text-sm text-muted-foreground">
                    Selecionadas todas das buscas atuais, com exceções manuais
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-56 justify-between bg-white border-border">
                      {vendedorAtribuicao
                        ? vendedores.find((v) => v.id === vendedorAtribuicao)?.name ?? "Selecionar vendedor"
                        : "Selecionar vendedor"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar vendedor..." />
                      <CommandList>
                        <CommandEmpty>Nenhum vendedor encontrado.</CommandEmpty>
                        <CommandGroup>
                          {vendedores.map((v) => (
                            <CommandItem key={v.id} onSelect={() => setVendedorAtribuicao(v.id)}>
                              {v.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button
                  disabled={!vendedorAtribuicao || loading || assigning || totalSelecionados === 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => setConfirmAssignOpen(true)}
                >
                  {assigning ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Atribuindo...
                    </span>
                  ) : (
                    "Atribuir a vendedor"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {showFullSkeleton ? (
          <Card className="border-border bg-card">
            <CardContent className="p-6 space-y-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-8 w-32" />
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border bg-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          selectAll
                            ? excludedIds.length === 0
                              ? true
                              : "indeterminate"
                            : leads.length > 0 && selectedIds.length === leads.length
                        }
                        onCheckedChange={toggleSelectAll}
                        disabled={leads.length === 0 || loading}
                      />
                    </TableHead>
                    <TableHead className="text-sm font-semibold text-muted-foreground">Condomínio</TableHead>
                    <TableHead className="text-sm font-semibold text-muted-foreground">CNPJ</TableHead>
                    <TableHead className="text-sm font-semibold text-muted-foreground min-w-[180px]">Localização</TableHead>
                    <TableHead className="text-sm font-semibold text-muted-foreground">Vendedor</TableHead>
                    <TableHead className="text-sm font-semibold text-muted-foreground">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        {emptyTableMessage}
                      </TableCell>
                    </TableRow>
                  ) : (
                    leads.map((lead) => (
                      <TableRow key={lead.id} className="border-b-2 border-border/60 hover:bg-accent/5">
                        <TableCell>
                          <Checkbox
                            checked={selectAll ? !excludedIds.includes(lead.id) : selectedIds.includes(lead.id)}
                            onCheckedChange={() => toggleLead(lead.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20">
                              <Building2 className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <button
                                type="button"
                                onClick={() => setSelectedCliente(lead.id)}
                                className="font-semibold text-sm text-foreground hover:text-blue-600 hover:underline transition-colors text-left"
                              >
                                {lead.nomeCondominio}
                              </button>
                              <p className="text-xs text-muted-foreground">{lead.endereco || "Endereço não informado"}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-foreground font-mono text-sm">{formatCNPJ(lead.cnpj)}</TableCell>
                        <TableCell className="w-[180px] min-w-[180px] max-w-[180px]">
                          <div className="flex items-start gap-1 text-[11px] text-muted-foreground leading-tight">
                            <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                            <span className="whitespace-normal break-words">{[lead.bairro, lead.cidade, lead.estado].filter(Boolean).join(", ") || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-foreground">{lead.vendedor ?? "Não informado"}</TableCell>
                        <TableCell>
                          <Badge variant={badgeVariant}>{badgeLabel}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-border px-6 py-4">
              <p className="text-base text-muted-foreground">
                Mostrando {leads.length === 0 ? "0" : `${startItem}-${endItem}`} de {pagination.total} leads
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
          </Card>
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

      <Dialog
        open={confirmAssignOpen}
        onOpenChange={(open) => {
          if (assigning) return
          setConfirmAssignOpen(open)
        }}
      >
        <DialogContent
          className="max-w-md"
          onEscapeKeyDown={(e) => {
            if (assigning) e.preventDefault()
          }}
          onPointerDownOutside={(e) => {
            if (assigning) e.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Confirmar atribuição</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {selectAll
                ? `Atribuir todas as fichas filtradas (exceto ${excludedIds.length}) ao vendedor selecionado?`
                : `Atribuir ${totalSelecionados} cliente(s) ao vendedor selecionado?`}
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

      {/* Dialog para clientes ignorados (em pesquisa) */}
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
