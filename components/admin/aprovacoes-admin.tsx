"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { differenceInBusinessDays } from "date-fns"
import { AlertTriangle, Calendar, Check, Eye, Loader2, RefreshCw, Send, XCircle } from "lucide-react"

import { cn } from "@/lib/utils"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { formatCNPJ, formatRazaoSocial } from "@/lib/formatters"
import { PedidoDetailsDialog, type PedidoHistoricoItem } from "@/components/leads/pedido-details-dialog"
import { ClienteDetailDialog } from "@/components/leads/cliente-detail-dialog"
import { SendDocumentsDialog } from "@/components/leads/send-documents-dialog"

type AdmPedido = {
  id: number
  status: string
  tipoEspecial?: "OS" | null
  clienteId: number
  clienteRazaoSocial: string
  clienteCnpj: string
  clienteEndereco: string
  orcamentoId: number | null
  empresaId: number | null
  parcelas: number | null
  primeiroVencimento: string | null
  valorTotal: number
  createdAt: string
  _approvedLocal?: boolean
}

type HistoricoResponse = {
  data: AdmPedido[]
  total: number
  page: number
  pageSize: number
}

type BancoOption = { id: number; nome: string; bancoCodigo: number }

const fetchJson = async <T,>(input: RequestInfo, init?: RequestInit) => {
  const res = await fetch(input, init)
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(payload?.error || "Erro ao carregar dados.")
  }
  return payload as T
}

export function AprovacoesAdmin() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<"pendentes" | "historico">("pendentes")
  const [pendentes, setPendentes] = useState<AdmPedido[]>([])
  const [loadingPendentes, setLoadingPendentes] = useState(true)
  const [errorPendentes, setErrorPendentes] = useState<string | null>(null)
  const [historico, setHistorico] = useState<AdmPedido[]>([])
  const [totalHistorico, setTotalHistorico] = useState(0)
  const [pageHistorico, setPageHistorico] = useState(1)
  const [loadingHistorico, setLoadingHistorico] = useState(false)
  const [errorHistorico, setErrorHistorico] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<number | null>(null)
  const [approveDialog, setApproveDialog] = useState<{ open: boolean; pedidoId: number | null }>({
    open: false,
    pedidoId: null,
  })
  const [approveOptions, setApproveOptions] = useState<{
    emitirDebitos: boolean
    emitirLaudoTecnico: boolean
    emitirCartaEndosso: boolean
    bancoEmissorId?: number
  }>({
    emitirDebitos: true,
    emitirLaudoTecnico: false,
    emitirCartaEndosso: true, // só terá efeito se empresaId=1 (EBR)
    bancoEmissorId: undefined,
  })
  const [bancos, setBancos] = useState<BancoOption[]>([])
  const [cancelHistoricoId, setCancelHistoricoId] = useState<number | null>(null)
  const [cancelContatoData, setCancelContatoData] = useState("")
  const [cancelLoading, setCancelLoading] = useState(false)
  const [pedidoDetailData, setPedidoDetailData] = useState<PedidoHistoricoItem | null>(null)
  const [pedidoDetailClienteNome, setPedidoDetailClienteNome] = useState<string | undefined>(undefined)
  const [pedidoDetailOpen, setPedidoDetailOpen] = useState(false)
  const [clientDetailId, setClientDetailId] = useState<number | null>(null)
  const [clientDetailOpen, setClientDetailOpen] = useState(false)
  const [reagendarDialog, setReagendarDialog] = useState<{ open: boolean; pedidoId: number | null }>({
    open: false,
    pedidoId: null,
  })
  const [reagendarData, setReagendarData] = useState("")
  const [reagendarLoading, setReagendarLoading] = useState(false)

  // Document sending state
  const [sendDocsOpen, setSendDocsOpen] = useState(false)
  const [sendDocsLoadingId, setSendDocsLoadingId] = useState<number | null>(null)
  const [selectedPedidoForDocs, setSelectedPedidoForDocs] = useState<any>(null)
  const [selectedDocsList, setSelectedDocsList] = useState<any[]>([])

  const loadPendentes = useCallback(async () => {
    setLoadingPendentes(true)
    setErrorPendentes(null)
    try {
      const result = await fetchJson<{ data: AdmPedido[] }>("/api/admin/aprovacoes")
      setPendentes(result.data ?? [])
    } catch (err) {
      setErrorPendentes(err instanceof Error ? err.message : "Falha ao carregar pendentes.")
    } finally {
      setLoadingPendentes(false)
    }
  }, [])

  const loadHistorico = useCallback(
    async (page = 1) => {
      setLoadingHistorico(true)
      setErrorHistorico(null)
      try {
        const result = await fetchJson<HistoricoResponse>(`/api/admin/aprovacoes?mode=historico&page=${page}`)

        setHistorico(result.data ?? [])
        setTotalHistorico(result.total ?? 0)
        setPageHistorico(result.page ?? 1)
      } catch (err) {
        setErrorHistorico(err instanceof Error ? err.message : "Falha ao carregar histórico.")
      } finally {
        setLoadingHistorico(false)
      }
    },
    [],
  )

  const handleCancelarHistorico = useCallback(
    async (pedidoId: number) => {
      setCancelLoading(true)
      try {
        const payload = cancelContatoData ? { dataContatoAgendado: `${cancelContatoData}T12:00:00` } : {}
        await fetchJson(`/api/cancelar-pedido-concluido`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pedidoId, ...payload }),
        })
        toast({ description: "Pedido cancelado, orçamento atualizado e categoria recalculada." })
        await loadHistorico(pageHistorico)
      } catch (error) {
        toast({
          title: "Erro ao cancelar pedido",
          description: error instanceof Error ? error.message : "Tente novamente.",
          variant: "destructive",
        })
      } finally {
        setCancelLoading(false)
        setCancelHistoricoId(null)
        setCancelContatoData("")
      }
    },
    [cancelContatoData, loadHistorico, pageHistorico, toast],
  )

  const handleReagendar = async () => {
    if (!reagendarDialog.pedidoId) return
    setReagendarLoading(true)
    try {
      await fetchJson(`/api/admin/aprovacoes/${reagendarDialog.pedidoId}/reagendar`, {
        method: "POST",
      })

      toast({
        description: "Pedido reagendado com sucesso!",
      })
      setReagendarDialog({ open: false, pedidoId: null })
      loadPendentes()
    } catch (err) {
      toast({
        title: "Erro ao reagendar",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      })
    } finally {
      setReagendarLoading(false)
    }
  }

  const handleOpenSendDocs = async (pedido: AdmPedido) => {
    setSendDocsLoadingId(pedido.id)
    try {
      // Fetch full pedido data (needed for client phones and empresaId)
      const pedidoResponse = await fetch(`/api/pedidos/${pedido.id}`, { cache: "no-store" })
      const pedidoPayload = await pedidoResponse.json().catch(() => ({}))
      if (!pedidoResponse.ok) {
        throw new Error(pedidoPayload?.error || "Falha ao carregar dados do pedido para envio.")
      }
      const fullPedidoData = pedidoPayload.data ?? pedidoPayload

      // Fetch operational documents
      const docsResponse = await fetch(`/api/pedidos/${pedido.id}/documentos`, { cache: "no-store" })
      const docsPayload = await docsResponse.json().catch(() => ({}))
      if (!docsResponse.ok) {
        throw new Error(docsPayload?.error || "Falha ao carregar lista de documentos operacionais.")
      }
      const docsList = docsPayload?.data ?? []

      setSelectedPedidoForDocs(fullPedidoData)
      setSelectedDocsList(docsList)
      setSendDocsOpen(true)
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message || "Não foi possível carregar as informações para envio.",
        variant: "destructive",
      })
    } finally {
      setSendDocsLoadingId(null)
    }
  }

  const handleRefresh = useCallback(() => {
    if (activeTab === "historico") {
      return loadHistorico(pageHistorico)
    }
    return loadPendentes()
  }, [activeTab, loadHistorico, loadPendentes, pageHistorico])

  useEffect(() => {
    if (activeTab === "historico") {
      loadHistorico(1).catch(console.error)
    } else {
      loadPendentes().catch(console.error)
    }
  }, [activeTab, loadHistorico, loadPendentes])

  useEffect(() => {
    fetchJson<{ data: BancoOption[] }>("/api/bancos", { cache: "no-store" })
      .then((res) => setBancos(res.data ?? []))
      .catch(() => setBancos([]))
  }, [])

  useEffect(() => {
    if (bancos.length && !approveOptions.bancoEmissorId) {
      setApproveOptions((prev) => ({ ...prev, bancoEmissorId: bancos[0].id }))
    }
  }, [approveOptions.bancoEmissorId, bancos])

  const selectedPedido = useMemo(
    () => pendentes.find((p) => p.id === approveDialog.pedidoId) ?? null,
    [approveDialog.pedidoId, pendentes],
  )
  const isEmpresaEbr = selectedPedido?.empresaId === 1
  const isSelectedOs = selectedPedido?.tipoEspecial === "OS"

  const handleApprove = async (pedidoId: number) => {
    setApprovingId(pedidoId)
    try {
      const pedido = pendentes.find((item) => item.id === pedidoId)
      const isOs = pedido?.tipoEspecial === "OS"
      const bancoId = approveOptions.bancoEmissorId
      if (!isOs && !bancoId) {
        throw new Error("Selecione o banco emissor.")
      }
      await fetchJson(`/api/admin/aprovacoes/${pedidoId}/aprovar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isOs ? {} : { ...approveOptions, bancoEmissorId: bancoId }),
      })
      toast({ description: isOs ? "Ordem de serviço aprovada." : "Pedido aprovado e débitos gerados." })
      setPendentes((prev) =>
        prev.map((p) => (p.id === pedidoId ? { ...p, status: "CONCLUIDO", _approvedLocal: true as any } : p)),
      )
      setApproveDialog({ open: false, pedidoId: null })
    } catch (err) {
      toast({
        title: "Erro ao aprovar",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setApprovingId(null)
    }
  }

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalHistorico / 30)), [totalHistorico])

  const renderTable = (
    dataset: AdmPedido[],
    options: { loading: boolean; error: string | null; emptyLabel: string; actions: "pendentes" | "historico" },
  ) => {
    if (options.loading) {
      return (
        <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Carregando...
        </div>
      )
    }
    if (options.error) {
      return (
        <div className="flex items-center justify-between rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <span>{options.error}</span>
          <Button size="sm" variant="outline" onClick={() => loadPendentes().catch(console.error)}>
            Tentar novamente
          </Button>
        </div>
      )
    }
    if (dataset.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
          {options.emptyLabel}
        </div>
      )
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px] text-xs uppercase text-muted-foreground">Pedido</TableHead>
              <TableHead className="min-w-[220px] text-xs uppercase text-muted-foreground">Cliente</TableHead>
              <TableHead className="min-w-[240px] text-xs uppercase text-muted-foreground">Endereço</TableHead>
              <TableHead className="text-xs uppercase text-muted-foreground">Pedido criado em</TableHead>
              <TableHead className="text-xs uppercase text-muted-foreground">Orçamento</TableHead>
              <TableHead className="text-right text-xs uppercase text-muted-foreground">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dataset.map((pedido) => {
              const dias = differenceInBusinessDays(new Date(), new Date(pedido.createdAt))
              const isAlert = dias > 3 && options.actions === "pendentes"
              return (
                <TableRow
                  key={pedido.id}
                  className={cn(
                    isAlert && "bg-amber-50/70",
                    options.actions === "historico" &&
                    (pedido.id % 2 === 0 ? "bg-slate-50/70" : "bg-amber-50/30"),
                  )}
                >
                  <TableCell>
                    <div className="flex items-start gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setPedidoDetailData({ id: pedido.id, itens: [] })
                          setPedidoDetailClienteNome(pedido.clienteRazaoSocial)
                          setPedidoDetailOpen(true)
                        }}
                        title="Ver pedido"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">#{pedido.id}</span>
                        <span
                          className={cn(
                            "mt-0.5 text-[10px]",
                            pedido.tipoEspecial === "OS" ? "text-blue-600" : "text-muted-foreground",
                          )}
                        >
                          {pedido.tipoEspecial === "OS" ? "Ord. Serv." : "Normal"}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className="text-left font-medium text-foreground hover:text-blue-600 hover:underline whitespace-normal break-words leading-snug max-w-[260px]"
                      onClick={() => {
                        setClientDetailId(pedido.clienteId)
                        setClientDetailOpen(true)
                      }}
                    >
                      {formatRazaoSocial(pedido.clienteRazaoSocial)}
                    </button>
                    <p className="text-xs text-muted-foreground">{formatCNPJ(pedido.clienteCnpj)}</p>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-normal break-words max-w-[260px]">
                    {pedido.clienteEndereco}
                  </TableCell>
                  <TableCell className="text-sm text-foreground">
                    {new Date(pedido.createdAt).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={pedido.orcamentoId ? "outline" : "destructive"} className="text-[11px]">
                      {pedido.orcamentoId ? `#${pedido.orcamentoId}` : "Ausente"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {options.actions === "pendentes" ? (
                      <div className="flex flex-wrap justify-end gap-2">

                        {pedido._approvedLocal ? (
                          <Button
                            size="sm"
                            variant="default"
                            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleOpenSendDocs(pedido)}
                            disabled={sendDocsLoadingId === pedido.id}
                          >
                            {sendDocsLoadingId === pedido.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                            Enviar documentos
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              onClick={() => {
                                setApproveDialog({ open: true, pedidoId: pedido.id })
                                setApproveOptions((prev) => ({ ...prev, emitirDebitos: true }))
                              }}
                            >
                              <Check className="mr-1 h-3 w-3" />
                              {pedido.tipoEspecial === "OS" ? "Aprovar OS" : "Aprovar e gerar documentos"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-700 border-red-200 hover:bg-red-50"
                              onClick={() => {
                                setReagendarDialog({ open: true, pedidoId: pedido.id })
                              }}
                            >
                              <Calendar className="mr-1 h-3 w-3" />
                              Reagendar
                            </Button>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleOpenSendDocs(pedido)}
                          disabled={sendDocsLoadingId === pedido.id}
                        >
                          {sendDocsLoadingId === pedido.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          Enviar documentos
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-2"
                          onClick={() => {
                            setCancelContatoData("")
                            setCancelHistoricoId(pedido.id)
                          }}
                        >
                          <XCircle className="h-4 w-4" />
                          Cancelar pedido
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <Dialog
        open={approveDialog.open}
        onOpenChange={(open) => {
          if (!approvingId) {
            setApproveDialog((prev) => ({ ...prev, open }))
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar aprovação</DialogTitle>
            <DialogDescription>
              Confirme as ações que serão executadas ao aprovar o pedido #{approveDialog.pedidoId}.
            </DialogDescription>
          </DialogHeader>

          {isSelectedOs ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                Esta é uma ordem de serviço. Nenhum débito ou documento extra será gerado.
              </div>
              <p className="text-sm text-muted-foreground">Confirme para concluir a aprovação final.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                Os débitos serão criados automaticamente conforme o orçamento.
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Banco emissor (obrigatório)</p>
                  <Select
                    value={approveOptions.bancoEmissorId ? String(approveOptions.bancoEmissorId) : ""}
                    onValueChange={(value) => setApproveOptions((prev) => ({ ...prev, bancoEmissorId: Number(value) }))}
                    disabled={Boolean(approvingId)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o banco" />
                    </SelectTrigger>
                    <SelectContent>
                      {bancos.map((b) => (
                        <SelectItem key={b.id} value={b.id.toString()}>
                          {b.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox checked disabled className="mt-1" />
                  <div>
                    <p className="text-sm font-semibold">Criar débitos (obrigatório)</p>
                    <p className="text-xs text-muted-foreground">
                      Serão geradas as parcelas de cobrança com base no orçamento aprovado.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={approveOptions.emitirLaudoTecnico}
                    onCheckedChange={(checked) =>
                      setApproveOptions((prev) => ({ ...prev, emitirLaudoTecnico: Boolean(checked) }))
                    }
                    disabled={Boolean(approvingId)}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-sm font-semibold">Emitir Laudo Técnico (opcional)</p>
                    <p className="text-xs text-muted-foreground">
                      Gera e armazena o PDF do laudo técnico vinculado ao pedido.
                    </p>
                  </div>
                </div>

                {isEmpresaEbr ? (
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={approveOptions.emitirCartaEndosso}
                      onCheckedChange={(checked) =>
                        setApproveOptions((prev) => ({ ...prev, emitirCartaEndosso: Boolean(checked) }))
                      }
                      disabled={Boolean(approvingId)}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-semibold">Emitir Carta de Endosso (somente EBR)</p>
                      <p className="text-xs text-muted-foreground">
                        Disponível apenas quando o orçamento pertence à Empresa Brasileira de Raios (empresaId=1).
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(approvingId)}
              onClick={() => setApproveDialog({ open: false, pedidoId: null })}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="gap-2"
              disabled={Boolean(approvingId) || !approveDialog.pedidoId}
              onClick={() => approveDialog.pedidoId && handleApprove(approveDialog.pedidoId)}
            >
              {approvingId === approveDialog.pedidoId ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Confirmar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Aprovações finais</h1>
            <p className="text-sm text-muted-foreground">Gerencie os pedidos aguardando aprovação final.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => handleRefresh().catch(console.error)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="space-y-4">
          <TabsList className="inline-flex rounded-2xl border border-slate-300 bg-white p-1 shadow-sm">
            <TabsTrigger
              value="pendentes"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              Pendentes
            </TabsTrigger>
            <TabsTrigger
              value="historico"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pendentes" className="space-y-3">
            <Card>
              <CardHeader className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Pedidos aguardando aprovação final</CardTitle>
                </div>
                <Badge variant="secondary" className="text-[11px]">
                  {pendentes.length} registro(s)
                </Badge>
              </CardHeader>
              <CardContent>{renderTable(pendentes, { loading: loadingPendentes, error: errorPendentes, emptyLabel: "Nenhum pedido aguardando aprovação final.", actions: "pendentes" })}</CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico" className="space-y-3">
            <Card>
              <CardHeader className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Histórico de pedidos concluídos</CardTitle>
                </div>
                <Badge variant="secondary" className="text-[11px]">
                  {totalHistorico} registro(s)
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {renderTable(historico, {
                  loading: loadingHistorico,
                  error: errorHistorico,
                  emptyLabel: "Nenhum pedido concluído.",
                  actions: "historico",
                })}
                {historico.length > 0 && (
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      Página {pageHistorico} de {totalPages}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pageHistorico <= 1 || loadingHistorico}
                        onClick={() => loadHistorico(pageHistorico - 1).catch(console.error)}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pageHistorico >= totalPages || loadingHistorico}
                        onClick={() => loadHistorico(pageHistorico + 1).catch(console.error)}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <CancelDialog
        open={cancelHistoricoId !== null}
        onOpenChange={(open) => (!open ? setCancelHistoricoId(null) : undefined)}
        onConfirm={() => cancelHistoricoId && handleCancelarHistorico(cancelHistoricoId)}
        loading={cancelLoading}
        value={cancelContatoData}
        onChange={setCancelContatoData}
      />
      <PedidoDetailsDialog
        pedidoData={pedidoDetailData}
        clienteNome={pedidoDetailClienteNome}
        open={pedidoDetailOpen}
        onOpenChange={(open) => {
          if (!open) {
            setPedidoDetailData(null)
            setPedidoDetailClienteNome(undefined)
          }
          setPedidoDetailOpen(open)
        }}
        onSuccess={async () => {
          await handleRefresh()
        }}
      />
      {clientDetailId !== null && (
        <ClienteDetailDialog
          clienteId={clientDetailId}
          open={clientDetailOpen}
          onClose={() => {
            setClientDetailOpen(false)
            setClientDetailId(null)
          }}
        />
      )}
      {selectedPedidoForDocs && (
        <SendDocumentsDialog
          open={sendDocsOpen}
          onOpenChange={setSendDocsOpen}
          pedidoId={selectedPedidoForDocs.id}
          clientData={selectedPedidoForDocs.cliente}
          documentosOperacionais={selectedDocsList}
        />
      )}
      <ReagendarDialog
        open={reagendarDialog.open}
        onOpenChange={(open) => setReagendarDialog({ open, pedidoId: open ? reagendarDialog.pedidoId : null })}
        onConfirm={handleReagendar}
        loading={reagendarLoading}
      />
    </DashboardLayout>
  )
}

function ReagendarDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  loading: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reagendar pedido</DialogTitle>
          <DialogDescription>
            O status do pedido voltará para <strong>Aguardando</strong>. Nenhum dado será perdido — o pedido retorna ao fluxo normal de aprovação.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              "Confirmar reagendamento"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CancelDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
  value,
  onChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  loading: boolean
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar pedido</DialogTitle>
          <DialogDescription>
            Confirme o cancelamento. Opcionalmente, reagende uma data de contato; caso não informe, o cliente ficará livre.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="contato-cancel">Data de contato (opcional)</Label>
            <Input
              id="contato-cancel"
              type="date"
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Se não definir uma data, o cliente volta a ficar livre após o cancelamento.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cancelando...
              </>
            ) : (
              "Confirmar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

