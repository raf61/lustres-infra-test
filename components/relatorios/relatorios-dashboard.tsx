"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ClienteDetailDialog } from "@/components/leads/cliente-detail-dialog"
import {
  BarChart3,
  TrendingUp,
  Users,
  Building2,
  UserCheck,
  UserX,
  RefreshCw,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  FileText,
  MapPin,
  Maximize2,
  Calendar,
} from "lucide-react"
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  Area,
  AreaChart,
} from "recharts"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"

// =============================================================================
// TYPES
// =============================================================================

type Summary = {
  revenue: number
  orderCount: number
  avgOrderValue: number
  neverAttended: number
  totalBudgets: number
}

type Cohorts = {
  new: number
  repeat: number
  lost: number
  active: number
}

type RelatorioData = {
  summary: Summary
  cohorts: Cohorts
  budgetsOnly: number
  timeline: { label: string; revenue: number; orders: number; budgets: number; churn: number }[]
  stateDistribution: { estado: string; revenue: number; orders: number; budgets: number; churn: number }[]
  sellerDistribution: { vendedorId: string; name: string; revenue: number; orders: number; budgets: number; churn: number }[]
  filters: {
    years: number[]
    states: string[]
    sellers: { id: string; name: string }[]
  }
}

// =============================================================================
// HELPERS
// =============================================================================

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const COLORS = {
  revenue: "hsl(var(--primary))",
  new: "hsl(221, 83%, 53%)",
  repeat: "hsl(142, 76%, 36%)",
  lost: "hsl(0, 72%, 51%)",
  states: "hsl(262, 83%, 58%)",
}

// =============================================================================
// COMPONENT
// =============================================================================

export function RelatoriosDashboard() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<RelatorioData | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Filters
  const [ano, setAno] = useState<string>(new Date().getFullYear().toString())
  const [periodicity, setPeriodicity] = useState<string>("ano")
  const [mes, setMes] = useState<string>("1")
  const [trimestre, setTrimestre] = useState<string>("1")
  const [estado, setEstado] = useState<string>("todos")
  const [vendedorId, setVendedorId] = useState<string>("todos")

  // Drill-down State
  const [drillDownType, setDrillDownType] = useState<string | null>(null)
  const [drillDownData, setDrillDownData] = useState<any[]>([])
  const [drillDownMonthCounts, setDrillDownMonthCounts] = useState<Record<number, number>>({})
  const [drillDownLoading, setDrillDownLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [drillDownMonth, setDrillDownMonth] = useState<number | null>(null)

  // Client Detail State
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const [clientDetailsOpen, setClientDetailsOpen] = useState(false)

  // Chart Metric Selector
  const [chartMetric, setChartMetric] = useState<"revenue" | "orders" | "budgets" | "churn">("revenue")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        ano,
        periodicity,
        estado,
        vendedorId,
      })
      if (periodicity === "mes") params.set("mes", mes)
      if (periodicity === "trimestre") params.set("trimestre", trimestre)

      const response = await fetch(`/api/relatorio?${params.toString()}`)
      const result = await response.json()
      setData(result)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [ano, periodicity, mes, trimestre, estado, vendedorId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const fetchDrillDown = useCallback(async (type: string, page: number = 1, targetMonth?: number | null) => {
    // Determine which month to apply
    // 1. If targetMonth is explicitly provided (null or number), use it (internal buttons)
    // 2. If targetMonth is undefined (from summary cards), fallback to global 'mes' if in monthly view
    let activeMonth: number | null;
    if (typeof targetMonth !== 'undefined') {
      activeMonth = targetMonth;
    } else {
      activeMonth = periodicity === "mes" ? parseInt(mes) : null;
    }

    setDrillDownType(type)
    setDrillDownLoading(true)
    setCurrentPage(page)
    setDrillDownMonth(activeMonth)

    try {
      const params = new URLSearchParams({
        type,
        ano,
        periodicity,
        estado,
        vendedorId,
        page: page.toString(),
        limit: "50"
      })
      if (periodicity === "mes") params.set("mes", mes)
      if (periodicity === "trimestre") params.set("trimestre", trimestre)
      if (activeMonth !== null) params.set("targetMonth", activeMonth.toString())

      const response = await fetch(`/api/relatorio/detalhes?${params.toString()}`)
      const result = await response.json()

      if (result.results) {
        setDrillDownData(result.results)
        setDrillDownMonthCounts(result.monthCounts || {})
        setTotalPages(result.pagination?.totalPages || 1)
      } else {
        setDrillDownData([])
        setDrillDownMonthCounts({})
        setTotalPages(1)
      }
    } catch (err) {
      console.error(err)
      setDrillDownData([])
      setTotalPages(1)
    } finally {
      setDrillDownLoading(false)
    }
  }, [ano, periodicity, mes, trimestre, estado, vendedorId, drillDownMonth])

  const openClientDetails = (id: number) => {
    setSelectedClientId(id)
    setClientDetailsOpen(true)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="h-8 w-8 text-primary" />
              Relatórios Executivos
            </h1>
            <p className="text-muted-foreground">Dashboards estratégicos de vendas e clientes</p>
          </div>
          <Button onClick={fetchData} variant="outline" size="icon">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Filters Bar */}
        <Card className="border-none shadow-sm bg-card/50">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Ano</label>
                <Select value={ano} onValueChange={setAno}>
                  <SelectTrigger className="bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {data?.filters.years.map(y => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Período</label>
                <Select value={periodicity} onValueChange={setPeriodicity}>
                  <SelectTrigger className="bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ano">Ano Completo</SelectItem>
                    <SelectItem value="trimestre">Trimestre</SelectItem>
                    <SelectItem value="mes">Mês</SelectItem>
                    <SelectItem value="todos">Histórico Total</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {periodicity === "mes" && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Mês</label>
                  <Select value={mes} onValueChange={setMes}>
                    <SelectTrigger className="bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }).map((_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2000, i, 1))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {periodicity === "trimestre" && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Trimestre</label>
                  <Select value={trimestre} onValueChange={setTrimestre}>
                    <SelectTrigger className="bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1º Trimestre (Jan-Mar)</SelectItem>
                      <SelectItem value="2">2º Trimestre (Abr-Jun)</SelectItem>
                      <SelectItem value="3">3º Trimestre (Jul-Set)</SelectItem>
                      <SelectItem value="4">4º Trimestre (Out-Dez)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Estado</label>
                <Select value={estado} onValueChange={setEstado}>
                  <SelectTrigger className="bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Estados</SelectItem>
                    {data?.filters.states.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Vendedor</label>
                <Select value={vendedorId} onValueChange={setVendedorId}>
                  <SelectTrigger className="bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Vendedores</SelectItem>
                    {data?.filters.sellers.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metric Selector for Chart */}
        <div className="flex items-center gap-2 p-1 bg-muted/50 rounded-lg w-fit">
          <Button
            variant={chartMetric === 'revenue' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setChartMetric('revenue')}
            className="text-xs h-8"
          >
            Faturamento
          </Button>
          <Button
            variant={chartMetric === 'orders' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setChartMetric('orders')}
            className="text-xs h-8"
          >
            Pedidos
          </Button>
          <Button
            variant={chartMetric === 'budgets' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setChartMetric('budgets')}
            className="text-xs h-8"
          >
            Orçamentos
          </Button>
          <Button
            variant={chartMetric === 'churn' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setChartMetric('churn')}
            className="text-xs h-8"
            disabled={periodicity !== 'ano'}
            title={periodicity !== 'ano' ? "Churn só disponível em visão anual" : ""}
          >
            Churn
          </Button>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="overflow-hidden bg-gradient-to-br from-white to-slate-50 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase flex items-center justify-between">
                Faturamento
                <DollarSign className="h-4 w-4 text-primary" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-8 w-24" /> : (
                <div className="space-y-1">
                  <div className="text-2xl font-bold">{formatCurrency(data?.summary.revenue || 0)}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    Média de {formatCurrency(data?.summary.avgOrderValue || 0)} p/ pedido
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => fetchDrillDown("orders")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase flex items-center justify-between">
                Pedidos Pagos
                <FileText className="h-4 w-4 text-blue-500" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-8 w-12" /> : (
                <div className="flex items-end justify-between">
                  <div className="text-2xl font-bold">{data?.summary.orderCount}</div>
                  <div className="text-xs text-primary flex items-center gap-1">Ver quais <Maximize2 className="h-3 w-3" /></div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => fetchDrillDown("budgets_all")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase flex items-center justify-between">
                Total Orçamentos
                <FileText className="h-4 w-4 text-indigo-500" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-8 w-12" /> : (
                <div className="flex items-end justify-between">
                  <div className="text-2xl font-bold">{data?.summary.totalBudgets}</div>
                  <div className="text-xs text-primary flex items-center gap-1">Ver todos <Maximize2 className="h-3 w-3" /></div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => fetchDrillDown("budgets_no_sale")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase flex items-center justify-between">
                Orçamentos Perdidos
                <UserX className="h-4 w-4 text-amber-500" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-8 w-12" /> : (
                <div className="flex items-end justify-between">
                  <div className="text-2xl font-bold text-amber-600 font-mono">{data?.budgetsOnly}</div>
                  <div className="text-xs text-primary flex items-center gap-1">Ver quais <Maximize2 className="h-3 w-3" /></div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground/60 uppercase">Clientes Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-8 w-12 bg-slate-800" /> : (
                <div className="text-2xl font-bold">{data?.cohorts.active}</div>
              )}
              <div className="text-xs text-muted-foreground mt-1">Interagiram no período</div>
            </CardContent>
          </Card>

          <Card className="border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50 transition-all cursor-pointer group" onClick={() => window.location.href = '/dashboard/relatorios/ia'}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-indigo-600 uppercase flex items-center justify-between">
                Agente I.A.
                <RefreshCw className="h-4 w-4 text-indigo-500 group-hover:rotate-180 transition-transform duration-500" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-700 font-mono">Ver Painel</div>
              <div className="text-[10px] text-indigo-500 mt-1 font-medium uppercase tracking-lighter flex items-center gap-1">
                Automação & Conversão <ArrowUpRight className="h-3 w-3" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Timeline Chart */}
          <Card className="shadow-none min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Série Temporal: {chartMetric === 'revenue' ? 'Faturamento' : chartMetric === 'orders' ? 'Pedidos' : chartMetric === 'budgets' ? 'Orçamentos' : 'Churn'}
              </CardTitle>
              <CardDescription>Evolução baseada no período selecionado</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full min-w-0">
                {isMounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    {chartMetric === 'revenue' ? (
                      <AreaChart data={data?.timeline || []}>
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="label" fontSize={11} axisLine={false} tickLine={false} />
                        <YAxis fontSize={11} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v / 1000}k`} />
                        <Tooltip
                          formatter={(v) => formatCurrency(v as number)}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                      </AreaChart>
                    ) : (
                      <BarChart data={data?.timeline || []}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="label" fontSize={11} axisLine={false} tickLine={false} />
                        <YAxis fontSize={11} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }}
                          cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                        />
                        <Bar
                          dataKey={chartMetric}
                          fill={chartMetric === 'churn' ? '#ef4444' : chartMetric === 'orders' ? '#3b82f6' : '#6366f1'}
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
          {/* State Distribution */}
          <Card className="shadow-none min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-purple-600" />
                Presença por Estado
              </CardTitle>
              <CardDescription>Distribuição de {chartMetric} por UF</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full min-w-0">
                {isMounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.stateDistribution || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                      <XAxis
                        type="number"
                        fontSize={11}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => chartMetric === 'revenue' ? `R$${v / 1000}k` : v}
                      />
                      <YAxis dataKey="estado" type="category" fontSize={11} axisLine={false} tickLine={false} width={40} />
                      <Tooltip
                        formatter={(v) => chartMetric === 'revenue' ? formatCurrency(v as number) : v}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '11px' }}
                      />
                      <Bar
                        dataKey={chartMetric}
                        fill="#8B5CF6"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Second Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Salesperson Comparison Chart */}
          <Card className="shadow-none min-w-0">
            <CardHeader tabIndex={0}>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Comparativo de Vendedores
              </CardTitle>
              <CardDescription>Desempenho relativo da equipe</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full min-w-0">
                {isMounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.sellerDistribution || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                      <XAxis
                        type="number"
                        fontSize={11}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => chartMetric === 'revenue' ? `R$${v / 1000}k` : v}
                      />
                      <YAxis dataKey="name" type="category" fontSize={11} axisLine={false} tickLine={false} width={100} />
                      <Tooltip
                        formatter={(v) => chartMetric === 'revenue' ? formatCurrency(v as number) : v}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '11px' }}
                      />
                      <Bar
                        dataKey={chartMetric}
                        fill="#3B82F6"
                        radius={[0, 4, 4, 0]}
                      >
                        {data?.sellerDistribution.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={vendedorId !== 'todos' && entry.vendedorId === vendedorId ? 'hsl(var(--primary))' : (chartMetric === 'revenue' ? '#3B82F6' : chartMetric === 'churn' ? '#ef4444' : '#10B981')}
                            fillOpacity={vendedorId !== 'todos' && entry.vendedorId !== vendedorId ? 0.4 : 1}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Budget Metric (placeholder for balance or just extra info) */}
          <Card className="shadow-none min-w-0 flex flex-col justify-center items-center text-center p-6 border-dashed border-2">
            <BarChart3 className="h-12 w-12 text-muted-foreground/20 mb-4" />
            <h3 className="font-semibold text-lg text-muted-foreground">Insights Estratégicos</h3>
            <p className="text-sm text-muted-foreground max-w-[250px]">
              Use os filtros acima para comparar o desempenho entre estados e vendedores em diferentes períodos.
            </p>
          </Card>
        </div>

        {/* Cohort Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              Saúde da Carteira (Cohorts)
            </CardTitle>
            <CardDescription>Comparativo de aquisição, retenção e churn no período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    Clientes Novos (Aquisição)
                  </div>
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer" onClick={() => fetchDrillDown("new")}>Ver {data?.cohorts.new}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    Fidelizados (Renovação)
                  </div>
                  <Badge variant="secondary" className="bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer" onClick={() => fetchDrillDown("repeat")}>Ver {data?.cohorts.repeat}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    Renovações Perdidas (Churn)
                  </div>
                  <Badge variant="secondary" className="bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer" onClick={() => fetchDrillDown("lost")}>Ver {data?.cohorts.lost}</Badge>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-dashed">
                  <div className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                    <div className="w-2 h-2 rounded-full bg-slate-400" />
                    Total Nunca Atendidos
                  </div>
                  <Badge variant="outline" className="text-muted-foreground font-mono">{data?.summary.neverAttended}</Badge>
                </div>
              </div>

              {/* Stacked Percentage Bar */}
              <div className="md:col-span-2 flex flex-col justify-center gap-4">
                <div className="h-10 w-full bg-secondary rounded-full flex overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${(data?.cohorts.new || 0) / ((data?.cohorts.new || 0) + (data?.cohorts.repeat || 0)) * 100}%` }}
                  />
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${(data?.cohorts.repeat || 0) / ((data?.cohorts.new || 0) + (data?.cohorts.repeat || 0)) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground italic px-2">
                  <span>Novos na carteira</span>
                  <span>Clientes fidelizados</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drill-down Dialog */}
      <Dialog open={!!drillDownType} onOpenChange={() => { setDrillDownType(null); setDrillDownMonth(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Maximize2 className="h-5 w-5" />
              Detalhamento de {drillDownType === 'lost' ? 'Renovações Perdidas (Churn)' :
                drillDownType === 'new' ? 'Clientes Novos (Aquisição)' :
                  drillDownType === 'repeat' ? 'Clientes Fidelizados (Renovação)' :
                    drillDownType === 'orders' ? 'Pedidos Concluídos' : 'Orçamentos sem Venda'}
            </DialogTitle>
            <DialogDescription>
              Filtre por mês para ver a distribuição sazonal. Paginação: 50 itens/pag.
            </DialogDescription>
          </DialogHeader>

          {/* Month Selector inside Drilldown */}
          <div className="flex flex-wrap gap-1 p-2 bg-secondary rounded-lg border my-2">
            <Button
              variant={drillDownMonth === null ? "default" : "outline"}
              size="sm"
              className="h-7 text-[10px] px-2"
              onClick={() => fetchDrillDown(drillDownType!, 1, null)}
            >
              TODOS
            </Button>
            {Array.from({ length: 12 }).map((_, i) => {
              const count = drillDownMonthCounts[i + 1] || 0;
              return (
                <Button
                  key={i}
                  variant={drillDownMonth === (i + 1) ? "default" : "outline"}
                  size="sm"
                  className="h-9 text-[10px] px-2 flex flex-col items-center justify-center min-w-[50px] gap-0"
                  onClick={() => fetchDrillDown(drillDownType!, 1, i + 1)}
                >
                  <span className="font-bold">{new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(2000, i, 1)).toUpperCase()}</span>
                  {count > 0 && (
                    <span className={`text-[9px] font-mono ${drillDownMonth === (i + 1) ? 'text-blue-100' : 'text-primary'}`}>
                      ({count})
                    </span>
                  )}
                </Button>
              )
            })}
          </div>

          <div className="flex-1 overflow-auto py-4">
            {drillDownLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {drillDownType === 'orders' ? (
                      <>
                        <TableHead>Data</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </>
                    ) : drillDownType?.includes('budgets') ? (
                      <>
                        <TableHead>Data</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Valor Estimado</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead>Razão Social</TableHead>
                        <TableHead>CNPJ</TableHead>
                        <TableHead>Local / UF</TableHead>
                        <TableHead>{drillDownType === 'lost' ? 'Mês Esperado' : 'Mês Evento'}</TableHead>
                        <TableHead>Última Manut.</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drillDownData.map((item, idx) => (
                    <TableRow key={idx}>
                      {drillDownType === 'orders' ? (
                        <>
                          <TableCell className="text-xs">{new Date(item.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell className="font-medium text-xs cursor-pointer hover:underline text-primary" onClick={() => openClientDetails(item.clienteId)}>
                            {item.cliente?.razaoSocial}
                          </TableCell>
                          <TableCell className="text-xs font-semibold">{formatCurrency(item.itens.reduce((acc: any, curr: any) => acc + (curr.valorUnitarioPraticado * curr.quantidade), 0))}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{item.status}</Badge></TableCell>
                        </>
                      ) : drillDownType?.includes('budgets') ? (
                        <>
                          <TableCell className="text-xs">{new Date(item.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell className="font-medium text-xs cursor-pointer hover:underline text-primary" onClick={() => openClientDetails(item.clienteId)}>
                            {item.cliente?.razaoSocial}
                          </TableCell>
                          <TableCell className="text-xs font-semibold">{formatCurrency(item.itens.reduce((acc: any, curr: any) => acc + (curr.valor * curr.quantidade), 0))}</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="font-medium text-xs cursor-pointer hover:underline text-primary" onClick={() => openClientDetails(item.id)}>
                            {item.razaoSocial}
                          </TableCell>
                          <TableCell className="text-[10px] text-muted-foreground font-mono">{item.cnpj}</TableCell>
                          <TableCell className="text-xs">{item.cidade || 'N/A'} - {item.estado}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">
                              {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2000, (item.expectedMonth || item.eventMonth || 1) - 1, 1))}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{item.ultimaManutencao ? new Date(item.ultimaManutencao).toLocaleDateString() : '-'}</TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                  {drillDownData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Nenhum registro encontrado</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="pt-4 border-t">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <Button variant="ghost" size="sm" onClick={() => fetchDrillDown(drillDownType!, currentPage - 1)} disabled={currentPage === 1}>
                    Anterior
                  </Button>
                </PaginationItem>
                <PaginationItem>
                  <span className="text-sm px-4">Página {currentPage} de {totalPages}</span>
                </PaginationItem>
                <PaginationItem>
                  <Button variant="ghost" size="sm" onClick={() => fetchDrillDown(drillDownType!, currentPage + 1)} disabled={currentPage === totalPages}>
                    Próximo
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      {
        typeof selectedClientId === 'number' && (
          <ClienteDetailDialog
            clienteId={selectedClientId}
            open={clientDetailsOpen}
            onClose={() => setClientDetailsOpen(false)}
          />
        )
      }
    </DashboardLayout >
  )
}
