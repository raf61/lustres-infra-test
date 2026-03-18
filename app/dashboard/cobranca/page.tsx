"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ClienteDetailDialog } from "@/components/leads/cliente-detail-dialog"
import { formatCNPJ } from "@/lib/formatters"
import { Loader2, RefreshCw } from "lucide-react"

type DebitoItem = {
  id: number
  valor: number
  vencimento: string | null
  stats: number
  cobrancasCount?: number
  boletoDisponivel?: boolean
}


type ClienteGroup = {
  info: {
    id: number
    razaoSocial: string
    cnpj: string
    estado: string | null
    nomeSindico: string | null
    telefoneSindico: string | null
    telefoneCondominio: string | null
    celularCondominio: string | null
  }
  debitos: DebitoItem[]
}

type ApiResponse = {
  clients: ClienteGroup[]
  totalClientes?: number
  summary?: {
    inadimplencia?: { total: number; count: number }
    pagoAtrasoMes?: { total: number; count: number }
  }
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

const CLIENT_PAGE_SIZE = 300

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

const formatDate = (value: string | null) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("pt-BR")
}

export default function CobrancaPage() {
  const [clients, setClients] = useState<ClienteGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [order, setOrder] = useState<"asc" | "desc">("asc")
  const [clientLimitInput, setClientLimitInput] = useState("")
  const [clientLimitApplied, setClientLimitApplied] = useState<number | undefined>(undefined)
  const [vencimentoStart, setVencimentoStart] = useState("")
  const [vencimentoEnd, setVencimentoEnd] = useState("")
  const [clienteDialogId, setClienteDialogId] = useState<string | null>(null)
  const [summary, setSummary] = useState<ApiResponse["summary"] | null>(null)
  const [totalClientes, setTotalClientes] = useState(0)

  const clientLimit = useMemo(() => {
    const parsed = Number(clientLimitInput)
    return Number.isNaN(parsed) || parsed <= 0 ? undefined : parsed
  }, [clientLimitInput])

  const visibleDebitoIds = useMemo(
    () => clients.flatMap((client) => client.debitos.map((debito) => debito.id)),
    [clients],
  )

  const visibleCount = visibleDebitoIds.length
  const visibleClientCount = clients.length
  const totalClients = totalClientes

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("status", "vencido")
      params.set("groupByClient", "1")
      params.set("order", order)
      params.set("clientPage", String(page))
      params.set("clientPageSize", String(CLIENT_PAGE_SIZE))
      if (clientLimitApplied) params.set("clientLimit", String(clientLimitApplied))
      if (vencimentoStart) params.set("startDate", vencimentoStart)
      if (vencimentoEnd) params.set("endDate", vencimentoEnd)
      const response = await fetch(`/api/cobranca?${params.toString()}`)
      const payload: ApiResponse = await response.json()
      setClients(payload.clients ?? [])
      setTotalClientes(payload.totalClientes ?? 0)
      setSummary(payload.summary ?? null)
      setTotalPages(payload.pagination?.totalPages ?? 1)
    } catch {
      setClients([])
      setTotalClientes(0)
      setSummary(null)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }, [clientLimitApplied, order, page, vencimentoEnd, vencimentoStart])

  useEffect(() => {
    fetchData().catch(() => {})
  }, [fetchData])

  useEffect(() => {
    setPage(1)
  }, [order])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Cobrança de inadimplentes(débitos vencidos)</h1>
            <p className="text-muted-foreground">Clientes inadimplentes e seus débitos vencidos</p>
          </div>
          <Button variant="outline" onClick={() => fetchData()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>

        <Card className="rounded-md">
          <CardHeader className="flex flex-wrap gap-3">
            <CardTitle className="text-lg">Filtros</CardTitle>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Ordenar vencimento</span>
                <Select value={order} onValueChange={(value) => setOrder(value as "asc" | "desc")}>
                  <SelectTrigger className="h-8 w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Mais antigo</SelectItem>
                    <SelectItem value="desc">Mais recente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Quantidade (clientes)</span>
                <Input
                  type="number"
                  min={1}
                  placeholder="Ex.: 500"
                  value={clientLimitInput}
                  onChange={(event) => setClientLimitInput(event.target.value)}
                  className="h-8 w-[140px]"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPage(1)
                    setClientLimitApplied(clientLimit)
                  }}
                >
                  Filtrar
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Vencimento</span>
                <Input
                  type="date"
                  value={vencimentoStart}
                  onChange={(event) => {
                    setPage(1)
                    setVencimentoStart(event.target.value)
                  }}
                  className="h-8 w-[140px]"
                />
                <span className="text-xs text-muted-foreground">até</span>
                <Input
                  type="date"
                  value={vencimentoEnd}
                  onChange={(event) => {
                    setPage(1)
                    setVencimentoEnd(event.target.value)
                  }}
                  className="h-8 w-[140px]"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Card className="rounded-md border-red-200 bg-red-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-700">Total inadimplência</CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-semibold text-slate-900">
                  {summary ? formatCurrency(summary.inadimplencia?.total ?? 0) : "--"}
                  <span className="ml-2 text-xs text-slate-700">
                    {summary ? `${summary.inadimplencia?.count ?? 0} débitos` : ""}
                  </span>
                </CardContent>
              </Card>
              <Card className="rounded-md border-emerald-200 bg-emerald-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-700">Pago em atraso (mês)</CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-semibold text-slate-900">
                  {summary ? formatCurrency(summary.pagoAtrasoMes?.total ?? 0) : "--"}
                  <span className="ml-2 text-xs text-slate-700">
                    {summary ? `${summary.pagoAtrasoMes?.count ?? 0} débitos` : ""}
                  </span>
                </CardContent>
              </Card>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
              <span className="text-xs text-muted-foreground">
                Total clientes: {totalClients} · Clientes visíveis: {visibleClientCount} · Débitos visíveis: {visibleCount}
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Carregando inadimplentes...
              </div>
            ) : clients.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 py-10 text-center text-muted-foreground">
                Nenhum cliente com débitos vencidos encontrado.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
                {clients.map((client) => (
                  <Card key={client.info.id} className="border-border/70 rounded-md">
                    <CardHeader className="pb-1 pt-2">
                      <CardTitle className="text-[11px]">
                        <button
                          type="button"
                          onClick={() => setClienteDialogId(String(client.info.id))}
                          className="text-left hover:underline"
                        >
                          {client.info.razaoSocial}
                        </button>
                        <span className="ml-2 text-[11px] text-muted-foreground">
                          {formatCNPJ(client.info.cnpj)}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 pt-0 pb-2">
                      {client.debitos.map((debito) => (
                        <div key={debito.id} className="space-y-1">
                          <div
                            className={`flex items-center justify-between rounded-sm border px-2 py-0.5 text-[11px] ${
                              (debito.cobrancasCount ?? 0) > 0
                                ? "border-amber-200 bg-amber-50/40"
                                : "border-border/60"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Débito #{debito.id}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span>Vencimento: {formatDate(debito.vencimento)}</span>
                              <span className="font-semibold text-foreground">{formatCurrency(debito.valor)}</span>
                              <span>Lembretes enviados: {debito.cobrancasCount ?? 0}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
              >
                Próxima
              </Button>
            </div>
          </CardContent>
        </Card>

        <ClienteDetailDialog
          clienteId={clienteDialogId ?? ""}
          open={Boolean(clienteDialogId)}
          onClose={() => setClienteDialogId(null)}
        />
      </div>
    </DashboardLayout>
  )
}

