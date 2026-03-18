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
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"

interface AgendarRetornoDialogProps {
  cliente: string
  trigger: React.ReactNode
}

const formatarData = (date: Date) => {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

export function AgendarRetornoDialog({ cliente, trigger }: AgendarRetornoDialogProps) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<Date>()
  const [horario, setHorario] = useState("")
  const [observacoes, setObservacoes] = useState("")

  const handleAgendar = () => {
    console.log("[v0] Agendando retorno:", { cliente, data, horario, observacoes })
    setOpen(false)
    // Reset form
    setData(undefined)
    setHorario("")
    setObservacoes("")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar Retorno</DialogTitle>
          <DialogDescription>Agende um horário para retornar o contato com {cliente}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Data do Retorno</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {data ? formatarData(data) : <span>Selecione uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={data} onSelect={setData} disabled={(date) => date < new Date()} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="horario">Horário</Label>
            <Input id="horario" type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              placeholder="Motivo do retorno, assunto a tratar..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleAgendar} disabled={!data || !horario}>
            Agendar Retorno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
