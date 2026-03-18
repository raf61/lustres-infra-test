import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFollowUpQueue } from "@/ai_agent/infra/queue/follow-up.queue";
import { isBusinessHour } from "@/lib/business-time";
import { FOLLOW_UP_LIMIT } from "@/ai_agent/core/follow-up/cadence";

export async function GET(request: Request) {

    // 1. Segurança: Só roda em horário comercial
    if (!isBusinessHour(new Date())) {
        return NextResponse.json({ message: "Fora do horário comercial. Pulando processamento." });
    }

    try {
        const queue = getFollowUpQueue();

        // 2. Buscar sessões de chatbot AI_AGENT ativas
        // Filtramos conversas OPEN onde o último falante fomos NÓS
        // E que têm chatbot session ativa com AI_AGENT
        const candidates = await prisma.chatbotSession.findMany({
            where: {
                status: 'ACTIVE',
                flow: {
                    engine: 'AI_AGENT'
                },
                conversation: {
                    status: 'open',
                    // 1A: Apenas conversas dos últimos 7 dias
                    lastActivityAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                        lte: new Date(Date.now() - 4 * 60 * 60 * 1000) // Pelo menos 4h de silêncio
                    },
                    // 1B: SEGURANÇA: Não pegar conversas que JÁ completaram todos os passos do follow-up e ainda estão no vácuo
                    // E também ignorar se houve um follow-up MUITO recente (evita race condition de jobs duplicados)
                    OR: [
                        { followUpControl: null },
                        {
                            followUpControl: {
                                AND: [
                                    { count: { lt: FOLLOW_UP_LIMIT } },
                                    {
                                        OR: [
                                            { lastFollowUpAt: null },
                                            { lastFollowUpAt: { lt: new Date(Date.now() - 10 * 60 * 1000) } }
                                        ]
                                    }
                                ]
                            }
                        }
                    ]
                }
            },
            select: {
                conversationId: true
            }
        });

        console.log(`[Cron FollowUp] Encontrados ${candidates.length} candidatos potenciais.`);

        // 3. Enfileirar para o Worker processar a lógica fina (business time, followUpCount, etc)
        const jobs = candidates.map(c => ({
            name: `fup-${c.conversationId}`,
            data: { conversationId: c.conversationId },
            opts: {
                jobId: `fup-exec-${c.conversationId}-${Date.now()}`, // Timestamp para garantir que o BullMQ não ignore o job se houver um antigo travado
                removeOnComplete: true
            }
        }));

        console.log(jobs)

        if (jobs.length > 0) {
            await queue.addBulk(jobs);
        }

        return NextResponse.json({
            success: true,
            candidates: candidates.length,
            message: "Jobs enfileirados com sucesso."
        });
    } catch (error) {
        console.error("[Cron FollowUp] Erro:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
