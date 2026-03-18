import { NextResponse } from "next/server"
import { getVendedorContext } from "@/lib/vendor-dashboard"
import { GetDebitoCobrancaUseCase } from "@/domain/financeiro/get-debito-cobranca.usecase"
import { parseDateOnlySafe } from "@/lib/date-utils"

export async function GET(request: Request) {
    try {
        const url = new URL(request.url)
        const { vendedorId } = await getVendedorContext(url.searchParams)

        if (!vendedorId) {
            return NextResponse.json({ error: "Vendedor não identificado" }, { status: 401 })
        }

        const order = (url.searchParams.get("order") || "asc").toLowerCase() === "desc" ? "desc" : "asc"
        const clientPage = Number(url.searchParams.get("clientPage") || 1)
        const clientLimit = url.searchParams.get("clientLimit") ? Number(url.searchParams.get("clientLimit")) : undefined
        const startDate = url.searchParams.get("startDate") ? (parseDateOnlySafe(url.searchParams.get("startDate")) ?? undefined) : undefined
        const endDate = url.searchParams.get("endDate") ? (parseDateOnlySafe(url.searchParams.get("endDate")) ?? undefined) : undefined

        const useCase = new GetDebitoCobrancaUseCase()
        const result = await useCase.execute({
            status: "vencido",
            vendedorId,
            order: order as "asc" | "desc",
            clientPage,
            clientPageSize: 300,
            clientLimit,
            startDate,
            endDate,
        })

        return NextResponse.json(result)
    } catch (error) {
        console.error("[VENDEDOR_INADIMPLENCIA_API]", error)
        return NextResponse.json({ error: "Erro ao carregar dados de inadimplência" }, { status: 500 })
    }
}
