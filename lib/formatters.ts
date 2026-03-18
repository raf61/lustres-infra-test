// Funções de formatação e validação para CNPJ, CEP e telefones
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

export const maskCEP = (value: string | null | undefined): string => {
  if (!value) return ""
  const numbers = value.trim().replace(/\D/g, "")
  if (numbers.length <= 5) return numbers
  return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`
}

export const maskCNPJ = (value: string | null | undefined): string => {
  if (!value) return ""
  const numbers = value.trim().replace(/\D/g, "")
  if (numbers.length <= 2) return numbers
  if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`
  if (numbers.length <= 8) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`
  if (numbers.length <= 12)
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`
  return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12, 14)}`
}

export const maskPhone = (value: string | null | undefined): string => {
  if (!value) return ""
  const numbers = value.trim().replace(/\D/g, "")
  if (numbers.length === 0) return ""
  if (numbers.length <= 2) return numbers
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
  if (numbers.length <= 10) {
    // Telefone fixo: (XX) XXXX-XXXX
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`
  }
  // Celular: (XX) XXXXX-XXXX
  if (numbers.length <= 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`
  }
  // Limitar a 11 dígitos
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
}

export const unmask = (value: string): string => {
  return value.trim().replace(/\D/g, "")
}

// Validações
export const validateCEP = (value: string): boolean => {
  const numbers = unmask(value)
  return numbers.length === 8
}

export const validateCNPJ = (value: string): boolean => {
  const numbers = unmask(value)
  if (numbers.length !== 14) return false

  // Validação básica de CNPJ (algoritmo de validação)
  if (/^(\d)\1+$/.test(numbers)) return false // Todos os dígitos iguais

  let length = numbers.length - 2
  let numbersOnly = numbers.substring(0, length)
  const digits = numbers.substring(length)
  let sum = 0
  let pos = length - 7

  for (let i = length; i >= 1; i--) {
    sum += Number.parseInt(numbersOnly.charAt(length - i), 10) * pos--
    if (pos < 2) pos = 9
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== Number.parseInt(digits.charAt(0), 10)) return false

  length = length + 1
  numbersOnly = numbers.substring(0, length)
  sum = 0
  pos = length - 7

  for (let i = length; i >= 1; i--) {
    sum += Number.parseInt(numbersOnly.charAt(length - i), 10) * pos--
    if (pos < 2) pos = 9
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== Number.parseInt(digits.charAt(1), 10)) return false

  return true
}

export const validatePhone = (value: string): boolean => {
  const numbers = unmask(value)
  return numbers.length === 10 || numbers.length === 11
}

// Funções de formatação para exibição (sempre formata, mesmo se já estiver formatado)
export const formatCNPJ = (value: string | null | undefined): string => {
  if (!value) return ""
  return maskCNPJ(value)
}

export const formatCEP = (value: string | null | undefined): string => {
  if (!value) return ""
  return maskCEP(value)
}

export const formatPhone = (value: string | null | undefined): string => {
  if (!value) return ""
  return maskPhone(value)
}

const condoPrefixRegex = /^\s*Condom[ií]nio do Ed[íi]f[íi]cio\.?\s*/i

export const formatRazaoSocial = (value: string | null | undefined): string => {
  if (!value) return ""
  const trimmed = value.trimStart()
  if (!condoPrefixRegex.test(trimmed)) return value
  const remainder = trimmed.replace(condoPrefixRegex, "").trimStart()
  return remainder ? `Cond. Ed. ${remainder}` : "Cond. Ed."
}

export const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "R$ 0,00"
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}


export const formatCurrencyExtenso = (valor: number): string => {
  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"]
  const dezena_10_19 = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"]
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"]
  const centenas = ["", "cem", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"]

  const converterInteiro = (n: number): string => {
    if (n === 0) return ""
    if (n === 100) return "cem"
    if (n < 10) return unidades[n]
    if (n < 20) return dezena_10_19[n - 10]
    if (n < 100) {
      const d = Math.floor(n / 10)
      const u = n % 10
      return dezenas[d] + (u > 0 ? " e " + unidades[u] : "")
    }
    if (n < 1000) {
      const c = Math.floor(n / 100)
      const resto = n % 100
      let s = centenas[c]
      if (c === 1 && resto > 0) s = "cento"
      return s + (resto > 0 ? " e " + converterInteiro(resto) : "")
    }
    return ""
  }

  const converterMilhares = (n: number): string => {
    if (n === 0) return ""
    const milhar = Math.floor(n / 1000)
    const resto = n % 1000
    let s = ""
    if (milhar > 0) {
      s = (milhar === 1 ? "" : converterInteiro(milhar)) + " mil"
    }
    if (resto > 0) {
      s += (s ? (resto < 100 || resto % 100 === 0 ? " e " : ", ") : "") + converterInteiro(resto)
    }
    return s
  }

  if (valor === 0) return "zero reais"

  const inteiro = Math.floor(valor)
  const centavos = Math.round((valor - inteiro) * 100)

  let extenso = ""

  if (inteiro > 0) {
    if (inteiro < 1000000) {
      extenso = converterMilhares(inteiro)
    } else {
      // Simplificação para milhões se necessário, mas para contratos esse range costuma bastar
      extenso = inteiro.toString()
    }
    extenso += inteiro === 1 ? " real" : " reais"
  }

  if (centavos > 0) {
    if (extenso) extenso += " e "
    if (centavos < 10) extenso += unidades[centavos]
    else if (centavos < 20) extenso += dezena_10_19[centavos - 10]
    else {
      const d = Math.floor(centavos / 10)
      const u = centavos % 10
      extenso += dezenas[d] + (u > 0 ? " e " + unidades[u] : "")
    }
    extenso += centavos === 1 ? " centavo" : " centavos"
  }

  return extenso.trim()
}

export const formatNumberExtenso = (n: number): string => {
  const unidades = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"]
  const dezena_10_19 = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"]
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"]
  const centenas = ["", "cem", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"]

  if (n < 10) return unidades[n]
  if (n < 20) return dezena_10_19[n - 10]
  if (n < 100) {
    const d = Math.floor(n / 10)
    const u = n % 10
    return dezenas[d] + (u > 0 ? " e " + unidades[u] : "")
  }
  if (n < 1000) {
    if (n === 100) return "cem"
    const c = Math.floor(n / 100)
    const resto = n % 100
    let s = centenas[c]
    if (c === 1 && resto > 0) s = "cento"
    return s + (resto > 0 ? " e " + formatNumberExtenso(resto) : "")
  }
  return n.toString()
}

/**
 * Converte uma data (string ISO ou YYYY-MM-DD) para um objeto Date 
 * assumindo que o dia deve ser mantido exatamente como está na string,
 * evitando problemas de fuso horário (previne o "dia anterior").
 */
export const parseLocalDate = (dateStr: string | Date | null | undefined): Date => {
  if (!dateStr) return new Date()
  if (dateStr instanceof Date) return dateStr

  // Se for ISO ou YYYY-MM-DD
  const datePart = typeof dateStr === 'string' ? dateStr.split('T')[0] : ""
  if (datePart.includes("-")) {
    const [y, m, d] = datePart.split("-").map(Number)
    // new Date(year, monthIndex, day) cria no fuso local meia-noite
    return new Date(y, m - 1, d)
  }

  return new Date(dateStr)
}

/**
 * Formata uma data mantendo o dia exato da string original.
 */
export const formatLocalDate = (dateStr: string | Date | null | undefined, pattern: string = "dd/MM/yyyy"): string => {
  if (!dateStr) return ""
  const date = parseLocalDate(dateStr)
  return format(date, pattern, { locale: ptBR })
}
