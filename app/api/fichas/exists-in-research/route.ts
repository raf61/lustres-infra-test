import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const cnpj = searchParams.get("cnpj")

        if (!cnpj) {
            return NextResponse.json({ error: "CNPJ não informado" }, { status: 400 })
        }

        // Busca se existe ficha em pesquisa para o CNPJ (robusto com pontuação)
        const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM "Ficha" 
        WHERE regexp_replace(cnpj, '\\D', '', 'g') = regexp_replace(${cnpj}, '\\D', '', 'g')
        AND "fichaStatus" = 'EM_PESQUISA'
      ) as exists
    `

        return NextResponse.json({ exists: !!result[0]?.exists })
    } catch (error) {
        console.error("[fichas/exists-in-research][GET]", error)
        return NextResponse.json({ error: "Erro ao verificar ficha" }, { status: 500 })
    }
}
