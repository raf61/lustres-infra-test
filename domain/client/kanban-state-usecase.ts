import { prisma as globalPrisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";

export interface KanbanStateRepository {
    updateState(clientId: number, code: number): Promise<void>;
    bulkUpdateState(clientIds: number[], code: number): Promise<void>;
    resetVendorStates(vendedorId: string): Promise<void>;
    clearClientStates(clientIds: number[]): Promise<void>;
}

export const createPrismaKanbanRepository = (p?: PrismaClient | Prisma.TransactionClient): KanbanStateRepository => {
    const prisma = p || globalPrisma;
    return {
        async updateState(clientId: number, code: number) {
            await prisma.clientKanbanEstado.upsert({
                where: { clientId },
                update: { code },
                create: { clientId, code },
            });
        },

        async bulkUpdateState(clientIds: number[], code: number) {
            if (clientIds.length === 0) return;

            const operations = [
                prisma.clientKanbanEstado.deleteMany({
                    where: { clientId: { in: clientIds } },
                }),
                prisma.clientKanbanEstado.createMany({
                    data: clientIds.map((id) => ({
                        clientId: id,
                        code,
                    })),
                    skipDuplicates: true,
                }),
            ];

            // If we have $transaction (PrismaClient), use it. 
            // If not (TransactionClient), just execute sequentially.
            if ('$transaction' in prisma) {
                await (prisma as PrismaClient).$transaction(operations);
            } else {
                await operations[0];
                await operations[1];
            }
        },

        async resetVendorStates(vendedorId: string) {
            // Finds all clients assigned to the vendor that are currently visible on their dashboard
            const clients = await prisma.client.findMany({
                where: {
                    vendedorId,
                    visivelDashVendedor: true,
                },
                select: { id: true },
            });

            const clientIds = clients.map((c) => c.id);

            if (clientIds.length > 0) {
                await prisma.clientKanbanEstado.deleteMany({
                    where: {
                        clientId: { in: clientIds },
                    },
                });
            }
        },

        async clearClientStates(clientIds: number[]) {
            if (clientIds.length === 0) return;
            await prisma.clientKanbanEstado.deleteMany({
                where: { clientId: { in: clientIds } },
            });
        },
    };
};

/**
 * Usecase for updating a single client's kanban state
 */
export async function updateClientKanbanState(
    repo: KanbanStateRepository,
    clientId: number,
    code: number
) {
    const validatedCode = validateKanbanCode(code);
    await repo.updateState(clientId, validatedCode);
}

/**
 * Usecase for bulk updating kanban states
 */
export async function bulkUpdateClientKanbanState(
    repo: KanbanStateRepository,
    clientIds: number[],
    code: number
) {
    const validatedCode = validateKanbanCode(code);
    await repo.bulkUpdateState(clientIds, validatedCode);
}

/**
 * Usecase for resetting a vendor's kanban states
 */
export async function resetVendorKanbanStates(
    repo: KanbanStateRepository,
    vendedorId: string
) {
    await repo.resetVendorStates(vendedorId);
}

/**
 * Usecase for clearing specific client states
 */
export async function clearClientKanbanStates(
    repo: KanbanStateRepository,
    clientIds: number[]
) {
    await repo.clearClientStates(clientIds);
}

function validateKanbanCode(code: number): number {
    // 0: A fazer contato
    // 1: Contato feito
    // 2: Follow-up 1
    // 3: Follow-up 2
    // 4: Ignorado
    if (typeof code !== "number" || code < 0 || code > 4) {
        return 0;
    }
    return code;
}
