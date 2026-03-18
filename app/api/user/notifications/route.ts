import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * API para gerenciar notificações do usuário logado.
 */
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true }
        });

        if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

        const notifications = await prisma.userNotification.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        return NextResponse.json(notifications);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * DELETE: Remove uma notificação específica
 */
export async function DELETE(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true }
        });

        if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        // Sem ID: remove todas as notificações do usuário
        if (!id) {
            const result = await prisma.userNotification.deleteMany({
                where: { userId: user.id }
            });
            return NextResponse.json({ success: true, deleted: result.count });
        }

        // Verificar se a notificação pertence ao usuário logado
        const notification = await prisma.userNotification.findUnique({
            where: { id }
        });

        if (!notification || notification.userId !== user?.id) {
            return NextResponse.json({ error: "Notificação não encontrada ou acesso negado" }, { status: 404 });
        }

        await prisma.userNotification.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
