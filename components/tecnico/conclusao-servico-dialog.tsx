"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { CheckCircle2, FileText, Zap, Package, Calendar, MapPin, Clock, PenTool, Send } from "lucide-react"

interface ConclusaoServicoDialogProps {
  servicoId: string
  clienteNome: string
  open: boolean
  onClose: () => void
}

export function ConclusaoServicoDialog({ servicoId, clienteNome, open, onClose }: ConclusaoServicoDialogProps) {
  const [medicaoOhmica, setMedicaoOhmica] = useState("")
  const [observacoes, setObservacoes] = useState("")
  const [assinatura, setAssinatura] = useState<string | null>(null)
  const [nomePorteiro, setNomePorteiro] = useState("")
  const [localizacao, setLocalizacao] = useState<{ lat: number; lng: number } | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const assinaturaStorageKey = `visita:${servicoId}:assinatura:conclusao`

  const canvasRef = useRef<HTMLCanvasElement>(null)

  const pecasUtilizadas = [
    { nome: "Haste de Aterramento", quantidade: 2, concluido: true },
    { nome: "Split Bolt", quantidade: 5, concluido: true },
    { nome: "Cabo de Cobre 35mm", quantidade: 10, concluido: true },
  ]

  useEffect(() => {
    if (open && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocalizacao({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
          console.log("[v0] Geolocalização capturada:", position.coords)
        },
        (error) => {
          console.error("[v0] Erro ao capturar localização:", error)
        },
      )
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    try {
      const stored = localStorage.getItem(assinaturaStorageKey)
      if (!stored) return
      const parsed = JSON.parse(stored) as {
        medicaoOhmica?: string
        observacoes?: string
        nomePorteiro?: string
      }
      if (typeof parsed.medicaoOhmica === "string") setMedicaoOhmica(parsed.medicaoOhmica)
      if (typeof parsed.observacoes === "string") setObservacoes(parsed.observacoes)
      if (typeof parsed.nomePorteiro === "string") setNomePorteiro(parsed.nomePorteiro)
    } catch {
      // ignore invalid storage data
    }
  }, [open, assinaturaStorageKey])

  useEffect(() => {
    if (!open) return
    try {
      localStorage.setItem(
        assinaturaStorageKey,
        JSON.stringify({
          medicaoOhmica,
          observacoes,
          nomePorteiro,
        }),
      )
    } catch {
      // ignore storage errors (quota, private mode)
    }
  }, [open, assinaturaStorageKey, medicaoOhmica, observacoes, nomePorteiro])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.strokeStyle = "#ffffff"
    ctx.lineWidth = 2
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (canvas) {
      setAssinatura(canvas.toDataURL())
    }
  }

  const limparAssinatura = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setAssinatura(null)
  }

  const finalizarServico = () => {
    const dataHoraConclusao = new Date()
    const conclusaoData = {
      servicoId,
      clienteNome,
      medicaoOhmica,
      observacoes,
      pecasUtilizadas,
      assinatura,
      nomePorteiro,
      dataHoraConclusao: dataHoraConclusao.toISOString(),
      localizacao,
      proximaManutencao: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    }

    console.log("[v0] Serviço finalizado pelo técnico:", conclusaoData)
    console.log("[v0] Enviando notificação para ADM da empresa aprovar envio de documentos")
    console.log("[v0] Geolocalização:", localizacao)
    console.log("[v0] Data/Hora:", dataHoraConclusao.toLocaleString("pt-BR"))

    alert(
      "✅ Serviço finalizado com sucesso!\n\n" +
        "📍 Localização registrada\n" +
        "🕐 Data/Hora: " +
        dataHoraConclusao.toLocaleString("pt-BR") +
        "\n" +
        "✍️ Assinatura do porteiro capturada\n\n" +
        "📧 Notificação enviada para ADM aprovar envio de documentos\n\n" +
        "⚠️ Documentos serão gerados após aprovação da ADM",
    )

    try {
      localStorage.removeItem(assinaturaStorageKey)
    } catch {
      // ignore storage errors
    }
    onClose()
  }

  const isFormValid = medicaoOhmica && assinatura && nomePorteiro && localizacao

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Conclusão do Serviço - {clienteNome}
          </DialogTitle>
          <DialogDescription>Preencha os dados finais e colete a assinatura do porteiro</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card className="border-blue-500/50 bg-blue-500/5">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">Localização</p>
                    {localizacao ? (
                      <p className="text-xs text-muted-foreground">
                        {localizacao.lat.toFixed(6)}, {localizacao.lng.toFixed(6)}
                      </p>
                    ) : (
                      <p className="text-xs text-orange-500">Capturando...</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">Data/Hora</p>
                    <p className="text-xs text-muted-foreground">{new Date().toLocaleString("pt-BR")}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Peças Utilizadas */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Package className="h-5 w-5" />
              Peças Utilizadas
            </h3>
            <Card className="border-border">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {pecasUtilizadas.map((peca, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="font-medium">{peca.nome}</p>
                          <p className="text-sm text-muted-foreground">Quantidade: {peca.quantidade}</p>
                        </div>
                      </div>
                      <span className="text-sm text-green-500 font-medium">✓ OK</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Medição Ôhmica */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Medição Ôhmica
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Resistência Medida (Ω) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 8.5"
                  value={medicaoOhmica}
                  onChange={(e) => setMedicaoOhmica(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Status da Medição</Label>
                <div className="mt-1 p-2 bg-green-500/10 border border-green-500/50 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-green-500">✓ Dentro do padrão (≤10Ω)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Observações Finais */}
          <div className="space-y-2">
            <Label>Observações Finais</Label>
            <Textarea
              placeholder="Descreva detalhes da conclusão do serviço..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <PenTool className="h-5 w-5" />
              Assinatura Digital do Porteiro *
            </h3>
            <div className="space-y-3">
              <div>
                <Label>Nome do Porteiro *</Label>
                <Input
                  placeholder="Digite o nome completo do porteiro"
                  value={nomePorteiro}
                  onChange={(e) => setNomePorteiro(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Assinatura na Tela *</Label>
                <div className="mt-1 border-2 border-dashed border-border rounded-lg p-4 bg-muted/30">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={200}
                    className="w-full bg-background rounded cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                  />
                  <div className="flex justify-between items-center mt-3">
                    <p className="text-sm text-muted-foreground">Desenhe a assinatura acima</p>
                    <Button variant="outline" size="sm" onClick={limparAssinatura}>
                      Limpar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <Card className="border-orange-500/50 bg-orange-500/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Send className="h-5 w-5 text-orange-500 mt-0.5" />
                <div className="space-y-2">
                  <h3 className="font-semibold text-orange-500">Aguardando Aprovação da ADM</h3>
                  <p className="text-sm text-muted-foreground">
                    Após finalizar, uma notificação será enviada para a ADM da empresa. Os documentos (Nota Fiscal,
                    Boleto e Certificado de Garantia) serão gerados e enviados somente após aprovação da ADM.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documentos que serão gerados */}
          <Card className="border-green-500/50 bg-green-500/5">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-500" />
                Documentos que serão gerados (após aprovação ADM):
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
                  <span>Certificado de Garantia</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Agendamento automático da próxima manutenção (12 meses)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Próxima Manutenção */}
          <Card className="border-blue-500/50 bg-blue-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-bold text-lg">PRÓXIMA MANUTENÇÃO AGENDADA</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-blue-500">+12 meses</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onClose} className="flex-1 bg-transparent">
            Cancelar
          </Button>
          <Button onClick={finalizarServico} className="flex-1 bg-green-500 hover:bg-green-600" disabled={!isFormValid}>
            <Send className="h-4 w-4 mr-2" />
            Finalizar e Enviar para ADM
          </Button>
        </div>

        {!isFormValid && (
          <p className="text-sm text-orange-500 text-center">
            * Preencha todos os campos obrigatórios e colete a assinatura
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
