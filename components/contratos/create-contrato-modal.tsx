"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface CreateContratoModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    clienteId: number
    onSuccess: (contratoId: number) => void
}

export function CreateContratoModal({ open, onOpenChange, clienteId, onSuccess }: CreateContratoModalProps) {
    const { toast } = useToast()
    const [creating, setCreating] = useState(false)

    // Form state
    const [dataInicio, setDataInicio] = useState("")
    const [dataFim, setDataFim] = useState("")
    const [valorTotal, setValorTotal] = useState("")
    const [parcelas, setParcelas] = useState("")
    const [observacoes, setObservacoes] = useState("")

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            setCreating(true)
            const res = await fetch(`/api/clientes/${clienteId}/contratos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    dataInicio,
                    dataFim,
                    valorTotal: parseFloat(valorTotal),
                    parcelas: parcelas ? parseInt(parcelas) : undefined,
                    observacoes,
                    status: "PENDENTE"
                })
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || "Erro ao criar contrato")
            }

            const data = await res.json()
            toast({ title: "Sucesso", description: "Contrato criado com sucesso" })

            // Reset form
            setDataInicio("")
            setDataFim("")
            setValorTotal("")
            setParcelas("")
            setObservacoes("")

            onSuccess(data.id)
            onOpenChange(false)
        } catch (error) {
            toast({
                title: "Erro",
                description: error instanceof Error ? error.message : "Erro desconhecido",
                variant: "destructive"
            })
        } finally {
            setCreating(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5 text-blue-600" />
                        Novo Contrato de Manutenção
                    </DialogTitle>
                    <DialogDescription>
                        Crie um novo contrato de manutenção para este cliente.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="create-dataInicio">Data Início</Label>
                            <Input
                                id="create-dataInicio"
                                type="date"
                                required
                                value={dataInicio}
                                onChange={e => setDataInicio(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="create-dataFim">Data Fim</Label>
                            <Input
                                id="create-dataFim"
                                type="date"
                                required
                                value={dataFim}
                                onChange={e => setDataFim(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="create-valorTotal">Valor Total</Label>
                            <Input
                                id="create-valorTotal"
                                type="number"
                                step="0.01"
                                required
                                placeholder="R$ 0,00"
                                value={valorTotal}
                                onChange={e => setValorTotal(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="create-parcelas">Parcelas</Label>
                            <Input
                                id="create-parcelas"
                                type="number"
                                placeholder="Ex: 12"
                                value={parcelas}
                                onChange={e => setParcelas(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="create-observacoes">Observações</Label>
                        <Textarea
                            id="create-observacoes"
                            rows={3}
                            value={observacoes}
                            onChange={e => setObservacoes(e.target.value)}
                            placeholder="Informações adicionais do contrato..."
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={creating}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={creating} className="bg-blue-600 hover:bg-blue-700">
                            {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Criar Contrato
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
