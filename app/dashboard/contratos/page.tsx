"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    Search, Filter, Calendar, ExternalLink, AlertTriangle,
    CheckCircle2, XCircle, MapPin, TrendingUp, ChevronLeft, ChevronRight, Clock
} from "lucide-react"
import { format, differenceInMonths } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useToast } from "@/hooks/use-toast"
import { ClienteDetailDialog } from "@/components/leads/cliente-detail-dialog"
import { cn } from "@/lib/utils"
import { formatLocalDate, parseLocalDate } from "@/lib/formatters"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { estados_cidades } from "@/components/leads/leads-geral"
import { Skeleton } from "@/components/ui/skeleton"

const MESES = [
    { value: "01", label: "Janeiro" },
    { value: "02", label: "Fevereiro" },
    { value: "03", label: "Março" },
    { value: "04", label: "Abril" },
    { value: "05", label: "Maio" },
    { value: "06", label: "Junho" },
    { value: "07", label: "Julho" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
]

const PAGE_SIZE = 60

export default function ContratosPage() {
    const { toast } = useToast()
    const [viewMode, setViewMode] = useState<"calendar" | "all">("all")
    const [contratos, setContratos] = useState([])
    const [summary, setSummary] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [pagination, setPagination] = useState({ total: 0, totalPages: 1 })

    // Filtros
    const [search, setSearch] = useState("")
    const [cnpj, setCnpj] = useState("")
    const [statusFilter, setStatusFilter] = useState("vigente")
    const [selectedEstado, setSelectedEstado] = useState("all")
    const [selectedCidade, setSelectedCidade] = useState("all")
    const [selectedBairro, setSelectedBairro] = useState("")
    const [mesSelecionado, setMesSelecionado] = useState<string | null>(String(new Date().getMonth() + 1).padStart(2, "0"))
    const [anoSelecionado, setAnoSelecionado] = useState<number>(new Date().getFullYear())

    const [selectedClient, setSelectedClient] = useState<number | null>(null)
    const [showStateDistribution, setShowStateDistribution] = useState(false)

    const fetchContratos = useCallback(async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams({
                search,
                cnpj,
                status: statusFilter,
                estado: selectedEstado,
                cidade: selectedCidade,
                bairro: selectedBairro,
                page: String(page),
                pageSize: String(PAGE_SIZE)
            })

            if (viewMode === "calendar") {
                if (mesSelecionado) params.set("month", mesSelecionado);
                if (anoSelecionado) params.set("year", String(anoSelecionado));
            }

            const res = await fetch(`/api/contratos?${params.toString()}`)
            if (!res.ok) throw new Error("Falha ao buscar contratos")
            const response = await res.json()

            setContratos(response.data)
            setPagination(response.pagination)
            setSummary(response.summary)
        } catch (error) {
            toast({ title: "Erro", description: "Não foi possível carregar os contratos.", variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }, [search, cnpj, statusFilter, selectedEstado, selectedCidade, selectedBairro, page, viewMode, mesSelecionado, anoSelecionado, toast])

    useEffect(() => {
        const timer = setTimeout(fetchContratos, 300)
        return () => clearTimeout(timer)
    }, [fetchContratos])

    const getStatusInfo = (c: any) => {
        if (c.status === "CANCELADO") return { label: "CANCELADO", color: "bg-red-600", icon: XCircle }
        if (c.status === "PENDENTE") return { label: "PENDENTE", color: "bg-slate-500", icon: Clock }
        const now = new Date()
        const end = parseLocalDate(c.dataFim)
        if (now > end) return { label: "EXPIRADO", color: "bg-amber-500", icon: AlertTriangle }
        return { label: "VIGENTE", color: "bg-blue-600", icon: CheckCircle2 }
    }

    const anosDisponiveis = useMemo(() => {
        const currentYear = new Date().getFullYear()
        const anos: number[] = []
        for (let i = currentYear - 2; i <= currentYear + 3; i++) {
            anos.push(i)
        }
        return anos
    }, [])

    const handleMesChange = (mes: string) => {
        setMesSelecionado(mes === mesSelecionado ? null : mes)
        setPage(1)
    }

    const clearFilters = () => {
        setSearch("")
        setCnpj("")
        setStatusFilter("vigente")
        setSelectedEstado("all")
        setSelectedCidade("all")
        setSelectedBairro("")
        setPage(1)
    }

    // Lógica de Distribuição por Estado (similar ao componente original)
    const STATE_CONFIG: Record<string, string> = {
        SP: "bg-blue-500", RJ: "bg-blue-600", MG: "bg-blue-400", ES: "bg-sky-500",
        PR: "bg-emerald-500", SC: "bg-emerald-600", RS: "bg-green-600",
        BA: "bg-amber-500", PE: "bg-orange-500", CE: "bg-orange-600"
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                            <Calendar className="h-8 w-8 text-blue-600" />
                            Gestão de Contratos
                        </h1>
                        <p className="text-slate-500">Acompanhamento centralizado de contratos de manutenção.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={viewMode === "all" ? "default" : "outline"}
                            size="sm"
                            onClick={() => { setViewMode("all"); setStatusFilter("vigente"); setPage(1); }}
                        >
                            Ver Tudo
                        </Button>
                        <Button
                            variant={viewMode === "calendar" ? "default" : "outline"}
                            size="sm"
                            onClick={() => { setViewMode("calendar"); setStatusFilter("all"); setPage(1); }}
                        >
                            Calendário
                        </Button>
                        <Button
                            variant={showStateDistribution ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setShowStateDistribution(!showStateDistribution)}
                            className="gap-2"
                        >
                            <MapPin className="h-4 w-4" /> Distribuição
                        </Button>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-5">
                    <Card className="bg-slate-100 border-slate-200 shadow-sm">
                        <CardHeader className="py-3 px-4">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pendentes</p>
                            <CardTitle className="text-2xl text-slate-700">{summary?.pendentes ?? "--"}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card className="bg-blue-50 border-blue-100 shadow-sm">
                        <CardHeader className="py-3 px-4">
                            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Vigentes</p>
                            <CardTitle className="text-2xl text-blue-900">{summary?.vigentes ?? "--"}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card className="bg-amber-50 border-amber-200 shadow-sm">
                        <CardHeader className="py-3 px-4">
                            <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Expirados</p>
                            <CardTitle className="text-2xl text-amber-700">{summary?.expirados ?? "--"}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card className="bg-red-50 border-red-100 shadow-sm">
                        <CardHeader className="py-3 px-4">
                            <p className="text-xs font-bold text-red-700 uppercase tracking-wider">Cancelados</p>
                            <CardTitle className="text-2xl text-red-900">{summary?.cancelados ?? "--"}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader className="py-3 px-4">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total</p>
                            <CardTitle className="text-2xl text-slate-900">{summary?.total ?? "--"}</CardTitle>
                        </CardHeader>
                    </Card>
                </div>

                {showStateDistribution && summary?.byEstado && (
                    <Card className="border-border bg-card overflow-hidden transition-all">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <MapPin className="h-4 w-4" />
                                    Distribuição de Contratos Vigentes por Estado
                                </CardTitle>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <TrendingUp className="h-3.5 w-3.5" />
                                    <span className="font-semibold text-foreground">{summary.byEstado.length}</span>
                                    <span>estados</span>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-end justify-center gap-3 px-2 h-[140px]">
                                {summary.byEstado.map((item: any) => {
                                    const maxValue = Math.max(...summary.byEstado.map((d: any) => d.count))
                                    const barHeight = maxValue > 0 ? (item.count / maxValue) * 100 : 0
                                    const isSelected = selectedEstado === item.estado
                                    return (
                                        <div key={item.estado} className="w-12 group cursor-pointer" onClick={() => setSelectedEstado(item.estado)}>
                                            <div className="h-full flex flex-col justify-end items-center">
                                                <span className="text-[9px] font-semibold mb-0.5">{item.count}</span>
                                                <div
                                                    className={cn("w-full rounded-t-sm transition-all min-h-[15px] flex items-end justify-center pb-1",
                                                        STATE_CONFIG[item.estado] || "bg-slate-400",
                                                        isSelected && "ring-2 ring-blue-500 ring-offset-1"
                                                    )}
                                                    style={{ height: `${Math.max(barHeight, 15)}%` }}
                                                >
                                                    <span className="text-[10px] font-bold text-white">{item.estado}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {viewMode === "calendar" && (
                    <Card className="border-slate-200">
                        <CardHeader className="py-3 border-b flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-bold uppercase text-slate-500">Filtrar por Vencimento</CardTitle>
                            <Select value={String(anoSelecionado)} onValueChange={(v) => setAnoSelecionado(Number(v))}>
                                <SelectTrigger className="w-[120px] h-8 text-xs font-bold">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {anosDisponiveis.map(ano => (
                                        <SelectItem key={ano} value={String(ano)}>{ano}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </CardHeader>
                        <CardContent className="p-4">
                            <div className="grid grid-cols-6 lg:grid-cols-12 gap-2">
                                {MESES.map((mes) => (
                                    <Button
                                        key={mes.value}
                                        variant={mesSelecionado === mes.value ? "default" : "outline"}
                                        className={cn(
                                            "h-9 px-1 text-[10px] font-bold uppercase transition-all relative",
                                            mesSelecionado === mes.value ? "bg-blue-600 shadow-md" : "hover:bg-blue-50 border-slate-200"
                                        )}
                                        onClick={() => handleMesChange(mes.value)}
                                    >
                                        <div className="flex flex-col items-center">
                                            <span>{mes.label.substring(0, 3)}</span>
                                            {summary?.byMonth?.[mes.value] > 0 && (
                                                <span className={cn(
                                                    "text-[8px] mt-0.5 px-1 rounded-full",
                                                    mesSelecionado === mes.value ? "bg-white text-blue-600" : "bg-blue-100 text-blue-600"
                                                )}>
                                                    {summary.byMonth[mes.value]}
                                                </span>
                                            )}
                                        </div>
                                    </Button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card className="border-none shadow-xl bg-white/80 backdrop-blur-md overflow-hidden">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Cliente..."
                                    className="pl-9 h-9 text-xs"
                                    value={search}
                                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                />
                            </div>
                            <div className="relative">
                                <Input
                                    placeholder="CNPJ..."
                                    className="h-9 text-xs"
                                    value={cnpj}
                                    onChange={(e) => { setCnpj(e.target.value); setPage(1); }}
                                />
                            </div>
                            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                                <SelectTrigger className="h-9 text-xs">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os Status</SelectItem>
                                    <SelectItem value="pendente">Somente Pendentes</SelectItem>
                                    <SelectItem value="vigente">Somente Vigentes</SelectItem>
                                    <SelectItem value="expirado">Somente Expirados</SelectItem>
                                    <SelectItem value="cancelado">Cancelados</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="flex gap-2 lg:col-span-2">
                                <Select value={selectedEstado} onValueChange={(v) => { setSelectedEstado(v); setSelectedCidade("all"); setPage(1); }}>
                                    <SelectTrigger className="h-9 text-xs flex-1">
                                        <SelectValue placeholder="UF" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Brasil</SelectItem>
                                        {estados_cidades.estados.map(e => (
                                            <SelectItem key={e.sigla} value={e.sigla}>{e.sigla}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Input
                                    placeholder="Bairro..."
                                    className="h-9 text-xs flex-1"
                                    value={selectedBairro}
                                    onChange={(e) => { setSelectedBairro(e.target.value); setPage(1); }}
                                />
                                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-9">Limpar</Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow className="border-b border-slate-100">
                                        <TableHead className="text-[11px] font-bold uppercase text-slate-500 py-3">Cliente</TableHead>
                                        <TableHead className="text-[11px] font-bold uppercase text-slate-500">Vendedor</TableHead>
                                        <TableHead className="text-[11px] font-bold uppercase text-slate-500">Vigência</TableHead>
                                        <TableHead className="text-[11px] font-bold uppercase text-slate-500 text-center">Duração</TableHead>
                                        <TableHead className="text-[11px] font-bold uppercase text-slate-500 text-right">Valor</TableHead>
                                        <TableHead className="text-[11px] font-bold uppercase text-slate-500 text-center">Status</TableHead>
                                        <TableHead className="text-[11px] font-bold uppercase text-slate-500 text-center">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell colSpan={7} className="py-2"><Skeleton className="h-10 w-full" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : contratos.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-20 text-slate-400">Nenhum contrato encontrado.</TableCell>
                                        </TableRow>
                                    ) : (
                                        contratos.map((c: any) => {
                                            const statusInfo = getStatusInfo(c)
                                            const duration = differenceInMonths(parseLocalDate(c.dataFim), parseLocalDate(c.dataInicio))
                                            return (
                                                <TableRow key={c.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50">
                                                    <TableCell className="py-2">
                                                        <div className="flex flex-col">
                                                            <button
                                                                onClick={() => setSelectedClient(c.clienteId)}
                                                                className="font-bold text-slate-900 text-sm hover:text-blue-600 transition-colors text-left"
                                                            >
                                                                {c.cliente.razaoSocial}
                                                            </button>
                                                            <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                                                                <MapPin className="h-3 w-3" /> {c.cliente.bairro}, {c.cliente.cidade} - {c.cliente.estado}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs font-medium">{c.vendedor?.name || "—"}</TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col text-[11px]">
                                                            <span className="font-semibold">{formatLocalDate(c.dataInicio, "dd/MM/yyyy")}</span>
                                                            <span className="text-slate-400">até {formatLocalDate(c.dataFim, "dd/MM/yyyy")}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200">
                                                            {duration} Meses
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-bold text-slate-700">
                                                        {c.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge className={cn("text-[9px] h-5 font-black border-none px-2", statusInfo.color)}>
                                                            <statusInfo.icon className="h-3 w-3 mr-1" />
                                                            {statusInfo.label}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                                                            onClick={() => setSelectedClient(c.clienteId)}
                                                        >
                                                            <ExternalLink className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {pagination.totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/30">
                                <p className="text-xs text-slate-500">
                                    Total: <span className="font-bold">{pagination.total}</span> contratos
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="text-xs font-bold px-2">
                                        Página {page} de {pagination.totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                                        disabled={page === pagination.totalPages}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {selectedClient && (
                <ClienteDetailDialog
                    open
                    clienteId={selectedClient}
                    onClose={() => setSelectedClient(null)}
                />
            )}
        </DashboardLayout>
    )
}
