import { prisma } from "../../../lib/prisma";
import type { ChatbotPathEvent } from "../../domain/path-event";
import type { IChatbotPathEventRepository } from "../../domain/repositories/path-event-repository";

export class PrismaChatbotPathEventRepository implements IChatbotPathEventRepository {
  async create(event: Omit<ChatbotPathEvent, "id" | "createdAt">): Promise<ChatbotPathEvent> {
    const record = await prisma.chatbotPathEvent.create({
      data: {
        sessionId: event.sessionId,
        stepId: event.stepId ?? null,
        eventType: event.eventType,
        payload: event.payload as any,
      },
    });
    return {
      id: record.id,
      sessionId: record.sessionId,
      stepId: record.stepId,
      eventType: record.eventType,
      payload: (record.payload as any) ?? {},
      createdAt: record.createdAt,
    };
  }

  async listBySession(sessionId: string): Promise<ChatbotPathEvent[]> {
    const records = await prisma.chatbotPathEvent.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    });
    return records.map((record) => ({
      id: record.id,
      sessionId: record.sessionId,
      stepId: record.stepId,
      eventType: record.eventType,
      payload: (record.payload as any) ?? {},
      createdAt: record.createdAt,
    }));
  }

  async countByFlow(flowId: string): Promise<number> {
    return prisma.chatbotPathEvent.count({
      where: { session: { flowId } },
    });
  }
}
