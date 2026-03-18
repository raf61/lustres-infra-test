// @ts-nocheck
// CNAB 240 - Santander - Cobrança
// Baseado no Manual do Cliente de Cobrança - Troca de Arquivos Padrão CNAB
// Validado e igual ao legado.
// ===== TIPOS =====
export type CedenteBanco = {
  nome: string
  razaoSocial: string
  cnpj: string
  bancoCodigo: number
  agencia: string
  agenciaDigito?: string | null
  conta: string
  contaDigito?: string | null
  carteira: string
  codigoTransmissao?: string | null
}

export type Sacado = {
  razaoSocial?: string | null
  cnpj?: string | null
  cep?: string | null
  cidade?: string | null
  estado?: string | null
  logradouro?: string | null
  numero?: string | null
  bairro?: string | null
  complemento?: string | null
}

export type DebitoParaRemessa = {
  id: number
  receber: number
  vencimento: Date
  cliente: Sacado
  // Multa (opcional - se presente, gera Segmento R)
  valorMulta?: number | null       // Valor fixo da multa
  percMulta?: number | null        // Percentual da multa
  dataMulta?: Date | null          // Data a partir de quando cobra multa
  // Juros de mora (opcional - se não informado, calcula 1.99% ao dia)
  jurosMora?: number | null        // Valor do juros de mora por dia
  codJurosMora?: string | null     // 1 = valor/dia, 2 = taxa mensal, 3 = isento
}

// ===== HELPERS =====
const onlyDigits = (val = '') => (val || '').toString().replace(/\D/g, '')

// Remove acentos e caracteres especiais (igual ao legado SubstituiCaracteresEspeciais)
const removeAcentos = (text: string): string => {
  if (!text) return ''
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove marcas de acentuação
    .replace(/[^0-9a-zA-Z.,@\- ]/g, ' ') // Substitui caracteres especiais por espaço
    .replace(/&/g, 'e')
}

// Calcula juros de mora diário (1.99% ao dia, arredondado para baixo)
// Mesmo cálculo do sistema legado: Math.Floor(valor * 1.99m / 100 * 100) / 100
const calculaMora = (valor: number): number => {
  return Math.floor(valor * 1.99 / 100 * 100) / 100
}

const dateToDdMmYyyy = (value?: Date | string) => {
  const d = value ? new Date(value) : new Date()
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const year = d.getFullYear().toString().padStart(4, '0')
  return `${day}${month}${year}`
}

const formatText = (value: any, size: number) => 
  removeAcentos((value || '').toString()).toUpperCase().slice(0, size).padEnd(size, ' ')

const formatNumber = (value: any, size: number) => {
  const str = (value || '').toString().replace(/\D/g, '')
  return str.padStart(size, '0').slice(-size)
}

const formatCurrency = (value: number, intSize: number, decSize: number) => {
  const val = Math.abs(Number(value) || 0) // Garante valor positivo
  const parts = val.toFixed(decSize).split('.')
  const intPart = parts[0].padStart(intSize, '0').slice(-intSize)
  const decPart = (parts[1] || '').padEnd(decSize, '0').slice(0, decSize)
  return intPart + decPart
}

// DV do nosso número Santander (mod 11, pesos 2-9)
const mod11Santander = (texto: string): string => {
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9]
  let soma = 0
  let idx = 0
  for (let i = texto.length - 1; i >= 0; i--) {
    soma += Number(texto[i]) * pesos[idx % pesos.length]
    idx++
  }
  const resto = soma % 11
  if (resto <= 1) return '0'
  const dv = 11 - resto
  return dv > 9 ? '0' : String(dv)
}

// ===== LAYOUTS POSICIONAIS (CNAB 240) =====

// REGISTRO HEADER DO ARQUIVO REMESSA (tipo 0, lote 0000)
const layoutHeaderArquivo = {
  // Controle
  codigo_banco:           { pos: [1, 3],     picture: '9(03)',  default: '033' },
  lote_servico:           { pos: [4, 7],     picture: '9(04)',  default: '0000' },
  tipo_registro:          { pos: [8, 8],     picture: '9(01)',  default: '0' },
  // Uso Febraban
  reservado_1:            { pos: [9, 16],    picture: 'X(08)',  default: '' },
  // Empresa
  tipo_inscricao:         { pos: [17, 17],   picture: '9(01)',  default: '2' }, // 1=CPF, 2=CNPJ
  numero_inscricao:       { pos: [18, 32],   picture: '9(15)' },
  codigo_transmissao:     { pos: [33, 47],   picture: '9(15)' },
  reservado_2:            { pos: [48, 72],   picture: 'X(25)',  default: '' },
  nome_empresa:           { pos: [73, 102],  picture: 'X(30)' },
  // Banco
  nome_banco:             { pos: [103, 132], picture: 'X(30)',  default: 'BANCO SANTANDER' },
  reservado_3:            { pos: [133, 142], picture: 'X(10)',  default: '' },
  // Arquivo
  codigo_remessa:         { pos: [143, 143], picture: '9(01)',  default: '1' }, // 1=Remessa
  data_geracao:           { pos: [144, 151], picture: '9(08)' }, // DDMMAAAA
  reservado_4:            { pos: [152, 157], picture: 'X(06)',  default: '' },
  numero_sequencial:      { pos: [158, 163], picture: '9(06)' },
  versao_layout:          { pos: [164, 166], picture: '9(03)',  default: '040' },
  reservado_5:            { pos: [167, 240], picture: 'X(74)',  default: '' },
}

// REGISTRO HEADER DO LOTE REMESSA (tipo 1, lote 0001)
const layoutHeaderLote = {
  // Controle
  codigo_banco:           { pos: [1, 3],     picture: '9(03)',  default: '033' },
  numero_lote:            { pos: [4, 7],     picture: '9(04)',  default: '0001' },
  tipo_registro:          { pos: [8, 8],     picture: '9(01)',  default: '1' },
  // Serviço
  tipo_operacao:          { pos: [9, 9],     picture: 'X(01)',  default: 'R' }, // R = Remessa
  tipo_servico:           { pos: [10, 11],   picture: '9(02)',  default: '01' }, // 01 = Cobrança
  reservado_1:            { pos: [12, 13],   picture: 'X(02)',  default: '' },
  versao_layout_lote:     { pos: [14, 16],   picture: '9(03)',  default: '030' },
  reservado_2:            { pos: [17, 17],   picture: 'X(01)',  default: '' },
  // Empresa
  tipo_inscricao:         { pos: [18, 18],   picture: '9(01)',  default: '2' }, // 1=CPF, 2=CNPJ
  numero_inscricao:       { pos: [19, 33],   picture: '9(15)' },
  reservado_3:            { pos: [34, 53],   picture: 'X(20)',  default: '' },
  codigo_transmissao:     { pos: [54, 68],   picture: '9(15)' },
  reservado_4:            { pos: [69, 73],   picture: 'X(05)',  default: '' },
  nome_beneficiario:      { pos: [74, 103],  picture: 'X(30)' },
  // Mensagens
  mensagem_1:             { pos: [104, 143], picture: 'X(40)',  default: '' },
  mensagem_2:             { pos: [144, 183], picture: 'X(40)',  default: '' },
  // Controle Remessa
  numero_remessa:         { pos: [184, 191], picture: '9(08)' },
  data_gravacao:          { pos: [192, 199], picture: '9(08)' }, // DDMMAAAA
  reservado_5:            { pos: [200, 240], picture: 'X(41)',  default: '' },
}

// REGISTRO DETALHE - SEGMENTO P (tipo 3, obrigatório)
const layoutSegmentoP = {
  // Controle
  codigo_banco:           { pos: [1, 3],     picture: '9(03)',  default: '033' },
  numero_lote:            { pos: [4, 7],     picture: '9(04)',  default: '0001' },
  tipo_registro:          { pos: [8, 8],     picture: '9(01)',  default: '3' },
  numero_sequencial:      { pos: [9, 13],    picture: '9(05)' },
  codigo_segmento:        { pos: [14, 14],   picture: 'X(01)',  default: 'P' },
  reservado_1:            { pos: [15, 15],   picture: 'X(01)',  default: '' },
  codigo_movimento:       { pos: [16, 17],   picture: '9(02)',  default: '01' }, // 01 = Entrada de título
  // Conta
  agencia:                { pos: [18, 21],   picture: '9(04)' },
  agencia_digito:         { pos: [22, 22],   picture: '9(01)' },
  conta_corrente:         { pos: [23, 31],   picture: '9(09)' },
  conta_digito:           { pos: [32, 32],   picture: '9(01)' },
  conta_cobranca:         { pos: [33, 41],   picture: '9(09)' }, // Mesmo que conta corrente
  conta_cobranca_digito:  { pos: [42, 42],   picture: '9(01)' },
  reservado_2:            { pos: [43, 44],   picture: 'X(02)',  default: '' },
  // Identificação do Título
  nosso_numero:           { pos: [45, 57],   picture: '9(13)' }, // 12 dígitos + DV
  tipo_cobranca:          { pos: [58, 58],   picture: '9(01)',  default: '5' }, // 5 = Cobrança sem registro
  forma_cadastramento:    { pos: [59, 59],   picture: '9(01)',  default: '1' }, // 1 = Com cadastramento
  tipo_documento:         { pos: [60, 60],   picture: '9(01)',  default: '1' }, // 1 = Tradicional
  reservado_3:            { pos: [61, 61],   picture: 'X(01)',  default: '' },
  reservado_4:            { pos: [62, 62],   picture: 'X(01)',  default: '' },
  numero_documento:       { pos: [63, 77],   picture: 'X(15)' }, // Seu número
  // Vencimento e Valor
  data_vencimento:        { pos: [78, 85],   picture: '9(08)' }, // DDMMAAAA
  valor_nominal:          { pos: [86, 100],  picture: '9(13)V9(2)' }, // 13 inteiros + 2 decimais
  // Agência Cobradora
  agencia_cobradora:      { pos: [101, 104], picture: '9(04)',  default: '0000' },
  agencia_cobradora_dv:   { pos: [105, 105], picture: '9(01)',  default: '0' },
  reservado_5:            { pos: [106, 106], picture: 'X(01)',  default: '' },
  // Espécie e Aceite
  especie_titulo:         { pos: [107, 108], picture: '9(02)',  default: '02' }, // 02 = DM Duplicata Mercantil
  aceite:                 { pos: [109, 109], picture: 'X(01)',  default: 'N' }, // N = Não aceite
  data_emissao:           { pos: [110, 117], picture: '9(08)' }, // DDMMAAAA
  // Juros de Mora
  codigo_juros:           { pos: [118, 118], picture: '9(01)',  default: '3' }, // 3 = Isento
  data_juros:             { pos: [119, 126], picture: '9(08)',  default: '00000000' },
  valor_juros:            { pos: [127, 141], picture: '9(13)V9(2)', default: '000000000000000' },
  // Desconto
  codigo_desconto:        { pos: [142, 142], picture: '9(01)',  default: '0' }, // 0 = Sem desconto
  data_desconto:          { pos: [143, 150], picture: '9(08)',  default: '00000000' },
  valor_desconto:         { pos: [151, 165], picture: '9(13)V9(2)', default: '000000000000000' },
  // IOF e Abatimento
  valor_iof:              { pos: [166, 180], picture: '9(13)V9(2)', default: '000000000000000' },
  valor_abatimento:       { pos: [181, 195], picture: '9(13)V9(2)', default: '000000000000000' },
  // Identificação na Empresa
  identificacao_empresa:  { pos: [196, 220], picture: 'X(25)' },
  // Protesto
  codigo_protesto:        { pos: [221, 221], picture: '9(01)',  default: '0' }, // 0 = Não protestar
  dias_protesto:          { pos: [222, 223], picture: '9(02)',  default: '00' },
  // Baixa/Devolução
  codigo_baixa:           { pos: [224, 224], picture: '9(01)',  default: '3' }, // 3 = Utilizar dias do cadastro
  reservado_6:            { pos: [225, 225], picture: '9(01)',  default: '0' }, // Zero fixo
  dias_baixa:             { pos: [226, 227], picture: '9(02)',  default: '00' },
  // Moeda
  codigo_moeda:           { pos: [228, 229], picture: '9(02)',  default: '00' },
  reservado_7:            { pos: [230, 240], picture: 'X(11)',  default: '' },
}

// REGISTRO DETALHE - SEGMENTO Q (tipo 3, obrigatório - dados do pagador/sacado)
const layoutSegmentoQ = {
  // Controle
  codigo_banco:           { pos: [1, 3],     picture: '9(03)',  default: '033' },
  numero_lote:            { pos: [4, 7],     picture: '9(04)',  default: '0001' },
  tipo_registro:          { pos: [8, 8],     picture: '9(01)',  default: '3' },
  numero_sequencial:      { pos: [9, 13],    picture: '9(05)' },
  codigo_segmento:        { pos: [14, 14],   picture: 'X(01)',  default: 'Q' },
  reservado_1:            { pos: [15, 15],   picture: 'X(01)',  default: '' },
  codigo_movimento:       { pos: [16, 17],   picture: '9(02)',  default: '01' }, // 01 = Entrada de título
  // Dados do Pagador (Sacado)
  tipo_inscricao_pagador:     { pos: [18, 18],   picture: '9(01)' }, // 1=CPF, 2=CNPJ
  numero_inscricao_pagador:   { pos: [19, 33],   picture: '9(15)' },
  nome_pagador:               { pos: [34, 73],   picture: 'X(40)' },
  endereco_pagador:           { pos: [74, 113],  picture: 'X(40)' },
  bairro_pagador:             { pos: [114, 128], picture: 'X(15)' },
  cep_pagador:                { pos: [129, 133], picture: '9(05)' },
  cep_sufixo_pagador:         { pos: [134, 136], picture: '9(03)' },
  cidade_pagador:             { pos: [137, 151], picture: 'X(15)' },
  uf_pagador:                 { pos: [152, 153], picture: 'X(02)' },
  // Dados do Beneficiário Final (Sacador/Avalista) - não usamos
  tipo_inscricao_avalista:    { pos: [154, 154], picture: '9(01)',  default: '0' },
  numero_inscricao_avalista:  { pos: [155, 169], picture: '9(15)',  default: '000000000000000' },
  nome_avalista:              { pos: [170, 209], picture: 'X(40)',  default: '' },
  // Reservados (uso Banco) - no legado: identificador carnê, parcela, qtd, plano
  reservado_2:            { pos: [210, 212], picture: '9(03)',  default: '000' },
  reservado_3:            { pos: [213, 215], picture: '9(03)',  default: '000' },
  reservado_4:            { pos: [216, 218], picture: '9(03)',  default: '000' },
  reservado_5:            { pos: [219, 221], picture: '9(03)',  default: '000' },
  reservado_6:            { pos: [222, 240], picture: 'X(19)',  default: '' },
}

// REGISTRO DETALHE - SEGMENTO R (tipo 3, opcional - multa e descontos adicionais)
const layoutSegmentoR = {
  // Controle
  codigo_banco:           { pos: [1, 3],     picture: '9(03)',  default: '033' },
  numero_lote:            { pos: [4, 7],     picture: '9(04)',  default: '0001' },
  tipo_registro:          { pos: [8, 8],     picture: '9(01)',  default: '3' },
  numero_sequencial:      { pos: [9, 13],    picture: '9(05)' },
  codigo_segmento:        { pos: [14, 14],   picture: 'X(01)',  default: 'R' },
  reservado_1:            { pos: [15, 15],   picture: 'X(01)',  default: '' },
  codigo_movimento:       { pos: [16, 17],   picture: '9(02)',  default: '01' }, // 01 = Entrada de título
  // Desconto 2
  codigo_desconto_2:      { pos: [18, 18],   picture: '9(01)',  default: '0' }, // 0=Sem, 1=Valor fixo, 2=Percentual
  data_desconto_2:        { pos: [19, 26],   picture: '9(08)',  default: '00000000' }, // DDMMAAAA
  valor_desconto_2:       { pos: [27, 41],   picture: '9(13)V9(2)', default: '000000000000000' },
  // Desconto 3 (deprecado no legado - 24 espaços)
  codigo_desconto_3:      { pos: [42, 42],   picture: 'X(01)',  default: '' },
  data_desconto_3:        { pos: [43, 50],   picture: 'X(08)',  default: '' },
  valor_desconto_3:       { pos: [51, 65],   picture: 'X(15)',  default: '' },
  // Multa
  codigo_multa:           { pos: [66, 66],   picture: '9(01)',  default: '0' }, // 0=Sem, 1=Valor fixo, 2=Percentual
  data_multa:             { pos: [67, 74],   picture: '9(08)',  default: '00000000' }, // DDMMAAAA
  valor_multa:            { pos: [75, 89],   picture: '9(13)V9(2)', default: '000000000000000' },
  // Reservado
  reservado_2:            { pos: [90, 99],   picture: 'X(10)',  default: '' },
  // Mensagens
  mensagem_3:             { pos: [100, 139], picture: 'X(40)',  default: '' },
  mensagem_4:             { pos: [140, 179], picture: 'X(40)',  default: '' },
  // Reservado final
  reservado_3:            { pos: [180, 240], picture: 'X(61)',  default: '' },
}

// REGISTRO DETALHE - SEGMENTO S (tipo 3, obrigatório para entrada de título - mensagens)
const layoutSegmentoS = {
  // Controle
  codigo_banco:           { pos: [1, 3],     picture: '9(03)',  default: '033' },
  numero_lote:            { pos: [4, 7],     picture: '9(04)',  default: '0001' },
  tipo_registro:          { pos: [8, 8],     picture: '9(01)',  default: '3' },
  numero_sequencial:      { pos: [9, 13],    picture: '9(05)' },
  codigo_segmento:        { pos: [14, 14],   picture: 'X(01)',  default: 'S' },
  reservado_1:            { pos: [15, 15],   picture: 'X(01)',  default: '' },
  codigo_movimento:       { pos: [16, 17],   picture: '9(02)',  default: '01' }, // 01 = Entrada de título
  // Impressão
  identificacao_impressao: { pos: [18, 18],  picture: '9(01)',  default: '2' }, // 2 = Comercial
  // Mensagens (5 campos de 40 caracteres cada)
  mensagem_5:             { pos: [19, 58],   picture: 'X(40)',  default: '' },
  mensagem_6:             { pos: [59, 98],   picture: 'X(40)',  default: '' },
  mensagem_7:             { pos: [99, 138],  picture: 'X(40)',  default: '' },
  mensagem_8:             { pos: [139, 178], picture: 'X(40)',  default: '' },
  mensagem_9:             { pos: [179, 218], picture: 'X(40)',  default: '' },
  // Reservado final
  reservado_2:            { pos: [219, 240], picture: 'X(22)',  default: '' },
}

// REGISTRO TRAILER DE LOTE (tipo 5)
const layoutTrailerLote = {
  // Controle
  codigo_banco:           { pos: [1, 3],     picture: '9(03)',  default: '033' },
  numero_lote:            { pos: [4, 7],     picture: '9(04)',  default: '0001' },
  tipo_registro:          { pos: [8, 8],     picture: '9(01)',  default: '5' },
  // Reservado
  reservado_1:            { pos: [9, 17],    picture: 'X(09)',  default: '' },
  // Totalizadores
  quantidade_registros:   { pos: [18, 23],   picture: '9(06)' },
  // Reservado final
  reservado_2:            { pos: [24, 240],  picture: 'X(217)', default: '' },
}

// REGISTRO TRAILER DE ARQUIVO (tipo 9, lote 9999)
const layoutTrailerArquivo = {
  // Controle
  codigo_banco:           { pos: [1, 3],     picture: '9(03)',  default: '033' },
  numero_lote:            { pos: [4, 7],     picture: '9(04)',  default: '9999' },
  tipo_registro:          { pos: [8, 8],     picture: '9(01)',  default: '9' },
  // Reservado
  reservado_1:            { pos: [9, 17],    picture: 'X(09)',  default: '' },
  // Totalizadores
  quantidade_lotes:       { pos: [18, 23],   picture: '9(06)',  default: '000001' }, // Sempre 1 lote
  quantidade_registros:   { pos: [24, 29],   picture: '9(06)' },
  // Reservado final
  reservado_2:            { pos: [30, 240],  picture: 'X(211)', default: '' },
}

// ===== FUNÇÃO DE FORMATAÇÃO POR PICTURE =====
const usePicture = (picture: string, value: any, fieldLen: number): string => {
  // Trata valores monetários: 9(13)V9(2) = 13 inteiros + 2 decimais
  if (picture.indexOf('V9') > 0) {
    const match = /9\((\d+)\).*V9\((\d+)\)/.exec(picture)
    const intSize = match ? Number(match[1]) : 0
    const decSize = match ? Number(match[2]) : 0
    return formatCurrency(Number(value) || 0, intSize, decSize)
  }
  
  // Trata numéricos: 9(XX) - alinha à direita com zeros
  if (picture.startsWith('9')) {
    return formatNumber(value, fieldLen)
  }
  
  // Trata alfanuméricos: X(XX) - alinha à esquerda com espaços
  return formatText(value, fieldLen)
}

// ===== FUNÇÃO DE ESCRITA DE LINHA =====
const writeLine = (layout: Record<string, any>, data: Record<string, any>) => {
  const buffer = new Array(240).fill(' ')
  
  Object.keys(layout).forEach((key) => {
    const item = layout[key]
    const pos = item.pos
    if (!pos) return
    
    const value = key in data && data[key] !== undefined && data[key] !== null 
      ? data[key] 
      : item.default ?? ''
    
    const fieldLen = pos[1] - pos[0] + 1
    const formatted = usePicture(item.picture, value, fieldLen)
    
    for (let i = 0; i < fieldLen; i++) {
      buffer[pos[0] - 1 + i] = formatted[i] || ' '
    }
  })
  
  return buffer.join('')
}

// ===== GERADOR =====
export function generateSantanderRemessa({
  cedente,
  debitos,
  sequencialArquivo,
}: {
  cedente: CedenteBanco
  debitos: DebitoParaRemessa[]
  sequencialArquivo: number
}) {
  const linhas: string[] = []
  
  const hoje = new Date()
  const cnpjLimpo = onlyDigits(cedente.cnpj).padStart(15, '0')
  const codigoTransmissao = onlyDigits(cedente.codigoTransmissao || '').padStart(15, '0')
  
  // ===== HEADER DO ARQUIVO =====
  const headerArquivo = writeLine(layoutHeaderArquivo, {
    tipo_inscricao: '2', // CNPJ
    numero_inscricao: cnpjLimpo,
    codigo_transmissao: codigoTransmissao,
    nome_empresa: cedente.razaoSocial,
    data_geracao: dateToDdMmYyyy(hoje),
    numero_sequencial: sequencialArquivo,
  })
  linhas.push(headerArquivo)
  
  // ===== HEADER DO LOTE =====
  const headerLote = writeLine(layoutHeaderLote, {
    tipo_inscricao: '2', // CNPJ
    numero_inscricao: cnpjLimpo,
    codigo_transmissao: codigoTransmissao,
    nome_beneficiario: cedente.razaoSocial,
    numero_remessa: sequencialArquivo,
    data_gravacao: dateToDdMmYyyy(hoje),
  })
  linhas.push(headerLote)
  
  // Dados da conta
  const agencia = onlyDigits(cedente.agencia).padStart(4, '0')
  const agenciaDigito = onlyDigits(cedente.agenciaDigito || '0').slice(-1)
  const conta = onlyDigits(cedente.conta).padStart(9, '0')
  const contaDigito = onlyDigits(cedente.contaDigito || '0').slice(-1)
  
  // ===== SEGMENTOS P (um por débito) =====
  let sequencialRegistro = 0
  
  debitos.forEach((debito) => {
    sequencialRegistro++
    
    // Nosso número: 12 dígitos + DV
    const nossoNumeroBase = String(debito.id).padStart(12, '0')
    const nossoNumeroDV = mod11Santander(nossoNumeroBase)
    const nossoNumero = nossoNumeroBase + nossoNumeroDV
    
    // Juros de mora (igual ao legado: 1.99% ao dia)
    // Se jurosMora informado, usa; senão calcula 1.99% ao dia
    const jurosMoraCalculado = debito.jurosMora ?? calculaMora(debito.receber)
    
    // Código: 1 = valor/dia, 2 = taxa mensal, 3 = isento
    // IMPORTANTE: Se valor <= 0, código DEVE ser '3' (isento), senão dá erro no banco!
    let codigoJuros: string
    let dataJuros: string
    let valorJuros: number
    
    if (jurosMoraCalculado > 0) {
      codigoJuros = debito.codJurosMora || '1' // valor por dia
      dataJuros = dateToDdMmYyyy(debito.vencimento)
      valorJuros = jurosMoraCalculado
    } else {
      codigoJuros = '3' // isento (igual legado quando JurosMora <= 0)
      dataJuros = '00000000'
      valorJuros = 0
    }
    
    const segmentoP = writeLine(layoutSegmentoP, {
      numero_sequencial: sequencialRegistro,
      agencia: agencia,
      agencia_digito: agenciaDigito,
      conta_corrente: conta,
      conta_digito: contaDigito,
      conta_cobranca: conta,
      conta_cobranca_digito: contaDigito,
      nosso_numero: nossoNumero,
      numero_documento: String(debito.id), // X(15) = alfanumérico, espaços à direita
      data_vencimento: dateToDdMmYyyy(debito.vencimento),
      valor_nominal: debito.receber, // usePicture formata com 9(13)V9(2)
      data_emissao: dateToDdMmYyyy(hoje),
      codigo_juros: codigoJuros,
      data_juros: dataJuros,
      valor_juros: valorJuros, // usePicture formata com 9(13)V9(2)
      identificacao_empresa: String(debito.id),
    })
    linhas.push(segmentoP)
    
    // Segmento Q - Dados do pagador (obrigatório, sempre após P)
    sequencialRegistro++
    
    const cliente = debito.cliente
    const cnpjCpfPagador = onlyDigits(cliente.cnpj || '')
    const tipoPagador = cnpjCpfPagador.length <= 11 ? '1' : '2' // 1=CPF, 2=CNPJ
    
    // CEP: separa prefixo (5 dígitos) e sufixo (3 dígitos)
    const cepLimpo = onlyDigits(cliente.cep || '')
    const cepPrefixo = cepLimpo.slice(0, 5).padStart(5, '0')
    const cepSufixo = cepLimpo.slice(5, 8).padStart(3, '0')
    
    // Endereço: combina logradouro + número
    const enderecoCompleto = [cliente.logradouro, cliente.numero].filter(Boolean).join(' ')
    
    const segmentoQ = writeLine(layoutSegmentoQ, {
      numero_sequencial: sequencialRegistro,
      tipo_inscricao_pagador: tipoPagador,
      numero_inscricao_pagador: cnpjCpfPagador.padStart(15, '0'),
      nome_pagador: cliente.razaoSocial || '',
      endereco_pagador: enderecoCompleto,
      bairro_pagador: cliente.bairro || '',
      cep_pagador: cepPrefixo,
      cep_sufixo_pagador: cepSufixo,
      cidade_pagador: cliente.cidade || '',
      uf_pagador: cliente.estado || '',
    })
    linhas.push(segmentoQ)
    
    // Segmento R - Multa (sempre gerado no legado com ValorMulta = 15.49)
    // Legado: DataMulta = Vencimento + 1 dia, ValorMulta = 15.49m
    sequencialRegistro++
    
    // Código: 1 = Valor fixo (padrão legado), 2 = Percentual, 0 = Sem multa
    let codigoMulta = '1' // Valor fixo (padrão legado)
    let valorMultaFinal: number = debito.valorMulta ?? 15.49 // R$ 15,49 padrão legado
    
    if (debito.percMulta && debito.percMulta > 0) {
      codigoMulta = '2' // Percentual
      valorMultaFinal = debito.percMulta
    }
    
    // Data da multa: dia seguinte ao vencimento (igual legado: Vencimento.AddDays(1))
    const dataMultaDate = new Date(debito.vencimento)
    dataMultaDate.setDate(dataMultaDate.getDate() + 1)
    const dataMulta = debito.dataMulta 
      ? dateToDdMmYyyy(debito.dataMulta) 
      : dateToDdMmYyyy(dataMultaDate)
    
    const segmentoR = writeLine(layoutSegmentoR, {
      numero_sequencial: sequencialRegistro,
      codigo_multa: codigoMulta,
      data_multa: dataMulta,
      valor_multa: valorMultaFinal, // usePicture formata com 9(13)V9(2)
    })
    linhas.push(segmentoR)
    
    // Segmento S - Mensagens (obrigatório para entrada de título)
    sequencialRegistro++
    
    const segmentoS = writeLine(layoutSegmentoS, {
      numero_sequencial: sequencialRegistro,
      // Mensagens vazias por padrão (como no legado)
    })
    linhas.push(segmentoS)
  })
  
  // ===== TRAILER DE LOTE =====
  // Quantidade de registros do lote: Header Lote + Segmentos + Trailer Lote
  // sequencialRegistro = total de segmentos (P, Q, R por débito)
  // +1 para Header Lote, +1 para Trailer Lote = sequencialRegistro + 2
  const qtdRegistrosLote = sequencialRegistro + 2
  
  const trailerLote = writeLine(layoutTrailerLote, {
    quantidade_registros: qtdRegistrosLote,
  })
  linhas.push(trailerLote)
  
  // ===== TRAILER DE ARQUIVO =====
  // Quantidade de registros do arquivo: Header Arquivo + Header Lote + Segmentos + Trailer Lote + Trailer Arquivo
  // = 1 + qtdRegistrosLote + 1 = qtdRegistrosLote + 2
  const qtdRegistrosArquivo = qtdRegistrosLote + 2
  
  const trailerArquivo = writeLine(layoutTrailerArquivo, {
    quantidade_lotes: 1, // Sempre 1 lote
    quantidade_registros: qtdRegistrosArquivo,
  })
  linhas.push(trailerArquivo)
  
  // CRLF igual ao legado (StreamWriter.WriteLine() usa \r\n)
  const conteudo = Buffer.from(linhas.join('\r\n') + '\r\n', 'latin1')
  const filename = `remessa-santander-${sequencialArquivo}.txt`
  return { filename, mimeType: 'text/plain', content: conteudo }
}

