import { createPedidoBoletosRepository, type DebitoParaBoleto } from "./merged-boletos-repository"
import type { PrismaClient } from "@prisma/client"

export type GenerateMergedBoletosInput = {
  pedidoId: number
}

export type GenerateMergedBoletosResult = {
  buffer: Buffer
  totalBoletos: number
}

export type GenerateBoletoPdf = (debito: DebitoParaBoleto) => Promise<Buffer>
export type MergePdfBuffers = (buffers: Buffer[]) => Promise<Buffer>

export async function generateMergedBoletosPdf(
  prisma: PrismaClient,
  input: GenerateMergedBoletosInput,
  deps: {
    generateBoletoPdf: GenerateBoletoPdf
    mergePdfBuffers: MergePdfBuffers
  }
): Promise<GenerateMergedBoletosResult> {
  if (!Number.isFinite(input.pedidoId) || input.pedidoId <= 0) {
    throw new Error("Pedido inválido.")
  }

  const repository = createPedidoBoletosRepository(prisma)
  const debitos = await repository.getDebitosParaBoletos(input.pedidoId)

  const elegiveis = debitos.filter((debito) => {
    const bancoCodigo = debito.banco?.bancoCodigo
    const valor = Number(debito.receber ?? 0)
    return (
      debito.stats === 0 &&
      !!debito.vencimento &&
      valor > 0 &&
      (bancoCodigo === 341 || bancoCodigo === 33)
    )
  })

  if (elegiveis.length === 0) {
    throw new Error("Nenhum débito elegível para gerar boletos.")
  }

  const buffers: Buffer[] = []
  for (const debito of elegiveis) {
    const buffer = await deps.generateBoletoPdf(debito)
    buffers.push(buffer)
  }

  const merged = await deps.mergePdfBuffers(buffers)

  return {
    buffer: merged,
    totalBoletos: buffers.length,
  }
}
