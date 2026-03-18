
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Loader2, RefreshCw, FileText, FileCode, Trash2, Download } from "lucide-react"
import { NfeStatus } from "@prisma/client"
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
import { cn } from "@/lib/utils"

interface NfeActionsProps {
    nfeId: string
    status: NfeStatus
    onSuccess?: () => void
    showSync?: boolean
    showDownload?: boolean
    showCancel?: boolean
    className?: string
    variant?: "default" | "ghost" | "outline"
    size?: "default" | "sm" | "icon"
}

export function NfeActions({
    nfeId,
    status,
    onSuccess,
    showSync = true,
    showDownload = true,
    showCancel = true,
    className,
    variant = "outline",
    size = "sm"
}: NfeActionsProps) {
    const [loading, setLoading] = useState<string | null>(null)
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
    const { toast } = useToast()

    const handleSync = async () => {
        setLoading("sync")
        try {
            const res = await fetch(`/api/nfe/${nfeId}/sync`, { method: "POST" })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || "Erro ao sincronizar")

            toast({
                title: "Sincronizado",
                description: "Os dados da nota foram atualizados com a prefeitura.",
            })
            onSuccess?.()
        } catch (err: any) {
            toast({
                title: "Erro no Sync",
                description: err.message,
                variant: "destructive",
            })
        } finally {
            setLoading(null)
        }
    }

    const handleDownload = async (type: "pdf" | "xml") => {
        setLoading(type)
        try {
            const endpoint = type === "pdf" ? "download" : "xml"
            const res = await fetch(`/api/nfe/${nfeId}/${endpoint}`)

            if (!res.ok) {
                const json = await res.json().catch(() => ({ error: `Erro ao baixar ${type.toUpperCase()}` }))
                throw new Error(json.error)
            }

            // Verifica se retornou JSON com URL (padrão pedido-details)
            const contentType = res.headers.get("content-type")
            if (contentType && contentType.includes("application/json")) {
                const payload = await res.json()
                if (payload.url) {
                    window.open(payload.url, "_blank", "noopener,noreferrer")
                    return
                }
                // Se tiver conteúdo em texto no JSON (fallback)
                if (payload.content) {
                    const blob = new Blob([payload.content], { type: type === 'xml' ? 'application/xml' : 'application/pdf' })
                    const url = window.URL.createObjectURL(blob)
                    const a = document.createElement("a")
                    a.href = url
                    a.download = `nfe-${nfeId}.${type}`
                    document.body.appendChild(a)
                    a.click()
                    window.URL.revokeObjectURL(url)
                    document.body.removeChild(a)
                    return
                }
            }

            // Fallback para Blob (PDF ou XML direto)
            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `nfe-${nfeId}.${type}`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (err: any) {
            toast({
                title: `Erro ao baixar ${type.toUpperCase()}`,
                description: err.message,
                variant: "destructive",
            })
        } finally {
            setLoading(null)
        }
    }

    const handleCancel = async () => {
        setLoading("cancel")
        try {
            const res = await fetch(`/api/nfe/${nfeId}`, { method: "DELETE" })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || "Erro ao solicitar cancelamento")

            toast({
                title: "Cancelamento Solicitado",
                description: "A nota foi marcada para cancelamento. Sincronize em instantes para confirmar.",
            })
            onSuccess?.()
        } catch (err: any) {
            toast({
                title: "Erro no Cancelamento",
                description: err.message,
                variant: "destructive",
            })
        } finally {
            setLoading(null)
            setCancelDialogOpen(false)
        }
    }

    return (
        <div className={cn("flex items-center gap-2", className)}>
            {showSync && (
                <Button
                    variant={variant}
                    size={size}
                    onClick={handleSync}
                    disabled={!!loading}
                    title="Sincronizar com Prefeitura"
                >
                    {loading === "sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {size !== "icon" && <span className="ml-2">Sincronizar</span>}
                </Button>
            )}

            {showDownload && status === "AUTHORIZED" && (
                <>
                    <Button
                        variant={variant}
                        size={size}
                        onClick={() => handleDownload("pdf")}
                        disabled={!!loading}
                        title="Download PDF"
                        className="border-emerald-200 hover:bg-emerald-50 text-emerald-700"
                    >
                        {loading === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {size !== "icon" && <span className="ml-2">PDF</span>}
                    </Button>
                    <Button
                        variant={variant}
                        size={size}
                        onClick={() => handleDownload("xml")}
                        disabled={!!loading}
                        title="Download XML"
                        className="border-blue-200 hover:bg-blue-50 text-blue-700"
                    >
                        {loading === "xml" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCode className="h-4 w-4" />}
                        {size !== "icon" && <span className="ml-2">XML</span>}
                    </Button>
                </>
            )}

            {showCancel && status !== "CANCELLED" && status !== "CREATED" && (
                <>
                    <Button
                        variant="ghost"
                        size={size}
                        onClick={() => setCancelDialogOpen(true)}
                        disabled={!!loading}
                        title="Cancelar Nota"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                        {loading === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        {size !== "icon" && <span className="ml-2">Cancelar</span>}
                    </Button>

                    <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar cancelamento?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta ação solicitará o cancelamento da nota fiscal na prefeitura.
                                    Esta operação não pode ser desfeita após a confirmação do órgão emissor.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Voltar</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleCancel}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                >
                                    Confirmar Cancelamento
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </>
            )}
        </div>
    )
}
