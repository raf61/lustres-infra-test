"use client"

import type React from "react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, X } from "lucide-react"
import { useState } from "react"

interface CadastroProdutoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CadastroProdutoDialog({ open, onOpenChange }: CadastroProdutoDialogProps) {
  const [foto, setFoto] = useState<string | null>(null)

  const handleFotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setFoto(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Aqui seria a lógica de salvar o produto
    console.log("[v0] Produto cadastrado")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Produto</DialogTitle>
          <DialogDescription>Preencha os dados do produto para adicionar ao estoque</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Foto do Produto */}
          <div className="space-y-2">
            <Label>Foto do Produto</Label>
            <div className="flex items-center gap-4">
              {foto ? (
                <div className="relative">
                  <img
                    src={foto || "/placeholder.svg"}
                    alt="Preview"
                    className="h-24 w-24 rounded object-cover border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={() => setFoto(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded border-2 border-dashed border-border hover:border-primary transition-colors">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleFotoUpload} />
                </label>
              )}
              <p className="text-sm text-muted-foreground">Clique para fazer upload da foto do produto</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Produto *</Label>
              <Input id="nome" placeholder="Ex: Split Bolt" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="codigo">Código *</Label>
              <Input id="codigo" placeholder="Ex: SB-001" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="estoqueInicial">Estoque Inicial *</Label>
              <Input id="estoqueInicial" type="number" placeholder="Ex: 100" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estoqueMinimo">Estoque Mínimo (20%) *</Label>
              <Input id="estoqueMinimo" type="number" placeholder="Ex: 20" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fornecedor">Fornecedor *</Label>
            <Input id="fornecedor" placeholder="Ex: Fornecedor A" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="precoVenda">Preço de Venda *</Label>
              <Input id="precoVenda" type="number" step="0.01" placeholder="Ex: 25.00" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="precoCusto">Preço de Custo * (Visível apenas para Master)</Label>
              <Input id="precoCusto" type="number" step="0.01" placeholder="Ex: 15.00" required />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Cadastrar Produto</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
