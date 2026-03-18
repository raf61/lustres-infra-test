import { PrismaClient } from "@prisma/client"

export async function resolvePedidoTipoEspecial(
  prisma: PrismaClient,
  pedidoId: number
): Promise<"OS" | null> {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: { tipoEspecial: true },
  })

  if (!pedido) {
    throw new Error("Pedido não encontrado.")
  }

  return pedido.tipoEspecial ?? null
}

