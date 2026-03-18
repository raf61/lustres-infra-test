"use client"

import type React from "react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowUpCircle, ArrowDownCircle } from "lucide-react"

interface MovimentacaoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  produto: any
}

export function MovimentacaoDialog({ open, onOpenChange, produto }: MovimentacaoDialogProps) {
  if (!produto) return null

  const isEntrada = produto.tipoMovimentacao === "entrada"

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)
    const quantidade = formData.get("quantidade")
    const observacao = formData.get("observacao")

    console.log("[v0] Movimentação registrada:", {
      produto: produto.nome,
      tipo: produto.tipoMovimentacao,
      quantidade,
      observacao,
    })

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEntrada ? (
              <>
                <ArrowUpCircle className="h-5 w-5 text-green-500" />
                Entrada de Estoque
              </>
            ) : (
              <>
                <ArrowDownCircle className="h-5 w-5 text-red-500" />
                Saída de Estoque
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isEntrada ? "Registrar compra/entrada de produtos" : "Registrar uso/saída de produtos"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              {produto.foto && (
                <img
                  src={produto.foto || "/placeholder.svg"}
                  alt={produto.nome}
                  className="h-12 w-12 rounded object-cover"
                />
              )}
              <div>
                <p className="font-medium">{produto.nome}</p>
                <p className="text-sm text-muted-foreground">Estoque atual: {produto.estoque}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantidade">Quantidade *</Label>
            <Input
              id="quantidade"
              name="quantidade"
              type="number"
              min="1"
              placeholder={isEntrada ? "Ex: 100 (comprou)" : "Ex: 80 (usou)"}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea
              id="observacao"
              name="observacao"
              placeholder={isEntrada ? "Ex: Compra do fornecedor A" : "Ex: Usado no serviço #123"}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className={isEntrada ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
            >
              {isEntrada ? "Registrar Entrada" : "Registrar Saída"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
