/**
 * ============================================================
 *  TOOLS MOCK — Apenas para testes interativos
 *  Nenhuma chamada ao banco/queue é feita aqui.
 *  Espelha exatamente o schema/name das tools reais.
 * ============================================================
 */
import { z } from "zod";
import { tool } from "@langchain/core/tools";

const MOCK_TAG = "\x1b[35m[MOCK]\x1b[0m";

// ─── update_syndic_data ────────────────────────────────────────
export const updateSyndicDataMock = tool(
    async (input) => {
        console.log(`\n${MOCK_TAG} \x1b[1mupdate_syndic_data\x1b[0m chamada com:`);
        console.log("  clientId      :", input.clientId);
        if (input.nomeSindico) console.log("  nomeSindico   :", input.nomeSindico);
        if (input.telefoneSindico) console.log("  telefoneSindico:", input.telefoneSindico);
        if (input.emailSindico) console.log("  emailSindico  :", input.emailSindico);
        if (input.observacao) console.log("  observacao    :", input.observacao);
        return "✅ [MOCK] Dados do síndico atualizados com sucesso.";
    },
    {
        name: "update_syndic_data",
        description: `Atualiza os dados de contato do SÍNDICO (Nome, Telefone, Email).
USE QUANDO:
- O cliente informar que o síndico mudou e passar os novos dados.
- O cliente confirmar/corrigir o nome ou telefone do síndico atual.`,
        schema: z.object({
            clientId: z.number().describe("ID do cliente"),
            nomeSindico: z.string().optional().describe("Nome completo do novo síndico"),
            telefoneSindico: z.string().optional().describe("Telefone/Celular do novo síndico (apenas DDD+número, sem +55)"),
            emailSindico: z.string().optional().describe("Email do novo síndico (se houver)"),
            observacao: z.string().optional().describe("Outras anotações sobre a troca de gestão"),
        }),
    }
);

// ─── update_maintenance_date ───────────────────────────────────
export const updateMaintenanceDateMock = tool(
    async (input) => {
        console.log(`\n${MOCK_TAG} \x1b[1mupdate_maintenance_date\x1b[0m chamada com:`);
        console.log("  clientId       :", input.clientId);
        console.log("  maintenanceDate:", input.maintenanceDate);
        return "✅ [MOCK] Data de manutenção atualizada com sucesso.";
    },
    {
        name: "update_maintenance_date",
        description: `Atualiza APENAS a data da última manutenção (laudo) do cliente.
USE QUANDO:
- O cliente confirmar que já fez o laudo e informar a data (mês/ano).
Formatos aceitos: "Janeiro 2024", "01/2024", "Maio", "Ano passado".`,
        schema: z.object({
            clientId: z.number().describe("ID do cliente"),
            maintenanceDate: z.string().describe("Data informada da manutenção (Ex: 'maio/2024', '01/24', 'ano passado')"),
        }),
    }
);

// ─── handoff_to_human ─────────────────────────────────────────
export const handoffMock = tool(
    async (input) => {
        console.log(`\n${MOCK_TAG} \x1b[1mhandoff_to_human\x1b[0m chamada com:`);
        console.log("  reason:", input.reason);
        return "✅ [MOCK] Handoff para humano realizado.";
    },
    {
        name: "handoff_to_human",
        description: `Chama um humano para assumir a conversa. SILENCIOSO — não anuncie ao cliente.
USE QUANDO: O lead aceitar agendar a visita ou pedir negociação direta.`,
        schema: z.object({
            reason: z.string().describe("Motivo do handoff (ex: 'Lead aceitou agendar visita')"),
        }),
    }
);

// ─── resolve_conversation ──────────────────────────────────────
export const resolveConversationMock = tool(
    async (input) => {
        console.log(`\n${MOCK_TAG} \x1b[1mresolve_conversation\x1b[0m chamada com:`);
        console.log("  reason:", input.reason);
        return "✅ [MOCK] Conversa encerrada/resolvida.";
    },
    {
        name: "resolve_conversation",
        description: `Encerra definitivamente a conversa. Use APENAS quando não há mais nenhuma ação possível.
Após chamar esta tool, a resposta de texto deve ser apenas [] (silêncio).`,
        schema: z.object({
            reason: z.string().describe("Motivo do encerramento"),
        }),
    }
);

// ─── trigger_new_outbound ─────────────────────────────────────
// Schema REAL: phone, name, flowId (obrigatório), inboxId (obrigatório)
// flowId e inboxId devem ser os mesmos da conversa atual (virão no client_data)
export const triggerNewOutboundMock = tool(
    async (input) => {
        console.log(`\n${MOCK_TAG} \x1b[1mtrigger_new_outbound\x1b[0m chamada com:`);
        console.log("  phone    :", input.phone);
        console.log("  name     :", input.name);
        console.log("  flowId   :", input.flowId);
        console.log("  inboxId  :", input.inboxId);
        if (input.clientId) console.log("  clientId :", input.clientId);
        if (input.templateName) console.log("  template :", input.templateName);
        return "✅ [MOCK] Novo disparo (outbound) agendado para o número informado.";
    },
    {
        name: "trigger_new_outbound",
        description: `Dispara mensagem para um NOVO número de telefone que o contato ACABOU DE INFORMAR na conversa.
IMPORTANTE: Só use quando o contato enviar explicitamente um número na mensagem.
NUNCA use com dados que já existiam. Deve ser chamada DEPOIS de update_syndic_data e resolve_conversation.
Use os mesmos flowId e inboxId que estão nos dados do cliente (client_data).`,
        schema: z.object({
            phone: z.string().describe("Telefone NOVO que o contato acabou de informar (apenas dígitos com DDD, ex: 11999999999)"),
            name: z.string().describe("Nome do novo contato ou 'Síndico' se não souber"),
            flowId: z.string().describe("ID do Chatbot Flow (use o mesmo flow atual do client_data)"),
            inboxId: z.string().describe("ID do Inbox (use o mesmo inbox atual do client_data)"),
            clientId: z.number().optional().describe("ID do Cliente (Condomínio) para vincular"),
            templateName: z.string().optional().describe("Nome do Template WhatsApp"),
            templateLanguage: z.string().optional().describe("Código do idioma (padrão: pt_BR)"),
            templateVariables: z.string().optional().describe("JSON string com variáveis do template"),
        }),
    }
);

// ─── schedule_followup ────────────────────────────────────────
// Schema REAL: datetime ISO 8601. A IA calcula a data, a tool salva.
export const scheduleFollowupMock = tool(
    async (input) => {
        console.log(`\n${MOCK_TAG} \x1b[1mschedule_followup\x1b[0m chamada com:`);
        console.log("  clientId :", input.clientId);
        console.log("  datetime :", input.datetime);
        return "✅ [MOCK] Follow-up agendado com sucesso.";
    },
    {
        name: "schedule_followup",
        description: `Agenda um retorno ou contato futuro com o cliente.
DATA E HORÁRIO ATUAL: ${new Date().toLocaleString("pt-BR")}. Use para calcular datas relativas ("semana que vem", "mês que vem", etc).`,
        schema: z.object({
            clientId: z.number().describe("ID do cliente"),
            datetime: z.string().describe("Data e hora para o agendamento em formato ISO 8601 (YYYY-MM-DDTHH:mm:ss)"),
        }),
    }
);

// ─── return_to_research ───────────────────────────────────────
// Schema REAL: só reason (optional). clientId é buscado pelo conversationId no configurable.
export const returnToResearchMock = tool(
    async (input) => {
        console.log(`\n${MOCK_TAG} \x1b[1mreturn_to_research\x1b[0m chamada com:`);
        if (input.reason) console.log("  reason:", input.reason);
        return "✅ [MOCK] Cliente devolvido para pesquisa.";
    },
    {
        name: "return_to_research",
        description: `Marca o contato para retornar ao setor de pesquisa.
USE QUANDO:
- O contato atual NÃO é o síndico.
- E o contato NÃO sabe/não tem o telefone do novo síndico.
NÃO envie clientId — a ferramenta já sabe quem é pelo contexto da conversa.`,
        schema: z.object({
            reason: z.string().optional().describe("Motivo do retorno à pesquisa (ex: contato_antigo_sem_novo_numero)"),
        }),
    }
);

// ─── Array exportado (drop-in replace de ../tools) ────────────
export const mockTools = [
    updateMaintenanceDateMock,
    updateSyndicDataMock,
    scheduleFollowupMock,
    triggerNewOutboundMock,
    handoffMock,
    resolveConversationMock,
    returnToResearchMock,
];
