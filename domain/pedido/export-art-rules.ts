/**
 * Regras de negócio para exportação ART
 * Funções puras - sem dependências externas
 */

import { formatCNPJ, formatCEP } from "@/lib/formatters"
import { getEspecificacaoCondominioLabel } from "@/lib/constants/especificacao-condominio"
import type { PedidoParaART, ExportARTRow } from "./export-art-types"

/**
 * Formata o endereço completo do cliente
 */
export function formatEnderecoCompleto(cliente: PedidoParaART["cliente"]): string {
  const parts: string[] = []

  if (cliente.logradouro) {
    let endereco = cliente.logradouro
    if (cliente.numero) endereco += `, ${cliente.numero}`
    if (cliente.complemento) endereco += ` - ${cliente.complemento}`
    parts.push(endereco)
  }

  if (cliente.bairro) parts.push(cliente.bairro)
  if (cliente.cidade) parts.push(cliente.cidade)
  if (cliente.estado) parts.push(cliente.estado)
  if (cliente.cep) parts.push(`CEP: ${formatCEP(cliente.cep)}`)

  return parts.join(", ") || ""
}

/**
 * Transforma um pedido em uma linha para o CSV
 */
export function pedidoToARTRow(pedido: PedidoParaART): ExportARTRow {
  const cliente = pedido.cliente

  return {
    razaoSocial: cliente.razaoSocial ?? "",
    cnpj: formatCNPJ(cliente.cnpj),
    enderecoCompleto: formatEnderecoCompleto(cliente),
    quantidadeAndares: cliente.quantidadeAndares?.toString() ?? "",
    tipoCondominio: getEspecificacaoCondominioLabel(cliente.especificacaoCondominio as any) === "—" 
      ? "" 
      : getEspecificacaoCondominioLabel(cliente.especificacaoCondominio as any),
  }
}

/**
 * Gera o conteúdo CSV a partir de uma lista de linhas
 */
export function generateCSVContent(rows: ExportARTRow[]): string {
  const headers = ["Razão Social", "CNPJ", "Endereço Completo", "Quantidade de Andares", "Tipo Condomínio"]
  
  const escapeCSV = (value: string): string => {
    // Se contém vírgula, aspas ou quebra de linha, envolve em aspas
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  const lines = [
    headers.join(","),
    ...rows.map(row => [
      escapeCSV(row.razaoSocial),
      escapeCSV(row.cnpj),
      escapeCSV(row.enderecoCompleto),
      escapeCSV(row.quantidadeAndares),
      escapeCSV(row.tipoCondominio),
    ].join(","))
  ]

  return lines.join("\n")
}


