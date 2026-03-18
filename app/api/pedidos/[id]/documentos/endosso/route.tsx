import { NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { prisma } from "@/lib/prisma"
import { CartaEndossoDoc } from "@/lib/documents/carta-endosso"
import { resolveEmpresaLogoDataUrl } from "@/lib/documents/logo-utils"
import { auth } from "@/auth"
import { resolveFilialId } from "@/app/api/orcamentos/filial-map"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
        // Roles permitidas: master, financeiro, vendedor, adm, supervisao
        // Assumindo ADMINISTRADOR como adm
        const role = (session.user as any).role
        const allowed = ["MASTER", "FINANCEIRO", "VENDEDOR", "ADMINISTRADOR", "SUPERVISOR"]
        if (!role || !allowed.includes(role as string)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const { id } = await params
        const pedidoId = Number(id)
        if (isNaN(pedidoId)) {
            return NextResponse.json({ error: "ID inválido" }, { status: 400 })
        }

        const pedido = await prisma.pedido.findUnique({
            where: { id: pedidoId },
            select: {
                id: true,
                orcamento: {
                    select: {
                        empresaId: true,
                        empresa: { select: { nome: true, logoUrl: true } },
                        filial: { select: { cnpj: true } },
                    },
                },
                cliente: {
                    select: {
                        razaoSocial: true,
                        cnpj: true,
                        logradouro: true,
                        numero: true,
                        complemento: true,
                        bairro: true,
                        cidade: true,
                        estado: true,
                        cep: true,
                    },
                },
            },
        })

        if (!pedido) {
            return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 })
        }

        // Regra de negócio: Apenas Empresa Brasileira de Raios (ID 1)
        if (!pedido.orcamento || pedido.orcamento.empresaId !== 1) {
            return NextResponse.json({ error: "Carta de endosso disponível apenas para pedidos da Empresa Brasileira de Raios." }, { status: 400 })
        }

        const cliente = pedido.cliente
        const enderecoParts = [
            [cliente.logradouro, cliente.numero].filter(Boolean).join(", "),
            cliente.complemento,
            [cliente.bairro, cliente.cep].filter(Boolean).join(" "),
        ]
            .filter((p) => p && p.trim().length)
            .join(" - ")
        const cidadeUf = [cliente.cidade, cliente.estado].filter(Boolean).join(" / ")

        const empresa = pedido.orcamento.empresa
        const filial = pedido.orcamento.filial

        // Lógica de fallback de filial
        let cnpjFilial = filial?.cnpj

        // Se não tiver CNPJ (filial nula ou sem cnpj), tenta resolver automaticamente via regra de UF
        if (!cnpjFilial) {
            const resolvedId = await resolveFilialId(prisma, 1, cliente.estado) // 1 = EBR
            if (resolvedId) {
                const f = await prisma.filial.findUnique({
                    where: { id: resolvedId },
                    select: { cnpj: true }
                })
                if (f?.cnpj) {
                    cnpjFilial = f.cnpj
                }
            }
        }

        const finalCnpj = cnpjFilial || "CNPJ não informado"

        const logoDataUrl = await resolveEmpresaLogoDataUrl({
            logoUrl: empresa?.logoUrl ?? null,
            empresaId: pedido.orcamento?.empresaId ?? null,
        })

        const doc = (
            <CartaEndossoDoc
                logoDataUrl={logoDataUrl}
                cnpjFilial={finalCnpj}
                clienteNome={cliente.razaoSocial}
                clienteEndereco={enderecoParts || ""}
                clienteCidadeUf={cidadeUf}
                empresaEndossanteNome="J S SERVIÇOS/EMPRESA BRASILEIRA DE RAIOS"
                empresaEndossanteCnpj={finalCnpj}
                empresaSacadoNome="SISTEMAS DE COBRANÇA ASSERTIVAS LTDA"
                empresaSacadoCnpj="54.229.821/0001-23"
            />
        )

        const buffer = await renderToBuffer(doc)

        const headers = new Headers()
        headers.set("Content-Type", "application/pdf")
        headers.set("Content-Disposition", `attachment; filename="carta-endosso-${pedidoId}.pdf"`)

        return new NextResponse(buffer as any, { status: 200, headers })

    } catch (error) {
        console.error("[carta-endosso]", error)
        return NextResponse.json({ error: "Erro ao gerar carta de endosso." }, { status: 500 })
    }
}
