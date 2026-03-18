import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { makeClientVisibleInDashboard } from "@/domain/client/vendor-dashboard-rules"
import type { ClientCategoria } from "@/domain/client/category-rules"
import { auth } from "@/auth"

type RouteParams = {
    id?: string
}

type RouteContext = {
    params?: RouteParams | Promise<RouteParams>
}

const isPromise = (value: unknown): value is Promise<unknown> =>
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as Promise<unknown>).then === "function"

export async function GET(
    request: Request,
    context: RouteContext = {}
) {
    const session = await auth()
    const userRole = session?.user?.role

    if (userRole !== "MASTER" && userRole !== "ADMINISTRADOR") {
        return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
    }

    const rawParams = context.params
    const params = isPromise(rawParams) ? await rawParams : rawParams

    const idParam = params?.id

    if (!idParam) {
        return NextResponse.json({ error: "ID não informado" }, { status: 400 })
    }

    const clientId = Number.parseInt(idParam, 10)

    if (Number.isNaN(clientId)) {
        return NextResponse.json({ error: "ID inválido" }, { status: 400 })
    }

    try {
        const client = await prisma.client.findUnique({
            where: { id: clientId },
            select: {
                visivelDashVendedor: true,
                vendedorId: true,
            },
        })

        if (!client) {
            return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 })
        }

        return NextResponse.json({
            isVisible: client.visivelDashVendedor,
            hasVendor: !!client.vendedorId,
        })
    } catch (error) {
        console.error(`Erro ao buscar visibilidade do cliente ${clientId}:`, error)
        return NextResponse.json(
            { error: "Erro ao buscar visibilidade." },
            { status: 500 }
        )
    }
}

export async function POST(
    request: Request,
    context: RouteContext = {}
) {
    const session = await auth()
    const userRole = session?.user?.role

    if (userRole !== "MASTER" && userRole !== "ADMINISTRADOR") {
        return NextResponse.json({ error: "Acesso negado." }, { status: 403 })
    }

    const rawParams = context.params
    const params = isPromise(rawParams) ? await rawParams : rawParams

    const idParam = params?.id

    if (!idParam) {
        return NextResponse.json({ error: "ID não informado" }, { status: 400 })
    }

    const clientId = Number.parseInt(idParam, 10)

    if (Number.isNaN(clientId)) {
        return NextResponse.json({ error: "ID inválido" }, { status: 400 })
    }

    try {
        const client = await prisma.client.findUnique({
            where: { id: clientId },
            select: {
                id: true,
                vendedorId: true,
                visivelDashVendedor: true,
                categoria: true,
            },
        })

        if (!client) {
            return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 })
        }

        if (!client.vendedorId) {
            return NextResponse.json(
                { error: "Cliente não possui vendedor associado." },
                { status: 400 }
            )
        }

        if (client.visivelDashVendedor) {
            return NextResponse.json({ success: true, message: "Cliente já estava visível." })
        }

        await makeClientVisibleInDashboard(prisma, {
            clientId: client.id,
            vendedorId: client.vendedorId,
            category: (client.categoria as ClientCategoria) || "EXPLORADO",
            reason: "Ativação manual via botão visualizar (Dashboard)",
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error(`Erro ao ativar visibilidade do cliente ${clientId}:`, error)
        return NextResponse.json(
            { error: "Erro ao ativar visibilidade." },
            { status: 500 }
        )
    }
}
