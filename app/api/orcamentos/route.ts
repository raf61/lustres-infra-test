import { NextResponse } from "next/server"
import { OrcamentoStatus, Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getLoggedUserId } from "@/lib/vendor-dashboard"
import { resolveFilialId } from "./filial-map"
import { parseDateOnlySafe } from "@/lib/date-utils"

type OrcamentoItemInput = {
  itemId: string | number
  quantidade: number
  valor?: number
}

type CreateOrcamentoPayload = {
  clienteId: number
  itens: OrcamentoItemInput[]
  parcelas?: number | null
  primeiroVencimento?: string | null
  garantiaMeses?: number | null
  observacoes?: string | null
  empresaId?: number | null
}

const toPositiveInt = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : null
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) || parsed <= 0 ? null : parsed
  }
  return null
}

const sanitizeMoney = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Number.parseFloat(value.toFixed(2))
  }
  if (typeof value === "string") {
    const numeric = Number.parseFloat(value.replace(",", "."))
    if (!Number.isNaN(numeric) && numeric >= 0) {
      return Number.parseFloat(numeric.toFixed(2))
    }
  }
  return null
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateOrcamentoPayload
    const clienteId = Number.parseInt(String(body.clienteId), 10)

    if (Number.isNaN(clienteId)) {
      return NextResponse.json({ error: "Cliente inválido." }, { status: 400 })
    }

    if (!Array.isArray(body.itens) || body.itens.length === 0) {
      return NextResponse.json({ error: "Adicione ao menos um produto/serviço." }, { status: 400 })
    }

    const normalizedItems = body.itens.map((item) => {
      const quantidade = toPositiveInt(item.quantidade)
      if (!quantidade) {
        throw new Error("Quantidade inválida para um dos itens.")
      }
      const valor = sanitizeMoney(item.valor)
      return {
        rawItemId: item.itemId,
        quantidade,
        valor,
      }
    })

    const itemIds = normalizedItems.map((item) => {
      try {
        return BigInt(item.rawItemId)
      } catch {
        throw new Error("Produto/serviço inválido.")
      }
    })

    const cliente = await prisma.client.findUnique({
      where: { id: clienteId },
      select: { id: true, vendedorId: true, estado: true },
    })

    if (!cliente) {
      return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 })
    }

    const itensFromDb = await prisma.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, nome: true, valor: true },
    })

    if (itensFromDb.length !== itemIds.length) {
      return NextResponse.json({ error: "Há itens inválidos na solicitação." }, { status: 400 })
    }

    const itensMap = new Map(itensFromDb.map((item) => [item.id.toString(), item]))

    const itensPayload = normalizedItems.map((item, index) => {
      const dbItem = itensMap.get(itemIds[index].toString())
      if (!dbItem) {
        throw new Error("Produto não encontrado.")
      }

      return {
        itemId: dbItem.id,
        nome: dbItem.nome,
        quantidade: item.quantidade,
        valor: item.valor ?? dbItem.valor,
      }
    })

    const parcelas = toPositiveInt(body.parcelas ?? null)
    const garantiaMeses = toPositiveInt(body.garantiaMeses ?? null)
    const empresaId = body.empresaId ? Number.parseInt(String(body.empresaId), 10) : 1
    const primeiroVencimentoDate = parseDateOnlySafe(body.primeiroVencimento)

    if (body.primeiroVencimento && body.primeiroVencimento.trim().length > 0 && !primeiroVencimentoDate) {
      return NextResponse.json({ error: "Data do 1º vencimento inválida." }, { status: 400 })
    }

    const observacoesParts: string[] = []

    if (body.observacoes && body.observacoes.trim().length > 0) {
      observacoesParts.push(body.observacoes.trim())
    }
    const observacoes = observacoesParts.length > 0 ? observacoesParts.join(" | ") : null

    const total = itensPayload.reduce((acc, item) => acc + item.valor * item.quantidade, 0)

    // Obtém o ID do usuário atual (pode não ser vendedor)
    const currentUserId = await getLoggedUserId()

    if (!currentUserId) {
      return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 })
    }

    const createdBudget = await prisma.$transaction(async (tx) => {
      const filialId = await resolveFilialId(tx, Number.isNaN(empresaId) ? 1 : empresaId, cliente.estado ?? null)

      const novoOrcamento = await tx.orcamento.create({
        data: {
          clienteId,
          vendedorId: currentUserId,
          status: OrcamentoStatus.EM_ABERTO,
          parcelas,
          primeiroVencimento: primeiroVencimentoDate,
          observacoes,
          empresaId: Number.isNaN(empresaId) ? 1 : empresaId,
          filialId,
        },
      })

      await tx.orcamentoItem.createMany({
        data: itensPayload.map((item) => ({
          orcamentoId: novoOrcamento.id,
          itemId: item.itemId,
          quantidade: item.quantidade,
          valor: item.valor,
        })),
      })

      return novoOrcamento
    })

    return NextResponse.json(
      {
        id: createdBudget.id,
        clienteId: createdBudget.clienteId,
        status: createdBudget.status,
        parcelas: createdBudget.parcelas,
        primeiroVencimento: createdBudget.primeiroVencimento,
        observacoes: createdBudget.observacoes,
        vendedorId: createdBudget.vendedorId,
        total,
        itens: itensPayload.map((item) => ({
          itemId: item.itemId.toString(),
          nome: item.nome,
          quantidade: item.quantidade,
          valor: item.valor,
          subtotal: item.quantidade * item.valor,
        })),
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("[orcamentos][POST]", error)
    const message = error instanceof Error ? error.message : "Erro ao criar orçamento."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

