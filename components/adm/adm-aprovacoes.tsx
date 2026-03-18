"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CheckCircle2, Clock, FileText, Send, MapPin, User, Calendar } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export function AdmAprovacoesComponent() {
  const [selectedServico, setSelectedServico] = useState<any>(null)

  // TODO: Substituir por dados da API quando endpoint /api/servicos/aguardando-aprovacao estiver disponível
  const servicosAguardandoAprovacao = [
    {
      id: "1",
      clienteNome: "Condomínio Residencial Atlântico",
      tecnico: "Carlos Silva",
      dataConclusao: "2025-01-27T14:30:00",
      localizacao: { lat: -22.9068, lng: -43.1729 },
      medicaoOhmica: "8.5",
      nomePorteiro: "João Santos",
      status: "aguardando_aprovacao",
    },
    {
      id: "2",
      clienteNome: "Edifício Comercial Centro",
      tecnico: "Roberto Lima",
      dataConclusao: "2025-01-27T16:45:00",
      localizacao: { lat: -22.9035, lng: -43.2096 },
      medicaoOhmica: "9.2",
      nomePorteiro: "Maria Oliveira",
      status: "aguardando_aprovacao",
    },
  ]

  const aprovarEnvioDocumentos = (servicoId: string) => {
    console.log("[v0] ADM aprovando envio de documentos para serviço:", servicoId)
    console.log("[v0] Gerando: Nota Fiscal, Boleto, Certificado de Garantia")
    console.log("[v0] Enviando documentos via WhatsApp e Email para cliente e administradora")
    console.log("[v0] Adicionando à Contas a Receber")

    alert(
      "✅ Documentos aprovados e enviados!\n\n" +
        "📄 Nota Fiscal gerada\n" +
        "💰 Boleto emitido\n" +
        "🛡️ Certificado de Garantia criado\n" +
        "📧 Documentos enviados via WhatsApp e Email\n" +
        "💵 Adicionado à Contas a Receber",
    )

    setSelectedServico(null)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-8 w-8 text-primary" />
              Aprovações ADM
            </h1>
            <p className="text-muted-foreground">Aprovar envio de documentos de serviços concluídos</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Aguardando Aprovação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{servicosAguardandoAprovacao.length}</div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Aprovados Hoje</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">5</div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Documentos Enviados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">15</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Serviços Aguardando Aprovação</CardTitle>
            <CardDescription>
              Serviços concluídos pelos técnicos aguardando liberação para envio de documentos
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Cliente</TableHead>
                  <TableHead>Técnico</TableHead>
                  <TableHead>Data Conclusão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {servicosAguardandoAprovacao.map((servico) => (
                  <TableRow key={servico.id} className="border-border hover:bg-accent/5">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                          <FileText className="h-5 w-5 text-orange-500" />
                        </div>
                        <p className="font-medium">{servico.clienteNome}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        {servico.tecnico}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(servico.dataConclusao).toLocaleString("pt-BR")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-orange-500/10 text-orange-500">
                        <Clock className="h-3 w-3 mr-1" />
                        Aguardando
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="default" size="sm" onClick={() => setSelectedServico(servico)}>
                        <FileText className="h-4 w-4 mr-1" />
                        Revisar e Aprovar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {selectedServico && (
        <Dialog open={!!selectedServico} onOpenChange={() => setSelectedServico(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Aprovar Envio de Documentos</DialogTitle>
              <DialogDescription>{selectedServico.clienteNome}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <Card className="border-border">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Técnico:</span>
                    <span className="font-medium">{selectedServico.tecnico}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Data/Hora Conclusão:</span>
                    <span className="font-medium">
                      {new Date(selectedServico.dataConclusao).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Medição Ôhmica:</span>
                    <span className="font-medium text-green-500">{selectedServico.medicaoOhmica}Ω ✓</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Porteiro:</span>
                    <span className="font-medium">{selectedServico.nomePorteiro}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Localização:</span>
                    <div className="flex items-center gap-1 text-sm">
                      <MapPin className="h-3 w-3 text-blue-500" />
                      <span className="font-mono text-xs">
                        {selectedServico.localizacao.lat.toFixed(4)}, {selectedServico.localizacao.lng.toFixed(4)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-green-500/50 bg-green-500/5">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Send className="h-5 w-5 text-green-500" />
                    Documentos que serão gerados e enviados:
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span>Nota Fiscal de Serviço</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span>Boleto para pagamento</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span>Certificado de Garantia (próxima manutenção em 12 meses)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span>Envio via WhatsApp e Email para cliente e administradora</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setSelectedServico(null)} className="flex-1">
                  Cancelar
                </Button>
                <Button
                  onClick={() => aprovarEnvioDocumentos(selectedServico.id)}
                  className="flex-1 bg-green-500 hover:bg-green-600"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Aprovar e Enviar Documentos
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  )
}
