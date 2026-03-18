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
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { CalendarIcon, CheckCircle2 } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface DistribuirServicoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pedido: {
    id: number
    clienteRazaoSocial: string
    clienteCnpj: string
    orcamentoId: number | null
  } | null
  tecnicos: Array<{ id: string; nome: string; disponibilidade: string }>
  onSubmit: (data: { tecnicoId: string; dataMarcada: Date; observacao?: string }) => Promise<void>
}

export function DistribuirServicoDialog({
  open,
  onOpenChange,
  pedido,
  tecnicos,
  onSubmit,
}: DistribuirServicoDialogProps) {
  const [tecnicoSelecionado, setTecnicoSelecionado] = useState("")
  const [dataAgendamento, setDataAgendamento] = useState<Date>()
  const [observacoes, setObservacoes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setTecnicoSelecionado("")
      setDataAgendamento(undefined)
      setObservacoes("")
      return
    }
    if (!tecnicoSelecionado && tecnicos.length > 0) {
      setTecnicoSelecionado(tecnicos[0].id)
    }
  }, [open, tecnicoSelecionado, tecnicos])

  const handleDistribuir = async () => {
    if (!pedido || !tecnicoSelecionado || !dataAgendamento) return
    setSubmitting(true)
    try {
      await onSubmit({
        tecnicoId: tecnicoSelecionado,
        dataMarcada: dataAgendamento,
        observacao: observacoes.trim() || undefined,
      })
      onOpenChange(false)
    } catch (error) {
      console.error("[supervisao][DistribuirServicoDialog][handleDistribuir]", error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Distribuir Serviço para Técnico</DialogTitle>
          <DialogDescription>Selecione o técnico e agende a data para execução do serviço</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {pedido ? (
            <div className="rounded-lg border border-muted p-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{pedido.clienteRazaoSocial}</p>
                  <p className="text-muted-foreground text-xs">{pedido.clienteCnpj}</p>
                </div>
                <Badge variant="outline" className="text-[11px]">
                  Pedido #{pedido.id} · Orçamento {pedido.orcamentoId ? `#${pedido.orcamentoId}` : "—"}
                </Badge>
              </div>
            </div>
          ) : (
            <p className="text-sm text-destructive">Selecione um pedido para distribuir.</p>
          )}

          <div className="space-y-2">
            <Label htmlFor="tecnico">Técnico Responsável</Label>
            <Select value={tecnicoSelecionado} onValueChange={setTecnicoSelecionado}>
              <SelectTrigger id="tecnico">
                <SelectValue placeholder="Selecione um técnico" />
              </SelectTrigger>
              <SelectContent>
                {tecnicos.map((tecnico) => (
                  <SelectItem key={tecnico.id} value={tecnico.id}>
                    <div className="flex items-center gap-2">
                      {tecnico.nome}
                      {tecnico.disponibilidade === "disponivel" && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data de Agendamento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dataAgendamento && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataAgendamento ? format(dataAgendamento, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataAgendamento}
                  onSelect={setDataAgendamento}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              placeholder="Instruções especiais para o técnico..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleDistribuir}
            disabled={!pedido || !tecnicoSelecionado || !dataAgendamento || submitting}
          >
            {submitting ? "Distribuindo..." : "Distribuir Serviço"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
