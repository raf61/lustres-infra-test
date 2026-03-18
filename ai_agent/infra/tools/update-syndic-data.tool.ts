import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { prisma } from "../../../lib/prisma";
import { AgentTelemetry } from "@/ai_agent/infra/telemetry/agent-telemetry";
import { UserNotificationService } from "../notifications/user-notification.service";
import { PrismaClientChatContactRepository } from "@/chat/infra/repositories/prisma-client-chat-contact-repository";
import { createPrismaKanbanRepository, updateClientKanbanState } from "@/domain/client/kanban-state-usecase";

/** Remove +55, espaços, traços e parênteses. Mantém apenas DDD+número. */
function sanitizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, ""); // mantém só dígitos
    // Remove prefixo 55 se o número tiver 12+ dígitos (ex: 5511999990000)
    if (digits.length >= 12 && digits.startsWith("55")) {
        return digits.slice(2);
    }
    return digits;
}

export const updateSyndicDataTool = tool(
    async (input, config) => {
        try {
            if (!input.clientId) return "Erro: Client ID é obrigatório.";

            const clientIdNum = Number(input.clientId);
            if (isNaN(clientIdNum)) {
                return `Erro: Client ID inválido ('${input.clientId}'). Deve ser um número.`;
            }

            // 1. Ler dados atuais do cliente para salvar histórico
            const currentClient = await prisma.client.findUnique({
                where: { id: clientIdNum },
                select: { nomeSindico: true, telefoneSindico: true, observacao: true }
            });

            if (!currentClient) {
                return `Erro: Cliente ID ${input.clientId} não encontrado.`;
            }

            // 2. Montar nova observação concatenando dados antigos
            let newObservation = currentClient.observacao || "";

            // Só adiciona ao histórico se tiver dados antigos relevantes para salvar
            // E se os dados novos forem diferentes dos antigos
            const hasOldData = currentClient.nomeSindico || currentClient.telefoneSindico;
            const isDifferent = (input.nomeSindico && input.nomeSindico !== currentClient.nomeSindico) ||
                (input.telefoneSindico && input.telefoneSindico !== currentClient.telefoneSindico);

            if (hasOldData && isDifferent) {
                const oldName = currentClient.nomeSindico || "N/A";
                const oldPhone = currentClient.telefoneSindico || "N/A";
                // Formato solicitado: "| [i.a] síndico antigo: nome; telefone"
                const historyEntry = ` | [i.a] Síndico anterior: ${oldName}; ${oldPhone}`;

                // Evitar duplicação excessiva se já tiver histórico parecido (opcional, mas bom)
                if (!newObservation.includes(historyEntry)) {
                    newObservation += historyEntry;
                }
            }

            // Se o input vier com observação extra, adiciona também (embora a tool foque em sindico)
            if (input.observacao) {
                newObservation += ` | ${input.observacao}`;
            }

            // 3. Atualizar dados
            const updateData: any = {
                observacao: newObservation
            };

            if (input.nomeSindico) updateData.nomeSindico = input.nomeSindico;
            if (input.telefoneSindico) updateData.telefoneSindico = sanitizePhone(input.telefoneSindico);
            if (input.emailSindico) updateData.emailSindico = input.emailSindico;

            await prisma.client.update({
                where: { id: clientIdNum },
                data: updateData,
            });

            // Usar usecase para resetar kanbanState para 0
            const kanbanRepo = createPrismaKanbanRepository(prisma);
            await updateClientKanbanState(kanbanRepo, clientIdNum, 0);

            // Registrar métrica
            const conversationId = config.configurable?.conversation_id;
            const sessionId = config.configurable?.session_id;
            if (conversationId) {
                AgentTelemetry.fireAndForget("TOOL_UPDATE_SYNDIC", conversationId, sessionId);

                // Desassociar o cliente do contato da conversa atual
                UserNotificationService.notifyResponsible(conversationId, "Dados do síndico atualizados/corrigidos. E cliente marcado para 'A fazer contato'");
                const contactRepo = new PrismaClientChatContactRepository();
                const conv = await prisma.chatConversation.findUnique({ where: { id: conversationId }, select: { contactId: true } });
                if (conv?.contactId) {
                    await contactRepo.removeLink(conv.contactId, clientIdNum);
                }

                // Notificar o vendedor responsável
            }

            console.log(`[UpdateSyndicData] Client ${clientIdNum} updated. Old data archived in observation.`);
            return "Dados do síndico atualizados com sucesso (histórico salvo).";

        } catch (error: any) {
            console.error("[UpdateSyndicData] Error:", error);
            return `Erro técnico ao atualizar síndico: ${error.message}`;
        }
    },
    {
        name: "update_syndic_data",
        description: `Atualiza os dados de contato do SÍNDICO (Nome, Telefone, Email).
Esta ferramenta AUTOMATICAMENTE salva o síndico anterior no histórico de observações.

⚠️ REGRA CRÍTICA: SÓ chame esta ferramenta se pelo menos o telefone TELEFONE.
Se o cliente passar apenas o nome sem o telefone, NÃO chame esta ferramenta.
Pergunte o telefone primeiro. 

USE QUANDO:
- O cliente informar que o síndico mudou e passar nome E telefone(ou só telefone).
- O cliente confirmar/corrigir o nome E o telefone do síndico atual.
- Isso são exemplos, mas seja inteligente. Não seja engessado.`,
        schema: z.object({
            clientId: z.number().describe("ID do cliente"),
            nomeSindico: z.string().optional().describe("Nome completo do novo síndico"),
            telefoneSindico: z.string().optional().describe("Telefone/Celular do novo síndico"),
            emailSindico: z.string().optional().describe("Email do novo síndico (se houver)"),
            observacao: z.string().optional().describe("Outras anotações sobre a troca de gestão"),
        }),
    }
);
