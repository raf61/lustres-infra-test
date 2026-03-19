"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useChat } from "@/lib/chat";
import { ClienteDetailDialog } from "@/components/leads/cliente-detail-dialog";
import { PropostaPdfDialog } from "@/components/chat/proposta-pdf-dialog";
import { ChatbotDialog } from "@/components/chat/chatbot-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatPhone, maskCNPJ, unmask } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  CheckCircle,
  UserPlus,
  UserMinus,
  MessageSquare,
  FileText,
  Bot,
  User,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function abbreviateRazaoSocial(value: string) {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalized.replace(/condominio( do)? edificio/gi, "Cond. Ed.");
}

function formatWhatsAppNumber(rawValue: string) {
  const digits = rawValue.trim().replace(/\D/g, "");
  if (!digits) return rawValue;
  if (digits.startsWith("55") && digits.length >= 12) {
    const localNumber = digits.slice(2);
    return `+55 ${formatPhone(localNumber)}`.trim();
  }
  return formatPhone(digits) || rawValue;
}

export function ChatHeader() {
  const {
    state,
    activeConversation,
    resolveConversation,
    associateClientToConversation,
    assignConversation,
    clearConversationMessages, 
    selectConversation, 
    loadConversations
  } = useChat();
  const { data: session } = useSession();
  const [clientDetailsId, setClientDetailsId] = useState<number | null>(null);
  const [clientDetailsOpen, setClientDetailsOpen] = useState(false);
  const [associateDialogOpen, setAssociateDialogOpen] = useState(false);
  const [associateCnpj, setAssociateCnpj] = useState("");
  const [associateError, setAssociateError] = useState<string | null>(null);
  const [isAssociating, setIsAssociating] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isUnassigning, setIsUnassigning] = useState(false);
  const [propostaDialogOpen, setPropostaDialogOpen] = useState(false);
  const [propostaSelectOpen, setPropostaSelectOpen] = useState(false);
  const [propostaClient, setPropostaClient] = useState<{ id: number; razaoSocial: string } | null>(null);
  const [chatbotDialogOpen, setChatbotDialogOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isDeletingContact, setIsDeletingContact] = useState(false);

  const contact = activeConversation?.contact;
  const contactName = contact?.name || contact?.phoneNumber || "Desconhecido";
  const initials = contactName.slice(0, 2).toUpperCase();

  const conversationClients = useMemo(
    () => (contact?.clients ?? []).map((client) => ({ id: client.id, razaoSocial: client.razaoSocial })),
    [contact?.clients],
  );

  const inboxPhoneNumber = useMemo(() => {
    const inboxId = state.filters.inboxId || activeConversation?.inboxId;
    const selected = state.inboxes?.find((inbox) => inbox.id === inboxId);
    return selected?.phoneNumber ?? activeConversation?.inbox?.phoneNumber ?? null;
  }, [state.filters.inboxId, state.inboxes, activeConversation?.inboxId, activeConversation?.inbox?.phoneNumber]);

  if (!activeConversation) return <div className="h-24 border-b border-border bg-card/50" />;

  const conversation = activeConversation;

  const handleOpenClientDetails = (clientId: number) => {
    setClientDetailsId(clientId);
    setClientDetailsOpen(true);
  };

  const handleResolve = async () => {
    if (!conversation || isResolving) return;
    setIsResolving(true);
    try { await resolveConversation(conversation.id); }
    catch (error) { console.error(error); }
    finally { setIsResolving(false); }
  };

  const handleUnassign = async () => {
    if (!conversation || isUnassigning) return;
    setIsUnassigning(true);
    try { await assignConversation(conversation.id, null); }
    catch (error) { console.error(error); }
    finally { setIsUnassigning(false); }
  };

  const handleOpenProposta = () => {
    if (conversationClients.length > 1) {
      setPropostaSelectOpen(true);
      return;
    }
    setPropostaClient(conversationClients[0] ?? null);
    setPropostaDialogOpen(true);
  };
  const handleAssociateClient = async () => {
    const rawCnpj = unmask(associateCnpj);
    if (!rawCnpj) { setAssociateError("Informe o CNPJ."); return; }
    setIsAssociating(true);
    setAssociateError(null);
    try {
      await associateClientToConversation(conversation.id, { cnpj: rawCnpj });
      setAssociateCnpj("");
      setAssociateDialogOpen(false);
    } catch (error) {
      setAssociateError(error instanceof Error ? error.message : "Falha ao associar.");
    } finally { setIsAssociating(false); }
  };


  const handleClearMessages = async () => {
    if (!conversation || isClearing) return;
    if (!confirm("Deseja realmente limpar todas as mensagens desta conversa? Esta ação é irreversível.")) return;

    setIsClearing(true);
    try {
      await clearConversationMessages(conversation.id);
      toast.success("Conversa limpa com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao limpar conversa.");
    } finally {
      setIsClearing(false);
    }
  };

  const handleDeleteContact = async () => {
    if (!contact?.id) return;
    if (!confirm(`TEM CERTEZA? Isso deletará o contato ${contactName}, todas as suas conversas, clientes vinculados e histórico permanentemente. Esta ação NÃO pode ser desfeita.`)) return;

    setIsDeletingContact(true);
    try {
      const response = await fetch(`/api/chat/contacts/${contact.id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        toast.success("Contato deletado com sucesso!");
        selectConversation(null);
        loadConversations();
      } else {
        toast.error("Erro ao deletar contato");
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao deletar contato");
    } finally {
      setIsDeletingContact(false);
    }
  };

  return (
    <div className="h-20 py-3 px-6 border-b border-border bg-card/30 backdrop-blur-md flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10 rounded-xl shadow-lg ring-1 ring-primary/20">
          <AvatarFallback className="bg-primary text-white font-bold text-xs uppercase tracking-widest">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-sm font-bold text-foreground uppercase tracking-widest leading-none">
              {contactName}
            </h2>
            {conversation.chatbotStatus === "ACTIVE" && (
              <div className="flex items-center gap-1.5 text-orange-500">
                <Bot className="h-3.5 w-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-widest">IA Ativa</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
            {contact?.phoneNumber && (
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-2.5 w-2.5 text-primary" />
                {formatWhatsAppNumber(contact.phoneNumber)}
              </span>
            )}
            <span>•</span>
            <span className="text-primary/80">{conversation.inbox?.name || "WhatsApp Business"}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {activeConversation.status === "open" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResolve}
            disabled={isResolving}
            className="h-9 px-4 text-[10px] font-bold uppercase tracking-widest text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400 border border-emerald-500/20 rounded-xl"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {isResolving ? "..." : "Resolver"}
          </Button>
        )}

        {/* Botão de detalhes do cliente */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const firstClient = conversationClients[0];
            if (firstClient) {
              handleOpenClientDetails(firstClient.id);
            } else {
              // fallback: toggle sidebar de contexto
              const sidebar = document.getElementById('chat-crm-sidebar');
              if (sidebar) {
                sidebar.classList.toggle('hidden');
                sidebar.classList.toggle('xl:flex');
              }
            }
          }}
          className={cn(
            "h-9 w-9 rounded-xl border border-border bg-card hover:bg-primary/10 transition-all",
            conversationClients.length > 0 && "border-primary/30 text-primary"
          )}
          title={conversationClients.length > 0 ? `Ver: ${conversationClients[0].razaoSocial}` : "Dados do Contato"}
        >
          <User className="h-5 w-5 text-primary" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border border-border bg-card">
              <MoreVertical className="h-5 w-5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-card border-border shadow-2xl rounded-2xl p-2">
            <DropdownMenuItem onSelect={() => setAssociateDialogOpen(true)} className="rounded-xl text-[10px] font-bold uppercase tracking-widest p-3">
              <UserPlus className="h-4 w-4 mr-3 text-primary" />
              Vincular CNPJ
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/50" />
            {conversation.assigneeId ? (
              <DropdownMenuItem onClick={handleUnassign} className="rounded-xl text-[10px] font-bold uppercase tracking-widest p-3">
                <UserMinus className="h-4 w-4 mr-3 text-red-500" />
                Remover Atendente
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={() => setChatbotDialogOpen(true)} className="rounded-xl text-[10px] font-bold uppercase tracking-widest p-3">
              <Bot className="h-4 w-4 mr-3 text-primary" />
              Configurar Bot
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/50" />
            <DropdownMenuItem
              onClick={handleClearMessages}
              disabled={isClearing}
              className="rounded-xl text-[10px] font-bold uppercase tracking-widest p-3 text-amber-500 focus:text-amber-500 focus:bg-amber-500/10"
            >
              <Trash2 className="h-4 w-4 mr-3" />
              {isClearing ? "Limpando..." : "Limpar Mensagens"}
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={handleDeleteContact}
              disabled={isDeletingContact}
              className="rounded-xl text-[10px] font-bold uppercase tracking-widest p-3 text-red-500 focus:text-red-500 focus:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4 mr-3" />
              {isDeletingContact ? "Deletando..." : "DELETAR CONTATO TOTAL"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Dialogs remain similar but with updated styling if applied via classes */}
      {clientDetailsId !== null && (
        <ClienteDetailDialog clienteId={clientDetailsId} open={clientDetailsOpen} onClose={() => setClientDetailsOpen(false)} isChat={true} />
      )}
      <Dialog open={associateDialogOpen} onOpenChange={setAssociateDialogOpen}>
        <DialogContent className="max-w-sm bg-card border-border shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-bold uppercase tracking-widest">Associar Cliente</DialogTitle>
            <DialogDescription className="text-xs font-semibold text-muted-foreground uppercase tracking-tight">Informe o CNPJ para vincular no ERP.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input placeholder="00.000.000/0001-00" value={associateCnpj} onChange={(e) => { setAssociateError(null); setAssociateCnpj(maskCNPJ(e.target.value)); }} className="bg-background border-border rounded-xl font-mono text-sm" />
            {associateError && <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">{associateError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAssociateDialogOpen(false)} className="text-[10px] font-bold uppercase tracking-widest">Cancelar</Button>
              <Button onClick={handleAssociateClient} disabled={isAssociating} className="bg-primary text-white text-[10px] font-bold uppercase tracking-widest shadow-xl kpi-glow rounded-xl">Confirmar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PropostaPdfDialog
        open={propostaDialogOpen} onOpenChange={setPropostaDialogOpen}
        defaultClient={propostaClient} defaultContactName={contact?.name ?? null}
        defaultConsultorNome={session?.user?.name ?? null} defaultConsultorCelular={inboxPhoneNumber}
      />

      {activeConversation && <ChatbotDialog open={chatbotDialogOpen} onOpenChange={setChatbotDialogOpen} conversationId={activeConversation.id} conversationStatus={activeConversation.status} />}
    </div>
  );
}
