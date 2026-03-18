
import { prisma } from "@/lib/prisma"
import { formatCnpjForDatabase } from "@/lib/cnpj"

/**
 * Cria uma solicitação de bloqueio (Confirmed=false)
 */
export async function requestUnusedCnpjBlock(cnpj: string, userId: string) {
    let formattedCnpj
    try {
        formattedCnpj = formatCnpjForDatabase(cnpj)
    } catch {
        throw new Error("CNPJ inválido")
    }

    // Verificar se já existe na lista
    const existing = await prisma.unusedCnpjs.findFirst({
        where: { cnpj: formattedCnpj }
    })

    if (existing) {
        throw new Error("CNPJ já está na lista de bloqueio")
    }

    return prisma.unusedCnpjs.create({
        data: {
            cnpj: formattedCnpj,
            confirmed: false,
            userId,
        },
    })
}

/**
 * Cancela uma solicitação de bloqueio (Remove da lista unused)
 */
export async function cancelUnusedCnpjBlock(id: number) {
    return prisma.unusedCnpjs.delete({
        where: { id }
    })
}

/**
 * Confirma o bloqueio:
 * 1. Verifica pedidos ativos do cliente.
 * 2. Se OK, apaga o cliente.
 * 3. Marca UnusedCnpj como confirmed=true.
 */
export async function confirmUnusedCnpjBlock(id: number) {
    const unusedInfos = await prisma.unusedCnpjs.findUnique({
        where: { id }
    })

    if (!unusedInfos) {
        throw new Error("Registro não encontrado")
    }

    // Buscar cliente pelo CNPJ da lista (formatado)
    // Nota: Se o CNPJ no banco do cliente estiver diferente da lista (format vs desformatado), 
    // precisariamos normalizar. Assumimos que ambos usam formatCnpjForDatabase.
    const client = await prisma.client.findUnique({
        where: { cnpj: unusedInfos.cnpj },
        include: {
            pedidos: {
                where: {
                    status: { not: "CANCELADO" }
                },
                select: { id: true, status: true }
            }
        }
    })

    if (client) {
        if (client.pedidos && client.pedidos.length > 0) {
            throw new Error(`Cliente possui ${client.pedidos.length} pedido(s) não cancelados. Não é possível bloquear.`)
        }

        // Apagar cliente
        await prisma.client.delete({
            where: { id: client.id }
        })
    }

    // Confirmar bloqueio
    return prisma.unusedCnpjs.update({
        where: { id },
        data: { confirmed: true }
    })
}
