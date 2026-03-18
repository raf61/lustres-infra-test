"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { Plus, Save, Trash2, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Flow = {
  id: string;
  name: string;
  type: "INBOUND" | "OUTBOUND";
  engine: "FLOW" | "AI_AGENT";
  active: boolean;
  definition: unknown;
};

type Inbox = {
  id: string;
  name: string;
};

type InboxDefault = {
  id: string;
  inboxId: string;
  flowId: string;
  active: boolean;
};

export default function ChatbotAdminPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [name, setName] = useState("");
  const [type, setType] = useState<"INBOUND" | "OUTBOUND">("INBOUND");
  const [engine, setEngine] = useState<"FLOW" | "AI_AGENT">("FLOW");
  const [active, setActive] = useState(true);
  const [definition, setDefinition] = useState<string>('{"steps":[]}');
  const [error, setError] = useState<string | null>(null);
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [defaults, setDefaults] = useState<InboxDefault[]>([]);
  const [selectedInboxId, setSelectedInboxId] = useState<string>("");
  const [selectedDefaultFlowId, setSelectedDefaultFlowId] = useState<string>("");
  const [defaultActive, setDefaultActive] = useState(true);
  const [defaultError, setDefaultError] = useState<string | null>(null);

  const loadFlows = async () => {
    const response = await fetch("/api/chatbot/flows");
    const data = await response.json();
    setFlows(data.data ?? []);
  };

  const loadDefaults = async () => {
    const [inboxesRes, defaultsRes] = await Promise.all([
      fetch("/api/chat/inboxes"),
      fetch("/api/chatbot/inbox-defaults"),
    ]);
    const inboxesData = await inboxesRes.json();
    const defaultsData = await defaultsRes.json();
    setInboxes(inboxesData.inboxes ?? []);
    setDefaults(defaultsData.data ?? []);
  };

  useEffect(() => {
    loadFlows().catch(console.error);
    loadDefaults().catch(console.error);
  }, []);

  useEffect(() => {
    const flow = flows.find((f) => f.id === selectedId);
    if (!flow) return;
    setName(flow.name);
    setType(flow.type);
    setEngine(flow.engine || "FLOW");
    setActive(flow.active);
    setDefinition(JSON.stringify(flow.definition ?? { steps: [] }, null, 2));
  }, [selectedId, flows]);

  useEffect(() => {
    if (!selectedInboxId) return;
    const existing = defaults.find((d) => d.inboxId === selectedInboxId);
    const inboundFlowIds = new Set(flows.filter((flow) => flow.type === "INBOUND").map((flow) => flow.id));
    const nextFlowId = existing?.flowId && inboundFlowIds.has(existing.flowId) ? existing.flowId : "";
    setSelectedDefaultFlowId(nextFlowId);
    setDefaultError(existing?.flowId && !nextFlowId ? "Apenas fluxos inbound podem ser padrão." : null);
    setDefaultActive(existing?.active ?? true);
  }, [selectedInboxId, defaults, flows]);

  const handleSave = async () => {
    setError(null);
    try {
      const parsed = JSON.parse(definition);
      let res;
      if (selectedId) {
        res = await fetch(`/api/chatbot/flows/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, type, engine, active, definition: parsed }),
        });
        if (!res.ok) throw new Error("Erro ao salvar fluxo");
        toast({ title: "Sucesso", description: "Fluxo atualizado com sucesso!" });
      } else {
        res = await fetch("/api/chatbot/flows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, type, engine, active, definition: parsed }),
        });
        if (!res.ok) throw new Error("Erro ao criar fluxo");
        const json = await res.json();
        const newFlow = json.data;
        setSelectedId(newFlow.id); // FIX: Update selectedId to prevent double creation
        toast({ title: "Sucesso", description: "Fluxo criado com sucesso!" });
      }
      await loadFlows();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(msg);
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  const handleSaveDefault = async () => {
    if (!selectedInboxId || !selectedDefaultFlowId) return;
    const selectedFlow = flows.find((flow) => flow.id === selectedDefaultFlowId);
    if (!selectedFlow || selectedFlow.type !== "INBOUND") {
      setDefaultError("Apenas fluxos inbound podem ser padrão.");
      return;
    }
    setDefaultError(null);
    try {
      const res = await fetch("/api/chatbot/inbox-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inboxId: selectedInboxId,
          flowId: selectedDefaultFlowId,
          active: defaultActive,
        }),
      });
      if (!res.ok) throw new Error("Erro ao salvar configuração");
      await loadDefaults();
      toast({ title: "Sucesso", description: "Configuração de autoassign salva!" });
    } catch (err) {
      toast({ title: "Erro", description: "Erro ao salvar", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!confirm("Tem certeza que deseja apagar este fluxo? Esta ação é irreversível e removerá as configurações de autoassign associadas.")) return;

    try {
      const res = await fetch(`/api/chatbot/flows/${selectedId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erro ao apagar fluxo");

      setSelectedId("");
      setName("");
      setType("INBOUND");
      setEngine("FLOW");
      setActive(true);
      setDefinition('{"steps":[]}');
      await loadFlows();
      await loadDefaults(); // Ensure default list is updated
      toast({ title: "Sucesso", description: "Fluxo removido com sucesso!" });
    } catch (err) {
      toast({ title: "Erro", description: "Não foi possível remover o fluxo", variant: "destructive" });
    }
  };

  const handleNew = () => {
    setSelectedId("");
    setName("");
    setType("INBOUND");
    setEngine("FLOW");
    setActive(true);
    setDefinition('{"steps":[]}');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Chatbot Flows</CardTitle>
            <CardDescription>Edite o JSON do fluxo diretamente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="w-80">
                  <SelectValue placeholder="Selecionar fluxo existente" />
                </SelectTrigger>
                <SelectContent>
                  {flows.map((flow) => (
                    <SelectItem key={flow.id} value={flow.id}>
                      <div className="flex items-center gap-2">
                        <span>{flow.name}</span>
                        <Badge variant="outline" className="text-[10px] py-0">{flow.type}</Badge>
                        {flow.engine === "AI_AGENT" && <Badge variant="default" className="text-[10px] py-0 bg-purple-600">AI</Badge>}
                        {!flow.active && <Badge variant="destructive" className="text-[10px] py-0">Inativo</Badge>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleNew} className="gap-2">
                <Plus className="h-4 w-4" /> Novo Fluxo
              </Button>
              {selectedId && (
                <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                  <CheckCircle2 className="h-4 w-4" /> Editando: {flows.find(f => f.id === selectedId)?.name}
                </div>
              )}
              {!selectedId && (
                <div className="flex items-center gap-2 text-sm text-blue-600 font-medium animate-pulse">
                  <Plus className="h-4 w-4" /> Criando novo fluxo...
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
              <Select value={type} onValueChange={(value) => setType(value as "INBOUND" | "OUTBOUND")}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INBOUND">Inbound</SelectItem>
                  <SelectItem value="OUTBOUND">Outbound</SelectItem>
                </SelectContent>
              </Select>
              <Select value={engine} onValueChange={(value) => setEngine(value as "FLOW" | "AI_AGENT")}>
                <SelectTrigger>
                  <SelectValue placeholder="Engine" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FLOW">Fluxo Normal</SelectItem>
                  <SelectItem value="AI_AGENT">AI Agent 🤖</SelectItem>
                </SelectContent>
              </Select>
              <Select value={active ? "true" : "false"} onValueChange={(value) => setActive(value === "true")}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Ativo</SelectItem>
                  <SelectItem value="false">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Textarea
              className="min-h-[320px] font-mono text-xs"
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={handleSave} className="gap-2">
                <Save className="h-4 w-4" /> {selectedId ? "Atualizar" : "Salvar Novo"}
              </Button>
              {selectedId && (
                <Button variant="destructive" onClick={handleDelete} className="gap-2">
                  <Trash2 className="h-4 w-4" /> Apagar fluxo
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Autoassign por inbox</CardTitle>
            <CardDescription>Ative/desative o chatbot automático por inbox.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Select value={selectedInboxId} onValueChange={setSelectedInboxId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a inbox" />
                </SelectTrigger>
                <SelectContent>
                  {inboxes.map((inbox) => (
                    <SelectItem key={inbox.id} value={inbox.id}>
                      {inbox.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedDefaultFlowId} onValueChange={setSelectedDefaultFlowId}>
                <SelectTrigger>
                  <SelectValue placeholder="Fluxo inbound" />
                </SelectTrigger>
                <SelectContent>
                  {flows
                    .filter((flow) => flow.type === "INBOUND")
                    .map((flow) => (
                      <SelectItem key={flow.id} value={flow.id}>
                        {flow.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Select value={defaultActive ? "true" : "false"} onValueChange={(value) => setDefaultActive(value === "true")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Ativo</SelectItem>
                  <SelectItem value="false">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {defaultError && <p className="text-xs text-red-600">{defaultError}</p>}
            <Button onClick={handleSaveDefault} disabled={!selectedInboxId || !selectedDefaultFlowId} className="gap-2">
              <Save className="h-4 w-4" /> Salvar Configuração
            </Button>

            <div className="mt-6 border-t pt-4">
              <h4 className="text-sm font-semibold mb-2">Configurações Atuais</h4>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-md p-3 space-y-2">
                {defaults.map((d) => {
                  const inbox = inboxes.find(i => i.id === d.inboxId);
                  const flow = flows.find(f => f.id === d.flowId);
                  return (
                    <div key={d.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{inbox?.name || "Inbox desconhecida"}</span>
                        <span className="text-slate-400">➔</span>
                        <span className="text-blue-600 dark:text-blue-400">{flow?.name || "Fluxo removido"}</span>
                      </div>
                      <Badge variant={d.active ? "default" : "secondary"}>
                        {d.active ? "Ativo" : "Pausado"}
                      </Badge>
                    </div>
                  );
                })}
                {defaults.length === 0 && <p className="text-xs text-slate-500 italic">Nenhuma inbox configurada ainda.</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
