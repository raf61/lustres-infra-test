"use client"

import type React from "react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useEffect, useMemo, useState } from "react"
import { Calendar, Loader2 } from "lucide-react"
import { toDateTimeInputValue } from "@/lib/date-utils"

interface BaixarContaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conta: {
    id: number | string
    descricao: string | null
    categoriaNome: string | null
    valor: number
    vencimento: string
  } | null
  onConfirm: (payload: { pagoEm: string }) => Promise<void>
}

const toDateTimeLocal = (date: Date) => toDateTimeInputValue(date)

export function BaixarContaDialog({ open, onOpenChange, conta, onConfirm }: BaixarContaDialogProps) {
  const defaultPagoEm = useMemo(() => toDateTimeLocal(new Date()), [])
  const [pagoEm, setPagoEm] = useState(defaultPagoEm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (conta) {
      setPagoEm(defaultPagoEm)
    }
  }, [conta, defaultPagoEm])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onConfirm({ pagoEm })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  if (!conta) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Baixar Conta a Pagar</DialogTitle>
          <DialogDescription>Registre o pagamento desta despesa</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Descrição:</span>
              <span className="text-sm font-medium">{conta.descricao}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Categoria:</span>
              <span className="text-sm font-medium">{conta.categoriaNome ?? "Sem categoria"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Valor:</span>
              <span className="text-sm font-medium">
                R$ {conta.valor?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Vencimento:</span>
              <span className="text-sm font-medium">{new Date(conta.vencimento).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dataPagamento">Data/Hora do Pagamento *</Label>
              <div className="relative">
                <Input
                  id="dataPagamento"
                  type="datetime-local"
                  value={pagoEm}
                  onChange={(e) => setPagoEm(e.target.value)}
                  required
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar Pagamento"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
