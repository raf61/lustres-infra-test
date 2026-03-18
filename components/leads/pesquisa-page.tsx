"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { MapPin, Database, Search, Plus, Filter, Building2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { estados_cidades } from "@/components/leads/leads-geral"
import { formatCNPJ, formatRazaoSocial } from "@/lib/formatters"
import { FichaDetailDialog } from "@/components/leads/ficha-detail-dialog"
import { CadastroFichaDialog } from "@/components/leads/cadastro-ficha-dialog"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type FichaLead = {
  id: number
  cnpj: string
  razaoSocial: string | null
  logradouro: string | null
  numero: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  nomeSindico: string | null
  telefoneSindico: string | null
  observacao: string | null
  fichaStatus: string
  updatedAt: string
  pesquisadorName: string | null
}

type PaginationMeta = {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNextPage: boolean
}

const fichaStatusLabel: Record<string, string> = {
  EM_PESQUISA: "Em pesquisa",
  FINALIZADA: "Finalizada",
}

export function PesquisaPage() {
  const { toast } = useToast()
  const generalSearchRef = useRef<HTMLInputElement>(null)
  const cnpjSearchRef = useRef<HTMLInputElement>(null)
  const bairroInputRef = useRef<HTMLInputElement>(null)

  const [fichas, setFichas] = useState<FichaLead[]>([])
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
  const [selectedEstado, setSelectedEstado] = useState("all")
  const [selectedCidade, setSelectedCidade] = useState("all")
  const [submittedFilters, setSubmittedFilters] = useState({
    search: "",
    cnpj: "",
    bairro: "",
    estado: "all",
    cidade: "all",
    semPesquisador: false,
    pesquisadorId: "all",
  })
  const [detailFicha, setDetailFicha] = useState<FichaLead | null>(null)
  const [showCadastroDialog, setShowCadastroDialog] = useState(false)
  const [selectedFichas, setSelectedFichas] = useState<number[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [excludedFichas, setExcludedFichas] = useState<number[]>([])
  const [pesquisadores, setPesquisadores] = useState<{ id: string; name: string }[]>([])
  const [selectedPesquisador, setSelectedPesquisador] = useState<string>("")
  const [filterPesquisador, setFilterPesquisador] = useState<string>("all")
  const [assigning, setAssigning] = useState(false)
  const [confirmAssignOpen, setConfirmAssignOpen] = useState(false)
  const totalSelecionados = selectAll ? Math.max(pagination.total - excludedFichas.length, 0) : selectedFichas.length

  const toggleFicha = (id: number) => {
    if (selectAll) {
      setExcludedFichas((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]))
    } else {
      setSelectedFichas((prev) => (prev.includes(id) ? prev.filter((fichaId) => fichaId !== id) : [...prev, id]))
    }
  }

  const handleAtribuirPesquisador = async () => {
    if (!selectedPesquisador || totalSelecionados === 0) return
    try {
      setAssigning(true)
      setConfirmAssignOpen(false)

      const body =
        selectAll && pagination.total > 0
          ? {
            mode: "filter" as const,
            pesquisadorId: selectedPesquisador,
            filters: {
              search: submittedFilters.search,
              cnpj: submittedFilters.cnpj,
              bairro: submittedFilters.bairro,
              estado: submittedFilters.estado,
              cidade: submittedFilters.cidade,
              semPesquisador: submittedFilters.semPesquisador,
              pesquisadorId: submittedFilters.pesquisadorId,
            },
            excludeIds: excludedFichas,
          }
          : {
            mode: "ids" as const,
            pesquisadorId: selectedPesquisador,
            ids: selectedFichas,
          }

      const res = await fetch("/api/fichas/atribuir-pesquisador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload?.error || "Falha ao atribuir pesquisador")
      }

      toast({
        title: "Atribuição concluída",
        description: `Atualizadas ${payload?.updated ?? 0} ficha(s)${payload?.excludeCount ? ` (excluídas ${payload.excludeCount})` : ""
          }.`,
      })

      // reset seleção e recarrega
      setSelectAll(false)
      setExcludedFichas([])
      setSelectedFichas([])
      setSelectedPesquisador("")
      await fetchFichas(page)
    } catch (error) {
      console.error("Erro ao atribuir pesquisador", error)
      toast({
        title: "Erro ao atribuir pesquisador",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setAssigning(false)
    }
  }

  const toggleAll = () => {
    if (selectAll) {
      setSelectAll(false)
      setExcludedFichas([])
      setSelectedFichas([])
    } else {
      setSelectAll(true)
      setExcludedFichas([])
      setSelectedFichas([])
    }
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
    selectedEstado === "all" ? null : estadoOptions.find((estado) => estado.sigla === selectedEstado) ?? null
  const cidadeOptions = selectedEstadoInfo?.cidades ?? []

  const activeFilters = useMemo(() => submittedFilters, [submittedFilters])

  const fetchFichas = useCallback(
    async (targetPage: number) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.set("page", String(targetPage))
        if (activeFilters.search.trim()) params.set("search", activeFilters.search.trim())
        if (activeFilters.cnpj.trim()) params.set("cnpj", activeFilters.cnpj.trim())
        if (activeFilters.bairro.trim()) params.set("bairro", activeFilters.bairro.trim())
        if (activeFilters.estado !== "all") params.set("estado", activeFilters.estado)
        if (activeFilters.cidade !== "all") params.set("cidade", activeFilters.cidade)
        if (activeFilters.semPesquisador) params.set("semPesquisador", "true")
        if (activeFilters.pesquisadorId && activeFilters.pesquisadorId !== "all") {
          params.set("pesquisadorId", activeFilters.pesquisadorId)
        }

        const response = await fetch(`/api/fichas?${params.toString()}`)
        if (!response.ok) {
          throw new Error("Erro ao carregar fichas de pesquisa")
        }

        const payload = await response.json()
        const fetchedFichas: FichaLead[] = Array.isArray(payload.data)
          ? payload.data.map((ficha: FichaLead) => {
            const formattedRazao = ficha.razaoSocial ? formatRazaoSocial(ficha.razaoSocial) : null
            return {
              id: ficha.id,
              cnpj: ficha.cnpj,
              razaoSocial: formattedRazao,
              logradouro: ficha.logradouro,
              numero: ficha.numero,
              bairro: ficha.bairro,
              cidade: ficha.cidade,
              estado: ficha.estado,
              nomeSindico: ficha.nomeSindico,
              telefoneSindico: ficha.telefoneSindico,
              observacao: ficha.observacao,
              fichaStatus: ficha.fichaStatus,
              updatedAt: ficha.updatedAt,
              pesquisadorName: ficha.pesquisadorName ?? null,
            }
          })
          : []

        setFichas(fetchedFichas)
        setPagination({
          page: payload.pagination?.page ?? targetPage,
          pageSize: payload.pagination?.pageSize ?? 50,
          total: payload.pagination?.total ?? fetchedFichas.length,
          totalPages: payload.pagination?.totalPages ?? 1,
          hasNextPage: payload.pagination?.hasNextPage ?? false,
        })
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : "Erro desconhecido")
      } finally {
        setLoading(false)
      }
    },
    [activeFilters],
  )

  useEffect(() => {
    fetchFichas(page).catch((error) => console.error(error))
  }, [fetchFichas, page])

  useEffect(() => {
    const loadPesquisadores = async () => {
      try {
        const res = await fetch("/api/usuarios?role=PESQUISADOR&limit=200")
        const json = await res.json()
        if (res.ok && Array.isArray(json.data)) {
          setPesquisadores(json.data.map((u: any) => ({ id: u.id, name: u.name ?? u.fullname ?? "Sem nome" })))
        }
      } catch (err) {
        console.error("Erro ao carregar pesquisadores", err)
      }
    }
    loadPesquisadores().catch(console.error)
  }, [])

  const handleSearchSubmit = () => {
    setSubmittedFilters((prev) => ({
      ...prev,
      search: generalSearchRef.current?.value ?? "",
      cnpj: cnpjSearchRef.current?.value?.replace(/\D/g, "") ?? "",
      bairro: bairroInputRef.current?.value ?? "",
      estado: selectedEstado,
      cidade: selectedCidade,
      pesquisadorId: filterPesquisador,
    }))
    setPage(1)
    setSelectAll(false)
    setSelectedFichas([])
    setExcludedFichas([])
  }

  const clearFilters = () => {
    if (generalSearchRef.current) generalSearchRef.current.value = ""
    if (cnpjSearchRef.current) cnpjSearchRef.current.value = ""
    if (bairroInputRef.current) bairroInputRef.current.value = ""
    setSelectedEstado("all")
    setSelectedCidade("all")
    setFilterPesquisador("all")
    setSubmittedFilters({
      search: "",
      cnpj: "",
      bairro: "",
      estado: "all",
      cidade: "all",
      semPesquisador: false,
      pesquisadorId: "all",
    })
    setPage(1)
    setSelectAll(false)
    setSelectedFichas([])
    setExcludedFichas([])
  }

  const handleEstadoChange = (value: string) => {
    setSelectedEstado(value)
    setSelectedCidade("all")
  }

  const handleCidadeChange = (value: string) => {
    setSelectedCidade(value)
  }

  const startItem = fichas.length > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0
  const endItem = fichas.length > 0 ? startItem + fichas.length - 1 : 0

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Database className="h-10 w-10 text-primary" />
              Fichas de Pesquisa
            </h1>
            <p className="text-lg text-muted-foreground">
              Leads levantados pelo time de pesquisa antes de virar cliente
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowCadastroDialog(true)} className="bg-primary">
              <Plus className="mr-2 h-4 w-4" />
              Nova Ficha
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border border-black/30 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium text-muted-foreground">Total Fichas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{pagination.total}</div>
            </CardContent>
          </Card>
          <Card className="border border-black/30 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium text-muted-foreground">Em Pesquisa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">{pagination.total}</div>
            </CardContent>
          </Card>
        </div>

        {totalSelecionados > 0 && (
          <Card className="border-border bg-blue-50/40">
            <CardContent className="py-3 flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center gap-3">
                <Badge className="bg-blue-600 text-white">{totalSelecionados} selecionada(s)</Badge>
                {selectAll && (
                  <p className="text-sm text-muted-foreground">
                    Selecionadas todas das buscas atuais, com exceções manuais
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={selectedPesquisador} onValueChange={setSelectedPesquisador}>
                  <SelectTrigger className="w-56 bg-white border-border">
                    <SelectValue placeholder="Escolher pesquisador" />
                  </SelectTrigger>
                  <SelectContent>
                    {pesquisadores.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  disabled={!selectedPesquisador || assigning || totalSelecionados === 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => setConfirmAssignOpen(true)}
                >
                  Atribuir pesquisador
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={confirmAssignOpen} onOpenChange={setConfirmAssignOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar atribuição</DialogTitle>
              <DialogDescription>
                {selectAll
                  ? `Atribuir todas as fichas filtradas (exceto ${excludedFichas.length}) ao pesquisador selecionado?`
                  : `Atribuir ${totalSelecionados} ficha(s) ao pesquisador selecionado?`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirmAssignOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!selectedPesquisador || assigning}
                onClick={handleAtribuirPesquisador}
              >
                {assigning ? "Atribuindo..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Card className="border-border bg-card sm:gap-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtros
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-foreground">{pagination.total}</span>
                <span className="text-sm text-muted-foreground">fichas encontradas</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                handleSearchSubmit()
              }}
            >
              <div className="space-y-1 min-w-[180px]">
                <label className="text-xs font-medium text-muted-foreground">CNPJ</label>
                <div className="relative">
                  <Database className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="CNPJ..."
                    inputMode="numeric"
                    ref={cnpjSearchRef}
                    className="pl-8 h-8 text-sm bg-background border-border text-foreground"
                  />
                </div>
              </div>
              <div className="space-y-1 flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-muted-foreground">Busca Geral</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nome, cidade, bairro..."
                    ref={generalSearchRef}
                    className="pl-8 h-8 text-sm bg-background border-border text-foreground"
                  />
                </div>
              </div>
              <Button type="submit" className="h-8 px-4 text-sm" disabled={loading}>
                Buscar
              </Button>
            </form>

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Estado</label>
                <Select value={selectedEstado} onValueChange={handleEstadoChange}>
                  <SelectTrigger className="h-8 w-[100px] text-sm bg-background border-border">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="all">Todos</SelectItem>
                    {estadoOptions.map((estado) => (
                      <SelectItem key={estado.sigla} value={estado.sigla}>{estado.sigla}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Cidade</label>
                <Select value={selectedCidade} onValueChange={handleCidadeChange} disabled={selectedEstado === "all"}>
                  <SelectTrigger className="h-8 w-[140px] text-sm bg-background border-border">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="all">Todas</SelectItem>
                    {cidadeOptions.map((cidade) => (
                      <SelectItem key={cidade} value={cidade}>{cidade}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Bairro</div>
                <Input placeholder="Bairro..." ref={bairroInputRef} className="h-8 w-[120px] text-sm bg-background border-border" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Pesquisador</label>
                <Select value={filterPesquisador} onValueChange={setFilterPesquisador}>
                  <SelectTrigger className="h-8 w-[140px] text-sm bg-background border-border">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="all">Todos</SelectItem>
                    {pesquisadores.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 self-end pb-1">
                <Checkbox
                  id="sem-pesquisador"
                  checked={submittedFilters.semPesquisador}
                  onCheckedChange={(checked) => setSubmittedFilters((prev) => ({ ...prev, semPesquisador: Boolean(checked) }))}
                  className="h-4 w-4 border-2 border-slate-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                />
                <label htmlFor="sem-pesquisador" className="text-xs font-medium text-foreground cursor-pointer">Sem pesquisador</label>
              </div>

              <Button variant="ghost" onClick={clearFilters} size="sm" className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground self-end">
                Limpar
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between">
              {error}
              <Button variant="outline" size="sm" onClick={() => fetchFichas(page).catch(console.error)}>
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-border bg-card">
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectAll && excludedFichas.length === 0}
                        onCheckedChange={toggleAll}
                        disabled={fichas.length === 0}
                      />
                    </TableHead>
                    <TableHead className="text-sm font-semibold text-muted-foreground">Condomínio</TableHead>
                    <TableHead className="text-sm font-semibold text-muted-foreground">Pesquisador</TableHead>
                    <TableHead className="text-sm font-semibold text-muted-foreground">CNPJ</TableHead>
                    <TableHead className="text-sm font-semibold text-muted-foreground">Status</TableHead>
                    <TableHead className="text-sm font-semibold text-muted-foreground min-w-[180px]">Localização</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fichas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhuma ficha encontrada com os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    fichas.map((ficha) => (
                      <TableRow key={ficha.id} className="border-b border-black/30 hover:bg-accent/5">
                        <TableCell>
                          <Checkbox
                            checked={selectAll ? !excludedFichas.includes(ficha.id) : selectedFichas.includes(ficha.id)}
                            onCheckedChange={() => toggleFicha(ficha.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-9 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20 shrink-0">
                              <Building2 className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="max-w-[200px]">
                              <p
                                className="font-semibold text-sm text-foreground truncate cursor-pointer hover:underline hover:text-blue-600 transition-colors"
                                onClick={() => setDetailFicha(ficha)}
                                title={ficha.razaoSocial ?? "Sem nome"}
                              >
                                {ficha.razaoSocial ?? "Sem nome"}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {ficha.nomeSindico ? `Síndico: ${ficha.nomeSindico}` : "Síndico não informado"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-foreground">
                          {ficha.pesquisadorName ? (
                            ficha.pesquisadorName
                          ) : (
                            <span className="text-muted-foreground">Sem pesquisador</span>
                          )}
                        </TableCell>
                        <TableCell className="text-foreground font-mono text-sm">{formatCNPJ(ficha.cnpj)}</TableCell>
                        <TableCell>
                          <Badge className="bg-blue-500/10 text-blue-500">
                            {fichaStatusLabel[ficha.fichaStatus] ?? ficha.fichaStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="w-[180px] min-w-[180px] max-w-[180px]">
                          <div className="space-y-0.5 w-full">
                            {ficha.bairro || ficha.cidade || ficha.estado ? (
                              <div className="flex items-start gap-1 text-[10px] text-muted-foreground leading-tight">
                                <MapPin className="h-3 w-3 text-blue-500 shrink-0 mt-0.5" />
                                <span className="whitespace-normal break-words">
                                  {[ficha.bairro, ficha.cidade, ficha.estado].filter(Boolean).join(", ")}
                                </span>
                              </div>
                            ) : null}
                            {ficha.logradouro && (
                              <p className="text-[9px] text-muted-foreground/70 whitespace-normal break-words leading-tight pl-4">
                                {ficha.logradouro}{ficha.numero ? `, ${ficha.numero}` : ""}
                              </p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-border px-6 py-4">
            <p className="text-sm text-muted-foreground">
              Mostrando{" "}
              {fichas.length === 0
                ? "0"
                : `${startItem}-${endItem}`}{" "}
              de {pagination.total} fichas
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-border"
                onClick={() => setPage((prev) => prev - 1)}
                disabled={page <= 1 || loading}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {pagination.page} de {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="border-border"
                onClick={() => setPage((prev) => prev + 1)}
                disabled={page >= pagination.totalPages || loading}
              >
                Próxima
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <FichaDetailDialog
        ficha={
          detailFicha
            ? {
              ...detailFicha,
              ultimaAtualizacao: detailFicha.updatedAt,
            }
            : null
        }
        open={Boolean(detailFicha)}
        onOpenChange={(open) => {
          if (!open) {
            setDetailFicha(null)
          }
        }}
        onUpdate={() => {
          fetchFichas(page).catch(console.error)
        }}
      />

      <CadastroFichaDialog
        open={showCadastroDialog}
        onClose={() => setShowCadastroDialog(false)}
        onSuccess={() => {
          fetchFichas(1).catch(console.error)
        }}
      />
    </DashboardLayout>
  )
}

