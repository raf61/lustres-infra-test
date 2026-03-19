"use client"

import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  Bot, User, Send, Building2, CheckCircle2, Sparkles,
  MessageSquare, X, ChevronRight, Zap, Target, Users, Loader2,
  Calendar, Info, Layout, Phone, UserCircle, Megaphone,
  Type, MousePointer2, Copy, Braces
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface CampaignDialogProps {
  open: boolean
  onClose: () => void
  selectedCount: number
  selectedClients: any[] // Just some preview clients
  vendedores: { id: string, name: string }[]
}

const TEMPLATES_MOCK = [
  { id: "1", name: "Apresentação Comercial", description: "Apresentação inicial de produtos e serviços", content: "Olá {{contact.name}}, aqui é da Casarão Lustres. Gostaria de apresentar..." },
  { id: "2", name: "Promoção Lâmpadas LED", description: "Oferta de lâmpadas para as áreas comuns", content: "Prezado {{contact.name}}, temos uma condição especial para troca de lâmpadas LED..." },
  { id: "3", name: "Consultoria Técnica", description: "Agendamento de visita para avaliação", content: "Olá {{contact.name}}! Podemos agendar uma visita técnica para avaliar a iluminação?" },
  { id: "4", name: "Follow-up Orçamento", description: "Recontato para orçamentos pendentes", content: "Oi {{contact.name}}, tudo bem? Passando para ver se restou alguma dúvida sobre o orçamento..." },
]

export function CampaignDialog({ open, onClose, selectedCount, selectedClients, vendedores }: CampaignDialogProps) {
  const [isAI, setIsAI] = useState(true)
  const [campaignName, setCampaignName] = useState("")
  const [useTemplate, setUseTemplate] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [customMessage, setCustomMessage] = useState("")
  const [aiInstructions, setAiInstructions] = useState("Aja como um consultor sênior da Casarão Lustres. Seja cordial e breve. Foque em agendar uma visita técnica ou confirmar interesse em produtos.")
  const [selectedVendedor, setSelectedVendedor] = useState("")
  const [sending, setSending] = useState(false)
  const { toast } = useToast()

  // Gerar 200 destinatários mockados para a lista scrollable
  const fullDestinatariosMock = useMemo(() => {
    const list = [...selectedClients]
    for (let i = list.length; i < 200; i++) {
      list.push({
        id: `mock-${i}`,
        nomeSindico: `Cliente Síndico ${i + 1}`,
        telefoneSindico: `(11) 9${Math.floor(Math.random() * 90000000 + 10000000)}`
      })
    }
    return list
  }, [selectedClients])

  const insertVariable = (variable: string) => {
    setCustomMessage(prev => prev + ` {{${variable}}}`)
  }

  const handleFire = () => {
    if (!campaignName) {
      toast({ title: "Nome da campanha obrigatório", variant: "destructive" })
      return
    }

    setSending(true)
    setTimeout(() => {
      setSending(false)
      toast({
        title: "Campanha Iniciada",
        description: `Disparo para ${selectedCount} destinatários em processamento.`,
      })
      onClose()
    }, 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[75rem] p-0 overflow-hidden border border-border shadow-2xl bg-background flex flex-col h-[90vh]">
        {/* Header Sóbrio - Igual Pedidos */}
        <div className="border-b border-border p-5 bg-muted/30 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600/10 rounded-lg flex items-center justify-center border border-blue-600/20">
                <Megaphone className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
                  Nova Campanha de Marketing
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Configure os parâmetros de envio para a base selecionada
                </DialogDescription>
              </div>
            </div>
            <div className="bg-background rounded-lg border border-border px-4 py-2 flex items-center gap-3 shadow-sm">
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-muted-foreground leading-none">Destinatários</p>
                <p className="text-lg font-bold text-foreground leading-none mt-1">{selectedCount}</p>
              </div>
              <Users className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Coluna Esquerda: Clientes (Sóbria) */}
          <div className="w-[20rem] border-r border-border bg-muted/10 flex flex-col shrink-0">
            <div className="p-4 border-b border-border bg-muted/20">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-600" /> DESTINATÁRIOS
              </h4>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-1">
                {fullDestinatariosMock.map((client, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg border border-border/40 bg-background flex items-center gap-3 transition-colors hover:bg-muted/50">
                    <UserCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-foreground truncate">{client.nomeSindico || "Sem nome"}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{client.telefoneSindico || "Sem tel"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Área Principal Scrollable */}
          <ScrollArea className="flex-1 bg-background">
            <div className="p-8 space-y-8 max-w-4xl mx-auto">
                {/* Nome da Campanha */}
                <div className="grid gap-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Nome da Campanha
                  </Label>
                  <Input
                    placeholder="Ex: Disparo Março - Leds em oferta"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="h-11 border-border focus-visible:ring-blue-600 text-base"
                  />
                </div>

                <div className="grid grid-cols-2 gap-8">
                  {/* Bloco de Configurações */}
                  <div className="space-y-6">
                    <div className="p-5 rounded-xl border border-border bg-muted/20 space-y-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Bot className={cn("h-5 w-5", isAI ? "text-blue-600" : "text-muted-foreground")} />
                          <div>
                            <p className="text-sm font-bold">Assistência por I.A.</p>
                            <p className="text-[11px] text-muted-foreground">Resposta automática e qualificação</p>
                          </div>
                        </div>
                        <Switch checked={isAI} onCheckedChange={setIsAI} />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Consultor Responsável</Label>
                        <select
                          className="w-full bg-background border border-border rounded-lg h-10 px-3 text-sm outline-none focus:border-blue-600 appearance-none"
                          value={selectedVendedor}
                          onChange={(e) => setSelectedVendedor(e.target.value)}
                        >
                          <option value="">Manter atual do Lead</option>
                          {vendedores.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="p-5 rounded-xl border border-border bg-muted/20 space-y-4">
                       <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Formato da Mensagem</Label>
                       <div className="grid grid-cols-2 gap-2">
                          <Button 
                             type="button" 
                             variant={useTemplate ? "default" : "outline"} 
                             className="h-9 text-[10px] font-bold uppercase"
                             onClick={() => setUseTemplate(true)}
                          >USAR TEMPLATE</Button>
                          <Button 
                             type="button" 
                             variant={!useTemplate ? "default" : "outline"} 
                             className="h-9 text-[10px] font-bold uppercase"
                             onClick={() => setUseTemplate(false)}
                          >TEXTO MANUAL</Button>
                       </div>
                    </div>
                  </div>

                  {/* Bloco de Conteúdo / Variáveis */}
                  <div className="space-y-4">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Braces className="h-3.5 w-3.5" /> 
                      {useTemplate ? "Escolher Template" : "Variáveis Disponíveis"}
                    </Label>
                    
                    {useTemplate ? (
                       <div className="space-y-2">
                        {TEMPLATES_MOCK.map(t => (
                          <button
                            key={t.id}
                            onClick={() => { setSelectedTemplate(t.id); setCustomMessage(t.content) }}
                            className={cn(
                              "w-full text-left p-3 rounded-xl border transition-all",
                              selectedTemplate === t.id ? "bg-blue-50 border-blue-600 ring-1 ring-blue-600" : "bg-muted/30 border-border hover:bg-muted/50"
                            )}
                          >
                            <p className="text-xs font-bold text-foreground">{t.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{t.description}</p>
                          </button>
                        ))}
                      </div>
                    ) : (
                       <div className="grid grid-cols-1 gap-2">
                          {[
                            { name: "Nome do Síndico", key: "contact.name" },
                            { name: "Vendedor Atribuído", key: "vendor.name" },
                            { name: "Data da Campanha", key: "now.date" },
                          ].map(v => (
                            <Button 
                               key={v.key}
                               variant="outline" 
                               className="h-9 text-[10px] font-bold justify-start gap-3 border-border hover:bg-blue-50 hover:border-blue-300"
                               onClick={() => insertVariable(v.key)}
                            >
                               <Braces className="h-3.5 w-3.5 text-blue-500" />
                               Inserir {v.name}
                            </Button>
                          ))}
                       </div>
                    )}
                  </div>
                </div>

                {/* Conteúdo Final e Instruções IA */}
                <div className="space-y-6 pt-6 border-t border-border">
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-blue-600" />
                      Conteúdo do Disparo
                    </h4>
                    <Textarea
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      placeholder="Identifique o conteúdo que será enviado..."
                      className="min-h-[160px] rounded-xl border-border bg-background focus-visible:ring-blue-600 text-base leading-relaxed p-4"
                    />
                  </div>

                  {isAI && (
                    <div className="p-6 rounded-2xl border border-border bg-muted/40 space-y-3">
                       <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-blue-600" />
                          <Label className="text-xs font-bold uppercase tracking-widest text-foreground">Comportamento da Inteligência Artificial</Label>
                       </div>
                       <Textarea 
                          value={aiInstructions}
                          onChange={(e) => setAiInstructions(e.target.value)}
                          placeholder="Ex: Seja formal, foque em agendamento..."
                          className="min-h-[100px] border-border bg-background text-sm leading-relaxed"
                       />
                       <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                          <Info className="h-3 w-3" />
                          As instruções acima definem como a I.A deve interagir após o disparo inicial.
                       </div>
                    </div>
                  )}
                </div>
            </div>
          </ScrollArea>
        </div>

        {/* Footer Sóbrio */}
        <div className="p-6 border-t border-border bg-muted/30 flex items-center justify-between shrink-0">
          <p className="text-xs text-muted-foreground font-medium">
            Lote de envio: <span className="text-foreground font-bold">{selectedCount} contatos</span>.
          </p>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onClose} className="font-bold text-xs uppercase tracking-widest px-6 h-10">
              CANCELAR
            </Button>
            <Button
              onClick={handleFire}
              disabled={sending}
              className="h-11 px-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest gap-2 shadow-lg transition-all active:scale-95"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "PROCESSANDO..." : "INICIAR DISPARO IMEDIATO"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
