import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { buildWhereClause } from "@/app/api/clients/filters"
import { CLIENTS_MAX_LIMIT } from "@/lib/constants"
import { assignVendorToClients } from "@/domain/client/vendor-assignment-rules"

type RequestBody = {
  ids: number[]
  vendedorId: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody

    if (!body?.vendedorId || typeof body.vendedorId !== "string") {
      return NextResponse.json({ error: "vendedorId é obrigatório" }, { status: 400 })
    }

    const vendorUser = await prisma.user.findUnique({
      where: { id: body.vendedorId },
      select: { id: true, role: true },
    })

    if (!vendorUser || vendorUser.role !== "VENDEDOR") {
      return NextResponse.json({ error: "Vendedor inválido" }, { status: 400 })
    }

    const ids = Array.isArray(body.ids) ? body.ids.filter((n) => Number.isInteger(n)) : []
    if (ids.length === 0) {
      return NextResponse.json({ error: "Nenhum ID válido informado" }, { status: 400 })
    }
    if (ids.length > CLIENTS_MAX_LIMIT) {
      return NextResponse.json(
        { error: `Limite máximo de ${CLIENTS_MAX_LIMIT} clientes por atribuição` },
        { status: 400 },
      )
    }

    const where = buildWhereClause([Prisma.sql`c.id IN (${Prisma.join(ids)})`])

    // Find clients that have a Ficha in EM_PESQUISA status (match by CNPJ with/without punctuation)
    const clientsWithFichaEmPesquisa = await prisma.$queryRaw<{ id: number; cnpj: string; razaoSocial: string }[]>(Prisma.sql`
      SELECT c.id, c.cnpj, c."razaoSocial"
      FROM "Client" c
      ${where}
      AND EXISTS (
        SELECT 1 FROM "Ficha" f 
        WHERE regexp_replace(f.cnpj, '\\D', '', 'g') = regexp_replace(c.cnpj, '\\D', '', 'g')
        AND f."fichaStatus" = 'EM_PESQUISA'
      )
    `)

    const idsComFichaEmPesquisa = clientsWithFichaEmPesquisa.map((c) => c.id)

    // Usar o módulo centralizado para atribuir vendedor dentro de transação
    const result = await prisma.$transaction(async (tx) => {
      return assignVendorToClients(
        tx,
        {
          clientIds: ids,
          vendedorId: body.vendedorId,
        },
        idsComFichaEmPesquisa
      )
    })

    return NextResponse.json({
      updated: result.assigned,
      visibleInDashboard: result.visibleInDashboard,
      exploradosVisibleInDashboard: result.exploradosVisibleInDashboard,
      ativosAgendadosVisibleInDashboard: result.ativosAgendadosVisibleInDashboard,
      skipped: idsComFichaEmPesquisa.length,
      skippedClients: clientsWithFichaEmPesquisa.map((c) => ({
        id: c.id,
        cnpj: c.cnpj,
        razaoSocial: c.razaoSocial,
      })),
    })
  } catch (error) {
    console.error("[clients][atribuir-vendedor][POST]", error)
    return NextResponse.json({ error: "Erro ao atribuir vendedor" }, { status: 500 })
  }
}
