"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  Bell,
  Bot,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  MapPin,
  Search,
  LayoutDashboard,
  RefreshCw,
  Users,
  CalendarClock,
  X,
  Eye,
  MoreHorizontal,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
  Link2Off,
  ChevronDown,
  Settings2,
} from "lucide-react"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ClienteDetailDialog } from "@/components/leads/cliente-detail-dialog"
import { CriarOrcamentoDialog } from "@/components/orcamentos/criar-orcamento-dialog"
import { estados_cidades } from "@/components/leads/leads-geral"
import { formatCNPJ, formatPhone, formatRazaoSocial, unmask } from "@/lib/formatters"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { isClienteRenovado as isClienteRenovadoCheck } from "@/lib/client-status"
import { useToast } from "@/hooks/use-toast"
import { useChatLauncher } from "@/components/chat/chat-launcher"
import { ChatMiniPanel } from "@/components/chat"
import { TemplateModal } from "@/components/chat/template-modal"
import { TemplateComponent } from "@/lib/chat/api"
import { broadcastTemplateVariableTokens } from "@/lib/chat/template-variables"
import { chatAPI, type Inbox, useVendorChatRealtime, type WhatsAppTemplate } from "@/lib/chat"
import { getOutboundFlowTemplate, type OutboundTemplatePayload } from "@/lib/chatbot/api"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { getPedidoStatusLabel } from "@/components/pedidos/pedido-status-map-dialog"
import { CrmCard } from "@/components/dashboard/crm-card"
import type { CrmCardClient, CrmCardChatSummary } from "@/components/dashboard/crm-card"

// Roles que podem visualizar dashboard de outros vendedores
const ADMIN_ROLES = ["MASTER", "ADMINISTRADOR"] as const
// Controle simples e centralizado para o disparo via chatbot outbound
const ENABLE_CHATBOT_OUTBOUND_BROADCAST = true
const CHATBOT_OUTBOUND_BROADCAST_ROLES = ["MASTER", "ADMINISTRADOR", "VENDEDOR"] as const

type TabKey = "leads" | "vendas" | "inadimplencia" | "fichas"

type VendorClientRow = {
  id: number
  cnpj: string
  razaoSocial: string
  bairro: string | null
  cidade: string | null
  estado: string | null
  categoria: "ativo" | "agendado" | "explorado"
  dataContatoAgendado: string | null
  ultimaManutencao: string | null
  proximaRenovacao: string | null
  observacao: string | null
  nomeSindico: string | null
  telefoneSindico: string | null
  telefoneCondominio: string | null
  celularCondominio: string | null
  telefonePorteiro: string | null
  ultimaAtualizacao: string
  kanbanCode?: number | null
  kanbanPosition?: number | null
  hasRecentOrcamento?: boolean
  lastOrcamentoAt?: string | null
  lastOrcamentoValor?: number | null
  totalPedidos?: number
  ultimoPedidoValor?: number
  ultimoPedidoValidoData?: string | null
  recentlyResearched?: boolean
}

type InadimplenciaDebito = {
  id: number
  valor: number
  vencimento: string | null
  stats: number
  cobrancasCount?: number
  boletoDisponivel?: boolean
}

type InadimplenciaClient = {
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
  debitos: InadimplenciaDebito[]
}

type InadimplenciaSummary = {
  inadimplencia?: { total: number; count: number }
  pagoAtrasoMes?: { total: number; count: number }
}

type VendorOrderRow = {
  id: number
  clienteId: number
  clienteRazaoSocial: string
  clienteNomeSindico?: string | null
  clienteCnpj: string
  clienteBairro: string | null
  clienteCidade: string | null
  clienteEstado: string | null
  valorTotal: number
  status: string
  createdAt: string
  itensCount: number
  parcelas: number | null
  contratoId?: number | null
  isContratoVigente?: boolean
}

type VendorFichaRow = {
  id: number
  fichaId: number
  razaoSocial: string
  local: string
  sentAt: string
  isReturned: boolean
  returnedAt: string | null
  researcherName: string | null
}

type GroupedFichas = Record<string, VendorFichaRow[]>

type ChatbotFlowSummary = {
  id: string
  name: string
  type: string
  engine?: string
  active: boolean
  inboxId?: string | null
}

type ClientPhoneOption = {
  label: string
  value: string
}

type OrdersRange = "current" | "previous"

type SummaryCounts = {
  agendados: number
  ativos: number
  explorados: number
}

const categoriaBadgeStyles: Record<VendorClientRow["categoria"] | "vencido", string> = {
  ativo: "bg-emerald-500/20 text-emerald-700 border-emerald-500/30",
  agendado: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  explorado: "bg-gray-100 text-black-600 border-black-500/20",
  vencido: "bg-red-500/10 text-red-600 border-red-500/20",
}

// Cliente ATIVO é considerado vencido quando passa do início do mês de vencimento
// Ex: manutenção em 5 de janeiro de 2024 → vence em 1 de fevereiro de 2025
const isClienteVencido = (client: VendorClientRow): boolean => {
  if (client.categoria !== "ativo") return false
  if (!client.ultimaManutencao) return false

  const ultimaManutencao = new Date(client.ultimaManutencao)
  // Pega o primeiro dia do mês seguinte no ano seguinte
  const vencimentoDate = new Date(
    ultimaManutencao.getFullYear() + 1,
    ultimaManutencao.getMonth() + 1,
    1
  )

  return new Date() > vencimentoDate
}

const getDisplayCategoria = (client: VendorClientRow): { label: string; style: string } => {
  if (isClienteVencido(client)) {
    return { label: "RENOV. VENCIDA", style: categoriaBadgeStyles.vencido }
  }
  if (client.categoria === "ativo") {
    return { label: "A RENOVAR", style: categoriaBadgeStyles.ativo }
  }
  return { label: client.categoria.toUpperCase(), style: categoriaBadgeStyles[client.categoria] }
}

// Verifica se um cliente agendado está atrasado
const isAgendadoAtrasado = (client: VendorClientRow): boolean => {
  if (!client.dataContatoAgendado) return false
  const agendadoDate = new Date(client.dataContatoAgendado)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return agendadoDate < today
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
})

const formatCurrency = (value: number) => currencyFormatter.format(value)

const formatDisplayDate = (value: string | null, fallback = "Sem data", noDay = false) => {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: noDay ? undefined : "2-digit",
    month: "short",
    year: "numeric"
  })
}

const formatDisplayDateTime = (value: string | null, fallback = "Sem data") => {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  })
}

const getClientPhoneOptions = (client: VendorClientRow): ClientPhoneOption[] => {
  const candidates = [
    { label: "Síndico", value: client.telefoneSindico },
    { label: "Condomínio", value: client.telefoneCondominio },
    { label: "Celular", value: client.celularCondominio },
    { label: "Porteiro", value: client.telefonePorteiro },
  ]

  const seen = new Set<string>()

  return candidates
    .filter((item) => !!item.value && item.value.trim().length > 0)
    .filter((item) => {
      const key = item.value!.replace(/\D/g, "")
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((item) => ({
      label: item.label,
      value: item.value!.trim(),
    }))
}

// Sistema de colunas do CRM Kanban
// Agora as sub-colunas das "Livres" (por estágio kanban) são colunas de primeiro nível
type CrmColumnId =
  | "livres-0"
  | "livres-1"
  | "livres-2"
  | "livres-3"
  | "livres-4"
  | "orcados"
  | "renovacoes"
  // mantido para compatibilidade interna (não usado no board)
  | "livres"
  | "livres-5"
  | "renovados"

type CrmColumn = {
  id: CrmColumnId
  title: string
  // cor do fundo do HEADER da coluna
  headerBgColor: string
  // cor do badge de contagem (fundo escuro neutro)
  badgeBgColor: string
  badgeTextColor: string
  dotColor?: string
}

// Colunas do board — 5 estágios de Livres + 2 consolidadas (Perda por último)
const CRM_COLUMNS: CrmColumn[] = [
  {
    id: "livres-0",
    title: "A fazer contato",
    headerBgColor: "border-slate-500",
    badgeBgColor: "bg-slate-600",
    badgeTextColor: "text-white",
    dotColor: "bg-slate-400",
  },
  {
    id: "livres-1",
    title: "Contato feito",
    headerBgColor: "border-blue-500",
    badgeBgColor: "bg-blue-600",
    badgeTextColor: "text-white",
    dotColor: "bg-blue-400",
  },
  {
    id: "livres-2",
    title: "Follow-up 1",
    headerBgColor: "border-amber-500",
    badgeBgColor: "bg-amber-600",
    badgeTextColor: "text-white",
    dotColor: "bg-amber-400",
  },
  {
    id: "livres-3",
    title: "Follow-up 2",
    headerBgColor: "border-orange-500",
    badgeBgColor: "bg-orange-600",
    badgeTextColor: "text-white",
    dotColor: "bg-orange-400",
  },
  {
    id: "orcados",
    title: "Em Negociação",
    headerBgColor: "border-sky-500",
    badgeBgColor: "bg-sky-600",
    badgeTextColor: "text-white",
  },
  {
    id: "renovacoes",
    title: "Vendas",
    headerBgColor: "border-emerald-500",
    badgeBgColor: "bg-emerald-600",
    badgeTextColor: "text-white",
  },
  {
    id: "livres-4",
    title: "Perda",
    headerBgColor: "border-red-500",
    badgeBgColor: "bg-red-600",
    badgeTextColor: "text-white",
    dotColor: "bg-red-400",
  },
]

// Mapeamento de cor de borda para cada coluna
const COLUMN_BORDER_COLORS: Record<CrmColumnId, string> = {
  livres: "border-slate-400",
  orcados: "border-sky-500",
  renovacoes: "border-emerald-500",
  renovados: "border-indigo-500",
  "livres-0": "border-slate-400",
  "livres-1": "border-blue-400",
  "livres-2": "border-amber-400",
  "livres-3": "border-orange-400",
  "livres-4": "border-red-400",
  "livres-5": "border-slate-400",
}

const KANBAN_STAGES = [
  { code: 0, title: "A fazer contato", dotColor: "bg-slate-400", containerClass: "bg-slate-800/40 text-slate-100" },
  { code: 1, title: "Contato feito", dotColor: "bg-blue-500", containerClass: "bg-blue-800/40 text-blue-100" },
  { code: 2, title: "Follow-up 1", dotColor: "bg-amber-500", containerClass: "bg-amber-800/40 text-amber-100" },
  { code: 3, title: "Follow-up 2", dotColor: "bg-orange-500", containerClass: "bg-orange-800/40 text-orange-100" },
  { code: 4, title: "Perda", dotColor: "bg-red-500", containerClass: "bg-red-800/40 text-red-100" },
]


// Usa a data do último pedido NÃO CANCELADO para determinar se o cliente foi renovado recentemente.
// Isso evita que um pedido cancelado recente faça o cliente aparecer como RENOVADO.
const isClienteRenovado = (client: VendorClientRow): boolean => {
  // Usa ultimoPedidoValidoData (último pedido não cancelado) como referência primária.
  // Fallback para ultimaManutencao se não houver pedido válido.
  const dataReferencia = client.ultimoPedidoValidoData ?? client.ultimaManutencao
  return isClienteRenovadoCheck(dataReferencia)
}

// Distribuição de clientes nas colunas (4 colunas: Livres, Orçados, Renovações, Renovados)
// Regras:
// - Renovados: clientes ATIVOS cujo último pedido tem menos de 2 meses
// - Orçados: clientes com orçamento nos últimos 2 meses (pode duplicar com Renovações)
// - Renovações: clientes ATIVOS (pode duplicar com Orçados se tiver orçamento recente)
// - Clientes Livres: agendados e explorados SEM orçamento recente E SEM dataContatoAgendado
//   (se tem dataContatoAgendado, aparece só na agenda, não na coluna Livres)
const distributeClientsToNewColumns = (
  clientes: VendorClientRow[]
): Record<CrmColumnId, VendorClientRow[]> => {
  const columns: Record<CrmColumnId, VendorClientRow[]> = {
    livres: [],
    orcados: [],
    renovacoes: [],
    renovados: [],
    "livres-0": [],
    "livres-1": [],
    "livres-2": [],
    "livres-3": [],
    "livres-4": [],
    "livres-5": [],
  }

  clientes.forEach((client) => {
    const hasOrcamento = client.hasRecentOrcamento === true
    const hasValidPedidos = (client.totalPedidos ?? 0) > 0
    const isRenovado = client.categoria === "ativo" && hasValidPedidos && isClienteRenovado(client)
    const hasDataAgendado = Boolean(client.dataContatoAgendado)

    // RENOVADOS - clientes ATIVOS cujo último pedido tem menos de 2 meses
    if (isRenovado) {
      columns.renovados.push(client)
      // Renovados não vão para outras colunas
      return
    }

    // ATIVOS vão para Renovações (somente se tem pelo menos 1 pedido não cancelado)
    if (client.categoria === "ativo" && hasValidPedidos) {
      columns.renovacoes.push(client)
      // Se também tem orçamento recente, duplica em Orçados
      if (hasOrcamento) {
        columns.orcados.push(client)
      }
      return
    }

    // LIVRES (explorado ou agendado, ou ativo sem pedidos válidos)
    if (client.categoria === "explorado" || client.categoria === "agendado" || !hasValidPedidos) {
      // Se tem orçamento recente, vai para Orçados
      if (hasOrcamento) {
        columns.orcados.push(client)
      }
      // Se tem dataContatoAgendado, aparece SÓ na agenda (não vai para coluna Livres)
      else if (hasDataAgendado) {
        // Não adiciona em nenhuma coluna - vai aparecer só na agenda
      }
      // Sem orçamento E sem data agendada, vai para Livres
      else {
        columns.livres.push(client)
      }
      return
    }
  })

  return columns
}

// Determina a cor da borda do card baseado na categoria original do cliente
const getCardBorderColor = (client: VendorClientRow, columnId: CrmColumnId): string => {
  // Se o cliente é uma renovação (ATIVO) aparecendo na coluna orçados, usa borda verde
  if (columnId === "orcados" && client.categoria === "ativo") {
    return COLUMN_BORDER_COLORS.renovacoes // borda verde para renovações duplicadas
  }
  // Usa a cor padrão da coluna
  return COLUMN_BORDER_COLORS[columnId]
}

type AgendaItem = VendorClientRow & {
  agendaDate: string
}

type WeekDayInfo = {
  date: Date
  key: string
  label: string
  shortLabel: string
  displayDate: string
  isOutsideMonth: boolean
}

const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]
const WEEKDAY_SHORT_LABELS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"]

const addDays = (value: Date, amount: number) => {
  const result = new Date(value)
  result.setDate(result.getDate() + amount)
  return result
}

const shiftDays = (current: Date, direction: "previous" | "next") => {
  const next = new Date(current)
  next.setDate(next.getDate() + (direction === "next" ? 5 : -5))
  return next
}

const generateFiveDayRange = (startDate: Date): Date[] =>
  Array.from({ length: 5 }, (_, index) => addDays(startDate, index))

const getInitialAgendaDate = () => new Date()

const formatDateKey = (value: Date) => {
  // Usa timezone do Brasil para garantir que a data seja a correta
  const parts = value.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).split("/")
  // pt-BR format is DD/MM/YYYY, we need YYYY-MM-DD
  return `${parts[2]}-${parts[1]}-${parts[0]}`
}

const formatDayWithMonth = (value: Date) =>
  value.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  })

const getOrdersRangeReferenceDate = (range: OrdersRange) => {
  const base = new Date()
  if (range === "previous") {
    base.setMonth(base.getMonth() - 1)
  }
  return new Date(base.getFullYear(), base.getMonth(), 1)
}


export function VendedorDashboard() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const { data: session, status: sessionStatus } = useSession()
  // Apenas dispara fetches depois que a sessão resolveu (evita race condition de impersonation)
  const sessionLoaded = sessionStatus !== "loading"

  // Verifica se é admin visualizando outro vendedor
  const userRole = (session?.user as { role?: string })?.role ?? null
  const isAdmin = userRole && ADMIN_ROLES.includes(userRole as typeof ADMIN_ROLES[number])
  const canUseChatbotOutbound =
    ENABLE_CHATBOT_OUTBOUND_BROADCAST &&
    userRole &&
    CHATBOT_OUTBOUND_BROADCAST_ROLES.includes(
      userRole as typeof CHATBOT_OUTBOUND_BROADCAST_ROLES[number]
    )
  const urlVendedorId = searchParams.get("vendedorId")
  const isImpersonating = isAdmin && !!urlVendedorId

  // Helper para adicionar vendedorId aos params de API se estiver impersonando
  // Depende de isImpersonating e urlVendedorId — ambos estabilizam após a session carregar,
  // então fetchClientes re-roda corretamente ao carregar a sessão (uma única vez)
  const appendVendedorIdToParams = useCallback((params: URLSearchParams) => {
    if (isImpersonating && urlVendedorId) {
      params.set("vendedorId", urlVendedorId)
    }
    return params
  }, [isImpersonating, urlVendedorId])

  // Nome do vendedor sendo visualizado (para exibir no banner)
  const [impersonatedVendorName, setImpersonatedVendorName] = useState<string | null>(null)

  // Carrega nome do vendedor se estiver impersonando
  useEffect(() => {
    if (isImpersonating && urlVendedorId) {
      fetch(`/api/usuarios/${urlVendedorId}`)
        .then(res => res.json())
        .then(result => {
          const user = result.data ?? result
          setImpersonatedVendorName(user.fullname ?? user.name ?? "Vendedor")
        })
        .catch(() => setImpersonatedVendorName("Vendedor"))
    } else {
      setImpersonatedVendorName(null)
    }
  }, [isImpersonating, urlVendedorId])



  const [activeTab, setActiveTab] = useState<TabKey>("leads")
  const [clientes, setClientes] = useState<VendorClientRow[]>([])
  const [summary, setSummary] = useState<SummaryCounts>({ agendados: 0, ativos: 0, explorados: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [orcamentoCliente, setOrcamentoCliente] = useState<{ id: string; nome: string } | null>(null)
  // CRM columns derived from the `clientes` state. This ensures synchronization.
  const crmColumns = useMemo(() => distributeClientsToNewColumns(clientes), [clientes])
  const [agendaReferenceDate, setAgendaReferenceDate] = useState<Date>(() => getInitialAgendaDate())
  const [agendaContacts, setAgendaContacts] = useState<AgendaItem[]>([])
  const [agendaLoading, setAgendaLoading] = useState(true)
  const [agendaError, setAgendaError] = useState<string | null>(null)
  const [atrasosOpen, setAtrasosOpen] = useState(false)
  const [atrasosLoading, setAtrasosLoading] = useState(false)
  const [atrasosClientes, setAtrasosClientes] = useState<VendorClientRow[]>([])
  const today = useMemo(() => new Date(), [])
  const [ordersRange, setOrdersRange] = useState<OrdersRange>("current")
  const [ordersReferenceDate, setOrdersReferenceDate] = useState<Date>(() => getOrdersRangeReferenceDate("current"))
  const [vendorOrders, setVendorOrders] = useState<VendorOrderRow[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<string>("")
  const [currentMonthMetrics, setCurrentMonthMetrics] = useState({ totalValue: 0, budgetsCount: 0 })
  const [currentMetricsLoaded, setCurrentMetricsLoaded] = useState(false)
  const [metricsOpen, setMetricsOpen] = useState(false)

  const [fichasGrouped, setFichasGrouped] = useState<GroupedFichas | null>(null)
  const [fichasLoading, setFichasLoading] = useState(false)
  const [fichasError, setFichasError] = useState<string | null>(null)

  const [showAtrasados, setShowAtrasados] = useState(true)

  const { openChatWithClient } = useChatLauncher()

  // Kanban
  const [kanbanResetDone, setKanbanResetDone] = useState(true)
  const [crmFilterAiOnly, setCrmFilterAiOnly] = useState(false) // filtro de IA no kanban

  const [searchInput, setSearchInput] = useState("")
  const [cnpjInput, setCnpjInput] = useState("")
  const [bairroInput, setBairroInput] = useState("")
  const [estadoSelect, setEstadoSelect] = useState("all")
  const [cidadeSelect, setCidadeSelect] = useState("all")

  const [submittedSearch, setSubmittedSearch] = useState("")
  const [submittedCnpj, setSubmittedCnpj] = useState("")
  const [submittedBairro, setSubmittedBairro] = useState("")
  const [submittedEstado, setSubmittedEstado] = useState("all")
  const [submittedCidade, setSubmittedCidade] = useState("all")

  // Estado para alternar entre visualização Kanban e Abas
  type CrmViewMode = "kanban" | "tabs"
  type ClientsTabKey = "renovacoes" | "agendados" | "livres"
  const [crmViewMode, setCrmViewMode] = useState<CrmViewMode>("kanban")
  const [clientsTabView, setClientsTabView] = useState<ClientsTabKey>("renovacoes")

  // Estado para pesquisa local (filtra clientes já carregados)
  const [localSearchTerm, setLocalSearchTerm] = useState("")
  const [filterContactActive, setFilterContactActive] = useState(false)
  const [filterContactValue, setFilterContactValue] = useState(3)
  const [filterContactUnit, setFilterContactUnit] = useState<'h' | 'd' | 'm'>('m')
  const [filterContactMode, setFilterContactMode] = useState<'com' | 'sem'>('sem')
  const [contactContextMenu, setContactContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [contactCustomInput, setContactCustomInput] = useState("3")
  const [filterOrcamentoMonths, setFilterOrcamentoMonths] = useState<number | null>(null)
  const [filterOrcamentoMode, setFilterOrcamentoMode] = useState<"sem" | "com">("sem")
  const [orcamentoContextMenu, setOrcamentoContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [orcamentoCustomInput, setOrcamentoCustomInput] = useState("4")

  // Filtros especiais (requerem consulta ao backend)
  const [specialFiltersOpen, setSpecialFiltersOpen] = useState(false)
  const [filterIgnoredConversation, setFilterIgnoredConversation] = useState(false)
  const [ignoredFilterMode, setIgnoredFilterMode] = useState<'ignored' | 'active'>('ignored')
  const [ignoredSinceValue, setIgnoredSinceValue] = useState(3)
  const [ignoredSinceUnit, setIgnoredSinceUnit] = useState<'h' | 'd' | 'm'>('m')
  const [ignoredClientIds, setIgnoredClientIds] = useState<Set<number>>(new Set())
  const [activeClientIds, setActiveClientIds] = useState<Set<number>>(new Set())
  const [loadingIgnoredFilter, setLoadingIgnoredFilter] = useState(false)

  // Filtros de atividade: chatbot ativo e follow-up
  const [filterChatbotActive, setFilterChatbotActive] = useState(false)
  const [filterChatbotMode, setFilterChatbotMode] = useState<'with' | 'without'>('with')
  const [filterFollowUpActive, setFilterFollowUpActive] = useState(false)
  const [filterFollowUpMode, setFilterFollowUpMode] = useState<'pending' | 'step'>('pending')
  const [filterFollowUpExclude, setFilterFollowUpExclude] = useState(false)
  const [filterFollowUpStep, setFilterFollowUpStep] = useState(1)
  const [activityClientIds, setActivityClientIds] = useState<Set<number>>(new Set())
  const [loadingActivityFilter, setLoadingActivityFilter] = useState(false)

  // Filtro de erro externo
  const [filterErrorActive, setFilterErrorActive] = useState(false)
  const [filterErrorMode, setFilterErrorMode] = useState<"with" | "without">("with")
  const [selectedExternalError, setSelectedExternalError] = useState<string>("")
  const [availableExternalErrors, setAvailableExternalErrors] = useState<string[]>([])
  const [errorFilteredClientIds, setErrorFilteredClientIds] = useState<Set<number>>(new Set())
  const [loadingErrorFilter, setLoadingErrorFilter] = useState(false)

  // Filtro por Inbox e Template
  const [filterInboxActive, setFilterInboxActive] = useState(false)
  const [filterInboxMode, setFilterInboxMode] = useState<'with' | 'without'>('with')
  const [filterInboxId, setFilterInboxId] = useState('')
  const [availableInboxes, setAvailableInboxes] = useState<Inbox[]>([])

  const [filterTemplateActive, setFilterTemplateActive] = useState(false)
  const [filterTemplateMode, setFilterTemplateMode] = useState<'with' | 'without'>('with')
  const [filterTemplateName, setFilterTemplateName] = useState('')
  const [availableTemplates, setAvailableTemplates] = useState<WhatsAppTemplate[]>([])

  const [inboxTemplateFilteredClientIds, setInboxTemplateFilteredClientIds] = useState<Set<number>>(new Set())
  const [loadingInboxTemplateFilter, setLoadingInboxTemplateFilter] = useState(false)

  // Estado para o diálogo de Perda
  const [perdaDialogOpen, setPerdaDialogOpen] = useState(false)
  const [perdaClientId, setPerdaClientId] = useState<number | null>(null)
  const [perdaClientName, setPerdaClientName] = useState<string>("")
  const [perdaDataManutencao, setPerdaDataManutencao] = useState<string>("")
  const [perdaLoading, setPerdaLoading] = useState(false)

  const [massDispatchOpen, setMassDispatchOpen] = useState(false)
  const [massDispatchLoadingInboxes, setMassDispatchLoadingInboxes] = useState(false)
  const [massDispatchInboxes, setMassDispatchInboxes] = useState<Inbox[]>([])
  const [massDispatchInboxId, setMassDispatchInboxId] = useState("")
  const [massDispatchTemplate, setMassDispatchTemplate] = useState<{
    name: string
    languageCode: string
    components: TemplateComponent[]
  } | null>(null)
  const [massDispatchTemplateOpen, setMassDispatchTemplateOpen] = useState(false)
  const [massDispatchError, setMassDispatchError] = useState<string | null>(null)
  const [massDispatchSending, setMassDispatchSending] = useState(false)
  const [massDispatchMode, setMassDispatchMode] = useState<"template" | "chatbot">("template")
  const [massDispatchChatbotFlows, setMassDispatchChatbotFlows] = useState<ChatbotFlowSummary[]>([])
  const [massDispatchChatbotFlowId, setMassDispatchChatbotFlowId] = useState("")
  const [massDispatchChatbotLoading, setMassDispatchChatbotLoading] = useState(false)
  const [massDispatchChatbotTemplate, setMassDispatchChatbotTemplate] = useState<OutboundTemplatePayload | null>(null)
  const [massDispatchChatbotTemplateOpen, setMassDispatchChatbotTemplateOpen] = useState(false)
  const [massDispatchChatbotTemplateMeta, setMassDispatchChatbotTemplateMeta] = useState<{
    name: string
    languageCode: string
  } | null>(null)
  const [massDispatchTargetKanbanStage, setMassDispatchTargetKanbanStage] = useState<number | null>(null)
  const [massDispatchKeepChatbot, setMassDispatchKeepChatbot] = useState(true)
  const [massDispatchName, setMassDispatchName] = useState("")

  // Estado para bulk assign chatbot
  const [bulkAssignChatbotOpen, setBulkAssignChatbotOpen] = useState(false)
  const [bulkAssignChatbotInboxId, setBulkAssignChatbotInboxId] = useState("")
  const [bulkAssignChatbotFlowId, setBulkAssignChatbotFlowId] = useState("")
  const [bulkAssignChatbotFlows, setBulkAssignChatbotFlows] = useState<ChatbotFlowSummary[]>([])
  const [bulkAssignChatbotInboxes, setBulkAssignChatbotInboxes] = useState<Inbox[]>([])
  const [bulkAssignChatbotLoading, setBulkAssignChatbotLoading] = useState(false)
  const [bulkAssignChatbotError, setBulkAssignChatbotError] = useState<string | null>(null)
  const [bulkAssignChatbotSending, setBulkAssignChatbotSending] = useState(false)


  const fetchChatbotFlows = useCallback(async () => {
    try {
      setMassDispatchChatbotLoading(true)
      // Carrega fluxos ativos do tipo OUTBOUND
      const response = await fetch("/api/chatbot/flows?type=OUTBOUND&active=true")
      if (response.ok) {
        const data = await response.json()
        setMassDispatchChatbotFlows(data.data ?? [])
      }
    } catch (error) {
      console.error("Erro ao carregar fluxos", error)
    } finally {
      setMassDispatchChatbotLoading(false)
    }
  }, [])

  // Carregar fluxos quando abrir o modal de chatbot
  useEffect(() => {
    if (massDispatchOpen && canUseChatbotOutbound && massDispatchMode === 'chatbot') {
      fetchChatbotFlows()
    }
  }, [massDispatchOpen, canUseChatbotOutbound, massDispatchMode, fetchChatbotFlows])

  // Carregar lista de erros únicos para o filtro
  useEffect(() => {
    fetch("/api/chat/messages/unique-errors")
      .then((r) => r.json())
      .then((data) => setAvailableExternalErrors(data.errors || []))
      .catch(console.error)
  }, [])

  // Estado para sincronização de vínculos de chat
  const [syncChatLoading, setSyncChatLoading] = useState(false)
  const [syncChatConfirmOpen, setSyncChatConfirmOpen] = useState(false)
  const [syncChatResultOpen, setSyncChatResultOpen] = useState(false)
  const [syncChatResultData, setSyncChatResultData] = useState<{
    processed: number
    unlinkedCount: number
    unlinkedItems: Array<{
      clientId: number
      razaoSocial: string
      contactName: string | null
      contactWaId: string
    }>
  } | null>(null)

  // Estado para seleção de clientes nas colunas do CRM
  const [selectedClientIds, setSelectedClientIds] = useState<Set<number>>(new Set())

  // Drag-and-drop: usamos ref (sem estado) para evitar re-renders durante o drag
  // Apenas setClientes no onDrop causa re-render (e está correto)
  const draggedClientIdRef = useRef<number | null>(null)

  // Estado para confirmação de movimento em massa
  const [bulkMoveConfirmOpen, setBulkMoveConfirmOpen] = useState(false)
  const [pendingBulkStage, setPendingBulkStage] = useState<typeof KANBAN_STAGES[number] | null>(null)

  // Estado para retorno para pesquisa em massa
  const [returnToResearchConfirmOpen, setReturnToResearchConfirmOpen] = useState(false)
  const [returningToResearch, setReturningToResearch] = useState(false)




  // Inadimplência
  const [inadimplenciaClients, setInadimplenciaClients] = useState<InadimplenciaClient[]>([])
  const [inadimplenciaLoading, setInadimplenciaLoading] = useState(false)
  const [inadimplenciaSummary, setInadimplenciaSummary] = useState<InadimplenciaSummary | null>(null)
  const [inadimplenciaPage, setInadimplenciaPage] = useState(1)
  const [inadimplenciaTotalPages, setInadimplenciaTotalPages] = useState(1)
  const [inadimplenciaOrder, setInadimplenciaOrder] = useState<"asc" | "desc">("asc")

  // Alerta de Agendamentos Vencidos
  const [agendamentosVencidos, setAgendamentosVencidos] = useState<VendorClientRow[]>([])

  useEffect(() => {
    const checkVencidos = () => {
      const now = new Date()
      // Filtra clientes com dataContatoAgendado definida e passada
      const list = clientes.filter(c => {
        if (!c.dataContatoAgendado) return false
        const dt = new Date(c.dataContatoAgendado)
        // Considera vencido se a data É MENOR OU IGUAL a agora (já passou o momento)
        return dt <= now
      })

      // Ordena: os mais atrasados (data menor) primeiro
      list.sort((a, b) => new Date(a.dataContatoAgendado!).getTime() - new Date(b.dataContatoAgendado!).getTime())

      // Verifica se houve mudança real para evitar re-renders desnecessários se o conteúdo for igual
      setAgendamentosVencidos(prev => {
        if (prev.length !== list.length) return list
        // Checa se os IDs são os mesmos na mesma ordem
        const isSame = prev.every((p, i) => p.id === list[i].id)
        return isSame ? prev : list
      })
    }

    checkVencidos()
    const interval = setInterval(checkVencidos, 60000) // 1 minuto

    return () => clearInterval(interval)
  }, [clientes])

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

  // Função para filtrar clientes localmente (por nome, cnpj, endereço, bairro, telefones)
  const filterClientLocally = useCallback((client: VendorClientRow, term: string): boolean => {
    if (!term.trim()) return true
    const searchLower = term.toLowerCase().trim()
    const fieldsToSearch = [
      client.razaoSocial,
      client.cnpj,
      client.bairro,
      client.cidade,
      client.estado,
      client.nomeSindico,
      client.telefoneSindico,
      client.telefoneCondominio,
      client.celularCondominio,
      client.telefonePorteiro,
    ]
    return fieldsToSearch.some(field =>
      field?.toLowerCase().includes(searchLower)
    )
  }, [])

  // IMPORTANTE: estabilizar a referência do array de IDs.
  // Se apenas kanbanCode muda (drag-drop) mas os IDs são os mesmos,
  // não queremos recriar o array — isso causaria um loop:
  // setClientes → allClientIds novo → normalizedClientIds novo → preloadSummaries novo → useEffect → fetch → setSummaryMap → re-render
  const allClientIdsRaw = useMemo(() => clientes.map((c) => c.id), [clientes])
  const allClientIdsRef = useRef<number[]>([])
  const allClientIds = useMemo(() => {
    const prev = allClientIdsRef.current
    // Só troca referência se algum ID mudou
    if (prev.length === allClientIdsRaw.length && prev.every((id, i) => id === allClientIdsRaw[i])) {
      return prev
    }
    allClientIdsRef.current = allClientIdsRaw
    return allClientIdsRaw
  }, [allClientIdsRaw])

  const { summariesByClientId: clientChatSummaries, refresh: refreshChatSummaries } = useVendorChatRealtime(allClientIds)

  // chatSummariesRef: permite ler summaries dentro de callbacks/memos sem colocar nas deps
  // (evita recompute do board inteiro em cada mensagem WebSocket)
  const chatSummariesRef = useRef(clientChatSummaries)
  useEffect(() => { chatSummariesRef.current = clientChatSummaries }, [clientChatSummaries])

  // Clientes filtrados localmente
  const handleBulkReturnToResearch = async () => {
    if (selectedClientIds.size === 0) return

    setReturningToResearch(true)
    try {
      const clientIdsArray = Array.from(selectedClientIds)
      const response = await fetch("/api/vendedor/clients/bulk-retornar-pesquisa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientIds: clientIdsArray }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Erro ao processar retorno para pesquisa")
      }

      toast({
        title: "Sucesso",
        description: `${result.data.success} clientes retornados para pesquisa com sucesso.`,
      })

      if (result.data.errors.length > 0) {
        console.warn("Erros no bulk research:", result.data.errors)
        toast({
          variant: "destructive",
          title: "Alguns clientes não puderam ser processados",
          description: `${result.data.errors.length} clientes falharam.`,
        })
      }

      // Reset selection and refresh
      setSelectedClientIds(new Set())
      await fetchClientes(true)
      setReturnToResearchConfirmOpen(false)
    } catch (err) {
      console.error("Erro no bulk research handle:", err)
      toast({
        variant: "destructive",
        title: "Erro ao processar retorno",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      })
    } finally {
      setReturningToResearch(false)
    }
  }

  const contactCutoff = useMemo(() => {
    if (!filterContactActive) return null
    const date = new Date()
    const val = Number(filterContactValue) || 0
    if (filterContactUnit === 'h') date.setHours(date.getHours() - val)
    else if (filterContactUnit === 'd') date.setDate(date.getDate() - val)
    else date.setMonth(date.getMonth() - val)
    return date
  }, [filterContactActive, filterContactValue, filterContactUnit])

  const shouldIncludeByRecentContact = useCallback((client: VendorClientRow) => {
    if (!filterContactActive || !contactCutoff) return true
    // Lê do ref para não incluir clientChatSummaries nas deps (causaria recompute em cada msg)
    const summary = chatSummariesRef.current[client.id]
    const lastActivity = summary?.lastMessageAt ? new Date(summary.lastMessageAt) : null

    // Condição: Teve qualquer contato (nossa msg ou do cliente) no período?
    const hasRecentContact = !!lastActivity && lastActivity >= contactCutoff

    if (filterContactMode === 'com') {
      return hasRecentContact // COM contato no período
    } else {
      return !hasRecentContact // SEM contato no período
    }
  // chatSummariesRef.current é lido via ref, sem estar nas deps
  }, [filterContactActive, contactCutoff, filterContactMode])

  const orcamentoCutoff = useMemo(() => {
    if (filterOrcamentoMonths === null) return null
    const d = new Date()
    d.setMonth(d.getMonth() - filterOrcamentoMonths)
    return d
  }, [filterOrcamentoMonths])

  const shouldIncludeByOrcamentoFilter = useCallback((client: VendorClientRow) => {
    if (!orcamentoCutoff) return true
    const lastDate = client.lastOrcamentoAt ? new Date(client.lastOrcamentoAt) : null
    if (filterOrcamentoMode === "sem") {
      return !lastDate || lastDate < orcamentoCutoff
    }
    return !!lastDate && lastDate >= orcamentoCutoff
  }, [orcamentoCutoff, filterOrcamentoMode])

  // Converte valor+unidade para ms
  const ignoredSinceMs = useMemo(() => {
    if (ignoredSinceUnit === 'h') return ignoredSinceValue * 60 * 60 * 1000
    if (ignoredSinceUnit === 'd') return ignoredSinceValue * 24 * 60 * 60 * 1000
    return ignoredSinceValue * 30 * 24 * 60 * 60 * 1000
  }, [ignoredSinceValue, ignoredSinceUnit])

  // Buscar IDs quando o filtro for ativado ou o período mudar
  useEffect(() => {
    if (!filterIgnoredConversation || allClientIds.length === 0) {
      setIgnoredClientIds(new Set())
      setActiveClientIds(new Set())
      return
    }
    let cancelled = false
    setLoadingIgnoredFilter(true)
    fetch("/api/chat/conversations/ignored-clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientIds: allClientIds, sinceMs: ignoredSinceMs }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setIgnoredClientIds(new Set(Array.isArray(data?.ignoredClientIds) ? data.ignoredClientIds : []))
        setActiveClientIds(new Set(Array.isArray(data?.activeClientIds) ? data.activeClientIds : []))
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoadingIgnoredFilter(false) })
    return () => { cancelled = true }
  }, [filterIgnoredConversation, allClientIds, ignoredSinceMs])

  // Buscar IDs filtrados por atividade (chatbot ativo / follow-up)
  const activityFilterEnabled = filterChatbotActive || filterFollowUpActive
  useEffect(() => {
    if (!activityFilterEnabled || allClientIds.length === 0) {
      setActivityClientIds(new Set())
      return
    }
    let cancelled = false
    setLoadingActivityFilter(true)
    fetch("/api/chat/conversations/activity-filter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientIds: allClientIds,
        chatbotActive: filterChatbotActive ? (filterChatbotMode === 'with') : undefined,
        followUpPending: (filterFollowUpActive && filterFollowUpMode === 'pending') ? !filterFollowUpExclude : undefined,
        followUpStep: (filterFollowUpActive && filterFollowUpMode === 'step') ? filterFollowUpStep : undefined,
        followUpStepExclude: (filterFollowUpActive && filterFollowUpMode === 'step') ? filterFollowUpExclude : undefined,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        setActivityClientIds(new Set(Array.isArray(data?.matchingClientIds) ? data.matchingClientIds : []))
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoadingActivityFilter(false) })
    return () => { cancelled = true }
  }, [
    activityFilterEnabled,
    allClientIds,
    filterChatbotActive,
    filterChatbotMode,
    filterFollowUpActive,
    filterFollowUpMode,
    filterFollowUpStep,
    filterFollowUpExclude
  ])

  // Buscar IDs filtrados por erro externo
  useEffect(() => {
    if (!filterErrorActive || allClientIds.length === 0) {
      setErrorFilteredClientIds(new Set())
      return
    }
    let cancelled = false
    setLoadingErrorFilter(true)
    fetch("/api/chat/conversations/error-filter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientIds: allClientIds,
        errorValue: selectedExternalError,
        mode: filterErrorMode === "with" ? "com" : "sem",
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setErrorFilteredClientIds(new Set(Array.isArray(data?.matchingClientIds) ? data.matchingClientIds : []))
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoadingErrorFilter(false)
      })
    return () => {
      cancelled = true
    }
  }, [filterErrorActive, selectedExternalError, filterErrorMode, allClientIds])

  // Buscar lista de inboxes
  useEffect(() => {
    chatAPI.listInboxes()
      .then(setAvailableInboxes)
      .catch(console.error)
  }, [])

  // Buscar lista de templates quando inboxId mudar
  useEffect(() => {
    if (!filterInboxId) {
      setAvailableTemplates([]);
      setFilterTemplateActive(false);
      setFilterTemplateName('');
      return;
    }
    chatAPI.listTemplates(filterInboxId)
      .then(res => setAvailableTemplates(res.templates || []))
      .catch((err) => {
        console.error("Erro ao carregar templates para filtro", err);
        setAvailableTemplates([]);
      });
  }, [filterInboxId])

  // Buscar IDs filtrados por Inbox e Template
  const inboxTemplateFilterEnabled = filterInboxActive || filterTemplateActive
  useEffect(() => {
    if (!inboxTemplateFilterEnabled || allClientIds.length === 0) {
      setInboxTemplateFilteredClientIds(new Set())
      return
    }
    let cancelled = false
    setLoadingInboxTemplateFilter(true)
    fetch("/api/chat/conversations/inbox-template-filter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientIds: allClientIds,
        inboxId: filterInboxActive ? filterInboxId : undefined,
        inboxMode: filterInboxActive ? (filterInboxMode === 'with' ? 'com' : 'sem') : undefined,
        templateName: filterTemplateActive ? filterTemplateName : undefined,
        templateMode: filterTemplateActive ? (filterTemplateMode === 'with' ? 'com' : 'sem') : undefined,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setInboxTemplateFilteredClientIds(new Set(Array.isArray(data?.matchingClientIds) ? data.matchingClientIds : []))
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoadingInboxTemplateFilter(false)
      })
    return () => {
      cancelled = true
    }
  }, [
    inboxTemplateFilterEnabled,
    filterInboxActive,
    filterInboxId,
    filterInboxMode,
    filterTemplateActive,
    filterTemplateName,
    filterTemplateMode,
    allClientIds
  ])

  const shouldIncludeBySpecialFilter = useCallback((client: VendorClientRow) => {
    // Filtro ignorados/ativos por período
    if (filterIgnoredConversation) {
      if (ignoredFilterMode === 'active') {
        if (!activeClientIds.has(client.id)) return false
      } else {
        if (!ignoredClientIds.has(client.id)) return false
      }
    }
    // Filtro de atividade (chatbot + follow-up)
    if (activityFilterEnabled) {
      if (!activityClientIds.has(client.id)) return false
    }
    // Filtro de erro externo
    if (filterErrorActive) {
      if (!errorFilteredClientIds.has(client.id)) return false
    }
    // Filtro de Inbox/Template
    if (inboxTemplateFilterEnabled) {
      if (!inboxTemplateFilteredClientIds.has(client.id)) return false
    }
    return true
  }, [
    filterIgnoredConversation,
    ignoredFilterMode,
    ignoredClientIds,
    activeClientIds,
    activityFilterEnabled,
    activityClientIds,
    filterErrorActive,
    selectedExternalError,
    errorFilteredClientIds,
    inboxTemplateFilterEnabled,
    inboxTemplateFilteredClientIds,
  ])

  const filteredClientes = useMemo(() => {
    const base = localSearchTerm.trim()
      ? clientes.filter(client => filterClientLocally(client, localSearchTerm))
      : clientes
    return base
      .filter(shouldIncludeByRecentContact)
      .filter(shouldIncludeByOrcamentoFilter)
      .filter(shouldIncludeBySpecialFilter)
  }, [clientes, localSearchTerm, filterClientLocally, shouldIncludeByRecentContact, shouldIncludeByOrcamentoFilter, shouldIncludeBySpecialFilter])

  // CRM columns filtradas localmente
  const filteredCrmColumns = useMemo(() => {
    const applyFilters = (clients: VendorClientRow[]) => {
      const base = localSearchTerm.trim()
        ? clients.filter(c => filterClientLocally(c, localSearchTerm))
        : clients
      return base
        .filter(shouldIncludeByRecentContact)
        .filter(shouldIncludeByOrcamentoFilter)
        .filter(shouldIncludeBySpecialFilter)
    }

    const livresFiltered = applyFilters(crmColumns.livres)

    return {
      livres: livresFiltered,
      orcados: applyFilters(crmColumns.orcados),
      renovacoes: applyFilters(crmColumns.renovacoes),
      renovados: applyFilters(crmColumns.renovados),
      "livres-0": livresFiltered.filter(c => (c.kanbanCode ?? 0) === 0),
      "livres-1": livresFiltered.filter(c => (c.kanbanCode ?? 0) === 1),
      "livres-2": livresFiltered.filter(c => (c.kanbanCode ?? 0) === 2),
      "livres-3": livresFiltered.filter(c => (c.kanbanCode ?? 0) === 3),
      "livres-4": livresFiltered.filter(c => (c.kanbanCode ?? 0) === 4),
      "livres-5": [],
    } as Record<CrmColumnId, VendorClientRow[]>
  }, [crmColumns, localSearchTerm, filterClientLocally, shouldIncludeByRecentContact, shouldIncludeByOrcamentoFilter, shouldIncludeBySpecialFilter])


  // Ordenar colunas livres e orcados: clientes com notificação primeiro, ordenados por lastActivityAt desc
  // (chatSummariesRef já definido mais acima, após clientChatSummaries)

  const sortedCrmColumns = useMemo(() => {
    const sortByNotification = (clients: VendorClientRow[]) => {
      const summaries = chatSummariesRef.current  // lê do ref, sem dep no state
      return [...clients].sort((a, b) => {
        const summaryA = summaries[a.id];
        const summaryB = summaries[b.id];

        const hasNotifA = summaryA?.status === "open" && !!summaryA?.waitingSince;
        const hasNotifB = summaryB?.status === "open" && !!summaryB?.waitingSince;

        if (hasNotifA && !hasNotifB) return -1;
        if (!hasNotifA && hasNotifB) return 1;

        if (hasNotifA && hasNotifB) {
          const timeA = summaryA?.lastActivityAt ? new Date(summaryA.lastActivityAt).getTime() : 0;
          const timeB = summaryB?.lastActivityAt ? new Date(summaryB.lastActivityAt).getTime() : 0;
          return timeB - timeA;
        }

        return 0;
      });
    };

    const livresSorted = sortByNotification(filteredCrmColumns.livres);

    return {
      livres: livresSorted,
      orcados: sortByNotification(filteredCrmColumns.orcados),
      renovacoes: filteredCrmColumns.renovacoes,
      renovados: filteredCrmColumns.renovados,
      "livres-0": sortByNotification(filteredCrmColumns["livres-0"]),
      "livres-1": sortByNotification(filteredCrmColumns["livres-1"]),
      "livres-2": sortByNotification(filteredCrmColumns["livres-2"]),
      "livres-3": sortByNotification(filteredCrmColumns["livres-3"]),
      "livres-4": sortByNotification(filteredCrmColumns["livres-4"]),
      "livres-5": [],
    } as Record<CrmColumnId, VendorClientRow[]>;
  // NÃO depende de clientChatSummaries — usa ref. Só recalcula quando clientes mudam.
  }, [filteredCrmColumns]);

  useEffect(() => {
    setSelectedClientIds(new Set());
  }, [
    localSearchTerm,
    submittedSearch,
    submittedCnpj,
    submittedBairro,
    submittedEstado,
    submittedCidade,
    filterContactActive,
    filterContactValue,
    filterContactUnit,
    filterContactMode,
    filterOrcamentoMonths,
    filterOrcamentoMode,
    filterIgnoredConversation,
    filterChatbotActive,
    filterChatbotMode,
    filterFollowUpActive,
    filterFollowUpMode,
    filterFollowUpStep,
    filterFollowUpExclude,
    filterErrorActive,
    filterErrorMode,
    selectedExternalError,
  ]);


  // Funções de seleção de clientes
  const toggleClientSelection = useCallback((clientId: number) => {
    setSelectedClientIds((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  }, []);

  const getClientsForColumn = useCallback((columnId: CrmColumnId): VendorClientRow[] => {
    return sortedCrmColumns[columnId] ?? [];
  }, [sortedCrmColumns]);

  const selectAllInColumn = useCallback((columnId: CrmColumnId) => {
    const columnClients = getClientsForColumn(columnId);
    setSelectedClientIds((prev) => {
      const next = new Set(prev);
      columnClients.forEach((client) => next.add(client.id));
      return next;
    });
  }, [getClientsForColumn]);

  const deselectAllInColumn = useCallback((columnId: CrmColumnId) => {
    const columnClients = getClientsForColumn(columnId);
    const columnIds = new Set(columnClients.map((c) => c.id));
    setSelectedClientIds((prev) => {
      const next = new Set(prev);
      columnIds.forEach((id) => next.delete(id));
      return next;
    });
  }, [getClientsForColumn]);

  const isAllSelectedInColumn = useCallback((columnId: CrmColumnId) => {
    const columnClients = getClientsForColumn(columnId);
    if (columnClients.length === 0) return false;
    return columnClients.every((client) => selectedClientIds.has(client.id));
  }, [getClientsForColumn, selectedClientIds]);

  const isSomeSelectedInColumn = useCallback((columnId: CrmColumnId) => {
    const columnClients = getClientsForColumn(columnId);
    return columnClients.some((client) => selectedClientIds.has(client.id));
  }, [getClientsForColumn, selectedClientIds]);

  // IDs literais dos clientes selecionados (array)
  const selectedClientIdsArray = useMemo(() => Array.from(selectedClientIds), [selectedClientIds]);
  const totalSelecionados = selectedClientIdsArray.length;

  // Função para resetar seleção (mantém filtros)
  const resetSelection = useCallback(() => {
    setSelectedClientIds(new Set());
  }, []);

  const selectedEstadoInfo =
    estadoSelect === "all" ? null : estadoOptions.find((estado) => estado.sigla === estadoSelect) ?? null
  const cidadeOptions = selectedEstadoInfo?.cidades ?? []

  const activeFilters = useMemo(() => {
    const filters: Record<string, string> = {}
    if (submittedSearch.trim()) filters.search = submittedSearch.trim()
    if (submittedCnpj.trim()) filters.cnpj = submittedCnpj.trim()
    if (submittedBairro.trim()) filters.bairro = submittedBairro.trim()
    if (submittedEstado !== "all") filters.estado = submittedEstado
    if (submittedCidade !== "all") filters.cidade = submittedCidade
    return filters
  }, [submittedSearch, submittedCnpj, submittedBairro, submittedEstado, submittedCidade])

  // activeFiltersRef: leitura estável dos filtros dentro de callbacks
  // sem precisar colocar o objeto activeFilters nas deps (objeto muda referência a cada render)
  const activeFiltersRef = useRef(activeFilters)
  useEffect(() => { activeFiltersRef.current = activeFilters }, [activeFilters])

  const filtersKey = useMemo(() => JSON.stringify(activeFilters), [activeFilters])

  const agendaMonth = agendaReferenceDate.getMonth() + 1
  const agendaYear = agendaReferenceDate.getFullYear()
  const ordersMonth = ordersReferenceDate.getMonth() + 1
  const ordersYear = ordersReferenceDate.getFullYear()
  const currentMonthNumber = today.getMonth() + 1
  const currentYearNumber = today.getFullYear()
  const currentMonthLabel = useMemo(
    () =>
      today.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      }),
    [today],
  )

  const weekDays = useMemo<WeekDayInfo[]>(() => {
    const referenceMonth = agendaReferenceDate.getMonth()
    return generateFiveDayRange(agendaReferenceDate).map((current) => {
      const dayIndex = current.getDay()
      return {
        date: current,
        key: formatDateKey(current),
        label: WEEKDAY_LABELS[dayIndex],
        shortLabel: WEEKDAY_SHORT_LABELS[dayIndex],
        displayDate: formatDayWithMonth(current),
        isOutsideMonth: current.getMonth() !== referenceMonth,
      }
    })
  }, [agendaReferenceDate])

  const agendaWeekRangeLabel = useMemo(() => {
    if (!weekDays.length) return ""
    const firstDay = weekDays[0]
    const lastDay = weekDays[weekDays.length - 1]
    return `${firstDay.displayDate} — ${lastDay.displayDate}`
  }, [weekDays])

  const agendaMonthLabel = useMemo(
    () =>
      agendaReferenceDate.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      }),
    [agendaReferenceDate],
  )

  const ordersMonthLabel = useMemo(
    () =>
      ordersReferenceDate.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      }),
    [ordersReferenceDate],
  )

  const ordersSummary = useMemo(() => {
    const ativos = vendorOrders.filter((order) => order.status !== "CANCELADO")
    const totalValue = ativos.reduce((sum, order) => sum + order.valorTotal, 0)
    return {
      total: ativos.length,
      totalValue,
      cancelados: vendorOrders.length - ativos.length,
    }
  }, [vendorOrders])

  const renovacoesPendentesTotal = useMemo(() => {
    return crmColumns.renovacoes.reduce((sum, client) => {
      return sum + (client.ultimoPedidoValor ?? 0)
    }, 0)
  }, [crmColumns.renovacoes])

  const agendaItemsByDay = useMemo(() => {
    const grouped = weekDays.reduce(
      (acc, day) => {
        acc[day.key] = []
        return acc
      },
      {} as Record<string, AgendaItem[]>,
    )

    // Filtra pela busca local se houver texto digitado
    const filteredContacts = localSearchTerm.trim()
      ? agendaContacts.filter(item => filterClientLocally(item, localSearchTerm))
      : agendaContacts

    filteredContacts.forEach((item) => {
      if (!item.agendaDate) return
      const agendaDate = new Date(item.agendaDate)
      if (Number.isNaN(agendaDate.getTime())) return
      const key = formatDateKey(agendaDate)
      if (!grouped[key]) return
      grouped[key].push(item)
    })

    Object.values(grouped).forEach((items) => {
      items.sort(
        (a, b) => new Date(a.agendaDate).getTime() - new Date(b.agendaDate).getTime(),
      )
    })

    return grouped
  }, [agendaContacts, weekDays, localSearchTerm, filterClientLocally])

  // Estado para contagem real de atrasos (todos os passados)
  const [atrasosCount, setAtrasosCount] = useState(0)

  // Buscar contagem real de todos os atrasos (independente do mês da agenda)
  const fetchAtrasosCount = useCallback(async () => {
    try {
      // Buscar TODOS os clientes com dataContatoAgendado (sem filtro de mês)
      const params = new URLSearchParams()
      params.set("tab", "agenda_all")
      // Não passa month/year para buscar TODOS
      appendVendedorIdToParams(params)
      const response = await fetch(`/api/vendedor/clients?${params.toString()}`)
      if (!response.ok) return

      const result = await response.json()
      const allScheduled: VendorClientRow[] = result.data ?? []

      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const overdueCount = allScheduled.filter((client) => {
        if (!client.dataContatoAgendado) return false
        const contactDate = new Date(client.dataContatoAgendado)
        return contactDate < todayStart
      }).length

      setAtrasosCount(overdueCount)
    } catch (err) {
      console.error("Erro ao buscar contagem de atrasos:", err)
    }
  }, [appendVendedorIdToParams])

  // Function to open the atrasos popup and re-fetch to confirm
  // Busca TODOS os clientes com dataContatoAgendado (independente da categoria)
  const handleOpenAtrasos = useCallback(async () => {
    setAtrasosOpen(true)
    setAtrasosLoading(true)

    try {
      // Re-fetch usando agenda_all para buscar TODOS os clientes com dataContatoAgendado
      const params = new URLSearchParams()
      params.set("tab", "agenda_all")
      // Fetch all months (no specific month filter) to get ALL overdue clients
      appendVendedorIdToParams(params)
      const response = await fetch(`/api/vendedor/clients?${params.toString()}`)
      if (!response.ok) {
        throw new Error("Erro ao verificar atrasos")
      }
      const result = await response.json()
      const allScheduled: VendorClientRow[] = result.data ?? []

      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const overdueClients = allScheduled.filter((client) => {
        if (!client.dataContatoAgendado) return false
        const contactDate = new Date(client.dataContatoAgendado)
        return contactDate < todayStart
      })

      setAtrasosClientes(overdueClients)
    } catch (err) {
      console.error(err)
      setAtrasosClientes([])
    } finally {
      setAtrasosLoading(false)
    }
  }, [appendVendedorIdToParams])

  const fetchClientes = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const categories: Array<"agendados" | "ativos" | "explorados"> = ["agendados", "ativos", "explorados"]
      const currentFilters = activeFiltersRef.current  // leitura estável, sem dep no objeto

      const responses = await Promise.all(
        categories.map(async (tab) => {
          const params = new URLSearchParams()
          params.set("tab", tab)
          Object.entries(currentFilters).forEach(([key, value]) => {
            if (value) params.set(key, value)
          })
          appendVendedorIdToParams(params)

          const response = await fetch(`/api/vendedor/clients?${params.toString()}`)
          if (!response.ok) {
            throw new Error(`Erro ao buscar clientes (${tab}).`)
          }
          return response.json()
        }),
      )

      const combinedClients = responses
        .flatMap((result) => result.data ?? [])
        .map((client) => ({
          ...client,
          kanbanCode: typeof client.kanbanCode === "number" ? client.kanbanCode : null,
          kanbanPosition: typeof client.kanbanPosition === "number" ? client.kanbanPosition : null,
          hasRecentOrcamento: client.hasRecentOrcamento === true,
        }))
      setClientes(combinedClients)
      const summaryData = responses[0]?.summary ?? {}
      setSummary({
        agendados: summaryData.agendados ?? 0,
        ativos: summaryData.ativos ?? 0,
        explorados: summaryData.explorados ?? 0,
      })
    } catch (err) {
      console.error(err)
      setClientes([])
      setError("Não foi possível carregar os clientes.")
    } finally {
      setLoading(false)
    }
  // filtersKey (string estável) no lugar de activeFilters (objeto instável)
  }, [filtersKey, appendVendedorIdToParams])

  const handleUpdateKanbanState = useCallback(async (clientIdOrIds: number | number[], code: number) => {
    const ids = Array.isArray(clientIdOrIds) ? clientIdOrIds : [clientIdOrIds]
    const idsSet = new Set(ids)

    // Salva o estado atual para possível rollback
    setClientes(currentClientes => {
      return currentClientes.map(c =>
        idsSet.has(c.id) ? { ...c, kanbanCode: code } : c
      )
    })

    try {
      const params = new URLSearchParams()
      appendVendedorIdToParams(params)

      const body = Array.isArray(clientIdOrIds)
        ? { clientIds: clientIdOrIds, code }
        : { clientId: clientIdOrIds, code }

      const response = await fetch(`/api/vendedor/kanban/update?${params.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) throw new Error("Erro ao atualizar kanban")

      if (Array.isArray(clientIdOrIds)) {
        toast({
          title: "Sucesso",
          description: `${ids.length} clientes movidos com sucesso.`,
        })
        resetSelection()
      }
    } catch (err) {
      console.error(err)
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o estado do kanban. Recarregando...",
        variant: "destructive",
      })
      fetchClientes().catch(console.error)
    }
  }, [appendVendedorIdToParams, toast, fetchClientes, resetSelection])

  const handleBulkSyncChatContacts = useCallback(async (clientIds: number[]) => {
    if (clientIds.length === 0) return

    setSyncChatLoading(true)
    try {
      const response = await fetch("/api/vendedor/clients/sync-chat-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientIds }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Erro ao sincronizar vínculos.")
      }

      // Atualiza os dados do dashboard imediatamente para refletir a mudança
      await fetchClientes()
      await refreshChatSummaries()

      // Mostra o resultado detalhado
      setSyncChatResultData(result.data)
      setSyncChatResultOpen(true)

      resetSelection()
    } catch (error) {
      toast({
        title: "Erro na sincronização",
        description: error instanceof Error ? error.message : "Erro interno.",
        variant: "destructive",
      })
    } finally {
      setSyncChatLoading(false)
    }
  }, [resetSelection, toast, fetchClientes, refreshChatSummaries])

  const fetchAllClientsForAgendaTab = useCallback(
    async (tab: "agendados" | "agenda_all", month: number, year: number): Promise<VendorClientRow[]> => {
      const params = new URLSearchParams()
      params.set("tab", tab)
      params.set("month", month.toString())
      params.set("year", year.toString())
      Object.entries(activeFiltersRef.current).forEach(([key, value]) => {
        if (value) params.set(key, value)
      })
      appendVendedorIdToParams(params)

      const response = await fetch(`/api/vendedor/clients?${params.toString()}`)
      if (!response.ok) {
        throw new Error(`Erro ao carregar ${tab}`)
      }
      const result = await response.json()
      return (result.data ?? []) as VendorClientRow[]
    },
    // filtersKey (string estável) em vez de activeFilters (objeto instável)
    [filtersKey, appendVendedorIdToParams],
  )

  const fetchAgendaData = useCallback(
    async (month: number, year: number) => {
      setAgendaLoading(true)
      setAgendaError(null)
      try {
        // Calculate the end of the 5-day range to check if we need to fetch 2 months
        const startDate = new Date(year, month - 1, agendaReferenceDate.getDate())
        const endDate = addDays(startDate, 4) // 5 days total

        const endMonth = endDate.getMonth() + 1
        const endYear = endDate.getFullYear()

        // Fetch the primary month - usa "agenda_all" para buscar TODOS os clients com dataContatoAgendado
        // (independente da categoria, não apenas os de categoria "agendado")
        const primaryClients = await fetchAllClientsForAgendaTab("agenda_all", month, year)

        // If the range spans into a different month, fetch that month too
        let allClients = primaryClients
        if (endMonth !== month || endYear !== year) {
          const secondaryClients = await fetchAllClientsForAgendaTab("agenda_all", endMonth, endYear)
          // Merge and deduplicate by id
          const clientIds = new Set(primaryClients.map(c => c.id))
          const uniqueSecondary = secondaryClients.filter(c => !clientIds.has(c.id))
          allClients = [...primaryClients, ...uniqueSecondary]
        }

        // Filtrar clientes para a agenda:
        // - TODOS os clientes com dataContatoAgendado aparecem na agenda
        // - Clientes livres (explorado/agendado SEM orçamento) aparecem SÓ aqui (não no Kanban)
        // - O resto (ativos, orçados) pode duplicar (agenda + Kanban)
        const scheduledItems: AgendaItem[] = allClients
          .filter((client) => !!client.dataContatoAgendado)
          .map((client) => ({
            ...client,
            agendaDate: client.dataContatoAgendado as string,
          }))

        setAgendaContacts(scheduledItems)
      } catch (agendaFetchError) {
        console.error(agendaFetchError)
        setAgendaContacts([])
        setAgendaError("Não foi possível carregar a agenda.")
      } finally {
        setAgendaLoading(false)
      }
    },
    [fetchAllClientsForAgendaTab, agendaReferenceDate],
  )

  // When closing the atrasos popup, refresh data to update the count
  const handleAtrasosOpenChange = useCallback(
    (open: boolean) => {
      setAtrasosOpen(open)
      if (!open) {
        // Re-fetch agenda and atrasos count
        fetchAgendaData(agendaMonth, agendaYear).catch((error) => console.error(error))
        fetchAtrasosCount().catch((error) => console.error(error))
      }
    },
    [fetchAgendaData, agendaMonth, agendaYear, fetchAtrasosCount],
  )

  const fetchVendorOrders = useCallback(
    async (month: number, year: number) => {
      setOrdersLoading(true)
      setOrdersError(null)
      try {
        const params = new URLSearchParams()
        params.set("month", month.toString())
        params.set("year", year.toString())
        appendVendedorIdToParams(params)

        const response = await fetch(`/api/vendedor/orders?${params.toString()}`)
        if (!response.ok) {
          throw new Error("Erro ao carregar pedidos do vendedor.")
        }
        const result = await response.json()
        const data: VendorOrderRow[] = Array.isArray(result.data) ? result.data : []
        setVendorOrders(data)

        const totalValue =
          typeof result.totalValue === "number"
            ? result.totalValue
            : data.reduce((sum, order) => sum + order.valorTotal, 0)
        const budgetsCount =
          typeof result.budgetsCount === "number" ? result.budgetsCount : 0

        if (month === currentMonthNumber && year === currentYearNumber) {
          setCurrentMonthMetrics({ totalValue, budgetsCount })
          setCurrentMetricsLoaded(true)
        }
      } catch (ordersError) {
        console.error(ordersError)
        setVendorOrders([])
        setOrdersError("Não foi possível carregar os pedidos deste mês.")
      } finally {
        setOrdersLoading(false)
      }
    },
    [currentMonthNumber, currentYearNumber, appendVendedorIdToParams],
  )

  const fetchInadimplencia = useCallback(async () => {
    setInadimplenciaLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("order", inadimplenciaOrder)
      params.set("clientPage", String(inadimplenciaPage))
      appendVendedorIdToParams(params)

      const response = await fetch(`/api/vendedor/inadimplencia?${params.toString()}`)
      if (!response.ok) throw new Error("Erro ao carregar inadimplência")

      const payload = await response.json()
      setInadimplenciaClients(payload.clients ?? [])
      setInadimplenciaSummary(payload.summary ?? null)
      setInadimplenciaTotalPages(payload.pagination?.totalPages ?? 1)
    } catch (err) {
      console.error(err)
      toast({
        title: "Erro ao carregar inadimplência",
        description: "Não foi possível buscar seus débitos vencidos.",
        variant: "destructive",
      })
    } finally {
      setInadimplenciaLoading(false)
    }
  }, [inadimplenciaOrder, inadimplenciaPage, appendVendedorIdToParams, toast])

  useEffect(() => {
    if (!sessionLoaded) return
    if (activeTab !== "leads" || !kanbanResetDone) return
    fetchClientes().catch((error) => console.error(error))
  }, [sessionLoaded, activeTab, fetchClientes, kanbanResetDone])

  useEffect(() => {
    if (!sessionLoaded) return
    fetchAgendaData(agendaMonth, agendaYear).catch((error) => console.error(error))
  }, [sessionLoaded, agendaMonth, agendaYear, fetchAgendaData])



  // Buscar contagem de atrasos ao carregar e quando a tab de leads estiver ativa
  useEffect(() => {
    if (!sessionLoaded) return
    if (activeTab !== "leads") return
    fetchAtrasosCount().catch((error) => console.error(error))
  }, [sessionLoaded, activeTab, fetchAtrasosCount])

  useEffect(() => {
    fetchVendorOrders(ordersMonth, ordersYear).catch((error) => console.error(error))
  }, [fetchVendorOrders, ordersMonth, ordersYear])

  const fetchVendorFichas = useCallback(async () => {
    try {
      setFichasLoading(true)
      setFichasError(null)
      const params = new URLSearchParams()
      appendVendedorIdToParams(params)

      const response = await fetch(`/api/vendedor/fichas?${params.toString()}`)
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || "Erro ao buscar fichas")

      setFichasGrouped(result.data)
    } catch (err) {
      console.error("Erro ao buscar fichas:", err)
      setFichasError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setFichasLoading(false)
    }
  }, [appendVendedorIdToParams])

  useEffect(() => {
    if (activeTab === "fichas") {
      fetchVendorFichas()
    }
  }, [activeTab, fetchVendorFichas])

  useEffect(() => {
    if (activeTab === "inadimplencia") {
      fetchInadimplencia().catch((error) => console.error(error))
    }
  }, [activeTab, fetchInadimplencia])

  const handleApplyFilters = () => {
    setSubmittedSearch(searchInput)
    setSubmittedCnpj(cnpjInput.replace(/\D/g, ""))
    setSubmittedBairro(bairroInput)
    setSubmittedEstado(estadoSelect)
    setSubmittedCidade(cidadeSelect)
  }

  const handleResetFilters = () => {
    setSearchInput("")
    setCnpjInput("")
    setBairroInput("")
    setEstadoSelect("all")
    setCidadeSelect("all")
    setSubmittedSearch("")
    setSubmittedCnpj("")
    setSubmittedBairro("")
    setSubmittedEstado("all")
    setSubmittedCidade("all")
  }

  const handleShiftAgendaWeek = (direction: "previous" | "next") => {
    setAgendaReferenceDate((current) => shiftDays(current, direction))
  }

  const handleAgendaDateSelect = (date: Date | undefined) => {
    if (!date) return
    setAgendaReferenceDate(date)
  }
  const handleOrdersRangeChange = (range: OrdersRange) => {
    if (range === ordersRange) return
    setOrdersRange(range)
    setOrdersReferenceDate(getOrdersRangeReferenceDate(range))
  }

  const handleViewDetails = useCallback((id: number) => {
    setDetailId(id.toString())
    setDetailOpen(true)
  }, [])



  const mapRowToRef = (row: VendorClientRow): any => ({
    id: row.id,
    cnpj: row.cnpj,
    razaoSocial: row.razaoSocial,
    nomeSindico: row.nomeSindico,
    telefoneSindico: row.telefoneSindico,
    telefoneCondominio: row.telefoneCondominio,
    celularCondominio: row.celularCondominio,
    telefonePorteiro: row.telefonePorteiro,
  })

  const handleChatButtonClick = useCallback(async (cliente: VendorClientRow) => {
    openChatWithClient(mapRowToRef(cliente), { mode: "click" })
  }, [openChatWithClient])

  const handleChatButtonContextMenu = useCallback((event: React.MouseEvent, cliente: VendorClientRow) => {
    event.preventDefault()
    openChatWithClient(mapRowToRef(cliente), { mode: "context" })
  }, [openChatWithClient])

  const handleOpenVendorChatFromDetails = async (
    clientRef: any,
    mode: "click" | "context",
  ) => {
    openChatWithClient(clientRef, { mode })
  }

  // Handlers para o diálogo de Perda
  const handleOpenPerda = useCallback((cliente: VendorClientRow) => {
    setPerdaClientId(cliente.id)
    setPerdaClientName(formatRazaoSocial(cliente.razaoSocial))
    setPerdaDataManutencao("")
    setPerdaDialogOpen(true)
  }, [])

  const handleClosePerda = useCallback(() => {
    setPerdaDialogOpen(false)
    setPerdaClientId(null)
    setPerdaClientName("")
    setPerdaDataManutencao("")
  }, [])

  const selectedContactsForDispatch = useMemo(() => {
    if (selectedClientIdsArray.length === 0) return []
    const byId = new Map(clientes.map((client) => [client.id, client]))
    return selectedClientIdsArray
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((client) => {
        const options = getClientPhoneOptions(client!)
        const preferred =
          options.find((option) => option.label === "Síndico") ?? options[0]
        const contactData = {
          clientId: Number(client!.id),
          contactName: client!.nomeSindico ?? client!.razaoSocial,
          phoneNumber: preferred?.value ?? "",
        }
        return contactData
      })
      .filter((contact) => contact.phoneNumber)
  }, [clientes, selectedClientIdsArray])

  useEffect(() => {
    if (!massDispatchOpen) return
    setMassDispatchLoadingInboxes(true)
    setMassDispatchError(null)
    chatAPI
      .listInboxes()
      .then((inboxes) => {
        setMassDispatchInboxes(inboxes)
        if (!massDispatchInboxId && inboxes.length > 0) {
          setMassDispatchInboxId(inboxes[0].id)
        }
      })
      .catch(() => {
        setMassDispatchError("Não foi possível carregar as inboxes disponíveis.")
      })
      .finally(() => {
        setMassDispatchLoadingInboxes(false)
      })
  }, [massDispatchOpen])

  useEffect(() => {
    if (!massDispatchOpen || !canUseChatbotOutbound) return
    setMassDispatchChatbotLoading(true)
    fetch("/api/chatbot/flows?type=OUTBOUND&active=true")
      .then((res) => res.json())
      .then((result) => {
        const flows = (result?.data ?? []) as ChatbotFlowSummary[]
        setMassDispatchChatbotFlows(flows)
        if (!massDispatchChatbotFlowId && flows.length > 0) {
          setMassDispatchChatbotFlowId(flows[0].id)
        }
      })
      .catch(() => {
        setMassDispatchError("Não foi possível carregar os fluxos de chatbot.")
      })
      .finally(() => {
        setMassDispatchChatbotLoading(false)
      })
  // NÃO coloca massDispatchChatbotFlowId nas deps pois ele é setado dentro do effect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [massDispatchOpen, canUseChatbotOutbound])

  useEffect(() => {
    if (!canUseChatbotOutbound) return
    const available = massDispatchChatbotFlows.filter(
      (flow) => !flow.inboxId || flow.inboxId === massDispatchInboxId
    )
    if (massDispatchChatbotFlowId && !available.some((flow) => flow.id === massDispatchChatbotFlowId)) {
      setMassDispatchChatbotFlowId(available[0]?.id ?? "")
    }
  // massDispatchChatbotFlowId omitido intencionalmente — lemos ele mas só setamos se mudar
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseChatbotOutbound, massDispatchChatbotFlows, massDispatchInboxId])

  useEffect(() => {
    if (!canUseChatbotOutbound || !massDispatchChatbotFlowId || !massDispatchInboxId) {
      setMassDispatchChatbotTemplateMeta(null)
      setMassDispatchChatbotTemplate(null)
      return
    }
    getOutboundFlowTemplate(massDispatchChatbotFlowId)
      .then((template) => {
        if (!template?.name) {
          setMassDispatchChatbotTemplateMeta(null)
          setMassDispatchChatbotTemplate(null)
          return
        }
        setMassDispatchChatbotTemplateMeta({
          name: template.name,
          languageCode: template.languageCode,
        })
      })
      .catch(() => {
        setMassDispatchChatbotTemplateMeta(null)
        setMassDispatchChatbotTemplate(null)
      })
  }, [canUseChatbotOutbound, massDispatchChatbotFlowId, massDispatchInboxId])

  const selectedChatbotFlow = useMemo(() =>
    massDispatchChatbotFlows.find(f => f.id === massDispatchChatbotFlowId),
    [massDispatchChatbotFlows, massDispatchChatbotFlowId]
  )
  const isAiFlow = selectedChatbotFlow?.engine === "AI_AGENT"

  // Se for AI flow, libera o template meta e permite seleção manual
  useEffect(() => {
    if (isAiFlow && !massDispatchChatbotTemplateMeta && !massDispatchChatbotTemplate) {
      // Para AI, permitimos template nulo inicialmente, mas o usuário deve selecionar um template
      // Não fazemos nada aqui, deixamos a UI lidar
    }
  }, [isAiFlow, massDispatchChatbotTemplateMeta, massDispatchChatbotTemplate])

  const handleOpenMassDispatch = () => {
    setMassDispatchOpen(true)
    setMassDispatchTemplate(null)
    setMassDispatchError(null)
    setMassDispatchMode("template")
    setMassDispatchChatbotFlowId("")
    setMassDispatchChatbotTemplate(null)
    setMassDispatchChatbotTemplateMeta(null)
    setMassDispatchTargetKanbanStage(null)
    setMassDispatchName("")
  }

  const handleOpenBulkAssignChatbot = () => {
    setBulkAssignChatbotOpen(true)
    setBulkAssignChatbotError(null)
    setBulkAssignChatbotFlowId("")
    setBulkAssignChatbotLoading(true)
    Promise.all([
      chatAPI.listInboxes(),
      fetch("/api/chatbot/flows?type=OUTBOUND&active=true&engine=AI_AGENT").then((r) => r.json()),
    ])
      .then(([inboxes, flowResult]) => {
        setBulkAssignChatbotInboxes(inboxes)
        if (inboxes.length > 0) setBulkAssignChatbotInboxId(inboxes[0].id)
        const flows = (flowResult?.data ?? []) as ChatbotFlowSummary[]
        setBulkAssignChatbotFlows(flows)
        if (flows.length > 0) setBulkAssignChatbotFlowId(flows[0].id)
      })
      .catch(() => setBulkAssignChatbotError("Não foi possível carregar inboxes ou fluxos."))
      .finally(() => setBulkAssignChatbotLoading(false))
  }

  const handleConfirmBulkAssignChatbot = async () => {
    if (!bulkAssignChatbotInboxId) {
      setBulkAssignChatbotError("Selecione uma inbox.")
      return
    }
    if (!bulkAssignChatbotFlowId) {
      setBulkAssignChatbotError("Selecione um fluxo de chatbot.")
      return
    }
    if (selectedContactsForDispatch.length === 0) {
      setBulkAssignChatbotError("Nenhum contato válido para atribuição.")
      return
    }

    setBulkAssignChatbotSending(true)
    setBulkAssignChatbotError(null)
    try {
      const response = await fetch("/api/chat/bulk-assign-chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inboxId: bulkAssignChatbotInboxId,
          chatbotFlowId: bulkAssignChatbotFlowId,
          contacts: selectedContactsForDispatch,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(result?.error || "Erro ao atribuir chatbot em massa.")
      }
      toast({
        title: "Chatbot atribuído com sucesso",
        description: `${result?.data?.processed ?? 0} sessão(ões) iniciada(s) de ${result?.data?.accepted ?? 0} contato(s).`,
      })
      setBulkAssignChatbotOpen(false)
      resetSelection()
    } catch (err) {
      setBulkAssignChatbotError(err instanceof Error ? err.message : "Erro ao atribuir chatbot.")
    } finally {
      setBulkAssignChatbotSending(false)
    }
  }


  const handleConfirmMassDispatch = async () => {
    if (!massDispatchInboxId) {
      setMassDispatchError("Selecione uma inbox.")
      return
    }
    const isChatbotDispatch = canUseChatbotOutbound && massDispatchMode === "chatbot"
    if (!isChatbotDispatch && !massDispatchTemplate) {
      setMassDispatchError("Selecione um template.")
      return
    }
    if (isChatbotDispatch && !massDispatchChatbotFlowId) {
      setMassDispatchError("Selecione um fluxo de chatbot.")
      return
    }
    if (isChatbotDispatch && !massDispatchChatbotTemplateMeta && !isAiFlow) {
      setMassDispatchError("O fluxo não possui template inicial configurado.")
      return
    }
    if (isChatbotDispatch && !massDispatchChatbotTemplate) {
      setMassDispatchError("Preencha as variáveis do template do fluxo.")
      return
    }
    if (selectedContactsForDispatch.length === 0) {
      setMassDispatchError("Nenhum contato válido para disparo.")
      return
    }

    setMassDispatchSending(true)
    setMassDispatchError(null)
    try {
      const response = await fetch("/api/chat/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inboxId: massDispatchInboxId,
          contacts: selectedContactsForDispatch,
          name: massDispatchName || undefined,
          ...(isChatbotDispatch
            ? {
              chatbotFlowId: massDispatchChatbotFlowId,
              forceChatbotAssign: true,
            }
            : {}),
          keepChatbot: massDispatchKeepChatbot,
          message: isChatbotDispatch
            ? { contentAttributes: { template: massDispatchChatbotTemplate } }
            : { contentAttributes: { template: massDispatchTemplate } },
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(result?.error || "Erro ao disparar mensagens.")
      }
      toast({
        title: "Disparo em massa iniciado",
        description: `${result?.data?.accepted ?? 0} mensagem(ns) enfileirada(s).`,
      })

      // Se selecionou mover status do kanban em massa
      if (massDispatchTargetKanbanStage !== null) {
        await handleUpdateKanbanState(selectedClientIdsArray, massDispatchTargetKanbanStage)
      }

      setMassDispatchOpen(false)
      resetSelection()

    } catch (err) {
      setMassDispatchError(err instanceof Error ? err.message : "Erro ao disparar mensagens.")
    } finally {
      setMassDispatchSending(false)
    }
  }

  const handleConfirmPerda = async (withDate: boolean) => {
    if (!perdaClientId) return

    setPerdaLoading(true)
    try {
      const actionType = withDate ? "WITH_DATE" : "WITHOUT_DATE"
      const body: { actionType: string; ultimaManutencao?: string } = { actionType }

      if (withDate && perdaDataManutencao) {
        body.ultimaManutencao = new Date(perdaDataManutencao).toISOString()
      }

      const response = await fetch(`/api/vendedor/clients/${perdaClientId}/perda`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error ?? "Erro ao processar perda")
      }

      toast({
        title: withDate ? "Cliente marcado como perda" : "Cliente removido",
        description: result.message,
        variant: withDate ? "default" : "destructive",
      })

      // Remover cliente da lista local
      setClientes((prev) => prev.filter((c) => c.id !== perdaClientId))


      // Atualizar agenda se necessário
      setAgendaContacts((prev) => prev.filter((c) => c.id !== perdaClientId))

      handleClosePerda()
      // Sincronizar sumário e outros dados em background
      fetchClientes(true).catch(console.error)
    } catch (err) {
      toast({
        title: "Erro ao processar perda",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      })
    } finally {
      setPerdaLoading(false)
    }
  }

  const renderAgendaBoard = () => {
    if (agendaLoading) {
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {weekDays.map((day) => (
            <div
              key={`agenda-skeleton-${day.key}`}
              className="rounded-2xl border border-border/60 bg-card p-3 space-y-2"
            >
              <Skeleton className="h-3 w-24" />
              {Array.from({ length: 2 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      )
    }

    if (agendaError) {
      return (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-2">
            {agendaError}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAgendaData(agendaMonth, agendaYear).catch((error) => console.error(error))}
            >
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )
    }

    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {weekDays.map((day) => {
          const dayItems = agendaItemsByDay[day.key] ?? []
          return (
            <div
              key={day.key}
              className={cn(
                "flex flex-col gap-2 rounded-2xl border border-border/60 bg-muted/30 p-3",
                day.label === WEEKDAY_LABELS[new Date().getDay()] && formatDateKey(new Date()) === day.key
                  ? "ring-2 ring-blue-400 border-blue-400 bg-white"
                  : undefined,
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wide",
                      day.isOutsideMonth ? "text-muted-foreground/70" : "text-muted-foreground",
                    )}
                  >
                    {day.label}
                  </p>
                  <p
                    className={cn(
                      "text-lg font-semibold",
                      day.isOutsideMonth ? "text-muted-foreground/70" : "text-foreground",
                    )}
                  >
                    {day.displayDate}
                  </p>
                </div>
                <span className="rounded-full bg-background px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {dayItems.length} {dayItems.length === 1 ? "item" : "itens"}
                </span>
              </div>
              <div className="space-y-2">
                {dayItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 bg-background/60 px-3 py-5 text-center text-[11px] text-muted-foreground">
                    Nada planejado
                  </div>
                ) : (
                  dayItems.map((item) => {
                    // Determina se o item é orçado ou renovação (ativo)
                    const isOrcado = item.hasRecentOrcamento === true
                    const hasValidPedidos = (item.totalPedidos ?? 0) > 0
                    const isRenovacao = item.categoria === "ativo" && hasValidPedidos
                    const isRenovado = item.categoria === "ativo" && hasValidPedidos && isClienteRenovado(item)

                    // Borda verde para orçados que são renovação (ativo)
                    const borderClass = isOrcado && isRenovacao
                      ? "border-2 border-emerald-500"
                      : "border border-border/70"

                    // Badge indicando qual coluna o cliente "estaria"
                    const getColumnBadgeInfo = (): { label: string; style: string } => {
                      // Renovados: ATIVOS cujo último pedido tem menos de 2 meses
                      if (isRenovado) {
                        return { label: "RENOVADO", style: "bg-emerald-600 text-white border-emerald-600" }
                      }
                      // Renovações: ATIVOS (que não são renovados)
                      if (isRenovacao) {
                        return { label: "RENOVAÇÃO", style: "bg-emerald-500/20 text-emerald-700 border-emerald-500/30" }
                      }
                      // Orçados: clientes com orçamento recente
                      if (isOrcado) {
                        return { label: "ORÇADO", style: "bg-blue-600 text-white border-blue-600" }
                      }
                      // Livres: agendados/explorados sem orçamento recente
                      return { label: "LIVRE", style: "bg-slate-100 text-slate-600 border-slate-300" }
                    }
                    const badgeInfo = getColumnBadgeInfo()
                    const chatSummary = clientChatSummaries[item.id]

                    return (
                      <div
                        key={`${day.key}-${item.id}-${item.agendaDate}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleViewDetails(item.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            handleViewDetails(item.id)
                          }
                        }}
                        className={cn(
                          "rounded-md bg-background p-2.5 shadow-sm transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer",
                          borderClass
                        )}
                      >
                        <p className="text-[13px] font-semibold text-foreground line-clamp-1">
                          {formatRazaoSocial(item.razaoSocial)}
                        </p>
                        <div className="text-[11px] text-muted-foreground flex items-center justify-between gap-1 min-w-0">
                          <div className="flex items-center gap-1 truncate">
                            <span className="font-medium text-foreground truncate">{item.nomeSindico ?? "N/I"}</span>
                            <span className="shrink-0 text-muted-foreground/60">•</span>
                            <span className="shrink-0">{item.telefoneSindico ? formatPhone(item.telefoneSindico) : "Sem tel."}</span>
                          </div>
                          <span className="flex items-center gap-1 shrink-0">
                            {chatSummary?.chatbotActive ? (
                              <Bot className="h-3 w-3 text-emerald-500 animate-pulse" aria-label="Chatbot ativo" />
                            ) : null}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                void handleChatButtonClick(item)
                              }}
                              onContextMenu={(e) => {
                                e.stopPropagation()
                                handleChatButtonContextMenu(e, item)
                              }}
                              title="Abrir conversa"
                            >
                              <img src="/icone-zap.png" alt="WhatsApp" className="h-5 w-5" />
                            </Button>
                          </span>
                        </div>
                        <div className="mt-1.5 space-y-1 text-[11px] text-muted-foreground">
                          {item.dataContatoAgendado && (
                            <div className="flex items-center gap-2 text-blue-600 font-medium">
                              <CalendarDays className="h-3 w-3" />
                              <span>{formatDisplayDateTime(item.dataContatoAgendado)}</span>
                            </div>
                          )}
                          <p className="flex items-center justify-end">
                            <Badge className={cn("text-[9px]", badgeInfo.style)}>
                              {badgeInfo.label}
                            </Badge>
                          </p>

                          {chatSummary && chatSummary.lastActivityAt && (
                            <div
                              className={cn(
                                "text-[10px] border-t border-slate-100 pt-1 mt-1 font-medium flex items-center justify-between gap-1",
                                chatSummary.lastMessageStatus === "failed"
                                  ? "text-red-600"
                                  : chatSummary.lastMessageType === "incoming"
                                    ? "text-blue-600"
                                    : "text-foreground"
                              )}
                            >
                              <div
                                className="truncate flex-1 min-w-0"
                                title={chatSummary.lastMessage || undefined}
                              >
                                {chatSummary.lastMessage || formatDisplayDateTime(chatSummary.lastActivityAt)}
                              </div>
                              {chatSummary.lastMessage && (
                                <span className="ml-1 opacity-70 font-normal shrink-0">
                                  • {formatDisplayDateTime(chatSummary.lastActivityAt)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderInadimplenciaContent = () => {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            {inadimplenciaSummary ? (
              <>
                <span className="font-semibold text-slate-900">{formatCurrency(inadimplenciaSummary.inadimplencia?.total ?? 0)}</span>
                {" "}em {inadimplenciaSummary.inadimplencia?.count ?? 0} débitos vencidos
              </>
            ) : "--"}
          </div>
          <Select value={inadimplenciaOrder} onValueChange={(v) => {
            setInadimplenciaPage(1)
            setInadimplenciaOrder(v as "asc" | "desc")
          }}>
            <SelectTrigger className="h-7 w-[200px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Vencimentos mais antigos</SelectItem>
              <SelectItem value="desc">Vencimentos mais recentes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {inadimplenciaLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400 mr-2" />
            <span className="text-xs">Carregando...</span>
          </div>
        ) : inadimplenciaClients.length === 0 ? (
          <div className="flex items-center justify-center border border-dashed rounded-lg py-10 text-center bg-slate-50/50 gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-xs text-slate-600">Tudo em dia! Nenhuma inadimplência encontrada.</span>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wider text-slate-500 border-r border-slate-200">Cliente</th>
                  <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wider text-slate-500 border-r border-slate-200 w-[100px]">Documento</th>
                  <th className="px-2 py-1.5 text-center font-semibold uppercase tracking-wider text-slate-500 border-r border-slate-200 w-[40px]">UF</th>
                  <th className="px-2 py-1.5 text-center font-semibold uppercase tracking-wider text-slate-500 border-r border-slate-200 w-[50px]">#</th>
                  <th className="px-2 py-1.5 text-center font-semibold uppercase tracking-wider text-slate-500 border-r border-slate-200 w-[90px]">Vencimento</th>
                  <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wider text-slate-500 w-[90px]">Valor</th>
                </tr>
              </thead>
              <tbody>
                {inadimplenciaClients.map((client) => {
                  const debitoCount = client.debitos.length
                  return client.debitos.map((debito, dIdx) => {
                    const isFirst = dIdx === 0
                    const isLast = dIdx === debitoCount - 1
                    const venc = debito.vencimento ? new Date(debito.vencimento) : null
                    const vencStr = venc && !Number.isNaN(venc.getTime())
                      ? `${String(venc.getDate()).padStart(2, "0")}/${String(venc.getMonth() + 1).padStart(2, "0")}/${venc.getFullYear()}`
                      : "\u2014"
                    return (
                      <tr
                        key={debito.id}
                        className={cn(
                          isLast ? "border-b border-slate-200" : "border-b border-dashed border-slate-100",
                        )}
                      >
                        {isFirst && (
                          <>
                            <td rowSpan={debitoCount} className="px-2 py-1.5 border-r border-slate-200 align-top">
                              <button
                                type="button"
                                className="text-left text-[11px] font-medium text-blue-700 hover:underline cursor-pointer truncate max-w-[220px] block"
                                onClick={() => handleViewDetails(client.info.id)}
                              >
                                {formatRazaoSocial(client.info.nomeSindico || client.info.razaoSocial)}
                              </button>
                            </td>
                            <td rowSpan={debitoCount} className="px-2 py-1.5 text-slate-500 border-r border-slate-200 align-top whitespace-nowrap">
                              {formatCNPJ(client.info.cnpj)}
                            </td>
                            <td rowSpan={debitoCount} className="px-2 py-1.5 text-center text-slate-500 border-r border-slate-200 align-top font-semibold">
                              {client.info.estado || "\u2014"}
                            </td>
                          </>
                        )}
                        <td className="px-2 py-1 text-center text-slate-400 border-r border-slate-100">
                          {debito.id}
                        </td>
                        <td className="px-2 py-1 text-center text-slate-600 border-r border-slate-100 whitespace-nowrap">
                          {vencStr}
                        </td>
                        <td className="px-2 py-1 text-right font-semibold text-slate-900 whitespace-nowrap">
                          {formatCurrency(debito.valor)}
                        </td>
                      </tr>
                    )
                  })
                })}
              </tbody>
            </table>
          </div>
        )}

        {inadimplenciaTotalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInadimplenciaPage((prev) => Math.max(1, prev - 1))
                window.scrollTo({ top: 300, behavior: "smooth" })
              }}
              disabled={inadimplenciaPage <= 1}
              className="h-7 text-xs shadow-none"
            >
              <ChevronLeft className="mr-1 h-3 w-3" /> Anterior
            </Button>
            <div className="text-[10px] font-medium text-slate-500">
              {inadimplenciaPage} / {inadimplenciaTotalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInadimplenciaPage((prev) => Math.min(inadimplenciaTotalPages, prev + 1))
                window.scrollTo({ top: 300, behavior: "smooth" })
              }}
              disabled={inadimplenciaPage >= inadimplenciaTotalPages}
              className="h-7 text-xs shadow-none"
            >
              Próxima <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    )
  }

  const renderFichasContent = () => {
    if (fichasLoading && !fichasGrouped) {
      return (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400 mr-2" />
          <span className="text-xs">Carregando fichas...</span>
        </div>
      )
    }

    if (fichasError) {
      return (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-red-700 text-xs mb-2">{fichasError}</p>
          <Button size="sm" variant="outline" onClick={() => fetchVendorFichas()}>
            Tentar novamente
          </Button>
        </div>
      )
    }

    if (!fichasGrouped || Object.keys(fichasGrouped).length === 0) {
      return (
        <div className="rounded border border-dashed border-border/80 py-8 text-center text-xs text-muted-foreground">
          Nenhuma ficha enviada para pesquisa nos últimos 2 meses.
        </div>
      )
    }

    const sortedMonths = Object.keys(fichasGrouped).sort((a, b) => b.localeCompare(a))

    return (
      <div className="space-y-6">
        {sortedMonths.map((monthKey) => {
          const [year, month] = monthKey.split("-")
          const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1)
          const monthName = monthDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
          const monthFichas = fichasGrouped[monthKey]

          return (
            <div key={monthKey} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-800 uppercase tracking-tight">
                  {monthName}
                </span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wider text-slate-500 border-r border-slate-200">Cliente</th>
                      <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wider text-slate-500 border-r border-slate-200">Local</th>
                      <th className="px-2 py-1.5 text-center font-semibold uppercase tracking-wider text-slate-500 border-r border-slate-200 w-[80px]">Data</th>
                      <th className="px-2 py-1.5 text-center font-semibold uppercase tracking-wider text-slate-500 border-r border-slate-200 w-[100px]">Status</th>
                      <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wider text-slate-500">Responsável</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthFichas.map((ficha) => (
                      <tr key={ficha.id} className="hover:bg-slate-50/50">
                        <td className="px-2  border-r border-slate-100">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900 truncate max-w-[200px]" title={ficha.razaoSocial}>
                              {formatRazaoSocial(ficha.razaoSocial)}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 border-r border-slate-100 text-slate-600 truncate max-w-[150px]" title={ficha.local}>
                          {ficha.local}
                        </td>
                        <td className="px-2 text-center border-r border-slate-100 text-slate-500">
                          {new Date(ficha.sentAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </td>
                        <td className="px-2 py-1 text-center border-r border-slate-100">
                          {ficha.isReturned ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                              Retornado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-slate-400 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                              Pendente
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1 text-slate-700 font-medium truncate max-w-[120px]" title={ficha.researcherName || "Aguardando apuração"}>
                          {ficha.researcherName || <span className="text-slate-300 font-normal italic">Aguardando...</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    )
  }




  const renderVendasList = () => {
    if (ordersLoading) {
      return (
        <div className="mx-auto w-full max-w-5xl space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`orders-skeleton-${index}`}
              className="rounded border border-border/60 bg-card p-3 space-y-2 animate-pulse"
            >
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      )
    }

    if (ordersError) {
      return (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-2">
            {ordersError}
            <Button variant="outline" size="sm" onClick={() => fetchVendorOrders(ordersMonth, ordersYear).catch(console.error)}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )
    }

    const filteredOrders = ordersStatusFilter && ordersStatusFilter !== "all"
      ? vendorOrders.filter((o) => o.status === ordersStatusFilter)
      : vendorOrders

    if (!filteredOrders.length) {
      return (
        <div className="rounded border border-dashed border-border/80 py-8 text-center text-xs text-muted-foreground">
          {vendorOrders.length === 0 ? `Nenhum pedido criado em ${ordersMonthLabel}.` : "Nenhum pedido com o status selecionado."}
        </div>
      )
    }

    const statusStyles: Record<string, string> = {
      AGUARDANDO: "bg-slate-500 text-white",
      AGENDADO: "bg-slate-500 text-white",
      EXECUCAO: "bg-slate-500 text-white",
      CONCLUIDO: "bg-emerald-500 text-white",
      CANCELADO: "bg-red-500 text-white",
      SAC: "bg-slate-500 text-white",
      AGUARDANDO_APROVACAO_SUPERVISAO: "bg-slate-500 text-white",
      AGUARDANDO_APROVACAO_FINAL: "bg-slate-500 text-white",
      ANALISE_CANCELAMENTO: "bg-slate-500 text-white",
      ANALISE_CANCELAMENTO_SUPERVISAO: "bg-slate-500 text-white",
    }

    const formatShortDate = (value: string | null) => {
      if (!value) return "—"
      const d = new Date(value)
      if (Number.isNaN(d.getTime())) return "—"
      const day = String(d.getDate()).padStart(2, "0")
      const month = String(d.getMonth() + 1).padStart(2, "0")
      const year = d.getFullYear()
      return `${day}/${month}/${year}`
    }

    return (
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wider text-slate-500 border-r border-slate-200">#</th>
              <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wider text-slate-500 border-r border-slate-200">Data</th>
              <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wider text-slate-500 border-r border-slate-200">Cliente</th>
              <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wider text-slate-500 border-r border-slate-200">Local</th>
              <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wider text-slate-500 border-r border-slate-200">Valor</th>
              <th className="px-2 py-1.5 text-center font-semibold uppercase tracking-wider text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => {
              const location =
                [order.clienteBairro, order.clienteCidade, order.clienteEstado].filter(Boolean).join(", ") ||
                "—"
              const isCancelado = order.status === "CANCELADO"
              return (
                <tr
                  key={order.id}
                  className={cn(
                    "border-b border-slate-100",
                    isCancelado && "bg-red-50/60",
                  )}
                >
                  <td className="px-2 py-1.5 font-semibold text-slate-700 border-r border-slate-100 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span>#{order.id}</span>
                      {order.contratoId && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[8px] h-3 px-1 leading-none mt-0.5 uppercase font-bold",
                            order.isContratoVigente
                              ? "bg-blue-100 text-blue-700 border-blue-200"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          )}
                        >
                          Contrato
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-slate-600 border-r border-slate-100 whitespace-nowrap">
                    {formatShortDate(order.createdAt)}
                  </td>
                  <td className="px-2 py-1.5 border-r border-slate-100 min-w-0">
                    <button
                      type="button"
                      className={cn(
                        "text-left text-[11px] font-medium truncate max-w-[240px] block cursor-pointer hover:underline",
                        isCancelado ? "text-red-600 line-through" : "text-blue-700",
                      )}
                      onClick={() => handleViewDetails(order.clienteId)}
                    >
                      {order.clienteNomeSindico || formatRazaoSocial(order.clienteRazaoSocial)}
                    </button>
                  </td>
                  <td className="px-2 py-1.5 text-slate-500 border-r border-slate-100 truncate max-w-[160px]">
                    {location}
                  </td>
                  <td className={cn(
                    "px-2 py-1.5 text-right font-semibold border-r border-slate-100 whitespace-nowrap",
                    isCancelado ? "text-red-600" : "text-emerald-600",
                  )}>
                    {formatCurrency(order.valorTotal)}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <Badge className={cn("text-[9px] px-1.5 py-0", statusStyles[order.status] ?? "bg-slate-500 text-white")}>
                      {getPedidoStatusLabel(order.status)}
                    </Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }


  // Callbacks estáveis para o CrmCard (sem recriar a cada render)
  const handleCardDragStart = useCallback((clientId: number, e: React.DragEvent) => {
    draggedClientIdRef.current = clientId
    e.dataTransfer.effectAllowed = "move"
    const el = e.currentTarget as HTMLElement
    requestAnimationFrame(() => { el.style.opacity = '0.35' })
  }, [])

  const handleCardDragEnd = useCallback((e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement
    el.style.opacity = '1'
    draggedClientIdRef.current = null
  }, [])

  const handleCardOpenPerda = useCallback((client: CrmCardClient) => {
    handleOpenPerda(client as VendorClientRow)
  }, [handleOpenPerda])

  const handleCardChatClick = useCallback((client: CrmCardClient) => {
    handleChatButtonClick(client as VendorClientRow)
  }, [handleChatButtonClick])

  const handleCardChatContextMenu = useCallback((e: React.MouseEvent, client: CrmCardClient) => {
    handleChatButtonContextMenu(e as React.MouseEvent<HTMLButtonElement>, client as VendorClientRow)
  }, [handleChatButtonContextMenu])

  const handleCardMoveKanban = useCallback((clientId: number, code: number) => {
    handleUpdateKanbanState(clientId, code)
  }, [handleUpdateKanbanState])

  const renderCrmKanbanBoard = () => {
    if (loading) {
      return (
        <div className="flex gap-3 h-full">
          {CRM_COLUMNS.map((column) => (
            <div
              key={`crm-skeleton-${column.id}`}
              className="w-[240px] flex-shrink-0 rounded-xl border border-border/40 bg-white/5 dark:bg-slate-800/40 p-3 space-y-2"
            >
              <Skeleton className="h-5 w-36" />
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ))}
        </div>
      )
    }

    if (error) {
      return (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            {error}
            <Button variant="outline" size="sm" onClick={() => fetchClientes().catch(console.error)}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )
    }

    if (clientes.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Nenhum cliente para exibir.
        </div>
      )
    }

    const totalFiltered = Object.values(filteredCrmColumns).reduce((acc, arr) => acc + arr.length, 0)
    if (localSearchTerm && totalFiltered === 0) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Nenhum cliente encontrado para "<span className="font-medium ml-1">{localSearchTerm}</span>".
        </div>
      )
    }

    return (
      <div
        className="flex gap-3 h-full overflow-x-auto overflow-y-hidden pb-1 scrollbar-thin scrollbar-thumb-slate-600/50 scrollbar-track-transparent"
        style={{ willChange: "transform" }}
      >
        {CRM_COLUMNS.map((column) => {
          const columnClientsAll = sortedCrmColumns[column.id] ?? []
          // Filtro IA: filtra pelo campo da API (clientChatSummaries) se ativo
          const columnClients = crmFilterAiOnly
            ? columnClientsAll.filter(c => chatSummariesRef.current[c.id]?.chatbotActive === true)
            : columnClientsAll
          const isLivresCol = column.id.startsWith("livres-")

          return (
            <div
              key={column.id}
              onDragOver={(e) => { e.preventDefault() }}
              onDragEnter={(e) => {
                if (draggedClientIdRef.current == null) return
                // Aplica highlight via classList — zero re-renders
                e.currentTarget.classList.add(
                  '!border-blue-400', '!bg-blue-50/50', 'dark:!bg-blue-900/20'
                )
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  e.currentTarget.classList.remove(
                    '!border-blue-400', '!bg-blue-50/50', 'dark:!bg-blue-900/20'
                  )
                }
              }}
              onDrop={(e) => {
                e.preventDefault()
                // Remove highlight
                e.currentTarget.classList.remove(
                  '!border-blue-400', '!bg-blue-50/50', 'dark:!bg-blue-900/20'
                )
                const clientId = draggedClientIdRef.current
                if (clientId != null) {
                  setClientes((prev) =>
                    prev.map((c) => {
                      if (c.id !== clientId) return c
                      if (column.id.startsWith("livres-")) {
                        const code = parseInt(column.id.split("-")[1], 10)
                        return { ...c, kanbanCode: code }
                      }
                      return c
                    })
                  )
                  draggedClientIdRef.current = null
                }
              }}
              className={cn(
                "flex-shrink-0 flex flex-col rounded-lg border overflow-hidden transition-colors",
                "w-64",
                "border-border/60 bg-card"
              )}
            >
              {/* Header da coluna */}
              <div className={cn("px-3 py-2.5 flex items-center justify-between border-b-2 shrink-0 bg-card", column.headerBgColor ?? "border-border/60")}>
                <div className="flex items-center gap-2 min-w-0">
                  {columnClients.length > 0 && (
                    <Checkbox
                      checked={isAllSelectedInColumn(column.id)}
                      onCheckedChange={(checked) => {
                        if (checked) selectAllInColumn(column.id);
                        else deselectAllInColumn(column.id);
                      }}
                      className="h-3.5 w-3.5 shrink-0"
                      aria-label={`Selecionar todos da coluna ${column.title}`}
                    />
                  )}
                  {column.dotColor && (
                    <span className={cn("w-2 h-2 rounded-full shrink-0", column.dotColor)} />
                  )}
                  <span className="text-xs font-bold text-foreground truncate">
                    {column.title}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isSomeSelectedInColumn(column.id) && (
                    <span className="text-[9px] text-primary font-bold">
                      {sortedCrmColumns[column.id]?.filter((c: VendorClientRow) => selectedClientIds.has(c.id)).length}✓
                    </span>
                  )}
                  <span
                    className="text-[10px] bg-background/50 px-1.5 py-0.5 rounded-full font-bold text-foreground"
                  >
                    {columnClients.length}
                  </span>
                </div>
              </div>

              {/* Lista de cards com scroll próprio */}
              <div
                className="flex-1 overflow-y-auto p-2 space-y-2 bg-secondary/30 scrollbar-thin"
                style={{ overscrollBehavior: "contain", willChange: "transform" }}
              >
                {columnClients.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground text-center py-4">Vazio</p>
                ) : (
                  columnClients.map((client) => (
                    <CrmCard
                      key={`${column.id}-${client.id}`}
                      client={client}
                      columnId={column.id}
                      isSelected={selectedClientIds.has(client.id)}
                      chatSummary={chatSummariesRef.current[client.id] as CrmCardChatSummary | undefined}
                      onSelect={toggleClientSelection}
                      onViewDetails={handleViewDetails}
                      onOpenPerda={handleCardOpenPerda}
                      onChatClick={handleCardChatClick}
                      onChatContextMenu={handleCardChatContextMenu}
                      onMoveKanban={handleCardMoveKanban}
                      onDragStart={handleCardDragStart}
                      onDragEnd={handleCardDragEnd}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Filtra clientes por categoria para a visualização em abas (usa filteredClientes)
  const getClientsByTab = (tab: "renovacoes" | "agendados" | "livres"): VendorClientRow[] => {
    switch (tab) {
      case "renovacoes":
        return filteredClientes.filter((c) => c.categoria === "ativo")
      case "agendados":
        return filteredClientes.filter((c) => c.categoria === "agendado")
      case "livres":
        return filteredClientes.filter((c) => c.categoria === "explorado")
      default:
        return []
    }
  }

  const renderClientsTabsView = () => {
    if (loading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      )
    }

    if (error) {
      return (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            {error}
            <Button variant="outline" size="sm" onClick={() => fetchClientes().catch(console.error)}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )
    }

    const tabClients = getClientsByTab(clientsTabView)

    // Ordena: vencidos/atrasados primeiro
    const sortedClients = [...tabClients].sort((a, b) => {
      if (clientsTabView === "renovacoes") {
        const aVencido = isClienteVencido(a)
        const bVencido = isClienteVencido(b)
        if (aVencido && !bVencido) return -1
        if (!aVencido && bVencido) return 1
      }
      if (clientsTabView === "agendados") {
        const aAtrasado = isAgendadoAtrasado(a)
        const bAtrasado = isAgendadoAtrasado(b)
        if (aAtrasado && !bAtrasado) return -1
        if (!aAtrasado && bAtrasado) return 1
      }
      return 0
    })

    return (
      <div className="space-y-4">
        <Tabs value={clientsTabView} onValueChange={(v) => setClientsTabView(v as "renovacoes" | "agendados" | "livres")}>
          <TabsList className="grid w-full grid-cols-3 rounded-xl p-1.5">
            <TabsTrigger
              value="renovacoes"
              className="rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md gap-2 font-medium"
            >
              <RefreshCw className="h-4 w-4" />
              Renovações
              <Badge variant="secondary" className="ml-1 text-xs data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                {getClientsByTab("renovacoes").length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="agendados"
              className="rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md gap-2 font-medium"
            >
              <CalendarClock className="h-4 w-4" />
              Livres com Data
              <Badge variant="secondary" className="ml-1 text-xs data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                {getClientsByTab("agendados").length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="livres"
              className="rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md gap-2 font-medium"
            >
              <Users className="h-4 w-4" />
              Livres sem Data
              <Badge variant="secondary" className="ml-1 text-xs data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                {getClientsByTab("livres").length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={clientsTabView} className="mt-4">
            {sortedClients.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 py-10 text-center text-muted-foreground">
                Nenhum cliente nesta categoria.
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-300 bg-white dark:bg-slate-900/50 shadow-sm overflow-hidden">
                {/* Header da lista */}
                <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_auto] items-center border-b border-slate-200 bg-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-700">
                  <span>Cliente</span>
                  <span>Localização</span>
                  <span>Síndico</span>
                  <span>
                    {clientsTabView === "agendados" ? "Data Agendada" : "Última Compra Conosco"}
                  </span>
                  <span className="text-right">Status</span>
                </div>

                {/* Lista de clientes */}
                {sortedClients.map((client, index) => {
                  const location = [client.bairro, client.cidade, client.estado].filter(Boolean).join(", ") || "Não informado"
                  const isVencido = clientsTabView === "renovacoes" && isClienteVencido(client)
                  const isAtrasado = clientsTabView === "agendados" && isAgendadoAtrasado(client)

                  return (
                    <div
                      key={client.id}
                      onClick={() => handleViewDetails(client.id)}
                      className={cn(
                        "grid grid-cols-[2fr_1.5fr_1fr_1fr_auto] items-center gap-4 px-4 py-2 cursor-pointer transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-slate-300 dark:border-slate-800 bg-white dark:bg-transparent",
                        isVencido && "border-l-4 border-l-red-400 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30",
                        isAtrasado && "border-l-4 border-l-orange-400 bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/30"
                      )}
                    >
                      {/* Cliente */}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {formatRazaoSocial(client.nomeSindico || client.razaoSocial)}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">{formatCNPJ(client.cnpj)}</p>
                      </div>

                      {/* Localização */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                        <span className="text-sm text-slate-800 truncate">{location}</span>
                      </div>

                      {/* Síndico */}
                      <span className="text-sm text-slate-800 truncate">
                        {client.nomeSindico ?? "Não informado"}
                      </span>

                      {/* Data específica da aba */}
                      <span className="text-sm font-medium text-slate-800">
                        {clientsTabView === "renovacoes" && formatDisplayDate(client.ultimaManutencao, "N/I")}
                        {clientsTabView === "agendados" && formatDisplayDateTime(client.dataContatoAgendado, "N/I")}
                        {clientsTabView === "livres" && formatDisplayDate(client.ultimaManutencao, "N/I")}
                      </span>

                      {/* Status/Badge */}
                      <div className="flex items-center justify-end">
                        {isVencido && (
                          <Badge className="bg-red-500 text-white text-xs font-semibold px-3 py-1">
                            VENCIDO
                          </Badge>
                        )}
                        {isAtrasado && (
                          <Badge className="bg-orange-500 text-white text-xs font-semibold px-3 py-1">
                            ATRASADO
                          </Badge>
                        )}
                        {!isVencido && !isAtrasado && clientsTabView === "renovacoes" && (
                          <Badge className="bg-amber-500 text-white text-xs font-semibold px-3 py-1">
                            A RENOVAR
                          </Badge>
                        )}
                        {/* Badge de 'COM DATA' removido conforme solicitado */}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  return (
    <DashboardLayout hideHeader={true}>
      {/* Wrapper com altura exata da viewport — não depende do parent min-h-screen */}
      <div className="flex flex-col overflow-hidden bg-transparent" style={{ height: '100dvh' }}>
        {/* Banner de impersonation para MASTER/ADMIN */}
        {isImpersonating && (
          <div className="flex items-center gap-3 mx-4 mt-3 rounded-xl bg-amber-500/20 border border-amber-500/30 px-4 py-2.5 text-amber-100 shrink-0">
            <Eye className="h-5 w-5 text-amber-400" />
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-wider">Visualizando como vendedor</p>
              <p className="text-sm font-medium text-amber-200">
                {impersonatedVendorName ?? "Carregando..."}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-500/50 hover:bg-amber-500/20 text-amber-100 text-xs"
              onClick={() => {
                const params = new URLSearchParams(window.location.search)
                params.delete("vendedorId")
                window.location.search = params.toString()
              }}
            >
              Parar visualização
            </Button>
          </div>
        )}

        {/* Header compacto */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 rounded-full bg-blue-500" />
            <h1 className="text-base font-semibold text-slate-200 tracking-tight">Pipeline de Clientes</h1>
            <span className="text-[11px] text-slate-500 font-medium">{clientes.length} total</span>
          </div>

          {/* Filtro de IA + busca */}
          <div className="flex items-center gap-2">
            {/* Toggle IA */}
            <button
              onClick={() => setCrmFilterAiOnly(v => !v)}
              className={cn(
                "flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-bold uppercase tracking-widest transition-all",
                crmFilterAiOnly
                  ? "bg-orange-500 border-orange-500 text-white shadow-md"
                  : "bg-slate-800/60 border-slate-700/60 text-slate-400 hover:border-orange-500/40 hover:text-orange-400"
              )}
            >
              <Bot className="h-3.5 w-3.5" />
              I.A.
            </button>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <Input
                placeholder="Buscar clientes..."
                value={localSearchTerm}
                onChange={(e) => setLocalSearchTerm(e.target.value)}
                className="pl-8 h-8 w-64 bg-slate-800/60 border-slate-700/60 focus:border-blue-500/70 text-slate-200 text-xs rounded-lg placeholder:text-slate-500"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 bg-slate-800/60 border-slate-700/60 hover:bg-slate-700/80 text-slate-200 text-xs rounded-lg"
              onClick={() => setMetricsOpen(true)}
            >
              <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" />
              Métricas
            </Button>
          </div>
        </div>

        {/* Kanban Board — ocupa o restante da altura disponível */}
        <div className="flex-1 min-h-0 px-4 pb-4">
          {renderCrmKanbanBoard()}
        </div>
      </div>

      {detailId && (
        <ClienteDetailDialog
          clienteId={detailId}
          open={detailOpen}
          onClose={() => {
            setDetailOpen(false)
            if (atrasosOpen) {
              handleOpenAtrasos()
            }
          }}
          apiBasePath="/api/vendedor/clients"
          onClientReturned={(clientId) => {
            fetchClientes(true).catch(console.error)
            if (atrasosOpen) {
              handleOpenAtrasos()
            }
          }}
          onOrcamentoCreated={() => {
            fetchClientes(true).catch(console.error)
          }}
          onClientUpdated={() => {
            fetchClientes(true).catch(console.error)
            fetchAgendaData(agendaMonth, agendaYear).catch(console.error)
          }}
          onStatusUpdated={(clientId, code) => {
            setClientes((prev) =>
              prev.map((c) => (c.id === clientId ? { ...c, kanbanCode: code } : c))
            )
            fetchClientes(true).catch(console.error)
          }}
          onClientDeleted={(clientId) => {
            setClientes((prev) => prev.filter((c) => c.id !== clientId))
            setAgendaContacts((prev) => prev.filter((c) => c.id !== clientId))
            fetchClientes(true).catch(console.error)
          }}
          onPedidoCriado={() => {
            fetchClientes(true).catch(console.error)
          }}
        />
      )}

      {
        orcamentoCliente && (
          <CriarOrcamentoDialog
            open
            clienteId={orcamentoCliente.id}
            clienteNome={orcamentoCliente.nome}
            onClose={() => setOrcamentoCliente(null)}
            onSuccess={() => {
              // Atualiza os dados dos clientes para refletir o novo orçamento nas colunas do CRM (silent)
              fetchClientes(true).catch(console.error)
            }}
          />
        )
      }


      <Dialog open={metricsOpen} onOpenChange={setMetricsOpen}>
        <DialogContent className="sm:max-w-6xl bg-slate-950 text-white border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">Métricas do mês</DialogTitle>
            <DialogDescription className="text-slate-300">
              Visão rápida dos indicadores que importam para o vendedor.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-none bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-lg">
              <CardHeader className="space-y-1">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-200">Leads</p>
                <CardTitle className="text-xl font-semibold">Distribuição por status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3">
                  <span className="text-slate-200">Livres com Data</span>
                  <span className="text-lg font-semibold">{summary.agendados}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3">
                  <span className="text-slate-200">Ativos</span>
                  <span className="text-lg font-semibold">{summary.ativos}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3">
                  <span className="text-slate-200">Livres sem data</span>
                  <span className="text-lg font-semibold">{summary.explorados}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="border-none bg-white/95 text-slate-900 shadow-lg">
              <CardHeader className="space-y-1">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Desempenho</p>
                <CardTitle className="text-xl font-semibold">Vendas & orçamentos ({currentMonthLabel})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 text-sm">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Total vendido</p>
                  <p className="text-3xl font-semibold text-emerald-600">
                    {currentMetricsLoaded ? formatCurrency(currentMonthMetrics.totalValue) : "—"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Total dos pedidos de renovações a fazer(passado)</p>
                  <p className="text-3xl font-semibold text-amber-600">
                    {formatCurrency(renovacoesPendentesTotal)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Soma dos últimos pedidos dos clientes em renovação visíveis no dashboard.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Orçamentos criados</p>
                  <p className="text-3xl font-semibold text-blue-600">
                    {currentMetricsLoaded ? currentMonthMetrics.budgetsCount : "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Atrasos Dialog */}
      <Dialog open={atrasosOpen} onOpenChange={handleAtrasosOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Bell className="h-5 w-5" />
              Clientes com Atraso
            </DialogTitle>
            <DialogDescription>
              Clientes agendados cuja data de contato já passou.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {atrasosLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Verificando atrasos...</span>
              </div>
            ) : atrasosClientes.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Nenhum cliente com atraso no momento.
              </div>
            ) : (
              <div className="space-y-2">
                {atrasosClientes.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between gap-4 rounded-lg border p-3 hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{formatRazaoSocial(client.razaoSocial)}</p>
                      <p className="text-xs text-muted-foreground">{formatCNPJ(client.cnpj)}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {client.cidade && client.estado && (
                          <span className="text-xs text-muted-foreground">
                            {client.cidade}/{client.estado}
                          </span>
                        )}
                        {client.dataContatoAgendado && (
                          <Badge variant="destructive" className="text-xs">
                            Agendado: {new Date(client.dataContatoAgendado).toLocaleDateString("pt-BR")}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDetailId(String(client.id))
                        setDetailOpen(true)
                      }}
                    >
                      Ver Detalhes
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Perda */}
      <Dialog open={perdaDialogOpen} onOpenChange={(open) => !open && handleClosePerda()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <X className="h-5 w-5" />
              Registrar Perda
            </DialogTitle>
            <DialogDescription>
              Cliente: <span className="font-medium text-foreground">{perdaClientName}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="perda-data">Data da última manutenção (com concorrente)</Label>
              <Input
                id="perda-data"
                type="date"
                value={perdaDataManutencao}
                onChange={(e) => setPerdaDataManutencao(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Se informar a data, o cliente sairá do seu dashboard agora mas <span className="font-medium text-emerald-600">aparecerá novamente 2 meses antes do próximo vencimento</span>.
              </p>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-800">
                <span className="font-semibold">Atenção:</span> Se você <span className="font-semibold text-red-600">não informar uma data</span>,
                o cliente será <span className="font-semibold text-red-600">removido permanentemente</span> do seu dashboard e você perderá este lead.
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button variant="outline" onClick={handleClosePerda} disabled={perdaLoading}>
              Cancelar
            </Button>

            {perdaDataManutencao ? (
              <Button
                variant="default"
                onClick={() => handleConfirmPerda(true)}
                disabled={perdaLoading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {perdaLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirmar com data
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={() => handleConfirmPerda(false)}
                disabled={perdaLoading}
              >
                {perdaLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Remover do meu dashboard
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={massDispatchOpen} onOpenChange={setMassDispatchOpen}>
        <DialogContent className="max-w-2xl sm:max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Disparo em massa</DialogTitle>
            <DialogDescription>
              Confirme a inbox e os contatos selecionados antes de iniciar o disparo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">Nome do disparo (opcional)</label>
              <Input
                placeholder="Ex: Campanha de Julho"
                value={massDispatchName}
                onChange={(e) => setMassDispatchName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">Inbox</label>
              <Select
                value={massDispatchInboxId}
                onValueChange={setMassDispatchInboxId}
                disabled={massDispatchLoadingInboxes}
              >
                <SelectTrigger>
                  <SelectValue placeholder={massDispatchLoadingInboxes ? "Carregando..." : "Selecione a inbox"} />
                </SelectTrigger>
                <SelectContent>
                  {massDispatchInboxes.map((inbox) => (
                    <SelectItem key={inbox.id} value={inbox.id}>
                      {inbox.name}
                      {inbox.phoneNumber ? ` • ${formatPhone(inbox.phoneNumber)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {canUseChatbotOutbound && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">Tipo de disparo</label>
                <Select
                  value={massDispatchMode}
                  onValueChange={(value) => {
                    const next = value as "template" | "chatbot"
                    setMassDispatchMode(next)
                    setMassDispatchError(null)
                    if (next === "chatbot") {
                      setMassDispatchTemplateOpen(false)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="template">Template</SelectItem>
                    <SelectItem value="chatbot">Chatbot outbound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {(!canUseChatbotOutbound || massDispatchMode === "template") && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">Template</label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMassDispatchTemplateOpen(true)}
                    disabled={!massDispatchInboxId}
                  >
                    {massDispatchTemplate ? "Trocar template" : "Selecionar template"}
                  </Button>
                  {massDispatchTemplate ? (
                    <span className="text-xs text-slate-600">{massDispatchTemplate.name}</span>
                  ) : null}
                </div>
              </div>
            )}

            {canUseChatbotOutbound && massDispatchMode === "chatbot" && (
              <div className="space-y-3 rounded-md border border-slate-200 p-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600">Fluxo outbound</label>
                  <Select
                    value={massDispatchChatbotFlowId}
                    onValueChange={setMassDispatchChatbotFlowId}
                    disabled={massDispatchChatbotLoading}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={massDispatchChatbotLoading ? "Carregando..." : "Selecione o fluxo"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {massDispatchChatbotFlows
                        .filter((flow) => !flow.inboxId || flow.inboxId === massDispatchInboxId)
                        .map((flow) => (
                          <SelectItem key={flow.id} value={flow.id}>
                            <span className="flex items-center gap-2">
                              {flow.name}
                              {flow.engine === "AI_AGENT" && (
                                <Badge variant="secondary" className="px-1 py-0 h-4 text-[9px] bg-purple-100 text-purple-700 border-purple-200">
                                  IA
                                </Badge>
                              )}
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-slate-500">
                    O template é enviado pelo próprio fluxo outbound. Nesta versão, o chatbot sempre assume a conversa.
                  </p>
                </div>

                {massDispatchChatbotTemplateMeta || isAiFlow ? (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600">Variáveis do template</label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setMassDispatchChatbotTemplateOpen(true)}
                        disabled={!massDispatchInboxId}
                      >
                        {massDispatchChatbotTemplate ? "Editar variáveis / template" : "Selecionar template inicial"}
                      </Button>
                      <span className="text-xs text-slate-600">
                        {massDispatchChatbotTemplateMeta?.name ?? massDispatchChatbotTemplate?.name}
                      </span>
                    </div>
                    {isAiFlow && !massDispatchChatbotTemplate && (
                      <p className="text-[11px] text-amber-600">
                        Selecione um template para iniciar a conversa com a IA.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-amber-600">
                    Este fluxo não possui template inicial configurado.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">
                Contatos selecionados ({selectedContactsForDispatch.length})
              </label>
              <div className="max-h-[240px] overflow-y-auto rounded-md border border-slate-200">
                {selectedContactsForDispatch.map((contact) => (
                  <div
                    key={contact.clientId}
                    className="flex items-center justify-between px-3 py-2 text-xs border-b last:border-b-0"
                  >
                    <span className="font-medium text-slate-700">{contact.contactName}</span>
                    <span className="text-slate-500">{formatPhone(contact.phoneNumber)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 italic">
              <label className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                Mover status (opcional)
              </label>
              <Select
                value={massDispatchTargetKanbanStage?.toString() ?? "none"}
                onValueChange={(val) => setMassDispatchTargetKanbanStage(val === "none" ? null : parseInt(val))}
              >
                <SelectTrigger className="h-9 text-xs border-blue-100 bg-blue-50/30">
                  <SelectValue placeholder="Não mover status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não mover status</SelectItem>
                  {KANBAN_STAGES.map((stage) => (
                    <SelectItem key={stage.code} value={stage.code.toString()}>
                      Mover para: {stage.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-slate-500">
                Se selecionado, todos os clientes que receberem a mensagem serão movidos para esta etapa.
              </p>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="keepActiveChatbot"
                checked={massDispatchKeepChatbot}
                onCheckedChange={(checked) => setMassDispatchKeepChatbot(!!checked)}
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="keepActiveChatbot"
                  className="text-[11px] font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700"
                >
                  Manter chatbot ativo
                </label>
                <p className="text-[10px] text-muted-foreground">
                  Se o cliente já tiver uma sessão de IA ativa, ela não será desativada com o disparo.
                </p>
              </div>
            </div>


            {massDispatchError && (
              <p className="text-xs text-red-600">{massDispatchError}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMassDispatchOpen(false)} disabled={massDispatchSending}>
                Cancelar
              </Button>
              <Button onClick={handleConfirmMassDispatch} disabled={massDispatchSending}>
                {massDispatchSending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirmar disparo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Bulk Assign Chatbot */}
      <Dialog open={bulkAssignChatbotOpen} onOpenChange={setBulkAssignChatbotOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-purple-600" />
              Atribuir Chatbot em Massa
            </DialogTitle>
            <DialogDescription>
              Inicia uma sessão de chatbot OUTBOUND para {selectedContactsForDispatch.length} contato(s) selecionado(s).
              Nenhuma mensagem é enviada agora — o fluxo é iniciado pelo chatbot.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {bulkAssignChatbotLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-purple-500 mr-2" />
                <span className="text-sm text-muted-foreground">Carregando...</span>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600">Inbox</label>
                  <Select
                    value={bulkAssignChatbotInboxId}
                    onValueChange={setBulkAssignChatbotInboxId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a inbox" />
                    </SelectTrigger>
                    <SelectContent>
                      {bulkAssignChatbotInboxes.map((inbox) => (
                        <SelectItem key={inbox.id} value={inbox.id}>
                          {inbox.name}{inbox.phoneNumber ? ` • ${formatPhone(inbox.phoneNumber)}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600">Agente de IA OUTBOUND</label>
                  <Select
                    value={bulkAssignChatbotFlowId}
                    onValueChange={setBulkAssignChatbotFlowId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o agente" />
                    </SelectTrigger>
                    <SelectContent>
                      {bulkAssignChatbotFlows
                        .filter((f) => f.engine === "AI_AGENT" && (!f.inboxId || f.inboxId === bulkAssignChatbotInboxId))
                        .map((flow) => (
                          <SelectItem key={flow.id} value={flow.id}>
                            {flow.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-slate-500">
                    Apenas agentes de IA (AI_AGENT) OUTBOUND ativos são listados.
                    O agente iniciará a conversa com o cliente — nenhum template manual é necessário.
                  </p>
                </div>

                <div className="rounded-md border border-purple-100 bg-purple-50/60 p-3">
                  <p className="text-xs font-medium text-purple-800 mb-1">Contatos que receberão o chatbot ({selectedContactsForDispatch.length})</p>
                  <div className="max-h-[120px] overflow-y-auto space-y-1">
                    {selectedContactsForDispatch.map((c) => (
                      <div key={c.clientId} className="flex items-center justify-between text-[11px] text-purple-700">
                        <span className="truncate font-medium">{c.contactName}</span>
                        <span className="shrink-0 text-purple-500 ml-2">{formatPhone(c.phoneNumber)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {bulkAssignChatbotError && (
                  <p className="text-xs text-red-600">{bulkAssignChatbotError}</p>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setBulkAssignChatbotOpen(false)} disabled={bulkAssignChatbotSending}>
                    Cancelar
                  </Button>
                  <Button
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={handleConfirmBulkAssignChatbot}
                    disabled={bulkAssignChatbotSending || !bulkAssignChatbotFlowId || !bulkAssignChatbotInboxId}
                  >
                    {bulkAssignChatbotSending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bot className="h-4 w-4 mr-2" />}
                    Confirmar atribuição
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {
        massDispatchInboxId && (!canUseChatbotOutbound || massDispatchMode === "template") && (
          <TemplateModal
            open={massDispatchTemplateOpen}
            onOpenChange={setMassDispatchTemplateOpen}
            inboxId={massDispatchInboxId}
            variableTokens={broadcastTemplateVariableTokens}
            onSend={async (templatePayload) => {
              setMassDispatchTemplate(templatePayload)
              setMassDispatchTemplateOpen(false)
            }}
          />
        )
      }

      {
        massDispatchInboxId &&
        canUseChatbotOutbound &&
        massDispatchMode === "chatbot" &&
        (massDispatchChatbotTemplateMeta || isAiFlow) && (
          <TemplateModal
            open={massDispatchChatbotTemplateOpen}
            onOpenChange={setMassDispatchChatbotTemplateOpen}
            inboxId={massDispatchInboxId}
            variableTokens={broadcastTemplateVariableTokens}
            lockedTemplateName={isAiFlow ? undefined : massDispatchChatbotTemplateMeta?.name}
            lockedTemplateLanguage={isAiFlow ? undefined : massDispatchChatbotTemplateMeta?.languageCode}
            onSend={async (templatePayload) => {
              setMassDispatchChatbotTemplate(templatePayload)
              setMassDispatchChatbotTemplateOpen(false)
            }}
          />
        )
      }

      {/* Alerta Permanente de Agendamentos Vencidos */}
      {
        agendamentosVencidos.length > 0 && (
          <div
            className={cn(
              "fixed top-24 right-0 z-[40] flex items-start transition-all duration-500 ease-in-out pointer-events-none",
              !showAtrasados ? "translate-x-[calc(100%-42px)]" : "translate-x-0 pr-6"
            )}
          >
            <div className="pointer-events-auto mt-2">
              <Button
                variant="destructive"
                size="icon"
                onClick={() => setShowAtrasados(!showAtrasados)}
                className="h-10 w-10 rounded-l-xl rounded-r-none shadow-2xl border-2 border-white bg-red-600 flex items-center justify-center pl-1 hover:scale-105 transition-transform"
                title={showAtrasados ? "Recolher alertas" : "Ver alertas vencidos"}
              >
                {showAtrasados ? <ChevronRight className="h-6 w-6" /> : (
                  <div className="flex flex-col items-center justify-center -space-y-1">
                    <ChevronLeft className="h-5 w-5" />
                    <span className="text-[10px] font-black">{agendamentosVencidos.length}</span>
                  </div>
                )}
              </Button>
            </div>

            <div className={cn(
              "flex flex-col gap-2 transition-all duration-500 w-[300px] max-w-[320px]",
              !showAtrasados ? "opacity-0 invisible scale-95 translate-x-10" : "opacity-100 visible scale-100 translate-x-0"
            )}>
              {agendamentosVencidos.map(client => (
                <div
                  key={client.id}
                  className="bg-red-50 border-l-4 border-red-500 shadow-lg p-3 rounded-md flex items-center justify-between gap-3 pointer-events-auto cursor-pointer animate-in slide-in-from-right fade-in duration-300 hover:bg-red-100 transition-colors border-y border-r border-red-100"
                  onClick={() => {
                    setDetailId(String(client.id))
                    setDetailOpen(true)
                  }}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-red-800 flex items-center gap-1 mb-0.5">
                      <CalendarClock className="h-3 w-3" />
                      Agendamento Vencido
                    </span>
                    <span className="text-sm font-semibold text-slate-800 line-clamp-1 mb-0.5" title={client.razaoSocial}>
                      {client.razaoSocial}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-slate-600">
                      <span>{formatDisplayDateTime(client.dataContatoAgendado)}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-red-400 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )
      }

      {/* Mass action floating bar */}
      {
        totalSelecionados > 0 && (
          <Card className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 shadow-lg border-blue-200 bg-blue-50">
            <CardContent className="py-3 px-6 flex items-center gap-4">
              <span className="text-sm font-medium text-blue-800">
                {totalSelecionados} cliente(s) selecionado(s)
              </span>
              <div className="h-4 w-px bg-blue-200" />
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                onClick={handleOpenMassDispatch}
              >
                <img src="/icone-zap.png" alt="WhatsApp" className="h-4 w-4" />
                Disparo em massa
              </Button>



              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-blue-200 bg-white hover:bg-blue-100 text-blue-700 gap-2"
                    disabled={syncChatLoading}
                  >
                    {syncChatLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Settings2 className="h-4 w-4" />
                    )}
                    Ações
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-[220px] z-[9999]">
                  <DropdownMenuLabel>Ações disponíveis</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {canUseChatbotOutbound && (
                    <>
                      <DropdownMenuItem
                        className="cursor-pointer text-purple-600 focus:text-purple-700 font-medium"
                        onClick={handleOpenBulkAssignChatbot}
                      >
                        <Bot className="h-4 w-4 mr-2" />
                        Atribuir Chatbot (IA)
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-pointer">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Mover de estágio
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-[180px] z-[9999]" avoidCollisions={false}>
                      {KANBAN_STAGES.map((stage) => (
                        <DropdownMenuItem
                          key={stage.code}
                          onClick={() => {
                            setPendingBulkStage(stage)
                            setBulkMoveConfirmOpen(true)
                          }}
                          className="cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <span className={cn("w-2 h-2 rounded-full", stage.dotColor)} />
                            {stage.title}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuItem
                    className="cursor-pointer text-blue-600 focus:text-blue-700"
                    onClick={() => setSyncChatConfirmOpen(true)}
                  >
                    <Link2Off className="h-4 w-4 mr-2" />
                    Limpar vínculos antigos
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    className="cursor-pointer text-red-600 focus:text-red-700"
                    onClick={() => setReturnToResearchConfirmOpen(true)}
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Mandar para pesquisa
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 bg-white hover:bg-blue-50" onClick={resetSelection} disabled={syncChatLoading}>
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
            </CardContent>
          </Card>
        )
      }
      {/* Modal de Confirmação de Movimento em Massa */}
      <AlertDialog open={bulkMoveConfirmOpen} onOpenChange={setBulkMoveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar movimento em massa</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a mover <span className="font-bold text-foreground">{totalSelecionados} clientes</span> para a etapa{" "}
              <span className="font-bold text-foreground">"{pendingBulkStage?.title}"</span>.
              <br /><br />
              Essa ação atualizará o status de todos os clientes selecionados simultaneamente. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                if (pendingBulkStage) {
                  handleUpdateKanbanState(Array.from(selectedClientIds), pendingBulkStage.code)
                }
              }}
            >
              Confirmar e Mover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de Retorno para Pesquisa em Massa */}
      <AlertDialog open={returnToResearchConfirmOpen} onOpenChange={setReturnToResearchConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retornar {selectedClientIds.size} clientes para pesquisa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá remover os clientes selecionados da sua carteira e retorná-los para a equipe de pesquisa.
              Somente clientes nas categorias EXPLORADO ou AGENDADO serão processados.
              Esta ação não pode ser desfeita em massa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={returningToResearch}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleBulkReturnToResearch()
              }}
              disabled={returningToResearch}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {returningToResearch ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processando...
                </>
              ) : (
                "Confirmar Retorno"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Confirmação de Sincronização de Chat */}
      <AlertDialog open={syncChatConfirmOpen} onOpenChange={setSyncChatConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar limpeza de vínculos</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá remover os vínculos de chat (conversas) dos <span className="font-bold">{totalSelecionados} clientes</span> selecionados que
              <span className="font-bold underline ml-1">não correspondem</span> aos telefones atuais da ficha.
              <br /><br />
              Deseja continuar com a sincronização?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => handleBulkSyncChatContacts(Array.from(selectedClientIds))}
            >
              Confirmar e Sincronizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Resultado da Sincronização */}
      <Dialog open={syncChatResultOpen} onOpenChange={setSyncChatResultOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Sincronização Concluída
            </DialogTitle>
            <DialogDescription>
              Processamos {syncChatResultData?.processed} clientes e removemos {syncChatResultData?.unlinkedCount} vínculos obsoletos.
            </DialogDescription>
          </DialogHeader>

          {syncChatResultData?.unlinkedItems && syncChatResultData.unlinkedItems.length > 0 ? (
            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-2">Itens removidos:</h4>
              <ScrollArea className="h-[300px] border rounded-md p-4">
                <div className="space-y-4">
                  {syncChatResultData.unlinkedItems.map((item, idx) => (
                    <div key={idx} className="flex flex-col border-b last:border-0 pb-2">
                      <span className="text-sm font-bold text-blue-700">{item.razaoSocial}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <Link2Off className="h-3 w-3 text-red-500" />
                        <span className="text-xs text-muted-foreground">
                          Contato: {item.contactName || "Sem nome"} ({item.contactWaId})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Nenhum vínculo antigo foi encontrado para remoção nestes clientes.
            </div>
          )}

          <div className="flex justify-end mt-4">
            <Button onClick={() => setSyncChatResultOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout >
  )
}

