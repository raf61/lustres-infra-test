/**
 * ============================================================
 *  CHAT INTERATIVO — Teste da Arquitetura Multi-Agente
 *  
 *  - Tools são MOCK (não afetam o banco de dados)
 *  - Mostra o raciocínio de cada especialista
 *  - Exibe custo total de tokens por roundtrip
 *  - Conversa começa com o primeiro outbound real da Ana
 *
 *  Para rodar:
 *    npx tsx --env-file=.env ai_agent/core/multi-agent/test.ts
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

// ─── DADOS MOCK DO CLIENTE ─────────────────────────────────────────
const initialData = {
    client_data: {
        id: 123,
        name: "Cond. Ed. Barão de Pedro Afonso",
        nomeSindico: "Soraya",
        telefoneSindico: "11999990000",
        lastMaintenance: "2024-01-15",
    },
    conversation_id: "test-conv-interactive",
    session_id: "test-session-interactive",
};

// ─── PRIMEIRA MENSAGEM: O OUTBOUND REAL ───────────────────────────
const FIRST_OUTBOUND = "Olá, Soraya. Sou aqui da Empresa Brasileira de Raios.\nMeu contato é referente à manutenção e renovação do laudo do sistema de para raios do Cond. Ed. Barão de Pedro Afonso. O laudo tem validade de 12 meses e o valor da manutenção é de 500 reais por torre, podendo parcelar em 5 x 100. Após a conclusão do serviço será encaminhado laudo e ART. Podemos agendar uma visita do nosso engenheiro para regularização do sistema?";

// ─── SEPARADORES ──────────────────────────────────────────────────
const SEP = "\x1b[90m" + "─".repeat(60) + "\x1b[0m";

async function runInteractiveTest() {
    console.clear();
    console.log("\x1b[1m\x1b[34m╔══════════════════════════════════════════════════════════╗\x1b[0m");
    console.log("\x1b[1m\x1b[34m║   CHAT INTERATIVO — ARQUITETURA MULTI-AGENTE (MOCK)      ║\x1b[0m");
    console.log("\x1b[1m\x1b[34m║   EBR — Empresa Brasileira de Raios                      ║\x1b[0m");
    console.log("\x1b[1m\x1b[34m╚══════════════════════════════════════════════════════════╝\x1b[0m\n");
    console.log("\x1b[90mDigite sua resposta como se fosse o síndico. 'sair' para encerrar.\x1b[0m");
    console.log(SEP + "\n");

    // Histórico começa com a mensagem de outbound
    let messages: BaseMessage[] = [
        new AIMessage(FIRST_OUTBOUND),
    ];

    // Exibe o outbound inicial
    console.log("\x1b[32m🤖 Ana (Outbound):\x1b[0m");
    console.log(FIRST_OUTBOUND);
    console.log("\n" + SEP);

    let totalTokensSession = 0;
    let roundtrip = 0;

    while (true) {
        const userInput = await question("\n\x1b[36m📱 Você (síndico):\x1b[0m ");

        if (userInput.toLowerCase().trim() === "sair") {
            console.log(`\n\x1b[90mEncerrando sessão. Total de tokens consumidos: \x1b[1m${totalTokensSession}\x1b[0m`);
            rl.close();
            break;
        }

        if (!userInput.trim()) continue;

        roundtrip++;
        messages.push(new HumanMessage(userInput));
        console.log(`\n\x1b[90m⏳ Processando roundtrip #${roundtrip}...\x1b[0m`);
        const startTime = Date.now();

        try {
            const state = {
                ...initialData,
                messages: messages,
                usage_report: { prompt: 0, completion: 0, total: 0 },
                directives: {},
                analysis_logs: [],
            };

            const finalState = await multiAgentTestGraph.invoke(state);
            const latencyMs = Date.now() - startTime;

            // Última mensagem da IA
            const lastMessage = finalState.messages[finalState.messages.length - 1] as AIMessage;
            messages.push(lastMessage);

            const tokens = finalState.usage_report.total;
            totalTokensSession += tokens;

            // ── RACIOCÍNIO DOS ESPECIALISTAS ──────────────────────────
            console.log("\n" + SEP);
            console.log("\x1b[1m[ 🧠 COMITÊ DE ESPECIALISTAS ]\x1b[0m");
            console.log(`  \x1b[33m🎯 ESTRATÉGIA:\x1b[0m  ${finalState.directives?.strategy ?? "—"}`);
            console.log(`  \x1b[31m🛡️  SEGURANÇA:\x1b[0m   ${finalState.directives?.safety ?? "—"}`);
            console.log(`  \x1b[35m🎭 TOM:\x1b[0m          ${finalState.directives?.tone ?? "—"}`);
            console.log(`  \x1b[36m🛠️  TÉCNICO:\x1b[0m     ${finalState.directives?.technical ?? "—"}`);

            // ── RESPOSTA DA ANA ───────────────────────────────────────
            console.log("\n\x1b[1m[ 💬 RESPOSTA DA ANA ]\x1b[0m");
            console.log(`\x1b[32m${lastMessage.content || "(sem conteúdo textual — tool chamada)"}\x1b[0m`);

            // ── TOOLS CHAMADAS ────────────────────────────────────────
            const toolCalls = (lastMessage as any)?.tool_calls ?? [];
            if (toolCalls.length > 0) {
                console.log("\n\x1b[1m[ 🔧 FERRAMENTAS CHAMADAS ]\x1b[0m");
                toolCalls.forEach((tc: any) => {
                    console.log(`  • \x1b[35m${tc.name}\x1b[0m`);
                    console.log("    Args:", JSON.stringify(tc.args, null, 2).replace(/\n/g, "\n    "));
                });
            }

            // ── PERFORMANCE ───────────────────────────────────────────
            console.log("\n\x1b[1m[ ⚡ PERFORMANCE ]\x1b[0m");
            console.log(`  ⏱️  Latência:         \x1b[1m${latencyMs}ms\x1b[0m`);
            console.log(`  🔢 Tokens roundtrip:  \x1b[1m${tokens}\x1b[0m`);
            console.log(`  📊 Tokens na sessão:  \x1b[1m${totalTokensSession}\x1b[0m`);
            console.log(SEP);

        } catch (error) {
            console.error("\n❌ Erro na execução:", error);
            console.log(SEP);
        }
    }
}

runInteractiveTest();
