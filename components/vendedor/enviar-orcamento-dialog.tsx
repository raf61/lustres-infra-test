"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

interface EnviarOrcamentoDialogProps {
  cliente: string
  trigger: React.ReactNode
}

export function EnviarOrcamentoDialog({ cliente, trigger }: EnviarOrcamentoDialogProps) {
  const [open, setOpen] = useState(false)
  const [tipoServico, setTipoServico] = useState("")
  const [valor, setValor] = useState("")
  const [observacoes, setObservacoes] = useState("")
  const [enviarWhatsApp, setEnviarWhatsApp] = useState(true)
  const [enviarEmail, setEnviarEmail] = useState(true)

  const handleEnviar = () => {
    console.log("[v0] Enviando orçamento:", {
      cliente,
      tipoServico,
      valor,
      observacoes,
      canais: { whatsApp: enviarWhatsApp, email: enviarEmail },
    })
    setOpen(false)
    // Reset form
    setTipoServico("")
    setValor("")
    setObservacoes("")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Orçamento</DialogTitle>
          <DialogDescription>Crie e envie um orçamento para {cliente}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="tipo-servico">Tipo de Serviço</Label>
            <Select value={tipoServico} onValueChange={setTipoServico}>
              <SelectTrigger id="tipo-servico">
                <SelectValue placeholder="Selecione o serviço" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manutencao">Manutenção Preventiva</SelectItem>
                <SelectItem value="instalacao">Instalação Nova</SelectItem>
                <SelectItem value="reparo">Reparo/Correção</SelectItem>
                <SelectItem value="laudo">Laudo Técnico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="valor">Valor (R$)</Label>
            <Input
              id="valor"
              type="number"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              placeholder="Detalhes do serviço, prazo de execução..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-3">
            <Label>Enviar via:</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="whatsapp"
                checked={enviarWhatsApp}
                onCheckedChange={(checked) => setEnviarWhatsApp(checked as boolean)}
              />
              <label
                htmlFor="whatsapp"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                WhatsApp
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="email"
                checked={enviarEmail}
                onCheckedChange={(checked) => setEnviarEmail(checked as boolean)}
              />
              <label
                htmlFor="email"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Email
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleEnviar} disabled={!tipoServico || !valor || (!enviarWhatsApp && !enviarEmail)}>
            Enviar Orçamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
