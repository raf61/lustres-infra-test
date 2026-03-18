"use client"

import { useState } from "react"
import { formatCNPJ } from "@/lib/formatters"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Mail, MessageSquare, User, Building2, Users, CheckCircle2, Send } from "lucide-react"
import { toast } from "sonner"

interface GerenteInfo {
  nome: string
  email?: string
  whatsapp?: string
}

interface ClienteDocumentoInfo {
  nomeCondominio: string
  cnpj: string
  sindico: {
    nome: string
    email?: string
    whatsapp?: string
  }
  administradora?: {
    nome: string
    email?: string
    telefone?: string
    gerentes?: GerenteInfo[]
  }
}

interface EnviarDocumentoDialogProps {
  cliente: ClienteDocumentoInfo | null
  open: boolean
  onClose: () => void
}

export function EnviarDocumentoDialog({ cliente, open, onClose }: EnviarDocumentoDialogProps) {
  const [tipoDocumento, setTipoDocumento] = useState<string>("")
  const [canalEnvio, setCanalEnvio] = useState<"email" | "whatsapp" | "ambos">("ambos")
  const [destinatarios, setDestinatarios] = useState({
    sindico: true,
    administradora: false,
    gerentes: [] as string[],
  })

  if (!cliente) return null

  const gerentes = cliente.administradora?.gerentes ?? []

  const handleToggleGerente = (gerenteNome: string) => {
    setDestinatarios((prev) => ({
      ...prev,
      gerentes: prev.gerentes.includes(gerenteNome)
        ? prev.gerentes.filter((g) => g !== gerenteNome)
        : [...prev.gerentes, gerenteNome],
    }))
  }

  const handleEnviar = () => {
    const destinatariosCount =
      (destinatarios.sindico ? 1 : 0) + (destinatarios.administradora ? 1 : 0) + destinatarios.gerentes.length

    if (destinatariosCount === 0) {
      toast.error("Selecione pelo menos um destinatário")
      return
    }

    if (!tipoDocumento) {
      toast.error("Selecione o tipo de documento")
      return
    }

    const canais = canalEnvio === "ambos" ? "WhatsApp e Email" : canalEnvio === "whatsapp" ? "WhatsApp" : "Email"

    toast.success(`${tipoDocumento} enviado via ${canais} para ${destinatariosCount} destinatário(s)`, {
      description: "Os documentos foram enviados com sucesso!",
    })

    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl text-foreground flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Enviar Documento
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {cliente.nomeCondominio} - CNPJ: {formatCNPJ(cliente.cnpj)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Tipo de Documento */}
          <div className="space-y-2">
            <Label className="text-foreground">Tipo de Documento</Label>
            <Select value={tipoDocumento} onValueChange={setTipoDocumento}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Selecione o documento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nota-fiscal">Nota Fiscal</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="orcamento">Orçamento</SelectItem>
                <SelectItem value="certificado">Certificado de Garantia</SelectItem>
                <SelectItem value="contrato">Contrato</SelectItem>
                <SelectItem value="relatorio">Relatório Técnico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator className="bg-border" />

          {/* Canal de Envio */}
          <div className="space-y-3">
            <Label className="text-foreground">Canal de Envio</Label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setCanalEnvio("email")}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  canalEnvio === "email"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background hover:border-primary/50"
                }`}
              >
                <Mail className={`h-6 w-6 ${canalEnvio === "email" ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-sm font-medium ${canalEnvio === "email" ? "text-primary" : "text-foreground"}`}>
                  Email
                </span>
              </button>

              <button
                onClick={() => setCanalEnvio("whatsapp")}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  canalEnvio === "whatsapp"
                    ? "border-green-500 bg-green-500/10"
                    : "border-border bg-background hover:border-green-500/50"
                }`}
              >
                <MessageSquare
                  className={`h-6 w-6 ${canalEnvio === "whatsapp" ? "text-green-500" : "text-muted-foreground"}`}
                />
                <span
                  className={`text-sm font-medium ${canalEnvio === "whatsapp" ? "text-green-500" : "text-foreground"}`}
                >
                  WhatsApp
                </span>
              </button>

              <button
                onClick={() => setCanalEnvio("ambos")}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  canalEnvio === "ambos"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background hover:border-primary/50"
                }`}
              >
                <div className="flex gap-1">
                  <Mail className={`h-5 w-5 ${canalEnvio === "ambos" ? "text-primary" : "text-muted-foreground"}`} />
                  <MessageSquare
                    className={`h-5 w-5 ${canalEnvio === "ambos" ? "text-primary" : "text-muted-foreground"}`}
                  />
                </div>
                <span className={`text-sm font-medium ${canalEnvio === "ambos" ? "text-primary" : "text-foreground"}`}>
                  Ambos
                </span>
              </button>
            </div>
          </div>

          <Separator className="bg-border" />

          {/* Destinatários */}
          <div className="space-y-4">
            <Label className="text-foreground">Destinatários</Label>

            {/* Síndico */}
            <div className="flex items-start gap-3 p-4 bg-secondary/50 rounded-lg">
              <Checkbox
                id="sindico"
                checked={destinatarios.sindico}
                onCheckedChange={(checked) => setDestinatarios((prev) => ({ ...prev, sindico: checked as boolean }))}
                className="mt-1"
              />
              <div className="flex-1">
                <Label htmlFor="sindico" className="flex items-center gap-2 cursor-pointer">
                  <User className="h-4 w-4 text-primary" />
                  <span className="font-medium text-foreground">Síndico</span>
                </Label>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{cliente.sindico.nome}</p>
                  {(canalEnvio === "email" || canalEnvio === "ambos") && cliente.sindico.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3" />
                      {cliente.sindico.email}
                    </div>
                  )}
                  {(canalEnvio === "whatsapp" || canalEnvio === "ambos") && cliente.sindico.whatsapp && (
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-3 w-3" />
                      {cliente.sindico.whatsapp}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Administradora */}
            {cliente.administradora && (
              <div className="flex items-start gap-3 p-4 bg-secondary/50 rounded-lg">
                <Checkbox
                  id="administradora"
                  checked={destinatarios.administradora}
                  onCheckedChange={(checked) =>
                    setDestinatarios((prev) => ({ ...prev, administradora: checked as boolean }))
                  }
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label htmlFor="administradora" className="flex items-center gap-2 cursor-pointer">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="font-medium text-foreground">Administradora</span>
                  </Label>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">{cliente.administradora.nome}</p>
                    {(canalEnvio === "email" || canalEnvio === "ambos") && cliente.administradora.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        {cliente.administradora.email}
                      </div>
                    )}
                    {(canalEnvio === "whatsapp" || canalEnvio === "ambos") && cliente.administradora.telefone && (
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-3 w-3" />
                        {cliente.administradora.telefone}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Gerentes */}
            {gerentes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-primary" />
                  <Label className="text-foreground">Gerentes da Administradora</Label>
                  <Badge variant="outline" className="text-xs">
                    {gerentes.length}
                  </Badge>
                </div>

                {gerentes.map((gerente, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 bg-secondary/50 rounded-lg">
                    <Checkbox
                      id={`gerente-${index}`}
                      checked={destinatarios.gerentes.includes(gerente.nome)}
                      onCheckedChange={() => handleToggleGerente(gerente.nome)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor={`gerente-${index}`} className="cursor-pointer">
                        <p className="font-medium text-foreground">{gerente.nome}</p>
                      </Label>
                      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {(canalEnvio === "email" || canalEnvio === "ambos") && gerente.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3" />
                            {gerente.email}
                          </div>
                        )}
                        {(canalEnvio === "whatsapp" || canalEnvio === "ambos") && gerente.whatsapp && (
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-3 w-3" />
                            {gerente.whatsapp}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resumo */}
          <div className="bg-primary/10 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span className="font-medium text-foreground">Resumo do Envio</span>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <strong className="text-foreground">Destinatários:</strong>{" "}
                {(destinatarios.sindico ? 1 : 0) +
                  (destinatarios.administradora ? 1 : 0) +
                  destinatarios.gerentes.length}{" "}
                selecionado(s)
              </p>
              <p>
                <strong className="text-foreground">Canal:</strong>{" "}
                {canalEnvio === "ambos" ? "WhatsApp e Email" : canalEnvio === "whatsapp" ? "WhatsApp" : "Email"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} className="border-border bg-transparent">
            Cancelar
          </Button>
          <Button onClick={handleEnviar} className="bg-primary hover:bg-primary/90">
            <Send className="h-4 w-4 mr-2" />
            Enviar Documento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
