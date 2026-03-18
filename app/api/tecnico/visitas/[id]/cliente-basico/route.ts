import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { parseEspecificacaoCondominio } from "@/lib/constants/especificacao-condominio"
import {
  updateClienteBasicoFromVisita,
  type ClienteBasicoRepository,
} from "@/domain/client/update-cliente-basico-usecase"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

const parseOptionalInt = (value: unknown): number | null | undefined => {
  if (value === undefined) return undefined
  if (value === null || value === "") return null
  const parsed = Number.parseInt(String(value), 10)
  if (Number.isNaN(parsed)) {
    throw new Error("Quantidade de andares inválida.")
  }
  return parsed
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const visitaId = Number.parseInt(id, 10)
    if (Number.isNaN(visitaId)) {
      return NextResponse.json({ error: "ID da visita inválido." }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      quantidadeAndares?: number | string | null
      quantidadeSPDA?: number | string | null
      especificacaoCondominio?: string | null
    }

    const quantidadeAndares = parseOptionalInt(body.quantidadeAndares)
    const quantidadeSPDA = parseOptionalInt(body.quantidadeSPDA)
    const especificacaoCondominio = parseEspecificacaoCondominio(body.especificacaoCondominio)

    const repository: ClienteBasicoRepository = {
      getVisitaContext: async (visitaIdToFind: number) =>
        prisma.visitaTecnica.findUnique({
          where: { id: visitaIdToFind },
          select: { status: true, clienteId: true },
        }),
      updateClienteBasico: async (clienteId, data) => {
        const updated = await prisma.client.update({
          where: { id: clienteId },
          data,
          select: {
            id: true,
            quantidadeAndares: true,
            quantidadeSPDA: true,
            especificacaoCondominio: true,
          },
        })
        return {
          clienteId: updated.id,
          quantidadeAndares: updated.quantidadeAndares,
          quantidadeSPDA: updated.quantidadeSPDA,
          especificacaoCondominio: updated.especificacaoCondominio,
        }
      },
    }

    const updated = await updateClienteBasicoFromVisita(repository, {
      visitaId,
      quantidadeAndares,
      quantidadeSPDA,
      especificacaoCondominio,
    })

    return NextResponse.json({
      clienteId: updated.clienteId,
      quantidadeAndares: updated.quantidadeAndares,
      quantidadeSPDA: updated.quantidadeSPDA,
      especificacaoCondominio: updated.especificacaoCondominio,
    })
  } catch (error) {
    console.error("[tecnico][visitas][cliente-basico][PATCH]", error)
    const message = error instanceof Error ? error.message : "Não foi possível atualizar o cliente."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

