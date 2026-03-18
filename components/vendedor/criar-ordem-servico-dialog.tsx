"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Calendar, Send, DollarSign, FileText } from "lucide-react"

interface CriarOrdemServicoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clienteId: string
  clienteNome: string
}

export function CriarOrdemServicoDialog({ open, onOpenChange, clienteId, clienteNome }: CriarOrdemServicoDialogProps) {
  const [descricaoServico, setDescricaoServico] = useState("")
  const [valorOrcamento, setValorOrcamento] = useState("")
  const [observacoes, setObservacoes] = useState("")

  const handleEnviar = () => {
    console.log("[v0] Criando ordem de serviço:", {
      clienteId,
      clienteNome,
      descricaoServico,
      valorOrcamento,
      observacoes,
      dataEnvio: new Date().toISOString(),
      status: "aguardando_distribuicao",
    })

    alert(
      `Ordem de serviço criada com sucesso!\n\nCliente: ${clienteNome}\nValor: R$ ${valorOrcamento}\n\nA ordem foi enviada para a Supervisão Técnica para distribuição.`,
    )

    // Limpar formulário
    setDescricaoServico("")
    setValorOrcamento("")
    setObservacoes("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Criar Ordem de Serviço
          </DialogTitle>
          <DialogDescription>
            Envie uma ordem de serviço para a Supervisão Técnica após fechar a venda
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações do Cliente */}
          <div className="rounded-lg border p-4 bg-muted/50">
            <h3 className="font-semibold mb-2">Cliente</h3>
            <p className="text-sm text-muted-foreground">{clienteNome}</p>
          </div>

          {/* Descrição do Serviço */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição do Serviço *</Label>
            <Textarea
              id="descricao"
              placeholder="Ex: Manutenção preventiva anual do SPDA, inspeção completa, medição ôhmica..."
              value={descricaoServico}
              onChange={(e) => setDescricaoServico(e.target.value)}
              rows={4}
            />
          </div>

          {/* Valor do Orçamento */}
          <div className="space-y-2">
            <Label htmlFor="valor">Valor do Orçamento *</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="valor"
                type="number"
                placeholder="0.00"
                value={valorOrcamento}
                onChange={(e) => setValorOrcamento(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações Adicionais</Label>
            <Textarea
              id="observacoes"
              placeholder="Informações importantes para a equipe técnica..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Informações sobre o fluxo */}
          <div className="rounded-lg border border-blue-500/50 bg-blue-500/5 p-4">
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              Próximos Passos
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>A ordem será enviada para a Supervisão Técnica</li>
              <li>A supervisão distribuirá o serviço para um técnico disponível</li>
              <li>O técnico realizará o serviço em até 3 dias úteis</li>
              <li>Você será notificado quando o serviço for concluído</li>
            </ul>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleEnviar}
              disabled={!descricaoServico || !valorOrcamento}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Send className="h-4 w-4 mr-2" />
              Enviar para Supervisão
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
