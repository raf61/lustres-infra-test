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
      0: { label: "A fazer contato", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
      1: { label: "Contato feito",   color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
      2: { label: "Follow-up 1",    color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
      3: { label: "Follow-up 2",    color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
      4: { label: "Ignorado",       color: "bg-red-500/20 text-red-500 border-red-500/30" },
      5: { label: "Interessado",    color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
      6: { label: "Negociando",     color: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
      7: { label: "Venda Feita",    color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
      8: { label: "Perdido",        color: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
    };
    return stages[code] || stages[0];
  })();

  return (
    <div className="w-64 border-l border-border flex flex-col h-full bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-background/50 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold text-foreground uppercase tracking-widest">
            Dados do Contato
          </h3>
          <div className="flex items-center gap-1">
            {isBotActive && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-500">
                <Bot className="h-2.5 w-2.5" />
                <span className="text-[8px] font-bold uppercase tracking-widest">IA</span>
              </div>
            )}
            <Badge variant="outline" className={cn("px-1.5 py-0 text-[8px] font-bold uppercase tracking-widest border shrink-0", crmStatus.color)}>
               {crmStatus.label}
            </Badge>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">

          {/* Nome */}
          <div className="space-y-1">
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Nome</p>
            <p className="text-sm font-semibold text-foreground">{contactName}</p>
          </div>

          {/* Telefone */}
          {contact?.phoneNumber && (
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Phone className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-medium text-foreground">{contact.phoneNumber}</span>
            </div>
          )}

          {/* Responsável */}
          <div className="pt-1 border-t border-border/60 space-y-2">
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Responsável</p>
            {assignee ? (
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                  <User className="h-3 w-3" />
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-semibold text-foreground truncate">{assignee.name || assignee.email}</span>
                  {isBotActive && (
                    <Bot className="h-3 w-3 text-orange-500" />
                  )}
                </div>
              </div>
            ) : isBotActive ? (
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                  <Bot className="h-3 w-3 text-orange-500" />
                </div>
                <span className="text-xs font-semibold text-orange-500">I.A. Ativa</span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/50 italic">Sem responsável</p>
            )}
          </div>

          {/* Histórico de Orçamentos — mock */}
          <div className="pt-1 border-t border-border/60 space-y-2">
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
              <FileText className="h-3 w-3" /> Orçamentos
            </p>
            <div className="space-y-1.5">
              {[
                { id: "ORC #312", valor: "R$ 8.750,00", data: "Fev 2025" },
                { id: "ORC #287", valor: "R$ 3.200,00", data: "Nov 2024" },
              ].map((orc) => (
                <div key={orc.id} className="flex items-center justify-between bg-background/40 rounded-lg px-2.5 py-1.5 border border-border/50">
                  <span className="text-[10px] font-bold text-muted-foreground">{orc.id}</span>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-emerald-500">{orc.valor}</p>
                    <p className="text-[9px] text-muted-foreground/60">{orc.data}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Histórico de Pedidos — mock */}
          <div className="pt-1 border-t border-border/60 space-y-2">
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
              <ShoppingBag className="h-3 w-3" /> Pedidos
            </p>
            <div className="space-y-1.5">
              {[
                { id: "PED #8210", desc: "Lustre Cristal 8 Braços", valor: "R$ 4.250,00" },
                { id: "PED #7942", desc: "Arandela Clean LED", valor: "R$ 890,00" },
              ].map((ped) => (
                <div key={ped.id} className="bg-background/40 rounded-lg px-2.5 py-1.5 border border-border/50">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-bold text-muted-foreground">{ped.id}</span>
                    <span className="text-[10px] font-bold text-emerald-500">{ped.valor}</span>
                  </div>
                  <p className="text-[10px] text-foreground/80 truncate">{ped.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Registros */}
          <div className="pt-1 border-t border-border/60 space-y-2">
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
              <ClipboardList className="h-3 w-3" /> Registros
            </p>
            <div className="space-y-1.5">
              <div className="bg-background/40 rounded-lg px-2.5 py-1.5 border border-border/50">
                <p className="text-[10px] font-medium text-muted-foreground">Contato realizado em 14/03/2025</p>
              </div>
              <div className="bg-background/40 rounded-lg px-2.5 py-1.5 border border-border/50">
                <p className="text-[10px] font-medium text-muted-foreground">Follow-up agendado para 22/03/2025</p>
              </div>
            </div>
          </div>

          {/* Área Destrutiva */}
          <div className="pt-4 pb-2 border-t border-border/60">
            <Button 
                variant="ghost" 
                size="sm"
                className="w-full text-[9px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 uppercase font-bold tracking-widest h-8"
                onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="h-3 w-3 mr-2" />
              Deletar Contato e Histórico
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
