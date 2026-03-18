import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  buildWhereConditions,
  buildCategoryConditions,
  buildWhereClause,
  categoriaEnumSqlMap,
} from "@/app/api/clients/filters"
import { extractDigits, formatCnpjDigits } from "@/lib/cnpj"

type ExportType = "csv" | "papel"

type RawDbClient = {
  cnpj: string
  razaoSocial: string
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  categoria: "ATIVO" | "AGENDADO" | "EXPLORADO" | null
}

const csvEscape = (value: string) => `"${value.replace(/"/g, '""')}"`

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const exportType: ExportType = searchParams.get("type") === "papel" ? "papel" : "csv"

    const baseConditions = buildWhereConditions(searchParams)
    const categoryConditions = buildCategoryConditions(searchParams)
    const dataConditions: Prisma.Sql[] = [...baseConditions, ...categoryConditions]
    const whereClause = buildWhereClause(dataConditions)

    let orderByClause = Prisma.sql`ORDER BY c."createdAt" DESC`
    const categoriaParam = searchParams.get("categoria")
    if (categoriaParam === "explorado") {
      orderByClause = Prisma.sql`ORDER BY c."razaoSocial" ASC`
    } else if (categoriaParam === "ativo") {
      orderByClause = Prisma.sql`ORDER BY c."ultimaManutencao" ASC NULLS LAST, c."razaoSocial" ASC`
    } else if (categoriaParam === "agendado") {
      orderByClause = Prisma.sql`ORDER BY c."dataContatoAgendado" ASC NULLS LAST, c."razaoSocial" ASC`
    }

    const clients = await prisma.$queryRaw<RawDbClient[]>(Prisma.sql`
      SELECT
        c.cnpj,
        c."razaoSocial",
        c.logradouro,
        c.numero,
        c.complemento,
        c.bairro,
        c.cidade,
        c.estado,
        c.categoria
      FROM "Client" c
      ${whereClause}
      ${orderByClause}
    `)

    const mapped = clients.map((client) => {
      const digits = extractDigits(client.cnpj)
      const formattedCnpj = formatCnpjDigits(digits) ?? client.cnpj
      const enderecoParts = [client.logradouro, client.numero, client.complemento].filter(
        (part) => part && part.trim().length,
      ) as string[]
      const endereco = enderecoParts.join(", ")
      return {
        condominio: client.razaoSocial,
        cnpj: formattedCnpj,
        endereco,
        bairro: client.bairro ?? "",
        cidade: client.cidade ?? "",
        estado: client.estado ?? "",
      }
    })

    const filenameBase = `clientes-${new Date().toISOString().split("T")[0]}`

    if (exportType === "papel") {
      const rowsHtml = mapped
        .map(
          (row) => `
            <tr>
              <td>${row.condominio}</td>
              <td>${row.cnpj}</td>
              <td>${row.estado}</td>
              <td>${row.cidade}</td>
              <td>${row.bairro}</td>
              <td>${row.endereco}</td>
            </tr>
          `,
        )
        .join("")

      const html = `<!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <title>Clientes</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; margin: 16px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ccc; padding: 4px 6px; }
            th { background: #f3f3f3; text-align: left; }
            tr:nth-child(even) { background: #fafafa; }
          </style>
        </head>
        <body>
          <table>
            <thead>
              <tr>
                <th>Condomínio</th>
                <th>CNPJ</th>
                <th>UF</th>
                <th>Cidade</th>
                <th>Bairro</th>
                <th>Endereço</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
        </html>`

      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `inline; filename="${filenameBase}.html"`,
        },
      })
    }

    const headers = ["Condomínio", "CNPJ", "Estado", "Cidade", "Bairro", "Endereço"]
    const csv = [
      headers.map(csvEscape).join(","),
      ...mapped.map((row) =>
        [
          csvEscape(row.condominio),
          csvEscape(row.cnpj),
          csvEscape(row.estado),
          csvEscape(row.cidade),
          csvEscape(row.bairro),
          csvEscape(row.endereco),
        ].join(","),
      ),
    ].join("\n")

    const csvBuffer = new TextEncoder().encode(csv)
    return new NextResponse(csvBuffer, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
      },
    })
  } catch (error) {
    console.error("[clients][export][GET]", error)
    return NextResponse.json({ error: "Erro ao exportar clientes." }, { status: 500 })
  }
}

