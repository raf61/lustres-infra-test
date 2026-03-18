import type { PrismaClient } from "@prisma/client"

export type DebitoParaBoleto = {
  id: number
  receber: number | null
  stats: number | null
  vencimento: Date | null
  cliente: {
    razaoSocial: string | null
    cnpj: string | null
    cep: string | null
    cidade: string | null
    estado: string | null
    logradouro: string | null
    numero: string | null
    bairro: string | null
    complemento: string | null
  }
  banco: {
    bancoCodigo: number
    razaoSocial: string
    cnpj: string
    agencia: string | null
    agenciaDigito: string | null
    conta: string | null
    contaDigito: string | null
    carteira: string
    codigoBeneficiario: string | null
    endereco: unknown | null
  } | null
}

export interface PedidoBoletosRepository {
  getDebitosParaBoletos(pedidoId: number): Promise<DebitoParaBoleto[]>
}

export function createPedidoBoletosRepository(prisma: PrismaClient): PedidoBoletosRepository {
  return {
    async getDebitosParaBoletos(pedidoId: number) {
      const debitos = await prisma.debito.findMany({
        where: { pedidoId },
        select: {
          id: true,
          receber: true,
          stats: true,
          vencimento: true,
          cliente: {
            select: {
              razaoSocial: true,
              cnpj: true,
              cep: true,
              cidade: true,
              estado: true,
              logradouro: true,
              numero: true,
              bairro: true,
              complemento: true,
            },
          },
          pedido: {
            select: {
              bancoEmissor: {
                select: {
                  bancoCodigo: true,
                  razaoSocial: true,
                  cnpj: true,
                  agencia: true,
                  agenciaDigito: true,
                  conta: true,
                  contaDigito: true,
                  carteira: true,
                  codigoBeneficiario: true,
                  endereco: true,
                },
              },
            },
          },
        },
        orderBy: { vencimento: "asc" },
      })

      return debitos.map((debito) => ({
        id: debito.id,
        receber: debito.receber,
        stats: debito.stats,
        vencimento: debito.vencimento,
        cliente: debito.cliente,
        banco: debito.pedido?.bancoEmissor ?? null,
      }))
    },
  }
}
