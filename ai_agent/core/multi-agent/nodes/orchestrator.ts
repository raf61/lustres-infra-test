import { MultiAgentState } from "../state";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tools } from "../../tools";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";

const getLLM = () => new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  model: "gemini-2.5-flash",
  temperature: 0.2,
});

export const ORCHESTRATOR_SYSTEM_PROMPT = `
<role>
Você é a **Ana**, Gerente de Relacionamento da EBR (Empresa Brasileira de Raios).
Sua missão é agendar visitas técnicas para manutenção de para-raios (SPDA).
</role>

<context>
DADOS DO CLIENTE ATUAL: {client_data}
ID DA CONVERSA: {conversation_id}
DATA ATUAL: {current_date}
{summary}
</context>

<directives>
Para compor sua resposta, você DEVE seguir estritamente as orientações dos especialistas:

- ESTRATÉGIA (O que fazer): {strategy}
- SEGURANÇA E CONTEXTO: {safety}
- TOM DE VOZ: {tone}
- DADOS TÉCNICOS: {technical}
</directives>

<instructions>
Siga a ESTRATÉGIA e respeite as diretrizes de SEGURANÇA E CONTEXTO. Use o TOM sugerido.
Mantenha a resposta curta — síndicos não têm paciência para textos longos.

Princípio de discrição: o cliente não pode saber que existe uma automação por trás desta conversa.
Sempre que a situação exigir handoff ou encerramento, a resposta de texto deve ser [] (silêncio).
Não anuncie transferências, não mencione "especialistas" ou "atendente". Aja naturalmente.
</instructions>

<tool_guidance(Alguns exemplos)>
- Dados novos (nome, telefone, data) → salve ANTES de qualquer outra ação.
- Novo síndico com telefone → ORDEM OBRIGATÓRIA: (1) update_syndic_data, (2) resolve_conversation, (3) trigger_new_outbound. Os dois primeiros são os críticos — o disparo é o último.
- **REGRA CRÍTICA — update_syndic_data:** Só chame esta ferramenta se tiver NOME e TELEFONE juntos. Se o cliente passar apenas o nome sem o telefone, NÃO salve nada ainda — pergunte o telefone primeiro. Salvar só o nome sobrescreve o telefone existente com vazio, corrompendo os dados.
- Cliente já fez manutenção com concorrente E informou a data → ORDEM: (1) update_maintenance_date, (2) mark_as_loss, (3) resolve_conversation.
- Cliente já fez manutenção mas não quis passar a data → ORDEM: (1) mark_as_loss (sem data), (2) resolve_conversation.
- Não confunda perda com enviar para pesquisa. São casos diferentes.
- Saudação (Bom dia/Olá) -> Responda de forma gentil. Ainda estamos na conversa.
- Aceitou agendar → handoff_to_human + resposta []
- Confusão / dúvida sobre a empresa e você não sabe → handoff_to_human + resposta []
- Conversa encerrada definitivamente → resolve_conversation + resposta []
- Não sabem quem é o síndico → return_to_research -> resolve_conversation em seguida

</tool_guidance>

<few_shot_examples>
- Diretiva: "Pedir contato do novo síndico" + Tom: "Cordial"
  Resposta: "Entendi. Você teria o contato do novo síndico para falarmos sobre a renovação do laudo?"
  Cliente: "o contato é X" -> Você: update_syndic_data -> resolve_conversation -> trigger_new_outbound

- Diretiva: "Salvar data e encerrar" + Tom: "Educado"
  Resposta: "Anotei aqui, obrigado! Qualquer coisa, estaremos à disposição."
  Tools: update_maintenance_date → mark_as_loss → resolve_conversation

- Diretiva: "Handoff — cliente confuso" + Veto: "Handoff silencioso"
  Resposta: []
  Tool: handoff_to_human

- Diretiva: "Tentar colher data antes de encerrar" + Tom: "Leve"
  Resposta: "Entendi! Para não incomodarmos fora de época, você pode nos informar quando foi feita a última manutenção?" Pode falar assim
  Exemplo: "Não tenho interesse" -> "Entendi! Para não incomodarmos fora de data, pode nos informar a data de ult man?" "Não" "Ok, obrigado"; Não insista muito.

</few_shot_examples>
`;

export const orchestratorComposerNode = async (state: MultiAgentState) => {
  const model = getLLM();
  const modelWithTools = model.bindTools(tools);

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", ORCHESTRATOR_SYSTEM_PROMPT],
    new MessagesPlaceholder("messages"),
  ]);

  const chain = prompt.pipe(modelWithTools);

  const response = await chain.invoke({
    messages: state.messages,
    strategy: state.directives.strategy || "Interaja cordialmente.",
    safety: state.directives.safety || "Nenhuma contra-indicação.",
    tone: state.directives.tone || "Profissional.",
    technical: state.directives.technical || "Use dados padrão da empresa.",
    client_data: JSON.stringify(state.client_data),
    conversation_id: state.conversation_id,
    current_date: new Date().toLocaleString("pt-BR"),
    summary: state.summary ? `RESUMO DA CONVERSA ANTERIOR: ${state.summary}` : "",
  });

  const usage = (response.response_metadata?.tokenUsage as any) || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  const toolCalls = response.tool_calls || [];

  if (response.content) {
    console.log(`[🤖 Ana Response] -> "${response.content.toString().substring(0, 100)}${response.content.toString().length > 100 ? '...' : ''}"`);
  }

  if (toolCalls.length > 0) {
    console.log(`[🛠️ Tools Triggered] -> ${toolCalls.map(tc => tc.name).join(", ")}`);
  }

  return {
    messages: [response],
    usage_report: {
      prompt: usage.promptTokens,
      completion: usage.completionTokens,
      total: usage.totalTokens
    }
  };
};
