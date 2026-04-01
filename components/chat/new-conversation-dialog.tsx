"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { chatAPI } from "@/lib/chat/api";

interface NewConversationDialogProps {
  inboxId?: string;
  openConversationById: (id: string) => Promise<void>;
  className?: string;
}

export function NewConversationDialog({
  inboxId,
  openConversationById,
  className,
}: NewConversationDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [phoneNumberDigits, setPhoneNumberDigits] = useState("");
  const [contactName, setContactName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [existingConversationId, setExistingConversationId] = useState<string | null>(null);

  const resetState = () => {
    setPhoneNumberDigits("");
    setContactName("");
    setFormError(null);
    setExistingConversationId(null);
    setIsCreating(false);
    setIsOpening(false);
  };

  const formatPhoneMask = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length === 0) return "";
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const handlePhoneChange = (value: string) => {
    let digits = value.replace(/\D/g, "");
    if (digits.startsWith("55")) {
      digits = digits.slice(2);
    }
    setPhoneNumberDigits(digits.slice(0, 11));
  };

  const handleCreateConversation = async () => {
    if (!inboxId) {
      setFormError("Selecione uma inbox antes de criar a conversa.");
      return;
    }
    if (!phoneNumberDigits.trim()) {
      setFormError("Informe o número de telefone.");
      return;
    }

    setIsCreating(true);
    setFormError(null);
    setExistingConversationId(null);

    try {
      const result = await chatAPI.createConversationIfNotExists({
        inboxId,
        phoneNumber: `55${phoneNumberDigits}`,
        contactName: contactName.trim() || undefined,
      });

      if (result.exists) {
        if (result.conversationId) {
          setExistingConversationId(result.conversationId);
        } else {
          setFormError("Número já existe nesta inbox.");
        }
        return;
      }

      if (result.created && result.conversationId) {
        await openConversationById(result.conversationId);
        setIsOpen(false);
        resetState();
      } else {
        setFormError("Não foi possível criar a conversa.");
      }
    } catch {
      setFormError("Falha ao criar conversa.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenExisting = async () => {
    if (!existingConversationId) return;
    setIsOpening(true);
    await openConversationById(existingConversationId);
    setIsOpening(false);
    setIsOpen(false);
    resetState();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) resetState();
      }}
    >
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setIsOpen(true)}
        className="h-8 text-xs font-semibold"
      >
        Nova conversa
      </Button>
      <DialogContent className="sm:max-w-md bg-card border border-border shadow-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-base font-bold uppercase tracking-widest">Nova Conversa</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Cria contato (se não existir) e abre uma nova conversa.
            Se o número já existir, você pode abrir a conversa existente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded-xl border border-border bg-background p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Número</label>
              {existingConversationId && (
                <button
                  type="button"
                  onClick={handleOpenExisting}
                  disabled={isOpening}
                  className="text-[10px] font-bold text-primary hover:text-primary/80 disabled:text-muted-foreground uppercase tracking-widest"
                >
                  {isOpening ? "Abrindo..." : "→ Abrir existente"}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="h-9 px-3 rounded-xl border border-border bg-muted text-sm text-muted-foreground flex items-center font-bold">
                +55
              </div>
              <Input
                value={formatPhoneMask(phoneNumberDigits)}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="(11) 99999-9999"
                className="rounded-xl border-border bg-card"
              />
            </div>
            {existingConversationId && (
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">
                Número já existe nesta inbox.
              </p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-background p-3 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nome (opcional)</label>
            <Input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Nome do contato"
              className="rounded-xl border-border bg-card"
            />
          </div>
          {formError && (
            <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">{formError}</p>
          )}
        </div>
        <DialogFooter className="gap-2 pt-2">
          <Button variant="ghost" onClick={() => setIsOpen(false)} className="text-[10px] font-bold uppercase tracking-widest rounded-xl">
            Cancelar
          </Button>
          <Button
            onClick={handleCreateConversation}
            disabled={isCreating || isOpening}
            className="bg-primary text-white text-[10px] font-bold uppercase tracking-widest rounded-xl shadow-lg kpi-glow"
          >
            {isCreating ? "Criando..." : "Criar conversa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

