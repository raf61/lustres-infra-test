"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { CheckCircle2, XCircle, Package, DollarSign, User, Clock, Send } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface Aprovacao {
  id: string
  clienteNome: string
  tecnico: string
  tipo: "pecas" // Removido tipo "orcamento", SAC só aprova peças
  valor: number
  status: "pendente" | "aprovado" | "rejeitado"
  dataSolicitacao: string
  itens?: string[]
}

interface AprovacaoDialogProps {
  aprovacao: Aprovacao
  open: boolean
  onClose: () => void
}

export function AprovacaoDialog({ aprovacao, open, onClose }: AprovacaoDialogProps) {
  const [observacoes, setObservacoes] = useState("")
  const [enviandoOrcamento, setEnviandoOrcamento] = useState(false)

  const enviarOrcamentoWhatsApp = () => {
    setEnviandoOrcamento(true)

    const orcamentoData = {
      cliente: aprovacao.clienteNome,
      itens: aprovacao.itens,
      valor: aprovacao.valor,
      formaPagamento: "PIX, Boleto ou Cartão",
    }

    console.log("[v0] Enviando orçamento via WhatsApp:", orcamentoData)

    setTimeout(() => {
      setEnviandoOrcamento(false)
      alert("Orçamento enviado via WhatsApp! Aguardando aprovação do cliente (botão verde).")
    }, 1500)
  }

  const aprovarSolicitacao = () => {
    console.log("[v0] Aprovação confirmada:", {
      aprovacaoId: aprovacao.id,
      observacoes,
      proximaEtapa: "Supervisão Técnica",
      prazo: "3 dias úteis",
    })

    alert("Aprovação registrada! Encaminhado para Supervisão Técnica agendar conclusão.")
    onClose()
  }

  const rejeitarSolicitacao = () => {
    console.log("[v0] Solicitação rejeitada:", { aprovacaoId: aprovacao.id, observacoes })
    alert("Solicitação rejeitada e registrada no sistema.")
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl text-foreground flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Solicitação de Aprovação de Peças
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">ID: #{aprovacao.id}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Cliente</p>
              <p className="text-foreground font-medium">{aprovacao.clienteNome}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                Técnico Responsável
              </p>
              <p className="text-foreground font-medium">{aprovacao.tecnico}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Tipo de Solicitação</p>
              <Badge variant="outline" className="border-blue-500 text-blue-500">
                Reposição de Peças
              </Badge>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Data da Solicitação
              </p>
              <p className="text-foreground font-medium">
                {new Date(aprovacao.dataSolicitacao).toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>

          <Separator className="bg-border" />

          {aprovacao.itens && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Itens Solicitados</h3>
              <div className="space-y-2 bg-secondary/50 p-4 rounded-lg">
                {aprovacao.itens.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    <p className="text-sm text-foreground">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <p className="font-medium text-foreground">Valor Total</p>
              </div>
              <p className="text-2xl font-bold text-foreground">R$ {aprovacao.valor.toLocaleString("pt-BR")}</p>
            </div>
          </div>

          <Card className="border-blue-500/50 bg-blue-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">Enviar Orçamento para Cliente</p>
                  <p className="text-sm text-muted-foreground">
                    Envie o orçamento via WhatsApp com valores e forma de pagamento
                  </p>
                </div>
                <Button onClick={enviarOrcamentoWhatsApp} disabled={enviandoOrcamento} className="gap-2">
                  <Send className="h-4 w-4" />
                  {enviandoOrcamento ? "Enviando..." : "Enviar WhatsApp"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label htmlFor="observacoes" className="text-foreground">
              Observações do Contato
            </Label>
            <Textarea
              id="observacoes"
              placeholder="Registre aqui as informações do contato com o cliente..."
              className="min-h-[100px] bg-background border-border text-foreground"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>

          <Card className="border-orange-500/50 bg-orange-500/5">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-orange-500 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">Prazo de Aprovação: 24 horas</p>
                  <p className="text-sm text-muted-foreground">
                    Se não houver resposta do cliente em 24h, o sistema reportará automaticamente ao Dashboard Master
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} className="border-border bg-transparent">
            Cancelar
          </Button>
          <Button variant="destructive" className="gap-2" onClick={rejeitarSolicitacao}>
            <XCircle className="h-4 w-4" />
            Rejeitar
          </Button>
          <Button className="bg-green-500 hover:bg-green-600 gap-2" onClick={aprovarSolicitacao}>
            <CheckCircle2 className="h-4 w-4" />
            Aprovar e Encaminhar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
