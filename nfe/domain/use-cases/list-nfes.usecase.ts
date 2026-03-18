import { prisma } from "@/lib/prisma"
import { NfeStatus } from "@prisma/client"

type ListNfesInput = {
    page?: number
    limit?: number
    status?: NfeStatus
    pedidoId?: number
}

export class ListNfesUseCase {
    async execute(input: ListNfesInput) {
        const page = input.page || 1
        const limit = input.limit || 20
        const skip = (page - 1) * limit

        const where: any = {}
        if (input.status) where.status = input.status
        if (input.pedidoId) where.pedidoId = input.pedidoId

        const [total, data] = await Promise.all([
            prisma.nfe.count({ where }),
            prisma.nfe.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    pedido: {
                        select: {
                            id: true,
                            cliente: { select: { razaoSocial: true } }
                        }
                    }
                }
            })
        ])

        return {
            data,
            meta: { total, page, limit, pages: Math.ceil(total / limit) }
        }
    }
}
