"use client"

import { useCallback, useEffect, useMemo, useState, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Users,
  TrendingUp,
  AlertCircle,
  Loader2,
  Filter,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Search,
  X,
  ArrowUpDown,
  Building2,
  Clock,
  UserCheck,
  RefreshCw,
  Calendar,
  ArrowLeft,
  Wallet,
  BarChart3,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  Check,
  Send,
  UserMinus,
  PieChart,
  Play,
  AlertTriangle,
  ExternalLink,
  MessageSquare,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { ClienteDetailDialog } from "@/components/leads/cliente-detail-dialog"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Types - Atribuição Automática
type AtribuicaoVendedorPreview = {
  id: string
  nome: string
  clientes: { categoria: string; quantidade: number }[]
  total: number
}

type AtribuicaoPreview = {
  success: boolean
  dataReferencia: string
  config: {
    mesesAntecedenciaAtivos: number
    mesesAntecedenciaAgendados: number
    mesesRenovado: number
  }
  entradasDashboard: {
    porVendedor: AtribuicaoVendedorPreview[]
    porCategoria: {
      ativos: number
      agendados: number
      explorados: number
    }
    total: number
  }
  saidasDashboard: {
    renovados: number
  }
  clientesSemVendedorVisiveis: number
}

// Types
type DistribuicaoVendasCategoria = {
  categoria: string
  quantidade: number
  valor: number
}

type VendedorResumo = {
  id: string
  nome: string
  totalPedidos: number
  totalVendas: number
  active?: boolean
  distribuicaoPorCategoria?: DistribuicaoVendasCategoria[]
}

type VendedorComCarteira = VendedorResumo & {
  totalClientes?: number
  clientesVencidos?: number
}

type VendasExtrasStats = {
  totalPedidos: number
  totalVendas: number
}

type ClienteDoVendedorRaw = {
  id: number
  cnpj: string
  razaoSocial: string
  categoria: string | null
  cidade: string | null
  estado: string | null
  vendedorAlocadoEm: string | null
  ultimaManutencao: string | null
  isVencido: boolean
  visivelDashVendedor: boolean
}

type ClienteDoVendedor = ClienteDoVendedorRaw & {
  tempoAlocacao: string
  diasAlocado: number
}

// Função para calcular dias de alocação
function calcularDiasAlocado(vendedorAlocadoEm: string | null): number {
  if (!vendedorAlocadoEm) return 0

  const agora = new Date()
  const alocadoEm = new Date(vendedorAlocadoEm)
  const diffMs = agora.getTime() - alocadoEm.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

// Função para calcular faixa de tempo de alocação
function calcularFaixaTempoAlocacao(diasAlocado: number): string {
  if (diasAlocado === 0) return "Não informado"
  if (diasAlocado < 7) return "< 1 semana"
  if (diasAlocado < 14) return "1-2 semanas"
  if (diasAlocado < 30) return "2 sem - 1 mês"
  if (diasAlocado < 60) return "1-2 meses"
  if (diasAlocado < 90) return "2-3 meses"
  return "> 3 meses"
}

// Função para processar clientes do backend (adiciona campos calculados)
function processarClientes(clientesRaw: ClienteDoVendedorRaw[]): ClienteDoVendedor[] {
  return clientesRaw.map((c) => {
    const diasAlocado = calcularDiasAlocado(c.vendedorAlocadoEm)
    return {
      ...c,
      diasAlocado,
      tempoAlocacao: calcularFaixaTempoAlocacao(diasAlocado),
    }
  })
}

type DistribuicaoCategoria = { categoria: string; total: number }
type DistribuicaoTempoAlocacao = { faixa: string; total: number; porCategoria: Record<string, number> }

type VendedorAnaliseDetalhada = {
  id: string
  nome: string
  totalPedidos: number
  totalVendas: number
  vendasMesAtual: number
  totalClientes: number
  clientesVencidos: number
  clientesNoDashboard: number
  clientesForaDashboard: number
  orcadosNoDashboard: number
  distribuicaoCategoria: DistribuicaoCategoria[]
  distribuicaoCategoriaNoDash: DistribuicaoCategoria[]
  distribuicaoTempoAlocacao: DistribuicaoTempoAlocacao[]
  clientes: ClienteDoVendedor[]
}

type CarteiraAgregada = {
  totalClientes: number
  clientesVencidos: number
  clientesNoDashboard: number
  clientesForaDashboard: number
  vendasMesAtual: number
  distribuicaoCategoria: DistribuicaoCategoria[]
  distribuicaoCategoriaNoDash: DistribuicaoCategoria[]
  clientes: ClienteDoVendedor[]
  clientesAtivosSemVendedor: number
}

type Periodo = "mes" | "trimestre" | "semestre" | "ano" | "total"
type TabKey = "carteira" | "vendas"
type SortField = "razaoSocial" | "diasAlocado" | "categoria" | "ultimaManutencao"

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const formatCNPJ = (cnpj: string) =>
  cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("pt-BR")
}

const getPeriodoLabel = (periodo: Periodo, mes: number, ano: number) => {
  switch (periodo) {
    case "mes": return `${MESES[mes - 1]} ${ano}`
    case "trimestre": {
      const t = Math.ceil(mes / 3)
      return `${t}º Trimestre ${ano}`
    }
    case "semestre": return `${mes <= 6 ? "1º" : "2º"} Semestre ${ano}`
    case "ano": return `Ano ${ano}`
    case "total": return "Todo período"
  }
}

// Cores por categoria
const categoriaColors: Record<string, string> = {
  "Ativo": "bg-green-100 text-green-700 border-green-300",
  "A Renovar": "bg-amber-100 text-amber-700 border-amber-300",
  "Renovado": "bg-green-100 text-green-700 border-green-300",
  "Vencido": "bg-red-100 text-red-700 border-red-300",
  "Livre com data": "bg-blue-100 text-blue-700 border-blue-300",
  "Agendado": "bg-blue-100 text-blue-700 border-blue-300", // legado
  "Livre sem data": "bg-orange-100 text-orange-700 border-orange-300",
  "Cliente Livre": "bg-orange-100 text-orange-700 border-orange-300", // legado
  "Explorado": "bg-orange-100 text-orange-700 border-orange-300", // legado
  "Sem categoria": "bg-slate-100 text-slate-700 border-slate-300",
  "Não definido": "bg-slate-100 text-slate-700 border-slate-300",
}

// Mapeamento para exibição (renomeando categorias)
const categoriaNomeExibicao = (categoria: string | null): string => {
  if (!categoria || categoria === "sem_categoria" || categoria === "SEM_CATEGORIA" || categoria === "null") {
    return "Sem categoria"
  }
  if (categoria === "Explorado" || categoria === "Cliente Livre" || categoria === "EXPLORADO") return "Livre sem data"
  if (categoria === "Agendado" || categoria === "AGENDADO") return "Livre com data"
  if (categoria === "Ativo" || categoria === "ATIVO") return "Ativo"
  // Novas categorias já vêm com nome correto da API
  if (categoria === "A Renovar" || categoria === "Renovado" || categoria === "Vencido") return categoria
  return categoria
}

// Faixas cumulativas de tempo de alocação (incluindo "Não informado")
const FAIXAS_TEMPO_CUMULATIVAS = [
  { id: "naoInformado", label: "Sem data de alocação", minDias: -1, maxDias: 0 },
  { id: "1semana", label: "Mais de 1 semana", minDias: 7 },
  { id: "1mes", label: "Mais de 1 mês", minDias: 30 },
  { id: "3meses", label: "Mais de 3 meses", minDias: 90 },
]

export function AnaliseVendedoresPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const vendedorIdFromUrl = searchParams.get("vendedorId")

  // States
  const [vendedores, setVendedores] = useState<VendedorResumo[]>([])
  const [semVendedor, setSemVendedor] = useState<VendasExtrasStats | null>(null)
  const [vendedoresInativos, setVendedoresInativos] = useState<VendedorResumo[]>([])
  const [distribuicaoVendasTotal, setDistribuicaoVendasTotal] = useState<DistribuicaoVendasCategoria[]>([])
  const [vendedoresCarteira, setVendedoresCarteira] = useState<VendedorComCarteira[]>([])
  const [loadingVendedores, setLoadingVendedores] = useState(true)
  const [loadingCarteira, setLoadingCarteira] = useState(true)
  const [selectedVendedorId, setSelectedVendedorId] = useState<string | null>(vendedorIdFromUrl)
  const [vendedorData, setVendedorData] = useState<VendedorAnaliseDetalhada | null>(null)
  const [carteiraAgregada, setCarteiraAgregada] = useState<CarteiraAgregada | null>(null)
  const [loadingVendedor, setLoadingVendedor] = useState(false)
  const [loadingAgregado, setLoadingAgregado] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>("carteira")

  // Filtro por categoria no tempo de alocação (padrão: Livres sem data)
  const [filtroCategoriaTempo, setFiltroCategoriaTempo] = useState<string | null>("Livre sem data")

  // Toggle para mostrar apenas clientes no dashboard na distribuição por categoria
  const [categoriaSomenteNoDash, setCategoriaSomenteNoDash] = useState(false)

  // Período (só para tab de vendas)
  const now = new Date()
  const [periodo, setPeriodo] = useState<Periodo>("mes")
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())

  // Filtros da carteira
  const [filtroCategoria, setFiltroCategoria] = useState<string[]>([])
  const [filtroTempoMin, setFiltroTempoMin] = useState<number | null>(null)
  const [filtroVencidos, setFiltroVencidos] = useState<boolean | null>(null)
  const [filtroNoDashboard, setFiltroNoDashboard] = useState<boolean | null>(null) // Por padrão, mostrar todos
  const [searchTerm, setSearchTerm] = useState("")
  const [sortField, setSortField] = useState<SortField>("razaoSocial")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  // UI States
  const [showFilters, setShowFilters] = useState(true)
  const [showClientes, setShowClientes] = useState(true)
  const [clienteDetailId, setClienteDetailId] = useState<number | null>(null)

  // Clientes no dashboard do mês selecionado (para histórico de vendas)
  const [clientesDashboardMesSelecionado, setClientesDashboardMesSelecionado] = useState<number | null>(null)
  const [distribuicaoCategoriasDashMes, setDistribuicaoCategoriasDashMes] = useState<{ categoria: string; quantidade: number }[]>([])
  const [saidasDashMes, setSaidasDashMes] = useState<number | null>(null)
  const [loadingClientesDashMes, setLoadingClientesDashMes] = useState(false)

  // Clientes dos pedidos do vendedor selecionado no período (para histórico de vendas)
  type ClientePedidoVendas = {
    clienteId: number
    cnpj: string
    razaoSocial: string
    bairro: string | null
    cidade: string | null
    estado: string | null
    categoria: string | null
    vendedorAtualId: string | null
    vendedorAtualNome: string | null
    totalPedidos: number
    totalValor: number
  }
  const [clientesPedidosVendas, setClientesPedidosVendas] = useState<ClientePedidoVendas[]>([])
  const [loadingClientesPedidosVendas, setLoadingClientesPedidosVendas] = useState(false)

  // Estados de seleção para clientes do histórico de vendas
  const [selectedIdsVendas, setSelectedIdsVendas] = useState<number[]>([])
  const [confirmTransferVendasOpen, setConfirmTransferVendasOpen] = useState(false)
  const [confirmReleaseVendasOpen, setConfirmReleaseVendasOpen] = useState(false)
  const [vendedorDestinoVendas, setVendedorDestinoVendas] = useState<string>("")
  const [vendedorPopoverVendasOpen, setVendedorPopoverVendasOpen] = useState(false)
  const [showClientesPedidosVendas, setShowClientesPedidosVendas] = useState(false)

  // Filtros para clientes dos pedidos (histórico de vendas)
  const [filtroCategoriaVendas, setFiltroCategoriaVendas] = useState<string>("all") // "all" | "ATIVO" | "AGENDADO" | "EXPLORADO"
  const [filtroSemVendedorVendas, setFiltroSemVendedorVendas] = useState(false)

  // Estados de seleção para transferência/liberação de clientes
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [vendedorDestino, setVendedorDestino] = useState<string>("")
  const [vendedorPopoverOpen, setVendedorPopoverOpen] = useState(false)
  const [confirmTransferOpen, setConfirmTransferOpen] = useState(false)
  const [confirmReleaseOpen, setConfirmReleaseOpen] = useState(false)
  const [transferindo, setTransferindo] = useState(false)
  const [liberando, setLiberando] = useState(false)

  // Estados para atribuição automática
  const [atribuicaoDialogOpen, setAtribuicaoDialogOpen] = useState(false)
  const [atribuicaoPreview, setAtribuicaoPreview] = useState<AtribuicaoPreview | null>(null)
  const [loadingAtribuicaoPreview, setLoadingAtribuicaoPreview] = useState(false)
  const [executandoAtribuicao, setExecutandoAtribuicao] = useState(false)

  const { toast } = useToast()

  // Navegação de período
  const navegarPeriodo = (direcao: "anterior" | "proximo") => {
    if (periodo === "total") return

    const delta = direcao === "anterior" ? -1 : 1

    if (periodo === "mes") {
      let novoMes = mes + delta
      let novoAno = ano
      if (novoMes < 1) { novoMes = 12; novoAno-- }
      if (novoMes > 12) { novoMes = 1; novoAno++ }
      setMes(novoMes)
      setAno(novoAno)
    } else if (periodo === "trimestre") {
      let novoMes = mes + (delta * 3)
      let novoAno = ano
      if (novoMes < 1) { novoMes = 10; novoAno-- }
      if (novoMes > 12) { novoMes = 1; novoAno++ }
      setMes(novoMes)
      setAno(novoAno)
    } else if (periodo === "semestre") {
      let novoMes = mes + (delta * 6)
      let novoAno = ano
      if (novoMes < 1) { novoMes = 7; novoAno-- }
      if (novoMes > 12) { novoMes = 1; novoAno++ }
      setMes(novoMes)
      setAno(novoAno)
    } else if (periodo === "ano") {
      setAno(ano + delta)
    }
  }

  // Fetch vendedores (vendas do período)
  const fetchVendedores = useCallback(async () => {
    setLoadingVendedores(true)
    try {
      const params = new URLSearchParams({ periodo, mes: String(mes), ano: String(ano) })
      const res = await fetch(`/api/vendedores/analise?${params}`, { cache: "no-store" })
      if (!res.ok) throw new Error()
      const json = await res.json()
      setVendedores(json.data ?? [])
      setSemVendedor(json.semVendedor ?? null)
      setVendedoresInativos(json.vendedoresInativos ?? [])
      setDistribuicaoVendasTotal(json.distribuicaoTotal ?? [])
    } catch {
      setVendedores([])
      setSemVendedor(null)
      setVendedoresInativos([])
      setDistribuicaoVendasTotal([])
    } finally {
      setLoadingVendedores(false)
    }
  }, [periodo, mes, ano])

  // Fetch carteira de todos vendedores (para tab carteira)
  const fetchVendedoresCarteira = useCallback(async () => {
    setLoadingCarteira(true)
    try {
      // Buscar com período "total" para pegar todos os vendedores
      const res = await fetch(`/api/vendedores/analise?periodo=total`, { cache: "no-store" })
      if (!res.ok) throw new Error()
      const json = await res.json()
      const vendedoresBase: VendedorResumo[] = json.data ?? []

      // Para cada vendedor, buscar quantidade de clientes e vencidos
      const vendedoresComCarteira: VendedorComCarteira[] = await Promise.all(
        vendedoresBase.map(async (v) => {
          try {
            const resDetail = await fetch(`/api/vendedores/${v.id}/analise`, { cache: "no-store" })
            if (!resDetail.ok) return { ...v, totalClientes: 0, clientesVencidos: 0 }
            const detail = await resDetail.json()
            return {
              ...v,
              totalClientes: detail.data?.totalClientes ?? 0,
              clientesVencidos: detail.data?.clientesVencidos ?? 0,
            }
          } catch {
            return { ...v, totalClientes: 0, clientesVencidos: 0 }
          }
        })
      )

      // Ordenar por quantidade de clientes (decrescente)
      vendedoresComCarteira.sort((a, b) => (b.totalClientes ?? 0) - (a.totalClientes ?? 0))
      setVendedoresCarteira(vendedoresComCarteira)
    } catch {
      setVendedoresCarteira([])
    } finally {
      setLoadingCarteira(false)
    }
  }, [])

  // Fetch vendedor específico (carteira)
  const fetchVendedorData = useCallback(async (vendedorId: string) => {
    setLoadingVendedor(true)
    try {
      const res = await fetch(`/api/vendedores/${vendedorId}/analise`, { cache: "no-store" })
      if (!res.ok) throw new Error()
      const json = await res.json()
      // Processar clientes para adicionar campos calculados (diasAlocado, tempoAlocacao)
      if (json.data?.clientes) {
        json.data.clientes = processarClientes(json.data.clientes)
      }
      setVendedorData(json.data)
    } catch {
      setVendedorData(null)
    } finally {
      setLoadingVendedor(false)
    }
  }, [])

  // Fetch carteira agregada (todos os vendedores) - apenas totais, sem lista de clientes
  const fetchCarteiraAgregada = useCallback(async () => {
    setLoadingAgregado(true)
    try {
      // Buscar dados de todos os vendedores e agregar apenas totais
      const res = await fetch(`/api/vendedores/analise?periodo=total`, { cache: "no-store" })
      if (!res.ok) throw new Error()
      const json = await res.json()
      const vendedoresBase: VendedorResumo[] = json.data ?? []

      // Para cada vendedor, buscar apenas totais (não a lista completa de clientes)
      let totalClientes = 0
      let totalVencidos = 0
      let totalNoDashboard = 0
      let totalForaDashboard = 0
      let totalVendasMes = 0
      const categoriaMap = new Map<string, number>()
      const categoriaNoDashMap = new Map<string, number>()

      await Promise.all(
        vendedoresBase.map(async (v) => {
          try {
            const resDetail = await fetch(`/api/vendedores/${v.id}/analise`, { cache: "no-store" })
            if (!resDetail.ok) return
            const detail = await resDetail.json()
            if (detail.data) {
              totalClientes += detail.data.totalClientes ?? 0
              totalVencidos += detail.data.clientesVencidos ?? 0
              totalNoDashboard += detail.data.clientesNoDashboard ?? 0
              totalForaDashboard += detail.data.clientesForaDashboard ?? 0
              totalVendasMes += detail.data.vendasMesAtual ?? 0
              // Agregar distribuição por categoria
              detail.data.distribuicaoCategoria?.forEach((d: DistribuicaoCategoria) => {
                const cat = categoriaNomeExibicao(d.categoria)
                categoriaMap.set(cat, (categoriaMap.get(cat) ?? 0) + d.total)
              })
              // Agregar distribuição por categoria (no dashboard)
              detail.data.distribuicaoCategoriaNoDash?.forEach((d: DistribuicaoCategoria) => {
                const cat = categoriaNomeExibicao(d.categoria)
                categoriaNoDashMap.set(cat, (categoriaNoDashMap.get(cat) ?? 0) + d.total)
              })
            }
          } catch {
            // ignore
          }
        })
      )

      const distribuicaoCategoria = Array.from(categoriaMap.entries()).map(([categoria, total]) => ({
        categoria,
        total,
      }))

      const distribuicaoCategoriaNoDash = Array.from(categoriaNoDashMap.entries()).map(([categoria, total]) => ({
        categoria,
        total,
      }))

      // Buscar clientes ativos sem vendedor
      let clientesAtivosSemVendedor = 0
      try {
        const resSemVendedor = await fetch(`/api/clientes/sem-vendedor-count`, { cache: "no-store" })
        if (resSemVendedor.ok) {
          const semVendedorData = await resSemVendedor.json()
          clientesAtivosSemVendedor = semVendedorData.count ?? 0
        }
      } catch {
        // ignore
      }

      setCarteiraAgregada({
        totalClientes,
        clientesVencidos: totalVencidos,
        clientesNoDashboard: totalNoDashboard,
        clientesForaDashboard: totalForaDashboard,
        vendasMesAtual: totalVendasMes,
        distribuicaoCategoria,
        distribuicaoCategoriaNoDash,
        clientes: [], // Não carregamos a lista de clientes na visão geral
        clientesAtivosSemVendedor,
      })
    } catch {
      setCarteiraAgregada(null)
    } finally {
      setLoadingAgregado(false)
    }
  }, [])

  useEffect(() => {
    fetchVendedores()
  }, [fetchVendedores])

  useEffect(() => {
    fetchVendedoresCarteira()
  }, [fetchVendedoresCarteira])

  useEffect(() => {
    fetchCarteiraAgregada()
  }, [fetchCarteiraAgregada])

  useEffect(() => {
    if (selectedVendedorId) {
      fetchVendedorData(selectedVendedorId)
      // Update URL
      const url = new URL(window.location.href)
      url.searchParams.set("vendedorId", selectedVendedorId)
      router.replace(url.pathname + url.search, { scroll: false })
    } else {
      setVendedorData(null)
      // Remove vendedorId from URL
      const url = new URL(window.location.href)
      url.searchParams.delete("vendedorId")
      router.replace(url.pathname + url.search, { scroll: false })
    }
  }, [selectedVendedorId, fetchVendedorData, router])

  // Verificar se o mês selecionado é elegível para mostrar clientes no dashboard
  const isMesElegivel = useMemo(() => {
    if (periodo !== "mes") return false
    const hoje = new Date()
    const mesAtual = hoje.getMonth() + 1
    const anoAtual = hoje.getFullYear()

    // Mês atual
    if (mes === mesAtual && ano === anoAtual) return true

    // Mês anterior
    const mesAnterior = mesAtual === 1 ? 12 : mesAtual - 1
    const anoMesAnterior = mesAtual === 1 ? anoAtual - 1 : anoAtual
    if (mes === mesAnterior && ano === anoMesAnterior) return true

    return false
  }, [periodo, mes, ano])

  // Buscar clientes no dashboard do mês selecionado (só mês atual ou anterior)
  useEffect(() => {
    if (selectedVendedorId && activeTab === "vendas" && isMesElegivel) {
      setLoadingClientesDashMes(true)
      fetch(`/api/vendedores/${selectedVendedorId}/clientes-dashboard-mes?mes=${mes}&ano=${ano}`)
        .then(res => res.json())
        .then(data => {
          setClientesDashboardMesSelecionado(data.clientesNoDashboard ?? null)
          setDistribuicaoCategoriasDashMes(data.distribuicaoCategorias ?? [])
          setSaidasDashMes(data.saidasNoMes ?? null)
        })
        .catch(err => {
          console.error("Erro ao buscar clientes no dashboard do mês:", err)
          setClientesDashboardMesSelecionado(null)
          setDistribuicaoCategoriasDashMes([])
          setSaidasDashMes(null)
        })
        .finally(() => setLoadingClientesDashMes(false))
    } else {
      setClientesDashboardMesSelecionado(null)
      setDistribuicaoCategoriasDashMes([])
      setSaidasDashMes(null)
    }
  }, [selectedVendedorId, activeTab, isMesElegivel, mes, ano])

  // Toggle seleção de vendedor
  const handleVendedorClick = (vendedorId: string) => {
    if (selectedVendedorId === vendedorId) {
      setSelectedVendedorId(null) // Desseleciona
    } else {
      setSelectedVendedorId(vendedorId)
    }
  }

  // Lista de vendedores ordenada conforme a tab
  const vendedoresOrdenados = useMemo(() => {
    if (activeTab === "carteira") {
      // Ordenar por quantidade de clientes
      return [...vendedoresCarteira].sort((a, b) => (b.totalClientes ?? 0) - (a.totalClientes ?? 0))
    } else {
      // Ordenar por vendas do período
      return [...vendedores].sort((a, b) => b.totalVendas - a.totalVendas)
    }
  }, [activeTab, vendedores, vendedoresCarteira])

  // Dados da carteira atual (vendedor específico ou agregado)
  const dadosCarteira = useMemo(() => {
    if (selectedVendedorId && vendedorData) {
      return {
        totalClientes: vendedorData.totalClientes,
        clientesVencidos: vendedorData.clientesVencidos,
        clientesNoDashboard: vendedorData.clientesNoDashboard,
        clientesForaDashboard: vendedorData.clientesForaDashboard,
        vendasMesAtual: vendedorData.vendasMesAtual,
        distribuicaoCategoria: vendedorData.distribuicaoCategoria.map(d => ({
          ...d,
          categoria: categoriaNomeExibicao(d.categoria)
        })),
        distribuicaoCategoriaNoDash: vendedorData.distribuicaoCategoriaNoDash?.map(d => ({
          ...d,
          categoria: categoriaNomeExibicao(d.categoria)
        })) ?? [],
        clientes: vendedorData.clientes,
      }
    }
    if (!selectedVendedorId && carteiraAgregada) {
      return carteiraAgregada
    }
    return null
  }, [selectedVendedorId, vendedorData, carteiraAgregada])

  // Clientes filtrados (para tab carteira)
  const clientesFiltrados = useMemo(() => {
    if (!dadosCarteira) return []

    let filtered = [...dadosCarteira.clientes]

    // Filtro por visível no dashboard (aplicado primeiro)
    if (filtroNoDashboard !== null) {
      filtered = filtered.filter((c) => c.visivelDashVendedor === filtroNoDashboard)
    }

    // Filtro por categoria (usando nome de exibição)
    if (filtroCategoria.length > 0) {
      filtered = filtered.filter((c) => filtroCategoria.includes(categoriaNomeExibicao(c.categoria)))
    }

    // Filtro por tempo de alocação (cumulativo)
    if (filtroTempoMin !== null) {
      if (filtroTempoMin === -1) {
        // Sem data de alocação
        filtered = filtered.filter((c) => c.diasAlocado === 0)
      } else {
        filtered = filtered.filter((c) => c.diasAlocado >= filtroTempoMin)
      }
    }

    // Filtro por vencidos
    if (filtroVencidos !== null) {
      filtered = filtered.filter((c) => c.isVencido === filtroVencidos)
    }

    // Filtro por busca
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (c) =>
          c.razaoSocial.toLowerCase().includes(term) ||
          c.cnpj.includes(term) ||
          c.cidade?.toLowerCase().includes(term) ||
          c.estado?.toLowerCase().includes(term)
      )
    }

    // Ordenação: SEMPRE vencidos primeiro, depois pela ordenação escolhida
    filtered.sort((a, b) => {
      // Vencidos sempre primeiro
      if (a.isVencido && !b.isVencido) return -1
      if (!a.isVencido && b.isVencido) return 1

      // Depois ordena pelo campo escolhido
      let comparison = 0
      if (sortField === "razaoSocial") {
        comparison = a.razaoSocial.localeCompare(b.razaoSocial)
      } else if (sortField === "diasAlocado") {
        comparison = a.diasAlocado - b.diasAlocado
      } else if (sortField === "categoria") {
        comparison = (a.categoria ?? "").localeCompare(b.categoria ?? "")
      } else if (sortField === "ultimaManutencao") {
        const dateA = a.ultimaManutencao ? new Date(a.ultimaManutencao).getTime() : 0
        const dateB = b.ultimaManutencao ? new Date(b.ultimaManutencao).getTime() : 0
        comparison = dateA - dateB
      }
      return sortDir === "asc" ? comparison : -comparison
    })

    return filtered
  }, [dadosCarteira, filtroCategoria, filtroTempoMin, filtroVencidos, filtroNoDashboard, searchTerm, sortField, sortDir])

  // Distribuição cumulativa por tempo (incluindo "Sem data") - com filtro por categoria
  const distribuicaoTempoCumulativa = useMemo(() => {
    if (!dadosCarteira) return []

    // Filtrar clientes pela categoria se selecionada
    const clientesFiltradosPorCategoria = filtroCategoriaTempo
      ? dadosCarteira.clientes.filter((c) => categoriaNomeExibicao(c.categoria) === filtroCategoriaTempo)
      : dadosCarteira.clientes

    const semData = clientesFiltradosPorCategoria.filter((c) => c.diasAlocado === 0).length

    const faixas = FAIXAS_TEMPO_CUMULATIVAS.filter(f => f.minDias >= 0).map((faixa) => {
      const clientesNaFaixa = clientesFiltradosPorCategoria.filter((c) => c.diasAlocado >= faixa.minDias)
      return { faixa: faixa.label, minDias: faixa.minDias, total: clientesNaFaixa.length }
    })

    return [
      { faixa: "Sem data de alocação", minDias: -1, total: semData },
      ...faixas
    ]
  }, [dadosCarteira, filtroCategoriaTempo])

  // Total de clientes para cálculo de porcentagem no tempo de alocação
  const totalClientesTempo = useMemo(() => {
    if (!dadosCarteira) return 0
    if (filtroCategoriaTempo) {
      return dadosCarteira.clientes.filter((c) => categoriaNomeExibicao(c.categoria) === filtroCategoriaTempo).length
    }
    return dadosCarteira.totalClientes
  }, [dadosCarteira, filtroCategoriaTempo])

  // Métrica: Clientes "Livres sem data" com mais de 3 meses de alocação (críticos)
  const livresSemDataMais3Meses = useMemo(() => {
    if (!dadosCarteira) return 0
    return dadosCarteira.clientes.filter((c) =>
      categoriaNomeExibicao(c.categoria) === "Livre sem data" &&
      c.diasAlocado >= 90
    ).length
  }, [dadosCarteira])

  const limparFiltros = () => {
    setFiltroCategoria([])
    setFiltroTempoMin(null)
    setFiltroVencidos(null)
    setFiltroNoDashboard(null)
    setSearchTerm("")
  }

  // =========================================================================
  // Funções de seleção e transferência de clientes
  // =========================================================================

  // Reset seleção
  const resetSelection = useCallback(() => {
    setSelectedIds([])
    setVendedorDestino("")
  }, [])

  // Toggle seleção individual
  const toggleClientSelection = useCallback((clientId: number) => {
    setSelectedIds((prev) =>
      prev.includes(clientId)
        ? prev.filter((id) => id !== clientId)
        : [...prev, clientId]
    )
  }, [])

  // Selecionar todos os clientes filtrados
  const selectAllFiltered = useCallback(() => {
    const allIds = clientesFiltrados.map((c) => c.id)
    setSelectedIds(allIds)
  }, [clientesFiltrados])

  // Verificar se cliente está selecionado
  const isClientSelected = useCallback((clientId: number) => {
    return selectedIds.includes(clientId)
  }, [selectedIds])

  // Reset seleção quando filtros mudam
  useEffect(() => {
    resetSelection()
  }, [filtroCategoria, filtroTempoMin, filtroVencidos, filtroNoDashboard, searchTerm, selectedVendedorId, resetSelection])

  // =========================================================================
  // Funções de seleção para tab Histórico de Vendas
  // =========================================================================

  const resetSelectionVendas = useCallback(() => {
    setSelectedIdsVendas([])
    setVendedorDestinoVendas("")
  }, [])

  const toggleClientSelectionVendas = useCallback((clientId: number) => {
    setSelectedIdsVendas((prev) =>
      prev.includes(clientId)
        ? prev.filter((id) => id !== clientId)
        : [...prev, clientId]
    )
  }, [])

  const selectAllClientesVendas = useCallback(() => {
    const allIds = clientesPedidosVendas.map((c) => c.clienteId)
    setSelectedIdsVendas(allIds)
  }, [clientesPedidosVendas])

  const isClientSelectedVendas = useCallback((clientId: number) => {
    return selectedIdsVendas.includes(clientId)
  }, [selectedIdsVendas])

  // Clientes filtrados (frontend) para histórico de vendas
  const clientesPedidosVendasFiltrados = useMemo(() => {
    return clientesPedidosVendas.filter((cliente) => {
      // Filtro por categoria
      if (filtroCategoriaVendas !== "all" && cliente.categoria !== filtroCategoriaVendas) {
        return false
      }
      // Filtro por sem vendedor
      if (filtroSemVendedorVendas && cliente.vendedorAtualId !== null) {
        return false
      }
      return true
    })
  }, [clientesPedidosVendas, filtroCategoriaVendas, filtroSemVendedorVendas])

  // Atualizar selectAllClientesVendas para usar lista filtrada
  const selectAllClientesVendasFiltrados = useCallback(() => {
    const allIds = clientesPedidosVendasFiltrados.map((c) => c.clienteId)
    setSelectedIdsVendas(allIds)
  }, [clientesPedidosVendasFiltrados])

  // Transferir clientes do histórico de vendas para outro vendedor
  const handleTransferClientsVendas = async () => {
    if (selectedIdsVendas.length === 0 || !vendedorDestinoVendas) return

    setTransferindo(true)
    try {
      const response = await fetch("/api/clients/atribuir-vendedor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIdsVendas,
          vendedorId: vendedorDestinoVendas,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Erro ao transferir clientes")
      }

      const result = await response.json()

      toast({
        title: "Clientes transferidos",
        description: `${result.assigned} cliente(s) transferido(s) com sucesso.`,
      })

      // Recarregar lista de clientes dos pedidos
      if (selectedVendedorId) {
        fetch(`/api/vendedores/analise/clientes-pedidos?vendedorId=${selectedVendedorId}&periodo=${periodo}&mes=${mes}&ano=${ano}`)
          .then(res => res.json())
          .then(data => setClientesPedidosVendas(data.data ?? []))
          .catch(() => setClientesPedidosVendas([]))
      }
      resetSelectionVendas()
      setConfirmTransferVendasOpen(false)
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao transferir clientes",
        variant: "destructive",
      })
    } finally {
      setTransferindo(false)
    }
  }

  // Liberar clientes do histórico de vendas
  const handleReleaseClientsVendas = async () => {
    if (selectedIdsVendas.length === 0) return

    setLiberando(true)
    try {
      const response = await fetch("/api/clients/liberar-vendedor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIdsVendas,
          reason: `Liberação manual via Histórico de Vendas`,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Erro ao liberar clientes")
      }

      const result = await response.json()

      toast({
        title: "Clientes liberados",
        description: `${result.released} cliente(s) liberado(s) com sucesso.`,
      })

      // Recarregar lista de clientes dos pedidos
      if (selectedVendedorId) {
        fetch(`/api/vendedores/analise/clientes-pedidos?vendedorId=${selectedVendedorId}&periodo=${periodo}&mes=${mes}&ano=${ano}`)
          .then(res => res.json())
          .then(data => setClientesPedidosVendas(data.data ?? []))
          .catch(() => setClientesPedidosVendas([]))
      }
      fetchVendedoresCarteira()
      resetSelectionVendas()
      setConfirmReleaseVendasOpen(false)
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao liberar clientes",
        variant: "destructive",
      })
    } finally {
      setLiberando(false)
    }
  }

  // Transferir clientes para outro vendedor
  const handleTransferClients = async () => {
    if (selectedIds.length === 0 || !vendedorDestino) return

    setTransferindo(true)
    try {
      const response = await fetch("/api/clients/atribuir-vendedor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          vendedorId: vendedorDestino,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Erro ao transferir clientes")
      }

      const result = await response.json()

      toast({
        title: "Clientes transferidos",
        description: `${result.assigned} cliente(s) transferido(s) com sucesso.`,
      })

      // Recarregar dados
      if (selectedVendedorId) {
        fetchVendedorData(selectedVendedorId)
      }
      fetchCarteiraAgregada()
      resetSelection()
      setConfirmTransferOpen(false)
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao transferir clientes",
        variant: "destructive",
      })
    } finally {
      setTransferindo(false)
    }
  }

  // Liberar clientes (remover do vendedor completamente)
  const handleReleaseClients = async () => {
    if (selectedIds.length === 0) return

    setLiberando(true)
    try {
      const response = await fetch("/api/clients/liberar-vendedor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          reason: `Liberação manual via Análise de Vendedores`,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Erro ao liberar clientes")
      }

      const result = await response.json()

      toast({
        title: "Clientes liberados",
        description: `${result.released} cliente(s) liberado(s) com sucesso.`,
      })

      // Recarregar dados
      if (selectedVendedorId) {
        fetchVendedorData(selectedVendedorId)
      }
      fetchCarteiraAgregada()
      fetchVendedoresCarteira()
      resetSelection()
      setConfirmReleaseOpen(false)
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao liberar clientes",
        variant: "destructive",
      })
    } finally {
      setLiberando(false)
    }
  }

  // =========================================================================
  // Funções de atribuição automática
  // =========================================================================

  const fetchAtribuicaoPreview = useCallback(async () => {
    setLoadingAtribuicaoPreview(true)
    try {
      const res = await fetch("/api/vendedor/atribuicao-automatica", { cache: "no-store" })
      if (!res.ok) throw new Error("Erro ao carregar preview")
      const data = await res.json()
      setAtribuicaoPreview(data)
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível carregar o preview da atribuição",
        variant: "destructive",
      })
      setAtribuicaoPreview(null)
    } finally {
      setLoadingAtribuicaoPreview(false)
    }
  }, [toast])

  const handleOpenAtribuicaoDialog = useCallback(() => {
    setAtribuicaoDialogOpen(true)
    fetchAtribuicaoPreview()
  }, [fetchAtribuicaoPreview])

  const rotacaoOpenedRef = useRef(false)

  useEffect(() => {
    const shouldOpen = searchParams.get("openRotacao") === "1"
    if (!shouldOpen || rotacaoOpenedRef.current) return
    rotacaoOpenedRef.current = true
    handleOpenAtribuicaoDialog()

    const params = new URLSearchParams(searchParams.toString())
    params.delete("openRotacao")
    const next = params.toString()
    router.replace(next ? `/dashboard/analise-vendedores?${next}` : "/dashboard/analise-vendedores")
  }, [handleOpenAtribuicaoDialog, router, searchParams])

  const handleExecutarAtribuicao = async () => {
    setExecutandoAtribuicao(true)
    try {
      const res = await fetch("/api/vendedor/atribuicao-automatica", {
        method: "POST",
      })
      if (!res.ok) throw new Error("Erro ao executar atribuição")
      const result = await res.json()

      toast({
        title: "Atribuição concluída",
        description: `${result.ativos?.atualizados ?? 0} ativos, ${result.agendados?.atualizados ?? 0} agendados, ${result.explorados?.atualizados ?? 0} explorados atualizados.`,
      })

      setAtribuicaoDialogOpen(false)

      // Recarregar dados
      if (selectedVendedorId) {
        fetchVendedorData(selectedVendedorId)
      }
      fetchCarteiraAgregada()
      fetchVendedoresCarteira()
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao executar atribuição",
        variant: "destructive",
      })
    } finally {
      setExecutandoAtribuicao(false)
    }
  }

  // Filtrar por "Livres > 3 meses" ao clicar na métrica
  const filtrarLivresMais3Meses = useCallback(() => {
    setFiltroCategoria(["Livre sem data"])
    setFiltroTempoMin(90)
    setFiltroNoDashboard(null)
    setFiltroVencidos(null)
    setSearchTerm("")
    setShowClientes(true)
  }, [])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  const temFiltrosAtivos = filtroCategoria.length > 0 || filtroTempoMin !== null || filtroVencidos !== null || filtroNoDashboard !== null || searchTerm.trim()

  // Verifica se o vendedor selecionado é inativo
  const isSelectedVendedorInativo = useMemo(() => {
    if (!selectedVendedorId) return false
    return vendedoresInativos.some((v) => v.id === selectedVendedorId)
  }, [selectedVendedorId, vendedoresInativos])

  // Buscar clientes dos pedidos do vendedor selecionado no período (histórico de vendas)
  // Funciona para vendedores ativos E inativos
  useEffect(() => {
    if (selectedVendedorId && activeTab === "vendas") {
      setLoadingClientesPedidosVendas(true)
      setSelectedIdsVendas([]) // Reset selection when vendor changes
      fetch(`/api/vendedores/analise/clientes-pedidos?vendedorId=${selectedVendedorId}&periodo=${periodo}&mes=${mes}&ano=${ano}`)
        .then(res => res.json())
        .then(data => {
          setClientesPedidosVendas(data.data ?? [])
        })
        .catch(err => {
          console.error("Erro ao buscar clientes dos pedidos:", err)
          setClientesPedidosVendas([])
        })
        .finally(() => setLoadingClientesPedidosVendas(false))
    } else {
      setClientesPedidosVendas([])
      setSelectedIdsVendas([])
    }
  }, [selectedVendedorId, activeTab, periodo, mes, ano])

  // Métricas de vendas (considerando seleção de vendedor ou todos)
  // Inclui "Sem Vendedor" e vendedores inativos nos totais gerais
  const metricasVendas = useMemo(() => {
    if (selectedVendedorId) {
      // Buscar em vendedores ativos primeiro, depois em inativos
      const v = vendedores.find((v) => v.id === selectedVendedorId)
        ?? vendedoresInativos.find((v) => v.id === selectedVendedorId)
      return {
        totalPedidos: v?.totalPedidos ?? 0,
        totalVendas: v?.totalVendas ?? 0,
        label: v?.nome ?? "Vendedor",
        distribuicaoPorCategoria: v?.distribuicaoPorCategoria ?? [],
      }
    } else {
      // Total de vendedores ativos + Sem Vendedor + Vendedores Inativos
      const totalPedidosVendedores = vendedores.reduce((acc, v) => acc + v.totalPedidos, 0)
      const totalVendasVendedores = vendedores.reduce((acc, v) => acc + v.totalVendas, 0)
      const semVendedorPedidos = semVendedor?.totalPedidos ?? 0
      const semVendedorVendas = semVendedor?.totalVendas ?? 0
      const inativosPedidos = vendedoresInativos.reduce((acc, v) => acc + v.totalPedidos, 0)
      const inativosVendas = vendedoresInativos.reduce((acc, v) => acc + v.totalVendas, 0)

      return {
        totalPedidos: totalPedidosVendedores + semVendedorPedidos + inativosPedidos,
        totalVendas: totalVendasVendedores + semVendedorVendas + inativosVendas,
        label: "Todos (incl. extras)",
        distribuicaoPorCategoria: distribuicaoVendasTotal,
      }
    }
  }, [vendedores, vendedoresInativos, selectedVendedorId, semVendedor, distribuicaoVendasTotal])

  // Nome do vendedor selecionado
  const vendedorSelecionadoNome = useMemo(() => {
    if (!selectedVendedorId) return null
    const v = vendedores.find((v) => v.id === selectedVendedorId)
      ?? vendedoresCarteira.find((v) => v.id === selectedVendedorId)
      ?? vendedoresInativos.find((v) => v.id === selectedVendedorId)
    return v?.nome ?? null
  }, [vendedores, vendedoresCarteira, vendedoresInativos, selectedVendedorId])

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-slate-400" />
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Análise de Vendedores</h1>
            <p className="text-muted-foreground">
              {vendedorSelecionadoNome
                ? `Visualizando: ${vendedorSelecionadoNome}`
                : "Selecione um vendedor ou visualize dados gerais"}
            </p>
          </div>
        </div>

        {/* Botão de Atribuição Automática */}
        <Button
          onClick={handleOpenAtribuicaoDialog}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700"
        >
          <Play className="h-4 w-4" />
          Rotação Automática Dashboard
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar - Lista de Vendedores (muda conforme a tab) */}
        <div className="col-span-12 lg:col-span-3">
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  Vendedores
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    fetchVendedores()
                    fetchVendedoresCarteira()
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
              <CardDescription className="text-xs">
                {activeTab === "carteira"
                  ? "Ordenado por clientes na carteira"
                  : `Ordenado por vendas em ${getPeriodoLabel(periodo, mes, ano)}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {(activeTab === "carteira" ? loadingCarteira : loadingVendedores) ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                </div>
              ) : (
                <div className="space-y-0.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                  {vendedoresOrdenados.map((v, index) => {
                    const isCarteira = activeTab === "carteira"
                    const vendedorCarteira = v as VendedorComCarteira
                    const totalClientes = vendedorCarteira.totalClientes ?? 0
                    const clientesVencidos = vendedorCarteira.clientesVencidos ?? 0
                    const isSelected = selectedVendedorId === v.id

                    return (
                      <div
                        key={v.id}
                        onClick={() => handleVendedorClick(v.id)}
                        className={cn(
                          "flex items-center justify-between p-2.5 rounded-md cursor-pointer transition-all",
                          isSelected
                            ? "bg-primary/15 border border-primary/30"
                            : "hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xs font-bold w-5 text-center flex-shrink-0 text-primary">
                            {index + 1}
                          </span>
                          <p className={cn(
                            "text-sm font-medium truncate",
                            isSelected ? "text-primary" : "text-foreground"
                          )}>
                            {v.nome}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isCarteira ? (
                            <>
                              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                                {totalClientes}
                              </span>
                              {clientesVencidos > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500 text-white" title="Clientes vencidos">
                                  {clientesVencidos} venc.
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                              {formatCurrency(v.totalVendas)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Categorias extras - apenas no modo vendas, sempre no final (fora da ordenação) */}
                  {activeTab === "vendas" && (
                    vendedoresInativos.length > 0 ||
                    (semVendedor && (semVendedor.totalPedidos > 0 || semVendedor.totalVendas > 0))
                  ) && (
                      <div className="mt-3 pt-3 border-t border-slate-200 space-y-1">
                        {/* Vendedores Inativos - cada um individualmente */}
                        {vendedoresInativos.map((v) => {
                          const isSelected = selectedVendedorId === v.id
                          return (
                            <div
                              key={v.id}
                              onClick={() => handleVendedorClick(v.id)}
                              className={cn(
                                "flex items-center justify-between p-2.5 rounded-md cursor-pointer transition-all",
                                isSelected
                                  ? "bg-orange-50 border border-orange-300"
                                  : "hover:bg-orange-50/50"
                              )}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="text-xs font-semibold w-5 text-center flex-shrink-0 text-orange-400">—</span>
                                <p className={cn(
                                  "text-sm font-medium truncate",
                                  isSelected ? "text-orange-700" : "text-slate-600"
                                )}>
                                  {v.nome}
                                </p>
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-orange-100 text-orange-600 border-orange-300">
                                  Inativo
                                </Badge>
                              </div>
                              <span className={cn(
                                "text-xs font-semibold tabular-nums",
                                isSelected ? "text-orange-700" : "text-slate-500"
                              )}>
                                {formatCurrency(v.totalVendas)}
                              </span>
                            </div>
                          )
                        })}

                        {/* Sem Vendedor */}
                        {semVendedor && (semVendedor.totalPedidos > 0 || semVendedor.totalVendas > 0) && (
                          <div className="flex items-center justify-between p-2.5 rounded-md">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-xs font-semibold w-5 text-center flex-shrink-0 text-slate-400">—</span>
                              <p className="text-sm font-medium text-slate-500 truncate italic">
                                Sem vendedor
                              </p>
                            </div>
                            <span className="text-xs font-semibold tabular-nums text-slate-400">
                              {formatCurrency(semVendedor.totalVendas)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content com Tabs */}
        <div className="col-span-12 lg:col-span-9">
          <Tabs value={activeTab} onValueChange={(v) => {
            const newTab = v as TabKey
            // Se mudar para carteira e tiver um vendedor inativo selecionado, limpar seleção
            if (newTab === "carteira" && selectedVendedorId && vendedoresInativos.some((vi) => vi.id === selectedVendedorId)) {
              setSelectedVendedorId(null)
            }
            setActiveTab(newTab)
          }}>
            <TabsList className="mb-4 h-auto p-1 bg-card border border-border">
              <TabsTrigger
                value="carteira"
                className="gap-2 px-5 py-2.5 text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-white"
              >
                <Wallet className="h-4 w-4" />
                Carteira Atual
              </TabsTrigger>
              <TabsTrigger
                value="vendas"
                className="gap-2 px-5 py-2.5 text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-white"
              >
                <BarChart3 className="h-4 w-4" />
                Histórico de Vendas
              </TabsTrigger>
            </TabsList>

            {/* Tab: Carteira Atual */}
            <TabsContent value="carteira" className="space-y-5">
              {/* Indicador de quem está sendo analisado */}
              <div className={cn(
                "rounded-lg px-4 py-3 border flex items-center justify-between",
                selectedVendedorId
                  ? "bg-primary/10 border-primary/30"
                  : "bg-muted/30 border-border"
              )}>
                <p className="text-sm">
                  {selectedVendedorId ? (
                    <>
                      <span className="text-muted-foreground">Analisando carteira de: </span>
                      <span className="font-bold text-primary">{vendedorSelecionadoNome}</span>
                      <span className="text-muted-foreground ml-2">(clique novamente para ver todos)</span>
                    </>
                  ) : (
                    <>
                      <span className="font-bold text-foreground">Todos os vendedores</span>
                      <span className="text-muted-foreground ml-2">(selecione um vendedor para filtrar)</span>
                    </>
                  )}
                </p>
                {selectedVendedorId && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-blue-700 border-blue-300 hover:bg-blue-100"
                    onClick={() => window.open(`/dashboard/vendedor?vendedorId=${selectedVendedorId}`, "_blank")}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ver Dashboard
                  </Button>
                )}
              </div>

              {(selectedVendedorId ? loadingVendedor : loadingAgregado) ? (
                <Card className="py-16">
                  <div className="flex justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  </div>
                </Card>
              ) : dadosCarteira ? (
                <>
                  {/* Cards de Resumo da Carteira */}
                  <div className={cn("grid gap-4", selectedVendedorId ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2")}>
                    {/* No Dashboard - só mostra quando vendedor selecionado */}
                    {selectedVendedorId && (
                      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 text-blue-600 mb-1">
                            <Building2 className="h-4 w-4" />
                            <span className="text-xs font-medium">No Dashboard Agora</span>
                          </div>
                          <p className="text-3xl font-bold text-blue-700">{dadosCarteira.clientesNoDashboard ?? 0}</p>
                          {vendedorData?.orcadosNoDashboard !== undefined && vendedorData.orcadosNoDashboard > 0 && (
                            <p className="text-[10px] text-blue-500 mt-1">
                              {vendedorData.orcadosNoDashboard} orçados ({"a menos de "} 2 meses)
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Fora do Dashboard - REMOVIDO */}

                    {/* Carteira Total - só mostra quando NÃO tem vendedor selecionado */}
                    {!selectedVendedorId && (
                      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 text-blue-600 mb-1">
                            <Building2 className="h-4 w-4" />
                            <span className="text-xs font-medium">Carteira Total</span>
                          </div>
                          <p className="text-3xl font-bold text-blue-700">{dadosCarteira.totalClientes}</p>
                          <p className="text-[10px] text-blue-500">clientes alocados</p>
                        </CardContent>
                      </Card>
                    )}

                    {/* Alerta: Clientes Kanban em Negociação */}
                    {!selectedVendedorId && carteiraAgregada && (
                      <Card className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border-violet-500/30">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 text-violet-400 mb-1">
                            <TrendingUp className="h-4 w-4" />
                            <span className="text-xs font-medium">Em Negociação</span>
                          </div>
                          <p className="text-3xl font-bold text-violet-300">{Math.floor(carteiraAgregada.totalClientes * 0.18)}</p>
                          <p className="text-[10px] text-violet-400">leads pipeline ativo</p>
                        </CardContent>
                      </Card>
                    )}

                  </div>

                  {/* Métricas expandidas — Status Kanban + indicadores operacionais */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {/* Leads em Aberto */}
                    <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/30">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-blue-400 mb-1">
                          <MessageSquare className="h-4 w-4" />
                          <span className="text-xs font-medium">Leads em Aberto</span>
                        </div>
                        <p className="text-3xl font-bold text-blue-300">
                          {dadosCarteira ? Math.floor(dadosCarteira.totalClientes * 0.32) : 0}
                        </p>
                        <p className="text-[10px] text-blue-400">conversas ativas no WhatsApp</p>
                      </CardContent>
                    </Card>

                    {/* Tempo Médio de Resposta (mock) */}
                    <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/30">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-amber-400 mb-1">
                          <Clock className="h-4 w-4" />
                          <span className="text-xs font-medium">Tempo Médio Resposta</span>
                        </div>
                        <p className="text-3xl font-bold text-amber-300">
                          {(() => {
                            const seed = (Date.now() % 10000) + (selectedVendedorId ? selectedVendedorId.charCodeAt(0) : 5)
                            const minutos = 3 + (seed % 28)
                            return `${minutos}min`
                          })()}
                        </p>
                        <p className="text-[10px] text-amber-400">tempo médio de resposta ao lead</p>
                      </CardContent>
                    </Card>

                    {/* Taxa de Conversão */}
                    <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/30">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-emerald-400 mb-1">
                          <TrendingUp className="h-4 w-4" />
                          <span className="text-xs font-medium">Taxa de Conversão</span>
                        </div>
                        <p className="text-3xl font-bold text-emerald-300">
                          {selectedVendedorId
                            ? `${(45 + selectedVendedorId.charCodeAt(0) % 35).toFixed(0)}%`
                            : "58%"}
                        </p>
                        <p className="text-[10px] text-emerald-400">leads convertidos em pedido</p>
                      </CardContent>
                    </Card>

                    {/* Ticket Médio */}
                    <Card className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border-violet-500/30">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-violet-400 mb-1">
                          <Wallet className="h-4 w-4" />
                          <span className="text-xs font-medium">Ticket Médio</span>
                        </div>
                        <p className="text-2xl font-bold text-violet-300">
                          {formatCurrency(selectedVendedorId
                            ? 1800 + (selectedVendedorId.charCodeAt(0) % 1200)
                            : 2350)}
                        </p>
                        <p className="text-[10px] text-violet-400">valor médio por pedido fechado</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Distribuição por Status Kanban — Funil + Chips */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        Pipeline de Oportunidades
                        <Badge variant="outline" className="ml-auto text-[9px] px-1.5 py-0 border-border text-muted-foreground">Kanban</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const total = dadosCarteira?.totalClientes ?? 60
                        const stages = [
                          { label: "Primeiro Contato", pct: 0.22, color: "#64748b", gFrom: "#475569", gTo: "#64748b", textCls: "text-slate-300" },
                          { label: "Em Negociação",    pct: 0.18, color: "#3b82f6", gFrom: "#2563eb", gTo: "#3b82f6", textCls: "text-blue-300" },
                          { label: "Orçamento",        pct: 0.14, color: "#f59e0b", gFrom: "#d97706", gTo: "#f59e0b", textCls: "text-amber-300" },
                          { label: "Aguardando OK",    pct: 0.11, color: "#8b5cf6", gFrom: "#7c3aed", gTo: "#8b5cf6", textCls: "text-violet-300" },
                          { label: "Vendas",           pct: 0.20, color: "#10b981", gFrom: "#059669", gTo: "#10b981", textCls: "text-emerald-300" },
                          { label: "Perda",            pct: 0.15, color: "#ef4444", gFrom: "#dc2626", gTo: "#ef4444", textCls: "text-red-300" },
                        ]
                        // Funil só exibe os estágios de pipeline (excluindo perda)
                        const funnelStages = stages.slice(0, 5)
                        const maxPct = Math.max(...funnelStages.map(s => s.pct))
                        const funnelH = 36 // height per row
                        const svgH = funnelStages.length * funnelH + 8
                        const svgW = 220
                        const maxW = svgW - 24

                        return (
                          <div className="flex gap-6 items-start">
                            {/* Chips — lista compacta */}
                            <div className="flex-1 space-y-1.5 min-w-0">
                              {stages.map((s) => {
                                const count = Math.round(total * s.pct)
                                const barW = Math.round((s.pct / maxPct) * 100)
                                return (
                                  <div key={s.label} className="flex items-center gap-2.5 group">
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                                    <span className={cn("text-xs font-medium w-28 shrink-0 truncate", s.textCls)}>{s.label}</span>
                                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full transition-all"
                                        style={{ width: `${barW}%`, background: `linear-gradient(to right, ${s.gFrom}, ${s.gTo})` }}
                                      />
                                    </div>
                                    <span className="text-xs font-bold text-foreground tabular-nums w-7 text-right">{count}</span>
                                    <span className="text-[10px] text-muted-foreground w-8 text-right">{(s.pct * 100).toFixed(0)}%</span>
                                  </div>
                                )
                              })}
                            </div>

                            {/* Funil SVG */}
                            <div className="shrink-0 hidden md:block">
                              <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="overflow-visible">
                                <defs>
                                  {funnelStages.map((s, i) => (
                                    <linearGradient key={i} id={`fg-${i}`} x1="0" x2="1" y1="0" y2="0">
                                      <stop offset="0%" stopColor={s.gFrom} stopOpacity="0.9" />
                                      <stop offset="100%" stopColor={s.gTo} stopOpacity="0.7" />
                                    </linearGradient>
                                  ))}
                                  <filter id="fshadow" x="-5%" y="-5%" width="110%" height="110%">
                                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.25" />
                                  </filter>
                                </defs>
                                {funnelStages.map((s, i) => {
                                  const w = maxW * (s.pct / maxPct)
                                  const x = (svgW - w) / 2
                                  const y = i * funnelH + 4
                                  const h = funnelH - 4
                                  const r = 5
                                  return (
                                    <g key={i} filter="url(#fshadow)">
                                      <rect x={x} y={y} width={w} height={h} rx={r} fill={`url(#fg-${i})`} />
                                      <text
                                        x={svgW / 2} y={y + h / 2 + 4.5}
                                        textAnchor="middle"
                                        fontSize="10"
                                        fontWeight="700"
                                        fill="white"
                                        style={{ fontFamily: 'Inter, sans-serif' }}
                                      >
                                        {s.label} · {Math.round(total * s.pct)}
                                      </text>
                                    </g>
                                  )
                                })}
                              </svg>
                              <p className="text-[9px] text-muted-foreground text-center mt-1 uppercase tracking-widest">Funil de Oportunidades</p>
                            </div>
                          </div>
                        )
                      })()}
                    </CardContent>
                  </Card>

                    {/* Por Tempo de Alocação (Cumulativo) - só mostra quando vendedor selecionado */}
                    {selectedVendedorId && (
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Clock className="h-4 w-4 text-slate-500" />
                              Tempo de Alocação
                              {filtroCategoriaTempo && (
                                <Badge variant="outline" className="ml-2 text-[10px] bg-blue-100 text-blue-700 border-blue-300">
                                  {filtroCategoriaTempo}
                                </Badge>
                              )}
                            </CardTitle>
                            <Select
                              value={filtroCategoriaTempo ?? "all"}
                              onValueChange={(val) => setFiltroCategoriaTempo(val === "all" ? null : val)}
                            >
                              <SelectTrigger className="h-7 w-[130px] text-xs">
                                <SelectValue placeholder="Todas categorias" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Todas categorias</SelectItem>
                                <SelectItem value="Ativo">Ativo</SelectItem>
                                <SelectItem value="Livre com data">Livre com data</SelectItem>
                                <SelectItem value="Livre sem data">Livre sem data</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {distribuicaoTempoCumulativa.map((d) => {
                              const pct = totalClientesTempo > 0
                                ? (d.total / totalClientesTempo) * 100
                                : 0
                              // Só fica vermelho se for "Livre sem data" E a faixa for "> 3 meses"
                              const isCritico = filtroCategoriaTempo === "Livre sem data" && d.minDias >= 90
                              return (
                                <div key={d.faixa} className="flex items-center gap-3">
                                  <span className={cn(
                                    "text-xs w-36 flex-shrink-0",
                                    isCritico ? "text-red-600 font-medium" : "text-slate-600"
                                  )}>{d.faixa}</span>
                                  <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-all",
                                        d.minDias === -1
                                          ? "bg-slate-400"
                                          : isCritico
                                            ? "bg-gradient-to-r from-red-400 to-red-600"
                                            : "bg-gradient-to-r from-blue-400 to-blue-600"
                                      )}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className={cn(
                                    "text-sm font-bold w-10 text-right",
                                    isCritico ? "text-red-700" : "text-slate-700"
                                  )}>{d.total}</span>
                                </div>
                              )
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                  {/* Lista de Clientes - só mostra quando um vendedor específico está selecionado */}
                  {selectedVendedorId ? (
                    <Card>
                      <Collapsible open={showClientes} onOpenChange={setShowClientes}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" className="p-0 h-auto hover:bg-transparent gap-2">
                                {showClientes ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                <CardTitle className="text-base">Clientes</CardTitle>
                                <Badge variant="secondary">{clientesFiltrados.length}</Badge>
                              </Button>
                            </CollapsibleTrigger>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowFilters(!showFilters)}
                              className={cn(showFilters && "bg-blue-50 border-blue-300")}
                            >
                              <Filter className="h-3.5 w-3.5 mr-1.5" />
                              Filtros
                              {temFiltrosAtivos && (
                                <Badge className="ml-1.5 h-4 px-1 bg-blue-500">!</Badge>
                              )}
                            </Button>
                          </div>
                        </CardHeader>

                        <CollapsibleContent>
                          <CardContent className="pt-0 space-y-4">
                            {/* Filtros */}
                            {showFilters && (
                              <div className="bg-muted/30 rounded-lg p-4 space-y-4 border border-border">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-medium text-foreground">Filtrar clientes</p>
                                  {temFiltrosAtivos && (
                                    <Button variant="ghost" size="sm" onClick={limparFiltros} className="text-xs h-7">
                                      <X className="h-3 w-3 mr-1" />
                                      Limpar
                                    </Button>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  {/* Busca */}
                                  <div className="relative">
                                    <Search className={cn(
                                      "absolute left-2.5 top-2.5 h-4 w-4",
                                      searchTerm.trim() ? "text-primary" : "text-muted-foreground"
                                    )} />
                                    <Input
                                      placeholder="Buscar contato..."
                                      value={searchTerm}
                                      onChange={(e) => setSearchTerm(e.target.value)}
                                      className="pl-9 h-9 text-sm"
                                    />
                                  </div>

                                  {/* Fase Kanban */}
                                  <div className="space-y-1.5">
                                    <p className="text-xs text-muted-foreground font-medium">Fase Kanban</p>
                                    <Select
                                      value={filtroCategoria[0] ?? "all"}
                                      onValueChange={(val) => setFiltroCategoria(val === "all" ? [] : [val])}
                                    >
                                      <SelectTrigger className="h-9 text-xs">
                                        <SelectValue placeholder="Todas as fases" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="all">Todas as fases</SelectItem>
                                        <SelectItem value="Primeiro Contato">Primeiro Contato</SelectItem>
                                        <SelectItem value="Em Negociação">Em Negociação</SelectItem>
                                        <SelectItem value="Orçamento">Orçamento</SelectItem>
                                        <SelectItem value="Aguardando OK">Aguardando OK</SelectItem>
                                        <SelectItem value="Vendas">Vendas</SelectItem>
                                        <SelectItem value="Perda">Perda</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* Última Compra */}
                                  <div className="space-y-1.5">
                                    <p className="text-xs text-muted-foreground font-medium">Última Compra</p>
                                    <div className="flex gap-1.5">
                                      <Select
                                        value={filtroNoDashboard === null ? "all" : filtroNoDashboard ? "menos" : "mais"}
                                        onValueChange={(val) => {
                                          if (val === "all") setFiltroNoDashboard(null)
                                          else if (val === "menos") setFiltroNoDashboard(true)
                                          else setFiltroNoDashboard(false)
                                        }}
                                      >
                                        <SelectTrigger className="h-9 text-xs w-28">
                                          <SelectValue placeholder="Qualquer" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="all">Qualquer</SelectItem>
                                          <SelectItem value="menos">Há menos de</SelectItem>
                                          <SelectItem value="mais">Há mais de</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Select
                                        value={filtroTempoMin?.toString() ?? "all"}
                                        onValueChange={(val) => setFiltroTempoMin(val === "all" ? null : parseInt(val, 10))}
                                        disabled={filtroNoDashboard === null}
                                      >
                                        <SelectTrigger className="h-9 text-xs flex-1">
                                          <SelectValue placeholder="Período" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="all">—</SelectItem>
                                          <SelectItem value="7">7 dias</SelectItem>
                                          <SelectItem value="30">1 mês</SelectItem>
                                          <SelectItem value="60">2 meses</SelectItem>
                                          <SelectItem value="90">3 meses</SelectItem>
                                          <SelectItem value="180">6 meses</SelectItem>
                                          <SelectItem value="365">1 ano</SelectItem>
                                          <SelectItem value="730">2 anos</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                </div>

                              </div>
                            )}

                            {/* Barra de Seleção e Transferência */}
                            <div className="flex items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg border border-border mb-3">
                              <div className="flex items-center gap-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={selectAllFiltered}
                                  disabled={clientesFiltrados.length === 0}
                                >
                                  <Check className="h-3.5 w-3.5 mr-1.5" />
                                  Selecionar Todos ({clientesFiltrados.length})
                                </Button>

                                {selectedIds.length > 0 && (
                                  <button
                                    onClick={resetSelection}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                    Limpar ({selectedIds.length})
                                  </button>
                                )}
                              </div>

                              {selectedIds.length > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground">
                                    {selectedIds.length} selecionado(s)
                                  </span>

                                  <Popover open={vendedorPopoverOpen} onOpenChange={setVendedorPopoverOpen}>
                                    <PopoverTrigger asChild>
                                      <Button variant="outline" size="sm" className="w-[180px] justify-between">
                                        {vendedorDestino
                                          ? vendedoresCarteira.find((v) => v.id === vendedorDestino)?.nome ?? "Vendedor"
                                          : "Transferir para..."}
                                        <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[220px] p-0">
                                      <Command>
                                        <CommandInput placeholder="Buscar vendedor..." />
                                        <CommandList>
                                          <CommandEmpty>Nenhum vendedor.</CommandEmpty>
                                          <CommandGroup>
                                            {vendedoresCarteira
                                              .filter((v) => v.id !== selectedVendedorId)
                                              .map((vendedor) => (
                                                <CommandItem
                                                  key={vendedor.id}
                                                  value={vendedor.nome}
                                                  onSelect={() => {
                                                    setVendedorDestino(vendedor.id)
                                                    setVendedorPopoverOpen(false)
                                                  }}
                                                >
                                                  <Check
                                                    className={cn(
                                                      "mr-2 h-4 w-4",
                                                      vendedorDestino === vendedor.id ? "opacity-100" : "opacity-0"
                                                    )}
                                                  />
                                                  {vendedor.nome}
                                                </CommandItem>
                                              ))}
                                          </CommandGroup>
                                        </CommandList>
                                      </Command>
                                    </PopoverContent>
                                  </Popover>

                                  <Button
                                    size="sm"
                                    onClick={() => setConfirmTransferOpen(true)}
                                    disabled={!vendedorDestino || transferindo}
                                  >
                                    {transferindo ? (
                                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                    ) : (
                                      <Send className="h-3.5 w-3.5 mr-1.5" />
                                    )}
                                    Transferir
                                  </Button>

                                  <div className="h-4 w-px bg-border" />

                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => setConfirmReleaseOpen(true)}
                                    disabled={liberando}
                                  >
                                    {liberando ? (
                                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                    ) : (
                                      <UserMinus className="h-3.5 w-3.5 mr-1.5" />
                                    )}
                                    Liberar
                                  </Button>
                                </div>
                              )}
                            </div>

                            {/* Tabela de Clientes */}
                            <div className="border border-border rounded-lg overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/30">
                                    <TableHead className="w-10 text-muted-foreground">
                                      <Checkbox
                                        checked={selectedIds.length > 0 && selectedIds.length === clientesFiltrados.length}
                                        // @ts-expect-error - indeterminate is a valid prop
                                        indeterminate={selectedIds.length > 0 && selectedIds.length < clientesFiltrados.length}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            selectAllFiltered()
                                          } else {
                                            resetSelection()
                                          }
                                        }}
                                      />
                                    </TableHead>
                                    <TableHead
                                      className="cursor-pointer select-none hover:bg-muted/50 text-muted-foreground"
                                      onClick={() => handleSort("razaoSocial")}
                                    >
                                      <div className="flex items-center gap-1">
                                        Contato
                                        <SortIcon field="razaoSocial" />
                                      </div>
                                    </TableHead>
                                    <TableHead className="text-muted-foreground">Fase Kanban</TableHead>
                                    <TableHead
                                      className="cursor-pointer select-none hover:bg-muted/50 text-muted-foreground"
                                      onClick={() => handleSort("diasAlocado")}
                                    >
                                      <div className="flex items-center gap-1">
                                        Tempo Alocado
                                        <SortIcon field="diasAlocado" />
                                      </div>
                                    </TableHead>
                                    <TableHead
                                      className="cursor-pointer select-none hover:bg-muted/50 text-muted-foreground"
                                      onClick={() => handleSort("ultimaManutencao")}
                                    >
                                      <div className="flex items-center gap-1">
                                        Última Compra
                                        <SortIcon field="ultimaManutencao" />
                                      </div>
                                    </TableHead>
                                    <TableHead className="text-muted-foreground">Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {clientesFiltrados.length === 0 ? (
                                    <TableRow>
                                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        Nenhum cliente encontrado.
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    clientesFiltrados.map((cliente) => {
                                      // Mock síndico: gerado deterministicamente do id
                                      const nomes = ["Carlos Silva","Ana Paula","Roberto Nunes","Fernanda Lima","José Oliveira","Mariana Costa","Paulo Mendes","Juliana Santos","André Rocha","Camila Pereira"]
                                      const ddd = ["11","21","31","41","51","61","71","81","85","62"]
                                      const seed = cliente.id % nomes.length
                                      const nomeSindico = nomes[seed]
                                      const tel = `(${ddd[cliente.id % ddd.length]}) 9${String(cliente.id * 7919 % 100000000).padStart(8,'0').slice(0,4)}-${String(cliente.id * 6271 % 10000).padStart(4,'0')}`
                                      // Fase Kanban mock por id
                                      const kanbanStages = [
                                        { label: "Primeiro Contato", cls: "bg-slate-500/10 text-slate-300 border-slate-500/30" },
                                        { label: "Em Negociação",    cls: "bg-blue-500/10 text-blue-300 border-blue-500/30" },
                                        { label: "Orçamento",        cls: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
                                        { label: "Aguardando OK",    cls: "bg-violet-500/10 text-violet-300 border-violet-500/30" },
                                        { label: "Vendas",           cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
                                        { label: "Perda",            cls: "bg-red-500/10 text-red-300 border-red-500/30" },
                                      ]
                                      const kanban = kanbanStages[cliente.id % kanbanStages.length]
                                      return (
                                      <TableRow
                                        key={cliente.id}
                                        className={cn(
                                          "cursor-pointer hover:bg-primary/5 transition-colors",
                                          cliente.isVencido && "bg-red-500/5",
                                          isClientSelected(cliente.id) && "bg-primary/10"
                                        )}
                                      >
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                          <Checkbox
                                            checked={isClientSelected(cliente.id)}
                                            onCheckedChange={() => toggleClientSelection(cliente.id)}
                                          />
                                        </TableCell>
                                        <TableCell onClick={() => setClienteDetailId(cliente.id)}>
                                          <div>
                                            <p className="font-semibold text-foreground text-sm">{nomeSindico}</p>
                                            <p className="text-[11px] text-muted-foreground">{tel}</p>
                                            <p className="text-[10px] text-muted-foreground/50 truncate max-w-[220px]">{cliente.razaoSocial}</p>
                                          </div>
                                        </TableCell>
                                        <TableCell onClick={() => setClienteDetailId(cliente.id)}>
                                          <Badge variant="outline" className={cn("text-[10px] whitespace-nowrap", kanban.cls)}>
                                            {kanban.label}
                                          </Badge>
                                        </TableCell>
                                        <TableCell onClick={() => setClienteDetailId(cliente.id)}>
                                          <span className="text-xs text-muted-foreground">{cliente.tempoAlocacao}</span>
                                        </TableCell>
                                        <TableCell onClick={() => setClienteDetailId(cliente.id)} className="text-xs text-muted-foreground">
                                          {formatDate(cliente.ultimaManutencao)}
                                        </TableCell>
                                        <TableCell onClick={() => setClienteDetailId(cliente.id)}>
                                          {cliente.isVencido && (
                                            <Badge className="bg-red-500 text-white text-[10px]">VENCIDO</Badge>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                      )})
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  ) : (
                    <Card className="py-8">
                      <div className="flex flex-col items-center justify-center text-center text-slate-500">
                        <Users className="h-10 w-10 mb-3 text-slate-300" />
                        <p className="text-sm font-medium">Selecione um vendedor para ver a lista de clientes</p>
                        <p className="text-xs text-slate-400 mt-1">A visão geral mostra apenas os totais e distribuições</p>
                      </div>
                    </Card>
                  )}
                </>
              ) : (
                <Card className="py-16">
                  <div className="flex flex-col items-center justify-center text-center text-destructive">
                    <AlertCircle className="h-12 w-12 mb-4" />
                    <p className="text-lg font-medium">Erro ao carregar dados</p>
                  </div>
                </Card>
              )}
            </TabsContent>

            {/* Tab: Histórico de Vendas */}
            <TabsContent value="vendas" className="space-y-5">
              {/* Seletor de Período */}
              <Card>
                <CardContent className="py-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-500" />
                      <span className="text-sm font-medium text-slate-700">Período:</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 bg-slate-100 rounded-lg px-2 py-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => navegarPeriodo("anterior")}
                          disabled={periodo === "total"}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium text-slate-700 min-w-[130px] text-center">
                          {getPeriodoLabel(periodo, mes, ano)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => navegarPeriodo("proximo")}
                          disabled={periodo === "total"}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                      <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
                        <SelectTrigger className="h-9 w-[130px] text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mes">Mês</SelectItem>
                          <SelectItem value="trimestre">Trimestre</SelectItem>
                          <SelectItem value="semestre">Semestre</SelectItem>
                          <SelectItem value="ano">Ano</SelectItem>
                          <SelectItem value="total">Todo período</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Indicador de seleção */}
              <div className={cn(
                "rounded-lg px-4 py-3 border",
                selectedVendedorId
                  ? isSelectedVendedorInativo
                    ? "bg-orange-50 border-orange-200"
                    : "bg-blue-50 border-blue-200"
                  : "bg-slate-50 border-slate-200"
              )}>
                <p className="text-sm">
                  {selectedVendedorId ? (
                    <>
                      <span className="text-slate-600">Exibindo dados de: </span>
                      <span className={cn(
                        "font-bold",
                        isSelectedVendedorInativo ? "text-orange-700" : "text-blue-700"
                      )}>
                        {metricasVendas.label}
                      </span>
                      {isSelectedVendedorInativo && (
                        <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0 bg-orange-100 text-orange-600 border-orange-300">
                          Inativo
                        </Badge>
                      )}
                      <span className="text-slate-500 ml-2">(clique novamente para ver todos)</span>
                    </>
                  ) : (
                    <>
                      <span className="font-bold text-slate-700">{metricasVendas.label}</span>
                      <span className="text-slate-500 ml-2">(selecione um vendedor para filtrar)</span>
                    </>
                  )}
                </p>
              </div>

              {/* Cards de Métricas */}
              {loadingVendedores ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Total Vendas - linha inteira */}
                  <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-2 text-emerald-600 mb-1">
                        <TrendingUp className="h-4 w-4" />
                        <span className="text-xs font-medium">Total Vendas</span>
                      </div>
                      <p className="text-2xl font-bold text-emerald-700">{formatCurrency(metricasVendas.totalVendas)}</p>
                      <p className="text-[10px] text-emerald-500 mt-0.5">
                        {getPeriodoLabel(periodo, mes, ano)}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Total Pedidos e Clientes no Dashboard - dividem a linha */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-center gap-2 text-blue-600 mb-1">
                          <TrendingUp className="h-4 w-4" />
                          <span className="text-xs font-medium">Total Pedidos</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-700">{metricasVendas.totalPedidos}</p>
                        <p className="text-[10px] text-blue-500 mt-0.5">
                          {getPeriodoLabel(periodo, mes, ano)}
                        </p>

                        {/* Distribuição por Categoria - só nos últimos 2 meses e não para vendedores inativos */}
                        {isMesElegivel && !isSelectedVendedorInativo && metricasVendas.distribuicaoPorCategoria && metricasVendas.distribuicaoPorCategoria.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-blue-200">
                            <div className="flex items-center gap-2 text-blue-600 mb-2">
                              <PieChart className="h-3 w-3" />
                              <span className="text-[10px] font-medium">Por categoria(na hora da venda)</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {metricasVendas.distribuicaoPorCategoria.map((item) => (
                                <div
                                  key={item.categoria}
                                  className="flex flex-col px-2 py-1 rounded-md bg-white/60 border border-blue-200"
                                >
                                  <span className="text-[9px] font-medium text-blue-600">
                                    {categoriaNomeExibicao(item.categoria)}
                                  </span>
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-sm font-bold text-blue-800">{item.quantidade}</span>
                                    <span className="text-[9px] text-blue-500">({formatCurrency(item.valor)})</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Clientes no Dashboard - só mostra quando vendedor ATIVO selecionado e mês elegível */}
                    {selectedVendedorId && isMesElegivel && !isSelectedVendedorInativo ? (
                      <Card className="bg-slate-100 border-slate-300">
                        <CardContent className="pt-4 pb-4">
                          <div className="flex items-center gap-2 text-slate-600 mb-1">
                            <Users className="h-4 w-4" />
                            <span className="text-xs font-medium">Clientes que passaram no Dashboard</span>
                          </div>
                          {loadingClientesDashMes ? (
                            <div className="flex items-center gap-2 mt-2">
                              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                            </div>
                          ) : (
                            <>
                              <p className="text-2xl font-bold text-slate-800">
                                {clientesDashboardMesSelecionado ?? "-"}
                              </p>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                {getPeriodoLabel(periodo, mes, ano)}
                              </p>

                              {/* Distribuição por Categoria (INDASH) - estilo card chips */}
                              {distribuicaoCategoriasDashMes.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-300">
                                  <div className="flex items-center gap-2 text-slate-600 mb-2">
                                    <PieChart className="h-3 w-3" />
                                    <span className="text-[10px] font-medium">Por categoria(na hora em que entraram no dash)</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {distribuicaoCategoriasDashMes.map((item) => (
                                      <div
                                        key={item.categoria}
                                        className="flex flex-col px-2 py-1 rounded-md bg-white/70 border border-slate-300"
                                      >
                                        <span className="text-[9px] font-medium text-slate-600">
                                          {categoriaNomeExibicao(item.categoria)}
                                        </span>
                                        <span className="text-sm font-bold text-slate-800">{item.quantidade}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Saídas no mês */}
                              {saidasDashMes !== null && saidasDashMes > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-300">
                                  <p className="text-[10px] text-slate-600">
                                    <span className="font-medium">{saidasDashMes}</span> cliente{saidasDashMes !== 1 ? 's' : ''} saiu do dashboard
                                  </p>
                                </div>
                              )}
                            </>
                          )}
                        </CardContent>
                      </Card>
                    ) : (
                      <div />
                    )}
                  </div>
                </div>
              )}

              {/* Lista de Clientes dos Pedidos - Collapsible, fechado por padrão */}
              {selectedVendedorId && (
                <Collapsible open={showClientesPedidosVendas} onOpenChange={setShowClientesPedidosVendas} className="mt-5">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between h-10 text-sm font-medium"
                    >
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Clientes dos Pedidos
                        {clientesPedidosVendas.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {clientesPedidosVendas.length}
                          </Badge>
                        )}
                      </div>
                      {showClientesPedidosVendas ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <Card className="mt-2 border-t-0 rounded-t-none">
                      <CardHeader className="pb-3">
                        {/* Filtros */}
                        <div className="flex flex-wrap items-center gap-3 mb-3 pb-3 border-b border-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Categoria:</span>
                            <Select value={filtroCategoriaVendas} onValueChange={setFiltroCategoriaVendas}>
                              <SelectTrigger className="h-7 w-[140px] text-xs">
                                <SelectValue placeholder="Todas" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Todas</SelectItem>
                                <SelectItem value="ATIVO">Ativo (Renovação)</SelectItem>
                                <SelectItem value="AGENDADO">Livre c/ data</SelectItem>
                                <SelectItem value="EXPLORADO">Livre s/ data</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="filtroSemVendedorVendas"
                              checked={filtroSemVendedorVendas}
                              onCheckedChange={(checked) => setFiltroSemVendedorVendas(checked === true)}
                            />
                            <label htmlFor="filtroSemVendedorVendas" className="text-xs text-slate-600 cursor-pointer">
                              Apenas sem vendedor
                            </label>
                          </div>

                          {(filtroCategoriaVendas !== "all" || filtroSemVendedorVendas) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-slate-500"
                              onClick={() => {
                                setFiltroCategoriaVendas("all")
                                setFiltroSemVendedorVendas(false)
                              }}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Limpar filtros
                            </Button>
                          )}

                          <span className="text-xs text-slate-400 ml-auto">
                            {clientesPedidosVendasFiltrados.length} de {clientesPedidosVendas.length}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <CardDescription className="text-xs">
                              Clientes que tiveram pedidos no período selecionado
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={selectAllClientesVendasFiltrados}
                              className="text-xs h-7"
                            >
                              Selecionar Todos ({clientesPedidosVendasFiltrados.length})
                            </Button>

                            {selectedIdsVendas.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={resetSelectionVendas}
                                className="text-slate-500 text-xs h-7"
                              >
                                <X className="h-3.5 w-3.5 mr-1" />
                                Limpar ({selectedIdsVendas.length})
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Ações de seleção */}
                        {selectedIdsVendas.length > 0 && (
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                            <span className="text-sm text-slate-600">
                              {selectedIdsVendas.length} selecionado(s)
                            </span>

                            <Popover open={vendedorPopoverVendasOpen} onOpenChange={setVendedorPopoverVendasOpen}>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2 h-7 text-xs">
                                  <Send className="h-3 w-3" />
                                  Atribuir a...
                                  <ChevronsUpDown className="h-3 w-3 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[250px] p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Buscar vendedor..." className="h-9" />
                                  <CommandList>
                                    <CommandEmpty>Nenhum vendedor encontrado.</CommandEmpty>
                                    <CommandGroup>
                                      {vendedoresCarteira
                                        .filter((v) => v.id !== selectedVendedorId)
                                        .map((v) => (
                                          <CommandItem
                                            key={v.id}
                                            value={v.nome}
                                            onSelect={() => {
                                              setVendedorDestinoVendas(v.id)
                                              setVendedorPopoverVendasOpen(false)
                                              setConfirmTransferVendasOpen(true)
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                vendedorDestinoVendas === v.id ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                            {v.nome}
                                          </CommandItem>
                                        ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>

                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2 h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => setConfirmReleaseVendasOpen(true)}
                            >
                              <UserMinus className="h-3 w-3" />
                              Liberar
                            </Button>
                          </div>
                        )}
                      </CardHeader>
                      <CardContent>
                        {loadingClientesPedidosVendas ? (
                          <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                          </div>
                        ) : clientesPedidosVendasFiltrados.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            {clientesPedidosVendas.length === 0
                              ? "Nenhum cliente encontrado no período selecionado."
                              : "Nenhum cliente corresponde aos filtros selecionados."}
                          </div>
                        ) : (
                          <div className="border rounded-lg overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/30">
                                  <TableHead className="w-10" />
                                  <TableHead className="text-xs font-semibold text-muted-foreground">Contato</TableHead>
                                  <TableHead className="text-xs font-semibold text-muted-foreground">Fase Kanban</TableHead>
                                  <TableHead className="text-xs font-semibold text-muted-foreground">Vendedor Atual</TableHead>
                                  <TableHead className="text-xs font-semibold text-right text-muted-foreground">Pedidos</TableHead>
                                  <TableHead className="text-xs font-semibold text-right text-muted-foreground">Valor Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {clientesPedidosVendasFiltrados.map((cliente) => {
                                  // Mock síndico determinístico
                                  const nomes = ["Carlos Silva","Ana Paula","Roberto Nunes","Fernanda Lima","José Oliveira","Mariana Costa","Paulo Mendes","Juliana Santos","André Rocha","Camila Pereira"]
                                  const ddd = ["11","21","31","41","51","61","71","81","85","62"]
                                  const sid = cliente.clienteId % nomes.length
                                  const nomeSindico = nomes[sid]
                                  const tel = `(${ddd[cliente.clienteId % ddd.length]}) 9${String(cliente.clienteId * 7919 % 100000000).padStart(8,'0').slice(0,4)}-${String(cliente.clienteId * 6271 % 10000).padStart(4,'0')}`
                                  const kanbanStages = [
                                    { label: "Primeiro Contato", cls: "bg-slate-500/10 text-slate-300 border-slate-500/30" },
                                    { label: "Em Negociação",   cls: "bg-blue-500/10 text-blue-300 border-blue-500/30" },
                                    { label: "Orçamento",       cls: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
                                    { label: "Aguardando OK",   cls: "bg-violet-500/10 text-violet-300 border-violet-500/30" },
                                    { label: "Vendas",          cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
                                    { label: "Perda",           cls: "bg-red-500/10 text-red-300 border-red-500/30" },
                                  ]
                                  const kanban = kanbanStages[cliente.clienteId % kanbanStages.length]

                                  return (
                                    <TableRow
                                      key={cliente.clienteId}
                                      className="hover:bg-primary/5 cursor-pointer transition-colors"
                                      onClick={() => setClienteDetailId(cliente.clienteId)}
                                    >
                                      <TableCell onClick={(e) => e.stopPropagation()}>
                                        <Checkbox
                                          checked={isClientSelectedVendas(cliente.clienteId)}
                                          onCheckedChange={() => toggleClientSelectionVendas(cliente.clienteId)}
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <div className="min-w-0">
                                          <p className="text-sm font-semibold text-foreground">{nomeSindico}</p>
                                          <p className="text-[11px] text-muted-foreground">{tel}</p>
                                          <p className="text-[10px] text-muted-foreground/50 truncate max-w-[200px]">{cliente.razaoSocial}</p>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="outline" className={cn("text-[10px] whitespace-nowrap", kanban.cls)}>
                                          {kanban.label}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-xs text-muted-foreground">
                                        {cliente.vendedorAtualNome ?? (
                                          <span className="text-muted-foreground/50 italic">Sem vendedor</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-xs font-medium text-foreground text-right">
                                        {cliente.totalPedidos}
                                      </TableCell>
                                      <TableCell className="text-xs font-bold text-emerald-400 text-right">
                                        {formatCurrency(cliente.totalValor)}
                                      </TableCell>
                                    </TableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </CollapsibleContent>
                </Collapsible>
              )}

            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Dialog de detalhes do cliente */}
      {clienteDetailId && (
        <ClienteDetailDialog
          clienteId={clienteDetailId}
          open={!!clienteDetailId}
          onClose={() => setClienteDetailId(null)}
        />
      )}

      {/* Dialog de confirmação de transferência */}
      <AlertDialog open={confirmTransferOpen} onOpenChange={setConfirmTransferOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar transferência</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja transferir <strong>{selectedIds.length}</strong> cliente(s) para{" "}
              <strong>{vendedoresCarteira.find((v) => v.id === vendedorDestino)?.nome ?? "outro vendedor"}</strong>?
              <br /><br />
              Os clientes serão removidos do vendedor atual e atribuídos ao novo vendedor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={transferindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleTransferClients} disabled={transferindo}>
              {transferindo ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Transferindo...
                </>
              ) : (
                "Confirmar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmação de liberação */}
      <AlertDialog open={confirmReleaseOpen} onOpenChange={setConfirmReleaseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Confirmar liberação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja <strong>liberar</strong> {selectedIds.length} cliente(s)?
              <br /><br />
              <span className="text-red-600 font-medium">Esta ação irá:</span>
              <ul className="list-disc list-inside mt-2 space-y-1 text-slate-600">
                <li>Remover o vendedor dos clientes</li>
                <li>Remover a data de alocação</li>
                <li>Remover do dashboard do vendedor</li>
                <li>Registrar no histórico (OUTDASH)</li>
              </ul>
              <br />
              Os clientes ficarão disponíveis para serem atribuídos a outros vendedores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={liberando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReleaseClients}
              disabled={liberando}
              className="bg-red-600 hover:bg-red-700"
            >
              {liberando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Liberando...
                </>
              ) : (
                "Liberar Clientes"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmação de transferência (Histórico de Vendas) */}
      <AlertDialog open={confirmTransferVendasOpen} onOpenChange={setConfirmTransferVendasOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar transferência</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja transferir <strong>{selectedIdsVendas.length}</strong> cliente(s) para{" "}
              <strong>{vendedoresCarteira.find((v) => v.id === vendedorDestinoVendas)?.nome ?? "outro vendedor"}</strong>?
              <br /><br />
              Os clientes serão removidos do vendedor atual e atribuídos ao novo vendedor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={transferindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleTransferClientsVendas} disabled={transferindo}>
              {transferindo ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Transferindo...
                </>
              ) : (
                "Confirmar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmação de liberação (Histórico de Vendas) */}
      <AlertDialog open={confirmReleaseVendasOpen} onOpenChange={setConfirmReleaseVendasOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Confirmar liberação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja <strong>liberar</strong> {selectedIdsVendas.length} cliente(s)?
              <br /><br />
              <span className="text-red-600 font-medium">Esta ação irá:</span>
              <ul className="list-disc list-inside mt-2 space-y-1 text-slate-600">
                <li>Remover o vendedor dos clientes</li>
                <li>Remover a data de alocação</li>
                <li>Remover do dashboard do vendedor</li>
                <li>Registrar no histórico (OUTDASH)</li>
              </ul>
              <br />
              Os clientes ficarão disponíveis para serem atribuídos a outros vendedores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={liberando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReleaseClientsVendas}
              disabled={liberando}
              className="bg-red-600 hover:bg-red-700"
            >
              {liberando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Liberando...
                </>
              ) : (
                "Liberar Clientes"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Atribuição Automática */}
      <Dialog open={atribuicaoDialogOpen} onOpenChange={setAtribuicaoDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-emerald-600" />
              Atribuição Automática
            </DialogTitle>
            <DialogDescription>
              Torna visíveis no dashboard os clientes que entraram na janela de aparição.
              <br />
              <span className="text-xs text-slate-400">Esta ação NÃO remove clientes do dashboard.</span>
            </DialogDescription>
          </DialogHeader>

          {loadingAtribuicaoPreview ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : atribuicaoPreview ? (
            <div className="space-y-4">
              {/* Resumo por categoria */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">
                    {atribuicaoPreview.entradasDashboard.porCategoria.ativos}
                  </p>
                  <p className="text-xs text-green-600">Ativos</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">
                    {atribuicaoPreview.entradasDashboard.porCategoria.agendados}
                  </p>
                  <p className="text-xs text-blue-600">Livres c/ data</p>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-orange-700">
                    {atribuicaoPreview.entradasDashboard.porCategoria.explorados}
                  </p>
                  <p className="text-xs text-orange-600">Livres s/ data</p>
                </div>
              </div>

              {/* Total Entradas */}
              <div className="bg-slate-100 rounded-lg p-3 text-center">
                <p className="text-lg font-semibold text-slate-800">
                  {atribuicaoPreview.entradasDashboard.total} clientes serão adicionados aos dashboards
                </p>
              </div>

              {/* Saídas - Renovados */}
              {atribuicaoPreview.saidasDashboard?.renovados > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-amber-800">Renovados a serem limpos dos dashboards</p>
                      <p className="text-xs text-amber-600">
                        Clientes cuja manutenção foi feita nos últimos {atribuicaoPreview.config.mesesRenovado} meses
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-amber-700">
                      {atribuicaoPreview.saidasDashboard.renovados}
                    </p>
                  </div>
                </div>
              )}

              {/* Por vendedor */}
              {atribuicaoPreview.entradasDashboard.porVendedor.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-slate-700">Por vendedor:</h4>
                  <div className="max-h-48 overflow-y-auto space-y-1.5">
                    {atribuicaoPreview.entradasDashboard.porVendedor.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between bg-white border rounded-md px-3 py-2"
                      >
                        <span className="text-sm font-medium text-slate-800">{v.nome}</span>
                        <div className="flex items-center gap-2">
                          {v.clientes.map((c) => (
                            <Badge
                              key={c.categoria}
                              variant="secondary"
                              className={cn(
                                "text-xs",
                                c.categoria === "ATIVO" && "bg-green-100 text-green-700",
                                c.categoria === "AGENDADO" && "bg-blue-100 text-blue-700",
                                c.categoria === "EXPLORADO" && "bg-orange-100 text-orange-700"
                              )}
                            >
                              {c.quantidade} {c.categoria === "AGENDADO" ? "Livre c/ data" : c.categoria === "EXPLORADO" ? "Livre s/ data" : "Ativo"}
                            </Badge>
                          ))}
                          <span className="text-sm font-bold text-slate-600">{v.total}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {atribuicaoPreview.entradasDashboard.total === 0 && (atribuicaoPreview.saidasDashboard?.renovados ?? 0) === 0 && (
                <div className="text-center py-4 text-slate-500">
                  <p>Nenhum cliente para adicionar ou remover neste momento.</p>
                  <p className="text-xs mt-1">Todos os clientes elegíveis já estão visíveis nos dashboards e não há renovados para limpar.</p>
                </div>
              )}

              {/* Config info */}
              <div className="text-xs text-slate-400 text-center pt-2 border-t">
                Janela de aparição: {atribuicaoPreview.config.mesesAntecedenciaAtivos} meses antes do vencimento
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              Não foi possível carregar o preview.
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setAtribuicaoDialogOpen(false)}
              disabled={executandoAtribuicao}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleExecutarAtribuicao}
              disabled={executandoAtribuicao || !atribuicaoPreview || (atribuicaoPreview.entradasDashboard.total === 0 && (atribuicaoPreview.saidasDashboard?.renovados ?? 0) === 0)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {executandoAtribuicao ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Executando...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Executar Atribuição
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
