"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { CheckCircle2, XCircle, MapPin, Clock, FileText, Plus, Trash2, PenTool, Save } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ChecklistDialogProps {
  servicoId: string
  clienteNome: string
  open: boolean
  onClose: () => void
}

interface ItemChecklist {
  id: string
  equipamento: string
  status: "ok" | "trocar"
  quantidade?: number
  observacao?: string
}

export function ChecklistDialog({ servicoId, clienteNome, open, onClose }: ChecklistDialogProps) {
  const [itens, setItens] = useState<ItemChecklist[]>([
    { id: "1", equipamento: "Captor Franklin", status: "ok" },
    { id: "2", equipamento: "Haste de Aterramento", status: "trocar", quantidade: 2 },
    { id: "3", equipamento: "Cabo de Descida 35mm", status: "ok" },
  ])
  const [novoEquipamento, setNovoEquipamento] = useState("")
  const [assinando, setAssinando] = useState(false)
  const [assinatura, setAssinatura] = useState<string | null>(null)
  const [nomePorteiro, setNomePorteiro] = useState("")
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [localizacao, setLocalizacao] = useState<{ lat: number; lng: number } | null>(null)
  const assinaturaStorageKey = `visita:${servicoId}:assinatura:checklist`

  useEffect(() => {
    if (!open) return
    try {
      const stored = localStorage.getItem(assinaturaStorageKey)
      if (!stored) return
      const parsed = JSON.parse(stored) as { nomePorteiro?: string }
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
          nomePorteiro,
        }),
      )
    } catch {
      // ignore storage errors (quota, private mode)
    }
  }, [open, assinaturaStorageKey, nomePorteiro])

  // Simular captura de geolocalização
  const capturarLocalizacao = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocalizacao({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
        },
        () => {

        },
      )
    } else {
      setLocalizacao({ lat: -22.9068, lng: -43.1729 })
    }
  }

  const adicionarItem = () => {
    if (novoEquipamento.trim()) {
      setItens([
        ...itens,
        {
          id: Date.now().toString(),
          equipamento: novoEquipamento,
          status: "ok",
        },
      ])
      setNovoEquipamento("")
    }
  }

  const removerItem = (id: string) => {
    setItens(itens.filter((item) => item.id !== id))
  }

  const atualizarItem = (id: string, campo: keyof ItemChecklist, valor: any) => {
    setItens(itens.map((item) => (item.id === id ? { ...item, [campo]: valor } : item)))
  }

  // Funções de desenho da assinatura
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
    ctx.strokeStyle = "#000"
    ctx.lineWidth = 2
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const limparAssinatura = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const salvarAssinatura = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL()
    setAssinatura(dataUrl)
    setAssinando(false)
  }

  const finalizarChecklist = () => {
    if (!assinatura || !nomePorteiro) {
      alert("Por favor, preencha o nome do porteiro e a assinatura")
      return
    }

    capturarLocalizacao()

    // Simular envio do checklist
    const checklistData = {
      servicoId,
      clienteNome,
      itens,
      nomePorteiro,
      assinatura,
      dataHora: new Date().toISOString(),
      localizacao: localizacao || { lat: -22.9068, lng: -43.1729 },
    }

    console.log("[v0] Checklist finalizado:", checklistData)
    alert("Checklist enviado com sucesso! Disponível para o SAC.")
    try {
      localStorage.removeItem(assinaturaStorageKey)
    } catch {
      // ignore storage errors
    }
    onClose()
  }

  const itensPrecisaTroca = itens.filter((item) => item.status === "trocar")
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Checklist Inicial - {clienteNome}
          </DialogTitle>
          <DialogDescription>Preencha a inspeção dos equipamentos e colete a assinatura do porteiro</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações do Serviço */}
          <Card className="border-border bg-muted/30">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Data/Hora:</span>
                  <span className="font-medium">{new Date().toLocaleString("pt-BR")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Localização:</span>
                  <span className="font-medium text-green-500">Capturada</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Equipamentos */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>

                <h3 className="text-lg font-semibold">Manutenção dos equipamentos</h3>  
                <p className="text-sm text-muted-foreground">Os itens abaixo listados para manutenção são os itens listados no pedido. </p>
              </div>
              <div>
                <Badge variant="outline" className="text-orange-500 border-orange-500">
                  {itensPrecisaTroca.length} item(ns) para troca
                </Badge>
              </div>
            </div>

            <div className="space-y-3">
              {itens.map((item) => (
                <Card key={item.id} className="border-border">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-12 gap-4 items-start">
                      <div className="col-span-4">
                        <Label className="text-xs text-muted-foreground">Equipamento</Label>
                        <p className="font-medium mt-1">{item.equipamento}</p>
                      </div>

                      <div className="col-span-2">
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        <Select
                          value={item.status}
                          onValueChange={(value: "ok" | "trocar") => atualizarItem(item.id, "status", value)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ok">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                OK
                              </div>
                            </SelectItem>
                            <SelectItem value="trocar">
                              <div className="flex items-center gap-2">
                                <XCircle className="h-4 w-4 text-red-500" />
                                Trocar
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {item.status === "trocar" && (
                        <div className="col-span-2">
                          <Label className="text-xs text-muted-foreground">Quantidade</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantidade || 1}
                            onChange={(e) => atualizarItem(item.id, "quantidade", Number.parseInt(e.target.value))}
                            className="mt-1"
                          />
                        </div>
                      )}

                      <div className="col-span-3">
                        <Label className="text-xs text-muted-foreground">Observação</Label>
                        <Input
                          placeholder="Detalhes..."
                          value={item.observacao || ""}
                          onChange={(e) => atualizarItem(item.id, "observacao", e.target.value)}
                          className="mt-1"
                        />
                      </div>

                      <div className="col-span-1 flex items-end">
                        <Button variant="ghost" size="icon" onClick={() => removerItem(item.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Adicionar Novo Item */}
            <div className="flex gap-2">
              <Input
                placeholder="Nome do equipamento..."
                value={novoEquipamento}
                onChange={(e) => setNovoEquipamento(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && adicionarItem()}
              />
              <Button onClick={adicionarItem} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>
          </div>

          <Separator />

          {/* Assinatura Digital */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <PenTool className="h-5 w-5" />
              Assinatura do Porteiro
            </h3>

            <div className="space-y-3">
              <div>
                <Label>Nome do Porteiro</Label>
                <Input
                  placeholder="Digite o nome completo"
                  value={nomePorteiro}
                  onChange={(e) => setNomePorteiro(e.target.value)}
                  className="mt-1"
                />
              </div>

              {!assinando && !assinatura && (
                <Button onClick={() => setAssinando(true)} variant="outline" className="w-full">
                  <PenTool className="h-4 w-4 mr-2" />
                  Coletar Assinatura
                </Button>
              )}

              {assinando && (
                <Card className="border-border">
                  <CardContent className="pt-6 space-y-3">
                    <p className="text-sm text-muted-foreground">Desenhe a assinatura abaixo:</p>
                    <canvas
                      ref={canvasRef}
                      width={600}
                      height={200}
                      className="border border-border rounded-lg bg-white cursor-crosshair w-full"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                    />
                    <div className="flex gap-2">
                      <Button onClick={limparAssinatura} variant="outline" className="flex-1 bg-transparent">
                        Limpar
                      </Button>
                      <Button onClick={salvarAssinatura} className="flex-1">
                        <Save className="h-4 w-4 mr-2" />
                        Salvar Assinatura
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {assinatura && (
                <Card className="border-green-500/50 bg-green-500/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <span className="font-medium">Assinatura coletada com sucesso</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setAssinatura(null)}>
                        Refazer
                      </Button>
                    </div>
                    <img
                      src={assinatura || "/placeholder.svg"}
                      alt="Assinatura"
                      className="mt-3 border border-border rounded"
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1 bg-transparent">
              Cancelar
            </Button>
            <Button onClick={finalizarChecklist} className="flex-1" disabled={!assinatura || !nomePorteiro}>
              <FileText className="h-4 w-4 mr-2" />
              Finalizar e Enviar para SAC
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
