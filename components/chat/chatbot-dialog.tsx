"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Flow = {
  id: string;
  name: string;
  engine?: "FLOW" | "AI_AGENT";
  type: "INBOUND" | "OUTBOUND";
};

type SessionResponse = {
  data: {
    id: string;
    flowId: string;
    status: string;
    flow?: Flow | null;
  } | null;
};

export function ChatbotDialog({
  open,
  onOpenChange,
  conversationId,
  conversationStatus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  conversationStatus: "open" | "resolved" | "pending";
}) {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [session, setSession] = useState<SessionResponse["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState<string>("");

  const assignableFlows = useMemo(
    () => flows.filter((flow) => flow.type === "INBOUND" && flow.engine === "AI_AGENT"),
    [flows],
  );

  const canAssign = conversationStatus === "open" && !session;


  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const [flowsRes, sessionRes] = await Promise.all([
        fetch("/api/chatbot/flows?active=true"),
        fetch(`/api/chatbot/sessions/${conversationId}`),
      ]);
      const flowsData = await flowsRes.json();
      const sessionData: SessionResponse = await sessionRes.json();
      setFlows(flowsData.data ?? []);
      setSession(sessionData.data ?? null);
    };
    load().catch((err) => {
      console.error(err);
      setError("Erro ao carregar fluxos.");
    });
  }, [open, conversationId]);

  useEffect(() => {
    if (!open) return;
    setSelectedFlowId((prev) => prev || assignableFlows[0]?.id || "");
  }, [open, assignableFlows]);

  const handleAssign = async () => {
    if (!selectedFlowId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/chatbot/sessions/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, flowId: selectedFlowId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao atribuir chatbot");
      }
      const flow = flows.find((f) => f.id === selectedFlowId) ?? null;
      setSession(payload?.data ? { ...payload.data, flow } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atribuir chatbot");
    } finally {
      setLoading(false);
    }
  };

  const handleUnassign = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/chatbot/sessions/unassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      if (!response.ok) {
        throw new Error("Erro ao desativar chatbot");
      }
      setSession(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao desativar chatbot");
    } finally {
      setLoading(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Chatbot</DialogTitle>
          <DialogDescription>Atribua um chatbot de I.A. ou desvincule o atual desta conversa.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {conversationStatus !== "open" ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Não é permitido atribuir chatbot em conversa resolvida.
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Fluxo vinculado</div>
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-foreground font-medium">
              {session?.flow?.name ?? "Nenhum fluxo vinculado"}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleUnassign} disabled={loading || !session}>
                Desvincular
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Atribuir I.A.</div>
            <Select
              value={selectedFlowId}
              onValueChange={setSelectedFlowId}
              disabled={loading || !canAssign || assignableFlows.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={assignableFlows.length === 0 ? "Nenhuma I.A. disponível" : "Selecione o fluxo"}
                />
              </SelectTrigger>
              <SelectContent>
                {assignableFlows.map((flow) => (
                  <SelectItem key={flow.id} value={flow.id}>
                    {flow.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button onClick={handleAssign} disabled={loading || !canAssign || !selectedFlowId}>
                Atribuir
              </Button>
            </div>
            {!canAssign && conversationStatus === "open" ? (
              <p className="text-xs text-muted-foreground">
                Só é possível atribuir quando não existe chatbot ativo nesta conversa.
              </p>
            ) : null}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
