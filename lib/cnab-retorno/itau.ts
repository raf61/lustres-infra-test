/**
 * Leitura de arquivo de retorno CNAB 400 - Itaú
 * Implementação baseada no sistema legado (Boleto.Net)
 * 
 * Código do Banco: 341
 */

// ============================================
// TIPOS
// ============================================

export interface HeaderRetorno {
  tipoRegistro: number
  codigoRetorno: number
  literalRetorno: string
  codigoServico: number
  literalServico: string
  agencia: number
  complementoRegistro1: number
  conta: number
  dacConta: number
  complementoRegistro2: string
  nomeEmpresa: string
  codigoBanco: number
  nomeBanco: string
  dataGeracao: Date | null
  densidade: number
  unidadeDensidade: string
  numeroSequencialArquivoRetorno: number
  dataCredito: Date | null
  complementoRegistro3: string
  numeroSequencial: number
}

export interface DetalheRetorno {
  registro: string
  codigoInscricao: number
  numeroInscricao: string
  agencia: number
  conta: number
  dacConta: number
  usoEmpresa: string
  carteira: string
  nossoNumeroComDV: string
  nossoNumero: string
  dacNossoNumero: string
  codigoOcorrencia: number
  descricaoOcorrencia: string
  dataOcorrencia: Date | null
  numeroDocumento: string
  dataVencimento: Date | null
  valorTitulo: number
  codigoBanco: number
  bancoCobrador: number
  agenciaCobradora: number
  especie: number
  tarifaCobranca: number
  iof: number
  valorAbatimento: number
  descontos: number
  valorPrincipal: number
  jurosMora: number
  dataCredito: Date | null
  instrucaoCancelada: number
  nomeSacado: string
  erros: string
  codigoLiquidacao: string
  numeroSequencial: number
  valorPago: number
  outrosDebitos: number
  outrosCreditos: number
}

export interface ResultadoProcessamento {
  sucesso: boolean
  mensagem: string
  debitoId: number
  cliente?: string
  valorReceber?: number
  valorRecebido?: number
  vencimento?: Date
  codigoOcorrencia: number
  descricaoOcorrencia: string
  tipo: 'baixado' | 'ja_baixado' | 'nao_localizado' | 'erro' | 'rejeitado' | 'sem_compensacao'
}

export interface ResultadoRetorno {
  header: HeaderRetorno | null
  detalhes: DetalheRetorno[]
  resultados: ResultadoProcessamento[]
  totalTratados: number
  totalErros: number
  nomeArquivo: string
}

// ============================================
// FUNÇÕES AUXILIARES (igual ao legado Utils.cs)
// ============================================

function toInt32(value: string): number {
  const parsed = parseInt(value.trim(), 10)
  return isNaN(parsed) ? 0 : parsed
}

function toDateTime(dateStr: string): Date | null {
  // Formato esperado: DD-MM-YY (após formatação ##-##-##)
  if (!dateStr || dateStr === '00-00-00' || dateStr.replace(/-/g, '') === '000000') {
    return null
  }
  
  try {
    // Remove traços e pega os componentes
    const clean = dateStr.replace(/-/g, '')
    if (clean.length !== 6) return null
    
    const day = parseInt(clean.substring(0, 2), 10)
    const month = parseInt(clean.substring(2, 4), 10)
    let year = parseInt(clean.substring(4, 6), 10)
    
    // Ajuste de século (anos 00-99)
    if (year < 50) {
      year += 2000
    } else {
      year += 1900
    }
    
    if (day === 0 || month === 0) return null
    
    // Usa 12:00 (meio-dia) como horário safe para evitar problemas de timezone
    return new Date(year, month - 1, day, 12, 0, 0)
  } catch {
    return null
  }
}

function formatDateString(num: number): string {
  // Converte número para string no formato ##-##-##
  const str = num.toString().padStart(6, '0')
  return `${str.substring(0, 2)}-${str.substring(2, 4)}-${str.substring(4, 6)}`
}

// ============================================
// DESCRIÇÕES DE OCORRÊNCIAS (igual ao legado Banco_Itau.cs)
// ============================================

function getDescricaoOcorrencia(codigo: string): string {
  // Exatamente igual ao legado Banco_Itau.cs - método Ocorrencia()
  const ocorrencias: Record<string, string> = {
    '02': '02-Entrada Confirmada',
    '03': '03-Entrada Rejeitada',
    '04': '04-Alteração de Dados-Nova entrada ou Alteração/Exclusão de dados acatada',
    '05': '05-Alteração de dados-Baixa',
    '06': '06-Liquidação normal',
    '08': '08-Liquidação em cartório',
    '09': '09-Baixa simples',
    '10': '10-Baixa por ter sido liquidado',
    '11': '11-Em Ser (Só no retorno mensal)',
    '12': '12-Abatimento Concedido',
    '13': '13-Abatimento Cancelado',
    '14': '14-Vencimento Alterado',
    '15': '15-Baixas rejeitadas',
    '16': '16-Instruções rejeitadas',
    '17': '17-Alteração/Exclusão de dados rejeitados',
    '18': '18-Cobrança contratual-Instruções/Alterações rejeitadas/pendentes',
    '19': '19-Confirma Recebimento Instrução de Protesto',
    '20': '20-Confirma Recebimento Instrução Sustação de Protesto/Tarifa',
    '21': '21-Confirma Recebimento Instrução de Não Protestar',
    '23': '23-Título enviado a Cartório/Tarifa',
    '24': '24-Instrução de Protesto Rejeitada/Sustada/Pendente',
    '25': '25-Alegações do Sacado',
    '26': '26-Tarifa de Aviso de Cobrança',
    '27': '27-Tarifa de Extrato Posição',
    '28': '28-Tarifa de Relação das Liquidações',
    '29': '29-Tarifa de Manutenção de Títulos Vencidos',
    '30': '30-Débito Mensal de Tarifas (Para Entradas e Baixas)',
    '32': '32-Baixa por ter sido Protestado',
    '33': '33-Custas de Protesto',
    '34': '34-Custas de Sustação',
    '35': '35-Custas de Cartório Distribuidor',
    '36': '36-Custas de Edital',
    '37': '37-Tarifa de Emissão de Boleto/Tarifa de Envio de Duplicata',
    '38': '38-Tarifa de Instrução',
    '39': '39-Tarifa de Ocorrências',
    '40': '40-Tarifa Mensal de Emissão de Boleto/Tarifa Mensal de Envio de Duplicata',
    '41': '41-Débito Mensal de Tarifas-Extrato de Posição(B4EP/B4OX)',
    '42': '42-Débito Mensal de Tarifas-Outras Instruções',
    '43': '43-Débito Mensal de Tarifas-Manutenção de Títulos Vencidos',
    '44': '44-Débito Mensal de Tarifas-Outras Ocorrências',
    '45': '45-Débito Mensal de Tarifas-Protesto',
    '46': '46-Débito Mensal de Tarifas-Sustação de Protesto',
    '47': '47-Baixa com Transferência para Protesto',
    '48': '48-Custas de Sustação Judicial',
    '51': '51-Tarifa Mensal Ref a Entradas Bancos Correspondentes na Carteira',
    '52': '52-Tarifa Mensal Baixas na Carteira',
    '53': '53-Tarifa Mensal Baixas em Bancos Correspondentes na Carteira',
    '54': '54-Tarifa Mensal de Liquidações na Carteira',
    '55': '55-Tarifa Mensal de Liquidações em Bancos Correspondentes na Carteira',
    '56': '56-Custas de Irregularidade',
    '57': '57-Instrução Cancelada',
    '59': '59-Baixa por Crédito em C/C Através do SISPAG',
    '60': '60-Entrada Rejeitada Carnê',
    '61': '61-Tarifa Emissão Aviso de Movimentação de Títulos',
    '62': '62-Débito Mensal de Tarifa-Aviso de Movimentação de Títulos',
    '63': '63-Título Sustado Judicialmente',
    '64': '64-Entrada Confirmada com Rateio de Crédito',
    '69': '69-Cheque Devolvido',
    '71': '71-Entrada Registrada-Aguardando Avaliação',
    '72': '72-Baixa por Crédito em C/C Através do SISPAG sem Título Correspondente',
    '73': '73-Confirmação de Entrada na Cobrança Simples-Entrada Não Aceita na Cobrança Contratual',
    '76': '76-Cheque Compensado',
  }
  
  return ocorrencias[codigo] || ''
}

function getMotivoRejeicao(codigo: string): string {
  // Exatamente igual ao legado Banco_Itau.cs - método MotivoRejeicao()
  const motivos: Record<string, string> = {
    '03': '03-AG. COBRADORA - CEP SEM ATENDIMENTO DE PROTESTO NO MOMENTO',
    '04': '04-ESTADO - SIGLA DO ESTADO INVÁLIDA',
    '05': '05-DATA VENCIMENTO - PRAZO DA OPERAÇÃO MENOR QUE PRAZO MÍNIMO OU MAIOR QUE O MÁXIMO',
    '07': '07-VALOR DO TÍTULO - VALOR DO TÍTULO MAIOR QUE 10.000.000,00',
    '08': '08-NOME DO PAGADOR - NÃO INFORMADO OU DESLOCADO',
    '09': '09-AGENCIA/CONTA - AGÊNCIA ENCERRADA',
    '10': '10-LOGRADOURO - NÃO INFORMADO OU DESLOCADO',
    '11': '11-CEP - CEP NÃO NUMÉRICO OU CEP INVÁLIDO',
    '12': '12-SACADOR / AVALISTA - NOME NÃO INFORMADO OU DESLOCADO (BANCOS CORRESPONDENTES)',
    '13': '13-ESTADO/CEP - CEP INCOMPATÍVEL COM A SIGLA DO ESTADO',
    '14': '14-NOSSO NÚMERO - NOSSO NÚMERO JÁ REGISTRADO NO CADASTRO DO BANCO OU FORA DA FAIXA',
    '15': '15-NOSSO NÚMERO - NOSSO NÚMERO EM DUPLICIDADE NO MESMO MOVIMENTO',
    '18': '18-DATA DE ENTRADA - DATA DE ENTRADA INVÁLIDA PARA OPERAR COM ESTA CARTEIRA',
    '19': '19-OCORRÊNCIA - OCORRÊNCIA INVÁLIDA',
    '21': '21-AG. COBRADORA - CARTEIRA NÃO ACEITA DEPOSITÁRIA CORRESPONDENTE ESTADO DA AGÊNCIA DIFERENTE DO ESTADO DO PAGADOR AG. COBRADORA NÃO CONSTA NO CADASTRO OU ENCERRANDO',
    '22': '22-CARTEIRA - CARTEIRA NÃO PERMITIDA (NECESSÁRIO CADASTRAR FAIXA LIVRE)',
    '26': '26-AGÊNCIA/CONTA - AGÊNCIA/CONTA NÃO LIBERADA PARA OPERAR COM COBRANÇA',
    '27': '27-CNPJ INAPTO - CNPJ DO BENEFICIÁRIO INAPTO DEVOLUÇÃO DE TÍTULO EM GARANTIA',
    '29': '29-CÓDIGO EMPRESA - CATEGORIA DA CONTA INVÁLIDA',
    '30': '30-ENTRADA BLOQUEADA - ENTRADAS BLOQUEADAS, CONTA SUSPENSA EM COBRANÇA',
    '31': '31-AGÊNCIA/CONTA - CONTA NÃO TEM PERMISSÃO PARA PROTESTAR (CONTATE SEU GERENTE)',
    '35': '35-VALOR DO IOF - IOF MAIOR QUE 5%',
    '36': '36-QTDADE DE MOEDA - QUANTIDADE DE MOEDA INCOMPATÍVEL COM VALOR DO TÍTULO',
    '37': '37-CNPJ/CPF DO PAGADOR - NÃO NUMÉRICO OU IGUAL A ZEROS',
    '42': '42-NOSSO NÚMERO - NOSSO NÚMERO FORA DE FAIXA',
    '52': '52-AG. COBRADORA - EMPRESA NÃO ACEITA BANCO CORRESPONDENTE',
    '53': '53-AG. COBRADORA - EMPRESA NÃO ACEITA BANCO CORRESPONDENTE - COBRANÇA MENSAGEM',
    '54': '54-DATA DE VENCTO - BANCO CORRESPONDENTE - TÍTULO COM VENCIMENTO INFERIOR A 15 DIAS',
    '55': '55-DEP/BCO CORRESP - CEP NÃO PERTENCE À DEPOSITÁRIA INFORMADA',
    '56': '56-DT VENCTO/BCO CORRESP - VENCTO SUPERIOR A 180 DIAS DA DATA DE ENTRADA',
    '57': '57-DATA DE VENCTO - CEP SÓ DEPOSITÁRIA BCO DO BRASIL COM VENCTO INFERIOR A 8 DIAS',
    '60': '60-ABATIMENTO - VALOR DO ABATIMENTO INVÁLIDO',
    '61': '61-JUROS DE MORA - JUROS DE MORA MAIOR QUE O PERMITIDO',
    '62': '62-DESCONTO - VALOR DO DESCONTO MAIOR QUE VALOR DO TÍTULO',
    '63': '63-DESCONTO DE ANTECIPAÇÃO - VALOR DA IMPORTÂNCIA POR DIA DE DESCONTO (IDD) NÃO PERMITIDO',
    '64': '64-DATA DE EMISSÃO - DATA DE EMISSÃO DO TÍTULO INVÁLIDA',
    '65': '65-TAXA FINANCTO - TAXA INVÁLIDA (VENDOR)',
    '66': '66-DATA DE VENCTO - INVALIDA/FORA DE PRAZO DE OPERAÇÃO (MÍNIMO OU MÁXIMO)',
    '67': '67-VALOR/QTIDADE - VALOR DO TÍTULO/QUANTIDADE DE MOEDA INVÁLIDO',
    '68': '68-CARTEIRA - CARTEIRA INVÁLIDA OU NÃO CADASTRADA NO INTERCÂMBIO DA COBRANÇA',
    '69': '69-CARTEIRA - CARTEIRA INVÁLIDA PARA TÍTULOS COM RATEIO DE CRÉDITO',
    '70': '70-AGÊNCIA/CONTA - BENEFICIÁRIO NÃO CADASTRADO PARA FAZER RATEIO DE CRÉDITO',
    '78': '78-AGÊNCIA/CONTA - DUPLICIDADE DE AGÊNCIA/CONTA BENEFICIÁRIA DO RATEIO DE CRÉDITO',
    '80': '80-AGÊNCIA/CONTA - QUANTIDADE DE CONTAS BENEFICIÁRIAS DO RATEIO MAIOR DO QUE O PERMITIDO (MÁXIMO DE 30 CONTAS POR TÍTULO)',
    '81': '81-AGÊNCIA/CONTA - CONTA PARA RATEIO DE CRÉDITO INVÁLIDA / NÃO PERTENCE AO ITAÚ',
    '82': '82-DESCONTO/ABATI-MENTO - DESCONTO/ABATIMENTO NÃO PERMITIDO PARA TÍTULOS COM RATEIO DE CRÉDITO',
    '83': '83-VALOR DO TÍTULO - VALOR DO TÍTULO MENOR QUE A SOMA DOS VALORES ESTIPULADOS PARA RATEIO',
    '84': '84-AGÊNCIA/CONTA - AGÊNCIA/CONTA BENEFICIÁRIA DO RATEIO É A CENTRALIZADORA DE CRÉDITO DO BENEFICIÁRIO',
    '85': '85-AGÊNCIA/CONTA - AGÊNCIA/CONTA DO BENEFICIÁRIO É CONTRATUAL / RATEIO DE CRÉDITO NÃO PERMITIDO',
    '86': '86-TIPO DE VALOR - CÓDIGO DO TIPO DE VALOR INVÁLIDO / NÃO PREVISTO PARA TÍTULOS COM RATEIO DE CRÉDITO',
    '87': '87-AGÊNCIA/CONTA - REGISTRO TIPO 4 SEM INFORMAÇÃO DE AGÊNCIAS/CONTAS BENEFICIÁRIAS DO RATEIO',
    '90': '90-NRO DA LINHA - COBRANÇA MENSAGEM - NÚMERO DA LINHA DA MENSAGEM INVÁLIDO OU QUANTIDADE DE LINHAS EXCEDIDAS',
    '97': '97-SEM MENSAGEM - COBRANÇA MENSAGEM SEM MENSAGEM (SÓ DE CAMPOS FIXOS), PORÉM COM REGISTRO DO TIPO 7 OU 8',
    '98': '98-FLASH INVÁLIDO - REGISTRO MENSAGEM SEM FLASH CADASTRADO OU FLASH INFORMADO DIFERENTE DO CADASTRADO',
    '99': '99-FLASH INVÁLIDO - CONTA DE COBRANÇA COM FLASH CADASTRADO E SEM REGISTRO DE MENSAGEM CORRESPONDENTE',
  }
  
  return motivos[codigo] || ''
}

// ============================================
// PARSER DO HEADER (igual ao legado Banco_Itau.LerHeaderRetornoCNAB400)
// ============================================

export function lerHeaderRetornoCNAB400(registro: string): HeaderRetorno {
  // IMPORTANTE: C# Substring(start, length) vs JS substring(start, end)
  // Convertendo: JS substring(start, start + length)
  
  const dataGeracao = toInt32(registro.substring(94, 94 + 6))      // pos 94, len 6
  const dataCredito = toInt32(registro.substring(113, 113 + 6))    // pos 113, len 6
  
  return {
    tipoRegistro: toInt32(registro.substring(0, 0 + 1)),           // pos 0, len 1
    codigoRetorno: toInt32(registro.substring(1, 1 + 1)),          // pos 1, len 1
    literalRetorno: registro.substring(2, 2 + 7),                  // pos 2, len 7
    codigoServico: toInt32(registro.substring(9, 9 + 2)),          // pos 9, len 2
    literalServico: registro.substring(11, 11 + 15),               // pos 11, len 15
    agencia: toInt32(registro.substring(26, 26 + 4)),              // pos 26, len 4
    complementoRegistro1: toInt32(registro.substring(30, 30 + 2)), // pos 30, len 2
    conta: toInt32(registro.substring(32, 32 + 5)),                // pos 32, len 5
    dacConta: toInt32(registro.substring(37, 37 + 1)),             // pos 37, len 1
    complementoRegistro2: registro.substring(38, 38 + 8),          // pos 38, len 8
    nomeEmpresa: registro.substring(46, 46 + 30),                  // pos 46, len 30
    codigoBanco: toInt32(registro.substring(76, 76 + 3)),          // pos 76, len 3
    nomeBanco: registro.substring(79, 79 + 15),                    // pos 79, len 15
    dataGeracao: toDateTime(formatDateString(dataGeracao)),
    densidade: toInt32(registro.substring(100, 100 + 5)),          // pos 100, len 5
    unidadeDensidade: registro.substring(105, 105 + 3),            // pos 105, len 3
    numeroSequencialArquivoRetorno: toInt32(registro.substring(108, 108 + 5)), // pos 108, len 5
    dataCredito: toDateTime(formatDateString(dataCredito)),
    complementoRegistro3: registro.substring(119, 119 + 275),      // pos 119, len 275
    numeroSequencial: toInt32(registro.substring(394, 394 + 6)),   // pos 394, len 6
  }
}

// ============================================
// PARSER DO DETALHE (igual ao legado Banco_Itau.LerDetalheRetornoCNAB400)
// ============================================

export function lerDetalheRetornoCNAB400(registro: string): DetalheRetorno {
  // IMPORTANTE: C# Substring(start, length) vs JS substring(start, end)
  // Convertendo: JS substring(start, start + length)
  
  const dataOcorrencia = toInt32(registro.substring(110, 110 + 6))   // pos 110, len 6
  const dataVencimento = toInt32(registro.substring(146, 146 + 6))   // pos 146, len 6
  const dataCredito = toInt32(registro.substring(295, 295 + 6))      // pos 295, len 6
  
  const codigoOcorrencia = registro.substring(108, 108 + 2)          // pos 108, len 2
  
  // Parsing de valores monetários (centavos -> reais)
  const valorTitulo = parseInt(registro.substring(152, 152 + 13), 10) / 100       // pos 152, len 13
  console.log(valorTitulo)
  const tarifaCobranca = parseInt(registro.substring(175, 175 + 13), 10) / 100    // pos 175, len 13
  const iof = parseInt(registro.substring(214, 214 + 13), 10) / 100               // pos 214, len 13
  
  const valorAbatimentoStr = registro.substring(227, 227 + 13).trim()             // pos 227, len 13
  const valorAbatimento = valorAbatimentoStr ? parseInt(valorAbatimentoStr, 10) / 100 : 0
  
  const valorDescontos = parseInt(registro.substring(240, 240 + 13), 10) / 100    // pos 240, len 13
  const valorPrincipal = parseInt(registro.substring(253, 253 + 13), 10) / 100    // pos 253, len 13
  const jurosMora = parseInt(registro.substring(266, 266 + 13), 10) / 100         // pos 266, len 13
  
  // Campos de erros - pos 377, len 8
  let erros = registro.substring(377, 377 + 8)
  
  if (erros.trim()) {
    let detalheErro = erros
    
    const motivo1 = getMotivoRejeicao(erros.substring(0, 2))
    const motivo2 = getMotivoRejeicao(erros.substring(2, 4))
    const motivo3 = getMotivoRejeicao(erros.substring(4, 6))
    
    if (motivo1) detalheErro += ' - ' + motivo1
    if (motivo2) detalheErro += ' / ' + motivo2
    if (motivo3) detalheErro += ' / ' + motivo3
    
    erros = detalheErro
  }
  
  return {
    registro,
    codigoInscricao: toInt32(registro.substring(1, 1 + 2)),          // pos 1, len 2
    numeroInscricao: registro.substring(3, 3 + 14),                  // pos 3, len 14
    agencia: toInt32(registro.substring(17, 17 + 4)),                // pos 17, len 4
    conta: toInt32(registro.substring(23, 23 + 5)),                  // pos 23, len 5
    dacConta: toInt32(registro.substring(28, 28 + 1)),               // pos 28, len 1
    usoEmpresa: registro.substring(37, 37 + 25),                     // pos 37, len 25
    carteira: registro.substring(82, 82 + 1),                        // pos 82, len 1 (adicionado por Heric Souza)
    nossoNumeroComDV: registro.substring(85, 85 + 9),                // pos 85, len 9
    nossoNumero: registro.substring(85, 85 + 8),                     // pos 85, len 8 (sem DV)
    dacNossoNumero: registro.substring(93, 93 + 1),                  // pos 93, len 1 (DV)
    codigoOcorrencia: toInt32(codigoOcorrencia),
    descricaoOcorrencia: getDescricaoOcorrencia(codigoOcorrencia),
    dataOcorrencia: toDateTime(formatDateString(dataOcorrencia)),
    numeroDocumento: registro.substring(116, 116 + 10),              // pos 116, len 10
    dataVencimento: toDateTime(formatDateString(dataVencimento)),
    valorTitulo,
    codigoBanco: toInt32(registro.substring(165, 165 + 3)),          // pos 165, len 3
    bancoCobrador: toInt32(registro.substring(165, 165 + 3)),        // pos 165, len 3
    agenciaCobradora: toInt32(registro.substring(168, 168 + 4)),     // pos 168, len 4
    especie: toInt32(registro.substring(173, 173 + 2)),              // pos 173, len 2
    tarifaCobranca,
    iof,
    valorAbatimento,
    descontos: valorDescontos,
    valorPrincipal,
    jurosMora,
    dataCredito: toDateTime(formatDateString(dataCredito)),
    instrucaoCancelada: toInt32(registro.substring(301, 301 + 4)),   // pos 301, len 4
    nomeSacado: registro.substring(324, 324 + 30),                   // pos 324, len 30
    erros,
    codigoLiquidacao: registro.substring(392, 392 + 2),              // pos 392, len 2
    numeroSequencial: toInt32(registro.substring(394, 394 + 6)),     // pos 394, len 6
    valorPago: valorPrincipal, // Conforme legado: ValorPago = ValorPrincipal
    outrosDebitos: 0,
    outrosCreditos: 0,
  }
}

// ============================================
// FUNÇÃO PRINCIPAL DE LEITURA DO ARQUIVO
// ============================================

export function lerArquivoRetornoCNAB400(conteudo: string): { header: HeaderRetorno | null; detalhes: DetalheRetorno[] } {
  const linhas = conteudo.split(/\r?\n/).filter(l => l.length > 0)
  
  if (linhas.length === 0) {
    return { header: null, detalhes: [] }
  }
  
  // Primeira linha é o header
  const header = lerHeaderRetornoCNAB400(linhas[0])
  // Linhas de detalhe começam com "1"
  const detalhes: DetalheRetorno[] = []
  
  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i]
    
    // Identifica se é linha de detalhe (começa com "1")
    if (linha.charAt(0) === '1') {
      const detalhe = lerDetalheRetornoCNAB400(linha)
      detalhes.push(detalhe)
    }
    // Se começar com "9", é o trailer (fim do arquivo)
  }
  
  return { header, detalhes }
}

// ============================================
// CONSTANTES
// ============================================

export const CODIGO_BANCO_ITAU = 341

// Códigos de ocorrência importantes
export const OCORRENCIA = {
  ENTRADA_CONFIRMADA: 2,
  ENTRADA_REJEITADA: 3,
  LIQUIDACAO: 6,
  LIQUIDACAO_PARCIAL: 7,
  BAIXA_SIMPLES: 8,
  BAIXA_POR_PROTESTO: 9,
  BAIXADO_SEM_COMPENSACAO: 29,
} as const

