"use client"

import { useCallback, useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { FileText, ImageIcon, Loader2, FastForward, Clock, Check, Plus, Trash2, CheckCircle2, FileDown, RefreshCw, UserCog, Receipt, XCircle, FileCode, Send, Pencil, X, ChevronDown } from "lucide-react"
import { EditarPedidoForm } from "@/components/pedidos/editar-pedido-form"
import { NfeEmissionDialog } from "@/components/nfe/nfe-emission-dialog"
import { NfeStatusBadge } from "@/components/nfe/nfe-status-badge"
import { NfeActions } from "@/components/nfe/nfe-actions"
import { TrocarVendedorDialog } from "@/components/pedidos/trocar-vendedor-dialog"
import { useToast } from "@/hooks/use-toast"
import { Can } from "@/components/auth/can"
import { EarlyApprovalDialog } from "@/components/pedidos/early-approval-dialog"
import { PedidoStatusMapDialog, getPedidoStatusLabel, getPedidoStatusDescription } from "@/components/pedidos/pedido-status-map-dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ALLOWED_STATUSES_FOR_EARLY_APPROVAL, ROLES_ALLOWED_FOR_EARLY_APPROVAL } from "@/domain/pedido/early-approval-rules"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toDateInputValue } from "@/lib/date-utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SendDocumentsDialog } from "@/components/leads/send-documents-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CreateContratoModal } from "@/components/contratos/create-contrato-modal"

// Types
type HistoricoItemProduto = {
  itemId?: number
  nome: string
  quantidade: number
  valorUnitario: number
  subtotal: number
}

export type PedidoHistoricoItem = {
  id: number
  status?: string | null
  geradoART?: boolean | null
  tipoEspecial?: "OS" | null
  tipo?: string | null
  observacoes?: string | null
  detalhamento?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  vendedor?: string | null
  empresa?: string | null
  empresaId?: number | null
  bancoEmissorId?: number | null
  bancoEmissorNome?: string | null
  bancoEmissorCodigo?: number | null
  legacyBanco?: string | null
  filialUf?: string | null
  orcamentoId?: number | null
  total?: number | null
  parcelas?: number | null
  primeiroVencimento?: string | null
  medicaoOhmica?: number | null
  medicaoOhmicaMulti?: Array<{ torre: string; valor: number }> | null
  itens: HistoricoItemProduto[]
  cliente?: any | null
  contratoId?: number | null
  contrato?: {
    id: number
    status: string
  } | null
  isContratoVigente?: boolean
}

type DocumentoOperacional = {
  id: number
  tipo: string
  status: string
  url: string | null
  assinaturas: Array<{
    id: number
    nomeCompletoAssinante: string
    cpfAssinante: string | null
    localizacao: string
    url: string | null
  }>
}

type VisitaItem = {
  id: number
  status: string
  dataMarcada: string
  dataRegistroInicio: string | null
  dataRegistroFim: string | null
  tecnicoNome: string | null
  anexosCount?: number
}

type VisitaAnexo = {
  id: number
  url: string
}

type DebitoItem = {
  id: number
  valor: number
  status: number
  vencimento: string | null
  bancoEmissorId?: number | null
  bancoCodigo?: number | null
}

const FINANCEIRO_ACTION_ROLES = ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] as const

export interface PedidoDetailsDialogProps {
  pedidoData: PedidoHistoricoItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  clienteNome?: string
  onSuccess?: () => Promise<void>
}

export function PedidoDetailsDialog({
  pedidoData,
  open,
  onOpenChange,
  clienteNome,
  onSuccess,
}: PedidoDetailsDialogProps) {
  const { toast } = useToast()

  // Local state for pedido data (can be updated during refresh)
  const [localPedidoData, setLocalPedidoData] = useState<PedidoHistoricoItem | null>(pedidoData)
  const [loadingPedido, setLoadingPedido] = useState(false)
  const [pedidoError, setPedidoError] = useState<string | null>(null)
  const [localClienteNome, setLocalClienteNome] = useState<string | undefined>(clienteNome)

  // Documents state
  const [pedidoDocs, setPedidoDocs] = useState<DocumentoOperacional[]>([])
  const [pedidoDocsLoading, setPedidoDocsLoading] = useState(false)
  const [pedidoDocsError, setPedidoDocsError] = useState<string | null>(null)

  // Visits state
  const [pedidoVisitas, setPedidoVisitas] = useState<VisitaItem[]>([])
  const [pedidoVisitasLoading, setPedidoVisitasLoading] = useState(false)
  const [pedidoVisitasError, setPedidoVisitasError] = useState<string | null>(null)

  // Download state
  const [downloadLoadingId, setDownloadLoadingId] = useState<number | null>(null)

  // Debitos state (for Financeiro tab)
  const [pedidoDebitos, setPedidoDebitos] = useState<DebitoItem[]>([])
  const [pedidoDebitosLoading, setPedidoDebitosLoading] = useState(false)
  const [pedidoDebitosError, setPedidoDebitosError] = useState<string | null>(null)
  const [baixandoBoletoId, setBaixandoBoletoId] = useState<number | null>(null)
  const [baixandoBoletosPedido, setBaixandoBoletosPedido] = useState(false)

  // Create debito dialog state
  const [createDebitoOpen, setCreateDebitoOpen] = useState(false)
  const [createDebitoLoading, setCreateDebitoLoading] = useState(false)
  const [createDebitoForm, setCreateDebitoForm] = useState({
    vencimento: toDateInputValue(new Date()),
    valor: "",
  })

  // Baixa manual dialog state
  const [baixaManualOpen, setBaixaManualOpen] = useState(false)
  const [baixaManualTarget, setBaixaManualTarget] = useState<DebitoItem | null>(null)
  const [baixaManualForm, setBaixaManualForm] = useState({
    valorRecebido: "",
    dataOcorrencia: toDateInputValue(new Date()),
    acrescimos: "",
    descontos: "",
  })
  const [savingBaixa, setSavingBaixa] = useState(false)
  const [cancelandoPedido, setCancelandoPedido] = useState(false)

  // Anexos state
  const [anexosDialogVisitaId, setAnexosDialogVisitaId] = useState<number | null>(null)
  const [visitaAnexos, setVisitaAnexos] = useState<VisitaAnexo[]>([])
  const [loadingAnexos, setLoadingAnexos] = useState(false)
  const [previewAnexoUrl, setPreviewAnexoUrl] = useState<string | null>(null)

  // Early approval dialog state
  const [earlyApprovalOpen, setEarlyApprovalOpen] = useState(false)

  // ART action state
  const [artRequestLoading, setArtRequestLoading] = useState(false)

  // Ensure debitos state
  const [ensureDebitosLoading, setEnsureDebitosLoading] = useState(false)

  // Status map dialog state
  const [statusMapOpen, setStatusMapOpen] = useState(false)

  // Trocar Vendedor state
  const [trocarVendedorOpen, setTrocarVendedorOpen] = useState(false)

  // NFE Dialog state
  const [nfeDialogOpen, setNfeDialogOpen] = useState(false)

  // Send Documents Dialog state
  const [sendDocsDialogOpen, setSendDocsDialogOpen] = useState(false)


  // NFEs state (desacoplado de pedidos)
  const [nfes, setNfes] = useState<any[]>([])
  const [nfesLoading, setNfesLoading] = useState(false)
  // Editar Empresa
  const [editingEmpresa, setEditingEmpresa] = useState(false)
  const [empresas, setEmpresas] = useState<Array<{ id: number; nome: string }>>([])
  const [empresaSelectedId, setEmpresaSelectedId] = useState("")
  const [savingEmpresa, setSavingEmpresa] = useState(false)
  const [editingFilial, setEditingFilial] = useState(false)
  const [filiais, setFiliais] = useState<any[]>([])
  const [filialSelectedId, setFilialSelectedId] = useState("")
  const [loadingFiliais, setLoadingFiliais] = useState(false)
  const [savingFilial, setSavingFilial] = useState(false)
  const [clientContratos, setClientContratos] = useState<any[]>([])
  const [loadingContratos, setLoadingContratos] = useState(false)
  const [linkingContrato, setLinkingContrato] = useState(false)
  const [createContratoOpen, setCreateContratoOpen] = useState(false)

  // Fetch pedido data from API
  const fetchPedidoData = useCallback(async (pedidoId: number) => {

    setLoadingPedido(true)
    setPedidoError(null)
    try {
      const response = await fetch(`/api/pedidos/${pedidoId}`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível carregar dados do pedido.")
      }

      // Map API response to PedidoHistoricoItem format
      const pedido = payload.data ?? payload
      const mappedData: any = {
        id: pedido.id,
        status: pedido.status,
        geradoART: pedido.geradoART ?? null,
        tipoEspecial: pedido.tipoEspecial ?? null,
        observacoes: pedido.observacoes ?? null,
        detalhamento: pedido.detalhamento ?? null,
        createdAt: pedido.createdAt,
        updatedAt: pedido.updatedAt,
        // nfes removido - buscar via fetchNfes
        vendedor: pedido.vendedor?.name ?? pedido.vendedorNome ?? null,
        empresa: pedido.empresa?.nome ?? pedido.empresaNome ?? null,
        empresaId: pedido.empresa?.id ?? null,
        bancoEmissorId: pedido.bancoEmissorId ?? null,
        bancoEmissorNome: pedido.bancoEmissor?.nome ?? null,
        bancoEmissorCodigo: pedido.bancoEmissor?.bancoCodigo ?? null,
        legacyBanco: pedido.legacyBanco ?? null,
        filialUf: pedido.orcamento?.filial?.uf ?? pedido.filialUf ?? pedido.empresa?.filialUf ?? null,
        orcamentoId: pedido.orcamentoId ?? null,
        total: pedido.total ?? null,
        parcelas: pedido.parcelas ?? null,
        primeiroVencimento: pedido.primeiroVencimento ?? null,
        medicaoOhmica: pedido.medicaoOhmica ?? null,
        medicaoOhmicaMulti: pedido.medicaoOhmicaMulti ?? null,
        itens: (pedido.itens ?? []).map((item: any) => ({
          itemId: item.itemId ?? item.item?.id,
          nome: item.nome ?? item.item?.nome ?? "Item",
          quantidade: item.quantidade ?? 1,
          valorUnitario: item.valorUnitario ?? item.valor ?? 0,
          subtotal: (item.quantidade ?? 1) * (item.valorUnitario ?? item.valor ?? 0),
        })),
        cliente: pedido.cliente,
        contratoId: pedido.contratoId,
        contrato: pedido.contrato,
        isContratoVigente: pedido.isContratoVigente,
      }

      setLocalPedidoData(mappedData)

      // Also get cliente name if available
      if (pedido.cliente?.razaoSocial && !localClienteNome) {
        setLocalClienteNome(pedido.cliente.razaoSocial)
      }
    } catch (err) {
      setPedidoError(err instanceof Error ? err.message : "Erro ao carregar pedido.")
      console.error("Erro ao carregar pedido:", err)
    } finally {
      setLoadingPedido(false)
    }
  }, [localClienteNome])

  const handleOpenEditEmpresa = async () => {
    if (empresas.length === 0) {
      const res = await fetch("/api/empresas")
      const payload = await res.json().catch(() => ({}))
      setEmpresas(payload.data ?? [])
    }
    setEmpresaSelectedId(localPedidoData?.empresaId ? String(localPedidoData.empresaId) : "")
    setEditingEmpresa(true)
    setEditingFilial(false)
  }

  const handleSaveEmpresa = async () => {
    if (!localPedidoData?.orcamentoId || !empresaSelectedId) return
    setSavingEmpresa(true)
    try {
      const res = await fetch(`/api/orcamentos/${localPedidoData.orcamentoId}/empresa`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId: Number(empresaSelectedId) }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || "Erro ao salvar")
      const d = payload.data
      setLocalPedidoData((prev) =>
        prev ? { ...prev, empresa: d.empresa?.nome ?? prev.empresa, empresaId: d.empresa?.id ?? prev.empresaId, filialUf: d.filialUf ?? null } : prev
      )
      toast({ description: "Empresa atualizada." })
      setEditingEmpresa(false)
    } catch (err) {
      toast({ variant: "destructive", title: "Erro", description: err instanceof Error ? err.message : "Erro desconhecido" })
    } finally {
      setSavingEmpresa(false)
    }
  }

  const handleOpenEditFilial = async () => {
    if (!localPedidoData?.empresaId) return
    setLoadingFiliais(true)
    setEditingFilial(true)
    setEditingEmpresa(false) // Garante que não edita ambos ao mesmo tempo
    try {
      const res = await fetch(`/api/filiais?empresaId=${localPedidoData.empresaId}`)
      const payload = await res.json().catch(() => ({}))
      setFiliais(payload.data ?? [])
      // Tentar marcar a atual pelo UF
      const matching = (payload.data ?? []).find((f: any) => f.uf === localPedidoData.filialUf)
      if (matching) setFilialSelectedId(String(matching.id))
      else setFilialSelectedId("")
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingFiliais(false)
    }
  }

  const handleSaveFilial = async () => {
    if (!localPedidoData?.orcamentoId || !filialSelectedId) return
    setSavingFilial(true)
    try {
      const res = await fetch(`/api/orcamentos/${localPedidoData.orcamentoId}/filial`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filialId: Number(filialSelectedId) }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || "Erro ao salvar")

      setLocalPedidoData((prev) =>
        prev ? { ...prev, filialUf: payload.data?.filialUf ?? prev.filialUf } : prev
      )
      toast({ description: "Filial atualizada." })
      setEditingFilial(false)
    } catch (err) {
      toast({ variant: "destructive", title: "Erro", description: err instanceof Error ? err.message : "Erro desconhecido" })
    } finally {
      setSavingFilial(false)
    }
  }

  const handleLinkContrato = async (contratoId: number | null) => {
    if (!localPedidoData?.id) return
    setLinkingContrato(true)
    try {
      const res = await fetch(`/api/pedidos/${localPedidoData.id}/contrato`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contratoId }),
      })
      if (!res.ok) throw new Error("Erro ao vincular contrato")
      const updatedPedido = await res.json()
      setLocalPedidoData(prev => prev ? {
        ...prev,
        contratoId: updatedPedido.contratoId,
        contrato: updatedPedido.contrato,
        isContratoVigente: updatedPedido.isContratoVigente
      } : prev)
      toast({ title: contratoId ? "Contrato vinculado" : "Contrato desvinculado" })
    } catch (err) {
      toast({ variant: "destructive", title: "Erro", description: "Falha ao vincular contrato" })
    } finally {
      setLinkingContrato(false)
    }
  }

  const fetchClientContratos = async (clientId: number) => {
    setLoadingContratos(true)
    try {
      const res = await fetch(`/api/clientes/${clientId}/contratos`)
      if (res.ok) {
        const data = await res.json()
        setClientContratos(data.filter((c: any) => c.status === "OK"))
      }
    } catch (err) {
      console.error("Erro ao carregar contratos do cliente", err)
    } finally {
      setLoadingContratos(false)
    }
  }

  useEffect(() => {
    if (localPedidoData?.cliente?.id) {
      fetchClientContratos(localPedidoData.cliente.id)
    }
  }, [localPedidoData?.cliente?.id])

  // Fetch NFes separadamente (desacoplado)
  const fetchNfes = useCallback(async (pedidoId: number) => {
    setNfesLoading(true)
    try {
      const response = await fetch(`/api/nfe/by-pedido/${pedidoId}`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (response.ok) {
        setNfes(payload?.data ?? [])
      }
    } catch (err) {
      console.error("Erro ao carregar NFes:", err)
    } finally {
      setNfesLoading(false)
    }
  }, [])

  const handleRequestArt = async () => {
    if (!localPedidoData?.id) return
    setArtRequestLoading(true)
    try {
      const response = await fetch(`/api/pedidos/${localPedidoData.id}/art`, { method: "POST" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível solicitar ART.")
      }
      const geradoART = payload?.data?.geradoART ?? false
      setLocalPedidoData((prev) => (prev ? { ...prev, geradoART } : prev))
      toast({
        title: "ART solicitada",
        description: "Pedido marcado para exportação de ART.",
      })
      await onSuccess?.()
    } catch (err) {
      toast({
        title: "Erro ao solicitar ART",
        description: err instanceof Error ? err.message : "Não foi possível solicitar ART.",
        variant: "destructive",
      })
    } finally {
      setArtRequestLoading(false)
    }
  }


  // Sync local state with prop and fetch full data if needed
  useEffect(() => {
    if (pedidoData) {
      // Check if we have minimal data (only id) or full data
      const hasFullData = (
        pedidoData.geradoART !== undefined &&
        (pedidoData.status !== undefined || (pedidoData.itens && pedidoData.itens.length > 0 && pedidoData.itens[0].nome))
      )

      if (hasFullData) {
        setLocalPedidoData(pedidoData)
      } else if (open && pedidoData.id) {
        // We only have the ID, need to fetch full data
        fetchPedidoData(pedidoData.id).catch(console.error)
      }

      // Sempre carregar NFes quando dialog abre (desacoplado)
      if (open && pedidoData.id) {
        fetchNfes(pedidoData.id).catch(console.error)
      }
    }
  }, [pedidoData, open, fetchPedidoData, fetchNfes])

  // Sync clienteNome prop
  useEffect(() => {
    if (clienteNome) {
      setLocalClienteNome(clienteNome)
    }
  }, [clienteNome])

  // Fetch documents
  const fetchPedidoDocumentos = useCallback(async (pedidoId: number) => {
    setPedidoDocsLoading(true)
    setPedidoDocsError(null)
    try {
      const response = await fetch(`/api/pedidos/${pedidoId}/documentos`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível carregar documentos.")
      }
      setPedidoDocs(payload?.data ?? [])
    } catch (err) {
      setPedidoDocsError(err instanceof Error ? err.message : "Erro ao carregar documentos.")
      setPedidoDocs([])
    } finally {
      setPedidoDocsLoading(false)
    }
  }, [])

  // Fetch visits
  const fetchPedidoVisitas = useCallback(async (pedidoId: number) => {
    setPedidoVisitasLoading(true)
    setPedidoVisitasError(null)
    try {
      const response = await fetch(`/api/pedidos/${pedidoId}/visitas`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível carregar visitas.")
      }
      setPedidoVisitas(payload?.data ?? [])
    } catch (err) {
      setPedidoVisitasError(err instanceof Error ? err.message : "Erro ao carregar visitas.")
      setPedidoVisitas([])
    } finally {
      setPedidoVisitasLoading(false)
    }
  }, [])

  // Fetch anexos para uma visita
  const fetchVisitaAnexos = useCallback(async (visitaId: number) => {
    setLoadingAnexos(true)
    try {
      const res = await fetch(`/api/visitas/${visitaId}/anexos`)
      if (res.ok) {
        const json = await res.json()
        setVisitaAnexos(json.data ?? [])
      }
    } catch { /* ignore */ }
    finally { setLoadingAnexos(false) }
  }, [])

  const openAnexosDialog = (visitaId: number) => {
    setAnexosDialogVisitaId(visitaId)
    fetchVisitaAnexos(visitaId).catch(console.error)
  }

  // Fetch debitos (for Financeiro tab)
  const fetchPedidoDebitos = useCallback(async (pedidoId: number) => {
    setPedidoDebitosLoading(true)
    setPedidoDebitosError(null)
    try {
      const response = await fetch(`/api/pedidos/${pedidoId}/debitos`, { cache: "no-store" })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível carregar débitos.")
      }
      setPedidoDebitos(payload?.debitos ?? [])
    } catch (err) {
      setPedidoDebitosError(err instanceof Error ? err.message : "Erro ao carregar débitos.")
      setPedidoDebitos([])
    } finally {
      setPedidoDebitosLoading(false)
    }
  }, [])

  // Handle boleto download
  const handleDownloadBoleto = useCallback(
    async (debito: DebitoItem) => {
      if (!debito.bancoEmissorId) {
        toast({ variant: "destructive", title: "Banco não informado para este débito." })
        return
      }
      setBaixandoBoletoId(debito.id)
      try {
        const res = await fetch(`/api/boletos/${debito.id}`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || "Falha ao gerar boleto.")
        }
        const blob = await res.blob()
        const dispo = res.headers.get("Content-Disposition") || ""
        const match = dispo.match(/filename="(.+)"/)
        const filename = match?.[1] ?? `boleto-${debito.id}.pdf`

        const url = window.URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)

        toast({ title: "Boleto gerado", description: `Débito #${debito.id}` })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao gerar boleto."
        toast({ variant: "destructive", title: "Erro", description: message })
      } finally {
        setBaixandoBoletoId(null)
      }
    },
    [toast]
  )

  const handleDownloadBoletosPedido = useCallback(async () => {
    if (!localPedidoData?.id) return
    setBaixandoBoletosPedido(true)
    try {
      const res = await fetch(`/api/pedidos/${localPedidoData.id}/boletos`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || "Falha ao gerar boletos.")
      }
      const blob = await res.blob()
      const dispo = res.headers.get("Content-Disposition") || ""
      const match = dispo.match(/filename="(.+)"/)
      const filename = match?.[1] ?? `boletos-pedido-${localPedidoData.id}.pdf`

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      toast({ title: "Boletos gerados", description: `Pedido #${localPedidoData.id}` })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao gerar boletos."
      toast({ variant: "destructive", title: "Erro", description: message })
    } finally {
      setBaixandoBoletosPedido(false)
    }
  }, [localPedidoData?.id, toast])

  const handleCreateDebito = async () => {
    if (!localPedidoData?.id) return
    const valor = Number(createDebitoForm.valor)
    if (!valor || Number.isNaN(valor) || valor <= 0) {
      toast({ variant: "destructive", title: "Informe um valor válido." })
      return
    }
    if (!createDebitoForm.vencimento) {
      toast({ variant: "destructive", title: "Informe o vencimento." })
      return
    }
    setCreateDebitoLoading(true)
    try {
      const res = await fetch(`/api/pedidos/${localPedidoData.id}/debitos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          valor,
          vencimento: createDebitoForm.vencimento,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error || "Não foi possível criar o débito.")
      }
      toast({ title: "Débito criado", description: `Pedido #${localPedidoData.id}` })
      setCreateDebitoOpen(false)
      await fetchPedidoDebitos(localPedidoData.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao criar débito."
      toast({ variant: "destructive", title: "Erro", description: message })
    } finally {
      setCreateDebitoLoading(false)
    }
  }

  const handleOpenBaixaManual = (debito: DebitoItem) => {
    setBaixaManualTarget(debito)
    setBaixaManualForm({
      valorRecebido: debito.valor?.toString() ?? "",
      dataOcorrencia: toDateInputValue(new Date()),
      acrescimos: "",
      descontos: "",
    })
    setBaixaManualOpen(true)
  }

  const handleSubmitBaixaManual = async () => {
    if (!baixaManualTarget) return
    const valor = Number(baixaManualForm.valorRecebido)
    if (!valor || Number.isNaN(valor) || valor <= 0) {
      toast({ variant: "destructive", title: "Informe um valor recebido válido." })
      return
    }
    setSavingBaixa(true)
    try {
      const res = await fetch(`/api/financeiro/contas-receber/${baixaManualTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          valorRecebido: valor,
          dataOcorrencia: baixaManualForm.dataOcorrencia,
          acrescimos: Number(baixaManualForm.acrescimos || 0),
          descontos: Number(baixaManualForm.descontos || 0),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error || "Não foi possível registrar a baixa manual.")
      }
      toast({ title: "Baixa registrada", description: `Débito #${baixaManualTarget.id} marcado como recebido.` })
      setBaixaManualOpen(false)
      if (localPedidoData?.id) {
        await fetchPedidoDebitos(localPedidoData.id)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar baixa manual."
      toast({ variant: "destructive", title: "Erro", description: message })
    } finally {
      setSavingBaixa(false)
    }
  }

  const handleDeleteDebito = async (debito: DebitoItem) => {
    if (!window.confirm(`Cancelar o débito #${debito.id}?`)) return
    try {
      const res = await fetch(`/api/financeiro/contas-receber/${debito.id}`, { method: "DELETE" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error || "Não foi possível cancelar o débito.")
      }
      toast({ title: "Débito cancelado", description: `Débito #${debito.id} marcado como cancelado.` })
      if (localPedidoData?.id) {
        await fetchPedidoDebitos(localPedidoData.id)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao cancelar débito."
      toast({ variant: "destructive", title: "Erro", description: message })
    }
  }

  const handleCancelarPedido = async () => {
    if (!localPedidoData?.id) return
    if (!window.confirm(`Cancelar o pedido #${localPedidoData.id}?`)) return
    setCancelandoPedido(true)
    try {
      const res = await fetch(`/api/pedidos/${localPedidoData.id}/cancelar`, { method: "POST" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error || "Não foi possível cancelar o pedido.")
      }
      toast({ title: "Pedido cancelado", description: `Pedido #${localPedidoData.id} marcado como cancelado.` })
      await fetchPedidoData(localPedidoData.id)
      await fetchPedidoDebitos(localPedidoData.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao cancelar pedido."
      toast({ variant: "destructive", title: "Erro", description: message })
    } finally {
      setCancelandoPedido(false)
    }
  }

  const handleEnsureDebitos = async () => {
    if (!localPedidoData?.id) return
    if (!window.confirm("Deseja gerar os débitos para este pedido conforme o orçamento?")) return

    setEnsureDebitosLoading(true)
    try {
      const res = await fetch(`/api/pedidos/${localPedidoData.id}/ensure-debitos`, {
        method: "POST"
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || "Erro ao gerar débitos.")
      }

      toast({ title: "Processamento concluído", description: data.message || (data.created ? "Débitos gerados com sucesso." : "Débitos já existiam.") })
      await fetchPedidoDebitos(localPedidoData.id)
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: err instanceof Error ? err.message : "Falha ao gerar débitos."
      })
    } finally {
      setEnsureDebitosLoading(false)
    }
  }

  // Handle document download
  const handleDownloadDocumento = useCallback(
    async (docId: number) => {
      try {
        setDownloadLoadingId(docId)
        const resp = await fetch(`/api/documentos-operacionais/${docId}/download`)
        const payload = await resp.json().catch(() => ({}))
        if (!resp.ok || !payload?.url) {
          throw new Error(payload?.error || "Não foi possível gerar o link de download.")
        }
        window.open(payload.url, "_blank", "noopener,noreferrer")
      } catch (err) {
        console.error(err)
        toast({
          title: "Erro ao baixar",
          description: err instanceof Error ? err.message : "Falha ao gerar link de download.",
          variant: "destructive",
        })
      } finally {
        setDownloadLoadingId(null)
      }
    },
    [toast]
  )

  // Load data when dialog opens
  useEffect(() => {
    if (open && pedidoData?.id) {
      fetchPedidoDocumentos(pedidoData.id).catch(console.error)
      fetchPedidoVisitas(pedidoData.id).catch(console.error)
      fetchPedidoDebitos(pedidoData.id).catch(console.error)
    }
  }, [open, pedidoData?.id, fetchPedidoDocumentos, fetchPedidoVisitas, fetchPedidoDebitos])

  // Clean up when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setPedidoDocs([])
      setPedidoDocsError(null)
      setPedidoVisitas([])
      setPedidoVisitasError(null)
      setPedidoDebitos([])
      setPedidoDebitosError(null)
      setPedidoError(null)
      setLocalPedidoData(null)
      setLocalClienteNome(undefined)
    }
    onOpenChange(newOpen)
  }

  // Format currency helper
  const formatCurrency = (value?: number | null, fallback = "R$ 0,00") => {
    if (value === null || value === undefined) return fallback
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  }

  // Lógica igual ao legado:
  // - status = 2: Recebido
  // - status = -1: Cancelado (não conta como a receber)
  // - status = 0: Pendente (a receber ou vencido, dependendo da data)
  const totalRecebido = pedidoDebitos.reduce((sum, debito) => (debito.status === 2 ? sum + (debito.valor ?? 0) : sum), 0)
  const totalAReceber = pedidoDebitos.reduce(
    (sum, debito) => (debito.status === 0 ? sum + (debito.valor ?? 0) : sum),
    0,
  )

  // Format date helper
  const formatDate = (dateStr?: string | null, fallback = "—") => {
    if (!dateStr) return fallback
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return fallback
    return date.toLocaleDateString("pt-BR")
  }

  // Handle form success
  const handleFormSuccess = async () => {
    if (!localPedidoData) return

    setLocalPedidoData((prev) => prev && { ...prev, status: "RECARREGANDO" } as PedidoHistoricoItem)

    if (onSuccess) {
      await onSuccess()
    }

    // Refresh pedido data, documents and visits
    await fetchPedidoData(localPedidoData.id)
    fetchPedidoDocumentos(localPedidoData.id).catch(console.error)
    fetchPedidoVisitas(localPedidoData.id).catch(console.error)
  }

  // Update local data from parent (used after parent refreshes history)
  const updatePedidoData = useCallback((newData: PedidoHistoricoItem) => {
    setLocalPedidoData(newData)
  }, [])


  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-full md:w-auto md:min-w-[900px] lg:min-w-[1024px] h-[100dvh] md:h-auto md:max-h-[calc(100vh-24px)] flex flex-col overflow-hidden border-0 md:border border-slate-200 bg-gradient-to-b from-slate-50 to-white shadow-xl rounded-none md:rounded-xl p-3 md:p-6">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-shrink-0">
              <p className="text-[11px] sm:text-[13px] uppercase tracking-wide font-bold">
                {localPedidoData?.tipoEspecial === "OS" ? "Ordem de Serviço" : "Pedido"} #{localPedidoData?.id ?? "--"}
              </p>
              {localPedidoData?.status && (() => {
                const rawStatus = localPedidoData.status.toUpperCase()
                const isConcluido = rawStatus === "CONCLUIDO"
                const isCancelado = rawStatus === "CANCELADO"
                const isOs = localPedidoData.tipoEspecial === "OS"
                const statusLabel = getPedidoStatusLabel(rawStatus)
                return (
                  <div className="flex flex-col items-start">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-medium px-1.5 py-0.5 cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all",
                            isOs
                              ? "text-[10px] border-blue-500 bg-blue-50 text-blue-700"
                              : "text-[11px]",
                            !isOs &&
                            (isCancelado
                              ? "border-red-500 bg-red-100 text-red-700"
                              : isConcluido
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-gray-400 bg-gray-200 text-gray-700"),
                          )}
                          onClick={() => setStatusMapOpen(true)}
                        >
                          {statusLabel}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>{getPedidoStatusDescription(rawStatus)}</TooltipContent>
                    </Tooltip>
                    {isOs && (
                      <span className="mt-0.5 text-[10px] text-blue-600">Ord. Serv.</span>
                    )}
                    {localPedidoData?.contratoId && (
                      <Badge variant="outline" className="mt-0.5 text-[10px] bg-blue-100 text-blue-700 border-blue-200 h-5 px-1 font-bold">
                        CONTRATO #{localPedidoData.contratoId}
                      </Badge>
                    )}
                  </div>
                )
              })()}
            </div>
            <div className="flex flex-nowrap overflow-x-auto items-center gap-1.5 justify-end flex-shrink-0">
              {localPedidoData && (
                <div className="flex items-center gap-1">
                  {clientContratos.length > 0 ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant={localPedidoData.contratoId ? "default" : "outline"}
                          size="sm"
                          className={cn(
                            "h-7 px-2 text-[10px] font-bold uppercase",
                            localPedidoData.contratoId
                              ? (localPedidoData.isContratoVigente
                                ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                                : "bg-slate-500 hover:bg-slate-600 text-white border-slate-500")
                              : "border-blue-200 text-blue-600 hover:bg-blue-50"
                          )}
                          disabled={linkingContrato}
                        >
                          {localPedidoData.contratoId ? (
                            `Contrato #${localPedidoData.contratoId}${localPedidoData.isContratoVigente ? "" : " (EXPIRADO)"}`
                          ) : (
                            <>Vincular Contrato</>
                          )}
                          <ChevronDown className="ml-1 h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel className="text-[10px] uppercase font-bold text-slate-500">Contratos Disponíveis</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {clientContratos.map(c => (
                          <DropdownMenuItem
                            key={c.id}
                            className="text-[11px] cursor-pointer"
                            onClick={() => handleLinkContrato(c.id)}
                          >
                            Contrato #{c.id} ({c.status})
                          </DropdownMenuItem>
                        ))}
                        {localPedidoData.contratoId && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-[11px] cursor-pointer text-red-600"
                              onClick={() => handleLinkContrato(null)}
                            >
                              Remover Vínculo
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium mr-1 uppercase">Sem contratos ativos</span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1 border-l pl-1.5 border-slate-200 ml-0.5">
                <Can roles={["MASTER", "ADMINISTRADOR", "FINANCEIRO", "SUPERVISOR"]}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full hover:bg-slate-200"
                    onClick={() => setTrocarVendedorOpen(true)}
                    title="Alterar vendedor"
                  >
                    <UserCog className="h-3 w-3 text-slate-500" />
                  </Button>
                </Can>
                <Badge variant="outline" className="text-[11px] bg-white text-slate-700 border-slate-200 px-1.5 py-0.5 font-semibold">
                  {localPedidoData?.vendedor ?? "Sem vendedor"}
                </Badge>
              </div>
            </div>
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-2 grid gap-2 md:grid-cols-2 text-[13px] text-slate-700">
              <div className="rounded-md border border-slate-200 bg-white/80 p-2">
                <span className="text-[11px] uppercase text-muted-foreground font-semibold">Criado em</span>
                <p className="font-medium">{formatDate(localPedidoData?.createdAt ?? undefined)}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-white/80 p-2 flex flex-row gap-4 items-start overflow-x-auto">
                <div className="flex-1">
                  <span className="text-[11px] uppercase text-muted-foreground font-semibold block">Empresa</span>
                  {editingEmpresa ? (
                    <div className="flex items-center gap-1 mt-1">
                      <Select value={empresaSelectedId} onValueChange={setEmpresaSelectedId}>
                        <SelectTrigger className="h-7 text-xs flex-1">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {empresas.map((e) => (
                            <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveEmpresa} disabled={savingEmpresa} title="Salvar">
                        {savingEmpresa ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-emerald-600" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingEmpresa(false)} disabled={savingEmpresa} title="Cancelar">
                        <X className="h-3.5 w-3.5 text-slate-400" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-blue-700">{localPedidoData?.empresa ?? "—"}</p>
                      <Can roles={["MASTER", "ADMINISTRADOR", "FINANCEIRO"]}>
                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => { setEditingEmpresa(true); setEditingFilial(false); handleOpenEditEmpresa(); }} title="Alterar empresa">
                          <Pencil className="h-3 w-3 text-slate-400" />
                        </Button>
                      </Can>
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <span className="text-[11px] uppercase text-muted-foreground font-semibold block">Filial</span>
                  {editingFilial ? (
                    <div className="flex items-center gap-1 mt-1">
                      <Select value={filialSelectedId} onValueChange={setFilialSelectedId} disabled={loadingFiliais}>
                        <SelectTrigger className="h-7 text-xs flex-1">
                          {loadingFiliais ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {filiais.map((f) => (
                            <SelectItem key={f.id} value={String(f.id)}>{f.uf} - {f.cnpj}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveFilial} disabled={savingFilial || loadingFiliais} title="Salvar">
                        {savingFilial ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-emerald-600" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingFilial(false)} disabled={savingFilial} title="Cancelar">
                        <X className="h-3.5 w-3.5 text-slate-400" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium">{localPedidoData?.filialUf ? `UF: ${localPedidoData.filialUf}` : "—"}</p>
                      <Can roles={["MASTER", "ADMINISTRADOR", "FINANCEIRO"]}>
                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={handleOpenEditFilial} title="Alterar filial">
                          <Pencil className="h-3 w-3 text-slate-400" />
                        </Button>
                      </Can>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="pedido" className="mt-2 flex-1 flex flex-col min-h-0 space-y-2">
          <TabsList className="inline-flex w-full overflow-x-auto flex-nowrap justify-start gap-1 rounded-md border border-slate-200 bg-white p-0.5 flex-shrink-0">
            <TabsTrigger
              value="pedido"
              className="rounded-md px-3 py-1 text-[12px] font-medium text-slate-600 data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap flex-shrink-0"
            >
              Dados
            </TabsTrigger>
            <TabsTrigger
              value="documentos"
              className="rounded-md px-3 py-1 text-[12px] font-medium text-slate-600 data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap flex-shrink-0"
            >
              Documentos
            </TabsTrigger>
            <TabsTrigger
              value="visitas"
              className="rounded-md px-3 py-1 text-[12px] font-medium text-slate-600 data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap flex-shrink-0"
            >
              Visitas
            </TabsTrigger>
            <TabsTrigger
              value="financeiro"
              className="rounded-md px-3 py-1 text-[12px] font-medium text-slate-600 data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap flex-shrink-0"
            >
              Financeiro
            </TabsTrigger>
            <TabsTrigger
              value="nfe"
              className="rounded-md px-3 py-1 text-[12px] font-medium text-slate-600 data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap flex-shrink-0"
            >
              NFS-e
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pedido" className="space-y-3 flex-1 overflow-y-auto min-h-0 pr-1">
            {loadingPedido ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                <Loader2 className="h-5 w-5 animate-spin" />
                Carregando dados do pedido...
              </div>
            ) : pedidoError ? (
              <div className="flex flex-col items-center justify-center gap-3 py-8">
                <p className="text-sm text-destructive">{pedidoError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => localPedidoData?.id && fetchPedidoData(localPedidoData.id)}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : localPedidoData?.status === "RECARREGANDO" ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Recarregando dados do pedido...
              </div>
            ) : localPedidoData ? (
              <EditarPedidoForm
                open={open}
                pedidoId={localPedidoData.id}
                orcamentoId={localPedidoData.orcamentoId ?? null}
                status={localPedidoData.status}
                clienteNome={localClienteNome}
                bancoEmissorId={localPedidoData.bancoEmissorId ?? null}
                legacyBanco={localPedidoData.legacyBanco ?? null}
                isOs={localPedidoData.tipoEspecial === "OS"}
                observacoes={localPedidoData.observacoes ?? null}
                detalhamento={localPedidoData.detalhamento ?? null}
                itens={(localPedidoData.itens ?? []).map((it) => ({
                  itemId: it.itemId,
                  nome: it.nome,
                  quantidade: it.quantidade,
                  valorUnitario: it.valorUnitario,
                }))}
                parcelas={localPedidoData.parcelas ?? null}
                primeiroVencimento={localPedidoData.primeiroVencimento ?? null}
                medicaoOhmica={localPedidoData.medicaoOhmica ?? null}
                medicaoOhmicaMulti={localPedidoData.medicaoOhmicaMulti ?? null}
                onSuccess={handleFormSuccess}
              />
            ) : (
              <div className="text-sm text-muted-foreground">Selecione um pedido.</div>
            )}
          </TabsContent>

          <TabsContent value="documentos" className="space-y-3 flex-1 overflow-y-auto min-h-0 pr-1">
            <div className="flex justify-end gap-2">
              {/* Carta de Endosso (Dinâmica) - Apenas EBR (ID 1) */}
              {localPedidoData?.empresaId === 1 && (
                <Can roles={["MASTER", "ADMINISTRADOR", "FINANCEIRO", "VENDEDOR", "SUPERVISOR"]}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs"
                    onClick={() => window.open(`/api/pedidos/${localPedidoData?.id}/documentos/endosso`, "_blank")}
                    title="Baixar Carta de Endosso"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    Endosso
                  </Button>
                </Can>
              )}
              <Can roles={["MASTER", "ADMINISTRADOR", "SUPERVISOR", "FINANCEIRO"]}>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs"
                  onClick={() =>
                    localPedidoData?.id &&
                    window.open(`/api/pedidos/${localPedidoData.id}/documentos/relatorio-vistoria/imprimir`, "_blank")
                  }
                  title="Imprimir Checklist do Pedido"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Imprimir
                </Button>
              </Can>
              <Button
                variant="outline"
                size="sm"
                onClick={() => localPedidoData?.id && window.open(`/api/pedidos/${localPedidoData.id}/laudo-tecnico`, '_blank')}
                className="gap-2 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                <FileText className="h-3.5 w-3.5" />
                Gerar Laudo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => localPedidoData?.id && window.open(`/api/pedidos/${localPedidoData.id}/recibo`, '_blank')}
                className="gap-2 text-xs"
              >
                <FileDown className="h-3.5 w-3.5" />
                Gerar Recibo
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => setSendDocsDialogOpen(true)}
                className="gap-2 text-xs bg-emerald-600 hover:bg-emerald-700"
              >
                <Send className="h-3.5 w-3.5" />
                Enviar Documentos
              </Button>
            </div>
            {pedidoDocsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando documentos...
              </div>
            ) : pedidoDocsError ? (
              <div className="flex items-center justify-between rounded-lg border border-border bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <span>{pedidoDocsError}</span>
                <Button variant="outline" size="sm" onClick={() => localPedidoData && fetchPedidoDocumentos(localPedidoData.id)}>
                  Tentar novamente
                </Button>
              </div>
            ) : pedidoDocs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum documento operacional para este pedido.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[40%]">Documento</TableHead>
                      <TableHead className="w-[20%]">Status</TableHead>
                      <TableHead className="w-[20%]">Assinaturas</TableHead>
                      <TableHead className="w-[20%] text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pedidoDocs.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <span className="font-semibold text-sm">
                              {doc.tipo === "CARTA_ENDOSSO"
                                ? "Carta de Endosso"
                                : doc.tipo === "LAUDO_TECNICO"
                                  ? "Laudo Técnico"
                                  : doc.tipo === "TERMO_CONCLUSAO"
                                    ? "Termo de Conclusão"
                                    : doc.tipo === "RELATORIO_VISTORIA"
                                      ? "Relatório de Vistoria"
                                      : doc.tipo}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              doc.status === "COMPLETO"
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-amber-500 bg-amber-50 text-amber-700"
                            )}
                          >
                            {doc.status === "COMPLETO" ? "Concluído" : "Pendente"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {doc.assinaturas.length > 0 ? doc.assinaturas.length : ""}
                        </TableCell>
                        <TableCell className="text-right">
                          {doc.url ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleDownloadDocumento(doc.id)}
                              disabled={downloadLoadingId === doc.id}
                              className="text-xs bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                            >
                              {downloadLoadingId === doc.id ? (
                                <span className="flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" /> Gerando link...
                                </span>
                              ) : (
                                "Baixar"
                              )}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem arquivo</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="visitas" className="space-y-3 flex-1 overflow-y-auto min-h-0 pr-1">
            {pedidoVisitasLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando visitas...
              </div>
            ) : pedidoVisitasError ? (
              <div className="flex items-center justify-between rounded-lg border border-border bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <span>{pedidoVisitasError}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => localPedidoData && fetchPedidoVisitas(localPedidoData.id)}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : pedidoVisitas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhuma visita associada a este pedido.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-sm">
                <Table className="border-separate border-spacing-0 text-foreground min-w-[700px] text-[11px] sm:text-[13px]">
                  <TableHeader className="bg-slate-50 text-foreground">
                    <TableRow>
                      <TableHead className="w-[15%] border-b border-border">Visita</TableHead>
                      <TableHead className="w-[13%] border-b border-border">Status</TableHead>
                      <TableHead className="w-[17%] border-b border-border">Técnico</TableHead>
                      <TableHead className="w-[13%] border-b border-border">Data marcada</TableHead>
                      <TableHead className="w-[13%] border-b border-border">Início</TableHead>
                      <TableHead className="w-[13%] border-b border-border">Fim</TableHead>
                      <TableHead className="w-[8%] border-b border-border text-center">Anexos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pedidoVisitas.map((visita) => (
                      <TableRow key={visita.id} className="divide-x divide-border">
                        <TableCell className="border-b border-border">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <span className="font-semibold text-sm">Visita #{visita.id}</span>
                          </div>
                        </TableCell>
                        <TableCell className="border-b border-border">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              visita.status === "FINALIZADO"
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : visita.status === "EM_EXECUCAO"
                                  ? "border-amber-500 bg-amber-50 text-amber-700"
                                  : visita.status === "CANCELADO"
                                    ? "border-red-400 bg-red-50 text-red-700"
                                    : "border-slate-300 bg-slate-50 text-slate-700"
                            )}
                          >
                            {visita.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-foreground border-b border-border">
                          {visita.tecnicoNome || "Técnico não informado"}
                        </TableCell>
                        <TableCell className="text-xs text-foreground border-b border-border">
                          {new Date(visita.dataMarcada).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                        </TableCell>
                        <TableCell className="text-xs text-foreground border-b border-border">
                          {visita.dataRegistroInicio ? new Date(visita.dataRegistroInicio).toLocaleString("pt-BR") : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-foreground border-b border-border">
                          {visita.dataRegistroFim ? new Date(visita.dataRegistroFim).toLocaleString("pt-BR") : "—"}
                        </TableCell>
                        <TableCell className="border-b border-border text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => openAnexosDialog(visita.id)}
                          >
                            <ImageIcon className="h-4 w-4 text-blue-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="financeiro" className="space-y-3 flex-1 overflow-y-auto min-h-0 pr-1">
            {pedidoDebitosLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando débitos...
              </div>
            ) : pedidoDebitosError ? (
              <div className="flex items-center justify-between rounded-lg border border-border bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <span>{pedidoDebitosError}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => localPedidoData && fetchPedidoDebitos(localPedidoData.id)}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-md border border-border">
                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/60 bg-muted/30">
                    <h3 className="text-[12px] font-semibold text-foreground flex items-center gap-1.5">
                      Débitos do Pedido
                    </h3>
                    <span className="text-[11px] text-muted-foreground">
                      {pedidoDebitos.length} {pedidoDebitos.length === 1 ? "registro" : "registros"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-2 py-2">
                    <span className="text-[11px] text-muted-foreground">
                      Ações financeiras disponíveis para o pedido
                    </span>
                    <Can roles={[...FINANCEIRO_ACTION_ROLES]}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[12px]"
                          onClick={() => {
                            setCreateDebitoForm({
                              vencimento: toDateInputValue(new Date()),
                              valor: "",
                            })
                            setCreateDebitoOpen(true)
                          }}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Criar débito
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[12px]"
                          onClick={handleDownloadBoletosPedido}
                          disabled={baixandoBoletosPedido || pedidoDebitos.length === 0}
                        >
                          {baixandoBoletosPedido ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          ) : (
                            <FileDown className="h-3.5 w-3.5 mr-1" />
                          )}
                          Gerar todos boletos
                        </Button>
                      </div>
                    </Can>
                  </div>
                  <div className="overflow-x-auto">
                    {pedidoDebitos.length === 0 ? (
                      <div className="py-6 text-center text-muted-foreground text-[13px]">Nenhum débito encontrado para este pedido.</div>
                    ) : (
                      <table className="w-full text-[11px] sm:text-[13px] min-w-[550px]">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="border border-border px-2 py-1.5 text-left font-semibold text-foreground">ID</th>
                            <th className="border border-border px-2 py-1.5 text-left font-semibold text-foreground">Vencimento</th>
                            <th className="border border-border px-2 py-1.5 text-left font-semibold text-foreground">Valor</th>
                            <th className="border border-border px-2 py-1.5 text-left font-semibold text-foreground">Status</th>
                            <th className="border border-border px-2 py-1.5 text-left font-semibold text-foreground">Boleto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pedidoDebitos.map((debito) => {
                            // Lógica igual ao legado:
                            // - status = 2: Recebido
                            // - status = -1: Cancelado
                            // - status = 0 E vencimento < hoje: Vencido
                            // - status = 0 E vencimento >= hoje: A Receber
                            // Comparação de datas: extrair apenas a parte da data (YYYY-MM-DD) para comparar dias
                            const hojeStr = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })
                            const vencimentoStr = debito.vencimento
                              ? new Date(debito.vencimento).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })
                              : null
                            const isRecebido = debito.status === 2
                            const isCancelado = debito.status === -1
                            const isVencido = debito.status === 0 && vencimentoStr && vencimentoStr < hojeStr

                            const statusLabel = isRecebido
                              ? "Recebido"
                              : isCancelado
                                ? "Cancelado"
                                : isVencido
                                  ? "Vencido"
                                  : "A receber"
                            const statusClass = isRecebido
                              ? "bg-green-600 text-white"
                              : isCancelado
                                ? "bg-gray-500 text-white"
                                : isVencido
                                  ? "bg-red-600 text-white"
                                  : "bg-yellow-600 text-white"

                            return (
                              <tr key={debito.id} className="hover:bg-muted/30">
                                <td className="border border-border px-2 py-1.5 font-medium">#{debito.id}</td>
                                <td className="border border-border px-2 py-1.5">
                                  {debito.vencimento ? formatDate(debito.vencimento) : "Sem data"}
                                </td>
                                <td className="border border-border px-2 py-1.5 text-left font-medium">
                                  {formatCurrency(debito.valor)}
                                </td>
                                <td className="border border-border px-2 py-1.5">
                                  <Badge
                                    className={cn(
                                      "text-[11px] font-medium px-1.5 py-0.5",
                                      statusClass,
                                    )}
                                  >
                                    {statusLabel}
                                  </Badge>
                                </td>
                                <td className="border border-border px-2 py-1.5 ">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-6 px-3 py-3.4 text-[13px]"
                                      onClick={() => handleDownloadBoleto(debito)}
                                      disabled={isRecebido || isCancelado || !debito.bancoEmissorId || baixandoBoletoId === debito.id}
                                      title={
                                        isRecebido
                                          ? "Boleto já consta como recebido"
                                          : isCancelado
                                            ? "Boleto cancelado"
                                            : !debito.bancoEmissorId
                                              ? "Banco emissor não definido no pedido"
                                              : "Baixar boleto"
                                      }
                                    >
                                      {baixandoBoletoId === debito.id ? "..." : "Download boleto"}
                                    </Button>
                                    <Can roles={[...FINANCEIRO_ACTION_ROLES]}>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 px-2 text-[12px]"
                                        onClick={() => handleOpenBaixaManual(debito)}
                                        disabled={isRecebido || isCancelado}
                                        title={isRecebido ? "Já recebido" : isCancelado ? "Cancelado" : "Dar baixa"}
                                      >
                                        <CheckCircle2 className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 px-2 text-[12px] text-red-600 hover:text-red-700"
                                        onClick={() => handleDeleteDebito(debito)}
                                        disabled={isRecebido || isCancelado}
                                        title={isRecebido ? "Já recebido" : isCancelado ? "Cancelado" : "Cancelar débito"}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </Can>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <div className="rounded-md border border-border bg-secondary/40 p-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">A receber</p>
                    <p className="text-lg font-bold text-foreground">{formatCurrency(totalAReceber)}</p>
                  </div>
                  <div className="rounded-md border border-border bg-secondary/40 p-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Recebido</p>
                    <p className="text-lg font-bold text-foreground">{formatCurrency(totalRecebido)}</p>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
          <TabsContent value="nfe" className="space-y-3 flex-1 overflow-y-auto min-h-0 pr-1">
            <div className="flex justify-end mb-2">
              <Button
                size="sm"
                variant="default"
                className="gap-2 text-xs"
                onClick={() => setNfeDialogOpen(true)}
              >
                <Receipt className="h-4 w-4" />
                Emitir NFS-e
              </Button>
            </div>

            <div className="rounded-md border border-slate-200 overflow-x-auto">
              <Table className="min-w-[450px] text-[11px] sm:text-[13px]">
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-[11px] sm:text-[13px]">Número</TableHead>
                    <TableHead className="text-[11px] sm:text-[13px]">Status</TableHead>
                    <TableHead className="text-right text-[11px] sm:text-[13px]">Valor</TableHead>
                    <TableHead className="text-right text-[11px] sm:text-[13px]">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nfesLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                        <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando notas...
                      </TableCell>
                    </TableRow>
                  ) : nfes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                        Nenhuma nota fiscal emitida.
                      </TableCell>
                    </TableRow>
                  ) : (
                    nfes.map((nf: any) => (
                      <TableRow key={nf.id}>
                        <TableCell className="font-mono font-medium">{nf.number || '-'}</TableCell>
                        <TableCell>
                          <NfeStatusBadge status={nf.status} />
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((nf.amountInCents || 0) / 100)}
                        </TableCell>
                        <TableCell className="text-right">
                          <NfeActions
                            nfeId={nf.id}
                            status={nf.status}
                            onSuccess={() => localPedidoData?.id && fetchNfes(localPedidoData.id)}
                            size="icon"
                            variant="ghost"
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between items-center pt-2 overflow-x-auto flex-nowrap gap-4 flex-shrink-0 border-t border-slate-100 mt-2">
          <div className="flex items-center gap-2 flex-nowrap flex-shrink-0">


            {localPedidoData?.geradoART === null && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] text-slate-600 hover:bg-slate-50 hover:text-slate-700 whitespace-nowrap flex-shrink-0"
                onClick={handleRequestArt}
                disabled={artRequestLoading}
              >
                {artRequestLoading ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <FileText className="h-3 w-3 mr-1" />
                )}
                Marcar para ART
              </Button>
            )}
            {localPedidoData?.geradoART === false && (
              <span className="flex items-center gap-1 text-[11px] text-slate-500">
                <Clock className="h-3 w-3" />
                * aguardando criação ART
              </span>
            )}
            {localPedidoData?.geradoART === true && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-600">
                <Check className="h-3 w-3" />
                * ART solicitada
              </span>
            )}
            {/* Botão de Aprovação Precoce - Só visível para MASTER e ADMINISTRADOR */}
            <Can roles={[...ROLES_ALLOWED_FOR_EARLY_APPROVAL]}>
              {localPedidoData?.status &&
                ALLOWED_STATUSES_FOR_EARLY_APPROVAL.includes(
                  localPedidoData.status.toUpperCase() as typeof ALLOWED_STATUSES_FOR_EARLY_APPROVAL[number]
                ) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-amber-600 hover:bg-amber-50 hover:text-amber-700 whitespace-nowrap flex-shrink-0"
                    onClick={() => setEarlyApprovalOpen(true)}
                  >
                    <FastForward className="h-3 w-3 mr-1" />
                    Aprov. Precoce
                  </Button>
                )}
            </Can>

            <Can roles={[...FINANCEIRO_ACTION_ROLES]}>
              {localPedidoData?.id && pedidoDebitos.length === 0 && localPedidoData?.status?.toUpperCase() !== "CANCELADO" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700 whitespace-nowrap flex-shrink-0"
                  onClick={handleEnsureDebitos}
                  disabled={ensureDebitosLoading}
                >
                  {ensureDebitosLoading ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  Gerar Débitos (Fin.)
                </Button>
              )}
            </Can>
            <Can roles={[...FINANCEIRO_ACTION_ROLES]}>
              {localPedidoData?.status?.toUpperCase() !== "CANCELADO" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 whitespace-nowrap flex-shrink-0"
                  onClick={handleCancelarPedido}
                  disabled={cancelandoPedido}
                >
                  {cancelandoPedido ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3 mr-1" />
                  )}
                  Cancelar pedido
                </Button>
              )}
            </Can>
          </div>
          <div className="flex-1" />
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Fechar
          </Button>
        </div>

        {/* Dialog de Aprovação Precoce */}
        {localPedidoData?.id && (
          <EarlyApprovalDialog
            pedidoId={localPedidoData.id}
            open={earlyApprovalOpen}
            onOpenChange={setEarlyApprovalOpen}
            onSuccess={handleFormSuccess}
          />
        )}
        <Dialog open={createDebitoOpen} onOpenChange={(open) => !createDebitoLoading && setCreateDebitoOpen(open)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar débito</DialogTitle>
              <DialogDescription>Informe vencimento e valor para gerar um novo débito.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="debito-vencimento">Vencimento</Label>
                <Input
                  id="debito-vencimento"
                  type="date"
                  value={createDebitoForm.vencimento}
                  onChange={(e) => setCreateDebitoForm((prev) => ({ ...prev, vencimento: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="debito-valor">Valor</Label>
                <Input
                  id="debito-valor"
                  inputMode="decimal"
                  value={createDebitoForm.valor}
                  onChange={(e) => setCreateDebitoForm((prev) => ({ ...prev, valor: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setCreateDebitoOpen(false)} disabled={createDebitoLoading}>
                Cancelar
              </Button>
              <Button onClick={handleCreateDebito} disabled={createDebitoLoading}>
                {createDebitoLoading ? "Salvando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={baixaManualOpen} onOpenChange={(open) => !savingBaixa && setBaixaManualOpen(open)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Baixa manual</DialogTitle>
              <DialogDescription>Registre o recebimento do débito selecionado.</DialogDescription>
            </DialogHeader>
            {baixaManualTarget && (
              <div className="space-y-3">
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Débito <span className="font-semibold text-foreground">#{baixaManualTarget.id}</span> ·{" "}
                  {formatCurrency(baixaManualTarget.valor)}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="baixa-data">Data ocorrência</Label>
                  <Input
                    id="baixa-data"
                    type="date"
                    value={baixaManualForm.dataOcorrencia}
                    onChange={(e) => setBaixaManualForm((prev) => ({ ...prev, dataOcorrencia: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="baixa-valor">Valor recebido</Label>
                  <Input
                    id="baixa-valor"
                    inputMode="decimal"
                    value={baixaManualForm.valorRecebido}
                    onChange={(e) => setBaixaManualForm((prev) => ({ ...prev, valorRecebido: e.target.value }))}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="baixa-acrescimos">Acréscimos</Label>
                    <Input
                      id="baixa-acrescimos"
                      inputMode="decimal"
                      value={baixaManualForm.acrescimos}
                      onChange={(e) => setBaixaManualForm((prev) => ({ ...prev, acrescimos: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="baixa-descontos">Descontos</Label>
                    <Input
                      id="baixa-descontos"
                      inputMode="decimal"
                      value={baixaManualForm.descontos}
                      onChange={(e) => setBaixaManualForm((prev) => ({ ...prev, descontos: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setBaixaManualOpen(false)} disabled={savingBaixa}>
                Cancelar
              </Button>
              <Button onClick={handleSubmitBaixaManual} disabled={savingBaixa}>
                {savingBaixa ? "Salvando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>

      {/* Dialog de Anexos da Visita */}
      <Dialog open={anexosDialogVisitaId !== null} onOpenChange={(open) => !open && setAnexosDialogVisitaId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Anexos da Visita #{anexosDialogVisitaId}</DialogTitle>
            <DialogDescription>Fotos e documentos associados a esta visita técnica.</DialogDescription>
          </DialogHeader>
          {loadingAnexos ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : visitaAnexos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum anexo nesta visita.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {visitaAnexos.map((anx) => (
                <button
                  key={anx.id}
                  type="button"
                  onClick={() => setPreviewAnexoUrl(anx.url)}
                  className="h-20 w-20 rounded-lg border bg-slate-50 overflow-hidden hover:ring-2 ring-blue-500"
                >
                  <img src={anx.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview de Anexo */}
      <Dialog open={previewAnexoUrl !== null} onOpenChange={(open) => !open && setPreviewAnexoUrl(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">Imagem</DialogTitle>
          {previewAnexoUrl && <img src={previewAnexoUrl} alt="" className="w-full h-auto rounded-lg" />}
        </DialogContent>
      </Dialog>

      {/* Mapa de Status */}
      <PedidoStatusMapDialog
        open={statusMapOpen}
        onOpenChange={setStatusMapOpen}
        currentStatus={localPedidoData?.status ?? null}
      />

      <TrocarVendedorDialog
        open={trocarVendedorOpen}
        onClose={() => setTrocarVendedorOpen(false)}
        pedidoId={localPedidoData?.id ?? 0}
        currentVendedorId={null}
        currentVendedorName={localPedidoData?.vendedor}
        onSuccess={async () => {
          if (localPedidoData?.id) await fetchPedidoData(localPedidoData.id)
        }}
      />

      {localPedidoData?.id && (
        <NfeEmissionDialog
          pedidoId={localPedidoData.id}
          open={nfeDialogOpen}
          onOpenChange={setNfeDialogOpen}
          onSuccess={() => {
            localPedidoData.id && fetchNfes(localPedidoData.id)
          }}
        />
      )}

      {sendDocsDialogOpen && localPedidoData && (
        <SendDocumentsDialog
          open={sendDocsDialogOpen}
          onOpenChange={setSendDocsDialogOpen}
          pedidoId={localPedidoData.id}
          clientData={localPedidoData.cliente}
          documentosOperacionais={pedidoDocs}
          boletos={pedidoDebitos}
          nfes={nfes}
        />
      )}
    </Dialog >
  )
}

