"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ClipboardList, Calendar, AlertTriangle, Loader2, RefreshCw, XCircle, MapPin, Eye } from "lucide-react"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { formatCNPJ, formatRazaoSocial } from "@/lib/formatters"
import { DistribuirServicoDialog } from "./distribuir-servico-dialog"
import { ReagendarVisitaDialog } from "./reagendar-visita-dialog"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
// Técnicos são carregados via API /api/usuarios?role=TECNICO
import { ClienteDetailDialog } from "@/components/leads/cliente-detail-dialog"
import { PedidoDetailsDialog, type PedidoHistoricoItem } from "@/components/leads/pedido-details-dialog"

type PedidoSupervisao = {
  id: number
  clienteId: number
  clienteRazaoSocial: string
  clienteCnpj: string
  endereco: string
  estado?: string | null
  cidade?: string | null
  valorTotal?: number
  criadoEm: string
  orcamentoId: number | null
  diasEmAberto?: number
  alerta?: boolean
  ultimaManutencaoConcluida?: string | null
  motivoCancelamento?: string | null
  motivoNaoAutorizado?: string | null
  visitaNaoAutorizadaId?: number | null
  tipoVisita?: string | null
  listaExtraRejeitada?: boolean
}

type VisitaAgendada = {
  id: number
  pedidoId: number | null
  pedidoStatus: string | null
  orcamentoId: number
  clienteId: number
  clienteRazaoSocial: string
  clienteCnpj: string
  endereco: string
  estado?: string | null
  cidade?: string | null
  dataMarcada: string
  dataRegistroInicio?: string | null
  status: string
  tecnicoId: string | null
  tecnicoNome: string | null
  diasDesdeMarcacao: number
  atrasada: boolean
  tipoVisita?: string | null
}

const LS_KEY_GROUP = "supervisao-tec-group"

type GroupConfig = { estado: boolean; cidade: boolean; tecnico: boolean }

function loadGroupConfig(): GroupConfig {
  try {
    const raw = localStorage.getItem(LS_KEY_GROUP)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { estado: !!parsed.estado, cidade: !!parsed.cidade, tecnico: !!parsed.tecnico }
    }
  } catch { /* ignore */ }
  return { estado: false, cidade: false, tecnico: false }
}

function saveGroupConfig(config: GroupConfig) {
  try {
    localStorage.setItem(LS_KEY_GROUP, JSON.stringify(config))
  } catch { /* ignore */ }
}

function normalizeStr(s: string): string {
  return s.trim().toUpperCase()
}

function groupKey(item: { estado?: string | null; cidade?: string | null }, config: GroupConfig): string {
  const estado = normalizeStr(item.estado?.trim() || "N/I")
  if (!config.estado) return ""
  if (config.cidade) {
    const cidade = item.cidade?.trim() || "N/I"
    return `${estado} / ${cidade}`
  }
  return estado
}

function groupKeyTecnico(item: { tecnicoNome?: string | null }): string {
  return item.tecnicoNome?.trim() || "Sem técnico"
}

function insertTecnicoGroupHeaders<T extends { tecnicoNome?: string | null }>(
  items: T[],
): Array<T | { __groupHeader: string; __count: number }> {
  const sorted = [...items].sort((a, b) => {
    const ka = groupKeyTecnico(a)
    const kb = groupKeyTecnico(b)
    return ka.localeCompare(kb, "pt-BR")
  })
  const result: Array<T | { __groupHeader: string; __count: number }> = []
  let lastKey = ""
  let currentCount = 0
  let headerIndex = -1
  for (const item of sorted) {
    const key = groupKeyTecnico(item)
    if (key !== lastKey) {
      if (headerIndex >= 0) {
        (result[headerIndex] as any).__count = currentCount
      }
      result.push({ __groupHeader: key, __count: 0 })
      headerIndex = result.length - 1
      currentCount = 0
      lastKey = key
    }
    result.push(item)
    currentCount++
  }
  if (headerIndex >= 0) {
    (result[headerIndex] as any).__count = currentCount
  }
  return result
}

function insertGroupHeaders<T extends { estado?: string | null; cidade?: string | null }>(
  items: T[],
  config: GroupConfig,
): Array<T | { __groupHeader: string; __count: number }> {
  if (!config.estado) return items
  const sorted = [...items].sort((a, b) => {
    const ka = groupKey(a, config)
    const kb = groupKey(b, config)
    return ka.localeCompare(kb, "pt-BR")
  })
  const result: Array<T | { __groupHeader: string; __count: number }> = []
  let lastKey = ""
  let currentCount = 0
  let headerIndex = -1
  for (const item of sorted) {
    const key = groupKey(item, config)
    if (key !== lastKey) {
      if (headerIndex >= 0) {
        (result[headerIndex] as any).__count = currentCount
      }
      result.push({ __groupHeader: key, __count: 0 })
      headerIndex = result.length - 1
      currentCount = 0
      lastKey = key
    }
    result.push(item)
    currentCount++
  }
  if (headerIndex >= 0) {
    (result[headerIndex] as any).__count = currentCount
  }
  return result
}

function isGroupHeader(item: any): item is { __groupHeader: string; __count: number } {
  return item && typeof item.__groupHeader === "string"
}

type SupervisaoTab = "pendentes" | "visitas" | "execucao" | "nao-autorizados" | "aprovacao"

type DataState<T> = {
  data: T[]
  loading: boolean
  error: string | null
  loaded: boolean
}

const createDataState = <T,>(): DataState<T> => ({
  data: [],
  loading: false,
  error: null,
  loaded: false,
})

const toDateOnlyISO = (value: Date) => {
  const normalized = new Date(value)
  normalized.setHours(12, 0, 0, 0)
  return normalized.toISOString()
}

type TecnicoOption = {
  id: string
  nome: string
  disponibilidade: string
}

const fetchJson = async <T,>(input: RequestInfo, init?: RequestInit) => {
  const response = await fetch(input, init)
  const payload = await response.json()
  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : "Erro ao processar requisição."
    throw new Error(message)
  }
  return payload as T
}

export function SupervisaoTecnica() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<SupervisaoTab>("pendentes")
  const [pendentesState, setPendentesState] = useState<DataState<PedidoSupervisao>>(createDataState)
  const [visitasState, setVisitasState] = useState<DataState<VisitaAgendada>>(createDataState)
  const [naoAutorizadosState, setNaoAutorizadosState] = useState<DataState<PedidoSupervisao>>(createDataState)
  const [aprovacaoState, setAprovacaoState] = useState<DataState<PedidoSupervisao>>(createDataState)

  // Rastreiam se cada aba já foi carregada pelo menos uma vez (nunca resetam para false)
  const [pendentesEverLoaded, setPendentesEverLoaded] = useState(false)
  const [visitasEverLoaded, setVisitasEverLoaded] = useState(false)
  const [naoAutorizadosEverLoaded, setNaoAutorizadosEverLoaded] = useState(false)
  const [aprovacaoEverLoaded, setAprovacaoEverLoaded] = useState(false)
  const [approvingId, setApprovingId] = useState<number | null>(null)

  // Lista de técnicos (carregada via API)
  const [tecnicos, setTecnicos] = useState<TecnicoOption[]>([])

  // Carrega lista de técnicos ao montar
  useEffect(() => {
    fetch("/api/usuarios?role=TECNICO")
      .then((res) => res.json())
      .then((result) => {
        const users = result.data ?? []
        setTecnicos(
          users
            .filter((u: { active?: boolean }) => u.active !== false)
            .map((u: { id: string; fullname?: string; name?: string }) => ({
              id: u.id,
              nome: u.fullname ?? u.name ?? "Técnico",
              disponibilidade: "disponivel",
            }))
        )
      })
      .catch((err) => console.error("Erro ao carregar técnicos:", err))
  }, [])

  const [selectedPedido, setSelectedPedido] = useState<PedidoSupervisao | null>(null)
  const [clienteDialogId, setClienteDialogId] = useState<string | null>(null)
  const [pedidoDetailData, setPedidoDetailData] = useState<PedidoHistoricoItem | null>(null)
  const [pedidoDetailOpen, setPedidoDetailOpen] = useState(false)
  const [distribuirDialogOpen, setDistribuirDialogOpen] = useState(false)
  const [selectedVisita, setSelectedVisita] = useState<VisitaAgendada | null>(null)
  const [reagendarDialogOpen, setReagendarDialogOpen] = useState(false)

  const [cancelingPedidoId, setCancelingPedidoId] = useState<number | null>(null)
  const [cancelingVisitaId, setCancelingVisitaId] = useState<number | null>(null)
  const [reagendandoVisitaId, setReagendandoVisitaId] = useState<number | null>(null)
  const [reagendandoPedidoId, setReagendandoPedidoId] = useState<number | null>(null)
  const [cancelDialogPedido, setCancelDialogPedido] = useState<PedidoSupervisao | null>(null)
  const [cancelMotivo, setCancelMotivo] = useState("")
  const [cancelUltimaManutencao, setCancelUltimaManutencao] = useState("")
  const [viewMotivo, setViewMotivo] = useState<string | null>(null)
  const [confirmNovaVisitaId, setConfirmNovaVisitaId] = useState<number | null>(null)

  // Grouping state
  const [groupConfig, setGroupConfig] = useState<GroupConfig>({ estado: false, cidade: false, tecnico: false })

  // Load from localStorage on client mount
  useEffect(() => {
    setGroupConfig(loadGroupConfig())
  }, [])

  const toggleGroup = useCallback((key: "estado" | "cidade" | "tecnico") => {
    setGroupConfig((prev) => {
      let next: GroupConfig
      if (key === "estado") {
        const newEstado = !prev.estado
        next = { ...prev, estado: newEstado, cidade: newEstado ? prev.cidade : false }
      } else if (key === "tecnico") {
        next = { ...prev, tecnico: !prev.tecnico }
      } else {
        // cidade can only be on if estado is on
        next = { ...prev, estado: true, cidade: !prev.cidade }
      }
      saveGroupConfig(next)
      return next
    })
  }, [])
  const fetchPendentes = useCallback(async () => {
    setPendentesState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const result = await fetchJson<{ data?: PedidoSupervisao[] }>("/api/supervisao/pendentes", { cache: "no-store" })
      setPendentesState({ data: result.data ?? [], loading: false, error: null, loaded: true })
      setPendentesEverLoaded(true)
    } catch (error) {
      console.error(error)
      setPendentesState({
        data: [],
        loading: false,
        error: error instanceof Error ? error.message : "Erro ao carregar pendentes.",
        loaded: true,
      })
      setPendentesEverLoaded(true)
    }
  }, [])

  const fetchVisitas = useCallback(async () => {
    setVisitasState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const result = await fetchJson<{ data?: VisitaAgendada[] }>("/api/supervisao/visitas", { cache: "no-store" })
      setVisitasState({ data: result.data ?? [], loading: false, error: null, loaded: true })
      setVisitasEverLoaded(true)
    } catch (error) {
      console.error(error)
      setVisitasState({
        data: [],
        loading: false,
        error: error instanceof Error ? error.message : "Erro ao carregar visitas.",
        loaded: true,
      })
      setVisitasEverLoaded(true)
    }
  }, [])

  const fetchNaoAutorizados = useCallback(async () => {
    setNaoAutorizadosState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const result = await fetchJson<{ data?: PedidoSupervisao[] }>("/api/supervisao/nao-autorizados", { cache: "no-store" })
      setNaoAutorizadosState({ data: result.data ?? [], loading: false, error: null, loaded: true })
      setNaoAutorizadosEverLoaded(true)
    } catch (error) {
      console.error(error)
      setNaoAutorizadosState({
        data: [],
        loading: false,
        error: error instanceof Error ? error.message : "Erro ao carregar não autorizados.",
        loaded: true,
      })
      setNaoAutorizadosEverLoaded(true)
    }
  }, [])

  const fetchAprovacoes = useCallback(async () => {
    setAprovacaoState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const result = await fetchJson<{ data?: PedidoSupervisao[] }>("/api/supervisao/aprovacoes", { cache: "no-store" })
      setAprovacaoState({ data: result.data ?? [], loading: false, error: null, loaded: true })
      setAprovacaoEverLoaded(true)
    } catch (error) {
      console.error(error)
      setAprovacaoState({
        data: [],
        loading: false,
        error: error instanceof Error ? error.message : "Erro ao carregar aprovações.",
        loaded: true,
      })
      setAprovacaoEverLoaded(true)
    }
  }, [])

  const handleAprovarConclusao = async (pedidoId: number) => {
    setApprovingId(pedidoId)
    try {
      await fetchJson(`/api/supervisao/aprovacoes/${pedidoId}/aprovar`, { method: "POST" })
      toast({ description: "Pedido enviado para aprovação final." })
      await fetchAprovacoes()
    } catch (error) {
      toast({
        title: "Erro ao aprovar",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setApprovingId(null)
    }
  }

  useEffect(() => {
    // pré-carregar contagens em todas as abas
    Promise.all([
      fetchPendentes(),
      fetchVisitas(),
      fetchNaoAutorizados(),
      fetchAprovacoes(),
    ]).catch(console.error)
  }, [fetchPendentes, fetchVisitas, fetchNaoAutorizados, fetchAprovacoes])

  useEffect(() => {
    if (activeTab === "pendentes" && !pendentesState.loaded && !pendentesState.loading) {
      fetchPendentes().catch(console.error)
    }
    if ((activeTab === "visitas" || activeTab === "execucao") && !visitasState.loaded && !visitasState.loading) {
      fetchVisitas().catch(console.error)
    }
    if (activeTab === "nao-autorizados" && !naoAutorizadosState.loaded && !naoAutorizadosState.loading) {
      fetchNaoAutorizados().catch(console.error)
    }
    if (activeTab === "aprovacao" && !aprovacaoState.loaded && !aprovacaoState.loading) {
      fetchAprovacoes().catch(console.error)
    }
  }, [
    activeTab,
    pendentesState.loaded,
    pendentesState.loading,
    visitasState.loaded,
    visitasState.loading,
    naoAutorizadosState.loaded,
    naoAutorizadosState.loading,
    aprovacaoState.loaded,
    aprovacaoState.loading,
    fetchPendentes,
    fetchVisitas,
    fetchNaoAutorizados,
    fetchAprovacoes,
  ])

  const stats = useMemo(() => {
    const pendentesAlertas = pendentesState.data.filter((item) => item.alerta).length
    const visitasAlertas = visitasState.data.filter((visita) => visita.atrasada).length
    const execucaoCount = visitasState.data.filter((visita) => visita.status === "EM_EXECUCAO").length
    return {
      pendentes: pendentesState.data.length,
      visitas: visitasState.data.length,
      execucao: execucaoCount,
      naoAutorizados: naoAutorizadosState.data.length,
      aprovacao: aprovacaoState.data.length,
      alertas: pendentesAlertas + visitasAlertas,
    }
  }, [pendentesState.data, visitasState.data, naoAutorizadosState.data, aprovacaoState.data])

  const execucaoVisitasState = useMemo<DataState<VisitaAgendada>>(
    () => ({
      ...visitasState,
      data: visitasState.data.filter((visita) => visita.status === "EM_EXECUCAO"),
    }),
    [visitasState],
  )

  const visitasAgendadasState = useMemo<DataState<VisitaAgendada>>(
    () => ({
      ...visitasState,
      data: visitasState.data.filter((visita) => visita.status !== "EM_EXECUCAO"),
    }),
    [visitasState],
  )

  const handleOpenDistribuir = (pedido: PedidoSupervisao) => {
    if (!pedido.orcamentoId) {
      toast({
        title: "Orçamento não encontrado",
        description: "Associe um orçamento ao pedido antes de distribuir para a supervisão.",
        variant: "destructive",
      })
      return
    }
    setSelectedPedido(pedido)
    setDistribuirDialogOpen(true)
  }

  const handleDistribuirSubmit = useCallback(
    async ({ dataMarcada, tecnicoId, observacao }: { dataMarcada: Date; tecnicoId: string; observacao?: string }) => {
      if (!selectedPedido) return
      if (!selectedPedido.orcamentoId) {
        toast({
          title: "Orçamento obrigatório",
          description: "Não é possível distribuir visitas sem um orçamento associado.",
          variant: "destructive",
        })
        return
      }
      try {
        await fetchJson("/api/supervisao/visitas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pedidoId: selectedPedido.id,
            clienteId: selectedPedido.clienteId,
            orcamentoId: selectedPedido.orcamentoId,
            dataMarcada: toDateOnlyISO(dataMarcada),
            tecnicoId,
            observacao,
          }),
        })
        toast({ description: "Visita técnica criada e pedido distribuído." })
        setSelectedPedido(null)
        await Promise.all([fetchPendentes(), fetchVisitas()])
      } catch (error) {
        toast({
          title: "Não foi possível distribuir",
          description: error instanceof Error ? error.message : "Erro desconhecido.",
          variant: "destructive",
        })
        throw error
      }
    },
    [selectedPedido, fetchPendentes, fetchVisitas, toast],
  )

  const handleCancelarPedido = async (pedidoId: number, ultimaManutencao?: string | null) => {
    if (!cancelMotivo.trim()) {
      toast({
        title: "Informe o motivo",
        description: "O motivo do cancelamento é obrigatório.",
        variant: "destructive",
      })
      return
    }
    setCancelingPedidoId(pedidoId)
    try {
      await fetchJson(`/api/supervisao/pedidos/${pedidoId}/cancelar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motivo: cancelMotivo,
          ultimaManutencao: ultimaManutencao ?? null,
        }),
      })
      toast({ description: `Pedido #${pedidoId} enviado para análise de cancelamento.` })
      await Promise.all([fetchPendentes(), fetchNaoAutorizados(), fetchVisitas(), fetchAprovacoes()])
    } catch (error) {
      toast({
        title: "Erro ao cancelar pedido",
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      })
    } finally {
      setCancelingPedidoId(null)
      setCancelDialogPedido(null)
      setCancelMotivo("")
      setCancelUltimaManutencao("")
    }
  }

  const handleReagendarPedido = async (pedidoId: number) => {
    setReagendandoPedidoId(pedidoId)
    try {
      await fetchJson(`/api/supervisao/pedidos/${pedidoId}/reagendar`, {
        method: "POST",
      })
      toast({ description: `Pedido #${pedidoId} reagendado para distribuição.` })
      await Promise.all([fetchNaoAutorizados(), fetchPendentes(), fetchVisitas()])
    } catch (error) {
      toast({
        title: "Erro ao reagendar pedido",
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      })
    } finally {
      setReagendandoPedidoId(null)
    }
  }

  const handleCancelarVisita = async (visita: VisitaAgendada) => {
    setCancelingVisitaId(visita.id)
    try {
      await fetchJson(`/api/supervisao/visitas/${visita.id}/cancelar`, { method: "POST" })
      toast({ description: `Visita #${visita.id} cancelada; pedido retornou para aguardando.` })
      await fetchVisitas()
    } catch (error) {
      toast({
        title: "Erro ao cancelar visita",
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      })
    } finally {
      setCancelingVisitaId(null)
    }
  }

  const handleOpenReagendar = (visita: VisitaAgendada) => {
    setSelectedVisita(visita)
    setReagendarDialogOpen(true)
  }

  const handleReagendarSubmit = async ({ dataMarcada, tecnicoId }: { dataMarcada: Date; tecnicoId?: string }) => {
    if (!selectedVisita) return
    setReagendandoVisitaId(selectedVisita.id)
    try {
      await fetchJson(`/api/supervisao/visitas/${selectedVisita.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataMarcada: toDateOnlyISO(dataMarcada),
          tecnicoId: tecnicoId
        }),
      })
      toast({ description: "Visita reagendada." })
      setReagendarDialogOpen(false)
      setSelectedVisita(null)
      await fetchVisitas()
    } catch (error) {
      toast({
        title: "Erro ao reagendar visita",
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      })
      throw error
    } finally {
      setReagendandoVisitaId(null)
    }
  }

  const renderPedidosTable = (
    dataset: PedidoSupervisao[],
    loading: boolean,
    error: string | null,
    emptyLabel: string,
    onReload: () => void,
    meta?: { title: string; description: string },
    options?: { mode?: "default" | "aprovar" | "nao-autorizados"; showTipo?: boolean },
  ) => (
    <Card>
      <CardHeader className="flex items-center justify-between gap-4">
        <div>
          <CardTitle>{meta?.title ?? "Pedidos aguardando distribuição"}</CardTitle>
          <CardDescription>
            {meta?.description ?? "Pedidos criados nos últimos 3 meses com status aguardando"}
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={onReload} aria-label="Recarregar pedidos">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={groupConfig.estado} onChange={() => toggleGroup("estado")} className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 cursor-pointer" />
            Por estado
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={groupConfig.cidade} onChange={() => toggleGroup("cidade")} disabled={!groupConfig.estado} className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 cursor-pointer disabled:opacity-40" />
            Por cidade
          </label>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Carregando pedidos...
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between gap-3 text-sm">
              {error}
              <Button size="sm" variant="outline" onClick={onReload}>
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        ) : dataset.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[48px] text-xs uppercase text-muted-foreground">Ver</TableHead>
                  <TableHead className="w-[80px] text-xs uppercase text-muted-foreground">Pedido</TableHead>
                  <TableHead className="min-w-[240px] text-xs uppercase text-muted-foreground">Cliente</TableHead>
                  {options?.showTipo && (
                    <TableHead className="text-xs uppercase text-muted-foreground">Tipo</TableHead>
                  )}
                  <TableHead className="text-xs uppercase text-muted-foreground">Pedido criado em</TableHead>
                  {options?.mode === "nao-autorizados" && (
                    <TableHead className="text-xs uppercase text-muted-foreground">Motivo</TableHead>
                  )}
                  <TableHead className="text-right text-xs uppercase text-muted-foreground">Aprovação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const colCount = 4 + (options?.showTipo ? 1 : 0) + (options?.mode === "nao-autorizados" ? 1 : 0) + 1
                  const grouped = insertGroupHeaders(dataset, groupConfig)
                  return grouped.map((item, idx) => {
                    if (isGroupHeader(item)) {
                      return (
                        <TableRow key={`group-${item.__groupHeader}`} className="bg-slate-100 hover:bg-slate-100">
                          <TableCell colSpan={colCount} className="py-2 text-xs font-bold text-slate-600 uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 text-blue-500" />
                              {item.__groupHeader}
                              <Badge variant="secondary" className="text-[10px] ml-1">{item.__count}</Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    }
                    const pedido = item
                    return (
                      <TableRow
                        key={pedido.id}
                        className={cn(
                          "text-sm",
                          pedido.alerta && "bg-amber-50/70",
                        )}
                      >
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => {
                              setPedidoDetailData({ id: pedido.id, itens: [] })
                              setPedidoDetailOpen(true)
                            }}
                            aria-label={`Ver pedido #${pedido.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">#{pedido.id}</TableCell>
                        <TableCell>
                          <div className="font-medium text-foreground flex items-center gap-2">
                            <button
                              type="button"
                              className="hover:underline text-left"
                              onClick={() => {
                                setClienteDialogId(String(pedido.clienteId))
                              }}
                            >
                              {formatRazaoSocial(pedido.clienteRazaoSocial)}
                            </button>
                            {options?.mode === "aprovar" && pedido.listaExtraRejeitada ? (
                              <Badge variant="destructive" className="text-[10px]">
                                Lista extra rejeitada
                              </Badge>
                            ) : null}
                          </div>
                          <div className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 text-blue-500" />
                            <span className="whitespace-normal break-words">{pedido.endereco}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{formatCNPJ(pedido.clienteCnpj)}</p>
                        </TableCell>
                        {options?.showTipo && (
                          <TableCell>
                            {pedido.tipoVisita ? (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  pedido.tipoVisita === "Aguardando conclusão" && "border-orange-400 text-orange-600 bg-orange-50",
                                  pedido.tipoVisita === "Primeira visita" && "border-blue-400 text-blue-600 bg-blue-50",
                                  pedido.tipoVisita === "Ord. Serv." && "border-yellow-400 text-yellow-700 bg-yellow-50"
                                )}
                              >
                                {pedido.tipoVisita}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-sm text-foreground">
                          {new Date(pedido.criadoEm).toLocaleDateString("pt-BR")}
                        </TableCell>
                        {options?.mode === "nao-autorizados" && (
                          <TableCell className="text-xs text-muted-foreground">
                            {pedido.motivoNaoAutorizado ? (
                              <Button
                                variant="link"
                                className="px-0 text-blue-600"
                                onClick={() => setViewMotivo(pedido.motivoNaoAutorizado || "—")}
                              >
                                <Eye className="mr-1 h-4 w-4" />
                                Ver motivo
                              </Button>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            {options?.mode === "aprovar" ? (
                              <div className="flex flex-wrap justify-end gap-2">
                                <Button
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => handleAprovarConclusao(pedido.id)}
                                  disabled={approvingId === pedido.id}
                                >
                                  {approvingId === pedido.id ? (
                                    <>
                                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                      Aprovando...
                                    </>
                                  ) : (
                                    "Aprovar"
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setCancelDialogPedido(pedido)}
                                >
                                  Cancelar pedido
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setConfirmNovaVisitaId(pedido.id)}
                                >
                                  Nova visita
                                </Button>
                              </div>
                            ) : options?.mode === "nao-autorizados" ? (
                              <div className="flex flex-wrap justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setCancelDialogPedido(pedido)}
                                >
                                  <XCircle className="mr-1 h-3 w-3" />
                                  Confirmar cancelamento
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReagendarPedido(pedido.id)}
                                  disabled={reagendandoPedidoId === pedido.id}
                                >
                                  {reagendandoPedidoId === pedido.id ? (
                                    <>
                                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                      Enviando...
                                    </>
                                  ) : (
                                    "Enviar para reagendamento"
                                  )}
                                </Button>
                              </div>
                            ) : (
                              <>
                                <Button size="sm" className="gap-2" onClick={() => handleOpenDistribuir(pedido)}>
                                  <Calendar className="h-4 w-4" />
                                  Distribuir
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setCancelDialogPedido(pedido)}
                                >
                                  <>
                                    <XCircle className="mr-1 h-3 w-3" />
                                    Cancelar
                                  </>
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                })()}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )

  const renderVisitasTable = (
    state: DataState<VisitaAgendada>,
    options?: {
      emptyLabel?: string
      hideReagendarCancelar?: boolean
      title?: string
      description?: string
      showTipo?: boolean
      hideStatus?: boolean
      showTecnicoGroup?: boolean
    },
  ) => (
    <Card>
      <CardHeader className="flex items-center justify-between gap-4">
        <div>
          <CardTitle>{options?.title ?? "Visitas agendadas"}</CardTitle>
          <CardDescription>
            {options?.description ?? "Visitas com status aguardando ou em execução"}
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={() => fetchVisitas().catch(console.error)} aria-label="Recarregar visitas">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={groupConfig.estado} onChange={() => toggleGroup("estado")} className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 cursor-pointer" />
            Por estado
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={groupConfig.cidade} onChange={() => toggleGroup("cidade")} disabled={!groupConfig.estado} className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 cursor-pointer disabled:opacity-40" />
            Por cidade
          </label>
          {options?.showTecnicoGroup && (
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input type="checkbox" checked={groupConfig.tecnico} onChange={() => toggleGroup("tecnico")} className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 cursor-pointer" />
              Por técnico
            </label>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {state.loading ? (
          <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Carregando visitas...
          </div>
        ) : state.error ? (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between gap-3 text-sm">
              {state.error}
              <Button size="sm" variant="outline" onClick={() => fetchVisitas().catch(console.error)}>
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        ) : state.data.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
            {options?.emptyLabel ?? "Nenhuma visita agendada encontrada."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px] text-xs uppercase text-muted-foreground">Pedido</TableHead>
                  <TableHead className="min-w-[240px] text-xs uppercase text-muted-foreground">Cliente</TableHead>
                  {options?.showTipo && (
                    <TableHead className="text-xs uppercase text-muted-foreground">Tipo</TableHead>
                  )}
                  <TableHead className="text-xs uppercase text-muted-foreground">Data da visita</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground">Início</TableHead>
                  {!options?.hideStatus && (
                    <TableHead className="text-xs uppercase text-muted-foreground">Status</TableHead>
                  )}
                  <TableHead className="text-xs uppercase text-muted-foreground">Orçamento</TableHead>
                  <TableHead className="text-right text-xs uppercase text-muted-foreground">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const colCount = 3 + (options?.showTipo ? 1 : 0) + (!options?.hideStatus ? 1 : 0) + 2 + (options?.hideReagendarCancelar ? 0 : 1)
                  let processedData: Array<VisitaAgendada | { __groupHeader: string; __count: number }>
                  if (options?.showTecnicoGroup && groupConfig.tecnico) {
                    processedData = insertTecnicoGroupHeaders(state.data)
                  } else {
                    processedData = insertGroupHeaders(state.data, groupConfig)
                  }
                  return processedData.map((item, idx) => {
                    if (isGroupHeader(item)) {
                      return (
                        <TableRow key={`vgroup-${item.__groupHeader}`} className="bg-slate-100 hover:bg-slate-100">
                          <TableCell colSpan={colCount} className="py-2 text-xs font-bold text-slate-600 uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 text-blue-500" />
                              {item.__groupHeader}
                              <Badge variant="secondary" className="text-[10px] ml-1">{item.__count}</Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    }
                    const visita = item
                    return (
                      <TableRow
                        key={`${visita.id}-${visita.orcamentoId}`}
                        className={cn(visita.atrasada && "bg-red-50/70")}
                      >
                        <TableCell className="font-semibold text-foreground">
                          {visita.pedidoId ? `#${visita.pedidoId}` : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-foreground">{formatRazaoSocial(visita.clienteRazaoSocial)}</div>
                          <div className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 text-blue-500" />
                            <span>{visita.endereco}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{formatCNPJ(visita.clienteCnpj)}</p>
                          {visita.tecnicoNome ? (
                            <Badge variant="secondary" className="mt-1 text-[10px]">
                              Técnico: {visita.tecnicoNome}
                            </Badge>
                          ) : null}
                        </TableCell>
                        {options?.showTipo && (
                          <TableCell>
                            {visita.tipoVisita ? (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  visita.tipoVisita === "Aguardando conclusão" && "border-orange-400 text-orange-600 bg-orange-50",
                                  visita.tipoVisita === "Primeira visita" && "border-blue-400 text-blue-600 bg-blue-50",
                                  visita.tipoVisita === "Ord. Serv." && "border-blue-500 text-blue-700 bg-blue-50"
                                )}
                              >
                                {visita.tipoVisita}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-sm text-foreground">
                          {new Date(visita.dataMarcada).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-sm text-foreground">
                          {visita.dataRegistroInicio
                            ? `${new Date(visita.dataRegistroInicio).toLocaleDateString("pt-BR")} ${new Date(visita.dataRegistroInicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                            : "—"}
                        </TableCell>
                        {!options?.hideStatus && (
                          <TableCell>
                            <Badge
                              variant={
                                visita.status === "EM_EXECUCAO"
                                  ? "secondary"
                                  : visita.atrasada
                                    ? "destructive"
                                    : "default"
                              }
                              className="text-[11px]"
                            >
                              {visita.status === "EM_EXECUCAO"
                                ? "Em execução"
                                : visita.atrasada
                                  ? "Atrasado"
                                  : "Aguardando"}
                            </Badge>
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge variant="outline" className="text-[11px]">
                            #{visita.orcamentoId}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            {!options?.hideReagendarCancelar && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenReagendar(visita)}
                                  disabled={reagendandoVisitaId === visita.id}
                                >
                                  {reagendandoVisitaId === visita.id ? (
                                    <>
                                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                      Reagendando...
                                    </>
                                  ) : (
                                    "Reagendar"
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleCancelarVisita(visita)}
                                  disabled={cancelingVisitaId === visita.id}
                                >
                                  {cancelingVisitaId === visita.id ? (
                                    <>
                                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                      Cancelando...
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="mr-1 h-3 w-3" />
                                      Cancelar
                                    </>
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                })()}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Supervisão técnica</h1>
            <p className="text-sm text-muted-foreground">
              Controle os pedidos aguardando distribuição e acompanhe as visitas técnicas.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => Promise.all([fetchPendentes(), fetchVisitas(), fetchNaoAutorizados(), fetchAprovacoes()])}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar tudo
          </Button>
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        </div>


        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SupervisaoTab)} className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <TabsList className="inline-flex rounded-2xl border border-slate-300 bg-white p-0 shadow-sm overflow-hidden">
              <TabsTrigger
                value="pendentes"
                className="px-6 py-3 text-sm font-semibold text-slate-600 transition data-[state=active]:bg-blue-600 data-[state=active]:text-white border-r border-slate-200"
              >
                <span>Pendentes</span>
                {pendentesEverLoaded ? (
                  <Badge className="ml-2 bg-amber-100 text-amber-800 border border-amber-200">
                    {stats.pendentes}
                  </Badge>
                ) : (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin text-amber-600" />
                )}
              </TabsTrigger>
              <TabsTrigger
                value="visitas"
                className="px-6 py-3 text-sm font-semibold text-slate-600 transition data-[state=active]:bg-blue-600 data-[state=active]:text-white border-r border-slate-200"
              >
                <span>Visitas agendadas</span>
                {visitasEverLoaded ? (
                  <Badge className="ml-2 bg-blue-100 text-blue-800 border border-blue-200">
                    {stats.visitas}
                  </Badge>
                ) : (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin text-blue-600" />
                )}
              </TabsTrigger>
              <TabsTrigger
                value="execucao"
                className="px-6 py-3 text-sm font-semibold text-slate-600 transition data-[state=active]:bg-blue-600 data-[state=active]:text-white border-r border-slate-200"
              >
                <span>Em execução</span>
                {visitasEverLoaded ? (
                  <Badge className="ml-2 bg-orange-100 text-orange-800 border border-orange-200">
                    {stats.execucao}
                  </Badge>
                ) : (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin text-orange-600" />
                )}
              </TabsTrigger>
              <TabsTrigger
                value="nao-autorizados"
                className="px-6 py-3 text-sm font-semibold text-slate-600 transition data-[state=active]:bg-blue-600 data-[state=active]:text-white border-r border-slate-200"
              >
                <span>Não autorizados</span>
                {naoAutorizadosEverLoaded ? (
                  <Badge className="ml-2 bg-red-100 text-red-800 border border-red-200">
                    {stats.naoAutorizados}
                  </Badge>
                ) : (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin text-red-600" />
                )}
              </TabsTrigger>
              <TabsTrigger
                value="aprovacao"
                className="px-6 py-3 text-sm font-semibold text-slate-600 transition data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                <span>Aprovar conclusão</span>
                {aprovacaoEverLoaded ? (
                  <Badge className="ml-2 bg-green-100 text-green-800 border border-green-200">
                    {stats.aprovacao}
                  </Badge>
                ) : (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin text-green-600" />
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="pendentes" className="space-y-4">
            {renderPedidosTable(
              pendentesState.data,
              pendentesState.loading,
              pendentesState.error,
              "Nenhum pedido pendente.",
              () => fetchPendentes().catch(console.error),
              {
                title: "Pedidos aguardando distribuição",
                description: "Pedidos criados nos últimos 3 meses com status aguardando",
              },
              { showTipo: true },
            )}
          </TabsContent>

          <TabsContent value="visitas" className="space-y-4">
            {renderVisitasTable(visitasAgendadasState, { showTipo: true, showTecnicoGroup: true })}
          </TabsContent>

          <TabsContent value="execucao" className="space-y-4">
            {renderVisitasTable(execucaoVisitasState, {
              emptyLabel: "Nenhuma visita em execução.",
              title: "Visitas em execução",
              description: "Visitas iniciadas com registro de horário",
              hideReagendarCancelar: true,
              hideStatus: true,
            })}
          </TabsContent>

          <TabsContent value="nao-autorizados" className="space-y-4">
            {renderPedidosTable(
              naoAutorizadosState.data,
              naoAutorizadosState.loading,
              naoAutorizadosState.error,
              "Nenhum pedido não autorizado.",
              () => fetchNaoAutorizados().catch(console.error),
              {
                title: "Não autorizados",
                description: "Pedidos aguardando confirmação ou reagendamento",
              },
              { mode: "nao-autorizados" },
            )}
          </TabsContent>

          <TabsContent value="aprovacao" className="space-y-4">
            {renderPedidosTable(
              aprovacaoState.data,
              aprovacaoState.loading,
              aprovacaoState.error,
              "Nenhum pedido aguardando aprovação.",
              () => fetchAprovacoes().catch(console.error),
              {
                title: "Aprovar conclusão",
                description: "Pedidos finalizados aguardando aprovação da supervisão",
              },
              { mode: "aprovar", showTipo: true },
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={Boolean(cancelDialogPedido)} onOpenChange={(open) => (!open ? setCancelDialogPedido(null) : undefined)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancelar pedido</DialogTitle>
              <DialogDescription>
                Confirme o cancelamento, registre a data da última manutenção (opcional) e informe o motivo
                (obrigatório).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Pedido #{cancelDialogPedido?.id} — {cancelDialogPedido?.clienteRazaoSocial}
                </p>
                {cancelDialogPedido?.ultimaManutencaoConcluida ? (
                  <p className="text-xs text-muted-foreground">
                    Último pedido concluído em:{" "}
                    {new Date(cancelDialogPedido.ultimaManutencaoConcluida).toLocaleDateString("pt-BR")}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhum pedido concluído registrado.</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="ultima-manutencao">Última manutenção (opcional)</Label>
                <Input
                  id="ultima-manutencao"
                  type="date"
                  max={toDateOnlyISO(new Date())}
                  value={cancelUltimaManutencao}
                  onChange={(e) => setCancelUltimaManutencao(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="motivo">Motivo (obrigatório)</Label>
                <Input
                  id="motivo"
                  placeholder="Descreva o motivo do cancelamento"
                  value={cancelMotivo}
                  onChange={(e) => setCancelMotivo(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCancelDialogPedido(null)}>
                Voltar
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  cancelDialogPedido &&
                  handleCancelarPedido(cancelDialogPedido.id, cancelUltimaManutencao || null)
                }
                disabled={cancelingPedidoId === cancelDialogPedido?.id}
              >
                {cancelingPedidoId === cancelDialogPedido?.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cancelando...
                  </>
                ) : (
                  "Confirmar cancelamento"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(confirmNovaVisitaId)} onOpenChange={(open) => (!open ? setConfirmNovaVisitaId(null) : undefined)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enviar para pendentes</DialogTitle>
              <DialogDescription>
                Este pedido voltará para pendentes da supervisão técnica para uma nova marcação de visita.
                Confirme para prosseguir.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmNovaVisitaId(null)}>
                Voltar
              </Button>
              <Button
                onClick={() => {
                  if (confirmNovaVisitaId) {
                    handleReagendarPedido(confirmNovaVisitaId)
                    setConfirmNovaVisitaId(null)
                  }
                }}
              >
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(viewMotivo)} onOpenChange={(open) => (!open ? setViewMotivo(null) : undefined)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Motivo do cancelamento</DialogTitle>
              <DialogDescription>Registro informado pelo time.</DialogDescription>
            </DialogHeader>
            <div className="text-sm text-foreground whitespace-pre-line">{viewMotivo || "—"}</div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewMotivo(null)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ClienteDetailDialog
          clienteId={clienteDialogId ?? ""}
          open={Boolean(clienteDialogId)}
          onClose={() => setClienteDialogId(null)}
          initialTab="info"
        />

        <PedidoDetailsDialog
          pedidoData={pedidoDetailData}
          open={pedidoDetailOpen}
          onOpenChange={(open) => {
            setPedidoDetailOpen(open)
            if (!open) {
              setPedidoDetailData(null)
            }
          }}
          onSuccess={async () => {
            await fetchAprovacoes()
          }}
        />

        <DistribuirServicoDialog
          open={distribuirDialogOpen}
          onOpenChange={setDistribuirDialogOpen}
          pedido={selectedPedido}
          tecnicos={tecnicos}
          onSubmit={handleDistribuirSubmit}
        />

        <ReagendarVisitaDialog
          open={reagendarDialogOpen}
          onOpenChange={setReagendarDialogOpen}
          visita={selectedVisita}
          tecnicos={tecnicos}
          onSubmit={handleReagendarSubmit}
        />
      </div>
    </DashboardLayout>
  )
}
