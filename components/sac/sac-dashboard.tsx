"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Check,
  HeadphonesIcon,
  MapPin,
  Loader2,
  Pencil,
  Plus,
  X,
  Save,
  Package,
  Calendar,
  Trash2,
  Eye,
  XCircle,
  History,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { formatCNPJ, formatRazaoSocial } from "@/lib/formatters"
import { ClienteDetailDialog } from "@/components/leads/cliente-detail-dialog"
import { PedidoDetailsDialog, type PedidoHistoricoItem } from "@/components/leads/pedido-details-dialog"
import { Input } from "@/components/ui/input"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

type SacListaExtraItem = {
  id: number
  itemId: number
  nome: string
  quantidade: number
  valorPraticado: number
  valorSugerido: number
}

type SacListaExtra = {
  id: number
  status: string
  createdAt: string
  itens: SacListaExtraItem[]
}

type SacVisita = {
  id: number
  dataMarcada: string
  listasExtras: SacListaExtra[]
}

type SacPedido = {
  id: number
  clienteId: number
  clienteRazaoSocial: string
  clienteCnpj: string
  clienteEstado: string | null
  endereco: string
  orcamentoId: number | null
  visitas: SacVisita[]
}

const pedidoStatusStyles: Record<string, string> = {
  AGUARDANDO: "bg-slate-500 text-white hover:bg-slate-500/80",
  AGENDADO: "bg-slate-500 text-white hover:bg-slate-500/80",
  EXECUCAO: "bg-slate-500 text-white hover:bg-slate-500/80",
  CONCLUIDO: "bg-emerald-500 text-white hover:bg-emerald-500/80",
  CANCELADO: "bg-red-500 text-white hover:bg-red-500/80",
  SAC: "bg-slate-500 text-white hover:bg-slate-500/80",
  AGUARDANDO_APROVACAO_SUPERVISAO: "bg-slate-500 text-white hover:bg-slate-500/80",
  AGUARDANDO_APROVACAO_FINAL: "bg-slate-500 text-white hover:bg-slate-500/80",
  ANALISE_CANCELAMENTO: "bg-slate-500 text-white hover:bg-slate-500/80",
  ANALISE_CANCELAMENTO_SUPERVISAO: "bg-slate-500 text-white hover:bg-slate-500/80",
}

const pedidoStatusLabels: Record<string, string> = {
  AGUARDANDO: "Aguardando",
  AGENDADO: "Agendado",
  EXECUCAO: "Em execução",
  SAC: "SAC",
  AGUARDANDO_APROVACAO_SUPERVISAO: "Sup. pendente",
  AGUARDANDO_APROVACAO_FINAL: "Aprovação final",
  CONCLUIDO: "Concluído",
  ANALISE_CANCELAMENTO: "Análise canc.",
  ANALISE_CANCELAMENTO_SUPERVISAO: "Canc. supervisão",
  CANCELADO: "Cancelado",
}

type ItemDisponivel = {
  id: string
  nome: string
  valor: number
  categoria: string | null
}

type ItemEditavel = {
  itemId: number
  nome: string
  quantidade: number
  valorPraticado: number
  valorSugerido: number
}

export function SacDashboard() {
  const { toast } = useToast()
  const [pedidos, setPedidos] = useState<SacPedido[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<number | null>(null)
  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [agruparPorEstado, setAgruparPorEstado] = useState(false)

  // Carregar configuração inicial do localStorage
  useEffect(() => {
    const saved = localStorage.getItem("sac-agrupar-estado")
    if (saved !== null) {
      setAgruparPorEstado(saved === "true")
    }
  }, [])

  // Salvar configuração sempre que mudar
  useEffect(() => {
    localStorage.setItem("sac-agrupar-estado", String(agruparPorEstado))
  }, [agruparPorEstado])
  // Estado do ClientDetailDialog
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null)
  const [clienteDialogTab, setClienteDialogTab] = useState<"info" | "pedidos">("info")

  // Estado do PedidoDetailsDialog
  const [selectedPedido, setSelectedPedido] = useState<PedidoHistoricoItem | null>(null)
  const [pedidoDialogOpen, setPedidoDialogOpen] = useState(false)

  // Estados de edição por lista
  const [editingListaId, setEditingListaId] = useState<number | null>(null)
  const [editedItens, setEditedItens] = useState<Map<number, ItemEditavel[]>>(new Map())

  // Busca de itens disponíveis
  const [itensDisponiveis, setItensDisponiveis] = useState<ItemDisponivel[]>([])
  const [loadingItens, setLoadingItens] = useState(false)
  const [itemSearchOpen, setItemSearchOpen] = useState<number | null>(null)

  // Histórico SAC
  const [historicoOpen, setHistoricoOpen] = useState(false)
  const [historicoPedidos, setHistoricoPedidos] = useState<any[]>([])
  const [historicoLoading, setHistoricoLoading] = useState(false)
  const [historicoPage, setHistoricoPage] = useState(1)
  const [historicoTotalPages, setHistoricoTotalPages] = useState(1)
  const [historicoMes, setHistoricoMes] = useState(new Date().getMonth() + 1)
  const [historicoAno, setHistoricoAno] = useState(new Date().getFullYear())
  const [historicoMetrics, setHistoricoMetrics] = useState<{
    totalOportunidades: number
    totalCondenados: number
    porcentagemCondenados: number
  } | null>(null)

  const getCondenadoStatus = (pedido: any) => {
    const allStatuses = pedido.visitasTecnicas?.flatMap((v: any) =>
      v.listaExtras?.map((l: any) => l.status)
    ) || []

    if (allStatuses.includes("APROVADO")) return { label: "Sim", color: "bg-emerald-100 text-emerald-700" }
    if (allStatuses.includes("PENDENTE")) return { label: "Aguardando", color: "bg-amber-100 text-amber-700" }
    return { label: "Não", color: "bg-slate-100 text-slate-600" }
  }

  const MESES_NOMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ]

  const navegarPeriodoHistorico = (direcao: "anterior" | "proximo") => {
    if (direcao === "anterior") {
      if (historicoMes === 1) {
        setHistoricoMes(12)
        setHistoricoAno(historicoAno - 1)
      } else {
        setHistoricoMes(historicoMes - 1)
      }
    } else {
      if (historicoMes === 12) {
        setHistoricoMes(1)
        setHistoricoAno(historicoAno + 1)
      } else {
        setHistoricoMes(historicoMes + 1)
      }
    }
    setHistoricoPage(1)
  }

  const fetchPedidos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/sac/pedidos", { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível carregar o SAC.")
      }
      setPedidos(payload.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar o SAC.")
      setPedidos([])
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchItens = useCallback(async () => {
    setLoadingItens(true)
    try {
      const response = await fetch("/api/items?limit=100")
      const payload = await response.json()
      if (response.ok) {
        setItensDisponiveis(payload.data ?? [])
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingItens(false)
    }
  }, [])

  useEffect(() => {
    fetchPedidos().catch(console.error)
    fetchItens().catch(console.error)
  }, [fetchPedidos, fetchItens])

  const totalListasExtras = useMemo(
    () =>
      pedidos.reduce((acc, pedido) => {
        const byPedido = pedido.visitas.reduce((sum, visita) => sum + visita.listasExtras.length, 0)
        return acc + byPedido
      }, 0),
    [pedidos],
  )

  const startEditing = (lista: SacListaExtra) => {
    setEditingListaId(lista.id)
    const itensEditaveis: ItemEditavel[] = lista.itens.map((item) => ({
      itemId: item.itemId,
      nome: item.nome,
      quantidade: item.quantidade,
      // Usa o valorPraticado do banco, ou valorSugerido se for 0
      valorPraticado: item.valorPraticado > 0 ? item.valorPraticado : item.valorSugerido,
      valorSugerido: item.valorSugerido,
    }))
    setEditedItens(new Map([[lista.id, itensEditaveis]]))
  }

  const cancelEditing = () => {
    setEditingListaId(null)
    setEditedItens(new Map())
    setItemSearchOpen(null)
  }

  const updateItemQuantidade = (listaId: number, itemId: number, quantidade: number) => {
    const current = editedItens.get(listaId) ?? []
    const updated = current.map((item) =>
      item.itemId === itemId ? { ...item, quantidade } : item
    )
    setEditedItens(new Map(editedItens.set(listaId, updated)))
  }

  const updateItemValor = (listaId: number, itemId: number, valorPraticado: number) => {
    const current = editedItens.get(listaId) ?? []
    const updated = current.map((item) =>
      item.itemId === itemId ? { ...item, valorPraticado } : item
    )
    setEditedItens(new Map(editedItens.set(listaId, updated)))
  }

  const removeItem = (listaId: number, itemId: number) => {
    const current = editedItens.get(listaId) ?? []
    const updated = current.filter((item) => item.itemId !== itemId)
    setEditedItens(new Map(editedItens.set(listaId, updated)))
  }

  const addItem = (listaId: number, item: ItemDisponivel) => {
    const current = editedItens.get(listaId) ?? []
    const exists = current.find((i) => i.itemId === Number(item.id))
    if (exists) {
      toast({ description: "Item já está na lista.", variant: "destructive" })
      return
    }
    const newItem: ItemEditavel = {
      itemId: Number(item.id),
      nome: item.nome,
      quantidade: 1,
      valorPraticado: item.valor,
      valorSugerido: item.valor,
    }
    setEditedItens(new Map(editedItens.set(listaId, [...current, newItem])))
    setItemSearchOpen(null)
  }

  const handleSaveEdit = async (listaId: number) => {
    const itens = editedItens.get(listaId) ?? []
    setSavingId(listaId)
    try {
      const response = await fetch(`/api/sac/listas/${listaId}/editar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itens: itens.map((item) => ({
            itemId: item.itemId,
            quantidade: item.quantidade,
            valorPraticado: item.valorPraticado,
          })),
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível salvar as alterações.")
      }
      toast({ description: "Lista atualizada com sucesso." })
      cancelEditing()
      await fetchPedidos()
    } catch (err) {
      toast({
        title: "Erro ao salvar",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setSavingId(null)
    }
  }

  const handleReject = async (listaId: number) => {
    setRejectingId(listaId)
    try {
      const response = await fetch(`/api/sac/listas/${listaId}/rejeitar`, { method: "POST" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível rejeitar a lista.")
      }
      toast({ description: "Lista rejeitada. Fluxo avançado sem adicionar itens." })
      await fetchPedidos()
    } catch (err) {
      toast({
        title: "Erro ao rejeitar",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setRejectingId(null)
    }
  }

  const handleApprove = async (listaId: number) => {
    setApprovingId(listaId)
    try {
      // A API busca os dados do banco, não precisa enviar itens
      const response = await fetch(`/api/sac/listas/${listaId}/aprovar`, {
        method: "POST",
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível aprovar a lista.")
      }
      toast({ description: "Lista aprovada com sucesso!" })
      await fetchPedidos()
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const fetchHistorico = useCallback(async (page: number, mes: number, ano: number) => {
    setHistoricoLoading(true)
    try {
      const res = await fetch(`/api/sac/historico?page=${page}&mes=${mes}&ano=${ano}`)
      const payload = await res.json()
      if (res.ok) {
        setHistoricoPedidos(payload.data ?? [])
        setHistoricoTotalPages(payload.pagination?.totalPages ?? 1)
        setHistoricoMetrics(payload.metrics ?? null)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setHistoricoLoading(false)
    }
  }, [])

  useEffect(() => {
    if (historicoOpen) {
      fetchHistorico(historicoPage, historicoMes, historicoAno)
    }
  }, [historicoOpen, historicoPage, historicoMes, historicoAno, fetchHistorico])

  const pedidosAgrupados = useMemo(() => {
    if (!agruparPorEstado) return null

    const grupos: Record<string, SacPedido[]> = {}

    pedidos.forEach(pedido => {
      // Filtrar pedidos que não têm listas extras pendentes
      const temPendentes = pedido.visitas.some(v => v.listasExtras.some(l => l.status === "PENDENTE"))
      if (!temPendentes) return

      const uf = (pedido.clienteEstado || "S/UF").toUpperCase()
      if (!grupos[uf]) grupos[uf] = []
      grupos[uf].push(pedido)
    })

    return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b))
  }, [pedidos, agruparPorEstado])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
              <HeadphonesIcon className="h-6 w-6 text-emerald-600" />
              SAC - Lista Extra
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Revise e aprove materiais adicionais solicitados pelos técnicos
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHistoricoOpen(true)}
              className="gap-2"
            >
              <History className="h-4 w-4" />
              Ver Histórico
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchPedidos().catch(console.error)}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
            </Button>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-card p-3 rounded-lg border border-border/50 w-fit">
          <Checkbox
            id="agrupar-estado"
            checked={agruparPorEstado}
            onCheckedChange={(checked) => setAgruparPorEstado(!!checked)}
          />
          <Label
            htmlFor="agrupar-estado"
            className="text-xs font-medium cursor-pointer select-none"
          >
            Agrupar por estado
          </Label>
        </div>

        {/* Métricas simplificadas */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Pedidos em SAC
                  </p>
                  <p className="text-2xl font-bold mt-1">{pedidos.length}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                  <Package className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 border-amber-200 dark:border-amber-800">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wide">
                    Listas Pendentes
                  </p>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">
                    {totalListasExtras}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Conteúdo principal */}
        {loading ? (
          <Card>
            <CardContent className="flex min-h-[180px] items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando...
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-destructive/50">
            <CardContent className="flex items-center justify-between gap-3 py-4 text-sm text-destructive">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={() => fetchPedidos().catch(console.error)}>
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        ) : pedidos.length === 0 ? (
          <Card>
            <CardContent className="flex min-h-[160px] items-center justify-center text-sm text-muted-foreground">
              <HeadphonesIcon className="h-5 w-5 mr-2 opacity-50" />
              Nenhum pedido em SAC no momento
            </CardContent>
          </Card>
        ) : agruparPorEstado ? (
          <div className="space-y-8">
            {pedidosAgrupados?.map(([uf, pedidosEstado]) => (
              <div key={uf} className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1">
                    {uf}
                  </Badge>
                  <div className="h-px flex-1 bg-border/60" />
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                    {pedidosEstado.length} {pedidosEstado.length === 1 ? "pedido" : "pedidos"}
                  </span>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {pedidosEstado.map((pedido) => (
                    <PedidoSacCard
                      key={pedido.id}
                      pedido={pedido}
                      editingListaId={editingListaId}
                      editedItens={editedItens}
                      startEditing={startEditing}
                      cancelEditing={cancelEditing}
                      handleSaveEdit={handleSaveEdit}
                      savingId={savingId}
                      itensDisponiveis={itensDisponiveis}
                      loadingItens={loadingItens}
                      itemSearchOpen={itemSearchOpen}
                      setItemSearchOpen={setItemSearchOpen}
                      addItem={addItem}
                      updateItemQuantidade={updateItemQuantidade}
                      updateItemValor={updateItemValor}
                      removeItem={removeItem}
                      rejectingId={rejectingId}
                      handleReject={handleReject}
                      approvingId={approvingId}
                      handleApprove={handleApprove}
                      setSelectedClienteId={setSelectedClienteId}
                      setClienteDialogTab={setClienteDialogTab}
                      setSelectedPedido={setSelectedPedido}
                      setPedidoDialogOpen={setPedidoDialogOpen}
                      formatCurrency={formatCurrency}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {pedidos.map((pedido) => {
              // Filtrar pedidos que não têm listas extras pendentes
              const temPendentes = pedido.visitas.some(v => v.listasExtras.some(l => l.status === "PENDENTE"))
              if (!temPendentes) return null

              return (
                <PedidoSacCard
                  key={pedido.id}
                  pedido={pedido}
                  editingListaId={editingListaId}
                  editedItens={editedItens}
                  startEditing={startEditing}
                  cancelEditing={cancelEditing}
                  handleSaveEdit={handleSaveEdit}
                  savingId={savingId}
                  itensDisponiveis={itensDisponiveis}
                  loadingItens={loadingItens}
                  itemSearchOpen={itemSearchOpen}
                  setItemSearchOpen={setItemSearchOpen}
                  addItem={addItem}
                  updateItemQuantidade={updateItemQuantidade}
                  updateItemValor={updateItemValor}
                  removeItem={removeItem}
                  rejectingId={rejectingId}
                  handleReject={handleReject}
                  approvingId={approvingId}
                  handleApprove={handleApprove}
                  setSelectedClienteId={setSelectedClienteId}
                  setClienteDialogTab={setClienteDialogTab}
                  setSelectedPedido={setSelectedPedido}
                  setPedidoDialogOpen={setPedidoDialogOpen}
                  formatCurrency={formatCurrency}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* ClientDetailDialog */}
      {selectedClienteId && (
        <ClienteDetailDialog
          clienteId={selectedClienteId}
          open={!!selectedClienteId}
          onClose={() => setSelectedClienteId(null)}
          initialTab={clienteDialogTab}
        />
      )}

      {/* PedidoDetailsDialog */}
      <PedidoDetailsDialog
        pedidoData={selectedPedido}
        open={pedidoDialogOpen}
        onOpenChange={(open) => {
          setPedidoDialogOpen(open)
          if (!open) {
            setSelectedPedido(null)
          }
        }}
        clienteNome={pedidos.find(p => p.id === selectedPedido?.id)?.clienteRazaoSocial}
        onSuccess={async () => {
          await fetchPedidos()
        }}
      />

      {/* Histórico SAC Dialog */}
      <Dialog open={historicoOpen} onOpenChange={setHistoricoOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-4">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-emerald-600" />
                Histórico SAC
              </div>
              <div className="flex items-center gap-2 mr-6">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => navegarPeriodoHistorico("anterior")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm font-medium min-w-[120px] text-center">
                  {MESES_NOMES[historicoMes - 1]} {historicoAno}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => navegarPeriodoHistorico("proximo")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Métricas do Histórico */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-slate-50 border rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Oportunidades</p>
              <p className="text-xl font-bold text-slate-700">{historicoMetrics?.totalOportunidades ?? 0}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center">
              <p className="text-[10px] text-emerald-700 uppercase font-semibold">Condenados</p>
              <p className="text-xl font-bold text-emerald-700">{historicoMetrics?.totalCondenados ?? 0}</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
              <p className="text-[10px] text-blue-700 uppercase font-semibold">Conversão SAC</p>
              <p className="text-xl font-bold text-blue-700">{historicoMetrics?.porcentagemCondenados ?? 0}%</p>
            </div>
          </div>

          <div className="flex-1 overflow-auto border rounded-md">
            <Table>
              <TableHeader className="bg-slate-50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="text-[10px] uppercase font-semibold h-8 w-16">ID</TableHead>
                  <TableHead className="text-[10px] uppercase font-semibold h-8">Cliente</TableHead>
                  <TableHead className="text-[10px] uppercase font-semibold h-8 w-24">Condenado</TableHead>
                  <TableHead className="text-[10px] uppercase font-semibold h-8 w-28">Status Pedido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historicoLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">
                      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Carregando histórico...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : historicoPedidos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-xs text-muted-foreground">
                      Nenhum pedido encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  historicoPedidos.map((ped) => (
                    <TableRow key={ped.id} className="hover:bg-slate-50/80">
                      <TableCell className="py-2">
                        <button
                          onClick={() => {
                            setSelectedPedido({ id: ped.id, orcamentoId: ped.orcamentoId ?? null, itens: [] })
                            setPedidoDialogOpen(true)
                          }}
                          className="text-[11px] font-mono font-medium text-blue-600 hover:underline"
                        >
                          #{ped.id}
                        </button>
                      </TableCell>
                      <TableCell className="py-2">
                        <button
                          onClick={() => {
                            setClienteDialogTab("info")
                            setSelectedClienteId(ped.cliente?.id)
                          }}
                          className="text-[11px] font-medium text-foreground hover:underline text-left"
                        >
                          {ped.cliente?.razaoSocial || "Cliente não informado"}
                        </button>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant="outline"
                          className={`${getCondenadoStatus(ped).color} text-[9px] border-none font-bold uppercase`}
                        >
                          {getCondenadoStatus(ped).label}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant="secondary"
                          className={`${pedidoStatusStyles[ped.status] || "bg-slate-500 text-white"} text-[9px] h-5 py-0 px-2 font-normal`}
                        >
                          {pedidoStatusLabels[ped.status] || ped.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between pt-4 mt-auto">
            <p className="text-[10px] text-muted-foreground">
              Página {historicoPage} de {historicoTotalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setHistoricoPage((p) => Math.max(1, p - 1))}
                disabled={historicoPage <= 1 || historicoLoading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setHistoricoPage((p) => Math.min(historicoTotalPages, p + 1))}
                disabled={historicoPage >= historicoTotalPages || historicoLoading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}

function PedidoSacCard({
  pedido,
  editingListaId,
  editedItens,
  startEditing,
  cancelEditing,
  handleSaveEdit,
  savingId,
  itensDisponiveis,
  loadingItens,
  itemSearchOpen,
  setItemSearchOpen,
  addItem,
  updateItemQuantidade,
  updateItemValor,
  removeItem,
  rejectingId,
  handleReject,
  approvingId,
  handleApprove,
  setSelectedClienteId,
  setClienteDialogTab,
  setSelectedPedido,
  setPedidoDialogOpen,
  formatCurrency,
}: {
  pedido: SacPedido
  editingListaId: number | null
  editedItens: Map<number, ItemEditavel[]>
  startEditing: (lista: SacListaExtra) => void
  cancelEditing: () => void
  handleSaveEdit: (listaId: number) => Promise<void>
  savingId: number | null
  itensDisponiveis: ItemDisponivel[]
  loadingItens: boolean
  itemSearchOpen: number | null
  setItemSearchOpen: (id: number | null) => void
  addItem: (listaId: number, item: ItemDisponivel) => void
  updateItemQuantidade: (listaId: number, itemId: number, quantidade: number) => void
  updateItemValor: (listaId: number, itemId: number, valor: number) => void
  removeItem: (listaId: number, itemId: number) => void
  rejectingId: number | null
  handleReject: (listaId: number) => Promise<void>
  approvingId: number | null
  handleApprove: (listaId: number) => Promise<void>
  setSelectedClienteId: (id: number | null) => void
  setClienteDialogTab: (tab: "info" | "pedidos") => void
  setSelectedPedido: (p: PedidoHistoricoItem | null) => void
  setPedidoDialogOpen: (o: boolean) => void
  formatCurrency: (v: number) => string
}) {
  const visitasPendentes = pedido.visitas
    .map((visita) => ({
      ...visita,
      listasExtras: visita.listasExtras.filter((lista) => lista.status === "PENDENTE"),
    }))
    .filter((visita) => visita.listasExtras.length > 0)

  if (visitasPendentes.length === 0) return null

  return (
    <Card className="overflow-hidden border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
      <CardHeader className="pb-2 pt-3 px-4 bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-900/50">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <button
              onClick={() => {
                setClienteDialogTab("info")
                setSelectedClienteId(pedido.clienteId)
              }}
              className="text-left hover:underline focus:outline-none focus:underline"
            >
              <h3 className="font-semibold text-foreground truncate text-sm">
                {formatRazaoSocial(pedido.clienteRazaoSocial)}
              </h3>
            </button>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatCNPJ(pedido.clienteCnpj)}
            </p>
            <div className="flex items-start gap-1.5 mt-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-slate-400" />
              <span className="line-clamp-1">{pedido.endereco}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => {
                setSelectedPedido({
                  id: pedido.id,
                  orcamentoId: pedido.orcamentoId,
                  itens: [],
                })
                setPedidoDialogOpen(true)
              }}
              title="Ver pedido"
            >
              <Eye className="h-3 w-3 mr-1" />
              Ver pedido
            </Button>
            <Badge variant="secondary" className="text-[10px] shrink-0">
              #{pedido.id}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-3 pt-2 space-y-2">
        {visitasPendentes.map((visita) => (
          <div key={visita.id}>
            {visita.listasExtras.map((lista) => {
              const isEditing = editingListaId === lista.id
              const itensAtuais = isEditing
                ? (editedItens.get(lista.id) ?? [])
                : lista.itens.map((item) => ({
                  itemId: item.itemId,
                  nome: item.nome,
                  quantidade: item.quantidade,
                  valorPraticado: item.valorPraticado > 0 ? item.valorPraticado : item.valorSugerido,
                  valorSugerido: item.valorSugerido,
                }))

              const totalLista = itensAtuais.reduce(
                (sum, item) => sum + item.quantidade * item.valorPraticado,
                0
              )

              return (
                <div
                  key={lista.id}
                  className={`rounded-lg border p-3 space-y-2 ${isEditing
                    ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/30"
                    : "border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                        Visita {new Date(visita.dataMarcada).toLocaleDateString("pt-BR")}
                      </Badge>
                    </div>
                    {!isEditing ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => startEditing(lista)}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                    ) : (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={cancelEditing}>
                          <X className="h-3 w-3 mr-1" />
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleSaveEdit(lista.id)}
                          disabled={savingId === lista.id}
                        >
                          {savingId === lista.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Save className="h-3 w-3 mr-1" />
                              Salvar
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {itensAtuais.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2 text-center">Nenhum item na lista</p>
                    ) : (
                      itensAtuais.map((item) => (
                        <div
                          key={item.itemId}
                          className="flex items-center gap-2 text-xs bg-white dark:bg-slate-800 rounded px-2 py-1.5 border border-slate-100 dark:border-slate-700"
                        >
                          {isEditing ? (
                            <>
                              <Input
                                type="number"
                                min={0}
                                value={item.quantidade}
                                onChange={(e) =>
                                  updateItemQuantidade(lista.id, item.itemId, Number(e.target.value))
                                }
                                className="w-14 h-6 text-xs text-center px-1"
                              />
                              <span className="text-muted-foreground">×</span>
                              <span className="flex-1 truncate font-medium">{item.nome}</span>
                              <span className="text-muted-foreground text-[10px]">R$</span>
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={item.valorPraticado}
                                onChange={(e) =>
                                  updateItemValor(lista.id, item.itemId, Number(e.target.value))
                                }
                                className="w-20 h-6 text-xs text-right px-1"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                onClick={() => removeItem(lista.id, item.itemId)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Badge
                                variant="secondary"
                                className="text-[10px] font-mono min-w-[2rem] justify-center"
                              >
                                {item.quantidade}×
                              </Badge>
                              <span className="flex-1 truncate">{item.nome}</span>
                              <span className="text-muted-foreground font-mono">
                                {formatCurrency(item.valorPraticado)}
                              </span>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {isEditing && (
                    <Popover
                      open={itemSearchOpen === lista.id}
                      onOpenChange={(open) => setItemSearchOpen(open ? lista.id : null)}
                    >
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="outline" className="w-full h-7 text-xs border-dashed">
                          <Plus className="h-3 w-3 mr-1" />
                          Adicionar item
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar produto/serviço..." className="h-8 text-xs" />
                          <CommandList>
                            <CommandEmpty>{loadingItens ? "Carregando..." : "Nenhum item encontrado"}</CommandEmpty>
                            <CommandGroup className="max-h-48 overflow-auto">
                              {itensDisponiveis.map((item) => (
                                <CommandItem
                                  key={item.id}
                                  value={item.nome}
                                  onSelect={() => addItem(lista.id, item)}
                                  className="text-xs cursor-pointer"
                                >
                                  <div className="flex-1 truncate">{item.nome}</div>
                                  <span className="text-muted-foreground text-[10px] ml-2">
                                    {formatCurrency(item.valor)}
                                  </span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                    <div className="text-xs">
                      <span className="text-muted-foreground">Total:</span>{" "}
                      <span className="font-semibold">{formatCurrency(totalLista)}</span>
                    </div>
                    {!isEditing && (
                      <div className="flex gap-1.5">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-3 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={rejectingId === lista.id}
                            >
                              {rejectingId === lista.id ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Rejeitando...
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Rejeitar
                                </>
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar rejeição</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação rejeita a lista extra e avança o fluxo sem adicionar itens. Deseja
                                prosseguir?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Voltar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleReject(lista.id)}
                                className="bg-destructive text-white hover:bg-destructive/90"
                              >
                                Confirmar rejeição
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700"
                              disabled={approvingId === lista.id || itensAtuais.length === 0}
                            >
                              {approvingId === lista.id ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Aprovando...
                                </>
                              ) : (
                                <>
                                  <Check className="h-3 w-3 mr-1" />
                                  Aprovar e adicionar
                                </>
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar aprovação</AlertDialogTitle>
                              <AlertDialogDescription className="space-y-2">
                                <p>
                                  Você está prestes a aprovar esta lista extra com{" "}
                                  <strong>{itensAtuais.length} item(ns)</strong> no valor total de{" "}
                                  <strong>{formatCurrency(totalLista)}</strong>.
                                </p>
                                <p>
                                  Os itens serão adicionados ao pedido e o estoque será atualizado. Esta ação não
                                  pode ser desfeita.
                                </p>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Voltar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleApprove(lista.id)}
                                className="bg-emerald-600 hover:bg-emerald-700"
                              >
                                Confirmar aprovação
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
