import { PrismaClient } from "@prisma/client"

export async function resolvePedidoTipoEspecialByVisita(
  prisma: PrismaClient,
  visitaId: number
): Promise<"OS" | null> {
  const visita = await prisma.visitaTecnica.findUnique({
    where: { id: visitaId },
    select: { pedido: { select: { tipoEspecial: true } } },
  })

  if (!visita || !visita.pedido) {
    throw new Error("Visita sem pedido associado.")
  }

  return visita.pedido.tipoEspecial ?? null
}

