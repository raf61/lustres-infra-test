"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Trash2, Edit2, Check, X, Plus } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
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

interface Categoria {
    id: number
    nome: string
}

interface GerenciarCategoriasDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    categorias: Categoria[]
    onUpdate: () => void // Callback para recarregar lista principal
}

export function GerenciarCategoriasDialog({
    open,
    onOpenChange,
    categorias,
    onUpdate,
}: GerenciarCategoriasDialogProps) {
    const { toast } = useToast()
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editingName, setEditingName] = useState("")
    const [loadingId, setLoadingId] = useState<number | null>(null)
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

    // Novo cadastro dentro do modal
    const [newCategoryName, setNewCategoryName] = useState("")
    const [creating, setCreating] = useState(false)

    const handleCreate = async () => {
        const nome = newCategoryName.trim()
        if (!nome) return

        setCreating(true)
        try {
            const res = await fetch("/api/financeiro/contas-pagar/categorias", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome }),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.error || "Erro ao criar categoria")
            }

            setNewCategoryName("")
            onUpdate()
            toast({ title: "Categoria criada", description: nome })
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Erro ao criar",
                description: error.message,
            })
        } finally {
            setCreating(false)
        }
    }

    const startEdit = (cat: Categoria) => {
        setEditingId(cat.id)
        setEditingName(cat.nome)
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditingName("")
    }

    const saveEdit = async (id: number) => {
        const nome = editingName.trim()
        if (!nome) return

        setLoadingId(id)
        try {
            const res = await fetch(`/api/financeiro/contas-pagar/categorias/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome }),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.error || "Erro ao atualizar categoria")
            }

            setEditingId(null)
            onUpdate()
            toast({ title: "Categoria atualizada" })
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Erro ao atualizar",
                description: error.message,
            })
        } finally {
            setLoadingId(null)
        }
    }

    const handleDelete = async () => {
        if (!deleteConfirmId) return

        setLoadingId(deleteConfirmId)
        try {
            const res = await fetch(`/api/financeiro/contas-pagar/categorias/${deleteConfirmId}`, {
                method: "DELETE",
            })

            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.error || "Erro ao excluir categoria")
            }

            onUpdate()
            toast({ title: "Categoria excluída" })
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Erro ao excluir",
                description: error.message,
            })
        } finally {
            setLoadingId(null)
            setDeleteConfirmId(null)
        }
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Gerenciar Categorias</DialogTitle>
                        <DialogDescription>
                            Crie, edite ou remova categorias de contas a pagar.
                            <br />
                            <span className="text-xs text-muted-foreground">Nota: Ao excluir, as contas ligadas ficarão "Sem categoria".</span>
                        </DialogDescription>
                    </DialogHeader>

                    {/* Form de criação rápida */}
                    <div className="flex gap-2 items-end mb-4 pt-2">
                        <div className="grid w-full gap-1.5">
                            <Label htmlFor="nova">Nova Categoria</Label>
                            <Input
                                id="nova"
                                placeholder="Ex: Material de Limpeza"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                            />
                        </div>
                        <Button onClick={handleCreate} disabled={creating || !newCategoryName.trim()}>
                            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        </Button>
                    </div>

                    <div className="flex-1 overflow-hidden border rounded-md">
                        <ScrollArea className="h-[300px] p-4">
                            {categorias.length === 0 ? (
                                <div className="text-center text-sm text-muted-foreground py-8">
                                    Nenhuma categoria cadastrada.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {categorias.map((cat) => (
                                        <div
                                            key={cat.id}
                                            className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 border border-transparent hover:border-border transition-colors group"
                                        >
                                            {editingId === cat.id ? (
                                                <div className="flex flex-1 items-center gap-2">
                                                    <Input
                                                        value={editingName}
                                                        onChange={(e) => setEditingName(e.target.value)}
                                                        className="h-8 text-sm"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") saveEdit(cat.id)
                                                            if (e.key === "Escape") cancelEdit()
                                                        }}
                                                    />
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                        onClick={() => saveEdit(cat.id)}
                                                        disabled={loadingId === cat.id}
                                                    >
                                                        {loadingId === cat.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-4 w-4" />}
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                        onClick={cancelEdit}
                                                        disabled={loadingId === cat.id}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <>
                                                    <span className="text-sm font-medium">{cat.nome}</span>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-muted-foreground hover:text-blue-600"
                                                            onClick={() => startEdit(cat)}
                                                        >
                                                            <Edit2 className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-muted-foreground hover:text-red-600"
                                                            onClick={() => setDeleteConfirmId(cat.id)}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </div>

                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Fechar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
                        <AlertDialogDescription>
                            As contas vinculadas a esta categoria não serão apagadas, mas ficarão "Sem categoria".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                            onClick={handleDelete}
                        >
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
