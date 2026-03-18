"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ShieldAlert, Trash2, CheckCircle, ShieldOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatCNPJ } from "@/lib/formatters"
import { Skeleton } from "@/components/ui/skeleton"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type UnusedCnpj = {
    id: number
    cnpj: string
    confirmed: boolean
    createdAt: string
    user?: {
        name: string | null
        email: string | null
    }
}

export default function UnusedClientsPage() {
    const { toast } = useToast()
    const [items, setItems] = useState<UnusedCnpj[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<number | null>(null)

    const fetchItems = async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/unused-clients")
            if (res.ok) {
                const json = await res.json()
                setItems(json.data ?? [])
            }
        } catch (error) {
            console.error(error)
            toast({ title: "Erro ao carregar lista", variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchItems()
    }, [])

    const handleAction = async (id: number, type: "CONFIRM_BLOCK" | "CANCEL_BLOCK") => {
        setActionLoading(id)
        try {
            const res = await fetch("/api/unused-clients/actions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, action: type }),
            })
            const json = await res.json()

            if (!res.ok) {
                throw new Error(json.error || "Erro na ação")
            }

            toast({
                title: type === "CONFIRM_BLOCK" ? "Bloqueio Confirmado" : "Cancelado com sucesso",
                description: json.message,
            })
            fetchItems()
        } catch (error) {
            toast({
                title: "Erro",
                description: error instanceof Error ? error.message : "Erro desconhecido",
                variant: "destructive",
            })
        } finally {
            setActionLoading(null)
        }
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <ShieldAlert className="h-10 w-10 text-red-600" />
                            Solicitações de Bloqueio (Unused Clients)
                        </h1>
                        <p className="text-lg text-muted-foreground">
                            Aprove ou rejeite solicitações de bloqueio definitivo de CNPJs.
                        </p>
                    </div>
                </div>

                <Card className="border-border bg-card">
                    <CardHeader>
                        <CardTitle> CNPJs Aguardando Bloqueio</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-6 space-y-2">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead>CNPJ</TableHead>
                                        <TableHead>Solicitado Por</TableHead>
                                        <TableHead>Data</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                                Nenhuma solicitação pendente.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        items.map((item) => (
                                            <TableRow key={item.id} className="border-b border-black/30 hover:bg-accent/5">
                                                <TableCell className="font-mono">{formatCNPJ(item.cnpj)}</TableCell>
                                                <TableCell>
                                                    {item.user?.name || "Desconhecido"}
                                                    <br />
                                                    <span className="text-xs text-muted-foreground">{item.user?.email}</span>
                                                </TableCell>
                                                <TableCell>{new Date(item.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button
                                                                    size="sm"
                                                                    variant="destructive"
                                                                    disabled={actionLoading === item.id}
                                                                >
                                                                    <ShieldOff className="mr-2 h-4 w-4" />
                                                                    Bloquear
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Bloquear CNPJ Definitivamente?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Esta ação irá:
                                                                        <ul className="list-disc ml-6 mt-2">
                                                                            <li>Apagar o registro do cliente atual (se existir).</li>
                                                                            <li>Impedir novas criações com este CNPJ.</li>
                                                                            <li>Marcar como "Unused" permanentemente.</li>
                                                                        </ul>
                                                                        <p className="mt-2 font-bold text-red-600">
                                                                            IMPORTANTE: O cliente não pode ter pedidos ativos para ser bloqueado.
                                                                        </p>
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        className="bg-red-600 hover:bg-red-700"
                                                                        onClick={() => handleAction(item.id, "CONFIRM_BLOCK")}
                                                                    >
                                                                        Confirmar Bloqueio
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>

                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleAction(item.id, "CANCEL_BLOCK")}
                                                            disabled={actionLoading === item.id}
                                                        >
                                                            <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                                                            Voltar ao normal
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
