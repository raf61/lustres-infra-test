import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

type RouteParams = {
  id?: string
}

type RouteContext = {
  params?: RouteParams | Promise<RouteParams>
}

const isPromise = (value: unknown): value is Promise<unknown> =>
  typeof value === "object" && value !== null && "then" in value && typeof (value as Promise<unknown>).then === "function"

const toISOString = (value: Date | null | undefined) => (value ? value.toISOString() : null)

export async function GET(request: Request, context: RouteContext = {}) {
  const rawParams = context.params
  const params = isPromise(rawParams) ? await rawParams : rawParams

  let idParam = params?.id

  if (!idParam) {
    const url = new URL(request.url)
    idParam = url.searchParams.get("id") ?? undefined

    if (!idParam) {
      const segments = url.pathname.split("/").filter(Boolean)
      idParam = segments.at(-2) // .../clients/:id/debitos
    }
  }

  if (!idParam) {
    return NextResponse.json({ error: "ID não informado" }, { status: 400 })
  }

  const clientId = Number.parseInt(idParam, 10)

  if (Number.isNaN(clientId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 })
  }

  try {
    const debitos = await prisma.debito.findMany({
      where: { clienteId: clientId },
      select: {
        id: true,
        vencimento: true,
        receber: true,
        stats: true,
        pedido: { select: { bancoEmissorId: true } },
      },
      orderBy: {
        vencimento: "desc",
      },
    })

    return NextResponse.json({
      debitos: debitos.map((debito) => ({
        id: debito.id,
        valor: debito.receber ?? 0,
        status: debito.stats ?? 0,
        vencimento: toISOString(debito.vencimento),
        bancoEmissorId: debito.pedido?.bancoEmissorId ?? null,
      })),
    })
  } catch (error) {
    console.error(`Erro ao buscar débitos do cliente ${clientId}:`, error)
    return NextResponse.json({ error: "Erro ao buscar débitos" }, { status: 500 })
  }
}

