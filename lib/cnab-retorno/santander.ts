/**
 * Leitura de arquivo de retorno CNAB 240 - Santander
 * Implementação baseada no sistema legado (Boleto.Net)
 * 
 * Código do Banco: 033
 */

// ============================================
// TIPOS
// ============================================

export interface SegmentoTRetorno {
  registro: string
  codigoBanco: number
  idCodigoMovimento: number
  agencia: number
  digitoAgencia: string
  conta: number
  digitoConta: string
  nossoNumero: string
  codigoCarteira: number
  numeroDocumento: string
  dataVencimento: Date | null
  valorTitulo: number
  identificacaoTituloEmpresa: string
  tipoInscricao: number
  numeroInscricao: string
  nomeSacado: string
  valorTarifas: number
  codigoRejeicao: string
  usoFebraban: string
}

export interface SegmentoURetorno {
  registro: string
  codigoOcorrenciaSacado: string
  dataCredito: Date | null
  dataOcorrencia: Date | null
  dataOcorrenciaSacado: Date | null
  jurosMultaEncargos: number
  valorDescontoConcedido: number
  valorAbatimentoConcedido: number
  valorIOFRecolhido: number
  valorPagoPeloSacado: number
  valorLiquidoASerCreditado: number
  valorOutrasDespesas: number
  valorOutrosCreditos: number
}

export interface DetalheRetornoCNAB240 {
  segmentoT: SegmentoTRetorno
  segmentoU: SegmentoURetorno
}

export interface ResultadoProcessamentoSantander {
  sucesso: boolean
  mensagem: string
  debitoId: number
  cliente?: string
  valorReceber?: number
  valorRecebido?: number
  vencimento?: Date
  codigoMovimento: number
  tipo: 'baixado' | 'ja_baixado' | 'nao_localizado' | 'erro' | 'id_invalido' | 'sem_compensacao'
}

export interface ResultadoRetornoSantander {
  detalhes: DetalheRetornoCNAB240[]
  resultados: ResultadoProcessamentoSantander[]
  totalTratados: number
  totalErros: number
  nomeArquivo: string
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function toInt32(value: string): number {
  const parsed = parseInt(value.trim(), 10)
  return isNaN(parsed) ? 0 : parsed
}

function toInt64(value: string): number {
  const parsed = parseInt(value.trim(), 10)
  return isNaN(parsed) ? 0 : parsed
}

function toDateTime(dateStr: string): Date | null {
  // Formato esperado: DDMMYYYY (8 caracteres)
  if (!dateStr || dateStr.length !== 8 || dateStr === '00000000') {
    return null
  }
  
  try {
    const day = parseInt(dateStr.substring(0, 2), 10)
    const month = parseInt(dateStr.substring(2, 4), 10)
    const year = parseInt(dateStr.substring(4, 8), 10)
    
    if (day === 0 || month === 0 || year === 0) return null
    
    // Usa 12:00 (meio-dia) como horário safe para evitar problemas de timezone
    return new Date(year, month - 1, day, 12, 0, 0)
  } catch {
    return null
  }
}

function toDateTimeFromNumber(num: number): Date | null {
  // Formato: número representando DDMMYYYY
  if (!num || num === 0) return null
  
  try {
    const str = num.toString().padStart(8, '0')
    return toDateTime(str)
  } catch {
    return null
  }
}

// ============================================
// PARSER DO SEGMENTO T (igual ao legado Banco_Santander.LerDetalheSegmentoTRetornoCNAB240)
// ============================================

export function lerSegmentoT(registro: string): SegmentoTRetorno {
  // IMPORTANTE: C# Substring(start, length) vs JS substring(start, end)
  
  // Validação
  if (registro.substring(13, 13 + 1) !== 'T') {
    throw new Error('Registro inválido. O detalhe não possuí as características do segmento T.')
  }
  
  const valorTitulo = toInt64(registro.substring(77, 77 + 15)) / 100
  const valorTarifas = toInt64(registro.substring(193, 193 + 15)) / 100
  const dataVencimentoStr = registro.substring(69, 69 + 8)
  
  return {
    registro,
    codigoBanco: toInt32(registro.substring(0, 0 + 3)),                    // pos 0, len 3
    idCodigoMovimento: toInt32(registro.substring(15, 15 + 2)),            // pos 15, len 2
    agencia: toInt32(registro.substring(17, 17 + 4)),                      // pos 17, len 4
    digitoAgencia: registro.substring(21, 21 + 1),                         // pos 21, len 1
    conta: toInt32(registro.substring(22, 22 + 9)),                        // pos 22, len 9
    digitoConta: registro.substring(31, 31 + 1),                           // pos 31, len 1
    nossoNumero: registro.substring(40, 40 + 13),                          // pos 40, len 13
    codigoCarteira: toInt32(registro.substring(53, 53 + 1)),               // pos 53, len 1
    numeroDocumento: registro.substring(54, 54 + 15),                      // pos 54, len 15
    dataVencimento: toDateTime(dataVencimentoStr),                         // pos 69, len 8
    valorTitulo,                                                           // pos 77, len 15
    identificacaoTituloEmpresa: registro.substring(100, 100 + 25),         // pos 100, len 25
    tipoInscricao: toInt32(registro.substring(127, 127 + 1)),              // pos 127, len 1
    numeroInscricao: registro.substring(128, 128 + 15),                    // pos 128, len 15
    nomeSacado: registro.substring(143, 143 + 40),                         // pos 143, len 40
    valorTarifas,                                                          // pos 193, len 15
    codigoRejeicao: registro.substring(208, 208 + 10),                     // pos 208, len 10
    usoFebraban: registro.substring(218, 218 + 22),                        // pos 218, len 22
  }
}

// ============================================
// PARSER DO SEGMENTO U (igual ao legado Banco_Santander.LerDetalheSegmentoURetornoCNAB240)
// ============================================

export function lerSegmentoU(registro: string): SegmentoURetorno {
  // IMPORTANTE: C# Substring(start, length) vs JS substring(start, end)
  
  // Validação
  if (registro.substring(13, 13 + 1) !== 'U') {
    throw new Error('Registro inválido. O detalhe não possuí as características do segmento U.')
  }
  
  const dataCreditoNum = toInt32(registro.substring(145, 145 + 8))
  const dataOcorrenciaNum = toInt32(registro.substring(137, 137 + 8))
  const dataOcorrenciaSacadoNum = toInt32(registro.substring(157, 157 + 8))
  
  return {
    registro,
    codigoOcorrenciaSacado: registro.substring(15, 15 + 2),                // pos 15, len 2
    dataCredito: toDateTimeFromNumber(dataCreditoNum),                     // pos 145, len 8
    dataOcorrencia: toDateTimeFromNumber(dataOcorrenciaNum),               // pos 137, len 8
    dataOcorrenciaSacado: dataOcorrenciaSacadoNum > 0 
      ? toDateTimeFromNumber(dataOcorrenciaSacadoNum) 
      : new Date(),                                                        // pos 157, len 8
    jurosMultaEncargos: toInt64(registro.substring(17, 17 + 15)) / 100,    // pos 17, len 15
    valorDescontoConcedido: toInt64(registro.substring(32, 32 + 15)) / 100,// pos 32, len 15
    valorAbatimentoConcedido: toInt64(registro.substring(47, 47 + 15)) / 100,// pos 47, len 15
    valorIOFRecolhido: toInt64(registro.substring(62, 62 + 15)) / 100,     // pos 62, len 15
    valorPagoPeloSacado: toInt64(registro.substring(77, 77 + 15)) / 100,   // pos 77, len 15
    valorLiquidoASerCreditado: toInt64(registro.substring(92, 92 + 15)) / 100, // pos 92, len 15
    valorOutrasDespesas: toInt64(registro.substring(107, 107 + 15)) / 100, // pos 107, len 15
    valorOutrosCreditos: toInt64(registro.substring(122, 122 + 15)) / 100, // pos 122, len 15
  }
}

// ============================================
// FUNÇÃO PRINCIPAL DE LEITURA DO ARQUIVO
// (igual ao legado ArquivoRetornoCNAB240.LerArquivoRetorno)
// ============================================

export function lerArquivoRetornoCNAB240(conteudo: string): DetalheRetornoCNAB240[] {
  const linhas = conteudo.split(/\r?\n/).filter(l => l.length > 0)
  const detalhes: DetalheRetornoCNAB240[] = []
  
  let i = 0
  while (i < linhas.length) {
    const linha = linhas[i]
    
    if (linha.length < 14) {
      i++
      continue
    }
    
    // Posição 7 (0-indexed) indica o tipo de registro
    const tipoRegistro = linha.substring(7, 8)
    
    switch (tipoRegistro) {
      case '0': // Header de arquivo
        break
      case '1': // Header de lote
        break
      case '3': // Detalhe
        const tipoSegmento = linha.substring(13, 14)
        
        if (tipoSegmento === 'T') {
          // Lê Segmento T e em sequência o Segmento U
          const segmentoT = lerSegmentoT(linha)
          
          // Próxima linha deve ser Segmento U
          i++
          if (i < linhas.length) {
            const linhaU = linhas[i]
            const segmentoU = lerSegmentoU(linhaU)
            
            detalhes.push({
              segmentoT,
              segmentoU,
            })
          }
        }
        // Outros segmentos (W, E) são ignorados como no legado para Santander
        break
      case '5': // Trailer de lote
        break
      case '9': // Trailer de arquivo
        break
    }
    
    i++
  }
  
  return detalhes
}

// ============================================
// CONSTANTES
// ============================================

export const CODIGO_BANCO_SANTANDER = 33

// Códigos de movimento importantes (CNAB 240)
export const MOVIMENTO_SANTANDER = {
  ENTRADA_CONFIRMADA: 2,
  ENTRADA_REJEITADA: 3,
  LIQUIDACAO: 6,
  BAIXADO_SEM_COMPENSACAO: 29,
} as const

