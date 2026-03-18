const ONLY_DIGITS_REGEX = /\D/g
const REPEATED_DIGITS_REGEX = /^(\d)\1+$/
const CNPJ_DIGITS_LENGTH = 14

function extractDigits(value) {
  if (!value) return ""
  return String(value).trim().replace(ONLY_DIGITS_REGEX, "")
}

function formatCnpjDigits(digits) {
  if (digits.length !== CNPJ_DIGITS_LENGTH) {
    return null
  }

  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, (_, p1, p2, p3, p4, p5) => `${p1}.${p2}.${p3}/${p4}-${p5}`)
}

function calculateVerifierDigit(numbers) {
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

function isValidCnpjDigits(digits) {
  if (digits.length !== CNPJ_DIGITS_LENGTH) return false
  if (REPEATED_DIGITS_REGEX.test(digits)) return false

  const base = digits.substring(0, 12)
  const verifiers = digits.substring(12)

  const firstDigit = calculateVerifierDigit(base)
  const secondDigit = calculateVerifierDigit(base + firstDigit.toString())

  return `${firstDigit}${secondDigit}` === verifiers
}

function formatCnpjForDatabase(value) {
  const digits = extractDigits(value)
  if (digits.length !== CNPJ_DIGITS_LENGTH || !isValidCnpjDigits(digits)) {
    throw new Error("CNPJ inválido")
  }

  const formatted = formatCnpjDigits(digits)
  if (!formatted) {
    throw new Error("CNPJ inválido")
  }

  return formatted
}

module.exports = {
  extractDigits,
  formatCnpjDigits,
  isValidCnpjDigits,
  formatCnpjForDatabase,
}


