"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import {
    Download,
    FileText,
    Loader2,
    Plus,
    Trash2,
    Upload,
    Pencil,
    Check,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { formatLocalDate, parseLocalDate } from "@/lib/formatters"
import { cn } from "@/lib/utils"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CreateContratoModal } from "./create-contrato-modal"
import { GenerateContratoModal } from "./generate-contrato-modal"
import { EditContratoModal } from "./edit-contrato-modal"

interface Contrato {
    id: number
    status: string
    dataInicio: string
    dataFim: string
    valorTotal: number
    parcelas?: number
    observacoes?: string
    arquivoUrl?: string | null
    createdAt: string
    cliente?: any
    vendedor?: any
}

interface ContratoManagerTabProps {
    clienteId: number
    onSuccess?: () => void
}

export function ContratoManagerTab({ clienteId, onSuccess }: ContratoManagerTabProps) {
    const { toast } = useToast()
    const [contratos, setContratos] = useState<Contrato[]>([])
    const [loading, setLoading] = useState(true)
    const [uploadingId, setUploadingId] = useState<number | null>(null)
    const [createModalOpen, setCreateModalOpen] = useState(false)
    const [generateModalOpen, setGenerateModalOpen] = useState(false)
    const [editModalOpen, setEditModalOpen] = useState(false)
    const [selectedContrato, setSelectedContrato] = useState<Contrato | null>(null)

    const loadContratos = async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/clientes/${clienteId}/contratos`)
            if (!res.ok) throw new Error("Erro ao carregar contratos")
            const data = await res.json()
            setContratos(data)
            return data
        } catch (error) {
            toast({ title: "Erro", description: "Falha ao carregar contratos", variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadContratos()
    }, [clienteId])

    const handleUpdateStatus = async (id: number, newStatus: string) => {
        if (!confirm(`Deseja alterar o status do contrato para ${newStatus}?`)) return
        try {
            const res = await fetch(`/api/clientes/${clienteId}/contratos/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus })
            })
            if (!res.ok) throw new Error("Erro ao atualizar status")
            toast({ title: "Sucesso", description: "Status atualizado" })
            loadContratos()
            onSuccess?.()
        } catch (error) {
            toast({ title: "Erro", description: "Falha ao atualizar contrato", variant: "destructive" })
        }
    }

    const handleUpload = async (id: number, file: File) => {
        setUploadingId(id)
        try {
            const formData = new FormData()
            formData.append("file", file)
            const res = await fetch(`/api/contratos/${id}/upload`, {
                method: "POST",
                body: formData
            })
            if (!res.ok) throw new Error("Erro no upload")
            toast({ title: "Sucesso", description: "Arquivo armazenado com sucesso" })
            loadContratos()
        } catch (error) {
            toast({ title: "Erro", description: "Falha no upload", variant: "destructive" })
        } finally {
            setUploadingId(null)
        }
    }

    const getStatusBadge = (c: Contrato) => {
        if (c.status === "CANCELADO") {
            return <Badge className="bg-red-100 text-red-700 border-red-200">Cancelado</Badge>
        }
        if (c.status === "PENDENTE") {
            return <Badge className="bg-slate-100 text-slate-700 border-slate-200">Pendente</Badge>
        }
        const now = new Date()
        const end = parseLocalDate(c.dataFim)

        if (now > end) return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Expirado</Badge>
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Vigente</Badge>
    }


    return (
        <div className="space-y-4 p-1">
            <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Histórico de Contratos</h3>
                <Button
                    onClick={() => setCreateModalOpen(true)}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-8"
                >
                    <Plus className="h-4 w-4 mr-1" /> Novo Contrato
                </Button>
            </div>

            <div className="border rounded-md overflow-hidden bg-white">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow className="h-10">
                            <TableHead className="text-[11px] font-bold uppercase text-slate-500 border-r w-16 text-center">ID</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase text-slate-500 border-r">Vigência</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase text-slate-500 border-r">Valor</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase text-slate-500 border-r">Status</TableHead>
                            <TableHead className="text-[11px] font-bold uppercase text-slate-500 text-center">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-300" />
                                </TableCell>
                            </TableRow>
                        ) : contratos.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10 text-slate-400 text-xs italic">
                                    Nenhum contrato registrado para este cliente.
                                </TableCell>
                            </TableRow>
                        ) : (
                            contratos.map((c) => (
                                <TableRow key={c.id} className="hover:bg-slate-50/50 group h-12">
                                    <TableCell className="text-xs font-mono text-center border-r">#{c.id}</TableCell>
                                    <TableCell className="text-xs border-r">
                                        <div className="font-medium">
                                            {formatLocalDate(c.dataInicio, "dd/MM/yy")} - {formatLocalDate(c.dataFim, "dd/MM/yy")}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-xs border-r font-semibold text-slate-600">
                                        {c.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                        {c.parcelas && <span className="text-[10px] text-slate-400 ml-1 font-normal">({c.parcelas}x)</span>}
                                    </TableCell>
                                    <TableCell className="text-xs border-r">
                                        {getStatusBadge(c)}
                                    </TableCell>
                                    <TableCell className="px-1">
                                        <div className="flex items-center justify-center gap-1">
                                            {c.status === "PENDENTE" && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
                                                    onClick={() => handleUpdateStatus(c.id, "OK")}
                                                    title="Aprovar Contrato"
                                                >
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                            )}

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-blue-600 hover:bg-blue-50"
                                                onClick={() => {
                                                    setSelectedContrato(c)
                                                    setGenerateModalOpen(true)
                                                }}
                                                title="Gerar/Personalizar Minuta DOCX"
                                            >
                                                <FileText className="h-4 w-4" />
                                            </Button>

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-slate-600 hover:bg-slate-100"
                                                onClick={() => {
                                                    setSelectedContrato(c)
                                                    setEditModalOpen(true)
                                                }}
                                                title="Editar Datas/Valores"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>

                                            {c.arquivoUrl && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
                                                    onClick={() => window.open(c.arquivoUrl!, "_blank")}
                                                    title="Ver Contrato Assinado"
                                                >
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                            )}

                                            <div className="relative">
                                                <input
                                                    type="file"
                                                    id={`upload-${c.id}`}
                                                    className="hidden"
                                                    onChange={(e) => e.target.files?.[0] && handleUpload(c.id, e.target.files[0])}
                                                    accept=".pdf,.doc,.docx"
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={cn(
                                                        "h-7 w-7",
                                                        c.arquivoUrl ? "text-slate-400 hover:text-blue-600" : "text-amber-600 hover:bg-amber-50"
                                                    )}
                                                    disabled={uploadingId === c.id}
                                                    onClick={() => document.getElementById(`upload-${c.id}`)?.click()}
                                                    title={c.arquivoUrl ? "Substituir Arquivo" : "Upload Contrato Assinado"}
                                                >
                                                    {uploadingId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-4 w-4" />}
                                                </Button>
                                            </div>

                                            {(c.status === "OK" || c.status === "PENDENTE") && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => handleUpdateStatus(c.id, "CANCELADO")}
                                                    title="Cancelar Contrato"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <CreateContratoModal
                open={createModalOpen}
                onOpenChange={setCreateModalOpen}
                clienteId={clienteId}
                onSuccess={(id) => {
                    loadContratos().then((data) => {
                        const created = data?.find((c: any) => c.id === id);
                        if (created) {
                            setSelectedContrato(created);
                            setGenerateModalOpen(true);
                        }
                    })
                    onSuccess?.()
                }}
            />

            <GenerateContratoModal
                open={generateModalOpen}
                onOpenChange={setGenerateModalOpen}
                contrato={selectedContrato}
            />

            <EditContratoModal
                open={editModalOpen}
                onOpenChange={setEditModalOpen}
                clienteId={clienteId}
                contrato={selectedContrato}
                onSuccess={() => {
                    loadContratos()
                    onSuccess?.()
                }}
            />
        </div>
    )
}
