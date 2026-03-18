"use client"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { FichaDetailDialog } from "@/components/leads/ficha-detail-dialog"
import { CadastroFichaDialog } from "@/components/leads/cadastro-ficha-dialog"
import { formatCNPJ } from "@/lib/formatters"
import { MapPin, Building2, Loader2, Plus } from "lucide-react"

type FichaListItem = {
  id: number
  cnpj: string
  razaoSocial: string | null
  nomeSindico: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  logradouro: string | null
  numero: string | null
  fichaStatus: string
  pesquisadorName: string | null
  updatedAt: string
}

const fichaStatusLabel: Record<string, string> = {
  EM_PESQUISA: "Em pesquisa",
  FINALIZADA: "Finalizada",
}

const PER_PAGE = 50

export function PesquisadorDashboard() {
  const [fichas, setFichas] = useState<FichaListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [detailFicha, setDetailFicha] = useState<FichaListItem | null>(null)
  const [cadastroDialogOpen, setCadastroDialogOpen] = useState(false)
  const [filters, setFilters] = useState({
    search: "",
    cnpj: "",
    estado: "",
    cidade: "",
    bairro: "",
  })

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PER_PAGE)), [total])
  const startItem = fichas.length > 0 ? (page - 1) * PER_PAGE + 1 : 0
  const endItem = fichas.length > 0 ? startItem + fichas.length - 1 : 0

  const fetchFichas = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("perPage", String(PER_PAGE))
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value)
      })

      const response = await fetch(`/api/pesquisador/fichas?${params.toString()}`)
      if (!response.ok) throw new Error("Erro ao carregar fichas")

      const data = await response.json()
      setFichas(data.fichas || [])
      setTotal(data.total || 0)
    } catch (error) {
      console.error("Erro ao buscar fichas:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFichas().catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const applyFilters = () => {
    setPage(1)
    fetchFichas().catch(console.error)
  }

  return (
    <DashboardLayout>
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard do Pesquisador</h1>
            <p className="text-muted-foreground text-sm">
              Fichas em pesquisa atribuídas a você
            </p>
          </div>
          <Button onClick={() => setCadastroDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Nova Ficha
          </Button>
        </div>
      </div>

      <Card className="p-4 border border-border shadow-sm bg-card">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-2">
            <p className="text-xs text-muted-foreground mb-1">Busca</p>
            <Input
              placeholder="Buscar por nome, telefone ou endereço"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="text-sm"
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">CNPJ</p>
            <Input
              placeholder="CNPJ"
              value={filters.cnpj}
              onChange={(e) => setFilters((f) => ({ ...f, cnpj: e.target.value }))}
              className="text-sm"
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Estado</p>
            <Input
              placeholder="UF"
              value={filters.estado}
              onChange={(e) => setFilters((f) => ({ ...f, estado: e.target.value }))}
              className="text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white w-full" onClick={applyFilters}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Filtrando...
                </span>
              ) : (
                "Filtrar"
              )}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="border border-border shadow-sm bg-card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Fichas em pesquisa</h3>
            <p className="text-xs text-muted-foreground">
              Apenas fichas em status EM_PESQUISA atribuídas ao pesquisador
            </p>
          </div>
          <Badge className="bg-blue-500/10 text-blue-700">{total} registros</Badge>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-sm font-semibold text-muted-foreground">Condomínio</TableHead>
                <TableHead className="text-sm font-semibold text-muted-foreground">Pesquisador</TableHead>
                <TableHead className="text-sm font-semibold text-muted-foreground">CNPJ</TableHead>
                <TableHead className="text-sm font-semibold text-muted-foreground">Status</TableHead>
                <TableHead className="text-sm font-semibold text-muted-foreground min-w-[180px]">Localização</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando fichas...
                    </div>
                  </TableCell>
                </TableRow>
              ) : fichas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    Nenhuma ficha encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                fichas.map((ficha) => (
                  <TableRow key={ficha.id} className="border-b border-black/30 hover:bg-accent/5">
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
                    <TableCell>
                      <p className="text-sm text-foreground">
                        {ficha.pesquisadorName ?? <span className="text-muted-foreground">Sem pesquisador</span>}
                      </p>
                    </TableCell>
                    <TableCell className="text-foreground font-mono text-sm">{formatCNPJ(ficha.cnpj)}</TableCell>
                    <TableCell>
                      <Badge className="bg-blue-500/10 text-blue-500 text-xs">
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
                            {ficha.logradouro}
                            {ficha.numero ? `, ${ficha.numero}` : ""}
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Separator className="bg-border" />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-border px-6 py-4">
          <p className="text-sm text-muted-foreground">
            Mostrando {fichas.length === 0 ? "0" : `${startItem}-${endItem}`} de {total} fichas
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
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="border-border"
              onClick={() => setPage((prev) => prev + 1)}
              disabled={page >= totalPages || loading}
            >
              Próxima
            </Button>
          </div>
        </div>
      </Card>

      <FichaDetailDialog
        ficha={
          detailFicha
            ? {
                id: detailFicha.id,
                cnpj: detailFicha.cnpj,
                razaoSocial: detailFicha.razaoSocial ?? undefined,
                bairro: detailFicha.bairro ?? undefined,
                cidade: detailFicha.cidade ?? undefined,
                estado: detailFicha.estado ?? undefined,
                nomeSindico: detailFicha.nomeSindico ?? undefined,
                telefoneSindico: undefined,
                observacao: undefined,
                ultimaAtualizacao: detailFicha.updatedAt,
              }
            : null
        }
        open={Boolean(detailFicha)}
        onOpenChange={(open) => {
          if (!open) setDetailFicha(null)
        }}
        onUpdate={() => fetchFichas()}
      />

      <CadastroFichaDialog
        open={cadastroDialogOpen}
        onClose={() => setCadastroDialogOpen(false)}
        onSuccess={() => fetchFichas()}
      />
    </div>
    </DashboardLayout>
  )
}

