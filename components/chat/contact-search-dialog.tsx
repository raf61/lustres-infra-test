"use client";

import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, User, Phone, Building2 } from "lucide-react";
import { searchContacts, ContactSearchResult } from "@/lib/chat/api";
import { useChat } from "@/lib/chat/context";
import { cn } from "@/lib/utils";

interface ContactSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inboxId: string;
}

const PAGE_SIZE = 30;

function formatPhoneNumber(phone: string | null): string {
  if (!phone) return "";
  // Remove non-digits
  const digits = phone.replace(/\D/g, "");
  // Format Brazilian number
  if (digits.startsWith("55") && digits.length >= 12) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 9) {
      return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    } else if (rest.length === 8) {
      return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
  }
  return phone;
}

function abbreviateRazaoSocial(razaoSocial: string): string {
  return razaoSocial
    .replace(/condom[íi]nio\s+do\s+edif[íi]cio/gi, "Cond. Ed.")
    .replace(/condom[íi]nio\s+edif[íi]cio/gi, "Cond. Ed.")
    .replace(/condom[íi]nio/gi, "Cond.");
}

export function ContactSearchDialog({ open, onOpenChange, inboxId }: ContactSearchDialogProps) {
  const { openConversationById, state } = useChat();
  
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<ContactSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [loadingContactId, setLoadingContactId] = useState<string | null>(null);

  const handleSearch = useCallback(async (resetPage = true) => {
    if (!query.trim()) return;
    
    const currentPage = resetPage ? 1 : page;
    
    setIsLoading(true);
    try {
      const result = await searchContacts({
        query: query.trim(),
        inboxId,
        page: currentPage,
        pageSize: PAGE_SIZE,
      });
      
      if (resetPage) {
        setContacts(result.contacts);
        setPage(1);
      } else {
        setContacts((prev) => [...prev, ...result.contacts]);
      }
      
      setHasMore(result.hasMore);
      setTotal(result.total);
      setHasSearched(true);
    } catch (error) {
      console.error("[ContactSearch] Error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [query, inboxId, page]);

  const handleLoadMore = useCallback(() => {
    setPage((p) => p + 1);
    handleSearch(false);
  }, [handleSearch]);

  const handleSelectContact = useCallback(async (contact: ContactSearchResult) => {
    if (!contact.phoneNumber) return;
    
    setLoadingContactId(contact.contactId);
    
    try {
      // Buscar ou criar a conversa para este contato nesta inbox
      const response = await fetch("/api/chat/conversations/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inboxId,
          contactId: contact.contactId,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Erro ao abrir conversa");
      }
      
      const data = await response.json();
      const conversationId = data.conversationId;
      
      // Abrir a conversa
      await openConversationById(conversationId);
      
      // Fechar o dialog
      onOpenChange(false);
    } catch (error) {
      console.error("[ContactSearch] Error opening conversation:", error);
    } finally {
      setLoadingContactId(null);
    }
  }, [inboxId, openConversationById, onOpenChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleSearch(true);
    }
  }, [handleSearch, isLoading]);

  const handleClose = useCallback((open: boolean) => {
    if (!open) {
      // Reset state when closing
      setQuery("");
      setContacts([]);
      setHasSearched(false);
      setPage(1);
      setHasMore(false);
      setTotal(0);
    }
    onOpenChange(open);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Buscar Contatos
          </DialogTitle>
        </DialogHeader>
        
        {/* Search input */}
        <div className="flex gap-2">
          <Input
            placeholder="Telefone, nome do contato ou empresa..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
            autoFocus
          />
          <Button 
            onClick={() => handleSearch(true)} 
            disabled={isLoading || !query.trim()}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {/* Results */}
        <div className="flex-1 min-h-0 overflow-y-auto mt-4">
          {!hasSearched ? (
            <div className="text-center text-muted-foreground py-8">
              Digite algo e clique em buscar
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Nenhum contato encontrado
            </div>
          ) : (
            <div className="space-y-2">
              {/* Results count */}
              <div className="text-xs text-muted-foreground px-1">
                {total} contato{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
              </div>
              
              {/* Contact list */}
              {contacts.map((contact) => (
                <button
                  key={contact.contactId}
                  onClick={() => handleSelectContact(contact)}
                  disabled={loadingContactId === contact.contactId}
                  className={cn(
                    "w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors",
                    "hover:bg-accent hover:border-accent-foreground/20",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={contact.avatarUrl || undefined} />
                    <AvatarFallback>
                      <User className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    {/* Name and phone */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">
                        {contact.contactName || "Sem nome"}
                      </span>
                      {contact.phoneNumber && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {formatPhoneNumber(contact.phoneNumber)}
                        </span>
                      )}
                    </div>
                    
                    {/* Associated clients */}
                    {contact.associatedClients.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {contact.associatedClients.map((client) => (
                          <Badge 
                            key={client.clientId} 
                            variant="secondary" 
                            className="text-xs py-0 px-1.5 flex items-center gap-1"
                          >
                            <Building2 className="h-3 w-3" />
                            {abbreviateRazaoSocial(client.razaoSocial)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {loadingContactId === contact.contactId && (
                    <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                  )}
                </button>
              ))}
              
              {/* Load more button */}
              {hasMore && (
                <Button
                  variant="outline"
                  className="w-full mt-2"
                  onClick={handleLoadMore}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Ver mais
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

