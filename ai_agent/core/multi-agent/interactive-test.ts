/**
 * ============================================================
 *  TESTE INTERATIVO DA ANA (MULTI-AGENTE) 
 * ============================================================
 * 
 * Este arquivo permite simular uma conversa real com a Ana,
 * vendo os "pensamentos" de cada especialista em tempo real.
 * 
 * As ferramentas (tools) são MOCKADAS — elas não alteram o banco
 * de dados, apenas imprimem no terminal o que fariam.
 * 
 * Para rodar:
 * npx tsx --env-file=.env ai_agent/core/multi-agent/interactive-test.ts
 * ============================================================
 */

import { multiAgentTestGraph } from "./graph.test";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import * as readline from "readline";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
});

const question = (query: string): Promise<string> => {
    return new Promise((resolve) => rl.question(query, resolve));
};

// Dados base para o teste
const clientData = {
    id: 999,
    razaoSocial: "Condomínio Edifício Horizonte",
    nomeSindico: "Ricardo Fontes",
    telefoneSindico: "11988887777",
    ultimaManutencao: "2023-11-20",
    cidade: "São Paulo",
    estado: "SP",
    // Metadados necessários para algumas tools (ex: trigger_new_outbound)
    flowId: "chatbot-flow-outbound-id",
    inboxId: "whatsapp-inbox-id"
};

const FIRST_OUTBOUND = "Olá, Ricardo. Sou aqui da Empresa Brasileira de Raios.\nMeu contato é referente à manutenção e renovação do laudo do sistema de para raios do Condomínio Edifício Horizonte. O laudo tem validade de 12 meses e o valor da manutenção é de 500 reais por torre, podendo parcelar em 5 x 100. Após a conclusão do serviço será encaminhado laudo e ART. Podemos agendar uma visita do nosso engenheiro para regularização do sistema?";

async function main() {
    console.clear();
    console.log("\x1b[1m\x1b[34m┌─────────────────────────────────────────────────────────────┐\x1b[0m");
    console.log("\x1b[1m\x1b[34m│             TESTE INTERATIVO: ANA (MULTI-AGENTE)            │\x1b[0m");
    console.log("\x1b[1m\x1b[34m└─────────────────────────────────────────────────────────────┘\x1b[0m");
    console.log("\x1b[90mInstruções: Digite como se fosse o síndico. Digite 'sair' para parar.\x1b[0m\n");

    let messages: BaseMessage[] = [new AIMessage(FIRST_OUTBOUND)];
    let summary = "";

    console.log("\x1b[32m[🤖 Ana (Outbound)]:\x1b[0m");
    console.log(`"${FIRST_OUTBOUND}"\n`);

    while (true) {
        const userInput = await question("\x1b[36m[📱 Você (Síndico)]:\x1b[0m ");

        if (userInput.toLowerCase().trim() === "sair") {
            console.log("\nSaindo...");
            rl.close();
            break;
        }

        if (!userInput.trim()) continue;

        messages.push(new HumanMessage(userInput));

        console.log("\n\x1b[90m--- Processando com Comitê de Especialistas ---\x1b[0m");
        const startTime = Date.now();

        try {
            const state = {
                messages,
                client_data: clientData,
                conversation_id: "conv-test-interactive",
                session_id: "session-test-interactive",
                summary,
                directives: {},
                usage_report: { prompt: 0, completion: 0, total: 0 }
            };

            const result = await multiAgentTestGraph.invoke(state);
            const latency = Date.now() - startTime;

            // Extrair última mensagem
            const lastMsg = result.messages[result.messages.length - 1] as AIMessage;
            messages = result.messages; // Atualiza o histórico
            summary = result.summary || summary;

            // Mostrar Pensamentos
            console.log(`\n\x1b[1m[🎯 Estratégia]:\x1b[0m ${result.directives.strategy}`);
            console.log(`\x1b[1m[🛡️  Segurança]:\x1b[0m ${result.directives.safety}`);
            console.log(`\x1b[1m[🎭 Tom]:      \x1b[0m ${result.directives.tone}`);
            console.log(`\x1b[1m[⚙️  Técnico]:  \x1b[0m ${result.directives.technical}`);

            // Resposta da Ana
            if (lastMsg.content) {
                console.log(`\n\x1b[32m[🤖 Ana Response]:\x1b[0m`);
                console.log(`"${lastMsg.content}"`);
            } else {
                console.log(`\n\x1b[33m[🤖 Ana ficou em silêncio (provável Tool Call ou Handoff)]\x1b[0m`);
            }

            // Tools (se houvesse, o graph.test já imprime no console dentro das mockTools)
            // Mas vamos reforçar aqui se houver algo no message object
            const toolCalls = (lastMsg as any).tool_calls || [];
            if (toolCalls.length > 0) {
                console.log(`\n\x1b[35m[🔧 Ferramentas Acionadas]:\x1b[0m ${toolCalls.map((t: any) => t.name).join(", ")}`);
            }

            console.log(`\x1b[90m(Latência: ${latency}ms | Tokens: ${result.usage_report.total})\x1b[0m\n`);
            console.log("\x1b[90m" + "─".repeat(60) + "\x1b[0m\n");

        } catch (err) {
            console.error("\x1b[31m[ERRO NO GRAFO]:\x1b[0m", err);
            console.log("\x1b[90m" + "─".repeat(60) + "\x1b[0m\n");
        }
    }
}

main();
