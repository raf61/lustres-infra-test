// @ts-nocheck
// Implementação compatível com o sistema: recebe cedente/debitos e gera Buffer/filename.
// Mantém o algoritmo que validamos previamente (layout posicional + linha de multa).
type CedenteBanco = {
  nome: string // label interno
  razaoSocial: string
  cnpj: string
  bancoCodigo: number
  agencia: string
  agenciaDigito?: string | null
  conta: string
  contaDigito?: string | null
  carteira: string
  codigoBeneficiario?: string | null
}

type Sacado = {
  razaoSocial?: string | null
  cnpj?: string | null
  endereco?: any
  cep?: string | null
  cidade?: string | null
  estado?: string | null
  logradouro?: string | null
  numero?: string | null
  bairro?: string | null
  complemento?: string | null
}

type DebitoParaRemessa = {
  id: number
  receber: number
  vencimento: Date
  cliente: Sacado
}

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

const dateToDdMmYyyy = (value?: Date | string) => {
  const d = value ? new Date(value) : new Date()
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const year = d.getFullYear().toString().padStart(4, '0')
  return `${day}${month}${year}`
}

// Layout mínimo do header (posições oficiais Itaú CNAB400)
const layoutHeader = {
  tipo_registro: { pos: [1, 1], picture: '9(01)', default: '0' },
  operacao: { pos: [2, 2], picture: '9(01)', default: '1' },
  literal_remessa: { pos: [3, 9], picture: 'X(07)', default: 'REMESSA' },
  codigo_servico: { pos: [10, 11], picture: '9(02)', default: '01' },
  literal_servico: { pos: [12, 26], picture: 'X(15)', default: 'COBRANCA' },
  agencia: { pos: [27, 30], picture: '9(04)' },
  zeros: { pos: [31, 32], picture: '9(02)', default: '00' },
  conta: { pos: [33, 37], picture: '9(05)' },
  dac: { pos: [38, 38], picture: '9(01)' },
  brancos01: { pos: [39, 46], picture: 'X(08)', default: '' },
  nome_empresa: { pos: [47, 76], picture: 'X(30)' },
  codigo_banco: { pos: [77, 79], picture: '9(03)', default: '341' },
  nome_banco: { pos: [80, 94], picture: 'X(15)', default: 'BANCO ITAU SA' },
  data_geracao: { pos: [95, 100], picture: '9(06)', date_format: '%d%m%y' },
  brancos02: { pos: [101, 394], picture: 'X(294)', default: '' },
  numero_sequencial: { pos: [395, 400], picture: '9(06)', default: '1' }
}

const layoutDetalhe = {
  tipo_registro: { pos: [1, 1], picture: '9(01)', default: '1' },
  codigo_inscricao: { pos: [2, 3], picture: '9(02)', default: '' },
  numero_inscricao: { pos: [4, 17], picture: '9(14)', default: '' },
  agencia: { pos: [18, 21], picture: '9(04)' },
  zeros: { pos: [22, 23], picture: '9(02)', default: '00' },
  conta: { pos: [24, 28], picture: '9(05)' },
  dac: { pos: [29, 29], picture: '9(01)' },
  brancos01: { pos: [30, 33], picture: 'X(4)', default: '' },
  instrucao: { pos: [34, 37], picture: '9(04)', default: '0000' },
  uso_empresa: { pos: [38, 62], picture: 'X(25)' },
  nosso_numero: { pos: [63, 70], picture: '9(08)' },
  quantidade_moeda: { pos: [71, 83], picture: '9(08)V9(5)', default: '0000000000000' },
  numero_carteira: { pos: [84, 86], picture: '9(03)', default: '109' },
  uso_banco: { pos: [87, 107], picture: 'X(21)', default: '' },
  carteira: { pos: [108, 108], picture: 'X(01)', default: 'I' },
  codigo_ocorrencia: { pos: [109, 110], picture: '9(02)', default: '01' },
  numero_documento: { pos: [111, 120], picture: 'X(10)' },
  vencimento: { pos: [121, 126], picture: '9(06)', date_format: '%d%m%y' },
  valor_titulo: { pos: [127, 139], picture: '9(11)V9(2)' },
  codigo_banco: { pos: [140, 142], picture: '9(03)', default: '341' },
  agencia_cobradora: { pos: [143, 147], picture: '9(05)', default: '00000' },
  especie: { pos: [148, 149], picture: 'X(02)', default: '01' },
  aceite: { pos: [150, 150], picture: 'X(01)', default: 'N' },
  data_emissao: { pos: [151, 156], picture: '9(06)', date_format: '%d%m%y' },
  instrucao1: { pos: [157, 158], picture: 'X(02)', default: '91' },
  instrucao2: { pos: [159, 160], picture: 'X(02)', default: '00' },
  valor_mora_dia: { pos: [161, 173], picture: '9(11)V9(2)', default: '0000000000000' },
  data_limite_desconto: { pos: [174, 179], picture: '9(06)', date_format: '%d%m%y' },
  valor_desconto: { pos: [180, 192], picture: '9(11)V9(2)' },
  valor_iof: { pos: [193, 205], picture: '9(11)V9(2)' },
  valor_abatimento: { pos: [206, 218], picture: '9(11)V9(2)' },
  sacado_codigo_inscricao: { pos: [219, 220], picture: '9(02)' },
  sacado_numero_inscricao: { pos: [221, 234], picture: '9(14)' },
  nome: { pos: [235, 264], picture: 'X(30)' },
  brancos02: { pos: [265, 274], picture: 'X(10)', default: '' },
  logradouro: { pos: [275, 314], picture: 'X(40)' },
  bairro: { pos: [315, 326], picture: 'X(12)' },
  cep: { pos: [327, 334], picture: '9(08)' },
  cidade: { pos: [335, 349], picture: 'X(15)' },
  estado: { pos: [350, 351], picture: 'X(02)' },
  sacador: { pos: [352, 381], picture: 'X(30)' },
  brancos03: { pos: [382, 385], picture: 'X(04)', default: '' },
  data_mora: { pos: [386, 391], picture: '9(06)', date_format: '%d%m%y' },
  prazo: { pos: [392, 393], picture: '9(02)' },
  brancos04: { pos: [394, 394], picture: 'X(01)', default: '' },
  numero_sequencial: { pos: [395, 400], picture: '9(06)' }
}

const layoutMulta = {
  tipo_registro: { pos: [1, 1], picture: '9(01)', default: '2' },
  codigo_multa: { pos: [2, 2], picture: 'X(01)' },
  data_multa: { pos: [3, 10], picture: '9(08)', date_format: '%d%m%Y' },
  valor_multa: { pos: [11, 23], picture: '9(13)' },
  brancos01: { pos: [24, 394], picture: 'X(371)', default: '' },
  numero_sequencial: { pos: [395, 400], picture: '9(06)' }
}

const layoutTrailer = {
  tipo_registro: { pos: [1, 1], picture: '9(01)', default: '9' },
  brancos01: { pos: [2, 394], picture: 'X(393)', default: '' },
  numero_sequencial: { pos: [395, 400], picture: '9(06)' }
}

const formatText = (value, size) => removeAcentos((value || '').toString()).toUpperCase().slice(0, size).padEnd(size, ' ')

const formatNumber = (value, size) => {
  let str = (value || '').toString()
  while (str.length < size) str = '0' + str
  return str.slice(-size)
}

const formatDate = (value, size, dateFormat) => {
  let strValue = (value || '').toString()
  switch (dateFormat) {
    case '%d%m%Y':
      strValue = strValue.slice(0, 8)
      break
    case '%d%m%y':
      strValue = strValue.slice(0, 4) + strValue.slice(6, 8)
      break
    case '%H%M%S':
      strValue = strValue.slice(0, 8)
      break
    default:
      throw new Error('dateFormat inválido: ' + dateFormat)
  }
  while (strValue.length < size) strValue = '0' + strValue
  return strValue
}

const formatCurrency = (value = 0, integer = 0, decimal = 0) => {
  value = Number(value)
  const vals = value.toFixed(decimal).split('.')
  vals[1] = vals[1] || ''
  vals[0] = vals[0].toString().slice(0, integer).padStart(integer, '0')
  vals[1] = vals[1].toString().slice(0, decimal).padEnd(decimal, '0')
  return vals.join('')
}

const usePicture = (item, value = '') => {
  const { picture } = item
  if (picture.indexOf('V9') > 0) {
    const match = /9\((\w+?)\).*V9\((\w+?)\)/.exec(picture)
    const intSize = match ? Number(match[1]) : 0
    const decSize = match ? Number(match[2]) : 0
    return formatCurrency(Number(value), intSize, decSize)
  } else if (picture.startsWith('9')) {
    const match = /9\((\w+?)\)/.exec(picture)
    const size = match ? Number(match[1]) : 0
    if (item.date_format) {
      return formatDate(value, size, item.date_format)
    }
    return formatNumber(value, size)
  } else if (picture.startsWith('X')) {
    const match = /X\((\w+?)\)/.exec(picture)
    const size = match ? Number(match[1]) : 0
    return formatText(value, size)
  }
  throw new Error(`Picture inválido: ${picture}`)
}

const writeLine = (layout, data) => {
  const buffer = new Array(400).fill(' ')
  Object.keys(layout).forEach((key) => {
    const item = layout[key]
    const pos = item.pos
    if (!pos) return
    const value = key in data && data[key] !== undefined && data[key] !== null ? data[key] : item.default
    const formatted = usePicture(item, value ? value + '' : '')
    const fieldLen = pos[1] - pos[0] + 1
    const slice = formatted.padEnd(fieldLen, ' ').slice(0, fieldLen)
    for (let i = 0; i < fieldLen; i++) {
      buffer[pos[0] - 1 + i] = slice[i]
    }
  })
  return { line: buffer.join('') }
}

const formatSacador = (raw) => {
  const text = (raw || '').toString().trim()
  if (!text) return ''.padEnd(43, ' ')
  const match = /(.*?)(\d+)\s*$/.exec(text)
  if (match) {
    const nome = match[1].trim().slice(0, 43)
    const numero = match[2]
    const spaceBetween = Math.max(1, 43 - (nome.length + numero.length + 1))
    const composed = `${nome}${' '.repeat(spaceBetween)}${numero} `
    return composed.slice(0, 43).padEnd(43, ' ')
  }
  return text.slice(0, 43).padEnd(43, ' ')
}

const parseConvenio = (codigo_convenio) => {
  if (!codigo_convenio) return { agencia: '', conta: '', dac: '' }
  const conv = (codigo_convenio || '').toString().padEnd(12, '0')
  return {
    agencia: conv.slice(0, 4),
    conta: conv.slice(6, 11),
    dac: conv.slice(11, 12)
  }
}

// Beneficiário (cedente) dinâmico
export function generateItauRemessa({
  cedente,
  debitos,
  sequencialArquivo,
}: {
  cedente: CedenteBanco
  debitos: DebitoParaRemessa[]
  sequencialArquivo: number
}) {
  const beneficiario = {
    razaoSocial: cedente.razaoSocial,
    cnpj: cedente.cnpj,
    bancoCodigo: cedente.bancoCodigo || 341,
    agencia: cedente.agencia,
    agenciaDigito: cedente.agenciaDigito || '',
    conta: cedente.conta,
    contaDigito: cedente.contaDigito || '',
    carteira: cedente.carteira || '109',
  }

  const cedenteDocumento = onlyDigits(beneficiario.cnpj)
  const cedenteTipo = cedenteDocumento.length === 14 ? '02' : '01'

  let sequencial = 1

  const header_arquivo = {
    agencia: (beneficiario.agencia || '').padStart(4, '0').slice(0, 4),
    conta: (beneficiario.conta || '').padStart(5, '0').slice(-5),
    dac: (beneficiario.contaDigito || '').padStart(1, '0').slice(-1),
    nome_empresa: beneficiario.razaoSocial || '',
    codigo_banco: beneficiario.bancoCodigo || '341',
    data_geracao: dateToDdMmYyyy(new Date()), // ddMMyyyy (formatação corta para ddMMyy)
    numero_sequencial: sequencial++,
  }

  const detalhe = debitos.map((deb) => {
    const sacado = deb.cliente || {}
    const sacadoNum = onlyDigits(sacado.cnpj || '')
    const sacadoTipo = sacadoNum.length === 14 ? '02' : '01'

    const carteira = beneficiario.carteira || '109'
    const carteiraCodigo = 'I'
    const instrucao1 = '91'
    const instrucao2 = '00'

    const numeroDocRaw = deb.id.toString()
    const numeroDoc = numeroDocRaw.replace(/^0+/, '').slice(0, 10).padEnd(10, ' ')
    const usoEmpresa = numeroDocRaw.toString().slice(0, 25).padEnd(25, ' ')

    const retorno = {
      codigo_inscricao: cedenteTipo,
      numero_inscricao: cedenteDocumento.padStart(14, '0'),
      agencia: (beneficiario.agencia || '').padStart(4, '0').slice(0, 4),
      zeros: '00',
      conta: (beneficiario.conta || '').padStart(5, '0').slice(-5),
      dac: (beneficiario.contaDigito || '').padStart(1, '0').slice(-1),
      instrucao: '0000',
      uso_empresa: usoEmpresa,
      nosso_numero: deb.id.toString().padStart(8, '0').slice(-8),
      quantidade_moeda: '00000000000000',
      numero_carteira: carteira,
      carteira: carteiraCodigo,
      codigo_ocorrencia: '01',
      numero_documento: numeroDoc,
      vencimento: dateToDdMmYyyy(deb.vencimento),
      valor_titulo: deb.receber,
      codigo_banco: beneficiario.bancoCodigo || '341',
      agencia_cobradora: '00000',
      especie: '01', // duplicata mercantil
      aceite: 'N',
      data_emissao: dateToDdMmYyyy(new Date()),
      instrucao1,
      instrucao2,
      // Juros de mora diário conforme legado: Math.Floor(valor * 1.99m / 100 * 100) / 100
      valor_mora_dia: Math.floor(deb.receber * 1.99) / 100,
      // Data limite desconto = data vencimento (se não houver desconto específico)
      data_limite_desconto: dateToDdMmYyyy(deb.vencimento),
      valor_desconto: 0,
      valor_iof: 0,
      valor_abatimento: 0,
      sacado_codigo_inscricao: String(sacadoTipo).padStart(2, '0'),
      sacado_numero_inscricao: sacadoNum.padStart(14, '0').slice(-14),
      nome: (sacado.razaoSocial || '').toString().slice(0, 30).padEnd(30, ' '),
      brancos02: ''.padEnd(10, ' '),
      logradouro: ([sacado.logradouro, sacado.numero, sacado.complemento].filter(Boolean).join(' ') || '').slice(0, 40).padEnd(40, ' '),
      bairro: (sacado.bairro || '').toString().slice(0, 12).padEnd(12, ' '),
      cep: onlyDigits(sacado.cep || '').padStart(8, '0').slice(-8),
      cidade: (sacado.cidade || '').toString().slice(0, 15).padEnd(15, ' '),
      estado: (sacado.estado || '').toString().slice(0, 2).padEnd(2, ' '),
      sacador: formatSacador('').slice(0, 30).padEnd(30, ' '),
      brancos03: ''.padEnd(4, ' '),
      // Data mora = data vencimento (igual ao legado)
      data_mora: dateToDdMmYyyy(deb.vencimento),
      // Prazo = 30 (instrução 91 = NaoReceberAposNDias, não é protesto)
      prazo: '30',
      brancos04: ' ',
    }
    console.log(sacadoNum, sacado.razaoSocial, retorno)
    return retorno
  })

  // Multa igual ao legado Itaú: codigo=2 (percentual), data=vencimento+1, valor=PercMulta*100 (0 se não informado)
  const detalhe_multa = debitos.map((deb) => {
    // Data da multa: dia seguinte ao vencimento (igual legado: Vencimento.AddDays(1))
    const dataMultaDate = new Date(deb.vencimento)
    dataMultaDate.setDate(dataMultaDate.getDate() + 1)
    return {
      codigo_multa: '2', // 2 = percentual (igual legado GerarRegistroDetalhe2)
      data_multa: dateToDdMmYyyy(dataMultaDate), // ddMMyyyy
      valor_multa: 0, // PercMulta * 100 = 0 por padrão (igual legado)
    }
  })

  const trailer_arquivo = {
    valor_total: debitos.reduce((acc, curr) => acc + Number(curr.receber || 0), 0),
    numero_sequencial: 0,
  }

  const linhas: string[] = []
  linhas.push(writeLine(layoutHeader, header_arquivo).line)

  for (let i = 0; i < detalhe.length; i++) {
    detalhe[i].numero_sequencial = sequencial++
    linhas.push(writeLine(layoutDetalhe, detalhe[i]).line)

    detalhe_multa[i].numero_sequencial = sequencial++
    linhas.push(writeLine(layoutMulta, detalhe_multa[i]).line)
  }

  trailer_arquivo.numero_sequencial = sequencial++
  linhas.push(writeLine(layoutTrailer, trailer_arquivo).line)

  // CRLF igual ao legado (StreamWriter.WriteLine() usa \r\n)
  const conteudo = Buffer.from(linhas.join('\r\n') + '\r\n', 'latin1')
  const filename = `remessa-itau-${sequencialArquivo}.txt`
  return { filename, mimeType: 'text/plain', content: conteudo }
}