
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NfeStatus } from "@prisma/client"

const ALLOWED_ROLES = ["MASTER", "ADMINISTRADOR", "FINANCEIRO", "SUPERVISOR", "SAC"]

export async function GET(request: Request) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    try {
        const { searchParams } = new URL(request.url)

        // Paginação
        const page = parseInt(searchParams.get("page") || "1")
        const limit = parseInt(searchParams.get("limit") || "20")
        const skip = (page - 1) * limit

        // Filtros
        const query = searchParams.get("query") || "" // Busca por Razão Social/Nome do Tomador
        const status = searchParams.get("status") as NfeStatus | null
        const uf = searchParams.get("uf") || ""
        const dateStart = searchParams.get("dateStart")
        const dateEnd = searchParams.get("dateEnd")

        const where: any = {}

        if (query) {
            where.OR = [
                { borrowerName: { contains: query, mode: "insensitive" } },
                { borrowerCnpj: { contains: query } },
                { number: { contains: query } }
            ]
        }

        if (status) {
            where.status = status
        }

        if (uf) {
            where.pedido = {
                cliente: {
                    estado: uf
                }
            }
        }

        if (dateStart || dateEnd) {
            where.createdAt = {}
            if (dateStart) where.createdAt.gte = new Date(dateStart)
            if (dateEnd) {
                // Ajusta fim do dia
                const end = new Date(dateEnd)
                end.setHours(23, 59, 59, 999)
                where.createdAt.lte = end
            }
        }

        const [total, nfes] = await Promise.all([
            prisma.nfe.count({ where }),
            prisma.nfe.findMany({
                where,
                include: {
                    pedido: {
                        select: {
                            id: true,
                            status: true,
                            cliente: {
                                select: {
                                    id: true,
                                    razaoSocial: true,
                                    estado: true,
                                }
                            },
                            orcamento: {
                                select: {
                                    filial: {
                                        select: {
                                            uf: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit
            })
        ])

        return NextResponse.json({
            data: nfes,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        })

    } catch (e: any) {
        console.error("[API Nfe List]", e)
        return NextResponse.json({ error: e.message || "Erro interno" }, { status: 500 })
    }
}
