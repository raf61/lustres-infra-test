"use client"

import { useCallback, useEffect, useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { useChatLauncher } from "@/components/chat/chat-launcher"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { Cliente } from "@/lib/client-types"
import {
  Building2,
  User,
  Phone,
  Mail,
  Calendar,
  Briefcase,
  FileText,
  History,
  DollarSign,
  Bot,
  Send,
  MessageSquare,
  Zap,
  ShieldCheck,
  Pencil,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileCheck2,
  X,
  Trash2,
  Eye,
  Ban,
  MoreHorizontal,
} from "lucide-react"
import { EnviarDocumentoDialog } from "./enviar-documento-dialog"
import { CriarOrcamentoDialog } from "@/components/orcamentos/criar-orcamento-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EditarOrcamentoDialog } from "@/components/orcamentos/editar-orcamento-dialog"
import { PedidoDetailsDialog, type PedidoHistoricoItem } from "@/components/leads/pedido-details-dialog"
import { PedidoStatusMapDialog } from "@/components/pedidos/pedido-status-map-dialog"
import { AdministradoraGerentesManager } from "@/components/administradoras/administradora-gerentes-manager"
import { ContratoManagerTab } from "@/components/contratos/contrato-manager-tab"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  maskCEP,
  maskCNPJ,
  maskPhone,
  unmask,
  formatCNPJ,
  formatCEP,
  formatPhone,
  validateCNPJ,
  validateCEP,
  formatRazaoSocial,
  formatLocalDate,
  parseLocalDate,
} from "@/lib/formatters"
import { toDateInputValue, toDateTimeInputValue } from "@/lib/date-utils"
import { ESPECIFICACAO_CONDOMINIO_OPTIONS, getEspecificacaoCondominioLabel } from "@/lib/constants/especificacao-condominio"

// Re-export para uso local
const toDateOnlyString = toDateInputValue
const toDateTimeString = toDateTimeInputValue

const calculateDurationInMonths = (start: string | Date, end: string | Date) => {
  const startDate = parseLocalDate(start)
  const endDate = parseLocalDate(end)
  const years = endDate.getFullYear() - startDate.getFullYear()
  const months = endDate.getMonth() - startDate.getMonth()
  const total = years * 12 + months
  return total > 0 ? total : 0
}

interface ClienteDetailDialogProps {
  clienteId: string | number
  open: boolean
  onClose: () => void
  apiBasePath?: string
  onClientReturned?: (clientId: number) => void
  onOrcamentoCreated?: () => void
  onClientUpdated?: () => void
  onStatusUpdated?: (clientId: number, newCode: number) => void
  onClientDeleted?: (clientId: number) => void
  onPedidoCriado?: (clientId: number) => void
  initialTab?: "info" | "orcamentos" | "pedidos" | "historico" | "financeiro"
  isChat?: boolean
}


type RawClientDetail = {
  id: number
  cnpj: string
  razaoSocial: string
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  telefoneCondominio: string | null
  celularCondominio: string | null
  nomeSindico: string | null
  telefoneSindico: string | null
  dataAniversarioSindico: string | null
  dataInicioMandato: string | null
  dataFimMandato: string | null
  emailSindico: string | null
  nomePorteiro: string | null
  telefonePorteiro: string | null
  quantidadeSPDA: number | null
  quantidadeAndares: number | null
  especificacaoCondominio: "COMERCIAL" | "RESIDENCIAL" | "MISTO" | null
  administradoraStringAntigo: string | null
  observacao: string | null
  ultimaManutencao: string | null
  ultimoPedido: string | null
  dataContatoAgendado: string | null
  categoria?: "explorado" | "ativo" | "agendado"
  administradora: {
    id: number
    nome: string
  } | null
  vendedor: {
    id: string
    name: string | null
    role: string | null
  } | null
  kanbanCode: number | null
  visivelDashVendedor?: boolean
  isContratoVigente?: boolean
}

type HistoryItem = {
  id: number
  status?: string | null
  tipo?: string | null
  observacoes?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

type HistoricoItemProduto = {
  itemId?: number
  nome: string
  quantidade: number
  valorUnitario: number
  subtotal: number
}

// PedidoHistoricoItem is now imported from pedido-details-dialog.tsx

type OrcamentoHistoricoItem = HistoryItem & {
  vendedor?: string | null
  empresa?: string | null
  empresaId?: number | null
  filialUf?: string | null
  total?: number | null
  parcelas?: number | null
  primeiroVencimento?: string | null
  itens: HistoricoItemProduto[]
}

type RawHistory = {
  pedidos: PedidoHistoricoItem[]
  orcamentos: OrcamentoHistoricoItem[]
}

type DebitoItem = {
  id: number
  valor: number
  status: number
  vencimento: string | null
  bancoEmissorId?: number | null
}

type BancoOption = {
  id: number
  nome: string
}

type ItemOption = {
  id: string
  nome: string
  valor: number
  categoria: string | null
}

// DocumentoOperacional type moved to pedido-details-dialog.tsx

type ClientRegistroItem = {
  id: number
  clientId: number
  mensagem: string
  userId: string
  userName: string
  createdAt: string
  updatedAt: string
}

const mapToCliente = (client: RawClientDetail): Cliente => {
  const endereco = [client.logradouro ?? "", client.numero ?? "", client.complemento ?? ""]
    .filter((part) => part.trim().length > 0)
    .join(", ")

  const vendedorRole = client.vendedor?.role ?? null
  const vendedorNome = client.vendedor?.name ?? ""
  const isChatbotResponsavel = vendedorRole === "CHATBOT"

  const responsavelNome = isChatbotResponsavel ? "Chatbot" : vendedorNome
  const tipoResponsavel: "vendedor" | "chatbot" = isChatbotResponsavel
    ? "chatbot"
    : vendedorNome
      ? "vendedor"
      : "chatbot"

  return {
    id: client.id.toString(),
    cnpj: client.cnpj,
    razaoSocial: client.razaoSocial,
    nomeCondominio: client.razaoSocial,
    cep: client.cep ?? "",
    logradouro: client.logradouro ?? "",
    numero: client.numero ?? "",
    complemento: client.complemento ?? "",
    bairro: client.bairro ?? "",
    cidade: client.cidade ?? "",
    estado: client.estado ?? "",
    telefoneCondominio: client.telefoneCondominio ?? "",
    celularCondominio: client.celularCondominio ?? "",
    nomeSindico: client.nomeSindico ?? null,
    endereco,
    sindico: {
      nome: client.nomeSindico ?? "",
      telefone: client.telefoneSindico ?? "",
      whatsapp: client.telefoneSindico ?? "",
      email: client.emailSindico ?? "",
      aniversario: toDateOnlyString(client.dataAniversarioSindico),
      dataInicioMandato: toDateOnlyString(client.dataInicioMandato),
      dataFimMandato: toDateOnlyString(client.dataFimMandato),
    },
    porteiro: client.nomePorteiro
      ? {
        nome: client.nomePorteiro,
        telefone: client.telefonePorteiro ?? "",
      }
      : undefined,
    administradora: {
      id: client.administradora?.id != null ? String(client.administradora.id) : "",
      nome:
        client.administradora?.nome ??
        client.administradoraStringAntigo ??
        "Não informado",
      email: "",
      telefone: "",
      gerentes: [],
    },
    administradoraStringAntigo: client.administradoraStringAntigo ?? undefined,
    qtdSPDA: client.quantidadeSPDA ?? undefined,
    qtdAndares: client.quantidadeAndares ?? undefined,
    especificacaoCondominio: client.especificacaoCondominio ?? null,
    categoria: client.categoria ?? "explorado",
    responsavel: responsavelNome,
    tipoResponsavel,
    motivoAgendamento: undefined,
    historicoContatos: [],
    vendedor: vendedorNome || undefined,
    ultimaManutencao: toDateOnlyString(client.ultimaManutencao) || undefined,
    ultimoPedido: client.ultimoPedido ?? undefined,
    observacao: client.observacao ?? undefined,
    proximaManutencao: undefined,
    // dataAgendamento mantém formato datetime para o input datetime-local
    dataAgendamento: toDateTimeString(client.dataContatoAgendado) || undefined,
    status: "ativo",
    kanbanCode: client.kanbanCode ?? undefined,
    visivelDashVendedor: client.visivelDashVendedor,
    vendedorId: client.vendedor?.id ?? undefined,
    isContratoVigente: client.isContratoVigente,
  }
}

const KANBAN_STAGES = [
  { code: 0, title: "A fazer contato", dotColor: "bg-slate-400" },
  { code: 1, title: "Contato feito", dotColor: "bg-blue-500" },
  { code: 2, title: "Follow-up 1", dotColor: "bg-amber-500" },
  { code: 3, title: "Follow-up 2", dotColor: "bg-orange-500" },
  { code: 4, title: "Ignorado", dotColor: "bg-purple-500" },
]

export function ClienteDetailDialog({
  clienteId,
  open,
  onClose,
  apiBasePath = "/api/clients",
  isChat = false,
  onClientReturned,
  onOrcamentoCreated,
  onClientUpdated,
  onPedidoCriado,
  initialTab = "info",
}: ClienteDetailDialogProps) {
  const normalizedApiBasePath = apiBasePath.replace(/\/$/, "")
  const { data: session } = useSession()
  const { toast } = useToast()
  const { openChatWithClient } = useChatLauncher()

  const isMasterOrAdmin =
    session?.user?.role === "MASTER" ||
    session?.user?.role === "ADMINISTRADOR"
  const canToggleVisibility = isMasterOrAdmin
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>(initialTab)
  const [returnConfirmOpen, setReturnConfirmOpen] = useState(false)
  const [returning, setReturning] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [history, setHistory] = useState<RawHistory | null>(null)
  const [debitos, setDebitos] = useState<DebitoItem[]>([])
  const [loadingDebitos, setLoadingDebitos] = useState(true)
  const [debitosError, setDebitosError] = useState<string | null>(null)
  const [expandedOrcamentos, setExpandedOrcamentos] = useState<Record<number, boolean>>({})
  const [enviarDocumentoOpen, setEnviarDocumentoOpen] = useState(false)
  const [orcamentoDialogOpen, setOrcamentoDialogOpen] = useState(false)
  const [ordemServicoConfirmOpen, setOrdemServicoConfirmOpen] = useState(false)
  const [creatingOrdemServico, setCreatingOrdemServico] = useState(false)
  const [empresasOs, setEmpresasOs] = useState<Array<{ id: number; nome: string }>>([])
  const [empresaOsId, setEmpresaOsId] = useState<number | null>(null)
  const [ordemServicoObservacoes, setOrdemServicoObservacoes] = useState("")
  const [ordemServicoDetalhamento, setOrdemServicoDetalhamento] = useState("")
  const [empresasOsLoading, setEmpresasOsLoading] = useState(false)
  const [empresasOsError, setEmpresasOsError] = useState<string | null>(null)
  const [contratos, setContratos] = useState<any[]>([])
  const [selectedContratoId, setSelectedContratoId] = useState<number | null>(null)
  const [editingData, setEditingData] = useState<Partial<RawClientDetail>>({})
  const [pedidoDialogOpen, setPedidoDialogOpen] = useState(false)
  const [pedidoDialogData, setPedidoDialogData] = useState<PedidoHistoricoItem | null>(null)
  const [baixandoBoletoId, setBaixandoBoletoId] = useState<number | null>(null)
  const [editOrcamentoOpen, setEditOrcamentoOpen] = useState(false)
  const [orcamentoBeingEdited, setOrcamentoBeingEdited] = useState<OrcamentoHistoricoItem | null>(null)
  const [originalData, setOriginalData] = useState<Partial<RawClientDetail>>({})
  const [saving, setSaving] = useState(false)
  const [tirarPedidoLoadingId, setTirarPedidoLoadingId] = useState<number | null>(null)
  const [infoEditMode, setInfoEditMode] = useState(false)
  const infoEditModeRef = useRef(false)
  useEffect(() => { infoEditModeRef.current = infoEditMode }, [infoEditMode])

  // Registros state
  const [registros, setRegistros] = useState<ClientRegistroItem[]>([])
  const [loadingRegistros, setLoadingRegistros] = useState(false)
  const [registrosError, setRegistrosError] = useState<string | null>(null)
  const [newRegistroText, setNewRegistroText] = useState("")
  const [creatingRegistro, setCreatingRegistro] = useState(false)
  const registrosLateralRef = useRef<HTMLDivElement>(null)

  const [activatingVisibility, setActivatingVisibility] = useState(false)
  const [dashVisibility, setDashVisibility] = useState<{ isVisible: boolean; hasVendor: boolean } | null>(null)

  // Status Map state
  const [statusMapOpen, setStatusMapOpen] = useState(false)
  const [statusMapPedido, setStatusMapPedido] = useState<{ id: number; status: string | undefined | null } | null>(null)

  // Perda state
  const [perdaOpen, setPerdaOpen] = useState(false)
  const [perdaLoading, setPerdaLoading] = useState(false)
  const [perdaDataManutencao, setPerdaDataManutencao] = useState("")

  const canShowSalesActions = (isChat || !!apiBasePath) && cliente?.visivelDashVendedor
  const isFreeClient = cliente?.categoria === "agendado" || cliente?.categoria === "explorado"

  const handleUpdateKanbanStage = useCallback(async (code: number) => {
    if (!cliente) return
    try {
      const response = await fetch(`/api/vendedor/kanban/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: Number(cliente.id), code }),
      })

      if (!response.ok) throw new Error("Erro ao atualizar kanban")

      setCliente(prev => prev ? { ...prev, kanbanCode: code } : null)
      toast({ title: "Estágio Kanban atualizado" })
      onClientUpdated?.()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar Kanban",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      })
    }
  }, [cliente, onClientUpdated, toast])

  const handleConfirmPerda = async (withDate: boolean) => {
    if (!cliente) return

    setPerdaLoading(true)
    try {
      const actionType = withDate ? "WITH_DATE" : "WITHOUT_DATE"
      const body: { actionType: string; ultimaManutencao?: string } = { actionType }

      if (withDate && perdaDataManutencao) {
        body.ultimaManutencao = new Date(perdaDataManutencao).toISOString()
      }

      const response = await fetch(`/api/vendedor/clients/${cliente.id}/perda`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Erro ao processar perda")

      toast({
        title: withDate ? "Cliente marcado como perda" : "Cliente removido",
        description: result.message,
        variant: withDate ? "default" : "destructive",
      })

      setPerdaOpen(false)
      onClientUpdated?.()
      onClose()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao processar perda",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      })
    } finally {
      setPerdaLoading(false)
    }
  }





  const hasRecentOpenBudget = useCallback(() => {
    if (!history?.orcamentos?.length) return false
    const limite = new Date()
    limite.setDate(limite.getDate() - 15)
    return history.orcamentos.some((orc) => {
      if (!orc?.createdAt) return false
      const createdAt = new Date(orc.createdAt)
      if (Number.isNaN(createdAt.getTime()) || createdAt < limite) return false
      const status = orc.status?.toUpperCase() ?? ""
      return status !== "APROVADO" && status !== "CANCELADO"
    })
  }, [history])

  const hasRecentOsPedido = useCallback(() => {
    if (!history?.pedidos?.length) return false
    const limite = new Date()
    limite.setDate(limite.getDate() - 15)
    return history.pedidos.some((pedido) => {
      if (pedido.tipoEspecial !== "OS") return false
      if (!pedido.createdAt) return false
      const createdAt = new Date(pedido.createdAt)
      if (Number.isNaN(createdAt.getTime())) return false
      return createdAt >= limite
    })
  }, [history])

  // Scroll to bottom when registros change
  useEffect(() => {
    if (registrosLateralRef.current) {
      registrosLateralRef.current.scrollTop = registrosLateralRef.current.scrollHeight
    }
  }, [registros])

  const loadCliente = useCallback(
    async (signal?: AbortSignal, silent = false) => {
      try {
        if (!silent) {
          setLoading(true)
          setError(null)
          setCliente(null)
        }

        const response = await fetch(`${normalizedApiBasePath}/${clienteId}`, {
          signal,
        })

        if (!response.ok) {
          throw new Error("Erro ao carregar detalhes do cliente")
        }

        const data = (await response.json()) as RawClientDetail

        // Busca status de pesquisa separadamente
        const researchRes = await fetch(`/api/fichas/exists-in-research?cnpj=${data.cnpj}`, { signal }).catch(() => null)
        const researchData = researchRes?.ok ? await researchRes.json().catch(() => ({ exists: false })) : { exists: false }

        const mappedCliente = mapToCliente(data)
        mappedCliente.isInResearch = researchData.exists
        setCliente(mappedCliente)

        // Inicializar dados de edição
        const initialData: Partial<RawClientDetail> = {
          razaoSocial: mappedCliente.razaoSocial,
          cnpj: mappedCliente.cnpj,
          cep: mappedCliente.cep || null,
          logradouro: mappedCliente.logradouro || null,
          numero: mappedCliente.numero || null,
          complemento: mappedCliente.complemento || null,
          bairro: mappedCliente.bairro || null,
          cidade: mappedCliente.cidade || null,
          estado: mappedCliente.estado || null,
          telefoneCondominio: mappedCliente.telefoneCondominio || null,
          celularCondominio: mappedCliente.celularCondominio || null,
          nomeSindico: mappedCliente.sindico.nome || null,
          telefoneSindico: mappedCliente.sindico.telefone || null,
          emailSindico: mappedCliente.sindico.email || null,
          dataAniversarioSindico: mappedCliente.sindico.aniversario || null,
          dataInicioMandato: mappedCliente.sindico.dataInicioMandato || null,
          dataFimMandato: mappedCliente.sindico.dataFimMandato || null,
          nomePorteiro: mappedCliente.porteiro?.nome || null,
          telefonePorteiro: mappedCliente.porteiro?.telefone || null,
          quantidadeSPDA: mappedCliente.qtdSPDA || null,
          quantidadeAndares: mappedCliente.qtdAndares || null,
          especificacaoCondominio: mappedCliente.especificacaoCondominio || null,
          observacao: mappedCliente.observacao || null,
          dataContatoAgendado: mappedCliente.dataAgendamento || null,
          ultimaManutencao: mappedCliente.ultimaManutencao || null,
        }

        setOriginalData(JSON.parse(JSON.stringify(initialData)))

        // IMPORTANTE: Se o usuário estiver editando (infoEditMode) e for um load "silent",
        // PRESERVAMOS o que ele já digitou no editingData.
        if (!infoEditModeRef.current || !silent) {
          setEditingData(initialData)
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        if (!silent) {
          setError(err instanceof Error ? err.message : "Erro desconhecido")
        }
        console.error("Erro ao carregar detalhes do cliente:", err)
      } finally {
        if (!silent) {
          setLoading(false)
        }
      }
    },
    [clienteId, normalizedApiBasePath]
  )

  const loadHistory = useCallback(
    async (signal?: AbortSignal): Promise<RawHistory | null> => {
      try {
        setLoadingHistory(true)
        setHistoryError(null)
        setHistory(null)

        const response = await fetch(`${normalizedApiBasePath}/${clienteId}/history`, {
          signal,
        })

        if (!response.ok) {
          throw new Error("Erro ao carregar histórico")
        }

        const data = (await response.json()) as RawHistory
        setHistory(data)
        return data
      } catch (err) {
        if ((err as Error).name === "AbortError") return null
        setHistoryError(err instanceof Error ? err.message : "Erro desconhecido")
        console.error("Erro ao carregar histórico:", err)
        return null
      } finally {
        setLoadingHistory(false)
      }
    },
    [clienteId, normalizedApiBasePath]
  )

  const loadDebitos = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoadingDebitos(true)
        setDebitosError(null)

        const response = await fetch(`${normalizedApiBasePath}/${clienteId}/debitos`, {
          signal,
        })

        if (!response.ok) {
          throw new Error("Erro ao carregar débitos")
        }

        const data = (await response.json()) as { debitos: DebitoItem[] }
        setDebitos(data.debitos ?? [])
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        setDebitosError(err instanceof Error ? err.message : "Erro desconhecido")
        console.error("Erro ao carregar débitos:", err)
      } finally {
        setLoadingDebitos(false)
      }
    },
    [clienteId]
  )

  const loadContratos = useCallback(async () => {
    try {
      const res = await fetch(`/api/clientes/${clienteId}/contratos`)
      if (res.ok) {
        const data = await res.json()
        setContratos(data.filter((c: any) => c.status === "OK" || c.status === "PENDENTE"))
      }
    } catch (err) {
      console.error("Erro ao carregar contratos:", err)
    }
  }, [clienteId])

  useEffect(() => {
    if (contratos.length > 0 && selectedContratoId === null) {
      const now = new Date()
      const active = contratos.find(c => parseLocalDate(c.dataFim) >= now && c.status === "OK")
      if (active) {
        setSelectedContratoId(active.id)
      }
    }
  }, [contratos, selectedContratoId])

  useEffect(() => {
    if (open && clienteId) {
      loadContratos()
    }
  }, [open, clienteId, loadContratos])

  const loadRegistros = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoadingRegistros(true)
        setRegistrosError(null)

        const response = await fetch(`/api/clients/${clienteId}/registros`, {
          signal,
        })

        if (!response.ok) {
          throw new Error("Erro ao carregar registros")
        }

        const data = await response.json()
        setRegistros(data.data ?? [])
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        setRegistrosError(err instanceof Error ? err.message : "Erro desconhecido")
        console.error("Erro ao carregar registros:", err)
      } finally {
        setLoadingRegistros(false)
      }
    },
    [clienteId]
  )

  const loadVisibility = useCallback(async () => {
    if (!clienteId) return
    try {
      const res = await fetch(`/api/clients/${clienteId}/make-visible`)
      if (res.ok) {
        const data = await res.json()
        setDashVisibility(data)
      }
    } catch (e) {
      console.error("Erro ao carregar visibilidade", e)
    }
  }, [clienteId])

  const handleActivateVisibility = useCallback(async () => {
    if (!clienteId) return
    setActivatingVisibility(true)
    try {
      const res = await fetch(`/api/clients/${clienteId}/make-visible`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erro ao ativar visibilidade")

      toast({ title: "Cliente visível no dashboard!", description: "Histórico atualizado." })
      loadCliente()
      loadVisibility()
      if (onClientUpdated) onClientUpdated()
    } catch (e) {
      toast({ variant: "destructive", title: "Erro", description: e instanceof Error ? e.message : "Erro desconhecido" })
    } finally {
      setActivatingVisibility(false)
    }
  }, [clienteId, toast, loadCliente, loadVisibility, onClientUpdated])

  const renderChatButton = useCallback((phone: string | null | undefined) => {
    if (!phone || !cliente) return null

    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-5 w-5 p-0"
        title="Abrir conversa"
        onClick={(e) => {
          e.stopPropagation()
          openChatWithClient({
            id: Number(cliente.id),
            cnpj: cliente.cnpj,
            razaoSocial: cliente.razaoSocial,
            nomeSindico: cliente.sindico.nome ?? null,
            telefoneSindico: cliente.sindico.telefone ?? null,
            telefoneCondominio: cliente.telefoneCondominio ?? null,
            celularCondominio: cliente.celularCondominio ?? null,
            telefonePorteiro: cliente.porteiro?.telefone ?? null,
          }, { phone, mode: "click" })
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          openChatWithClient({
            id: Number(cliente.id),
            cnpj: cliente.cnpj,
            razaoSocial: cliente.razaoSocial,
            nomeSindico: cliente.sindico.nome ?? null,
            telefoneSindico: cliente.sindico.telefone ?? null,
            telefoneCondominio: cliente.telefoneCondominio ?? null,
            celularCondominio: cliente.celularCondominio ?? null,
            telefonePorteiro: cliente.porteiro?.telefone ?? null,
          }, { phone, mode: "context" })
        }}
      >
        <img src="/icone-zap.png" alt="WhatsApp" className="h-5 w-5" />
      </Button>
    )
  }, [cliente, openChatWithClient])

  const createRegistro = useCallback(async () => {
    if (!newRegistroText.trim()) return

    setCreatingRegistro(true)
    try {
      const response = await fetch(`/api/clients/${clienteId}/registros`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensagem: newRegistroText.trim(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Erro ao criar registro")
      }

      const data = await response.json()
      setRegistros((prev) => [...prev, data.data])
      setNewRegistroText("")
      toast({ title: "Registro criado com sucesso" })
    } catch (err) {
      console.error("Erro ao criar registro:", err)
      toast({
        variant: "destructive",
        title: "Erro ao criar registro",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      })
    } finally {
      setCreatingRegistro(false)
    }
  }, [clienteId, newRegistroText, toast])

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

  const handleTirarPedido = useCallback(
    async (orcamentoId: number) => {
      try {
        setTirarPedidoLoadingId(orcamentoId)

        const response = await fetch(`/api/orcamentos/${orcamentoId}/pedido`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contratoId: selectedContratoId })
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(result.error ?? "Erro ao gerar pedido.")
        }

        toast({
          title: "Pedido criado!",
          description: `Um pedido foi associado ao orçamento #${orcamentoId}.`,
        })

        await Promise.all([
          loadHistory().catch(console.error),
          loadDebitos().catch(console.error),
          loadCliente().catch(console.error),
        ])
        setActiveTab("pedidos")

        // Notifica o componente pai que um pedido foi criado
        const pedidoClienteId = Number(cliente?.id ?? clienteId)
        if (onPedidoCriado && !Number.isNaN(pedidoClienteId)) {
          onPedidoCriado(pedidoClienteId)
        }
      } catch (error) {
        console.error(error)
        toast({
          title: "Erro ao tirar pedido",
          description: error instanceof Error ? error.message : "Erro ao gerar pedido.",
          variant: "destructive",
        })
      } finally {
        setTirarPedidoLoadingId(null)
      }
    },
    [loadCliente, loadHistory, loadDebitos, toast, onPedidoCriado, cliente, selectedContratoId],
  )

  const handleCreateOrdemServico = useCallback(async () => {
    if (!clienteId) return
    if (!empresaOsId) {
      toast({
        title: "Selecione a empresa",
        description: "Escolha a empresa para criar a ordem de serviço.",
        variant: "destructive",
      })
      return
    }
    setCreatingOrdemServico(true)
    try {
      const response = await fetch(`/api/clients/${clienteId}/ordem-servico`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresaId: empresaOsId,
          observacoes: ordemServicoObservacoes.trim() || null,
          detalhamento: ordemServicoDetalhamento.trim() || null,
          contratoId: selectedContratoId,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível criar a ordem de serviço.")
      }
      toast({
        title: "Ordem de serviço criada",
        description: `Pedido #${payload?.data?.pedidoId ?? "--"} criado com sucesso.`,
      })
      setOrdemServicoConfirmOpen(false)
      await loadHistory()
      setActiveTab("pedidos")
      const pedidoClienteId = Number(clienteId)
      if (onPedidoCriado && !Number.isNaN(pedidoClienteId)) {
        onPedidoCriado(pedidoClienteId)
      }
    } catch (err) {
      toast({
        title: "Erro ao criar ordem de serviço",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setCreatingOrdemServico(false)
    }
  }, [clienteId, empresaOsId, loadHistory, onPedidoCriado, ordemServicoObservacoes, ordemServicoDetalhamento, toast, selectedContratoId])

  useEffect(() => {
    if (!ordemServicoConfirmOpen) {
      setEmpresasOs([])
      setEmpresaOsId(null)
      setOrdemServicoObservacoes("")
      setOrdemServicoDetalhamento("")
      setEmpresasOsError(null)
      setEmpresasOsLoading(false)
      return
    }

    const loadEmpresas = async () => {
      if (!clienteId) return
      setEmpresasOsLoading(true)
      setEmpresasOsError(null)
      try {
        const [empRes, lastEmpRes] = await Promise.all([
          fetch("/api/empresas"),
          fetch(`/api/clients/${clienteId}/last-empresa`),
        ])

        const empJson = await empRes.json().catch(() => ({}))
        if (!empRes.ok) {
          throw new Error(empJson?.error || "Erro ao carregar empresas.")
        }
        const lista = Array.isArray(empJson?.data) ? empJson.data : []
        setEmpresasOs(lista)

        let defaultId = lista.some((e: { id: number }) => e.id === 1) ? 1 : lista[0]?.id
        const lastJson = await lastEmpRes.json().catch(() => ({}))
        if (lastEmpRes.ok && typeof lastJson?.empresaId === "number") {
          defaultId = lastJson.empresaId
        }

        setEmpresaOsId(defaultId ?? null)
      } catch (err) {
        setEmpresasOs([])
        setEmpresaOsId(null)
        setEmpresasOsError(err instanceof Error ? err.message : "Não foi possível carregar empresas.")
      } finally {
        setEmpresasOsLoading(false)
      }
    }

    loadEmpresas().catch(console.error)
  }, [clienteId, ordemServicoConfirmOpen])

  useEffect(() => {
    if (!open) {
      setEditingData({})
      setOriginalData({})
      setDebitos([])
      setDebitosError(null)
      setLoadingDebitos(true)
      setRegistros([])
      setRegistrosError(null)
      setNewRegistroText("")
      setSelectedContratoId(null)
      return
    }

    // Reset para a tab inicial quando abrir
    setActiveTab(initialTab)

    const controller = new AbortController()

    Promise.all([
      loadCliente(controller.signal),
      loadHistory(controller.signal),
      loadDebitos(controller.signal),
      loadRegistros(controller.signal),
      loadVisibility(),
    ]).catch((err) => console.error(err))

    return () => {
      controller.abort()
    }
  }, [clienteId, loadCliente, loadHistory, loadDebitos, loadRegistros, open, initialTab, loadVisibility])

  const hasChanges = () => {
    return JSON.stringify(editingData) !== JSON.stringify(originalData)
  }

  const handleSave = async () => {
    if (!cliente) return

    try {
      setSaving(true)

      // Garantir que CEP, CNPJ e telefones sejam enviados sem máscara
      const cepValue = editingData.cep ?? cliente.cep ?? null
      const cnpjValue = editingData.cnpj ?? cliente.cnpj
      const telefoneCondominioValue = editingData.telefoneCondominio ?? cliente.telefoneCondominio ?? null
      const celularCondominioValue = editingData.celularCondominio ?? cliente.celularCondominio ?? null
      const telefoneSindicoValue = editingData.telefoneSindico ?? cliente.sindico.telefone ?? null
      const telefonePorteiroValue = editingData.telefonePorteiro ?? cliente.porteiro?.telefone ?? null

      // Função helper para verificar se campo foi editado e retornar valor correto
      // Permite limpar campos (setar para null) quando o usuário apaga o valor
      const getEditedValue = <T,>(
        field: keyof typeof editingData,
        fallbackValue: T
      ): T | null => {
        // Se o campo foi editado (existe a chave no objeto), usar o valor editado
        // Isso permite que null ou string vazia sejam enviados
        if (Object.prototype.hasOwnProperty.call(editingData, field)) {
          const value = editingData[field]
          // Se é string vazia, converter para null
          if (value === "" || value === undefined) return null
          return value as T
        }
        // Se não foi editado, usar o valor original
        return fallbackValue ?? null
      }

      // dataContatoAgendado usa precisão de horário - envia string direta, backend parsea em -3
      const dataContatoValue = getEditedValue(
        "dataContatoAgendado",
        toDateTimeInputValue(cliente.dataAgendamento)
      )

      // Enviar datas como strings simples - o backend trata o timezone
      // Os valores de cliente.sindico.* já estão formatados (YYYY-MM-DD ou YYYY-MM-DDTHH:mm)
      const payload: any = {
        razaoSocial: editingData.razaoSocial ?? cliente.razaoSocial,
        cnpj: cnpjValue ? unmask(cnpjValue.toString()) : cnpjValue,
        cep: cepValue ? unmask(cepValue.toString()) : null,
        logradouro: editingData.logradouro ?? cliente.logradouro ?? null,
        numero: editingData.numero ?? cliente.numero ?? null,
        complemento: editingData.complemento ?? cliente.complemento ?? null,
        bairro: editingData.bairro ?? cliente.bairro ?? null,
        cidade: editingData.cidade ?? cliente.cidade ?? null,
        estado: editingData.estado ?? cliente.estado ?? null,
        telefoneCondominio: telefoneCondominioValue ? unmask(telefoneCondominioValue.toString()) : null,
        celularCondominio: celularCondominioValue ? unmask(celularCondominioValue.toString()) : null,
        nomeSindico: editingData.nomeSindico ?? cliente.sindico.nome ?? null,
        telefoneSindico: telefoneSindicoValue ? unmask(telefoneSindicoValue.toString()) : null,
        emailSindico: editingData.emailSindico ?? cliente.sindico.email ?? null,
        // Campos de data - usar helper para permitir limpar
        dataAniversarioSindico: getEditedValue("dataAniversarioSindico", cliente.sindico.aniversario),
        dataInicioMandato: getEditedValue("dataInicioMandato", cliente.sindico.dataInicioMandato),
        dataFimMandato: getEditedValue("dataFimMandato", cliente.sindico.dataFimMandato),
        nomePorteiro: editingData.nomePorteiro ?? cliente.porteiro?.nome ?? null,
        telefonePorteiro: telefonePorteiroValue ? unmask(telefonePorteiroValue.toString()) : null,
        quantidadeSPDA: editingData.quantidadeSPDA ?? cliente.qtdSPDA ?? null,
        quantidadeAndares: editingData.quantidadeAndares ?? cliente.qtdAndares ?? null,
        especificacaoCondominio: editingData.especificacaoCondominio ?? cliente.especificacaoCondominio ?? null,
        observacao: editingData.observacao ?? cliente.observacao ?? null,
        dataContatoAgendado: dataContatoValue,
      }

      // ultimaManutencao:
      // - No backend pode existir com horário (timestamp do último pedido).
      // - Na UI mostramos como "YYYY-MM-DD".
      // Se enviarmos de volta sem mudança, iremos regravar e perder o horário.
      // Então só envia se o usuário mudou de fato o valor do campo.
      const normalizeDateField = (value: unknown): string | null => {
        if (value === undefined || value === null) return null
        const str = String(value)
        const trimmed = str.trim()
        if (!trimmed) return null
        return trimmed
      }

      const ultimaManutencaoNext = normalizeDateField(editingData.ultimaManutencao)
      const ultimaManutencaoPrev = normalizeDateField(originalData?.ultimaManutencao)
      if (ultimaManutencaoNext !== ultimaManutencaoPrev) {
        payload.ultimaManutencao = ultimaManutencaoNext
      }

      const response = await fetch(`${normalizedApiBasePath}/${clienteId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })



      if (!response.ok) {
        throw new Error("Erro ao salvar alterações")
      }

      const updatedData = (await response.json()) as RawClientDetail
      const mappedCliente = mapToCliente(updatedData)
      mappedCliente.isInResearch = cliente?.isInResearch
      setCliente(mappedCliente)

      // Atualizar dados originais e de edição
      // Usando os valores já formatados do mappedCliente
      const updatedInitialData: Partial<RawClientDetail> = {
        razaoSocial: mappedCliente.razaoSocial,
        cnpj: mappedCliente.cnpj,
        cep: mappedCliente.cep || null,
        logradouro: mappedCliente.logradouro || null,
        numero: mappedCliente.numero || null,
        complemento: mappedCliente.complemento || null,
        bairro: mappedCliente.bairro || null,
        cidade: mappedCliente.cidade || null,
        estado: mappedCliente.estado || null,
        telefoneCondominio: mappedCliente.telefoneCondominio || null,
        celularCondominio: mappedCliente.celularCondominio || null,
        nomeSindico: mappedCliente.sindico.nome || null,
        telefoneSindico: mappedCliente.sindico.telefone || null,
        emailSindico: mappedCliente.sindico.email || null,
        // Campos de data "apenas dia" - já estão no formato YYYY-MM-DD
        dataAniversarioSindico: mappedCliente.sindico.aniversario || null,
        dataInicioMandato: mappedCliente.sindico.dataInicioMandato || null,
        dataFimMandato: mappedCliente.sindico.dataFimMandato || null,
        nomePorteiro: mappedCliente.porteiro?.nome || null,
        telefonePorteiro: mappedCliente.porteiro?.telefone || null,
        quantidadeSPDA: mappedCliente.qtdSPDA || null,
        quantidadeAndares: mappedCliente.qtdAndares || null,
        especificacaoCondominio: mappedCliente.especificacaoCondominio || null,
        observacao: mappedCliente.observacao || null,
        // dataContatoAgendado - formato YYYY-MM-DDTHH:mm para datetime-local
        dataContatoAgendado: mappedCliente.dataAgendamento || null,
        ultimaManutencao: mappedCliente.ultimaManutencao || null,
        isContratoVigente: mappedCliente.isContratoVigente,
      }
      setEditingData(updatedInitialData)
      setOriginalData(JSON.parse(JSON.stringify(updatedInitialData)))

      toast({
        title: "Cliente atualizado!",
        description: "As informações foram salvas com sucesso.",
      })

      setInfoEditMode(false)

      // Notifica o componente pai que o cliente foi atualizado
      onClientUpdated?.()
    } catch (err) {
      console.error("Erro ao salvar:", err)
      toast({
        title: "Erro ao salvar",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleReturnToPesquisa = async () => {
    if (!cliente) return

    try {
      setReturning(true)

      const response = await fetch("/api/vendedor/clients/retornar-pesquisa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: Number(cliente.id) }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erro ao retornar cliente para pesquisa")
      }

      toast({
        title: "Cliente retornado",
        description: "O cliente foi retornado para pesquisa com sucesso.",
      })

      setReturnConfirmOpen(false)
      onClientReturned?.(Number(cliente.id))
      onClose()
    } catch (err) {
      console.error("Erro ao retornar para pesquisa:", err)
      toast({
        title: "Erro ao retornar",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      })
    } finally {
      setReturning(false)
    }
  }

  const formatDate = (value?: string, fallback = "Não informado") => {
    if (!value) return fallback
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return fallback
    return date.toLocaleDateString("pt-BR")
  }

  const formatCurrency = (value?: number | null, fallback = "R$ 0,00") => {
    if (value === null || value === undefined) return fallback
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  }

  const openPedidoDialog = (pedido: PedidoHistoricoItem) => {
    setPedidoDialogData(pedido)
    setPedidoDialogOpen(true)
  }

  const closePedidoDialog = () => {
    setPedidoDialogOpen(false)
    setPedidoDialogData(null)
  }

  const toggleOrcamentoDetails = (id: number) => {
    setExpandedOrcamentos((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Lógica igual ao legado:
  // - status = 2: Recebido
  // - status = -1: Cancelado (não conta como a receber)
  // - status = 0: Pendente (a receber ou vencido, dependendo da data)
  const totalRecebido = debitos.reduce((sum, debito) => (debito.status === 2 ? sum + (debito.valor ?? 0) : sum), 0)
  const totalAReceber = debitos.reduce(
    (sum, debito) => (debito.status === 0 ? sum + (debito.valor ?? 0) : sum),
    0,
  )

  const updateEditingField = (field: keyof RawClientDetail, value: string | number | null) => {
    setEditingData((prev) => ({ ...prev, [field]: value }))
  }

  const renderField = (
    label: string,
    field: keyof RawClientDetail,
    value: string | number | null | undefined,
    type: "text" | "number" | "date" | "textarea" | "cep" | "cnpj" | "phone" = "text",
    placeholder?: string,
    disabled = false
  ) => {
    const displayValue = value ?? null
    // Verificar se a chave existe no objeto (foi editada), não apenas se o valor é null
    // Isso permite que campos limpos (null) sejam mostrados como vazios
    const hasBeenEdited = Object.prototype.hasOwnProperty.call(editingData, field)
    const editValue = hasBeenEdited ? editingData[field] : displayValue

    if (type === "textarea") {
      return (
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">{label}</p>
          <Textarea
            value={editValue?.toString() ?? ""}
            onChange={(e) => updateEditingField(field, e.target.value || null)}
            placeholder={placeholder || "Não informado"}
            disabled={disabled}
            className="min-h-12 text-[13px] bg-background border-border focus:border-blue-500 py-1.5 px-2"
          />
        </div>
      )
    }

    // Aplicar máscaras
    let displayValueFormatted = editValue?.toString() ?? ""
    let onChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value
      if (type === "number") {
        const numValue = rawValue ? Number.parseInt(rawValue, 10) : null
        updateEditingField(field, numValue)
      } else {
        updateEditingField(field, rawValue || null)
      }
    }

    if (type === "cep") {
      displayValueFormatted = maskCEP(displayValueFormatted)
      onChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = unmask(e.target.value)
        const masked = maskCEP(rawValue)
        updateEditingField(field, rawValue || null)
      }
    } else if (type === "cnpj") {
      displayValueFormatted = maskCNPJ(displayValueFormatted)
      onChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = unmask(e.target.value)
        const masked = maskCNPJ(rawValue)
        updateEditingField(field, rawValue || null)
      }
    } else if (type === "phone") {
      displayValueFormatted = maskPhone(displayValueFormatted)
      onChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = unmask(e.target.value)
        const masked = maskPhone(rawValue)
        updateEditingField(field, rawValue || null)
      }
    }

    return (
      <div>
        <label className="text-[11px] font-bold text-white mb-0.5 block uppercase tracking-wide">{label}</label>
        <input
          type={type === "date" || type === "number" ? type : "text"}
          data-slot="input"
          value={displayValueFormatted}
          onChange={onChangeHandler}
          disabled={disabled}
          placeholder={placeholder || ""}
          min={type === "number" ? 0 : undefined}
          className={cn(
            "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-2 py-1 shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive text-[13px] bg-slate-900/50 border-border focus:border-blue-500 text-white font-medium",
          )}
        />
      </div>
    )
  }

  const displayNomeCondominio = cliente ? (cliente.nomeSindico || formatRazaoSocial(cliente.razaoSocial) || "Novo Cliente") : ""
  const displayRazaoSocial = cliente ? (formatRazaoSocial(cliente.razaoSocial)) : ""
  const editingHasProximoContato = Object.prototype.hasOwnProperty.call(
    editingData,
    "dataContatoAgendado",
  )
  const rawProximoContato = editingHasProximoContato
    ? editingData.dataContatoAgendado ?? ""
    : toDateTimeInputValue(cliente?.dataAgendamento)

  if (!open) {
    return null
  }

  const shouldShowSkeleton = loading || (!cliente && !error)
  const safeActiveTab = activeTab

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className={cn(
          "bg-card border-border text-[12px] sm:text-sm",
          "w-full max-w-full md:max-w-6xl h-[100dvh] md:h-[55vh] max-h-[100dvh] md:max-h-[calc(100vh-24px)] overflow-hidden",
          "rounded-none md:rounded-xl p-3 sm:py-2"
        )}>
          <DialogHeader className="sr-only">
            <DialogTitle>Detalhes do cliente</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col md:flex-row gap-4 h-full min-h-0 overflow-hidden">
            {/* Main content */}
            <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
              {shouldShowSkeleton ? (
                <div className="space-y-6 py-4">
                  <div className="space-y-4">
                    <Skeleton className="h-6 w-48" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-64" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <div className="grid grid-cols-4 gap-2">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} className="h-9 w-full" />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    {Array.from({ length: 3 }).map((_, sectionIndex) => (
                      <div key={sectionIndex} className="space-y-3">
                        <Skeleton className="h-4 w-40" />
                        <div className="grid grid-cols-2 gap-4">
                          {Array.from({ length: 4 }).map((_, index) => (
                            <Skeleton key={index} className="h-16 w-full" />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <Skeleton className="h-4 w-32" />
                    <div className="flex gap-2">
                      <Skeleton className="h-10 w-32" />
                      <Skeleton className="h-10 w-24" />
                      <Skeleton className="h-10 w-36" />
                    </div>
                  </div>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
                  <p>{error}</p>
                  <Button variant="outline" onClick={() => loadCliente().catch((err) => console.error(err))}>
                    Tentar novamente
                  </Button>
                </div>
              ) : cliente ? (
                <>
                  <DialogHeader className="flex-shrink-0">
                    <div className="flex flex-wrap justify-between items-stretch gap-2 sm:gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <DialogTitle className="text-sm sm:text-lg md:text-xl font-bold text-foreground flex items-center gap-2 leading-tight">
                            <span className="text-[.95em]">{displayNomeCondominio}</span>
                          </DialogTitle>
                          <div hidden className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg border border-border">
                            {cliente.responsavel && cliente.tipoResponsavel === "chatbot" ? (
                              <>
                                <Bot className="h-5 w-5 text-blue-600" />
                                <span className="font-semibold text-foreground">Chatbot</span>
                              </>
                            ) : cliente.responsavel && cliente.tipoResponsavel === "vendedor" ? (
                              <>
                                <User className="h-5 w-5 text-blue-600" />
                                <span className="font-semibold text-foreground">{cliente.responsavel}</span>
                              </>
                            ) : (
                              <>
                                <User className="h-5 w-5 text-muted-foreground" />
                                <span className="font-semibold text-muted-foreground">Não informado</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center pb-3 gap-3 text-xs sm:text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-mono">CNPJ: {formatCNPJ(cliente.cnpj)}</span>
                            {(() => {
                              const now = new Date()
                              // Prioridade: verifica estado real do array `contratos` (atualizado em tempo real)
                              const temVigente = contratos.some(c => c.status === "OK" && parseLocalDate(c.dataFim) >= now)
                              const temPendente = contratos.some(c => c.status === "PENDENTE")
                              const temOkExpirado = !temVigente && contratos.some(c => c.status === "OK")

                              if (temVigente) return (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 h-5 px-1.5 text-[10px] items-center font-bold">
                                  CONTRATO ATIVO
                                </Badge>
                              )
                              if (temPendente) return (
                                <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200 h-5 px-1.5 text-[10px] items-center font-bold">
                                  CONTRATO PENDENTE
                                </Badge>
                              )
                              if (temOkExpirado) return (
                                <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 h-5 px-1.5 text-[10px] items-center font-bold">
                                  CONTRATO EXPIRADO
                                </Badge>
                              )
                              return null
                            })()}
                          </div>
                          <span className="text-foreground font-semibold">
                            Vendedor:{" "}
                            <span className="font-medium text-muted-foreground">
                              {cliente.vendedor ?? "Não atribuído"}
                            </span>
                          </span>
                        </div>
                        <DialogDescription asChild>
                          <div className="text-sm text-muted-foreground space-y-3">
                            <div className="grid gap-2 grid-cols-1">
                              <div>
                                <label className="text-[11px] font-bold text-white mb-0.5 block uppercase tracking-wide">ÚLTIMA COMPRA CONOSCO</label>
                                <div className="p-2 bg-slate-900/50 border border-border rounded-md text-[13px] text-white font-medium">
                                  {formatLocalDate(cliente?.ultimoPedido) || "Nenhuma compra"}
                                </div>
                              </div>
                            </div>
                          </div>
                        </DialogDescription>
                      </div>
                      <div className="flex flex-col-reverse sm:flex-col self-stretch justify-between items-end gap-2 px-1 min-w-0 w-full sm:w-auto">
                        <div className="flex items-center gap-1 flex-nowrap justify-end overflow-x-auto max-w-full pb-1">
                          {/* Botões Originais que devem estar sempre visíveis ou seguir lógica antiga */}
                          {!cliente.isInResearch && (
                            <AlertDialog open={returnConfirmOpen} onOpenChange={setReturnConfirmOpen}>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="border-red-500 text-red-500 hover:bg-red-500/10 h-8 sm:h-10 w-8 sm:w-10 flex-shrink-0"
                                  title="Retornar para Pesquisa"
                                  disabled={returning}
                                >
                                  {returning ? <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" /> : <X className="h-4 w-4 sm:h-5 sm:w-5" />}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Retornar cliente para pesquisa?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação irá remover o cliente da sua carteira e retorná-lo para a equipe de pesquisa.
                                    Os dados serão marcados como insuficientes e o cliente será redistribuído.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel disabled={returning}>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={handleReturnToPesquisa}
                                    disabled={returning}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    {returning ? "Retornando..." : "Confirmar Retorno"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}

                          {canToggleVisibility && dashVisibility?.hasVendor && !dashVisibility?.isVisible && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={handleActivateVisibility}
                              disabled={activatingVisibility}
                              className="border-amber-500 text-amber-500 hover:bg-amber-500/10 h-10 w-10"
                              title="Tornar visível no Dashboard"
                            >
                              {activatingVisibility ? <Loader2 className="h-5 w-5 animate-spin" /> : <Eye className="h-5 w-5" />}
                            </Button>
                          )}
                          {canShowSalesActions && isFreeClient && (isMasterOrAdmin || String((session?.user as any)?.id) === String(cliente?.vendedorId)) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-10 w-10 border-blue-200 text-blue-600 hover:bg-blue-50"
                                  title="Ações de Venda"
                                >
                                  <MoreHorizontal className="h-5 w-5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>Status da Negociação</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger className="gap-2">
                                    <History className="h-4 w-4" />
                                    Mover no Kanban
                                  </DropdownMenuSubTrigger>
                                  <DropdownMenuPortal>
                                    <DropdownMenuSubContent>
                                      {KANBAN_STAGES.map((stage) => (
                                        <DropdownMenuItem
                                          key={stage.code}
                                          onClick={() => handleUpdateKanbanStage(stage.code)}
                                          className="gap-2 cursor-pointer"
                                        >
                                          <div className={cn("w-2 h-2 rounded-full", stage.dotColor)} />
                                          <span className={cn(cliente.kanbanCode === stage.code && "font-bold text-primary")}>
                                            {stage.title}
                                          </span>
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuSubContent>
                                  </DropdownMenuPortal>
                                </DropdownMenuSub>

                                <DropdownMenuItem
                                  onClick={() => setPerdaOpen(true)}
                                  className="text-red-600 focus:text-red-600 gap-2 cursor-pointer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Marcar como Perda
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}

                          <Button
                            variant="outline"
                            onClick={() => {
                              if (hasRecentOpenBudget()) {
                                toast({ title: "Você tem orçamento recente em aberto" })
                                return
                              }
                              setOrcamentoDialogOpen(true)
                            }}
                            className="border-blue-500 text-blue-600 hover:bg-blue-500/10 h-8 sm:h-10 px-2 sm:px-4 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap flex-shrink-0"
                          >
                            <DollarSign className="h-4 w-4" />
                            <span className="hidden xs:inline">Criar orçamento</span>
                            <span className="xs:hidden">Orçamento</span>
                          </Button>


                          <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white h-8 sm:h-10 px-2 sm:px-4 text-xs sm:text-sm flex-shrink-0 whitespace-nowrap"
                            onClick={handleSave}
                            disabled={!hasChanges() || saving}
                            title="Salvar Alterações"
                          >
                            {saving ? "Salvando..." : "Salvar"}
                          </Button>
                        </div>
                        <div className="w-full sm:max-w-[240px]">
                          <label className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-white">
                            Próximo contato
                          </label>
                          <Input
                            type="datetime-local"
                            value={rawProximoContato}
                            onChange={(event) => updateEditingField("dataContatoAgendado", event.target.value || null)}
                            className="h-8 border border-blue-400 bg-slate-900/50 text-[13px] font-medium text-white focus:border-blue-600 focus:ring-1 focus:ring-blue-200"
                          />
                        </div>
                      </div>
                    </div>
                  </DialogHeader>

                  <Tabs value={safeActiveTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col min-h-0">
                    <TabsList className="flex w-full gap-1 py-1 bg-transparent overflow-x-auto flex-nowrap sm:grid sm:grid-cols-4 sm:flex-initial">
                      <TabsTrigger
                        value="info"
                        className="text-[12px] font-medium rounded-md border border-border/60 px-2 py-1 text-muted-foreground data-[state=active]:bg-blue-100 data-[state=active]:text-blue-600 data-[state=active]:border-blue-300 whitespace-nowrap flex-shrink-0"
                      >
                        Informações
                      </TabsTrigger>
                      <TabsTrigger
                        value="orcamentos"
                        className="text-[12px] font-medium rounded-md border border-border/60 px-2 py-1 text-muted-foreground data-[state=active]:bg-blue-100 data-[state=active]:text-blue-600 data-[state=active]:border-blue-300 whitespace-nowrap flex-shrink-0"
                      >
                        Orçamentos
                      </TabsTrigger>
                      <TabsTrigger
                        value="pedidos"
                        className="text-[12px] font-medium rounded-md border border-border/60 px-2 py-1 text-muted-foreground data-[state=active]:bg-blue-100 data-[state=active]:text-blue-600 data-[state=active]:border-blue-300 whitespace-nowrap flex-shrink-0"
                      >
                        Pedidos
                      </TabsTrigger>
                      <TabsTrigger
                        value="financeiro"
                        className="text-[12px] font-medium rounded-md border border-border/60 px-2 py-1 text-muted-foreground data-[state=active]:bg-blue-100 data-[state=active]:text-blue-600 data-[state=active]:border-blue-300 whitespace-nowrap flex-shrink-0"
                      >
                        Financeiro
                      </TabsTrigger>
                      {/* Aba de registros: só aparece no mobile (no desktop é painel lateral) */}
                      <TabsTrigger
                        value="registros"
                        className="sm:hidden text-[12px] font-medium rounded-md border border-border/60 px-2 py-1 text-muted-foreground data-[state=active]:bg-blue-100 data-[state=active]:text-blue-600 data-[state=active]:border-blue-300 whitespace-nowrap flex-shrink-0"
                      >
                        Registros
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="info" className="mt-1 flex-1 overflow-y-auto pr-2">
                      {!infoEditMode ? (
                        /* ===== VIEW MODE: Textos compactos em duas colunas ===== */
                        <div className="divide-y divide-border">
                          {/* Dados do Cliente */}
                          <div className="py-1.5">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="text-[11px] font-bold uppercase text-white flex items-center gap-1">
                                <User className="h-3 w-3" /> Dados do Cliente
                              </h4>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setInfoEditMode(true)}
                                className="h-6 px-2 text-[11px] gap-1"
                              >
                                <Pencil className="h-3 w-3" />
                                Editar
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[13px] text-foreground">
                              <div><strong>Nome:</strong> {cliente.sindico.nome || cliente.razaoSocial}</div>
                              <div><strong>Documento/CNPJ:</strong> {formatCNPJ(cliente.cnpj)}</div>
                              <div className="flex items-center gap-1"><strong>Telefone:</strong> {formatPhone(cliente.sindico.telefone || cliente.telefoneCondominio)} {renderChatButton(cliente.sindico.telefone || cliente.telefoneCondominio)}</div>
                              <div className="flex items-center gap-1"><strong>Auxiliar:</strong> {formatPhone(cliente.celularCondominio)} {renderChatButton(cliente.celularCondominio)}</div>
                              <div><strong>Email:</strong> {cliente.sindico.email || "—"}</div>
                              <div><strong>CEP:</strong> {formatCEP(cliente.cep)}</div>
                              <div className="col-span-2"><strong>Endereço:</strong> {cliente.endereco}</div>
                              <div><strong>Bairro:</strong> {cliente.bairro}</div>
                              <div><strong>Cidade/UF:</strong> {cliente.cidade && `${cliente.cidade}/${cliente.estado}`}</div>
                            </div>
                          </div>

                          {/* Observações */}
                          {cliente.observacao && (
                            <div className="py-1.5">
                              <h4 className="text-[11px] font-bold uppercase text-white mb-1 flex items-center gap-1">
                                <FileText className="h-3 w-3" /> Observações
                              </h4>
                              <p className="text-[13px] text-foreground whitespace-pre-wrap">{cliente.observacao}</p>
                            </div>
                          )}

                        </div>
                      ) : (
                        /* ===== EDIT MODE: Formulário de edição ===== */
                        <div className="space-y-2">
                          {/* Dados do Cliente */}
                          <div className="border border-border rounded-md p-2">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-[11px] font-bold uppercase text-white flex items-center gap-1">
                                <User className="h-3 w-3" /> Dados do Cliente
                              </h4>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingData(JSON.parse(JSON.stringify(originalData)))
                                  setInfoEditMode(false)
                                }}
                                className="h-6 px-2 text-[11px]"
                              >
                                Cancelar
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                              {renderField("Nome", "razaoSocial", cliente.sindico.nome || cliente.razaoSocial)}
                              {renderField("Documento/CNPJ", "cnpj", cliente.cnpj, "cnpj")}
                              {renderField("Telefone Principal", "telefoneSindico", cliente.sindico.telefone || cliente.telefoneCondominio, "phone")}
                              {renderField("Telefone Auxiliar", "celularCondominio", cliente.celularCondominio, "phone")}
                              {renderField("Email", "emailSindico", cliente.sindico.email, "text", "email@exemplo.com")}
                              {renderField("CEP", "cep", cliente.cep, "cep")}
                              {renderField("Logradouro", "logradouro", cliente.logradouro)}
                              {renderField("Número", "numero", cliente.numero)}
                              {renderField("Complemento", "complemento", cliente.complemento)}
                              {renderField("Bairro", "bairro", cliente.bairro)}
                              {renderField("Cidade", "cidade", cliente.cidade)}
                              {renderField("Estado", "estado", cliente.estado)}
                            </div>
                          </div>

                          {/* Observações */}
                          <div className="border border-border rounded-md p-2">
                            <h4 className="text-[11px] font-bold uppercase text-white mb-2 flex items-center gap-1">
                              <FileText className="h-3 w-3" /> Observações
                            </h4>
                            {renderField("Observações", "observacao", cliente.observacao, "textarea")}
                          </div>

                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="orcamentos" className="mt-2 flex-1 overflow-y-auto pr-2">
                      {loadingHistory ? (
                        <div className="space-y-2">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={`orcamento-skeleton-${i}`} className="h-8 w-full" />
                          ))}
                        </div>
                      ) : historyError ? (
                        <div className="text-center py-4 text-muted-foreground text-[13px]">
                          <p>{historyError}</p>
                          <Button variant="outline" size="sm" onClick={() => loadHistory().catch((err) => console.error(err))} className="mt-2 text-[12px]">
                            Tentar novamente
                          </Button>
                        </div>
                      ) : history ? (
                        history.orcamentos.length === 0 ? (
                          <div className="rounded-md border border-dashed border-border/70 bg-muted/30 px-4 py-6 text-center text-[13px] text-muted-foreground">
                            Nenhum orçamento registrado.
                          </div>
                        ) : (
                          <div className="border border-border rounded-md overflow-x-auto">
                            <table className="w-full text-[11px] sm:text-[13px] min-w-[600px] sm:min-w-0">
                              <thead>
                                <tr className="bg-muted/50">
                                  <th className="border border-border px-2 py-1.5 text-center font-semibold text-foreground w-10">Ver</th>
                                  <th className="border border-border px-2 py-1.5 text-left font-semibold text-foreground">ID</th>
                                  <th className="border border-border px-2 py-1.5 text-left font-semibold text-foreground">Unidade</th>
                                  <th className="border border-border px-2 py-1.5 text-left font-semibold text-foreground">Data</th>
                                  <th className="border border-border px-2 py-1.5 text-left font-semibold text-foreground">Vendedor</th>
                                  <th className="border border-border px-2 py-1.5 text-left font-semibold text-foreground">Status</th>
                                  <th className="border border-border px-2 py-1.5 text-right font-semibold text-foreground">Valor</th>
                                  <th className="border border-border px-2 py-1.5 text-center font-semibold text-foreground">Ações</th>
                                </tr>
                              </thead>
                              <tbody>
                                {history.orcamentos.map((orcamento) => {
                                  const rawStatus = orcamento.status?.toUpperCase() ?? "N/A"
                                  const isAprovado = rawStatus === "APROVADO" || rawStatus === "CONCLUIDO"
                                  const isCancelado = rawStatus === "CANCELADO"
                                  const statusLabel = (() => {
                                    const statusMap: Record<string, string> = {
                                      EM_ABERTO: "Em aberto",
                                      CANCELADO: "Cancelado",
                                    }
                                    return statusMap[rawStatus] ?? (orcamento.status ?? "N/A")
                                  })()

                                  return (
                                    <tr key={orcamento.id} className="hover:bg-muted/30">
                                      <td className="border border-border px-2 py-1.5 text-center">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0"
                                          title="Ver detalhes"
                                          onClick={() => {
                                            setOrcamentoBeingEdited(orcamento)
                                            setEditOrcamentoOpen(true)
                                          }}
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                      </td>
                                      <td className="border border-border px-2 py-1.5 font-medium">#{orcamento.id}</td>
                                      <td className="border border-border px-2 py-1.5">{orcamento.empresaId ? `Unidade ${orcamento.empresaId}` : "—"}</td>
                                      <td className="border border-border px-2 py-1.5">{formatDate(orcamento.createdAt ?? undefined)}</td>
                                      <td className="border border-border px-2 py-1.5">{orcamento.vendedor || "—"}</td>
                                      <td className="border border-border px-2 py-1.5">
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "text-[11px] font-medium px-1.5 py-0.5",
                                            isCancelado
                                              ? "border-red-500 bg-red-100 text-red-700"
                                              : isAprovado
                                                ? "border-emerald-500 bg-emerald-500 text-white"
                                                : "border-gray-400 bg-gray-200 text-gray-700",
                                          )}
                                        >
                                          {statusLabel}
                                        </Badge>
                                      </td>
                                      <td className="border border-border px-2 py-1.5 text-right font-medium">
                                        {formatCurrency(orcamento.total)}
                                      </td>
                                      <td className="border border-border px-2 py-1.5 text-center">
                                        {!isAprovado && !isCancelado ? (
                                          <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                              <Button
                                                size="sm"
                                                className="h-7 px-3 text-[12px] bg-blue-500 hover:bg-blue-600 text-white"
                                                disabled={tirarPedidoLoadingId === orcamento.id}
                                              >
                                                {tirarPedidoLoadingId === orcamento.id ? (
                                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                  "Pedido"
                                                )}
                                              </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                              <AlertDialogHeader>
                                                <AlertDialogTitle>Confirmar geração de pedido</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                  Deseja gerar um pedido a partir do orçamento #{orcamento.id}?
                                                  <br />
                                                  <strong>Valor:</strong> {formatCurrency(orcamento.total)}

                                                  {contratos.length > 0 && (
                                                    <div className="mt-4 p-3 border rounded-md bg-blue-50 border-blue-200 text-left">
                                                      <p className="text-sm font-semibold text-blue-800 mb-2">Vincular a um contrato ativo?</p>
                                                      <Select
                                                        value={selectedContratoId ? String(selectedContratoId) : "none"}
                                                        onValueChange={(val) => setSelectedContratoId(val === "none" ? null : parseInt(val))}
                                                      >
                                                        <SelectTrigger className="bg-white">
                                                          <SelectValue placeholder="Selecione um contrato (opcional)..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                          <SelectItem value="none">Não vincular</SelectItem>
                                                          {contratos.map(c => {
                                                            let labelStatus = "";
                                                            if (c.status === "PENDENTE") labelStatus = "(PENDENTE)";
                                                            else if (parseLocalDate(c.dataFim) >= new Date(new Date().setHours(0, 0, 0, 0))) labelStatus = "(VIGENTE)";
                                                            else labelStatus = "(EXPIRADO)";
                                                            const duration = calculateDurationInMonths(c.dataInicio, c.dataFim);
                                                            return (
                                                              <SelectItem key={c.id} value={String(c.id)}>
                                                                Contrato #{c.id} {labelStatus} - {duration} meses - Fim: {formatLocalDate(c.dataFim)}
                                                              </SelectItem>
                                                            );
                                                          })}
                                                        </SelectContent>
                                                      </Select>
                                                    </div>
                                                  )}
                                                </AlertDialogDescription>
                                              </AlertDialogHeader>
                                              <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction
                                                  disabled={tirarPedidoLoadingId === orcamento.id}
                                                  onClick={() => handleTirarPedido(orcamento.id)}
                                                >
                                                  Confirmar
                                                </AlertDialogAction>
                                              </AlertDialogFooter>
                                            </AlertDialogContent>
                                          </AlertDialog>
                                        ) : (
                                          <span className="text-muted-foreground text-[11px]">—</span>
                                        )}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )
                      ) : null}
                    </TabsContent>

                    <TabsContent value="pedidos" className="mt-2 flex-1 overflow-y-auto pr-2">
                      {loadingHistory ? (
                        <div className="space-y-2">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={`pedido-skeleton-${i}`} className="h-8 w-full" />
                          ))}
                        </div>
                      ) : historyError ? (
                        <div className="text-center py-4 text-muted-foreground text-[13px]">
                          <p>{historyError}</p>
                          <Button variant="outline" size="sm" onClick={() => loadHistory().catch((err) => console.error(err))} className="mt-2 text-[12px]">
                            Tentar novamente
                          </Button>
                        </div>
                      ) : history ? (
                        history.pedidos.length === 0 ? (
                          <div className="rounded-md border border-dashed border-border/70 bg-muted/30 px-4 py-6 text-center text-[13px] text-muted-foreground">
                            Nenhum pedido registrado.
                          </div>
                        ) : (
                          <div className="border border-border rounded-md overflow-x-auto">
                            <table className="w-full text-[11px] sm:text-[13px] min-w-[700px] sm:min-w-0">
                              <thead>
                                <tr className="bg-muted/50">
                                  <th className="border border-border px-2 py-1.5 text-center font-semibold text-foreground w-10">Ver</th>
                                  <th className="border border-border px-2 py-1.5 text-left font-semibold text-foreground">ID</th>
                                  <th className="border border-border px-2 py-1.5 text-left font-semibold text-foreground">Unidade</th>
                                  <th className="border border-border px-2 py-1.5 text-left font-semibold text-foreground">Orça.</th>
                                  <th className="border border-border px-2 py-1.5 text-left font-semibold text-foreground">Data</th>
                                  <th className="border border-border px-2 py-1.5 text-left font-semibold text-foreground">Vendedor</th>
                                  <th className="border border-border px-2 py-1.5 text-left font-semibold text-foreground">Status</th>
                                  <th className="border border-border px-2 py-1.5 text-right font-semibold text-foreground">Valor</th>
                                </tr>
                              </thead>
                              <tbody>
                                {history.pedidos.map((pedido) => {
                                  const rawStatus = pedido.status?.toUpperCase() ?? "N/A"
                                  const empresaDoOrcamento = pedido.orcamentoId
                                    ? history.orcamentos.find((orcamento) => orcamento.id === pedido.orcamentoId)?.empresaId
                                    : pedido.empresaId
                                  const isOs = pedido.tipoEspecial === "OS"
                                  const isConcluido = rawStatus === "CONCLUIDO" || rawStatus === "APROVADO"
                                  const isCancelado = rawStatus === "CANCELADO"
                                  const pedidoStatusLabel = (() => {
                                    const statusMap: Record<string, string> = {
                                      EM_ABERTO: "Em aberto",
                                      CANCELADO: "Cancelado",
                                      CONCLUIDO: "Concluído",
                                      APROVADO: "Aprovado",
                                    }
                                    return statusMap[rawStatus] ?? (pedido.status ?? "N/A")
                                  })()

                                  return (
                                    <tr key={pedido.id} className="hover:bg-muted/30">
                                      <td className="border border-border px-2 py-1.5 text-center">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0"
                                          title="Ver detalhes"
                                          onClick={() => openPedidoDialog(pedido)}
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                      </td>
                                      <td className="border border-border px-2 py-1.5 font-medium">#{pedido.id}</td>
                                      <td className="border border-border px-2 py-1.5">{empresaDoOrcamento ? `Unidade ${empresaDoOrcamento}` : "—"}</td>
                                      <td className="border border-border px-2 py-1.5">{pedido.orcamentoId ? `#${pedido.orcamentoId}` : "—"}</td>
                                      <td className="border border-border px-2 py-1.5">{formatDate(pedido.createdAt ?? undefined)}</td>
                                      <td className="border border-border px-2 py-1.5">{pedido.vendedor || "—"}</td>
                                      <td className="border border-border px-2 py-1.5">
                                        <div className="flex flex-col items-start gap-1">
                                          {pedido.contratoId && (
                                            <Badge
                                              variant="outline"
                                              className={cn(
                                                "text-[9px] h-4 px-1 uppercase font-bold",
                                                pedido.isContratoVigente
                                                  ? "bg-blue-100 text-blue-700 border-blue-200"
                                                  : "bg-slate-100 text-slate-500 border-slate-200"
                                              )}
                                            >
                                              Contrato
                                            </Badge>
                                          )}
                                          <Badge
                                            variant="outline"
                                            className={cn(
                                              "font-medium px-1.5 py-0.5 cursor-pointer hover:opacity-80",
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
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setStatusMapPedido({ id: pedido.id, status: pedido.status })
                                              setStatusMapOpen(true)
                                            }}
                                          >
                                            {pedidoStatusLabel}
                                          </Badge>
                                          {isOs && (
                                            <span className="mt-0.5 text-[10px] text-blue-600">Ord. Serv.</span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="border border-border px-2 py-1.5 text-right font-medium">
                                        {formatCurrency(pedido.total)}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )
                      ) : null}
                    </TabsContent>

                    <TabsContent value="financeiro" className="mt-2 flex-1 overflow-y-auto pr-2">
                      {loadingDebitos ? (
                        <div className="space-y-2">
                          {Array.from({ length: 3 }).map((_, index) => (
                            <Skeleton key={index} className="h-8 w-full" />
                          ))}
                        </div>
                      ) : debitosError ? (
                        <div className="text-center py-4 text-muted-foreground text-[13px]">
                          <p>{debitosError}</p>
                          <Button variant="outline" size="sm" className="mt-2 text-[12px]" onClick={() => loadDebitos().catch(console.error)}>
                            Tentar novamente
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="rounded-md border border-border">
                            <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/60 bg-muted/30">
                              <h3 className="text-[12px] font-semibold text-foreground flex items-center gap-1.5">
                                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                                Débitos
                              </h3>
                              <span className="text-[11px] text-muted-foreground">
                                {debitos.length} {debitos.length === 1 ? "registro" : "registros"}
                              </span>
                            </div>
                            <div className="overflow-x-auto border-t border-border/60">
                              {debitos.length === 0 ? (
                                <div className="py-6 text-center text-muted-foreground text-[13px]">Nenhum débito encontrado.</div>
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
                                    {debitos.map((debito) => {
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
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="h-6 px-3 py-3.4 text-[13px]"
                                              onClick={() => handleDownloadBoleto(debito)}
                                              disabled={isRecebido || isCancelado || !debito.bancoEmissorId || baixandoBoletoId === debito.id}
                                            >
                                              {baixandoBoletoId === debito.id ? "..." : "Download boleto"}
                                            </Button>
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



                    {/* Aba de registros — só usada no mobile. No desktop é o painel lateral. */}
                    <TabsContent value="registros" className="mt-1 flex-1 overflow-y-auto flex flex-col min-h-0 sm:hidden">
                      {loadingRegistros ? (
                        <div className="flex items-center justify-center flex-1 text-muted-foreground py-8">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          <span className="text-[12px]">Carregando...</span>
                        </div>
                      ) : registrosError ? (
                        <div className="text-center py-4 text-destructive text-[12px]">
                          <p>{registrosError}</p>
                          <Button variant="outline" size="sm" className="mt-2 h-7 text-[11px]" onClick={() => loadRegistros()}>
                            Tentar novamente
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0 flex flex-col">
                            {registros.length === 0 ? (
                              <div className="text-center py-6 text-muted-foreground flex-1 flex flex-col items-center justify-center">
                                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                <p className="text-[11px]">Nenhum registro</p>
                              </div>
                            ) : (
                              <>
                                <div className="flex-1" />
                                {registros.map((registro) => (
                                  <div key={registro.id} className="bg-muted/40 border border-border/60 rounded-md p-2">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] font-semibold text-foreground truncate max-w-[120px]">
                                        {registro.userName}
                                      </span>
                                      <span className="text-[9px] text-muted-foreground">
                                        {new Date(registro.createdAt).toLocaleString("pt-BR", {
                                          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                                        })}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-foreground whitespace-pre-wrap break-words">
                                      {registro.mensagem}
                                    </p>
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                          <div className="flex-shrink-0 pt-2 border-t border-border mt-2">
                            <div className="flex gap-2 items-end">
                              <Textarea
                                placeholder="Novo registro..."
                                value={newRegistroText}
                                onChange={(e) => setNewRegistroText(e.target.value)}
                                className="flex-1 min-h-[50px] max-h-[80px] text-[12px] resize-y"
                              />
                              <Button
                                onClick={createRegistro}
                                disabled={!newRegistroText.trim() || creatingRegistro}
                                className="h-9 w-9 rounded-full p-0 bg-blue-600 hover:bg-blue-700 flex-shrink-0"
                              >
                                {creatingRegistro ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Send className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </TabsContent>
                  </Tabs>

                  {activeTab === "info" && (
                    <div className="flex justify-between items-center gap-2 pt-3 border-t border-border/60">
                      <Button variant="outline" onClick={onClose} className="border-border bg-transparent h-9 px-4 text-sm">
                        Fechar
                      </Button>
                      <Button
                        className="bg-blue-600 hover:bg-blue-700 text-white h-9 px-4 text-sm"
                        onClick={handleSave}
                        disabled={!hasChanges() || saving}
                      >
                        {saving ? "Salvando..." : "Salvar"}
                      </Button>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Lateral Registros Panel - Apenas no desktop (md+) */}
            <div className="hidden md:flex w-[280px] flex-shrink-0 border-l border-border pl-4 flex-col min-h-0 overflow-hidden">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                <MessageSquare className="h-4 w-4 text-blue-600" />
                <h3 className="text-[13px] font-semibold text-foreground">Registros</h3>
              </div>

              {loadingRegistros ? (
                <div className="flex items-center justify-center flex-1 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-[12px]">Carregando...</span>
                </div>
              ) : registrosError ? (
                <div className="text-center py-4 text-destructive text-[12px] flex-1">
                  <p>{registrosError}</p>
                  <Button variant="outline" size="sm" className="mt-2 h-7 text-[11px]" onClick={() => loadRegistros()}>
                    Tentar novamente
                  </Button>
                </div>
              ) : (
                <>
                  {/* Lista de registros - scrollable */}
                  <div
                    ref={registrosLateralRef}
                    className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0 flex flex-col"
                  >
                    {registros.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground flex-1 flex flex-col items-center justify-center">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p className="text-[11px]">Nenhum registro</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1" />
                        {registros.map((registro) => (
                          <div
                            key={registro.id}
                            className="bg-muted/40 border border-border/60 rounded-md p-2"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-semibold text-foreground truncate max-w-[100px]">
                                {registro.userName}
                              </span>
                              <span className="text-[9px] text-muted-foreground">
                                {new Date(registro.createdAt).toLocaleString("pt-BR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <p className="text-[11px] text-foreground whitespace-pre-wrap break-words">
                              {registro.mensagem}
                            </p>
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  {/* Input para novo registro - fixed at bottom */}
                  <div className="flex-shrink-0 pt-2 border-t border-border mt-2">
                    <div className="flex gap-2 items-end">
                      <Textarea
                        placeholder="Novo registro..."
                        value={newRegistroText}
                        onChange={(e) => setNewRegistroText(e.target.value)}
                        className="flex-1 min-h-[50px] max-h-[80px] text-[12px] resize-y"
                      />
                      <Button
                        onClick={createRegistro}
                        disabled={!newRegistroText.trim() || creatingRegistro}
                        className="h-9 w-9 rounded-full p-0 bg-blue-600 hover:bg-blue-700 flex-shrink-0"
                      >
                        {creatingRegistro ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogContent >
      </Dialog >

      <PedidoDetailsDialog
        pedidoData={pedidoDialogData}
        open={pedidoDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closePedidoDialog()
          } else {
            setPedidoDialogOpen(open)
          }
        }}
        clienteNome={cliente?.razaoSocial}
        onSuccess={async () => {
          const [historyData] = await Promise.all([loadHistory(), loadCliente()])
          if (pedidoDialogData) {
            const refreshed = historyData?.pedidos.find((p) => p.id === pedidoDialogData.id)
            if (refreshed) {
              setPedidoDialogData(refreshed)
            }
          }
        }}
      />

      <EditarOrcamentoDialog
        orcamentoId={orcamentoBeingEdited?.id ?? null}
        clienteId={cliente?.id ? Number(cliente.id) : 0}
        clienteNome={cliente?.razaoSocial}
        filialUf={orcamentoBeingEdited?.filialUf}
        open={editOrcamentoOpen}
        onClose={() => setEditOrcamentoOpen(false)}
        onSuccess={() => {
          setEditOrcamentoOpen(false)
          loadHistory().catch(console.error)
          loadCliente().catch(console.error)
        }}
      />

      <EnviarDocumentoDialog
        cliente={cliente ? {
          nomeCondominio: cliente.razaoSocial,
          cnpj: cliente.cnpj,
          sindico: {
            nome: cliente.sindico.nome,
            email: cliente.sindico.email ?? undefined,
            whatsapp: cliente.sindico.telefone ?? undefined,
          },
          administradora: cliente.administradora ? {
            nome: cliente.administradora.nome,
          } : undefined,
        } : null}
        open={enviarDocumentoOpen}
        onClose={() => setEnviarDocumentoOpen(false)}
      />

      {
        cliente && (
          <CriarOrcamentoDialog
            open={orcamentoDialogOpen}
            clienteId={cliente.id}
            clienteNome={formatRazaoSocial(cliente.nomeCondominio)}
            onClose={() => setOrcamentoDialogOpen(false)}
            onSuccess={() => {
              setOrcamentoDialogOpen(false)
              loadHistory().catch((err) => console.error(err))
              onOrcamentoCreated?.()
            }}
          />
        )
      }

      <PedidoStatusMapDialog
        currentStatus={statusMapPedido?.status ?? "AGUARDANDO"}
        open={statusMapOpen}
        onOpenChange={(open) => setStatusMapOpen(open)}
      />

      {/* Diálogo de Perda */}
      <AlertDialog open={perdaOpen} onOpenChange={setPerdaOpen}>
        <AlertDialogContent className="max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Marcar como Perda?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está marcando este cliente como perda. Deseja definir uma data para o sistema tentar contato automático no futuro?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-bold">Data da Última Manutenção (opcional)</Label>
              <div className="flex flex-col gap-1">
                <Input
                  type="date"
                  value={perdaDataManutencao}
                  onChange={(e) => setPerdaDataManutencao(e.target.value)}
                  className="bg-white"
                />
                <p className="text-[10px] text-muted-foreground">
                  Se informada, o sistema calculará 12 meses para a próxima tentativa.
                </p>
              </div>
            </div>
          </div>

          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={perdaLoading} onClick={() => setPerdaOpen(false)}>Cancelar</AlertDialogCancel>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                disabled={perdaLoading}
                onClick={() => handleConfirmPerda(false)}
                className="hover:bg-red-50 hover:text-red-600 border-red-200"
              >
                {perdaLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Ignorar (Remover)
              </Button>
              <Button
                disabled={perdaLoading || !perdaDataManutencao}
                onClick={() => handleConfirmPerda(true)}
                className="bg-red-600 hover:bg-red-700"
              >
                {perdaLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirmar com Data
              </Button>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
