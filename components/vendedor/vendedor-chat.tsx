"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Search,
  Send,
  Paperclip,
  Phone,
  Video,
  MoreVertical,
  Bell,
  Clock,
  Mail,
  MessageSquare,
  Calendar,
  FileText,
  DollarSign,
  CheckCheck,
  Check,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AgendarRetornoDialog } from "./agendar-retorno-dialog"
import { EnviarOrcamentoDialog } from "./enviar-orcamento-dialog"

// TODO: Substituir por dados da API quando endpoint /api/vendedor/conversas estiver disponível
const conversas = [
  {
    id: 1,
    cliente: "Condomínio Residencial Atlântico",
    ultimaMensagem: "Obrigado pelo orçamento! Vou analisar com o síndico.",
    timestamp: "10:30",
    naoLidas: 0,
    canal: "whatsapp" as const,
    status: "lida" as const,
    retornoAgendado: "2025-10-30T14:00:00",
    sindico: "Carlos Silva",
    telefone: "(21) 98765-4321",
  },
  {
    id: 2,
    cliente: "Edifício Copacabana Palace",
    ultimaMensagem: "Bom dia! Gostaria de um orçamento para manutenção.",
    timestamp: "09:15",
    naoLidas: 2,
    canal: "email" as const,
    status: "entregue" as const,
    retornoAgendado: "2025-10-28T10:00:00",
    sindico: "Maria Santos",
    telefone: "(21) 97654-3210",
  },
  {
    id: 3,
    cliente: "Condomínio Vista Mar",
    ultimaMensagem: "Quando o técnico pode vir fazer a vistoria?",
    timestamp: "Ontem",
    naoLidas: 1,
    canal: "whatsapp" as const,
    status: "entregue" as const,
    retornoAgendado: "2025-10-28T15:00:00",
    sindico: "João Oliveira",
    telefone: "(21) 96543-2109",
  },
  {
    id: 4,
    cliente: "Edifício Barra Garden",
    ultimaMensagem: "Recebi o certificado. Tudo certo!",
    timestamp: "25/10",
    naoLidas: 0,
    canal: "email" as const,
    status: "lida" as const,
    sindico: "Ana Costa",
    telefone: "(21) 95432-1098",
  },
  {
    id: 5,
    cliente: "Condomínio Leblon Premium",
    ultimaMensagem: "Preciso urgente de um orçamento",
    timestamp: "24/10",
    naoLidas: 3,
    canal: "whatsapp" as const,
    status: "enviada" as const,
    retornoAgendado: "2025-10-28T09:00:00",
    sindico: "Pedro Almeida",
    telefone: "(21) 94321-0987",
  },
]

const mensagensExemplo = [
  {
    id: 1,
    tipo: "recebida" as const,
    canal: "whatsapp" as const,
    conteudo: "Bom dia! Gostaria de solicitar um orçamento para manutenção do SPDA.",
    timestamp: "09:15",
    status: "lida" as const,
  },
  {
    id: 2,
    tipo: "enviada" as const,
    canal: "whatsapp" as const,
    conteudo: "Bom dia! Claro, posso ajudar. Qual o endereço do condomínio?",
    timestamp: "09:17",
    status: "lida" as const,
  },
  {
    id: 3,
    tipo: "recebida" as const,
    canal: "email" as const,
    conteudo: "Rua das Flores, 123 - Copacabana. O prédio tem 15 andares e 60 apartamentos.",
    timestamp: "09:20",
    status: "lida" as const,
  },
  {
    id: 4,
    tipo: "enviada" as const,
    canal: "whatsapp" as const,
    conteudo: "Perfeito! Vou preparar um orçamento detalhado. Posso agendar uma vistoria técnica para amanhã às 14h?",
    timestamp: "09:25",
    status: "lida" as const,
  },
  {
    id: 5,
    tipo: "recebida" as const,
    canal: "whatsapp" as const,
    conteudo: "Sim, pode ser! Aguardo o técnico.",
    timestamp: "09:30",
    status: "lida" as const,
  },
  {
    id: 6,
    tipo: "sistema" as const,
    canal: "sistema" as const,
    conteudo: "Orçamento #2024-1523 enviado",
    timestamp: "14:30",
    status: "lida" as const,
  },
  {
    id: 7,
    tipo: "recebida" as const,
    canal: "email" as const,
    conteudo: "Obrigado pelo orçamento! Vou analisar com o síndico.",
    timestamp: "10:30",
    status: "lida" as const,
  },
]

// Alarmes de retorno
const alarmesRetorno = [
  {
    id: 1,
    cliente: "Condomínio Vista Mar",
    horario: "2025-10-28T15:00:00",
    tipo: "retorno",
    ativo: true,
  },
  {
    id: 2,
    cliente: "Edifício Copacabana Palace",
    horario: "2025-10-28T10:00:00",
    tipo: "retorno",
    ativo: true,
  },
  {
    id: 3,
    cliente: "Condomínio Leblon Premium",
    horario: "2025-10-28T09:00:00",
    tipo: "urgente",
    ativo: true,
  },
]

export function VendedorChat() {
  const [conversaSelecionada, setConversaSelecionada] = useState(conversas[1])
  const [mensagens, setMensagens] = useState(mensagensExemplo)
  const [novaMensagem, setNovaMensagem] = useState("")
  const [busca, setBusca] = useState("")
  const [mostrarAlarmes, setMostrarAlarmes] = useState(true)

  const conversasFiltradas = conversas.filter((c) => c.cliente.toLowerCase().includes(busca.toLowerCase()))

  const enviarMensagem = () => {
    if (!novaMensagem.trim()) return

    const novaMensagemObj = {
      id: mensagens.length + 1,
      tipo: "enviada" as const,
      canal: "whatsapp" as const,
      conteudo: novaMensagem,
      timestamp: new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      status: "enviada" as const,
    }

    setMensagens([...mensagens, novaMensagemObj])
    setNovaMensagem("")
  }

  const formatarHorarioRetorno = (horario: string) => {
    const data = new Date(horario)
    const hoje = new Date()
    const amanha = new Date(hoje)
    amanha.setDate(amanha.getDate() + 1)

    const isHoje = data.toDateString() === hoje.toDateString()
    const isAmanha = data.toDateString() === amanha.toDateString()

    const hora = data.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })

    if (isHoje) return `Hoje às ${hora}`
    if (isAmanha) return `Amanhã às ${hora}`
    return data.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="flex h-full gap-4 p-4">
      {/* Sidebar - Lista de Conversas */}
      <Card className="w-96 h-full flex flex-col overflow-hidden">
        <div className="p-4 border-b space-y-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Conversas</h2>
            <Button variant="ghost" size="icon" onClick={() => setMostrarAlarmes(!mostrarAlarmes)}>
              <Bell className="h-5 w-5" />
            </Button>
          </div>

          {/* Alarmes de Retorno */}
          {mostrarAlarmes && alarmesRetorno.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Retornos Agendados</span>
              </div>
              {alarmesRetorno.map((alarme) => (
                <div
                  key={alarme.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-orange-500/10 border border-orange-500/20"
                >
                  <Bell className="h-4 w-4 text-orange-500 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{alarme.cliente}</p>
                    <p className="text-xs text-muted-foreground">{formatarHorarioRetorno(alarme.horario)}</p>
                  </div>
                  {alarme.tipo === "urgente" && (
                    <Badge variant="destructive" className="text-xs">
                      Urgente
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversas..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Lista de Conversas */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversasFiltradas.map((conversa) => (
              <button
                key={conversa.id}
                onClick={() => setConversaSelecionada(conversa)}
                className={`w-full p-3 rounded-lg text-left transition-colors hover:bg-accent ${
                  conversaSelecionada.id === conversa.id ? "bg-accent" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {conversa.cliente.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-medium text-sm truncate">{conversa.cliente}</h3>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{conversa.timestamp}</span>
                    </div>

                    <div className="flex items-center gap-2 mb-1">
                      {conversa.canal === "whatsapp" ? (
                        <MessageSquare className="h-3 w-3 text-green-500" />
                      ) : (
                        <Mail className="h-3 w-3 text-blue-500" />
                      )}
                      <p className="text-sm text-muted-foreground truncate flex-1">{conversa.ultimaMensagem}</p>
                    </div>

                    <div className="flex items-center justify-between">
                      {conversa.retornoAgendado && (
                        <div className="flex items-center gap-1 text-xs text-orange-500">
                          <Clock className="h-3 w-3" />
                          <span>{formatarHorarioRetorno(conversa.retornoAgendado)}</span>
                        </div>
                      )}
                      {conversa.naoLidas > 0 && (
                        <Badge variant="default" className="h-5 min-w-5 px-1.5 text-xs">
                          {conversa.naoLidas}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </Card>

      {/* Área de Chat */}
      <Card className="flex-1 h-full flex flex-col overflow-hidden">
        {/* Header do Chat */}
        <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary">
                {conversaSelecionada.cliente.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{conversaSelecionada.cliente}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{conversaSelecionada.sindico}</span>
                <span>•</span>
                <span>{conversaSelecionada.telefone}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon">
              <Phone className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <Video className="h-5 w-5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <AgendarRetornoDialog
                  cliente={conversaSelecionada.cliente}
                  trigger={
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Agendar Retorno
                    </DropdownMenuItem>
                  }
                />
                <EnviarOrcamentoDialog
                  cliente={conversaSelecionada.cliente}
                  trigger={
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <DollarSign className="h-4 w-4 mr-2" />
                      Enviar Orçamento
                    </DropdownMenuItem>
                  }
                />
                <DropdownMenuItem>
                  <FileText className="h-4 w-4 mr-2" />
                  Ver Histórico Completo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mensagens */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {mensagens.map((msg) => {
              if (msg.tipo === "sistema") {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">{msg.conteudo}</div>
                  </div>
                )
              }

              const isEnviada = msg.tipo === "enviada"

              return (
                <div key={msg.id} className={`flex ${isEnviada ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      isEnviada ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {!isEnviada && (
                      <div className="flex items-center gap-2 mb-1">
                        {msg.canal === "whatsapp" ? (
                          <MessageSquare className="h-3 w-3 text-green-500" />
                        ) : (
                          <Mail className="h-3 w-3 text-blue-500" />
                        )}
                        <span className="text-xs opacity-70">{msg.canal === "whatsapp" ? "WhatsApp" : "Email"}</span>
                      </div>
                    )}
                    <p className="text-sm">{msg.conteudo}</p>
                    <div
                      className={`flex items-center gap-1 mt-1 justify-end ${
                        isEnviada ? "text-primary-foreground/70" : "text-muted-foreground"
                      }`}
                    >
                      <span className="text-xs">{msg.timestamp}</span>
                      {isEnviada && (
                        <>
                          {msg.status === "lida" ? (
                            <CheckCheck className="h-3 w-3 text-blue-400" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>

        {/* Input de Mensagem */}
        <div className="p-4 border-t flex-shrink-0">
          <div className="flex items-end gap-2">
            <Button variant="ghost" size="icon" className="flex-shrink-0">
              <Paperclip className="h-5 w-5" />
            </Button>

            <div className="flex-1 relative">
              <Input
                placeholder="Digite sua mensagem..."
                value={novaMensagem}
                onChange={(e) => setNovaMensagem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    enviarMensagem()
                  }
                }}
                className="pr-20"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Badge variant="outline" className="text-xs cursor-pointer hover:bg-accent">
                  <MessageSquare className="h-3 w-3 mr-1 text-green-500" />
                  WhatsApp
                </Badge>
              </div>
            </div>

            <Button onClick={enviarMensagem} size="icon" className="flex-shrink-0">
              <Send className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Mensagens são sincronizadas com WhatsApp e Email automaticamente
          </p>
        </div>
      </Card>
    </div>
  )
}
