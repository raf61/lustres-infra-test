import { NextResponse } from "next/server";
import { getVendedorContext } from "@/lib/vendor-dashboard";
import { prisma } from "@/lib/prisma";
import {
    createPrismaKanbanRepository,
    updateClientKanbanState,
    bulkUpdateClientKanbanState
} from "@/domain/client/kanban-state-usecase";

export async function POST(request: Request) {
    try {
        const url = new URL(request.url);
        const { vendedorId, userRole } = await getVendedorContext(url.searchParams);

        if (!vendedorId) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        }

        const body = await request.json();
        const { clientId, clientIds, code } = body;
        const targetIds = Array.isArray(clientIds) ? clientIds : (clientId ? [clientId] : []);

        if (targetIds.length === 0) {
            return NextResponse.json({ error: "clientId ou clientIds obrigatório" }, { status: 400 });
        }

        const isAdmin = userRole && ["MASTER", "ADMINISTRADOR"].includes(userRole);

        // Segurança: Verificar se todos os clientes pertencem ao vendedor (a menos que seja admin)
        if (!isAdmin) {
            const clients = await prisma.client.findMany({
                where: {
                    id: { in: targetIds },
                    vendedorId: vendedorId,
                },
                select: { id: true },
            });

            if (clients.length !== targetIds.length) {
                console.error("[Kanban Update] 403 Forbidden:", {
                    vendedorId,
                    userRole,
                    isAdmin,
                    targetIds,
                    foundCount: clients.length,
                    foundIds: clients.map(c => c.id)
                });
                return NextResponse.json({ error: "Um ou mais clientes não pertencem ao vendedor" }, { status: 403 });
            }
        }

        const repository = createPrismaKanbanRepository();

        if (Array.isArray(clientIds)) {
            await bulkUpdateClientKanbanState(repository, clientIds, code);
        } else {
            await updateClientKanbanState(repository, clientId, code);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[vendedor][kanban][update][POST]", error);
        return NextResponse.json(
            { error: "Falha ao atualizar estado do kanban" },
            { status: 500 }
        );
    }
}
