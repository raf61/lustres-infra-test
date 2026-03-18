import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get("page") || "1", 10)
        const mes = parseInt(searchParams.get("mes") || "0", 10)
        const ano = parseInt(searchParams.get("ano") || "0", 10)
        const pageSize = 30
        const skip = (page - 1) * pageSize

        // Construir filtro de data se mes/ano fornecidos
        let dateFilter: any = {}
        if (mes > 0 && ano > 0) {
            const start = new Date(ano, mes - 1, 1)
            const end = new Date(ano, mes, 0, 23, 59, 59)
            dateFilter = {
                createdAt: {
                    gte: start,
                    lte: end
                }
            }
        }

        // 1. Encontrar todos os pedidos que tiveram ListaExtra no período
        // Filtramos pelas ListasExtras criadas no período
        const listasNoPeriodo = await prisma.listaExtra.findMany({
            where: dateFilter,
            select: {
                status: true,
                visita: {
                    select: {
                        pedidoId: true,
                        clienteId: true
                    }
                }
            }
        })

        const pedidoIds = Array.from(new Set(listasNoPeriodo.map(l => l.visita.pedidoId).filter(Boolean))) as number[]

        // Métricas
        const totalOportunidades = pedidoIds.length

        // Clientes que tiveram ao menos uma lista extra aprovada
        const clientesCondenadosIds = new Set(
            listasNoPeriodo
                .filter(l => l.status === "APROVADO")
                .map(l => l.visita.clienteId)
        )
        const totalCondenados = clientesCondenadosIds.size
        const porcentagemCondenados = totalOportunidades > 0
            ? Math.round((totalCondenados / totalOportunidades) * 100)
            : 0

        // Diferente da consulta completa, aqui pegamos apenas os pedidos que filtragem identificou
        const where = {
            id: { in: pedidoIds }
        }

        const [total, pedidos] = await prisma.$transaction([
            prisma.pedido.count({ where }),
            prisma.pedido.findMany({
                where,
                select: {
                    id: true,
                    status: true,
                    createdAt: true,
                    orcamentoId: true,
                    cliente: {
                        select: {
                            id: true,
                            razaoSocial: true,
                        },
                    },
                    visitasTecnicas: {
                        select: {
                            listaExtras: {
                                select: {
                                    status: true
                                }
                            }
                        }
                    }
                },
                orderBy: { updatedAt: "desc" },
                skip,
                take: pageSize,
            }),
        ])

        return NextResponse.json({
            data: pedidos,
            metrics: {
                totalOportunidades,
                totalCondenados,
                porcentagemCondenados
            },
            pagination: {
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            },
        })
    } catch (error) {
        console.error("[sac][historico][GET]", error)
        return NextResponse.json({ error: "Erro ao carregar histórico do SAC." }, { status: 500 })
    }
}
