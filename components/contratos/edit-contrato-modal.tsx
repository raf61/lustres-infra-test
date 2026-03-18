"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Pencil } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { formatLocalDate } from "@/lib/formatters"

interface EditContratoModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    clienteId: number
    contrato: any | null
    onSuccess: () => void
}

export function EditContratoModal({ open, onOpenChange, clienteId, contrato, onSuccess }: EditContratoModalProps) {
    const { toast } = useToast()
    const [updating, setUpdating] = useState(false)

    // Form state
    const [dataInicio, setDataInicio] = useState("")
    const [dataFim, setDataFim] = useState("")
    const [valorTotal, setValorTotal] = useState("")
    const [parcelas, setParcelas] = useState("")
    const [observacoes, setObservacoes] = useState("")

    useEffect(() => {
        if (contrato && open) {
            setDataInicio(contrato.dataInicio ? formatLocalDate(contrato.dataInicio, "yyyy-MM-dd") : "")
            setDataFim(contrato.dataFim ? formatLocalDate(contrato.dataFim, "yyyy-MM-dd") : "")
            setValorTotal(contrato.valorTotal?.toString() || "")
            setParcelas(contrato.parcelas?.toString() || "")
            setObservacoes(contrato.observacoes || "")
        }
    }, [contrato, open])

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!contrato) return
        try {
            setUpdating(true)
            const res = await fetch(`/api/clientes/${clienteId}/contratos/${contrato.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    dataInicio,
                    dataFim,
                    valorTotal: parseFloat(valorTotal),
                    parcelas: parcelas ? parseInt(parcelas) : undefined,
                    observacoes,
                })
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || "Erro ao atualizar contrato")
            }

            toast({ title: "Sucesso", description: "Contrato atualizado com sucesso" })
            onSuccess()
            onOpenChange(false)
        } catch (error) {
            toast({
                title: "Erro",
                description: error instanceof Error ? error.message : "Erro desconhecido",
                variant: "destructive"
            })
        } finally {
            setUpdating(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pencil className="h-5 w-5 text-blue-600" />
                        Editar Contrato #{contrato?.id}
                    </DialogTitle>
                    <DialogDescription>
                        Altere os dados básicos do contrato de manutenção.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleUpdate} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-dataInicio">Data Início</Label>
                            <Input
                                id="edit-dataInicio"
                                type="date"
                                required
                                value={dataInicio}
                                onChange={e => setDataInicio(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-dataFim">Data Fim</Label>
                            <Input
                                id="edit-dataFim"
                                type="date"
                                required
                                value={dataFim}
                                onChange={e => setDataFim(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-valorTotal">Valor Total</Label>
                            <Input
                                id="edit-valorTotal"
                                type="number"
                                step="0.01"
                                required
                                placeholder="R$ 0,00"
                                value={valorTotal}
                                onChange={e => setValorTotal(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-parcelas">Parcelas</Label>
                            <Input
                                id="edit-parcelas"
                                type="number"
                                placeholder="Ex: 12"
                                value={parcelas}
                                onChange={e => setParcelas(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-observacoes">Observações</Label>
                        <Textarea
                            id="edit-observacoes"
                            rows={3}
                            value={observacoes}
                            onChange={e => setObservacoes(e.target.value)}
                            placeholder="Informações adicionais do contrato..."
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={updating}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={updating} className="bg-blue-600 hover:bg-blue-700">
                            {updating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Salvar Alterações
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
