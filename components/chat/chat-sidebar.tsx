"use client";

import { useChat } from "@/lib/chat";
import { Phone, ShoppingBag, FileText, User, Bot, ClipboardList, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";

export function ChatSidebar() {
  const { activeConversation, selectConversation, loadConversations } = useChat();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!activeConversation) return null;

  const contact = activeConversation.contact;
  const assignee = activeConversation.assignee;
  const isBotActive = activeConversation.chatbotStatus === "ACTIVE";

  const contactName =
    contact?.name ||
    contact?.clients?.[0]?.nomeSindico ||
    contact?.clients?.[0]?.razaoSocial ||
    "Desconhecido";

  const handleDeleteContact = async () => {
    if (!contact?.id) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/chat/contacts/${contact.id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();

      if (response.ok) {
        toast.success("Contato e histórico deletados com sucesso!");
        selectConversation(null);
        loadConversations();
      } else {
        toast.error(data.error || "Erro ao deletar contato");
      }
    } catch (error) {
       console.error("Delete error:", error);
       toast.error("Erro na conexão ao deletar contato");
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  }

  const crmStatus = (() => {
    const client = contact?.clients?.[0];
    const code = (client as any)?.kanbanEstado?.code ?? 0;
    const stages: Record<number, { label: string, color: string }> = {
      0: { label: "A fazer contato", color: "bg-slate-100 text-slate-600 border-slate-200" },
      1: { label: "Contato feito",   color: "bg-blue-100 text-blue-700 border-blue-200" },
      2: { label: "Follow-up 1",    color: "bg-amber-100 text-amber-700 border-amber-200" },
      3: { label: "Follow-up 2",    color: "bg-orange-100 text-orange-700 border-orange-200" },
      4: { label: "Ignorado",       color: "bg-red-100 text-red-700 border-red-200" },
      5: { label: "Interessado",    color: "bg-purple-100 text-purple-700 border-purple-200" },
      6: { label: "Negociando",     color: "bg-sky-100 text-sky-700 border-sky-200" },
      7: { label: "Venda Feita",    color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
      8: { label: "Perdido",        color: "bg-rose-100 text-rose-700 border-rose-200" },
    };
    return stages[code] || stages[0];
  })();

  return (
    <div className="w-64 border-l border-border flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-foreground">Detalhes</h3>
          <div className="flex items-center gap-1.5">
            {isBotActive && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-500">
                <Bot className="h-3 w-3" />
                IA
              </span>
            )}
            <span className={cn("text-[11px] font-medium px-1.5 py-0.5 rounded border", crmStatus.color)}>
              {crmStatus.label}
            </span>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">

          {/* Nome */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground mb-0.5">Nome</p>
            <p className="text-[13px] font-semibold text-foreground">{contactName}</p>
          </div>

          {/* Telefone */}
          {contact?.phoneNumber && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground mb-0.5">Telefone</p>
              <div className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-[13px] text-foreground">{contact.phoneNumber}</span>
              </div>
            </div>
          )}

          {/* Responsável */}
          <div className="pt-3 border-t border-border/50">
            <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Responsável</p>
            {assignee ? (
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-3 w-3 text-primary" />
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[13px] font-medium text-foreground truncate">{assignee.name || assignee.email}</span>
                  {isBotActive && <Bot className="h-3 w-3 text-orange-500" />}
                </div>
              </div>
            ) : isBotActive ? (
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                  <Bot className="h-3 w-3 text-orange-500" />
                </div>
                <span className="text-[13px] font-medium text-orange-500">I.A. Ativa</span>
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground/60 italic">Sem responsável</p>
            )}
          </div>

          {/* Orçamentos */}
          <div className="pt-3 border-t border-border/50 space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Orçamentos
            </p>
            <div className="space-y-1.5">
              {[
                { id: "ORC #312", valor: "R$ 8.750,00", data: "Fev 2025" },
                { id: "ORC #287", valor: "R$ 3.200,00", data: "Nov 2024" },
              ].map((orc) => (
                <div key={orc.id} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
                  <span className="text-[12px] text-foreground/70">{orc.id}</span>
                  <div className="text-right">
                    <p className="text-[12px] font-semibold text-emerald-600">{orc.valor}</p>
                    <p className="text-[10px] text-muted-foreground">{orc.data}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pedidos */}
          <div className="pt-3 border-t border-border/50 space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <ShoppingBag className="h-3.5 w-3.5" /> Pedidos
            </p>
            <div className="space-y-1.5">
              {[
                { id: "PED #8210", desc: "Lustre Cristal 8 Braços", valor: "R$ 4.250,00" },
                { id: "PED #7942", desc: "Arandela Clean LED", valor: "R$ 890,00" },
              ].map((ped) => (
                <div key={ped.id} className="bg-muted/40 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[12px] text-foreground/70">{ped.id}</span>
                    <span className="text-[12px] font-semibold text-emerald-600">{ped.valor}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{ped.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Registros */}
          <div className="pt-3 border-t border-border/50 space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" /> Registros
            </p>
            <div className="space-y-1.5">
              <div className="bg-muted/40 rounded-lg px-3 py-2">
                <p className="text-[12px] text-foreground/70">Contato realizado em 14/03/2025</p>
              </div>
              <div className="bg-muted/40 rounded-lg px-3 py-2">
                <p className="text-[12px] text-foreground/70">Follow-up agendado para 22/03/2025</p>
              </div>
            </div>
          </div>

          {/* Área Destrutiva */}
          <div className="pt-4 pb-2 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-red-50 h-8 rounded-lg"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Deletar contato e histórico
            </Button>
          </div>

        </div>
      </ScrollArea>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar permanentemente o contato <strong>{contactName}</strong>? 
              <br /><br />
              Isso apagará:
              <ul className="list-disc list-inside mt-2 text-sm">
                <li>Todo o histórico de mensagens</li>
                <li>O vínculo com os clientes cadastrados</li>
                <li>Todas as sessões de I.A. ativas</li>
              </ul>
              <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-lg border border-destructive/20 text-xs font-semibold">
                ESTA AÇÃO NÃO PODE SER DESFEITA.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                handleDeleteContact();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deletando...
                </>
              ) : (
                "Sim, Deletar Tudo"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
