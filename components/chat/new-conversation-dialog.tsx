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
      <DialogContent className="sm:max-w-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
          <DialogDescription>
            Cria contato (se não existir), vincula à inbox atual e abre uma nova conversa.
            Se o número já existir nesta inbox, você pode abrir a conversa existente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600">Número</label>
              {existingConversationId && (
                <button
                  type="button"
                  onClick={handleOpenExisting}
                  disabled={isOpening}
                  className="text-xs text-blue-600 hover:text-blue-700 disabled:text-slate-400"
                >
                  {isOpening ? "Abrindo..." : "Abrir conversa"}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="h-9 px-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-sm text-slate-600 flex items-center">
                55
              </div>
              <Input
                value={formatPhoneMask(phoneNumberDigits)}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
            {existingConversationId && (
              <p className="text-[11px] text-amber-600">
                Número já existe nesta inbox.
              </p>
            )}
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3">
            <label className="text-xs font-medium text-slate-600">Nome (opcional)</label>
            <Input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Nome do contato"
              className="mt-2"
            />
          </div>
          {formError && (
            <p className="text-xs text-red-500">{formError}</p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button
            onClick={handleCreateConversation}
            disabled={isCreating || isOpening}
          >
            {isCreating ? "Criando..." : "Criar conversa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

