"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { CalendarIcon, CheckCircle2 } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface ReagendarVisitaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  visita: {
    id: number
    clienteRazaoSocial: string
    clienteCnpj: string
    dataMarcada: string
    tecnicoId?: string | null
  } | null
  tecnicos: Array<{ id: string; nome: string; disponibilidade: string }>
  onSubmit: (payload: { dataMarcada: Date; tecnicoId?: string }) => Promise<void>
}

export function ReagendarVisitaDialog({
  open,
  onOpenChange,
  visita,
  tecnicos,
  onSubmit,
}: ReagendarVisitaDialogProps) {
  const [novaData, setNovaData] = useState<Date>()
  const [novoTecnicoId, setNovoTecnicoId] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setNovaData(undefined)
      setNovoTecnicoId("")
      return
    }
    if (visita?.dataMarcada) {
      setNovaData(new Date(visita.dataMarcada))
    }
    if (visita?.tecnicoId) {
      setNovoTecnicoId(visita.tecnicoId)
    } else if (tecnicos.length > 0) {
      setNovoTecnicoId(tecnicos[0].id)
    }
  }, [open, visita, tecnicos])

  const handleSubmit = async () => {
    if (!visita || !novaData) return
    setSubmitting(true)
    try {
      await onSubmit({
        dataMarcada: novaData,
        tecnicoId: novoTecnicoId || undefined
      })
      onOpenChange(false)
      setNovaData(undefined)
      setNovoTecnicoId("")
    } catch (error) {
      console.error("[supervisao][ReagendarVisitaDialog][handleSubmit]", error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Reagendar visita técnica</DialogTitle>
          <DialogDescription>Selecione uma nova data para a visita</DialogDescription>
        </DialogHeader>

        {visita ? (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-muted p-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{visita.clienteRazaoSocial}</p>
                  <p className="text-muted-foreground text-xs">{visita.clienteCnpj}</p>
                </div>
                <Badge variant="outline" className="text-[11px]">
                  Visita #{visita.id}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Alterar técnico</Label>
              <Select value={novoTecnicoId} onValueChange={setNovoTecnicoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um técnico" />
                </SelectTrigger>
                <SelectContent>
                  {tecnicos.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex items-center gap-2">
                        {t.nome}
                        {t.disponibilidade === "disponivel" && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nova data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !novaData && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {novaData ? format(novaData, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={novaData} onSelect={setNovaData} initialFocus locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        ) : (
          <p className="py-6 text-sm text-destructive">Nenhuma visita selecionada.</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!visita || !novaData || submitting}>
            {submitting ? "Atualizando..." : "Confirmar nova data"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

