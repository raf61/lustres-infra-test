import { prisma } from "../../../lib/prisma";
import type { ChatbotSession } from "../../domain/session";
import type { IChatbotSessionRepository } from "../../domain/repositories/session-repository";

export class PrismaChatbotSessionRepository implements IChatbotSessionRepository {
  async findById(id: string): Promise<ChatbotSession | null> {
    const record = await prisma.chatbotSession.findUnique({ where: { id } });
    if (!record) return null;
    return {
      id: record.id,
      conversationId: record.conversationId,
      flowId: record.flowId,
      status: record.status,
      currentStepId: record.currentStepId,
      variables: (record.variables as any) ?? {},
      lastInteractionAt: record.lastInteractionAt,
      conversationSummary: record.conversationSummary,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async findActiveByConversation(conversationId: string): Promise<ChatbotSession | null> {
    const record = await prisma.chatbotSession.findFirst({
      where: { conversationId, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
    });
    if (!record) return null;
    return {
      id: record.id,
      conversationId: record.conversationId,
      flowId: record.flowId,
      status: record.status,
      currentStepId: record.currentStepId,
      variables: (record.variables as any) ?? {},
      lastInteractionAt: record.lastInteractionAt,
      conversationSummary: record.conversationSummary,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async findLatestByConversation(conversationId: string): Promise<ChatbotSession | null> {
    const record = await prisma.chatbotSession.findFirst({
      where: { conversationId },
      orderBy: { updatedAt: "desc" },
    });
    if (!record) return null;
    return {
      id: record.id,
      conversationId: record.conversationId,
      flowId: record.flowId,
      status: record.status,
      currentStepId: record.currentStepId,
      variables: (record.variables as any) ?? {},
      lastInteractionAt: record.lastInteractionAt,
      conversationSummary: record.conversationSummary,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async pauseActiveByConversation(conversationId: string): Promise<void> {
    await prisma.chatbotSession.updateMany({
      where: { conversationId, status: "ACTIVE" },
      data: {
        status: "PAUSED",
        currentStepId: null,
        lastInteractionAt: new Date(),
      },
    });
  }

  async create(
    data: Omit<ChatbotSession, "id" | "createdAt" | "updatedAt">
  ): Promise<ChatbotSession> {
    const record = await prisma.chatbotSession.create({
      data: {
        conversationId: data.conversationId,
        flowId: data.flowId,
        status: data.status,
        currentStepId: data.currentStepId ?? null,
        variables: data.variables as any,
        lastInteractionAt: data.lastInteractionAt ?? null,
        conversationSummary: data.conversationSummary ?? null,
      },
    });
    return {
      id: record.id,
      conversationId: record.conversationId,
      flowId: record.flowId,
      status: record.status,
      currentStepId: record.currentStepId,
      variables: (record.variables as any) ?? {},
      lastInteractionAt: record.lastInteractionAt,
      conversationSummary: record.conversationSummary,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async update(id: string, data: Partial<ChatbotSession>): Promise<ChatbotSession> {
    const record = await prisma.chatbotSession.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.currentStepId !== undefined ? { currentStepId: data.currentStepId } : {}),
        ...(data.variables !== undefined ? { variables: data.variables as any } : {}),
        ...(data.lastInteractionAt !== undefined ? { lastInteractionAt: data.lastInteractionAt } : {}),
        ...(data.conversationSummary !== undefined ? { conversationSummary: data.conversationSummary } : {}),
      },
    });
    return {
      id: record.id,
      conversationId: record.conversationId,
      flowId: record.flowId,
      status: record.status,
      currentStepId: record.currentStepId,
      variables: (record.variables as any) ?? {},
      lastInteractionAt: record.lastInteractionAt,
      conversationSummary: record.conversationSummary,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
