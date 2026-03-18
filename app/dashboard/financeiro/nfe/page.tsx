
"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
    Search,
    Filter,
    Calendar as CalendarIcon,
    RefreshCw,
    Receipt,
    ChevronLeft,
    ChevronRight,
    Monitor,
    Building2,
    FileText,
    AlertCircle,
    Download
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { NfeStatusBadge } from "@/components/nfe/nfe-status-badge"
import { NfeActions } from "@/components/nfe/nfe-actions"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ESTADOS } from "@/lib/constants/estados"
import { ClienteDetailDialog } from "@/components/leads/cliente-detail-dialog"

export default function NfeDashboardPage() {
    return (
        <Suspense fallback={
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-screen bg-slate-50/50">
                    <div className="flex flex-col items-center gap-4">
                        <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
                        <p className="text-slate-500 font-medium">Carregando painel financeiro...</p>
                    </div>
                </div>
            </DashboardLayout>
        }>
            <NfeDashboardContent />
        </Suspense>
    )
}

function NfeDashboardContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const { toast } = useToast()

    // States
    const [data, setData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 })
    const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null)

    // Filters
    const [query, setQuery] = useState(searchParams.get("query") || "")
    const [status, setStatus] = useState(searchParams.get("status") || "all")
    const [uf, setUf] = useState(searchParams.get("uf") || "all")
    const [dateStart, setDateStart] = useState(searchParams.get("dateStart") || "")
    const [dateEnd, setDateEnd] = useState(searchParams.get("dateEnd") || "")

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (query) params.set("query", query)
            if (status !== "all") params.set("status", status)
            if (uf !== "all") params.set("uf", uf)
            if (dateStart) params.set("dateStart", dateStart)
            if (dateEnd) params.set("dateEnd", dateEnd)
            params.set("page", pagination.page.toString())
            params.set("limit", pagination.limit.toString())

            const res = await fetch(`/api/nfe?${params.toString()}`)
            const json = await res.json()

            if (!res.ok) throw new Error(json.error || "Erro ao carregar notas")

            setData(json.data)
            setPagination(json.pagination)
        } catch (err: any) {
            toast({
                title: "Erro",
                description: err.message,
                variant: "destructive"
            })
        } finally {
            setLoading(false)
        }
    }, [query, status, uf, dateStart, dateEnd, pagination.page, pagination.limit, toast])

    useEffect(() => {
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pagination.page])

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        if (pagination.page !== 1) {
            setPagination(prev => ({ ...prev, page: 1 }))
        } else {
            fetchData()
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount / 100)
    }

    return (
        <DashboardLayout>
            <div className="flex flex-col gap-6 p-6 min-h-screen bg-slate-50/50">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                            <Receipt className="h-8 w-8 text-blue-600" />
                            Notas Fiscais de Serviço
                        </h1>
                        <p className="text-slate-500 mt-1">Gerencie a emissão, consulta e cancelamento de NFS-e.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => fetchData()} disabled={loading} className="bg-white">
                            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                            Atualizar
                        </Button>
                    </div>
                </div>

                {/* Filters Card */}
                <Card className="border-slate-200 shadow-sm overflow-hidden bg-white/70 backdrop-blur-sm">
                    <CardContent className="p-6">
                        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            <div className="space-y-2 lg:col-span-2">
                                <label className="text-xs font-semibold uppercase text-slate-500 ml-1">Pesquisar</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="Nome do cliente, CNPJ ou número da nota..."
                                        className="pl-9 bg-white"
                                        value={query}
                                        onChange={e => setQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-slate-500 ml-1">Status</label>
                                <Select value={status} onValueChange={setStatus}>
                                    <SelectTrigger className="bg-white">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos</SelectItem>
                                        <SelectItem value="CREATED">Pendente</SelectItem>
                                        <SelectItem value="QUEUED">Aguardando Emissão</SelectItem>
                                        <SelectItem value="AUTHORIZED">Autorizada</SelectItem>
                                        <SelectItem value="ERROR">Erro</SelectItem>
                                        <SelectItem value="CANCELLED">Cancelada</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-slate-500 ml-1">Estado (UF)</label>
                                <Select value={uf} onValueChange={setUf}>
                                    <SelectTrigger className="bg-white">
                                        <SelectValue placeholder="UF" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Brasil (Todos)</SelectItem>
                                        {ESTADOS.map((estado) => (
                                            <SelectItem key={estado.sigla} value={estado.sigla}>
                                                {estado.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-end">
                                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                                    <Filter className="h-4 w-4 mr-2" />
                                    Filtrar
                                </Button>
                            </div>

                            <div className="space-y-2 lg:col-span-2">
                                <label className="text-xs font-semibold uppercase text-slate-500 ml-1">Período Início</label>
                                <div className="relative">
                                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                    <Input
                                        type="date"
                                        className="pl-9 bg-white"
                                        value={dateStart}
                                        onChange={e => setDateStart(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 lg:col-span-2">
                                <label className="text-xs font-semibold uppercase text-slate-500 ml-1">Período Fim</label>
                                <div className="relative">
                                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                    <Input
                                        type="date"
                                        className="pl-9 bg-white"
                                        value={dateEnd}
                                        onChange={e => setDateEnd(e.target.value)}
                                    />
                                </div>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* Table Card */}
                <Card className="border-slate-200 shadow-md overflow-hidden bg-white">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/50 border-b border-slate-200">
                                <TableRow>
                                    <TableHead className="w-[100px] text-xs font-bold uppercase text-slate-500">Número</TableHead>
                                    <TableHead className="text-xs font-bold uppercase text-slate-500">Tomador / Cliente</TableHead>
                                    <TableHead className="text-xs font-bold uppercase text-slate-500">Estado</TableHead>
                                    <TableHead className="text-xs font-bold uppercase text-slate-500">Emissão</TableHead>
                                    <TableHead className="text-xs font-bold uppercase text-slate-500">Valor</TableHead>
                                    <TableHead className="text-xs font-bold uppercase text-slate-500">Status</TableHead>
                                    <TableHead className="text-right text-xs font-bold uppercase text-slate-500">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i} className="animate-pulse">
                                            <TableCell colSpan={7} className="h-16 bg-slate-50/50"></TableCell>
                                        </TableRow>
                                    ))
                                ) : data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-3">
                                                <div className="p-4 bg-slate-100 rounded-full">
                                                    <FileText className="h-10 w-10 text-slate-400" />
                                                </div>
                                                <p className="text-slate-500 font-medium">Nenhuma nota fiscal encontrada.</p>
                                                <Button variant="link" onClick={() => {
                                                    setQuery("")
                                                    setStatus("all")
                                                    setUf("all")
                                                    setDateStart("")
                                                    setDateEnd("")
                                                    setPagination(p => ({ ...p, page: 1 }))
                                                }}>Limpar filtros</Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    data.map((nf) => (
                                        <TableRow key={nf.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <TableCell className="font-mono font-medium text-blue-600">
                                                {nf.number ? `#${nf.number}` : "-"}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <button
                                                        onClick={() => nf.pedido?.cliente?.id && setSelectedClienteId(String(nf.pedido.cliente.id))}
                                                        className="font-semibold text-slate-900 line-clamp-1 hover:text-blue-600 hover:underline transition-colors text-left"
                                                    >
                                                        {nf.borrowerName || "N/A"}
                                                    </button>
                                                    <span className="text-xs text-slate-500">{nf.borrowerCnpj || "-"}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200">
                                                    {nf.pedido?.cliente?.estado || nf.pedido?.orcamento?.filial?.uf || "-"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-slate-600 whitespace-nowrap">
                                                {nf.createdAt ? format(new Date(nf.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                                            </TableCell>
                                            <TableCell className="font-bold text-slate-900">
                                                {formatCurrency(nf.amountInCents)}
                                            </TableCell>
                                            <TableCell>
                                                <NfeStatusBadge status={nf.status} />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <NfeActions
                                                    nfeId={nf.id}
                                                    status={nf.status}
                                                    onSuccess={fetchData}
                                                    variant="ghost"
                                                    size="icon"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    <div className="p-4 bg-slate-50/50 border-t border-slate-200 flex items-center justify-between">
                        <p className="text-sm text-slate-500">
                            Mostrando <span className="font-medium text-slate-900">{data.length}</span> de <span className="font-medium text-slate-900">{pagination.total}</span> notas
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                                disabled={pagination.page <= 1}
                                className="bg-white"
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                            </Button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, pagination.pages) }).map((_, i) => {
                                    let pageNum = i + 1;
                                    // Lógica simples para focar na página atual se houver muitas páginas
                                    if (pagination.pages > 5 && pagination.page > 3) {
                                        pageNum = pagination.page - 3 + i;
                                    }
                                    if (pageNum > pagination.pages) return null;

                                    return (
                                        <Button
                                            key={pageNum}
                                            variant={pagination.page === pageNum ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setPagination(p => ({ ...p, page: pageNum }))}
                                            className={cn("w-8 h-8 p-0", pagination.page === pageNum ? "bg-blue-600" : "bg-white")}
                                        >
                                            {pageNum}
                                        </Button>
                                    )
                                })}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                                disabled={pagination.page >= pagination.pages}
                                className="bg-white"
                            >
                                Próximo <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                </Card>

                {/* Footer / Helper */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
                    <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 flex gap-3">
                        <Monitor className="h-6 w-6 text-blue-500 shrink-0" />
                        <div>
                            <h4 className="text-sm font-bold text-blue-900">Sincronização Ativa</h4>
                            <p className="text-xs text-blue-700 mt-1">O sistema consulta a prefeitura periodicamente para atualizar o status das notas emitidas.</p>
                        </div>
                    </div>
                    <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50 flex gap-3">
                        <Building2 className="h-6 w-6 text-emerald-500 shrink-0" />
                        <div>
                            <h4 className="text-sm font-bold text-emerald-900">Multi-Filial</h4>
                            <p className="text-xs text-emerald-700 mt-1">Notas emitidas por diferentes CNPJs (RJ, PE, etc) são centralizadas nesta visão.</p>
                        </div>
                    </div>
                    <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/50 flex gap-3">
                        <AlertCircle className="h-6 w-6 text-amber-500 shrink-0" />
                        <div>
                            <h4 className="text-sm font-bold text-amber-900">Suporte a Cancelamento</h4>
                            <p className="text-xs text-amber-700 mt-1">Cancelamentos feitos aqui são transmitidos diretamente para a prefeitura via API.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Dialog de Detalhes do Cliente */}
            {selectedClienteId && (
                <ClienteDetailDialog
                    clienteId={selectedClienteId}
                    open={!!selectedClienteId}
                    onClose={() => setSelectedClienteId(null)}
                    onClientUpdated={fetchData}
                />
            )}
        </DashboardLayout>
    )
}
