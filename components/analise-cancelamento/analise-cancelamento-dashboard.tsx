"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Calendar, CheckCircle, Eye, Loader2, MapPin, RefreshCw } from "lucide-react"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ClienteDetailDialog } from "@/components/leads/cliente-detail-dialog"
import { PedidoDetailsDialog } from "@/components/leads/pedido-details-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { formatCNPJ, formatRazaoSocial } from "@/lib/formatters"

type PedidoAnaliseCancelamento = {
  id: number
  clienteId: number
  clienteRazaoSocial: string
  clienteCnpj: string
  clienteBairro: string | null
  clienteCidade: string | null
  clienteEstado: string | null
  motivoCancelamento: string
  ultimaManutencao: string | null
  categoriaCliente: string | null
  createdAt: string
}

type DataState<T> = {
  data: T[]
  loading: boolean
  error: string | null
}

const toDateOnlyISO = (value: Date) => {
  const normalized = new Date(value)
  normalized.setHours(12, 0, 0, 0)
  return normalized.toISOString()
}

const fetchJson = async <T,>(input: RequestInfo, init?: RequestInit) => {
  const response = await fetch(input, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : "Erro ao processar requisição."
    throw new Error(message)
  }
  return payload as T
}

const formatDateInput = (value: string | null | undefined) => {
  if (!value) return ""
  return new Date(value).toISOString().slice(0, 10)
}

export function AnaliseCancelamentoDashboard() {
  const { toast } = useToast()
  const [state, setState] = useState<DataState<PedidoAnaliseCancelamento>>({
    data: [],
    loading: true,
    error: null,
  })
  const [selectedPedido, setSelectedPedido] = useState<PedidoAnaliseCancelamento | null>(null)
  const [dataUltimaManutencao, setDataUltimaManutencao] = useState("")
  const [saving, setSaving] = useState(false)
  const [viewMotivo, setViewMotivo] = useState<string | null>(null)
  const [clienteDialogId, setClienteDialogId] = useState<number | null>(null)
  const [pedidoDialogData, setPedidoDialogData] = useState<{ id: number; clienteNome: string } | null>(null)
  const [recusarDialogPedido, setRecusarDialogPedido] = useState<PedidoAnaliseCancelamento | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const loadPedidos = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const result = await fetchJson<{ data?: PedidoAnaliseCancelamento[] }>("/api/analise-cancelamento", {
        cache: "no-store",
      })
      setState({ data: result.data ?? [], loading: false, error: null })
    } catch (error) {
      console.error(error)
      setState({
        data: [],
        loading: false,
        error: error instanceof Error ? error.message : "Erro ao carregar análises de cancelamento.",
      })
    }
  }, [])

  useEffect(() => {
    loadPedidos().catch(console.error)
  }, [loadPedidos])

  const stats = useMemo(
    () => ({
      total: state.data.length,
    }),
    [state.data],
  )

  const handleOpenReagendar = (pedido: PedidoAnaliseCancelamento) => {
    setSelectedPedido(pedido)
    setDataUltimaManutencao("")
  }

  const handleConfirmReagendar = async () => {
    if (!selectedPedido) return
    setSaving(true)
    try {
      let ultimaManutencao: string | null = null
      if (dataUltimaManutencao) {
        const parsed = new Date(`${dataUltimaManutencao}T12:00:00`)
        if (Number.isNaN(parsed.getTime())) {
          throw new Error("Data inválida.")
        }
        ultimaManutencao = toDateOnlyISO(parsed)
      }

      await fetchJson(`/api/analise-cancelamento/${selectedPedido.id}/reagendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ultimaManutencao }),
      })

      toast({
        description: ultimaManutencao
          ? "Última manutenção atualizada e pedido cancelado."
          : "Pedido cancelado.",
      })

      setSelectedPedido(null)
      setDataUltimaManutencao("")
      await loadPedidos()
    } catch (error) {
      toast({
        title: "Erro ao concluir cancelamento",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleRecuseAction = async (action: "agendar-visita" | "concluir") => {
    if (!recusarDialogPedido) return
    setActionLoading(true)
    try {
      await fetchJson(`/api/analise-cancelamento/${recusarDialogPedido.id}/${action}`, {
        method: "POST",
      })
      toast({
        description:
          action === "agendar-visita"
            ? "Pedido movido para agendamento de visita."
            : "Pedido concluído com sucesso.",
      })
      setRecusarDialogPedido(null)
      await loadPedidos()
    } catch (error) {
      toast({
        title: "Erro na operação",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Análise de cancelamento</h1>
            <p className="text-sm text-muted-foreground">
              Pedidos aguardando decisão final. Reagende um contato se necessário; sem reagendamento o cliente volta a
              ficar livre.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadPedidos().catch(console.error)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em análise</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Pedidos aguardando decisão</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Pedidos em análise</CardTitle>
              <CardDescription>Revise motivos, reagende contato ou conclua o cancelamento.</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => loadPedidos().catch(console.error)} aria-label="Recarregar">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {state.loading ? (
              <div className="flex min-h-[220px] items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando pedidos...
              </div>
            ) : state.error ? (
              <Alert variant="destructive">
                <AlertDescription className="flex items-center justify-between gap-3 text-sm">
                  {state.error}
                  <Button size="sm" variant="outline" onClick={() => loadPedidos().catch(console.error)}>
                    Tentar novamente
                  </Button>
                </AlertDescription>
              </Alert>
            ) : state.data.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
                Nenhum pedido em análise de cancelamento.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px] text-xs uppercase text-muted-foreground">Pedido</TableHead>
                      <TableHead className="min-w-[220px] text-xs uppercase text-muted-foreground">Cliente</TableHead>
                      <TableHead className="text-xs uppercase text-muted-foreground">Localização</TableHead>
                      <TableHead className="text-xs uppercase text-muted-foreground">Criado em</TableHead>
                      <TableHead className="text-right text-xs uppercase text-muted-foreground">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {state.data.map((pedido) => (
                      <TableRow key={pedido.id} className="text-sm">
                        <TableCell className="font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            #{pedido.id}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => setPedidoDialogData({ id: pedido.id, clienteNome: pedido.clienteRazaoSocial })}
                            >
                              <Eye className="h-4 w-4 text-blue-600" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            className="text-left hover:underline"
                            onClick={() => setClienteDialogId(pedido.clienteId)}
                          >
                            <div className="font-medium text-foreground">{formatRazaoSocial(pedido.clienteRazaoSocial)}</div>
                            <p className="text-xs text-muted-foreground">{formatCNPJ(pedido.clienteCnpj)}</p>
                          </button>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div className="flex items-start gap-1">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 text-blue-500" />
                            <span>{[pedido.clienteBairro, pedido.clienteCidade, pedido.clienteEstado].filter(Boolean).join(" - ") || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-foreground">
                          {new Date(pedido.createdAt).toLocaleDateString("pt-BR")}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setViewMotivo(pedido.motivoCancelamento || "—")}
                            >
                              <Eye className="mr-1 h-4 w-4" />
                              Ver motivo
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleOpenReagendar(pedido)}>
                              Cancelar
                            </Button>
                            <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={() => setRecusarDialogPedido(pedido)}>
                              Recusar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={Boolean(selectedPedido)} onOpenChange={(open) => (!open ? setSelectedPedido(null) : undefined)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar cancelamento</DialogTitle>
              <DialogDescription>
                Confirmando, o pedido e o orçamento serão cancelados e a categoria do cliente será reavaliada.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Pedido #{selectedPedido?.id} — {formatRazaoSocial(selectedPedido?.clienteRazaoSocial ?? "")}
                </p>
                <p className="text-xs text-muted-foreground">CNPJ: {formatCNPJ(selectedPedido?.clienteCnpj ?? "")}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="data-ultima-manutencao">Data última manutenção (opcional)</Label>
                <Input
                  id="data-ultima-manutencao"
                  type="date"
                  value={dataUltimaManutencao}
                  onChange={(e) => setDataUltimaManutencao(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Se informada, a data de última manutenção do cliente será atualizada.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedPedido(null)}>
                Voltar
              </Button>
              <Button onClick={handleConfirmReagendar} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  "Confirmar"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(recusarDialogPedido)} onOpenChange={(open) => (!open ? setRecusarDialogPedido(null) : undefined)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Recusar cancelamento</DialogTitle>
              <DialogDescription>
                Se deseja manter este pedido, escolha uma das opções abaixo para prosseguir.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <Button
                variant="outline"
                className="flex h-24 flex-col items-center justify-center gap-2 border-primary/20 hover:border-primary hover:bg-primary/5"
                onClick={() => handleRecuseAction("agendar-visita")}
                disabled={actionLoading}
              >
                <Calendar className="h-6 w-6 text-primary" />
                <span className="font-semibold text-primary">Agendar Visita</span>
              </Button>
              <Button
                variant="outline"
                className="flex h-24 flex-col items-center justify-center gap-2 border-emerald-200 hover:border-emerald-600 hover:bg-emerald-50"
                onClick={() => handleRecuseAction("concluir")}
                disabled={actionLoading}
              >
                <CheckCircle className="h-6 w-6 text-emerald-600" />
                <span className="font-semibold text-emerald-600">Conclusão</span>
              </Button>
            </div>
            {actionLoading && (
              <div className="flex items-center justify-center py-2 text-sm text-muted-foreground animate-pulse">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando solicitação...
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRecusarDialogPedido(null)} disabled={actionLoading}>
                Voltar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(viewMotivo)} onOpenChange={(open) => (!open ? setViewMotivo(null) : undefined)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Motivo do cancelamento</DialogTitle>
              <DialogDescription>Informação registrada pelo time.</DialogDescription>
            </DialogHeader>
            <div className="text-sm text-foreground whitespace-pre-line">{viewMotivo || "—"}</div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewMotivo(null)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <ClienteDetailDialog
        clienteId={clienteDialogId || 0}
        open={clienteDialogId !== null}
        onClose={() => setClienteDialogId(null)}
      />

      <PedidoDetailsDialog
        pedidoData={pedidoDialogData ? { id: pedidoDialogData.id, itens: [] } : null}
        open={pedidoDialogData !== null}
        onOpenChange={(open) => !open && setPedidoDialogData(null)}
        clienteNome={pedidoDialogData?.clienteNome}
      />
    </DashboardLayout>
  )
}

