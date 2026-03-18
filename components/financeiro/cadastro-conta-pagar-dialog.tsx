"use client"

import type React from "react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useMemo, useState } from "react"
import { Calendar, Plus, Loader2 } from "lucide-react"
import { toDateInputValue } from "@/lib/date-utils"

interface CadastroContaPagarDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categorias: Array<{ id: number; nome: string }>
  onCreateCategoria: (nome: string) => Promise<void>
  onSubmit: (payload: { descricao?: string; categoriaId?: number | null; valor: number; vencimento: string } | Array<{ descricao?: string; categoriaId?: number | null; valor: number; vencimento: string }>) => Promise<void>
}

const getToday = () => toDateInputValue(new Date())

export function CadastroContaPagarDialog({
  open,
  onOpenChange,
  categorias,
  onCreateCategoria,
  onSubmit,
}: CadastroContaPagarDialogProps) {
  const [formData, setFormData] = useState({
    descricao: "",
    categoriaId: "none",
    valor: "",
    vencimento: getToday(),
  })
  const [novaCategoria, setNovaCategoria] = useState("")
  const [novaCategoriaVisivel, setNovaCategoriaVisivel] = useState(false)
  const [creatingCategoria, setCreatingCategoria] = useState(false)
  const [saving, setSaving] = useState(false)

  // Installment states
  const [parcelar, setParcelar] = useState(false)
  const [qtdeParcelas, setQtdeParcelas] = useState("2")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const valorNum = Number(formData.valor)
    if (!valorNum || Number.isNaN(valorNum) || valorNum <= 0) return
    if (!formData.vencimento) return

    setSaving(true)
    try {
      if (parcelar && Number(qtdeParcelas) > 1) {
        const qtde = Math.floor(Number(qtdeParcelas))
        const valorBase = Math.floor((valorNum / qtde) * 100) / 100
        const resto = Number((valorNum - (valorBase * qtde)).toFixed(2))
        const [anoStr, mesStr, diaStr] = formData.vencimento.split("-")
        const anoBase = Number(anoStr)
        const mesBase = Number(mesStr) - 1 // 0-indexed
        const diaBase = Number(diaStr)

        const payloads = []
        for (let i = 0; i < qtde; i++) {
          let valorParcela = valorBase
          if (i === 0) valorParcela = Number((valorParcela + resto).toFixed(2))

          // Calculate date
          const targetDateMonthIndex = mesBase + i
          const targetYear = anoBase + Math.floor(targetDateMonthIndex / 12)
          const targetMonth = targetDateMonthIndex % 12
          const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate()
          const targetDay = Math.min(diaBase, lastDayOfTargetMonth)
          const formattedDate = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`

          const suffix = ` - Parcela ${i + 1}/${qtde}`
          const descricaoBase = formData.descricao?.trim() || "Conta a Pagar"
          const descricao = descricaoBase + suffix

          payloads.push({
            descricao,
            categoriaId: formData.categoriaId && formData.categoriaId !== "none" ? Number(formData.categoriaId) : undefined,
            valor: valorParcela,
            vencimento: formattedDate,
          })
        }

        await onSubmit(payloads)
      } else {
        await onSubmit({
          descricao: formData.descricao || undefined,
          categoriaId: formData.categoriaId && formData.categoriaId !== "none" ? Number(formData.categoriaId) : undefined,
          valor: valorNum,
          vencimento: formData.vencimento,
        })
      }

      onOpenChange(false)
      setFormData({
        descricao: "",
        categoriaId: "none",
        valor: "",
        vencimento: getToday(),
      })
      setNovaCategoria("")
      setNovaCategoriaVisivel(false)
      setParcelar(false)
      setQtdeParcelas("2")
    } finally {
      setSaving(false)
    }
  }

  const handleCreateCategoria = async () => {
    const nome = novaCategoria.trim()
    if (!nome) return
    setCreatingCategoria(true)
    try {
      await onCreateCategoria(nome)
      setNovaCategoria("")
    } finally {
      setCreatingCategoria(false)
    }
  }

  const categoriasOptions = useMemo(() => categorias ?? [], [categorias])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Conta a Pagar</DialogTitle>
          <DialogDescription>Cadastre uma nova despesa no sistema</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="categoria">Categoria (opcional)</Label>
            <Select value={formData.categoriaId} onValueChange={(value) => setFormData({ ...formData, categoriaId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {categoriasOptions.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    {cat.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              type="button"
              className="text-xs text-primary underline underline-offset-4 hover:text-primary/80"
              onClick={() => setNovaCategoriaVisivel(true)}
            >
              Nova categoria
            </button>

            {novaCategoriaVisivel && (
              <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
                <Label className="text-xs">Criar nova categoria</Label>
                <div className="flex gap-2">
                  <Input placeholder="Nome da categoria" value={novaCategoria} onChange={(e) => setNovaCategoria(e.target.value)} />
                  <Button type="button" variant="outline" size="icon" onClick={handleCreateCategoria} disabled={creatingCategoria}>
                    {creatingCategoria ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição (opcional)</Label>
              <Input
                id="descricao"
                placeholder="Ex: Conta de Luz - Escritório"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor">Valor (R$) *</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vencimento">Data de Vencimento *</Label>
            <div className="relative">
              <Input
                id="vencimento"
                type="date"
                value={formData.vencimento}
                onChange={(e) => setFormData({ ...formData, vencimento: e.target.value })}
                required
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-4 border rounded-md p-3 bg-muted/20">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="parcelar"
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                checked={parcelar}
                onChange={(e) => setParcelar(e.target.checked)}
              />
              <Label htmlFor="parcelar" className="cursor-pointer">Parcelar?</Label>
            </div>

            {parcelar && (
              <div className="flex items-center gap-2">
                <Label htmlFor="qtdeParcelas" className="text-sm whitespace-nowrap">Nº de Parcelas:</Label>
                <Input
                  id="qtdeParcelas"
                  type="number"
                  min="2"
                  max="60"
                  className="w-20 h-8"
                  value={qtdeParcelas}
                  onChange={(e) => setQtdeParcelas(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">x</span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cadastrar Conta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
