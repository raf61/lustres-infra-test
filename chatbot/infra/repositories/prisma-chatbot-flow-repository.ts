import { prisma } from "../../../lib/prisma";
import type { ChatbotFlow } from "../../domain/flow";
import type { IChatbotFlowRepository } from "../../domain/repositories/flow-repository";

export class PrismaChatbotFlowRepository implements IChatbotFlowRepository {
  async findById(id: string): Promise<ChatbotFlow | null> {
    const record = await prisma.chatbotFlow.findUnique({ where: { id } });
    if (!record) return null;
    return {
      id: record.id,
      name: record.name,
      engine: record.engine,
      type: record.type,
      active: record.active,
      inboxId: record.inboxId,
      definition: record.definition as any,
      aiConfig: record.aiConfig as any,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async list(params?: { active?: boolean; type?: string }): Promise<ChatbotFlow[]> {
    const records = await prisma.chatbotFlow.findMany({
      where: {
        ...(params?.active !== undefined ? { active: params.active } : {}),
        ...(params?.type ? { type: params.type as any } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });
    return records.map((record) => ({
      id: record.id,
      name: record.name,
      engine: record.engine,
      type: record.type,
      active: record.active,
      inboxId: record.inboxId,
      definition: record.definition as any,
      aiConfig: record.aiConfig as any,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }));
  }

  async create(
    data: Omit<ChatbotFlow, "id" | "createdAt" | "updatedAt">
  ): Promise<ChatbotFlow> {
    const record = await prisma.chatbotFlow.create({
      data: {
        name: data.name,
        engine: data.engine,
        type: data.type,
        active: data.active,
        inboxId: data.inboxId ?? null,
        definition: data.definition as any,
        aiConfig: data.aiConfig as any,
      },
    });
    return {
      id: record.id,
      name: record.name,
      engine: record.engine,
      type: record.type,
      active: record.active,
      inboxId: record.inboxId,
      definition: record.definition as any,
      aiConfig: record.aiConfig as any,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async update(
    id: string,
    data: Partial<Omit<ChatbotFlow, "id" | "createdAt" | "updatedAt">>
  ): Promise<ChatbotFlow> {
    const record = await prisma.chatbotFlow.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.engine !== undefined ? { engine: data.engine } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.inboxId !== undefined ? { inboxId: data.inboxId } : {}),
        ...(data.definition !== undefined ? { definition: data.definition as any } : {}),
        ...(data.aiConfig !== undefined ? { aiConfig: data.aiConfig as any } : {}),
      },
    });
    return {
      id: record.id,
      name: record.name,
      engine: record.engine,
      type: record.type,
      active: record.active,
      inboxId: record.inboxId,
      definition: record.definition as any,
      aiConfig: record.aiConfig as any,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async delete(id: string): Promise<void> {
    await prisma.chatbotFlow.delete({ where: { id } });
  }
}
