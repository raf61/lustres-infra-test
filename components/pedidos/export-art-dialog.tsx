"use client"

import { useState, useCallback, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FileDown, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
// import { toDateInputValue } from "@/lib/date-utils"

interface ExportARTDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function ExportARTDialog({ open, onOpenChange, onSuccess }: ExportARTDialogProps) {
  const [loading, setLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Lista de pedidos da API
  const [pedidos, setPedidos] = useState<{ id: number; cliente: string; cnpj: string; createdAt: string }[]>([])

  // Selection state
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ message: string; pedidosAtualizados: number } | null>(null)

  // Busca lista de pedidos pendentes
  const fetchPreview = useCallback(async () => {
    setPreviewLoading(true)
    setError(null)
    setPedidos([])
    setSelectedIds([])

    try {
      const res = await fetch(`/api/pedidos/export-art`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Erro ao buscar lista de pedidos")
      }

      setPedidos(data.pedidos || [])
      // Auto-selecionar todos por padrão? O usuário disse: "só so que eu escolher"
      // Vou deixar desmarcado ou marcar todos? UX melhor marcar todos e ele desmarcar o que não quer
      // Mas o texto diz: "só so que eu escolher (por mei ode um checkbox) é os que serão processados"
      // Vou deixar vazio para segurança ou selecionar tudo?
      // O padrão segura é selecionar tudo para ele ver o que tem.
      // Mas "só o que eu escolher" soa como opt-in. Vou deixar vazio?  
      // Se tiver mtos, vazio é chato. Vou selecionar todos.
      if (data.pedidos && Array.isArray(data.pedidos)) {
        setSelectedIds(data.pedidos.map((p: any) => p.id))
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar preview")
      setPedidos([])
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  // Quando abre a modal
  useEffect(() => {
    if (open) {
      setSuccess(null)
      setError(null)
      fetchPreview()
    }
  }, [open, fetchPreview])

  const toggleSelectAll = () => {
    if (selectedIds.length === pedidos.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(pedidos.map(p => p.id))
    }
  }

  const toggleSelection = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleExport = async () => {
    if (selectedIds.length === 0) {
      setError("Selecione pelo menos um pedido")
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch("/api/pedidos/export-art", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoIds: selectedIds }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Erro ao exportar")
      }

      if (data.pedidosAtualizados === 0) {
        setError("Nenhum pedido foi processado")
        return
      }

      // Sucesso - fazer download do CSV
      setSuccess({
        message: data.message,
        pedidosAtualizados: data.pedidosAtualizados,
      })

      // CSV Download removido conforme solicitado
      /*
      if (data.csvContent) {
        const blob = new Blob([data.csvContent], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `exportacao-art-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }
      */

      // Abrir relatório de renderização
      openRenderReport(selectedIds)

      // Recarrega a lista removendo os exportados
      fetchPreview()

      // Notifica o pai que houve sucesso
      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao exportar")
    } finally {
      setLoading(false)
    }
  }

  // Helper para abrir o relatório em nova aba via POST
  const openRenderReport = (ids: number[]) => {
    const form = document.createElement("form")
    form.method = "POST"
    form.action = "/api/pedidos/export-art/render"
    form.target = "_blank"

    const input = document.createElement("input")
    input.type = "hidden"
    input.name = "pedidoIds"
    input.value = JSON.stringify(ids)

    form.appendChild(input)
    document.body.appendChild(form)
    form.submit()
    document.body.removeChild(form)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg md:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-blue-600" />
            Exportar Dados para ART
          </DialogTitle>
          <DialogDescription>
            Selecione os pedidos para gerar o arquivo CSV de ART.
            Os pedidos selecionados serão marcados como exportados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">

          {/* Loading inicial */}
          {previewLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {!previewLoading && !success && (
            <>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {pedidos.length} pedidos pendentes
                </div>
                {pedidos.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
                    {selectedIds.length === pedidos.length ? "Desmarcar todos" : "Selecionar todos"}
                  </Button>
                )}
              </div>

              <div className="border rounded-md max-h-[300px] overflow-y-auto">
                {pedidos.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Nenhum pedido pendente para ART.
                  </div>
                ) : (
                  <div className="divide-y">
                    {pedidos.map((pedido) => (
                      <div key={pedido.id} className="flex items-center p-3 hover:bg-secondary">
                        <input
                          type="checkbox"
                          id={`pedido-${pedido.id}`}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                          checked={selectedIds.includes(pedido.id)}
                          onChange={() => toggleSelection(pedido.id)}
                        />
                        <label htmlFor={`pedido-${pedido.id}`} className="ml-3 flex-1 cursor-pointer">
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-900">
                              Pedido #{pedido.id}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(pedido.createdAt).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">
                            {pedido.cliente} - {pedido.cnpj}
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-sm text-muted-foreground text-right">
                {selectedIds.length} selecionado(s)
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success */}
          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {success.message}
              </AlertDescription>
            </Alert>
          )}

        </div>

        <DialogFooter className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {success ? "Concluir" : "Cancelar"}
          </Button>

          {!success && (
            <Button
              onClick={handleExport}
              disabled={loading || selectedIds.length === 0}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processando...
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4 mr-2" />
                  Exportar Selecionados
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

