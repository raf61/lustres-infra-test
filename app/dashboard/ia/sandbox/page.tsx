"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Play, Send, Bot, Wrench, CheckCircle2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function IASandboxPage() {
    const [conversationId, setConversationId] = useState("xxjvgdytn9qxqo31ot8gf2cb");
    const [message, setMessage] = useState("Olá, quero atualizar o síndico para Mauricio Teste");
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<any[]>([]);

    const runTest = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/ai-agent/sandbox", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ conversationId, message })
            });

            const data = await res.json();
            if (data.error) {
                setLogs(prev => [...prev, { type: 'error', content: data.error }]);
            } else {
                setLogs(prev => [...prev, {
                    type: 'success',
                    input: message,
                    response: data.response,
                    toolLogs: data.toolLogs
                }]);
            }
        } catch (error: any) {
            setLogs(prev => [...prev, { type: 'error', content: error.message }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">IA Agent Sandbox</h1>
                    <p className="text-zinc-500">Teste as ferramentas e notificações sem precisar de Webhooks reais.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-1">
                        <CardHeader>
                            <CardTitle>Configuração do Teste</CardTitle>
                            <CardDescription>Defina o contexto da base para simular.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-zinc-500">ID da Conversa (Contexto)</label>
                                <Input
                                    value={conversationId}
                                    onChange={(e) => setConversationId(e.target.value)}
                                    placeholder="xxj..."
                                />
                                <p className="text-[10px] text-zinc-400 italic">Dica: Use um ID real de conversa do banco.</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-zinc-500">Mensagem do Cliente</label>
                                <textarea
                                    className="w-full min-h-[100px] p-3 rounded-md border border-input bg-background text-sm"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Ex: Handoff pra humano, ou mude o síndico..."
                                />
                            </div>
                            <Button
                                className="w-full gap-2"
                                onClick={runTest}
                                disabled={loading}
                            >
                                {loading ? <Play className="animate-spin h-4 w-4" /> : <Send className="h-4 w-4" />}
                                Executar Agente
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-2 min-h-[500px] flex flex-col">
                        <CardHeader className="border-b">
                            <CardTitle className="flex items-center gap-2">
                                <MessageSquare className="h-5 w-5 text-blue-500" />
                                Console de Execução
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 p-0">
                            <ScrollArea className="h-[500px] p-6">
                                {logs.length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-2 py-20">
                                        <Bot size={40} className="opacity-20" />
                                        <p className="italic">Aguardando execução...</p>
                                    </div>
                                )}
                                <div className="space-y-6">
                                    {logs.map((log, i) => (
                                        <div key={i} className="space-y-3">
                                            {log.type === 'error' ? (
                                                <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-100 text-sm">
                                                    <strong>Erro:</strong> {log.content}
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    <div className="flex justify-end">
                                                        <div className="bg-blue-100 text-blue-900 p-3 rounded-2xl rounded-tr-none max-w-[80%] text-sm shadow-sm">
                                                            {log.input}
                                                        </div>
                                                    </div>

                                                    {log.toolLogs?.map((toolCall: any, j: number) => (
                                                        <div key={j} className="bg-zinc-50 border border-zinc-200 p-4 rounded-xl space-y-2">
                                                            <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase">
                                                                <Wrench className="h-3 w-3" /> Ações da I.A.
                                                            </div>
                                                            {toolCall.tools.map((t: any, k: number) => (
                                                                <div key={k} className="flex items-center gap-2 text-sm text-indigo-600 font-mono bg-white p-2 rounded border border-indigo-100 italic">
                                                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                                    {t.name}({JSON.stringify(t.args)})
                                                                </div>
                                                            ))}
                                                            {toolCall.content && <p className="text-xs text-zinc-600 italic mt-2">{toolCall.content}</p>}
                                                        </div>
                                                    ))}

                                                    <div className="flex justify-start">
                                                        <div className="bg-white border p-3 rounded-2xl rounded-tl-none max-w-[80%] text-sm shadow-md flex items-start gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-zinc-900 flex items-center justify-center shrink-0">
                                                                <Bot className="h-4 w-4 text-white" />
                                                            </div>
                                                            <div className="whitespace-pre-wrap">
                                                                {typeof log.response === 'string'
                                                                    ? (log.response || <span className="text-zinc-400 italic">Chamada de ferramenta (sem texto)</span>)
                                                                    : JSON.stringify(log.response, null, 2)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="border-b pt-4 opacity-50" />
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
