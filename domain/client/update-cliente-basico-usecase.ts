import type { EspecificacaoCondominioType } from "@/lib/constants/especificacao-condominio"

export type UpdateClienteBasicoInput = {
  visitaId: number
  quantidadeAndares?: number | null
  quantidadeSPDA?: number | null
  especificacaoCondominio?: EspecificacaoCondominioType | null
}

export type ClienteBasicoUpdateResult = {
  clienteId: number
  quantidadeAndares: number | null
  quantidadeSPDA: number | null
  especificacaoCondominio: EspecificacaoCondominioType | null
}

export interface ClienteBasicoRepository {
  getVisitaContext(visitaId: number): Promise<{
    status: string
    clienteId: number
  } | null>
  updateClienteBasico(
    clienteId: number,
    data: {
      quantidadeAndares?: number | null
      quantidadeSPDA?: number | null
      especificacaoCondominio?: EspecificacaoCondominioType | null
    },
  ): Promise<ClienteBasicoUpdateResult>
}

export async function updateClienteBasicoFromVisita(
  repository: ClienteBasicoRepository,
  input: UpdateClienteBasicoInput,
): Promise<ClienteBasicoUpdateResult> {
  const visita = await repository.getVisitaContext(input.visitaId)
  if (!visita) {
    throw new Error("Visita técnica não encontrada.")
  }

  if (visita.status !== "EM_EXECUCAO" && visita.status !== "FINALIZADO") {
    throw new Error("Acesso permitido apenas para visitas em execução ou finalizadas.")
  }

  if (input.quantidadeAndares !== undefined && input.quantidadeAndares !== null) {
    if (!Number.isInteger(input.quantidadeAndares) || input.quantidadeAndares < 0) {
      throw new Error("Quantidade de andares inválida.")
    }
  }

  if (input.quantidadeSPDA !== undefined && input.quantidadeSPDA !== null) {
    if (!Number.isInteger(input.quantidadeSPDA) || input.quantidadeSPDA < 1) {
      // A user mentioned and inserting/modifying quantity of SPDA, usually 1 or more if it exists. 
      // But 0 could be valid if they previously thought there was SPDA and there isn't.
      // The user said "inserir/modificar a quantidade de spda", let's allow 0.
      if (input.quantidadeSPDA < 0) throw new Error("Quantidade de SPDA inválida.")
    }
  }

  if (input.quantidadeAndares === undefined && input.especificacaoCondominio === undefined && input.quantidadeSPDA === undefined) {
    throw new Error("Nenhum dado informado para atualização.")
  }

  const updateData: {
    quantidadeAndares?: number | null
    quantidadeSPDA?: number | null
    especificacaoCondominio?: EspecificacaoCondominioType | null
  } = {}

  if (input.quantidadeAndares !== undefined) {
    updateData.quantidadeAndares = input.quantidadeAndares
  }

  if (input.quantidadeSPDA !== undefined) {
    updateData.quantidadeSPDA = input.quantidadeSPDA
  }

  if (input.especificacaoCondominio !== undefined) {
    updateData.especificacaoCondominio = input.especificacaoCondominio
  }

  return repository.updateClienteBasico(visita.clienteId, updateData)
}

