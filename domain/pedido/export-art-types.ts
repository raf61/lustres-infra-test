/**
 * Types para exportação ART
 */

// export interface ExportARTFilters { } // Removed as we don't filter by date anymore

export interface PedidoParaART {
  id: number
  createdAt: Date
  cliente: {
    id: number
    razaoSocial: string | null
    cnpj: string | null
    cep: string | null
    logradouro: string | null
    numero: string | null
    complemento: string | null
    bairro: string | null
    cidade: string | null
    estado: string | null
    quantidadeAndares: number | null
    especificacaoCondominio: string | null
  }
}

export interface ExportARTRow {
  razaoSocial: string
  cnpj: string
  enderecoCompleto: string
  quantidadeAndares: string
  tipoCondominio: string
}

export interface ExportARTResult {
  pedidosAtualizados: number
  csvContent: string
}

