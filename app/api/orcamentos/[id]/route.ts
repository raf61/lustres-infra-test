import { NextResponse } from "next/server"
import { OrcamentoStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { resolveFilialId } from "../filial-map"
import { parseDateOnlySafe } from "@/lib/date-utils"

type RouteParams = { id?: string }
type RouteContext = { params?: RouteParams | Promise<RouteParams> }

const isPromise = (value: unknown): value is Promise<unknown> =>
  typeof value === "object" && value !== null && "then" in value && typeof (value as Promise<unknown>).then === "function"

type OrcamentoItemInput = { itemId: number; quantidade: number; valor?: number }

type UpdatePayload = {
  empresaId?: number | null
  parcelas?: number | null
  primeiroVencimento?: string | null
  garantiaMeses?: number | null
  observacoes?: string | null
  itens?: OrcamentoItemInput[]
}

const toPositiveInt = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? Math.floor(value) : null
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) || parsed <= 0 ? null : parsed
  }
  return null
}

const sanitizeMoney = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return Number.parseFloat(value.toFixed(2))
  if (typeof value === "string") {
    const numeric = Number.parseFloat(value.replace(",", "."))
    if (!Number.isNaN(numeric) && numeric >= 0) return Number.parseFloat(numeric.toFixed(2))
  }
  return null
}

export async function GET(request: Request, context: RouteContext = {}) {
  const rawParams = context.params
  const params = isPromise(rawParams) ? await rawParams : rawParams

  let idParam = params?.id
  if (!idParam) {
    const url = new URL(request.url)
    idParam = url.searchParams.get("id") ?? undefined
  }
  if (!idParam) return NextResponse.json({ error: "ID não informado." }, { status: 400 })

  const orcamentoId = Number.parseInt(idParam, 10)
  if (Number.isNaN(orcamentoId)) return NextResponse.json({ error: "ID inválido." }, { status: 400 })

  try {
    const orcamento = await prisma.orcamento.findUnique({
      where: { id: orcamentoId },
      select: {
        id: true,
        clienteId: true,
        status: true,
        parcelas: true,
        primeiroVencimento: true,
        observacoes: true,
        empresaId: true,
        empresa: { select: { nome: true } },
        filial: { select: { uf: true } },
        vendedor: { select: { name: true } },
        itens: {
          select: {
            id: true,
            quantidade: true,
            valor: true,
            item: { select: { id: true, nome: true } },
          },
        },
      },
    })

    if (!orcamento) return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 })

    return NextResponse.json({
      data: {
        id: orcamento.id,
        clienteId: orcamento.clienteId,
        status: orcamento.status,
        parcelas: orcamento.parcelas,
        primeiroVencimento: orcamento.primeiroVencimento,
        observacoes: orcamento.observacoes,
        empresaId: orcamento.empresaId,
        empresaNome: orcamento.empresa?.nome ?? null,
        filialUf: orcamento.filial?.uf ?? null,
        vendedor: orcamento.vendedor?.name ?? null,
        itens: orcamento.itens.map((i) => ({
          id: i.id,
          itemId: Number(i.item.id),
          nome: i.item.nome,
          quantidade: i.quantidade,
          valor: i.valor,
        })),
      },
    })
  } catch (error) {
    console.error("[orcamentos/id][GET]", error)
    return NextResponse.json({ error: "Erro ao buscar orçamento." }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext = {}) {
  const rawParams = context.params
  const params = isPromise(rawParams) ? await rawParams : rawParams

  let idParam = params?.id
  if (!idParam) {
    const url = new URL(request.url)
    idParam = url.searchParams.get("id") ?? undefined
  }
  if (!idParam) return NextResponse.json({ error: "ID não informado." }, { status: 400 })

  const orcamentoId = Number.parseInt(idParam, 10)
  if (Number.isNaN(orcamentoId)) return NextResponse.json({ error: "ID inválido." }, { status: 400 })

  let body: UpdatePayload
  try {
    body = (await request.json()) as UpdatePayload
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 })
  }

  if (!Array.isArray(body.itens) || body.itens.length === 0) {
    return NextResponse.json({ error: "Adicione ao menos um produto/serviço." }, { status: 400 })
  }

  try {
    const orcamento = await prisma.orcamento.findUnique({
      where: { id: orcamentoId },
      select: { status: true, clienteId: true, empresaId: true, cliente: { select: { estado: true } } },
    })

    if (!orcamento) return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 })

    if (orcamento.status === OrcamentoStatus.APROVADO || orcamento.status === OrcamentoStatus.CANCELADO) {
      return NextResponse.json({ error: "Orçamentos aprovados ou cancelados não podem ser alterados." }, { status: 400 })
    }

    const normalizedItems = body.itens.map((item) => {
      const quantidade = toPositiveInt(item.quantidade)
      if (!quantidade) throw new Error("Quantidade inválida para um dos itens.")
      const valor = sanitizeMoney(item.valor)
      return { rawItemId: item.itemId, quantidade, valor }
    })

    const itemIds = normalizedItems.map((item) => {
      try {
        return BigInt(item.rawItemId)
      } catch {
        throw new Error("Produto/serviço inválido.")
      }
    })

    const itensFromDb = await prisma.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, valor: true },
    })
    if (itensFromDb.length !== itemIds.length) {
      return NextResponse.json({ error: "Há itens inválidos na solicitação." }, { status: 400 })
    }
    const itensMap = new Map(itensFromDb.map((i) => [i.id.toString(), i]))

    const parcelas = toPositiveInt(body.parcelas ?? null)
    const garantiaMeses = toPositiveInt(body.garantiaMeses ?? null)
    const empresaId = body.empresaId ? Number.parseInt(String(body.empresaId), 10) : orcamento.empresaId ?? 1
    const primeiroVencimentoDate = parseDateOnlySafe(body.primeiroVencimento)
    if (body.primeiroVencimento && body.primeiroVencimento.trim().length > 0 && !primeiroVencimentoDate) {
      return NextResponse.json({ error: "Data do 1º vencimento inválida." }, { status: 400 })
    }

    const observacoesParts: string[] = []
    if (Number.isFinite(garantiaMeses ?? NaN)) {
      observacoesParts.push(`garantia:[${garantiaMeses}]`)
    }
    if (body.observacoes && body.observacoes.trim().length > 0) {
      observacoesParts.push(body.observacoes.trim())
    }
    const observacoes = observacoesParts.length > 0 ? observacoesParts.join(" | ") : null

    const itensPayload = normalizedItems.map((item, index) => {
      const dbItem = itensMap.get(itemIds[index].toString())
      if (!dbItem) throw new Error("Produto não encontrado.")
      return {
        itemId: dbItem.id,
        quantidade: item.quantidade,
        valor: item.valor ?? dbItem.valor,
      }
    })

    await prisma.$transaction(async (tx) => {
      const filialId = await resolveFilialId(
        tx,
        Number.isNaN(empresaId) ? 1 : empresaId,
        orcamento.cliente?.estado ?? null,
      )

      await tx.orcamento.update({
        where: { id: orcamentoId },
        data: {
          empresaId: Number.isNaN(empresaId) ? 1 : empresaId,
          filialId,
          parcelas,
          primeiroVencimento: primeiroVencimentoDate,
          observacoes,
          vendedorId: undefined, // mantém
          updatedAt: new Date(),
        },
      })

      await tx.orcamentoItem.deleteMany({ where: { orcamentoId } })
      await tx.orcamentoItem.createMany({
        data: itensPayload.map((i) => ({
          orcamentoId,
          itemId: i.itemId,
          quantidade: i.quantidade,
          valor: i.valor,
        })),
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[orcamentos/id][PATCH]", error)
    const message = error instanceof Error ? error.message : "Erro ao atualizar orçamento."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}



