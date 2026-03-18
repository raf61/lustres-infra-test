"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowUpCircle, ArrowDownCircle, Calendar, User } from "lucide-react"

interface HistoricoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  produto: any
}

// TODO: Substituir por dados da API quando endpoint /api/estoque/historico estiver disponível
const EXEMPLO_HISTORICO = [
  {
    id: "1",
    tipo: "entrada",
    quantidade: 100,
    data: "2025-10-01",
    responsavel: "Admin Master",
    observacao: "Compra inicial do fornecedor A",
    estoqueAntes: 0,
    estoqueDepois: 100,
  },
  {
    id: "2",
    tipo: "saida",
    quantidade: 15,
    data: "2025-10-10",
    responsavel: "José Técnico",
    observacao: "Usado no serviço #123 - Condomínio Atlântico",
    estoqueAntes: 100,
    estoqueDepois: 85,
  },
  {
    id: "3",
    tipo: "saida",
    quantidade: 20,
    data: "2025-10-15",
    responsavel: "Paulo Técnico",
    observacao: "Usado no serviço #124 - Edifício Barra Garden",
    estoqueAntes: 85,
    estoqueDepois: 65,
  },
  {
    id: "4",
    tipo: "saida",
    quantidade: 20,
    data: "2025-10-20",
    responsavel: "Ricardo Técnico",
    observacao: "Usado no serviço #125 - Residencial Tijuca Plaza",
    estoqueAntes: 65,
    estoqueDepois: 45,
  },
]

export function HistoricoDialog({ open, onOpenChange, produto }: HistoricoDialogProps) {
  if (!produto) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Histórico de Movimentações</DialogTitle>
          <DialogDescription>Todas as entradas e saídas do produto</DialogDescription>
        </DialogHeader>

        <div className="p-3 bg-muted rounded-lg mb-4">
          <div className="flex items-center gap-3">
            {produto.foto && (
              <img
                src={produto.foto || "/placeholder.svg"}
                alt={produto.nome}
                className="h-12 w-12 rounded object-cover"
              />
            )}
            <div>
              <p className="font-medium">{produto.nome}</p>
              <p className="text-sm text-muted-foreground">Código: {produto.codigo}</p>
            </div>
          </div>
        </div>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {EXEMPLO_HISTORICO.map((mov) => (
              <div key={mov.id} className="border border-border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {mov.tipo === "entrada" ? (
                      <ArrowUpCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <ArrowDownCircle className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium">
                        {mov.tipo === "entrada" ? "Entrada" : "Saída"} de {mov.quantidade} unidades
                      </p>
                      <p className="text-sm text-muted-foreground">{mov.observacao}</p>
                    </div>
                  </div>
                  <Badge variant={mov.tipo === "entrada" ? "default" : "secondary"}>
                    {mov.tipo === "entrada" ? "+" : "-"}
                    {mov.quantidade}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(mov.data).toLocaleDateString("pt-BR")}
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {mov.responsavel}
                  </div>
                </div>

                <div className="text-sm">
                  <span className="text-muted-foreground">Estoque: </span>
                  <span className="font-medium">{mov.estoqueAntes}</span>
                  <span className="mx-2">→</span>
                  <span className="font-medium">{mov.estoqueDepois}</span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
