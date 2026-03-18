import { NextResponse } from "next/server"
import { FILIAL_MAP } from "../../orcamentos/filial-map"

export async function GET() {
    return NextResponse.json({ data: FILIAL_MAP })
}
