"use client"

import type React from "react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useEffect, useMemo, useState } from "react"
import { Building2 } from "lucide-react"

import { useToast } from "@/hooks/use-toast"

interface ConfiguracaoBancoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConfiguracaoBancoDialog({ open, onOpenChange }: ConfiguracaoBancoDialogProps) {
  const { toast } = useToast()
  const [bancos, setBancos] = useState<Array<{ id: number; nome: string; custoBoleto: number | null }>>([])
  const [selectedBancoId, setSelectedBancoId] = useState<string>("")
  const [custoBoletoInput, setCustoBoletoInput] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [initialCusto, setInitialCusto] = useState<number | null>(null)

  const selectedBanco = useMemo(
    () => bancos.find((b) => b.id.toString() === selectedBancoId) || null,
    [bancos, selectedBancoId],
  )

  const parsedInput = useMemo(() => {
    const trimmed = custoBoletoInput.trim()
    if (!trimmed) return null
    const num = Number(trimmed)
    return Number.isNaN(num) ? null : num
  }, [custoBoletoInput])

  const hasChanges =
    !!selectedBancoId &&
    ((parsedInput === null && initialCusto !== null) || (parsedInput !== null && parsedInput !== initialCusto))

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch("/api/bancos")
      .then((res) => res.json())
      .then((data) => {
        const list = (data?.data as Array<{ id: number; nome: string; custoBoleto: number | null }>) ?? []
        setBancos(list)
        if (list.length > 0) {
          const first = list[0]
          setSelectedBancoId(first.id.toString())
          setCustoBoletoInput(first.custoBoleto != null ? String(first.custoBoleto) : "")
          setInitialCusto(first.custoBoleto ?? null)
        } else {
          setSelectedBancoId("")
          setCustoBoletoInput("")
          setInitialCusto(null)
        }
      })
      .catch(() => {
        setBancos([])
        toast({ variant: "destructive", title: "Erro ao carregar bancos" })
      })
      .finally(() => setLoading(false))
  }, [open, toast])

  useEffect(() => {
    if (!selectedBanco) return
    setCustoBoletoInput(selectedBanco.custoBoleto != null ? String(selectedBanco.custoBoleto) : "")
    setInitialCusto(selectedBanco.custoBoleto ?? null)
  }, [selectedBanco])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBancoId) return
    if (!hasChanges) return

    setSaving(true)
    try {
      const res = await fetch(`/api/bancos/${selectedBancoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ custoBoleto: parsedInput }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Erro ao salvar custo do boleto.")

      setBancos((prev) =>
        prev.map((b) => (b.id.toString() === selectedBancoId ? { ...b, custoBoleto: parsedInput } : b)),
      )
      setInitialCusto(parsedInput)
      toast({ title: "Custos de boleto atualizados", description: selectedBanco?.nome })
      onOpenChange(false)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error?.message ?? "Erro ao salvar custo do boleto.",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Custos de boleto
          </DialogTitle>
          <DialogDescription>Defina o custo por boleto por banco</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="banco">Banco *</Label>
            <Select
              value={selectedBancoId}
              onValueChange={(value) => setSelectedBancoId(value)}
              disabled={loading || saving || bancos.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o banco" />
              </SelectTrigger>
              <SelectContent>
                {bancos.map((banco) => (
                  <SelectItem key={banco.id} value={banco.id.toString()}>
                    {banco.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custoBoleto">Preço por boleto (R$)</Label>
            <Input
              id="custoBoleto"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={custoBoletoInput}
              onChange={(e) => setCustoBoletoInput(e.target.value)}
              disabled={loading || saving || !selectedBancoId}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!hasChanges || loading || saving || !selectedBancoId}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
