import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getLoggedUserId } from "@/lib/vendor-dashboard"
import { startOfMonth, subMonths } from "date-fns"

export async function GET(request: Request) {
    try {
        const currentUserId = await getLoggedUserId()

        if (!currentUserId) {
            return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const vendorId = searchParams.get("vendedorId") || currentUserId

        const now = new Date()
        const previousMonthStart = startOfMonth(subMonths(now, 1))

        // Buscamos os logs de "RETORNADO" (envio para pesquisa) do vendedor nos últimos 2 meses
        const logs = await prisma.fichaLog.findMany({
            where: {
                userId: vendorId,
                tipo: "RETORNADO",
                createdAt: {
                    gte: previousMonthStart,
                },
            },
            include: {
                ficha: {
                    select: {
                        id: true,
                        cnpj: true,
                        razaoSocial: true,
                        cidade: true,
                        estado: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        })

        // Coletar CNPJs e buscar dados dos Clientes para garantir que usamos a info do Client
        const cnpjs = [...new Set(logs.map(l => l.ficha.cnpj).filter(Boolean))] as string[]

        const clients = await prisma.client.findMany({
            where: {
                OR: [
                    { cnpj: { in: cnpjs } },
                    { cnpj: { in: cnpjs.map(c => c.replace(/\D/g, "")) } }
                ]
            },
            select: {
                cnpj: true,
                razaoSocial: true,
                cidade: true,
                estado: true,
            }
        })

        const clientMap = new Map()
        clients.forEach(c => {
            const normal = c.cnpj.replace(/\D/g, "")
            clientMap.set(normal, c)
            clientMap.set(c.cnpj, c)
        })

        // Para cada envio, verificamos se já houve um retorno (tipo ENVIADO posterior)
        const fichasWithStatus = await Promise.all(
            logs.map(async (log) => {
                const client = clientMap.get(log.ficha.cnpj) || clientMap.get(log.ficha.cnpj.replace(/\D/g, ""))

                // Busca o primeiro log de "ENVIADO" que aconteceu DEPOIS deste log de "RETORNADO" para esta ficha
                const returnLog = await prisma.fichaLog.findFirst({
                    where: {
                        fichaId: log.fichaId,
                        tipo: "ENVIADO",
                        createdAt: {
                            gt: log.createdAt,
                        },
                    },
                    include: {
                        user: {
                            select: {
                                name: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: "asc",
                    },
                })

                return {
                    id: log.id,
                    fichaId: log.fichaId,
                    // Priorizamos o nome do Client, fallback para a Ficha
                    razaoSocial: client?.razaoSocial || log.ficha.razaoSocial || "Sem Razão Social",
                    local: client
                        ? (client.cidade ? `${client.cidade}/${client.estado || ""}` : (client.estado || "N/A"))
                        : (log.ficha.cidade ? `${log.ficha.cidade}/${log.ficha.estado || ""}` : (log.ficha.estado || "N/A")),
                    sentAt: log.createdAt.toISOString(),
                    isReturned: !!returnLog,
                    returnedAt: returnLog?.createdAt.toISOString() || null,
                    researcherName: returnLog?.user?.name || null,
                }
            })
        )

        // Agrupar por mês
        const grouped = fichasWithStatus.reduce((acc, item) => {
            const monthKey = item.sentAt.substring(0, 7) // YYYY-MM
            if (!acc[monthKey]) acc[monthKey] = []
            acc[monthKey].push(item)
            return acc
        }, {} as Record<string, typeof fichasWithStatus>)

        return NextResponse.json({ data: grouped })
    } catch (error) {
        console.error("[API_VENDEDOR_FICHAS]", error)
        return NextResponse.json({ error: "Erro ao buscar fichas" }, { status: 500 })
    }
}
