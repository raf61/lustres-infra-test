import { NextResponse } from "next/server"
import { PedidoStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"

import { generateOrdemServicoPdf } from "@/lib/documents/ordem-servico"
import { storage } from "@/lib/storage"

export async function GET() {
  
  console.log(await storage.getDownloadUrlFromStoredUrl(await generateOrdemServicoPdf({documentoId:163})))
  console.log('12345')
  try {
    const pedidos = await prisma.pedido.findMany({
      where: { status: PedidoStatus.ANALISE_CANCELAMENTO },
      include: {
        cliente: {
          select: {
            id: true,
            razaoSocial: true,
            cnpj: true,
            bairro: true,
            cidade: true,
            estado: true,
            ultimaManutencao: true,
            categoria: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    const data = pedidos.map((pedido) => ({
      id: pedido.id,
      clienteId: pedido.clienteId,
      clienteRazaoSocial: pedido.cliente.razaoSocial,
      clienteCnpj: pedido.cliente.cnpj,
      clienteBairro: pedido.cliente.bairro,
      clienteCidade: pedido.cliente.cidade,
      clienteEstado: pedido.cliente.estado,
      motivoCancelamento: pedido.motivoCancelamento ?? "—",
      ultimaManutencao: pedido.cliente.ultimaManutencao,
      categoriaCliente: pedido.cliente.categoria,
      createdAt: pedido.createdAt,
    }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error("[analise-cancelamento][GET]", error)
    const message = error instanceof Error ? error.message : "Não foi possível carregar análises de cancelamento."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


