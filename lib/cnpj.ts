const ONLY_DIGITS_REGEX = /\D/g
const REPEATED_DIGITS_REGEX = /^(\d)\1+$/

export const CNPJ_DIGITS_LENGTH = 14

export const extractDigits = (value: string | null | undefined): string => {
  if (!value) return ""
  return value.trim().replace(ONLY_DIGITS_REGEX, "")
}

export const formatCnpjDigits = (digits: string): string | null => {
  if (digits.length !== CNPJ_DIGITS_LENGTH) {
    return null
  }

  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, (_, p1, p2, p3, p4, p5) => `${p1}.${p2}.${p3}/${p4}-${p5}`)
}

const calculateVerifierDigit = (numbers: string): number => {
  let sum = 0
  let weight = numbers.length - 7

  for (let index = numbers.length; index >= 1; index -= 1) {
    sum += Number.parseInt(numbers.charAt(numbers.length - index), 10) * weight
    weight -= 1
    if (weight < 2) {
      weight = 9
    }
  }

  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}

export const isValidCnpjDigits = (digits: string): boolean => {
  if (digits.length !== CNPJ_DIGITS_LENGTH) return false
  if (REPEATED_DIGITS_REGEX.test(digits)) return false

  const numbers = digits.substring(0, 12)
  const verifierDigits = digits.substring(12)

  const firstDigit = calculateVerifierDigit(numbers)
  const secondDigit = calculateVerifierDigit(numbers + firstDigit.toString())

  return `${firstDigit}${secondDigit}` === verifierDigits
}

export const formatCnpjForDatabase = (value: string | null | undefined): string => {
  const digits = extractDigits(value)
  if (digits.length !== CNPJ_DIGITS_LENGTH) {
    throw new Error("CNPJ inválido")
  }

  if (!isValidCnpjDigits(digits)) {
    throw new Error("CNPJ inválido")
  }

  const formatted = formatCnpjDigits(digits)
  if (!formatted) {
    throw new Error("CNPJ inválido")
  }

  return formatted
}



