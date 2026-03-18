"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Calendar,
  Plus,
  Filter,
  FileDown,
  FileUp,
  Barcode,
  ArrowDownToLine,
  Trash2,
  Loader2,
  RefreshCw,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  MessageCircle,
  Pencil,
} from "lucide-react"
import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { CadastroContaPagarDialog } from "./cadastro-conta-pagar-dialog"
import { BaixarContaDialog } from "./baixar-conta-dialog"
import { ConfiguracaoBancoDialog } from "./configuracao-banco-dialog"
import { TratarRetornoDialog } from "./tratar-retorno-dialog"
import { GerenciarCategoriasDialog } from "./gerenciar-categorias-dialog"
import { useToast } from "@/hooks/use-toast"
import { ClienteDetailDialog } from "@/components/leads/cliente-detail-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { toDateInputValue } from "@/lib/date-utils"
import Link from "next/link"

const categoriasDespesas = [
  "Luz",
  "Água",
  "Salários",
  "Comissões",
  "Contador",
  "ART",
  "Google Adwords",
  "Material",
  "Passagem Aérea",
  "Passagem Ônibus",
  "Almoço",
  "Custo Boleto",
  "Outros",
]

// Tipos e constantes para seletor de período (igual analise-vendedores)
type Periodo = "mes" | "trimestre" | "semestre" | "ano" | "total"

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

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

// Calcula o range de datas baseado no período selecionado
const getPeriodDateRange = (periodo: Periodo, mes: number, ano: number): { start: string; end: string } | null => {
  if (periodo === "total") return null

  let startMonth: number
  let startYear: number
  let endMonth: number
  let endYear: number

  switch (periodo) {
    case "mes":
      startMonth = mes
      startYear = ano
      endMonth = mes
      endYear = ano
      break
    case "trimestre": {
      const trimestre = Math.ceil(mes / 3)
      startMonth = (trimestre - 1) * 3 + 1
      startYear = ano
      endMonth = trimestre * 3
      endYear = ano
      break
    }
    case "semestre":
      if (mes <= 6) {
        startMonth = 1
        endMonth = 6
      } else {
        startMonth = 7
        endMonth = 12
      }
      startYear = ano
      endYear = ano
      break
    case "ano":
      startMonth = 1
      endMonth = 12
      startYear = ano
      endYear = ano
      break
  }

  const startDate = new Date(startYear, startMonth - 1, 1)
  const endDate = new Date(endYear, endMonth, 0) // último dia do mês

  const toInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return { start: toInput(startDate), end: toInput(endDate) }
}

type ContaReceber = {
  id: number
  valor: number
  vencimento: string | null
  dataOcorrencia: string | null
  stats: number
  clienteId: number
  cliente: string
  estado: string
  vendedor: string | null
  vendedorId: string | null
  empresa: string | null
  empresaId: number | null
  bancoEmissorId: number | null
}

type ReceberSummary = {
  filteredTotal: number
  statusTotals: {
    aReceber: { total: number; count: number }
    vencido: { total: number; count: number }
    recebido: { total: number; count: number }
  }
  abertoGeral: {
    total: number
    count: number
  }
  abertoMesAtual: {
    total: number
    count: number
  }
  recebidoMesAtual: {
    total: number
    count: number
  }
}

const RECEBER_PAGE_SIZE = 30

const emptyReceberSummary: ReceberSummary = {
  filteredTotal: 0,
  statusTotals: {
    aReceber: { total: 0, count: 0 },
    vencido: { total: 0, count: 0 },
    recebido: { total: 0, count: 0 },
  },
  abertoGeral: { total: 0, count: 0 },
  abertoMesAtual: { total: 0, count: 0 },
  recebidoMesAtual: { total: 0, count: 0 },
}

const pad = (v: number) => v.toString().padStart(2, "0")
const getCurrentMonthRange = () => {
  const now = new Date()
  const startLocal = new Date(now.getFullYear(), now.getMonth(), 1)
  const endLocal = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const toInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return { start: toInput(startLocal), end: toInput(endLocal) }
}

const defaultReceberFilters = (() => {
  const now = new Date()
  return {
    status: "todos" as "todos" | "a_receber" | "recebido" | "vencido" | "cancelado",
    periodo: "mes" as Periodo,
    mes: now.getMonth() + 1,
    ano: now.getFullYear(),
    vendedorId: "all",
    empresaId: "all",
    search: "",
  }
})()

type ContaPagarRow = {
  id: number | string
  descricao: string | null
  valor: number
  status: number // 0 a pagar, 1 pago, -1 vencido
  vencimento: string
  pagoEm: string | null
  categoriaId: number | null
  categoriaNome: string | null
  vendedorNome?: string | null
  comissaoId?: number | null
  isGroup?: boolean
}

function ItemActionTable({
  items,
  selectedPagar,
  setSelectedPagar,
  handleBaixar,
  handleDelete,
  handleEdit,
  statusPagarClass,
  statusPagarLabel,
  formatCurrency,
  formatDate,
}: any) {
  return (
    <Table>
      <TableHeader className="bg-slate-50">
        <TableRow>
          <TableHead className="w-10"></TableHead>
          <TableHead className="text-[11px] uppercase font-semibold">Descrição</TableHead>
          <TableHead className="text-[11px] uppercase font-semibold">Vencimento</TableHead>
          <TableHead className="text-[11px] uppercase font-semibold text-right">Valor</TableHead>
          <TableHead className="text-[11px] uppercase font-semibold">Status</TableHead>
          <TableHead className="text-[11px] uppercase font-semibold text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item: any) => (
          <TableRow key={item.id} className="hover:bg-slate-50/80">
            <TableCell>
              <Checkbox
                checked={selectedPagar.has(item.id)}
                onCheckedChange={(checked) => {
                  setSelectedPagar((prev: any) => {
                    const next = new Set(prev)
                    if (checked) next.add(item.id)
                    else next.delete(item.id)
                    return next
                  })
                }}
              />
            </TableCell>
            <TableCell className="text-sm">
              <div className="flex flex-col">
                <span>{item.descricao || "-"}</span>
                {item.vendedorNome && (
                  <span className="text-[10px] text-muted-foreground italic">Vendedor: {item.vendedorNome}</span>
                )}
              </div>
            </TableCell>
            <TableCell className="text-sm">{formatDate(item.vencimento)}</TableCell>
            <TableCell className="text-sm text-right font-medium">
              <div className="flex items-center justify-end gap-2">
                {formatCurrency(item.valor)}
                {item.comissaoId && (
                  <Badge variant="secondary" className="text-[9px] h-4 py-0 bg-blue-50 text-blue-600 border-blue-100 uppercase">Comissão</Badge>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="outline" className={cn("text-[10px] h-5", statusPagarClass(item.status))}>
                {statusPagarLabel(item.status)}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => handleEdit?.(item)}
                  title="Editar conta"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => handleBaixar(item)}
                  disabled={item.status === 1}
                  title={item.status === 1 ? "Já pago" : "Baixa manual"}
                >
                  <ArrowDownToLine className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => handleDelete(item)}
                  title="Excluir conta"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

type ContaPagarCategoria = {
  id: number
  nome: string
}

type ContaPagarCategoriaGroup = {
  categoriaId: number | null
  nome: string
  total: number
  itens: ContaPagarRow[]
}

const PAGAR_PAGE_SIZE = 50

const formatCurrency = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const formatDate = (value: string | null) => {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
}


export function FinanceiroDashboard() {
  const [cadastroOpen, setCadastroOpen] = useState(false)
  const [configBancoOpen, setConfigBancoOpen] = useState(false)
  const [pagarFilters, setPagarFilters] = useState(() => {
    const range = getCurrentMonthRange()
    // Mostra desde o início do ano por padrão para não 'esquecer' contas vencidas
    const startOfYear = `${new Date().getFullYear()}-01-01`
    return {
      status: "todos" as "todos" | "a_pagar" | "pago",
      startDate: startOfYear,
      endDate: range.end,
      categoriaId: "all" as string | number,
    }
  })
  const [pagarPage, setPagarPage] = useState(1)
  const [pagarPagination, setPagarPagination] = useState({ total: 0, totalPages: 1 })
  const [pagarLoading, setPagarLoading] = useState(false)
  const [contasPagar, setContasPagar] = useState<ContaPagarRow[]>([])
  const [pagarByCategoria, setPagarByCategoria] = useState<ContaPagarCategoriaGroup[]>([])
  const [pagarView, setPagarView] = useState<"geral" | "categoria">("geral")
  const [categoriasPagar, setCategoriasPagar] = useState<ContaPagarCategoria[]>([])
  const [novaCategoriaNome, setNovaCategoriaNome] = useState("")
  const [creatingCategoria, setCreatingCategoria] = useState(false)
  const [creatingConta, setCreatingConta] = useState(false)
  const [gerenciarCategoriasOpen, setGerenciarCategoriasOpen] = useState(false)
  const [baixarOpenPagar, setBaixarOpenPagar] = useState(false)
  const [baixarContaAlvo, setBaixarContaAlvo] = useState<ContaPagarRow | null>(null)
  const [deleteContaPagar, setDeleteContaPagar] = useState<ContaPagarRow | null>(null)
  const [deleteContaPagarLoading, setDeleteContaPagarLoading] = useState(false)
  const [pagarFilteredTotal, setPagarFilteredTotal] = useState(0)
  const [pagarHasOverdue, setPagarHasOverdue] = useState(false)
  const [totalAPagar, setTotalAPagar] = useState(0)
  const [totalAPagarMes, setTotalAPagarMes] = useState(0)
  const [bancos, setBancos] = useState<Array<{ id: number; nome: string; bancoCodigo: number }>>([])
  const [bancoSelecionado, setBancoSelecionado] = useState<string>("")
  const [gerandoRemessa, setGerandoRemessa] = useState(false)
  const [confirmRemessa, setConfirmRemessa] = useState(false)
  const [tratarRetornoOpen, setTratarRetornoOpen] = useState(false)
  const [gerarComissaoOpen, setGerarComissaoOpen] = useState(false)
  const [gerarComissaoLoading, setGerarComissaoLoading] = useState(false)
  const [dataCorte, setDataCorte] = useState(() => new Date().toISOString().split("T")[0])
  const [vendedoresSelecionados, setVendedoresSelecionados] = useState<Set<string>>(new Set())
  const [contasReceber, setContasReceber] = useState<ContaReceber[]>([])
  const [receberLoading, setReceberLoading] = useState(false)
  const [receberPage, setReceberPage] = useState(1)
  const [receberPagination, setReceberPagination] = useState({ total: 0, totalPages: 1 })
  const [receberSummary, setReceberSummary] = useState<ReceberSummary>(emptyReceberSummary)
  const [receberFilters, setReceberFilters] = useState<typeof defaultReceberFilters>(defaultReceberFilters)
  const [appliedReceberFilters, setAppliedReceberFilters] = useState<typeof defaultReceberFilters>(defaultReceberFilters)
  const [vendedores, setVendedores] = useState<Array<{ id: string; name: string }>>([])
  const [comissoesLoading, setComissoesLoading] = useState(false)
  const [comissoesAgrupado, setComissoesAgrupado] = useState<
    Array<{ vendedorId: string; vendedorNome: string; vendido: number; totalComissao: number }>
  >([])
  const [comissoesDetalhe, setComissoesDetalhe] = useState<
    Array<{
      id: number
      vencimento: string
      pedidoId: number
      cliente: string
      valorPedido: number
      valorComissao: number
      vendedorNome: string
      contaPagarId: number | null
      contaPagarStatus: number | null
    }>
  >([])
  const [comissoesPeriodo, setComissoesPeriodo] = useState<Periodo>("mes")
  const [comissoesMes, setComissoesMes] = useState<number>(() => new Date().getMonth() + 1)
  const [comissoesAno, setComissoesAno] = useState<number>(() => new Date().getFullYear())
  const [comissoesView, setComissoesView] = useState<"agrupado" | "detalhado">("agrupado")
  const [empresas, setEmpresas] = useState<Array<{ id: number; nome: string }>>([])
  const [boletoLoadingId, setBoletoLoadingId] = useState<number | null>(null)
  const [baixaManualOpen, setBaixaManualOpen] = useState(false)
  const [baixaManualTarget, setBaixaManualTarget] = useState<ContaReceber | null>(null)
  const [clienteDetailId, setClienteDetailId] = useState<number | null>(null)
  const [baixaManualForm, setBaixaManualForm] = useState({
    valorRecebido: "",
    dataOcorrencia: toDateInputValue(new Date()),
    acrescimos: "",
    descontos: "",
  })
  const [savingBaixa, setSavingBaixa] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ContaReceber | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [selectedComissoes, setSelectedComissoes] = useState<Set<number>>(new Set())
  const [markingComissoesAsPaid, setMarkingComissoesAsPaid] = useState(false)
  const [expandedCategorias, setExpandedCategorias] = useState<Set<number | string>>(new Set())
  const [expandedVendedores, setExpandedVendedores] = useState<Set<string>>(new Set())
  const [selectedPagar, setSelectedPagar] = useState<Set<number | string>>(new Set())
  const [markingPagarAsPaid, setMarkingPagarAsPaid] = useState(false)
  // Editar ContaPagar
  const [editContaPagar, setEditContaPagar] = useState<ContaPagarRow | null>(null)
  const [editContaPagarForm, setEditContaPagarForm] = useState({ descricao: "", valor: "", vencimento: "", categoriaId: "" })
  const [savingEditContaPagar, setSavingEditContaPagar] = useState(false)
  const { toast } = useToast()

  const statusPagarLabel = (status: number) => {
    if (status === 1) return "Pago"
    if (status === -1) return "Vencido"
    return "A Pagar"
  }

  const statusPagarClass = (status: number) => {
    if (status === 1) return "bg-green-500/10 text-green-600 border-green-500/40"
    if (status === -1) return "bg-red-500/10 text-red-600 border-red-500/40"
    return "bg-yellow-500/10 text-yellow-700 border-yellow-500/40"
  }

  const fetchCategoriasPagar = useCallback(async () => {
    try {
      const res = await fetch("/api/financeiro/contas-pagar/categorias")
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Erro ao carregar categorias")
      setCategoriasPagar(body.data ?? [])
    } catch (error) {
      console.error(error)
      setCategoriasPagar([])
    }
  }, [])

  const loadContasPagar = useCallback(
    async (pageToLoad: number, filters = pagarFilters) => {
      setPagarLoading(true)
      try {
        const params = new URLSearchParams()
        params.set("page", pageToLoad.toString())
        params.set("pageSize", PAGAR_PAGE_SIZE.toString())
        if (filters.status !== "todos") params.set("status", filters.status)
        if (filters.startDate) params.set("startDate", filters.startDate)
        if (filters.endDate) params.set("endDate", filters.endDate)
        if (filters.categoriaId && filters.categoriaId !== "all") {
          params.set("categoriaId", String(filters.categoriaId))
        }

        const res = await fetch(`/api/financeiro/contas-pagar?${params.toString()}`)
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error || "Erro ao carregar contas a pagar.")

        setContasPagar(body.data ?? [])
        setPagarFilteredTotal(body.filteredTotal ?? 0)
        setPagarHasOverdue(Boolean(body.hasOverdue))
        setPagarByCategoria(body.byCategory ?? [])
        setTotalAPagar(body.totalAPagar ?? 0)
        setTotalAPagarMes(body.totalAPagarMes ?? 0)
        setPagarPagination({
          total: body.pagination?.total ?? 0,
          totalPages: body.pagination?.totalPages ?? 1,
        })
        setPagarPage(pageToLoad)
      } catch (error) {
        console.error(error)
        toast({ variant: "destructive", title: "Erro ao carregar contas a pagar" })
      } finally {
        setPagarLoading(false)
      }
    },
    [pagarFilters, toast],
  )


  const handleApplyPagarFilters = () => {
    loadContasPagar(1, pagarFilters).catch(() => { })
  }

  const handleClearPagarFilters = () => {
    const range = getCurrentMonthRange()
    const cleared = { status: "todos" as const, startDate: range.start, endDate: range.end, categoriaId: "all" as const }
    setPagarFilters(cleared)
    loadContasPagar(1, cleared).catch(() => { })
  }

  const handleChangePagarPage = (direction: "prev" | "next") => {
    const nextPage =
      direction === "prev" ? Math.max(1, pagarPage - 1) : Math.min(pagarPagination.totalPages, pagarPage + 1)
    loadContasPagar(nextPage, pagarFilters).catch(() => { })
  }

  const handleCreateCategoria = async (nome: string) => {
    setCreatingCategoria(true)
    try {
      const res = await fetch("/api/financeiro/contas-pagar/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Erro ao criar categoria.")
      await fetchCategoriasPagar()
      toast({ title: "Categoria criada", description: nome })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao criar categoria",
        description: error?.message ?? "Erro desconhecido",
      })
    } finally {
      setCreatingCategoria(false)
    }
  }

  const handleCreateContaPagar = async (payload: { descricao?: string; categoriaId?: number | null; valor: number; vencimento: string } | Array<{ descricao?: string; categoriaId?: number | null; valor: number; vencimento: string }>) => {
    setCreatingConta(true)
    try {
      const payloads = Array.isArray(payload) ? payload : [payload]

      // Executa criações em paralelo para otimizar tempo e evita múltiplos reloads do dashboard
      await Promise.all(payloads.map(async (p) => {
        const res = await fetch("/api/financeiro/contas-pagar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || "Erro ao criar conta a pagar.")
        }
      }))

      toast({
        title: payloads.length > 1 ? "Contas criadas" : "Conta criada",
        description: payloads.length > 1 ? `${payloads.length} lançamentos gerados com sucesso.` : "Lançamento realizado com sucesso."
      })
      await loadContasPagar(1, pagarFilters)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao criar conta",
        description: error?.message ?? "Erro desconhecido",
      })
    } finally {
      setCreatingConta(false)
    }
  }

  const handleBaixarConta = (conta: ContaPagarRow) => {
    setBaixarContaAlvo(conta)
    setBaixarOpenPagar(true)
  }

  const handleConfirmBaixaPagar = async (payload: { pagoEm: string }) => {
    if (!baixarContaAlvo) return
    try {
      const res = await fetch(`/api/financeiro/contas-pagar/${baixarContaAlvo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: 1, pagoEm: payload.pagoEm }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Erro ao registrar pagamento.")
      toast({ title: "Pagamento registrado", description: `Conta #${baixarContaAlvo.id}` })
      await loadContasPagar(pagarPage, pagarFilters)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao baixar conta",
        description: error?.message ?? "Erro desconhecido",
      })
    }
  }

  const handleUpdateContaCategoria = async (id: number | string, categoriaId: number | null) => {
    try {
      const res = await fetch(`/api/financeiro/contas-pagar/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoriaId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Erro ao atualizar categoria.")
      toast({ title: "Categoria atualizada" })
      await loadContasPagar(pagarPage, pagarFilters)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar categoria",
        description: error?.message ?? "Erro desconhecido",
      })
    }
  }

  const handleMarkSelectedComissoesAsPaid = async () => {
    if (selectedComissoes.size === 0) return
    setMarkingComissoesAsPaid(true)
    try {
      const selectedIds = Array.from(selectedComissoes)
      const now = new Date().toISOString().split("T")[0]

      // Itera sobre os IDs selecionados e chama o endpoint de baixa
      // Nota: Idealmente o back teria um endpoint de bulk, mas usaremos o individual conforme o legado
      let successCount = 0
      for (const id of selectedIds) {
        const item = comissoesDetalhe.find(d => d.id === id)
        if (item?.contaPagarId && item.contaPagarStatus !== 1) {
          const res = await fetch(`/api/financeiro/contas-pagar/${item.contaPagarId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: 1, pagoEm: now }),
          })
          if (res.ok) successCount++
        }
      }

      toast({
        title: "Processamento concluído",
        description: `${successCount} comissões marcadas como pagas.`
      })
      setSelectedComissoes(new Set())
      await loadComissoes()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao processar pagamentos",
        description: error?.message || "Tente novamente"
      })
    } finally {
      setMarkingComissoesAsPaid(false)
    }
  }

  const handleBulkMarkAsPaidPagar = async () => {
    if (selectedPagar.size === 0) return
    setMarkingPagarAsPaid(true)
    let sucessos = 0
    let erros = 0

    const ids = Array.from(selectedPagar)
    for (const id of ids) {
      try {
        const res = await fetch(`/api/financeiro/contas-pagar/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: 1, pagoEm: new Date().toISOString() }),
        })
        if (res.ok) sucessos++
        else erros++
      } catch (err) {
        erros++
      }
    }

    toast({
      title: "Processamento concluído",
      description: `${sucessos} conta(s) marked as paid. ${erros > 0 ? `${erros} erro(s).` : ""}`,
      variant: erros > 0 ? "destructive" : "default",
    })

    setSelectedPagar(new Set())
    await loadContasPagar(pagarPage, pagarFilters)
    setMarkingPagarAsPaid(false)
  }

  const handleDeleteContaPagar = async () => {
    if (!deleteContaPagar) return
    setDeleteContaPagarLoading(true)
    try {
      const res = await fetch(`/api/financeiro/contas-pagar/${deleteContaPagar.id}`, { method: "DELETE" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Erro ao excluir conta.")
      toast({ title: "Conta excluída", description: `Conta #${deleteContaPagar.id}` })
      const isLastItemInPage = contasPagar.length === 1 && pagarPage > 1
      const nextPage = isLastItemInPage ? pagarPage - 1 : pagarPage
      await loadContasPagar(nextPage, pagarFilters)
      setDeleteContaPagar(null)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir conta",
        description: error?.message ?? "Erro desconhecido",
      })
    } finally {
      setDeleteContaPagarLoading(false)
    }
  }

  const handleOpenEditContaPagar = (conta: ContaPagarRow) => {
    setEditContaPagar(conta)
    setEditContaPagarForm({
      descricao: conta.descricao ?? "",
      valor: String(conta.valor),
      vencimento: conta.vencimento ? conta.vencimento.slice(0, 10) : "",
      categoriaId: conta.categoriaId ? String(conta.categoriaId) : "",
    })
  }

  const handleSaveEditContaPagar = async () => {
    if (!editContaPagar) return
    setSavingEditContaPagar(true)
    try {
      const res = await fetch(`/api/financeiro/contas-pagar/${editContaPagar.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descricao: editContaPagarForm.descricao || null,
          valor: Number(editContaPagarForm.valor.replace(",", ".")),
          vencimento: editContaPagarForm.vencimento,
          categoriaId: editContaPagarForm.categoriaId ? Number(editContaPagarForm.categoriaId) : null,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Erro ao salvar")
      toast({ description: "Conta atualizada com sucesso." })
      setEditContaPagar(null)
      await loadContasPagar(pagarPage, pagarFilters)
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: error?.message ?? "Erro desconhecido" })
    } finally {
      setSavingEditContaPagar(false)
    }
  }

  const bancosAgrupados = useMemo(() => {
    // Listar todas as contas/bancos sem agrupar.
    return bancos.map((b) => ({
      id: b.id,
      nome: b.nome,
      bancoCodigo: b.bancoCodigo,
      label: b.nome,
    }))
  }, [bancos])

  const contasPagarVencidas = contasPagar.filter((c) => {
    const venc = new Date(c.vencimento)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return c.status === 0 && venc < today
  })
  const totalPagarVencido = contasPagarVencidas.reduce((sum, c) => sum + c.valor, 0)
  const totalReceberVencido = receberSummary.statusTotals.vencido.total
  const totalReceberVencidoCount = receberSummary.statusTotals.vencido.count

  // Total de comissões no filtro atual (soma de todas as comissões agrupadas)
  const totalComissoesFiltro = useMemo(() => {
    return comissoesAgrupado.reduce((sum, c) => sum + c.totalComissao, 0)
  }, [comissoesAgrupado])

  // Agrupamento detalhado por vendedor para expansão
  const comissoesPorVendedor = useMemo(() => {
    const map = new Map<string, typeof comissoesDetalhe>()
    comissoesDetalhe.forEach(c => {
      const nome = c.vendedorNome || "Sem vendedor"
      const list = map.get(nome) || []
      list.push(c)
      map.set(nome, list)
    })
    return Array.from(map.entries()).map(([vendedor, itens]) => ({
      vendedor,
      itens,
      totalVendido: itens.reduce((sum, i) => sum + i.valorPedido, 0),
      totalComissao: itens.reduce((sum, i) => sum + i.valorComissao, 0),
    })).sort((a, b) => a.vendedor.localeCompare(b.vendedor))
  }, [comissoesDetalhe])

  // Agrupamento por vendedor para Contas a Pagar
  const pagarByVendedor = useMemo(() => {
    const map = new Map<string, { vendedor: string, total: number, itens: ContaPagarRow[] }>()
    contasPagar.forEach(c => {
      const nome = c.vendedorNome || "Sem vendedor"
      const group = map.get(nome) || { vendedor: nome, total: 0, itens: [] }
      group.total += c.valor
      group.itens.push(c)
      map.set(nome, group)
    })
    return Array.from(map.values()).sort((a, b) => a.vendedor.localeCompare(b.vendedor))
  }, [contasPagar])

  const carregarContasReceber = useCallback(
    async (pageToLoad: number, filtersState: typeof defaultReceberFilters) => {
      setReceberLoading(true)
      try {
        const params = new URLSearchParams()
        params.set("page", pageToLoad.toString())
        params.set("pageSize", RECEBER_PAGE_SIZE.toString())
        const hasSearch = Boolean(filtersState.search?.trim())
        if (filtersState.status !== "todos") params.set("status", filtersState.status)

        // Calcula datas baseado no período
        const dateRange = getPeriodDateRange(filtersState.periodo, filtersState.mes, filtersState.ano)
        if (dateRange) {
          const useOccurrence = filtersState.status === "recebido"
          if (!useOccurrence) {
            params.set("startDate", dateRange.start)
            params.set("endDate", dateRange.end)
          } else {
            params.set("occurrenceStart", dateRange.start)
            params.set("occurrenceEnd", dateRange.end)
          }
        }

        if (filtersState.vendedorId && filtersState.vendedorId !== "all")
          params.set("vendedorId", filtersState.vendedorId)
        if (filtersState.empresaId && filtersState.empresaId !== "all") {
          params.set("empresaId", filtersState.empresaId)
        }
        if (hasSearch) params.set("search", filtersState.search.trim())

        const res = await fetch(`/api/financeiro/contas-receber?${params.toString()}`)
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(body.error || "Não foi possível carregar as contas a receber.")
        }

        setContasReceber(body.data ?? [])
        setReceberPagination({
          total: body.pagination?.total ?? 0,
          totalPages: body.pagination?.totalPages ?? 1,
        })
        setReceberSummary(body.summary ?? emptyReceberSummary)
        setReceberPage(pageToLoad)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao buscar contas a receber."
        toast({ variant: "destructive", title: "Erro ao carregar", description: message })
      } finally {
        setReceberLoading(false)
      }
    },
    [toast],
  )

  const handleApplyReceberFilters = () => {
    setAppliedReceberFilters(receberFilters)
    carregarContasReceber(1, receberFilters).catch(() => { })
  }

  const handleClearReceberFilters = () => {
    const now = new Date()
    const cleared = {
      status: "todos" as const,
      periodo: "mes" as Periodo,
      mes: now.getMonth() + 1,
      ano: now.getFullYear(),
      vendedorId: "all",
      empresaId: "all",
      search: "",
    }
    setReceberFilters(cleared)
    setAppliedReceberFilters(cleared)
    carregarContasReceber(1, cleared).catch(() => { })
  }

  // Navegar entre períodos (igual analise-vendedores)
  const navegarPeriodoReceber = (direcao: "anterior" | "proximo") => {
    if (receberFilters.periodo === "total") return

    const delta = direcao === "anterior" ? -1 : 1
    let novoMes = receberFilters.mes
    let novoAno = receberFilters.ano

    if (receberFilters.periodo === "mes") {
      novoMes = receberFilters.mes + delta
      if (novoMes < 1) { novoMes = 12; novoAno-- }
      if (novoMes > 12) { novoMes = 1; novoAno++ }
    } else if (receberFilters.periodo === "trimestre") {
      novoMes = receberFilters.mes + (delta * 3)
      if (novoMes < 1) { novoMes = 10; novoAno-- }
      if (novoMes > 12) { novoMes = 1; novoAno++ }
    } else if (receberFilters.periodo === "semestre") {
      novoMes = receberFilters.mes + (delta * 6)
      if (novoMes < 1) { novoMes = 7; novoAno-- }
      if (novoMes > 12) { novoMes = 1; novoAno++ }
    } else if (receberFilters.periodo === "ano") {
      novoAno = receberFilters.ano + delta
    }

    const updatedFilters = { ...receberFilters, mes: novoMes, ano: novoAno }
    setReceberFilters(updatedFilters)
    setAppliedReceberFilters(updatedFilters)
    carregarContasReceber(1, updatedFilters).catch(() => { })
  }

  const handleChangeReceberPage = (direction: "prev" | "next") => {
    const nextPage =
      direction === "prev"
        ? Math.max(1, receberPage - 1)
        : Math.min(receberPagination.totalPages, receberPage + 1)
    carregarContasReceber(nextPage, appliedReceberFilters).catch(() => { })
  }

  const handleGerarBoleto = async (conta: ContaReceber) => {
    if (!conta.bancoEmissorId) {
      toast({
        variant: "destructive",
        title: "Conta sem banco emissor",
        description: "Associe um banco ao pedido para gerar boleto.",
      })
      return
    }
    setBoletoLoadingId(conta.id)
    try {
      const res = await fetch(`/api/boletos/${conta.id}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || "Erro ao gerar boleto.")
      }

      const blob = await res.blob()
      const dispo = res.headers.get("Content-Disposition") || ""
      const match = dispo.match(/filename="(.+)"/)
      const filename = match?.[1] ?? `boleto-${conta.id}.pdf`

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      toast({ title: "Boleto gerado", description: `Débito #${conta.id}` })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao gerar boleto."
      toast({ variant: "destructive", title: "Erro", description: message })
    } finally {
      setBoletoLoadingId(null)
    }
  }

  const handleOpenBaixaManual = (conta: ContaReceber) => {
    setBaixaManualTarget(conta)
    setBaixaManualForm({
      valorRecebido: conta.valor?.toString() ?? "",
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
      await carregarContasReceber(receberPage, appliedReceberFilters)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar baixa manual."
      toast({ variant: "destructive", title: "Erro", description: message })
    } finally {
      setSavingBaixa(false)
    }
  }

  const handleDeleteDebito = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/financeiro/contas-receber/${deleteTarget.id}`, { method: "DELETE" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error || "Não foi possível excluir o débito.")
      }
      toast({ title: "Débito excluído", description: `Débito #${deleteTarget.id} removido.` })
      const isLastItemInPage = contasReceber.length === 1 && receberPage > 1
      const nextPage = isLastItemInPage ? receberPage - 1 : receberPage
      await carregarContasReceber(nextPage, appliedReceberFilters)
      setDeleteTarget(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao excluir débito."
      toast({ variant: "destructive", title: "Erro", description: message })
    } finally {
      setDeleteLoading(false)
    }
  }

  useEffect(() => {
    fetch("/api/bancos")
      .then((res) => res.json())
      .then((res) => setBancos(res.data ?? []))
      .catch(() => setBancos([]))
  }, [])

  useEffect(() => {
    const now = new Date()
    const initialFilters = {
      status: "todos" as const,
      periodo: "mes" as Periodo,
      mes: now.getMonth() + 1,
      ano: now.getFullYear(),
      vendedorId: "all",
      empresaId: "all",
      search: "",
    }
    setReceberFilters(initialFilters)
    setAppliedReceberFilters(initialFilters)
    carregarContasReceber(1, initialFilters).catch(() => { })
  }, [carregarContasReceber])

  useEffect(() => {
    fetch("/api/vendedores")
      .then((res) => res.json())
      .then((data) => {
        const list = data.data ?? []
        setVendedores(list)
        setVendedoresSelecionados(new Set(list.map((v: any) => v.id)))
      })
      .catch(() => setVendedores([]))

    fetch("/api/empresas")
      .then((res) => res.json())
      .then((data) => setEmpresas(data.data ?? []))
      .catch(() => setEmpresas([]))
  }, [])

  useEffect(() => {
    fetchCategoriasPagar().catch(console.error)
    loadContasPagar(1, pagarFilters).catch(() => { })
  }, [fetchCategoriasPagar, loadContasPagar])

  const loadComissoes = useCallback(async () => {
    setComissoesLoading(true)
    try {
      const params = new URLSearchParams()

      // Calcula datas baseado no período
      const dateRange = getPeriodDateRange(comissoesPeriodo, comissoesMes, comissoesAno)
      if (dateRange) {
        params.set("startDate", dateRange.start)
        params.set("endDate", dateRange.end)
      }
      // Se período = "total", não envia datas (retorna todos)

      const res = await fetch(`/api/financeiro/comissoes?${params.toString()}`)
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Erro ao carregar comissões")
      setComissoesAgrupado(body.data?.agrupado ?? [])
      const detalheMapeado = (body.data?.detalhe ?? []).map((d: any) => ({
        ...d,
        vencimento: d.vencimento,
        valorPedido: Number(d.valorPedido ?? 0),
        valorComissao: Number(d.valorComissao ?? 0),
        cliente: d.cliente ?? "",
        vendedorNome: d.vendedorNome ?? "Vendedor",
        contaPagarId: d.contaPagarId ?? null,
        contaPagarStatus: d.contaPagarStatus ?? null,
      }))
      const detalheOrdenado = detalheMapeado.sort((a: any, b: any) => {
        const vendCompare = (a.vendedorNome || "").localeCompare(b.vendedorNome || "")
        if (vendCompare !== 0) return vendCompare
        return (a.id ?? 0) - (b.id ?? 0)
      })
      setComissoesDetalhe(detalheOrdenado)
    } catch (error: any) {
      setComissoesAgrupado([])
      setComissoesDetalhe([])
      toast({
        variant: "destructive",
        title: "Erro ao carregar comissões",
        description: error?.message ?? "Tente novamente",
      })
    } finally {
      setComissoesLoading(false)
    }
  }, [comissoesAno, comissoesMes, comissoesPeriodo, toast])

  // Navegação de período para comissões
  const navegarPeriodoComissoes = (direcao: "anterior" | "proximo") => {
    if (comissoesPeriodo === "total") return

    const delta = direcao === "anterior" ? -1 : 1
    let novoMes = comissoesMes
    let novoAno = comissoesAno

    if (comissoesPeriodo === "mes") {
      novoMes = comissoesMes + delta
      if (novoMes < 1) { novoMes = 12; novoAno-- }
      if (novoMes > 12) { novoMes = 1; novoAno++ }
    } else if (comissoesPeriodo === "trimestre") {
      novoMes = comissoesMes + (delta * 3)
      if (novoMes < 1) { novoMes = 10; novoAno-- }
      if (novoMes > 12) { novoMes = 1; novoAno++ }
    } else if (comissoesPeriodo === "semestre") {
      novoMes = comissoesMes + (delta * 6)
      if (novoMes < 1) { novoMes = 7; novoAno-- }
      if (novoMes > 12) { novoMes = 1; novoAno++ }
    } else if (comissoesPeriodo === "ano") {
      novoAno = comissoesAno + delta
    }

    setComissoesMes(novoMes)
    setComissoesAno(novoAno)
  }

  useEffect(() => {
    loadComissoes().catch(() => { })
  }, [loadComissoes])

  useEffect(() => {
    if (!bancoSelecionado && bancosAgrupados.length) {
      setBancoSelecionado(bancosAgrupados[0].id.toString())
    }
  }, [bancoSelecionado, bancosAgrupados])

  const handleGerarRemessa = async () => {
    if (!bancoSelecionado) {
      toast({ variant: "destructive", title: "Selecione um banco para gerar remessa." })
      return
    }
    setGerandoRemessa(true)
    try {
      const res = await fetch("/api/remessas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bancoId: Number(bancoSelecionado) }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || "Falha ao gerar remessa.")
      }
      const blob = await res.blob()
      const dispo = res.headers.get("Content-Disposition") || ""
      const match = dispo.match(/filename="(.+)"/)
      const filename = match?.[1] ?? "remessa.txt"

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      const nomeBanco = bancos.find((b) => b.id === Number(bancoSelecionado))?.nome ?? "Banco selecionado"
      toast({ title: "Remessa gerada", description: nomeBanco })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao gerar remessa."
      toast({ variant: "destructive", title: "Erro", description: message })
    } finally {
      setGerandoRemessa(false)
      setConfirmRemessa(false)
    }
  }

  const handleGerarFolhaSalarial = () => {
    toast({
      title: "Gerar folha salarial",
      description: "Ação iniciada. Configure a geração conforme sua regra de folha.",
    })
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <DollarSign className="h-8 w-8 text-green-500" />
              Financeiro
            </h1>
            <p className="text-muted-foreground">Gestão financeira completa</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard/cobranca">
                <MessageCircle className="mr-2 h-4 w-4" />
                Ir para cobrança
              </Link>
            </Button>
            <Button variant="default" onClick={() => setGerarComissaoOpen(true)}>
              Gerar comissões
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">
                  <ChevronDown className="mr-2 h-4 w-4" />
                  Mais ações
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="py-2" onClick={() => setConfigBancoOpen(true)}>
                  <Barcode className="mr-2 h-4 w-4" />
                  Custos de boleto
                </DropdownMenuItem>
                <DropdownMenuItem className="py-2" onClick={() => setConfirmRemessa(true)}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Gerar remessa
                </DropdownMenuItem>
                <DropdownMenuItem className="py-2" onClick={() => setTratarRetornoOpen(true)}>
                  <FileUp className="mr-2 h-4 w-4" />
                  Tratar retorno
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <GerenciarCategoriasDialog
              open={gerenciarCategoriasOpen}
              onOpenChange={setGerenciarCategoriasOpen}
              categorias={categoriasPagar}
              onUpdate={fetchCategoriasPagar}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />A Receber esse mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {formatCurrency(receberSummary.abertoMesAtual.total)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Esse mês</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />A Pagar esse mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {formatCurrency(totalAPagarMes)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Esse mês</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Recebido esse mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">
                {formatCurrency(receberSummary.recebidoMesAtual.total)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Esse mês</p>
            </CardContent>
          </Card>
          {/* <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Vencidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">A Receber:</span>
                  <span className="text-sm font-bold text-orange-500">
                    R$ {totalReceberVencido.toLocaleString("pt-BR")} ({totalReceberVencidoCount})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">A Pagar:</span>
                  <span className="text-sm font-bold text-red-500">
                    R$ {totalPagarVencido.toLocaleString("pt-BR")} ({contasPagarVencidas.length})
                  </span>
                </div>
              </div>
            </CardContent>
          </Card> */}
        </div>

        <Tabs defaultValue="receber" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-muted">
            <TabsTrigger
              value="receber"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              Contas a Receber
            </TabsTrigger>
            <TabsTrigger
              value="pagar"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              Contas a Pagar
            </TabsTrigger>
            <TabsTrigger
              value="comissoes"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              Comissões
            </TabsTrigger>
          </TabsList>

          <TabsContent value="receber" className="mt-6">
            <Card className="border-border bg-card">
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-4">
                  {/* Título e ações */}
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-foreground">Contas a Receber</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Títulos pendentes e programados para recebimento
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleClearReceberFilters}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Limpar
                      </Button>
                    </div>
                  </div>

                  {/* Barra de pesquisa */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nº débito, nº pedido ou nome do cliente..."
                      value={receberFilters.search}
                      onChange={(e) => setReceberFilters((prev) => ({ ...prev, search: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleApplyReceberFilters()
                      }}
                      className="pl-10 bg-background"
                    />
                    {receberFilters.search && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => {
                          const cleared = { ...receberFilters, search: "" }
                          setReceberFilters(cleared)
                          setAppliedReceberFilters(cleared)
                          carregarContasReceber(1, cleared).catch(() => { })
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  {/* Seletor de período e filtros */}
                  <div className="flex flex-col md:flex-row md:items-end gap-4">
                    {/* Período (igual analise-vendedor) */}
                    <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">
                          {receberFilters.status === "recebido" ? "Pago em:" : "Vencimento:"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 bg-background rounded-lg px-2 py-1 border">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => navegarPeriodoReceber("anterior")}
                          disabled={receberFilters.periodo === "total"}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium text-foreground min-w-[130px] text-center">
                          {getPeriodoLabel(receberFilters.periodo, receberFilters.mes, receberFilters.ano)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => navegarPeriodoReceber("proximo")}
                          disabled={receberFilters.periodo === "total"}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                      <Select
                        value={receberFilters.periodo}
                        onValueChange={(v) => {
                          const updated = { ...receberFilters, periodo: v as Periodo }
                          setReceberFilters(updated)
                          setAppliedReceberFilters(updated)
                          carregarContasReceber(1, updated).catch(() => { })
                        }}
                      >
                        <SelectTrigger className="h-9 w-[130px] text-sm bg-background">
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

                    {/* Outros filtros */}
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Status</span>
                        <Select
                          value={receberFilters.status}
                          onValueChange={(value) => {
                            const updated = { ...receberFilters, status: value as typeof receberFilters.status }
                            setReceberFilters(updated)
                            setAppliedReceberFilters(updated)
                            carregarContasReceber(1, updated).catch(() => { })
                          }}
                        >
                          <SelectTrigger className="bg-background w-[130px]">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todos">Todos</SelectItem>
                            <SelectItem value="a_receber">A Receber</SelectItem>
                            <SelectItem value="vencido">Vencido</SelectItem>
                            <SelectItem value="recebido">Recebido</SelectItem>
                            <SelectItem value="cancelado">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Vendedor</span>
                        <Select
                          value={receberFilters.vendedorId}
                          onValueChange={(value) => {
                            const updated = { ...receberFilters, vendedorId: value }
                            setReceberFilters(updated)
                            setAppliedReceberFilters(updated)
                            carregarContasReceber(1, updated).catch(() => { })
                          }}
                        >
                          <SelectTrigger className="bg-background w-[160px]">
                            <SelectValue placeholder="Vendedor" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos vendedores</SelectItem>
                            {vendedores.map((vend) => (
                              <SelectItem key={vend.id} value={vend.id}>
                                {vend.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Empresa</span>
                        <Select
                          value={receberFilters.empresaId}
                          onValueChange={(value) => {
                            const updated = { ...receberFilters, empresaId: value }
                            setReceberFilters(updated)
                            setAppliedReceberFilters(updated)
                            carregarContasReceber(1, updated).catch(() => { })
                          }}
                        >
                          <SelectTrigger className="bg-background w-[160px]">
                            <SelectValue placeholder="Empresa" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas empresas</SelectItem>
                            {empresas.map((emp) => (
                              <SelectItem key={emp.id} value={emp.id.toString()}>
                                {emp.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Button size="sm" onClick={handleApplyReceberFilters} disabled={receberLoading}>
                        {receberLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Filter className="mr-2 h-4 w-4" />}
                        Filtrar
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <div className="px-6 pb-3 text-sm text-muted-foreground">
                Total listado (filtros):{" "}
                <span className="text-foreground font-semibold">
                  {formatCurrency(receberSummary.filteredTotal)}
                </span>
              </div>

              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">ID</TableHead>
                      <TableHead className="text-muted-foreground">Vencimento</TableHead>
                      <TableHead className="text-muted-foreground">Ocorrência</TableHead>
                      <TableHead className="text-muted-foreground">Valor</TableHead>
                      <TableHead className="text-muted-foreground">Cliente</TableHead>
                      <TableHead className="text-muted-foreground">Estado</TableHead>
                      <TableHead className="text-muted-foreground">Vendedor</TableHead>
                      <TableHead className="text-muted-foreground">Status</TableHead>
                      <TableHead className="text-muted-foreground">Ações</TableHead>
                      <TableHead className="text-muted-foreground text-right">Excluir</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receberLoading ? (
                      <TableRow>
                        <TableCell colSpan={9}>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Carregando...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : contasReceber.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          Nenhum débito encontrado com os filtros selecionados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      contasReceber.map((conta) => {
                        // Lógica igual ao legado:
                        // - stats = 2: Recebido
                        // - stats = -1: Cancelado
                        // - stats = 0 E vencimento < hoje: Vencido
                        // - stats = 0 E vencimento >= hoje: A Receber
                        // Comparação de datas: extrair apenas a parte da data (YYYY-MM-DD) para comparar dias
                        const hojeStr = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })
                        const vencimentoStr = conta.vencimento
                          ? new Date(conta.vencimento).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })
                          : null
                        const isVencido = conta.stats === 0 && vencimentoStr && vencimentoStr < hojeStr
                        const isCancelado = conta.stats === -1
                        const isRecebido = conta.stats === 2

                        const statusLabel = isRecebido
                          ? "Recebido"
                          : isCancelado
                            ? "Cancelado"
                            : isVencido
                              ? "Vencido"
                              : "A Receber"
                        const statusClasses = isRecebido
                          ? "bg-green-500/10 text-green-500 border-green-500"
                          : isCancelado
                            ? "bg-gray-500/10 text-gray-500 border-gray-500"
                            : isVencido
                              ? "bg-red-500/10 text-red-500 border-red-500"
                              : "border-yellow-500 text-yellow-600"

                        return (
                          <TableRow key={conta.id} className="border-border hover:bg-accent/5 odd:bg-white even:bg-slate-100/80">
                            <TableCell className="font-semibold text-foreground">#{conta.id}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {formatDate(conta.vencimento)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {formatDate(conta.dataOcorrencia)}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium text-foreground">{formatCurrency(conta.valor)}</TableCell>
                            <TableCell>
                              <button
                                type="button"
                                onClick={() => setClienteDetailId(conta.clienteId)}
                                className="font-medium text-foreground hover:text-blue-600 hover:underline cursor-pointer text-left"
                              >
                                {conta.cliente}
                              </button>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{conta.estado || "-"}</TableCell>
                            <TableCell className="text-muted-foreground">{conta.vendedor || "-"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={statusClasses}>
                                {statusLabel}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleGerarBoleto(conta)}
                                  disabled={boletoLoadingId === conta.id || isRecebido || isCancelado}
                                  title={isRecebido ? "Já recebido" : isCancelado ? "Cancelado" : "Gerar boleto"}
                                >
                                  {boletoLoadingId === conta.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Barcode className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenBaixaManual(conta)}
                                  disabled={isRecebido || isCancelado}
                                  title={isRecebido ? "Já recebido" : isCancelado ? "Cancelado" : "Baixa manual"}
                                >
                                  <ArrowDownToLine className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteTarget(conta)}
                                title="Excluir débito"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>

                <div className="flex items-center justify-between px-6 py-4 border-t border-border">
                  <div className="text-sm text-muted-foreground">
                    Página {receberPage} de {receberPagination.totalPages} • {receberPagination.total} registros
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={receberPage === 1 || receberLoading}
                      onClick={() => handleChangeReceberPage("prev")}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={receberPage >= receberPagination.totalPages || receberLoading}
                      onClick={() => handleChangeReceberPage("next")}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pagar" className="mt-6">
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-foreground">Contas a Pagar</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Despesas e obrigações financeiras
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-full border border-border bg-muted/60 p-1">
                      <Button
                        variant={pagarView === "geral" ? "default" : "ghost"}
                        size="sm"
                        className={cn(
                          "rounded-full",
                          pagarView === "geral" ? "bg-blue-600 text-white hover:bg-blue-600" : "text-foreground",
                        )}
                        onClick={() => setPagarView("geral")}
                      >
                        Geral
                      </Button>
                      <Button
                        variant={pagarView === "categoria" ? "default" : "ghost"}
                        size="sm"
                        className={cn(
                          "rounded-full",
                          pagarView === "categoria" ? "bg-blue-600 text-white hover:bg-blue-600" : "text-foreground",
                        )}
                        onClick={() => setPagarView("categoria")}
                      >
                        Por categoria
                      </Button>
                    </div>
                    <Button variant="default" size="sm" onClick={() => setCadastroOpen(true)} disabled={creatingConta}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nova conta
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setGerenciarCategoriasOpen(true)}>
                      Categorias
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-6">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Status</span>
                    <Select
                      value={pagarFilters.status}
                      onValueChange={(value: "todos" | "a_pagar" | "pago") =>
                        setPagarFilters((prev) => ({ ...prev, status: value }))
                      }
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="a_pagar">A pagar</SelectItem>
                        <SelectItem value="pago">Pagos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Categoria</span>
                    <Select
                      value={String(pagarFilters.categoriaId)}
                      onValueChange={(value) =>
                        setPagarFilters((prev) => ({
                          ...prev,
                          categoriaId: value,
                        }))
                      }
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="sem">Sem categoria</SelectItem>
                        {categoriasPagar.map((cat) => (
                          <SelectItem key={cat.id} value={String(cat.id)}>
                            {cat.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {pagarFilters.status === "pago" ? "Pago (De)" : "Vencimento (De)"}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setPagarFilters((prev) => ({ ...prev, startDate: "" }))}
                        title="Limpar"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <Input
                      type="date"
                      value={pagarFilters.startDate}
                      onChange={(e) => setPagarFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                      className="bg-background"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {pagarFilters.status === "pago" ? "Pago (Até)" : "Vencimento (Até)"}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setPagarFilters((prev) => ({ ...prev, endDate: "" }))}
                        title="Limpar"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <Input
                      type="date"
                      value={pagarFilters.endDate}
                      onChange={(e) => setPagarFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                      className="bg-background"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row lg:flex-row gap-2 items-end col-span-full lg:col-span-2 xl:col-span-2 justify-end">
                    <Button onClick={handleApplyPagarFilters} className="w-full lg:w-auto" disabled={pagarLoading}>
                      {pagarLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4 mr-2" />}
                      Filtrar
                    </Button>
                    <Button variant="outline" onClick={handleClearPagarFilters} disabled={pagarLoading} className="w-full lg:w-auto">
                      Limpar
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="px-6 py-3 flex flex-col gap-2">
                  <div className="text-sm text-muted-foreground">
                    Total (filtro atual):{" "}
                    <span className="text-foreground font-semibold">
                      R$ {pagarFilteredTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  {pagarHasOverdue && (
                    <div className="">
                      <div className="inline-flex w-auto items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        <AlertCircle className="h-4 w-4" />
                        Há contas vencidas neste filtro.
                      </div>
                    </div>
                  )}

                  {selectedPagar.size > 0 && pagarView === "categoria" && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-top-1">
                      <span className="text-sm font-medium text-blue-700">
                        {selectedPagar.size} conta(s) selecionada(s)
                      </span>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={handleBulkMarkAsPaidPagar}
                        disabled={markingPagarAsPaid}
                      >
                        {markingPagarAsPaid ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <DollarSign className="h-4 w-4 mr-2" />}
                        Marcar como pagas
                      </Button>
                    </div>
                  )}
                </div>

                {pagarView === "geral" ? (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="text-muted-foreground">Descrição</TableHead>
                          <TableHead className="text-muted-foreground">Categoria</TableHead>
                          <TableHead className="text-muted-foreground">Valor</TableHead>
                          <TableHead className="text-muted-foreground">Vencimento</TableHead>
                          <TableHead className="text-muted-foreground">Pago em</TableHead>
                          <TableHead className="text-muted-foreground">Status</TableHead>
                          <TableHead className="text-muted-foreground text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagarLoading ? (
                          <TableRow>
                            <TableCell colSpan={6}>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Carregando...
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : contasPagar.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground">
                              Nenhuma conta encontrada.
                            </TableCell>
                          </TableRow>
                        ) : (
                          contasPagar.map((conta) => (
                            <TableRow
                              key={conta.id}
                              className={cn(
                                "border-border hover:bg-accent/5",
                                conta.isGroup ? "odd:bg-white even:bg-slate-100/80" : "odd:bg-white even:bg-slate-100/80"
                              )}
                            >
                              <TableCell className="font-medium text-foreground">
                                <div className="flex items-center gap-2">
                                  {conta.descricao || "-"}

                                </div>
                              </TableCell>
                              <TableCell>
                                {conta.isGroup ? (
                                  <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200">Comissões</Badge>
                                ) : (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button className="flex items-center gap-1 hover:bg-muted/50 px-1 rounded transition-colors text-left group">
                                        <Badge variant="outline" className="border-border text-muted-foreground cursor-pointer group-hover:border-blue-300">
                                          {conta.categoriaNome ?? "Sem categoria"}
                                          <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
                                        </Badge>
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-56 overflow-y-auto max-h-[300px]">
                                      <DropdownMenuItem onClick={() => handleUpdateContaCategoria(conta.id, null)} className="cursor-pointer">
                                        Sem categoria
                                      </DropdownMenuItem>
                                      {categoriasPagar.map((cat) => (
                                        <DropdownMenuItem
                                          key={cat.id}
                                          onClick={() => handleUpdateContaCategoria(conta.id, cat.id)}
                                          className={cn("cursor-pointer", conta.categoriaId === cat.id && "bg-blue-50 font-bold")}
                                        >
                                          {cat.nome}
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </TableCell>
                              <TableCell className={cn("font-medium", "text-foreground")}>
                                {formatCurrency(conta.valor)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(conta.vencimento)}
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {conta.pagoEm ? formatDate(conta.pagoEm) : "-"}
                              </TableCell>
                              <TableCell>
                                {!conta.isGroup ? (
                                  <Badge variant="outline" className={statusPagarClass(conta.status)}>
                                    {statusPagarLabel(conta.status)}
                                  </Badge>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground italic">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {!conta.isGroup ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleOpenEditContaPagar(conta)}
                                        title="Editar conta"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleBaixarConta(conta)}
                                        disabled={conta.status === 1}
                                        title={conta.status === 1 ? "Já pago" : "Baixa manual"}
                                      >
                                        <ArrowDownToLine className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setDeleteContaPagar(conta)}
                                        title="Excluir conta"
                                      >
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                      </Button>
                                    </>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground italic">Pagar na aba "Por Categoria"</span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>

                    <div className="flex items-center justify-between px-6 py-4 border-t border-border">
                      <div className="text-sm text-muted-foreground">
                        Página {pagarPage} de {pagarPagination.totalPages} • {pagarPagination.total} registros
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pagarPage === 1 || pagarLoading}
                          onClick={() => handleChangePagarPage("prev")}
                        >
                          Anterior
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pagarPage >= pagarPagination.totalPages || pagarLoading}
                          onClick={() => handleChangePagarPage("next")}
                        >
                          Próxima
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="w-10"></TableHead>
                          <TableHead className="text-muted-foreground w-[250px]">Categoria</TableHead>
                          <TableHead className="text-muted-foreground w-[150px]">Total</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagarLoading ? (
                          <TableRow>
                            <TableCell colSpan={3}>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Carregando...
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : pagarByCategoria.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground">
                              Nenhuma categoria encontrada.
                            </TableCell>
                          </TableRow>
                        ) : (
                          pagarByCategoria.map((cat) => {
                            const isExpanded = expandedCategorias.has(cat.categoriaId ?? "sem")
                            const isComissao = cat.nome.toLowerCase().includes("comiss")

                            return (
                              <Fragment key={cat.categoriaId ?? "sem"}>
                                <TableRow className="border-border odd:bg-white even:bg-slate-100/80 hover:bg-accent/5">
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Checkbox
                                        checked={cat.itens.every(it => selectedPagar.has(it.id))}
                                        onCheckedChange={(val) => {
                                          setSelectedPagar(prev => {
                                            const next = new Set(prev)
                                            cat.itens.forEach(it => {
                                              if (val) next.add(it.id)
                                              else next.delete(it.id)
                                            })
                                            return next
                                          })
                                        }}
                                      />
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => {
                                          setExpandedCategorias(prev => {
                                            const next = new Set(prev)
                                            const key = cat.categoriaId ?? "sem"
                                            if (next.has(key)) next.delete(key)
                                            else next.add(key)
                                            return next
                                          })
                                        }}
                                      >
                                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                      </Button>
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-medium text-foreground">
                                    {cat.nome}
                                  </TableCell>
                                  <TableCell className="font-medium text-foreground">
                                    {formatCurrency(cat.total)}
                                  </TableCell>
                                  <TableCell />
                                </TableRow>
                                {isExpanded && cat.itens && cat.itens.length > 0 && (
                                  <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                                    <TableCell colSpan={3} className="px-6 py-4">
                                      <div className="border rounded-lg overflow-hidden bg-white shadow-sm p-4">
                                        {isComissao ? (
                                          // Group by Seller inside Commission category
                                          (() => {
                                            const groups = new Map<string, any[]>()
                                            cat.itens.forEach((it: any) => {
                                              const sellerName = it.vendedorNome || "Sem vendedor"
                                              if (!groups.has(sellerName)) groups.set(sellerName, [])
                                              groups.get(sellerName)!.push(it)
                                            })
                                            return Array.from(groups.entries()).map(([seller, items]) => {
                                              const sellerExpanded = expandedVendedores.has(`${cat.categoriaId}-${seller}`)
                                              const sellerTotal = items.reduce((sum, it) => sum + it.valor, 0)
                                              return (
                                                <div key={seller} className="mb-4 last:mb-0 border rounded-md overflow-hidden">
                                                  <div className="flex items-center justify-between p-2 bg-slate-100/50">
                                                    <div className="flex items-center gap-2">
                                                      <Checkbox
                                                        checked={items.every(it => selectedPagar.has(it.id))}
                                                        onCheckedChange={(val) => {
                                                          setSelectedPagar(prev => {
                                                            const next = new Set(prev)
                                                            items.forEach(it => {
                                                              if (val) next.add(it.id)
                                                              else next.delete(it.id)
                                                            })
                                                            return next
                                                          })
                                                        }}
                                                      />
                                                      <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => {
                                                          setExpandedVendedores(prev => {
                                                            const next = new Set(prev)
                                                            const key = `${cat.categoriaId}-${seller}`
                                                            if (next.has(key)) next.delete(key)
                                                            else next.add(key)
                                                            return next
                                                          })
                                                        }}
                                                      >
                                                        {sellerExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                      </Button>
                                                      <span className="font-semibold text-sm italic">{seller}</span>
                                                    </div>
                                                    <span className="text-sm font-bold text-blue-600">{formatCurrency(sellerTotal)}</span>
                                                  </div>
                                                  {sellerExpanded && (
                                                    <div className="p-2 overflow-x-auto">
                                                      <ItemActionTable
                                                        items={items}
                                                        selectedPagar={selectedPagar}
                                                        setSelectedPagar={setSelectedPagar}
                                                        handleBaixar={handleBaixarConta}
                                                        handleDelete={setDeleteContaPagar}
                                                        handleEdit={handleOpenEditContaPagar}
                                                        statusPagarClass={statusPagarClass}
                                                        statusPagarLabel={statusPagarLabel}
                                                        formatCurrency={formatCurrency}
                                                        formatDate={formatDate}
                                                      />
                                                    </div>
                                                  )}
                                                </div>
                                              )
                                            })
                                          })()
                                        ) : (
                                          // Standard list for other categories
                                          <div className="overflow-x-auto">
                                            <ItemActionTable
                                              items={cat.itens}
                                              selectedPagar={selectedPagar}
                                              setSelectedPagar={setSelectedPagar}
                                              handleBaixar={handleBaixarConta}
                                              handleDelete={setDeleteContaPagar}
                                              handleEdit={handleOpenEditContaPagar}
                                              statusPagarClass={statusPagarClass}
                                              statusPagarLabel={statusPagarLabel}
                                              formatCurrency={formatCurrency}
                                              formatDate={formatDate}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </Fragment>
                            )
                          })
                        )}
                        <TableRow className="border-t-2 border-border bg-slate-100/50">
                          <TableCell></TableCell>
                          <TableCell className="font-bold text-foreground">TOTAL</TableCell>
                          <TableCell className="font-bold text-foreground">
                            {formatCurrency(pagarFilteredTotal)}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comissoes" className="mt-6">
            <Card className="border-border bg-card">
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-foreground">Comissões</CardTitle>
                      <CardDescription className="text-muted-foreground">Visualize o resumo e o detalhe das comissões.</CardDescription>
                    </div>
                  </div>

                  {/* Seletor de período (igual contas a receber) */}
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">Período:</span>
                      </div>
                      <div className="flex items-center gap-1 bg-background rounded-lg px-2 py-1 border">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => navegarPeriodoComissoes("anterior")}
                          disabled={comissoesPeriodo === "total"}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium text-foreground min-w-[130px] text-center">
                          {getPeriodoLabel(comissoesPeriodo, comissoesMes, comissoesAno)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => navegarPeriodoComissoes("proximo")}
                          disabled={comissoesPeriodo === "total"}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                      <Select
                        value={comissoesPeriodo}
                        onValueChange={(v) => setComissoesPeriodo(v as Periodo)}
                      >
                        <SelectTrigger className="h-9 w-[130px] text-sm bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mes">Mês</SelectItem>
                          <SelectItem value="trimestre">Trimestre</SelectItem>
                          <SelectItem value="semestre">Semestre</SelectItem>
                          <SelectItem value="ano">Ano</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={() => loadComissoes()} disabled={comissoesLoading}>
                        {comissoesLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Filter className="mr-2 h-4 w-4" />}
                        Filtrar
                      </Button>
                    </div>
                  </div>

                  {/* Botões de visualização e total */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <Button
                        variant={comissoesView === "agrupado" ? "default" : "ghost"}
                        size="sm"
                        className={cn(
                          "rounded-full",
                          comissoesView === "agrupado" ? "bg-blue-600 text-white hover:bg-blue-600" : "text-foreground",
                        )}
                        onClick={() => setComissoesView("agrupado")}
                      >
                        Resumo por vendedor
                      </Button>
                      <Button
                        variant={comissoesView === "detalhado" ? "default" : "ghost"}
                        size="sm"
                        className={cn(
                          "rounded-full",
                          comissoesView === "detalhado" ? "bg-blue-600 text-white hover:bg-blue-600" : "text-foreground",
                        )}
                        onClick={() => setComissoesView("detalhado")}
                      >
                        Detalhado
                      </Button>
                    </div>

                    {/* Total de comissões no período */}
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total no período</p>
                      <p className="text-lg font-bold text-green-600">{formatCurrency(totalComissoesFiltro)}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {comissoesView === "agrupado" ? (
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-semibold text-foreground">Resumo por vendedor</p>
                      {selectedComissoes.size > 0 && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={handleMarkSelectedComissoesAsPaid}
                          disabled={markingComissoesAsPaid}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          {markingComissoesAsPaid ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <DollarSign className="h-4 w-4 mr-2" />}
                          Pagar selecionadas ({selectedComissoes.size})
                        </Button>
                      )}
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="w-10"></TableHead>
                          <TableHead className="text-muted-foreground">Vendedor</TableHead>
                          <TableHead className="text-muted-foreground text-right">Vendido</TableHead>
                          <TableHead className="text-muted-foreground text-right">Total comissão</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comissoesLoading ? (
                          <TableRow>
                            <TableCell colSpan={4}>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Carregando...
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : comissoesPorVendedor.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                              Nenhum registro no período.
                            </TableCell>
                          </TableRow>
                        ) : (
                          comissoesPorVendedor.map((g) => {
                            const isExpanded = expandedVendedores.has(g.vendedor)
                            const groupItemIds = g.itens.filter(i => i.contaPagarId && i.contaPagarStatus !== 1).map(i => i.id)
                            const allSelected = groupItemIds.length > 0 && groupItemIds.every(id => selectedComissoes.has(id))

                            return (
                              <Fragment key={g.vendedor}>
                                <TableRow className="border-border odd:bg-white even:bg-slate-100/80 hover:bg-accent/5">
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Checkbox
                                        checked={allSelected}
                                        onCheckedChange={(checked) => {
                                          setSelectedComissoes(prev => {
                                            const next = new Set(prev)
                                            if (checked) {
                                              groupItemIds.forEach(id => next.add(id))
                                            } else {
                                              groupItemIds.forEach(id => next.delete(id))
                                            }
                                            return next
                                          })
                                        }}
                                        disabled={groupItemIds.length === 0}
                                      />
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => {
                                          setExpandedVendedores(prev => {
                                            const next = new Set(prev)
                                            if (next.has(g.vendedor)) next.delete(g.vendedor)
                                            else next.add(g.vendedor)
                                            return next
                                          })
                                        }}
                                      >
                                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                      </Button>
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-medium text-foreground">{g.vendedor}</TableCell>
                                  <TableCell className="text-right font-medium text-foreground">
                                    {formatCurrency(g.totalVendido)}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold text-green-600">
                                    {formatCurrency(g.totalComissao)}
                                  </TableCell>
                                </TableRow>
                                {isExpanded && (
                                  <TableRow className="bg-slate-50/50">
                                    <TableCell colSpan={4} className="px-12 py-4">
                                      <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                                        <Table>
                                          <TableHeader className="bg-slate-50">
                                            <TableRow>
                                              <TableHead className="w-[40px]"></TableHead>
                                              <TableHead className="text-[11px] uppercase font-semibold">Vencimento</TableHead>
                                              <TableHead className="text-[11px] uppercase font-semibold">Cliente</TableHead>
                                              <TableHead className="text-[11px] uppercase font-semibold text-right">Vendido</TableHead>
                                              <TableHead className="text-[11px] uppercase font-semibold text-right">Comissão</TableHead>
                                              <TableHead className="text-[11px] uppercase font-semibold">Status</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {g.itens.map((c: any) => (
                                              <TableRow key={c.id} className="hover:bg-slate-50/80">
                                                <TableCell>
                                                  <Checkbox
                                                    checked={selectedComissoes.has(c.id)}
                                                    onCheckedChange={(checked) => {
                                                      setSelectedComissoes(prev => {
                                                        const next = new Set(prev)
                                                        if (checked) next.add(c.id)
                                                        else next.delete(c.id)
                                                        return next
                                                      })
                                                    }}
                                                    disabled={!c.contaPagarId || c.contaPagarStatus === 1}
                                                  />
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                  {c.vencimento ? new Date(c.vencimento).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "-"}
                                                </TableCell>
                                                <TableCell className="text-sm">{c.cliente || "-"}</TableCell>
                                                <TableCell className="text-sm text-right">
                                                  {formatCurrency(c.valorPedido)}
                                                </TableCell>
                                                <TableCell className="text-sm text-right font-semibold text-green-600">
                                                  {formatCurrency(c.valorComissao)}
                                                </TableCell>
                                                <TableCell>
                                                  {c.contaPagarId ? (
                                                    c.contaPagarStatus === 1 ? (
                                                      <Badge className="bg-green-500/10 text-green-600 border-green-500/40 text-[10px] h-5">Pago</Badge>
                                                    ) : (
                                                      <Badge className="bg-red-500 text-white border-red-500 text-[10px] h-5">Pendente</Badge>
                                                    )
                                                  ) : (
                                                    <Badge className="bg-red-500 text-white border-red-500 text-[10px] h-5">Sem conta</Badge>
                                                  )}
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </Fragment>
                            )
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="px-4 pb-4">
                    <p className="text-sm font-semibold text-foreground mb-2">Detalhe das comissões</p>
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="text-muted-foreground">ID</TableHead>
                          <TableHead className="text-muted-foreground">Vencimento</TableHead>
                          <TableHead className="text-muted-foreground">Cliente</TableHead>
                          <TableHead className="text-muted-foreground">Vendedor</TableHead>
                          <TableHead className="text-muted-foreground text-right">Total pedido</TableHead>
                          <TableHead className="text-muted-foreground text-right">Comissão</TableHead>
                          <TableHead className="text-muted-foreground">Conta a pagar</TableHead>
                          <TableHead className="text-muted-foreground">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comissoesLoading ? (
                          <TableRow>
                            <TableCell colSpan={7}>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Carregando...
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : comissoesDetalhe.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground">
                              Nenhum registro no período.
                            </TableCell>
                          </TableRow>
                        ) : (
                          comissoesDetalhe.map((c) => (
                            <TableRow key={c.id} className="border-border hover:bg-accent/5">
                              <TableCell className="font-medium text-foreground">#{c.id}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {c.vencimento ? new Date(c.vencimento).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "-"}
                              </TableCell>
                              <TableCell className="text-foreground">{c.cliente || "-"}</TableCell>
                              <TableCell className="text-foreground">{c.vendedorNome || "-"}</TableCell>
                              <TableCell className="text-right font-medium text-foreground">
                                R$ {c.valorPedido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-green-600">
                                R$ {c.valorComissao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell>
                                {c.contaPagarId ? (
                                  <Badge variant="outline" className="text-foreground border-border">
                                    #{c.contaPagarId}
                                  </Badge>
                                ) : (
                                  <Badge className="border-red-500 text-red-600">Não vinculado</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {c.contaPagarId ? (
                                  c.contaPagarStatus === 1 ? (
                                    <Badge className="bg-green-500/10 text-green-600 border-green-500/40">Pago</Badge>
                                  ) : (
                                    <Badge className="bg-red-500 text-white border-red-500">Pendente</Badge>
                                  )
                                ) : (
                                  <Badge className="bg-red-500 text-white border-red-500">Sem conta</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>

      <CadastroContaPagarDialog
        open={cadastroOpen}
        onOpenChange={setCadastroOpen}
        categorias={categoriasPagar as Array<{ id: number; nome: string }>}
        onCreateCategoria={handleCreateCategoria}
        onSubmit={handleCreateContaPagar}
      />
      <BaixarContaDialog
        open={baixarOpenPagar}
        onOpenChange={setBaixarOpenPagar}
        conta={baixarContaAlvo}
        onConfirm={handleConfirmBaixaPagar}
      />
      {/* ── Dialog: Editar Conta a Pagar ─────────────────────────────────────── */}
      <Dialog open={Boolean(editContaPagar)} onOpenChange={(open) => !open && setEditContaPagar(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Editar Conta a Pagar #{editContaPagar?.id}
            </DialogTitle>
            <DialogDescription>
              {editContaPagar?.comissaoId
                ? "Esta conta está vinculada a uma comissão. Valor e vencimento serão sincronizados automaticamente."
                : "Edite os campos desejados e salve."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Descrição</Label>
              <Input
                value={editContaPagarForm.descricao}
                onChange={(e) => setEditContaPagarForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Ex: Conta de luz dezembro"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Valor (R$)</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={editContaPagarForm.valor}
                  onChange={(e) => setEditContaPagarForm((f) => ({ ...f, valor: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Vencimento</Label>
                <Input
                  type="date"
                  value={editContaPagarForm.vencimento}
                  onChange={(e) => setEditContaPagarForm((f) => ({ ...f, vencimento: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Categoria</Label>
              <Select
                value={editContaPagarForm.categoriaId || "none"}
                onValueChange={(v) => setEditContaPagarForm((f) => ({ ...f, categoriaId: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {categoriasPagar.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {cat.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditContaPagar(null)} disabled={savingEditContaPagar}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEditContaPagar} disabled={savingEditContaPagar}>
              {savingEditContaPagar ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteContaPagar)} onOpenChange={(open) => !deleteContaPagarLoading && setDeleteContaPagar(open ? deleteContaPagar : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir conta a pagar</DialogTitle>
            <DialogDescription>
              Essa ação não pode ser desfeita. Deseja remover a conta {deleteContaPagar ? `#${deleteContaPagar.id}` : ""}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteContaPagar(null)} disabled={deleteContaPagarLoading}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteContaPagar} disabled={deleteContaPagarLoading}>
              {deleteContaPagarLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfiguracaoBancoDialog open={configBancoOpen} onOpenChange={setConfigBancoOpen} />
      <TratarRetornoDialog open={tratarRetornoOpen} onOpenChange={setTratarRetornoOpen} />
      <Dialog open={baixaManualOpen} onOpenChange={(open) => !savingBaixa && setBaixaManualOpen(open)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Baixa manual</DialogTitle>
            <DialogDescription>Registre o recebimento deste débito.</DialogDescription>
          </DialogHeader>
          {baixaManualTarget && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Débito</span>
                  <span className="font-semibold text-foreground">#{baixaManualTarget.id}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="font-medium text-foreground">{baixaManualTarget.cliente}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor</span>
                  <span className="font-semibold text-foreground">{formatCurrency(baixaManualTarget.valor)}</span>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">Data da ocorrência</label>
                  <Input
                    type="date"
                    value={baixaManualForm.dataOcorrencia}
                    onChange={(e) => setBaixaManualForm((prev) => ({ ...prev, dataOcorrencia: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">Valor recebido</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={baixaManualForm.valorRecebido}
                    onChange={(e) => setBaixaManualForm((prev) => ({ ...prev, valorRecebido: e.target.value }))}
                    placeholder="0,00"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">Acréscimos</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={baixaManualForm.acrescimos}
                      onChange={(e) => setBaixaManualForm((prev) => ({ ...prev, acrescimos: e.target.value }))}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">Descontos</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={baixaManualForm.descontos}
                      onChange={(e) => setBaixaManualForm((prev) => ({ ...prev, descontos: e.target.value }))}
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setBaixaManualOpen(false)} disabled={savingBaixa}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmitBaixaManual} disabled={savingBaixa}>
                  {savingBaixa ? "Salvando..." : "Confirmar"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (deleteLoading) return
          setDeleteTarget(open ? deleteTarget : null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir débito</DialogTitle>
            <DialogDescription>
              Esta ação removerá o débito {deleteTarget ? `#${deleteTarget.id}` : ""}. Confirma?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteDebito} disabled={deleteLoading}>
              {deleteLoading ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={gerarComissaoOpen} onOpenChange={(open) => !gerarComissaoLoading && setGerarComissaoOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerar comissões</DialogTitle>
            <DialogDescription>
              Fluxo igual ao legado: pedidos com débito recebido (stats=2) até a data de corte e sem comissão gerada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Data de corte</label>
              <Input type="date" value={dataCorte} onChange={(e) => setDataCorte(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Considera débitos recebidos (stats=2) com ocorrência até a data informada.
              </p>
            </div>

            <div className="space-y-2 border rounded-lg p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">Vendedores (role VENDEDOR)</p>
                  <p className="text-xs text-muted-foreground">Selecionados por padrão.</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVendedoresSelecionados(new Set(vendedores.map((v) => v.id)))}
                  >
                    Selecionar todos
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setVendedoresSelecionados(new Set())}>
                    Limpar seleção
                  </Button>
                </div>
              </div>

              <div className="max-h-64 overflow-auto space-y-2">
                {vendedores.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum vendedor encontrado.</p>
                ) : (
                  vendedores.map((vend) => {
                    const checked = vendedoresSelecionados.has(vend.id)
                    return (
                      <label
                        key={vend.id}
                        className="flex items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={checked}
                          onChange={(e) => {
                            setVendedoresSelecionados((prev) => {
                              const next = new Set(prev)
                              if (e.target.checked) next.add(vend.id)
                              else next.delete(vend.id)
                              return next
                            })
                          }}
                        />
                        <div className="flex flex-col leading-tight">
                          <span className="text-sm font-medium text-foreground">{vend.name}</span>
                          <span className="text-xs text-muted-foreground">{vend.id}</span>
                        </div>
                      </label>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGerarComissaoOpen(false)} disabled={gerarComissaoLoading}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!dataCorte) {
                  toast({ variant: "destructive", title: "Informe a data de corte" })
                  return
                }
                setGerarComissaoLoading(true)
                try {
                  const res = await fetch("/api/financeiro/comissoes/gerar", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ dataCorte, vendedorIds: Array.from(vendedoresSelecionados) }),
                  })
                  const body = await res.json().catch(() => ({}))
                  if (!res.ok) throw new Error(body.error || "Erro ao gerar comissões")
                  toast({
                    title: "Comissões geradas",
                    description: `Criadas: ${body.data?.criadas ?? 0} • Pedidos: ${body.data?.pedidosProcessados ?? 0}`,
                  })
                  setGerarComissaoOpen(false)
                } catch (error: any) {
                  toast({
                    variant: "destructive",
                    title: "Erro ao gerar comissões",
                    description: error?.message ?? "Tente novamente",
                  })
                } finally {
                  setGerarComissaoLoading(false)
                }
              }}
              disabled={gerarComissaoLoading || vendedoresSelecionados.size === 0}
            >
              {gerarComissaoLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmRemessa} onOpenChange={(open) => !gerandoRemessa && setConfirmRemessa(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar remessa</DialogTitle>
            <DialogDescription>Selecione o banco e confirme para baixar o arquivo de remessa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={bancoSelecionado} onValueChange={setBancoSelecionado}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o banco" />
              </SelectTrigger>
              <SelectContent>
                {bancosAgrupados.map((banco) => (
                  <SelectItem key={banco.id} value={banco.id.toString()}>
                    {banco.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRemessa(false)} disabled={gerandoRemessa}>
              Cancelar
            </Button>
            <Button variant="secondary" onClick={handleGerarRemessa} disabled={gerandoRemessa}>
              <FileDown className="mr-2 h-4 w-4" />
              {gerandoRemessa ? "Gerando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de detalhes do cliente */}
      {
        clienteDetailId && (
          <ClienteDetailDialog
            clienteId={clienteDetailId}
            open={!!clienteDetailId}
            onClose={() => setClienteDetailId(null)}
          />
        )
      }
    </DashboardLayout >
  )
}
