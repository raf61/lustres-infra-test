"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import { chatAPI, ChatProviderAuto } from "@/lib/chat";
import { ChatbotProvider } from "@/lib/chatbot";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { formatRazaoSocial } from "@/lib/formatters";
import { ChatMiniPanel } from "./chat-mini-panel";

export type VendorChatClientRef = {
    id: number;
    cnpj: string;
    razaoSocial: string;
    nomeSindico: string | null;
    telefoneSindico: string | null;
    telefoneCondominio: string | null;
    celularCondominio: string | null;
    telefonePorteiro: string | null;
};

interface ChatLauncherContextType {
    openChatWithClient: (client: VendorChatClientRef, options?: { phone?: string; mode?: "click" | "context" }) => void;
}

const ChatLauncherContext = createContext<ChatLauncherContextType | undefined>(undefined);

export function useChatLauncher() {
    const context = useContext(ChatLauncherContext);
    if (!context) {
        throw new Error("useChatLauncher must be used within a ChatLauncherProvider");
    }
    return context;
}

export function ChatLauncherProvider({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const { toast } = useToast();

    const [chatDialogOpen, setChatDialogOpen] = useState(false);
    const [chatClient, setChatClient] = useState<VendorChatClientRef | null>(null);
    const [chatSelectedPhone, setChatSelectedPhone] = useState("");
    const [chatSelectedInbox, setChatSelectedInbox] = useState("");
    const [chatInboxes, setChatInboxes] = useState<any[]>([]);
    const [chatInboxesLoading, setChatInboxesLoading] = useState(false);
    const [chatCreating, setChatCreating] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);

    const [chatMiniOpen, setChatMiniOpen] = useState(false);
    const [chatConversationId, setChatConversationId] = useState<string | null>(null);

    const loadInboxes = useCallback(async () => {
        if (chatInboxes.length > 0) return chatInboxes;
        setChatInboxesLoading(true);
        try {
            const result = await chatAPI.listInboxes();
            setChatInboxes(result);
            if (result.length > 0 && !chatSelectedInbox) {
                setChatSelectedInbox(result[0].id);
            }
            return result;
        } catch (error) {
            console.error("Erro ao carregar inboxes:", error);
            return [];
        } finally {
            setChatInboxesLoading(false);
        }
    }, [chatInboxes.length, chatSelectedInbox]);

    const ensureConversationClientAssociation = useCallback(
        async (conversationId: string, client: VendorChatClientRef) => {
            const cnpj = client.cnpj.replace(/\D/g, "");
            if (!cnpj) return;
            try {
                // Optimization: check if already linked before Posting
                const result = await chatAPI.getConversationClients(conversationId);
                if (!result.clientIds?.includes(client.id)) {
                    await chatAPI.associateClientToConversation(conversationId, { clientId: client.id });
                }
            } catch (error) {
                console.warn("[Chat] Failed to associate client to conversation:", error);
            }
        },
        [],
    );

    const openLatestConversationIfExists = useCallback(async (client: VendorChatClientRef): Promise<boolean> => {
        try {
            const result = await chatAPI.getLatestClientConversation(client.id);
            if (result.conversation?.conversationId) {
                // Fire and forget (don't block UI)
                ensureConversationClientAssociation(result.conversation.conversationId, client).catch(console.error);
                setChatConversationId(result.conversation.conversationId);
                setChatMiniOpen(true);
                return true;
            }
            return false;
        } catch (error) {
            console.error("[Chat] Failed to fetch latest client conversation:", error);
            return false;
        }
    }, [ensureConversationClientAssociation]);

    const openChatWithClient = useCallback(async (client: VendorChatClientRef, options?: { phone?: string; mode?: "click" | "context" }) => {
        setChatClient(client);
        setChatError(null);

        // Se for modo clique, tenta buscar a última conversa (comportamento centralizado)
        if (options?.mode === "click") {
            const opened = await openLatestConversationIfExists(client);
            if (opened) return;
        }

        // Define fone padrão se não foi passado
        const phone = options?.phone || client.telefoneSindico || client.telefoneCondominio || client.celularCondominio || "";
        setChatSelectedPhone(phone);

        // Se for modo contexto ou não tiver telefone, abre o dialog de seleção
        if (options?.mode === "context" || !phone) {
            setChatDialogOpen(true);
            loadInboxes();
            return;
        }

        // Tenta abrir direto se tiver fone e for modo clique
        try {
            const inboxes = await loadInboxes();
            const inboxId = inboxes[0]?.id;
            if (!inboxId) {
                setChatDialogOpen(true);
                return;
            }

            const normalizedPhone = phone.replace(/\D/g, "");
            const fullPhone = normalizedPhone.startsWith("55") ? normalizedPhone : `55${normalizedPhone}`;

            const res = await chatAPI.createConversationIfNotExists({
                inboxId,
                phoneNumber: fullPhone,
                contactName: client.nomeSindico || client.razaoSocial,
            });

            if (res.conversationId) {
                // Fire and forget
                ensureConversationClientAssociation(res.conversationId, client).catch(console.error);
                setChatConversationId(res.conversationId);
                setChatMiniOpen(true);
            } else {
                setChatDialogOpen(true);
                setChatSelectedInbox(inboxId);
            }
        } catch (err) {
            setChatDialogOpen(true);
            loadInboxes();
        }
    }, [loadInboxes, openLatestConversationIfExists, ensureConversationClientAssociation]);

    const handleCreateClientConversation = async () => {
        if (!chatClient || !chatSelectedPhone || !chatSelectedInbox) return;

        setChatCreating(true);
        setChatError(null);
        try {
            const normalizedPhone = chatSelectedPhone.replace(/\D/g, "");
            const fullPhone = normalizedPhone.startsWith("55") ? normalizedPhone : `55${normalizedPhone}`;

            const result = await chatAPI.createClientConversation(chatClient.id, {
                inboxId: chatSelectedInbox,
                phoneNumber: fullPhone,
                contactName: chatClient.nomeSindico ?? chatClient.razaoSocial,
            });

            await ensureConversationClientAssociation(result.conversationId, chatClient);
            setChatDialogOpen(false);
            setChatConversationId(result.conversationId);
            setChatMiniOpen(true);
        } catch (error: any) {
            setChatError(error?.message || "Erro ao iniciar conversa");
        } finally {
            setChatCreating(false);
        }
    };

    const phoneOptions = chatClient ? [
        { label: "Síndico", value: chatClient.telefoneSindico },
        { label: "Condomínio", value: chatClient.telefoneCondominio },
        { label: "Celular", value: chatClient.celularCondominio },
        { label: "Porteiro", value: chatClient.telefonePorteiro },
    ].filter(p => !!p.value) : [];

    return (
        <ChatLauncherContext.Provider value={{ openChatWithClient }}>
            <ChatProviderAuto>
                <ChatbotProvider>
                    {children}

                    <Dialog open={chatDialogOpen} onOpenChange={setChatDialogOpen}>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Iniciar conversa</DialogTitle>
                                <DialogDescription>
                                    {chatClient ? formatRazaoSocial(chatClient.razaoSocial) : "Selecione o número e a inbox."}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <Label>Número</Label>
                                    <Select value={chatSelectedPhone} onValueChange={setChatSelectedPhone}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione o número" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {phoneOptions.map((opt, i) => (
                                                <SelectItem key={i} value={opt.value!}>
                                                    {opt.label}: {opt.value}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label>Canal (Inbox)</Label>
                                    <Select value={chatSelectedInbox} onValueChange={setChatSelectedInbox} disabled={chatInboxesLoading}>
                                        <SelectTrigger>
                                            <SelectValue placeholder={chatInboxesLoading ? "Carregando..." : (chatInboxes.length > 0 ? "Selecione a inbox" : "Nenhuma inbox encontrada")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {chatInboxes.map((inbox) => (
                                                <SelectItem key={inbox.id} value={inbox.id}>
                                                    {inbox.name} ({inbox.channelType})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {chatError && <p className="text-xs text-red-500 font-medium">{chatError}</p>}
                            </div>

                            <DialogFooter>
                                <Button
                                    onClick={handleCreateClientConversation}
                                    disabled={chatCreating || !chatSelectedPhone || !chatSelectedInbox}
                                    className="w-full"
                                >
                                    {chatCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Abrir conversa
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={chatMiniOpen} onOpenChange={setChatMiniOpen}>
                        <DialogContent className="sm:max-w-4xl h-[85vh] p-0 overflow-hidden">
                            {chatConversationId ? (
                                <ChatMiniPanel conversationId={chatConversationId} />
                            ) : (
                                <div className="flex h-full items-center justify-center text-sm text-muted-foreground italic">
                                    Carregando conversa...
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>

                </ChatbotProvider>
            </ChatProviderAuto>
        </ChatLauncherContext.Provider>
    );
}
