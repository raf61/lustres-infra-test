"use client"

import { useEffect, useState } from "react"
import { Users, Loader2 } from "lucide-react"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

interface TrocarVendedorDialogProps {
    open: boolean
    onClose: () => void
    onSuccess?: () => void
    pedidoId: number
    currentVendedorId?: string | null
    currentVendedorName?: string | null
}

export function TrocarVendedorDialog({
    open,
    onClose,
    onSuccess,
    pedidoId,
    currentVendedorId,
    currentVendedorName
}: TrocarVendedorDialogProps) {
    const { toast } = useToast()
    const [vendedores, setVendedores] = useState<{ id: string; name: string }[]>([])
    const [selectedVendedor, setSelectedVendedor] = useState<string | null>(
        currentVendedorId ?? null
    )
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    // Carregar vendedores ao abrir
    useEffect(() => {
        if (open) {
            setLoading(true)
            // Reseta seleção para o atual (ou null)
            setSelectedVendedor(currentVendedorId ?? null)

            fetch("/api/vendedores")
                .then((res) => res.json())
                .then((json) => {
                    if (json.data && Array.isArray(json.data)) {
                        setVendedores(
                            json.data.map((u: any) => ({
                                id: u.id,
                                name: u.name ?? u.fullname ?? "Sem nome",
                            }))
                        )
                    }
                })
                .catch(console.error)
                .finally(() => setLoading(false))
        }
    }, [open, currentVendedorId])

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch(`/api/pedidos/${pedidoId}/assign`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ vendedorId: selectedVendedor }),
            })

            const json = await res.json()
            if (!res.ok) throw new Error(json.error || "Erro ao salvar")

            toast({ description: "Vendedor atualizado com sucesso." })
            onSuccess?.()
            onClose()
        } catch (error) {
            toast({
                title: "Erro",
                description: error instanceof Error ? error.message : "Erro desconhecido",
                variant: "destructive",
            })
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-600" />
                        Trocar Vendedor
                    </DialogTitle>
                    <DialogDescription>
                        Altere o vendedor responsável pelo pedido #{pedidoId}.
                        <br />
                        <span className="text-xs text-muted-foreground">
                            Atual: {currentVendedorName || "Sem vendedor"}
                        </span>
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label>Novo Vendedor</Label>
                        <Select
                            disabled={loading}
                            value={selectedVendedor ?? "none"}
                            onValueChange={(val) => setSelectedVendedor(val === "none" ? null : val)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={loading ? "Carregando..." : "Selecione..."} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">-- Sem vendedor --</SelectItem>
                                {vendedores.map((v) => (
                                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={saving}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={saving || loading}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar Alteração
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
