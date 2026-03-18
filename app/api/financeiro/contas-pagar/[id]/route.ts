import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { parseDateOnlySafe } from "@/lib/date-utils"

// Alias para manter compatibilidade com código existente
const parseDateOnly = parseDateOnlySafe

const parseBrazilDateTime = (value: string | undefined | null) => {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00-03:00`)
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const isPromise = (v: any) => typeof v === "object" && v !== null && "then" in v && typeof (v as any).then === "function"

export async function PATCH(request: Request, context: { params?: any } = {}) {
  const rawParams = context.params
  const params = isPromise(rawParams) ? await rawParams : rawParams
  const id = Number(params?.id)
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 })
  }

  try {
    const body = await request.json()
    const data: any = {}

    if (body.descricao !== undefined) data.descricao = body.descricao || null
    if (body.categoriaId !== undefined) data.categoriaId = body.categoriaId ? Number(body.categoriaId) : null
    if (body.valor !== undefined) {
      const valorNum = Number(body.valor)
      if (!valorNum || Number.isNaN(valorNum) || valorNum <= 0) {
        return NextResponse.json({ error: "Valor inválido." }, { status: 400 })
      }
      data.valor = valorNum
    }
    if (body.vencimento !== undefined) {
      const venc = parseDateOnly(body.vencimento)
      if (!venc) {
        return NextResponse.json({ error: "Vencimento inválido." }, { status: 400 })
      }
      data.vencimento = venc
    }

    if (body.status !== undefined) {
      const statusNum = Number(body.status)
      if (![0, 1].includes(statusNum)) {
        return NextResponse.json({ error: "Status inválido." }, { status: 400 })
      }
      data.status = statusNum
      if (statusNum === 1) {
        const pagoEmParsed = parseBrazilDateTime(body.pagoEm) ?? new Date()
        data.pagoEm = pagoEmParsed
      } else {
        if (body.pagoEm !== undefined) {
          const pagoEmParsed = parseBrazilDateTime(body.pagoEm)
          data.pagoEm = pagoEmParsed
        } else {
          data.pagoEm = null
        }
      }
    } else if (body.pagoEm !== undefined) {
      const pagoEmParsed = parseBrazilDateTime(body.pagoEm)
      data.pagoEm = pagoEmParsed
    }

    const updated = await (prisma as any).contaPagar.update({
      where: { id },
      data,
      include: { categoria: true },
    })

    // Se for conta vinculada a comissão, sincroniza valor e vencimento de volta
    if (updated.comissaoId) {
      const comissaoData: Record<string, any> = {}
      if (data.valor !== undefined) comissaoData.valor = data.valor
      if (data.vencimento !== undefined) comissaoData.vencimento = data.vencimento
      if (Object.keys(comissaoData).length > 0) {
        await (prisma as any).comissao.update({
          where: { id: updated.comissaoId },
          data: comissaoData,
        })
      }
    }

    return NextResponse.json({
      id: updated.id,
      descricao: updated.descricao,
      valor: updated.valor,
      status: updated.status,
      vencimento: updated.vencimento,
      pagoEm: updated.pagoEm,
      categoriaId: updated.categoriaId,
      categoriaNome: updated.categoria?.nome ?? null,
    })
  } catch (error) {
    console.error("Erro ao atualizar conta a pagar:", error)
    return NextResponse.json({ error: "Erro ao atualizar conta a pagar." }, { status: 500 })
  }
}

export async function DELETE(_: Request, context: { params?: any } = {}) {
  const rawParams = context.params
  const params = isPromise(rawParams) ? await rawParams : rawParams
  const id = Number(params?.id)
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 })
  }

  try {
    await (prisma as any).contaPagar.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao excluir conta a pagar:", error)
    return NextResponse.json({ error: "Erro ao excluir conta a pagar." }, { status: 500 })
  }
}

