export type ChatbotSessionStatus = "ACTIVE" | "PAUSED" | "COMPLETED";

export type ChatbotSessionPayload = {
  id: string;
  conversationId: string;
  flowId: string;
  status: ChatbotSessionStatus;
};

export type OutboundTemplatePayload = {
  name: string;
  languageCode: string;
  components: any[];
};

export async function getActiveChatbotSession(conversationId: string): Promise<ChatbotSessionPayload | null> {
  const response = await fetch(`/api/chatbot/sessions/${conversationId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch chatbot session");
  }
  const result = await response.json();
  return result?.data ?? null;
}

export async function getOutboundFlowTemplate(flowId: string): Promise<OutboundTemplatePayload | null> {
  const response = await fetch(`/api/chatbot/flows/${flowId}/template`);
  if (!response.ok) {
    throw new Error("Failed to fetch outbound template");
  }
  const result = await response.json();
  return result?.data ?? null;
}
