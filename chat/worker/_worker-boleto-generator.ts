/**
 * Gerador de boletos específico para uso nos workers (CommonJS puro).
 * Este arquivo é uma cópia adaptada de lib/boleto/index.ts, sem uso de import.meta.url.
 * Mantém a mesma lógica de geração de boletos Itaú e Santander.
 * SEMPRE QUE FOR MEXER LÁ, TEM QUE MEXER AQUI(SE FOR MUDAR A FUNCIONALIDADE)
 */

import path from "path"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Boletos } = require("gerar-boletos")
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ItauBanco = require("gerar-boletos/lib/banks/itau")
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SantanderBanco = require("gerar-boletos/lib/banks/santander")
// eslint-disable-next-line @typescript-eslint/no-var-requires
const BarcodeBuilder = require("gerar-boletos/lib/generators/barcode-builder")

// Mod10 conforme legado Itaú (BoletoNet)
const mod10 = (input: string | number) => {
  const digits = String(input).replace(/\D/g, "").split("").reverse()
  let soma = 0
  for (let i = 0; i < digits.length; i++) {
    const n = Number(digits[i])
    const mult = i % 2 === 0 ? 2 : 1
    const prod = n * mult
    soma += prod > 9 ? Math.trunc(prod / 10) + (prod % 10) : prod
  }
  return (10 - (soma % 10)) % 10
}

// DV do nosso número para Itaú (carteira 109 e regras do legado)
const dvNossoNumeroItau = ({
  carteira,
  agencia,
  conta,
  contaDigito,
  nossoNumero,
}: {
  carteira: string
  agencia: string
  conta: string
  contaDigito: string
  nossoNumero: string
}) => {
  const c = carteira
  const nn = nossoNumero
  const ag = agencia
  const ct = conta
  const cd = contaDigito
  const carteirasSimples = ["126", "131", "146", "150", "168", "138"]
  const carteirasComDacConta = ["104", "112"]

  if (carteirasComDacConta.includes(c)) {
    return mod10(`${ag}${ct}${cd}${c}${nn}`)
  }
  if (!carteirasSimples.includes(c)) {
    return mod10(`${ag}${ct}${c}${nn}`)
  }
  return mod10(`${c}${nn}`)
}

// Banco Itaú legado (campo livre com agência + conta + DV conta), compatível com BoletoNet
class LegacyItau extends ItauBanco {
  geraCodigoDeBarrasPara(boleto: any) {
    const beneficiario = boleto.getBeneficiario()
    const carteira = beneficiario.getCarteira()
    const nossoNumero = beneficiario.getNossoNumero()

    if (!carteira) throw new Error("Itaú: Carteira é obrigatória")
    if (!nossoNumero) throw new Error("Itaú: Nosso número é obrigatório")
    if (nossoNumero.length > 8) throw new Error("Itaú: Nosso número deve ter até 8 dígitos.")

    const carteiraFormatada = beneficiario.getCarteira().padStart(3, "0")
    const nossoNumeroFormatado = beneficiario.getNossoNumero().padStart(8, "0")
    const agenciaFormatada = beneficiario.getAgenciaFormatada()
    const contaFormatada = String(beneficiario.getCodigoBeneficiario()).padStart(5, "0")

    // DV NN (modelo legado/BoletoNet para carteiras normais, ex. 109): mod10(ag+conta+carteira+NN)
    const dvNN = mod10(agenciaFormatada + contaFormatada + carteiraFormatada + nossoNumeroFormatado)
    // DV conta (legado): mod10(agencia + conta)
    const dvConta = mod10(agenciaFormatada + contaFormatada)
    console.log(carteiraFormatada, nossoNumeroFormatado, dvNN, agenciaFormatada, contaFormatada, dvConta)
    // Campo livre: CCC NNNNNNNN D AAAA CCCCC D 000 (com conta-corrente, não código de beneficiário)
    const campoLivre = [
      carteiraFormatada,
      nossoNumeroFormatado,
      String(dvNN),
      agenciaFormatada,
      contaFormatada,
      String(dvConta),
      "000",
    ]

    return new BarcodeBuilder(boleto).comCampoLivre(campoLivre)
  }
}

type Cedente = {
  razaoSocial: string
  cnpj: string
  agencia: string
  agenciaDigito?: string | null
  conta: string
  contaDigito?: string | null
  carteira: string
  codigoBeneficiario?: string | null
}

type Sacado = {
  nome: string
  cnpj?: string | null
  cpf?: string | null
  logradouro?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  cep?: string | null
}

type Titulo = {
  nossoNumero: number | string
  numeroDocumento: string
  valor: number
  vencimento: Date | string
  emissao?: Date | string
  multaFixa?: number
  jurosMora?: number
  mensagem1?: string
  mensagem2?: string
}

export async function generateItauBoletoPdf({
  cedente,
  sacado,
  titulo,
  destinoDir = "/tmp",
  nomeArquivo = "boleto-itau",
}: {
  cedente: Cedente
  sacado: Sacado
  titulo: Titulo
  destinoDir?: string
  nomeArquivo?: string
}) {
  const carteira = String(cedente.carteira || "109").padStart(3, "0")
  const agencia = String(cedente.agencia || "").padStart(4, "0")
  const conta = String(cedente.conta || "").padStart(5, "0")
  // No legado (.NET/BoletoNet) o dígito da conta sempre é recalculado via mod10(ag+conta)
  const contaDigito = String(mod10(`${agencia}${conta}`))
  const nossoNumero = String(titulo.nossoNumero || "").padStart(8, "0")
  const dvNN = dvNossoNumeroItau({ carteira, agencia, conta, contaDigito, nossoNumero })
  const numeroDocumentoBase = String(titulo.numeroDocumento || "").padStart(7, "0")
  // No legado o Número do Documento não é exibido com DV no PDF
  const numeroDocumento = numeroDocumentoBase

  const boleto = {
    banco: new LegacyItau(),
    pagador: {
      nome: sacado.nome,
      RegistroNacional: sacado.cnpj || sacado.cpf,
      endereco: {
        logradouro: sacado.logradouro || "",
        bairro: sacado.bairro || "",
        cidade: sacado.cidade || "",
        estadoUF: sacado.uf || "",
        cep: sacado.cep || "",
      },
    },
    beneficiario: {
      nome: cedente.razaoSocial,
      cnpj: cedente.cnpj,
      dadosBancarios: {
        carteira,
        agencia,
        agenciaDigito: String(cedente.agenciaDigito || "").padStart(1, "0"),
        conta,
        contaDigito,
        codigoBeneficiario: cedente.codigoBeneficiario,
        nossoNumero,
        nossoNumeroDigito: String(dvNN),
      },
      endereco: {
        logradouro: "",
        bairro: "",
        cidade: "",
        estadoUF: "",
        cep: "",
      },
    },
    boleto: {
      numeroDocumento,
      especieDocumento: "DM",
      valor: Number(titulo.valor),
      datas: {
        vencimento: titulo.vencimento,
        processamento: titulo.emissao || new Date(),
        documentos: titulo.emissao || new Date(),
      },
    },
    instrucoes: [
      titulo.mensagem1 || "ATENÇÃO: NÃO RECONHECEMOS BOLETOS ATUALIZADOS PELA INTERNET.",
      titulo.mensagem2 || "APOS O VENCIMENTO COBRAR MULTA R$ 15,49 E MORA DE 1,99% AO DIA",
    ],
  }
  console.log(boleto)
  const novoBoleto = new Boletos(boleto)
  novoBoleto.gerarBoleto()

  const outDir = path.resolve(destinoDir)
  const { filePath } = await novoBoleto.pdfFile(outDir, nomeArquivo)
  return { filePath }
}

///////////////////------------------------------------------------------------------------------////////////////////////////////////////

// ===== SANTANDER =====

// Mod11 Santander para DV do nosso número (pesos 2-9, ciclo)
const mod11Santander = (texto: string): string => {
  const pesoMaximo = 9
  let soma = 0
  let peso = 2
  for (let i = texto.length - 1; i >= 0; i--) {
    soma += Number(texto[i]) * peso
    if (peso === pesoMaximo) {
      peso = 2
    } else {
      peso++
    }
  }
  const resto = soma % 11
  if (resto <= 1) return "0"
  return (11 - resto).toString()
}

// Banco Santander legado - campo livre compatível com BoletoNet
class LegacySantander extends SantanderBanco {
  geraCodigoDeBarrasPara(boleto: any) {
    const beneficiario = boleto.getBeneficiario()
    const nossoNumero = beneficiario.getNossoNumero()
    const carteira = beneficiario.getCarteira()

    // Validações Santander
    const carteirasValidas = ["101", "102", "201"]
    if (!carteirasValidas.includes(carteira)) {
      throw new Error(`Santander: Carteira inválida. Carteiras aceitas: ${carteirasValidas.join(", ")}. Recebido: ${carteira}`)
    }

    if (!nossoNumero || nossoNumero.length > 12) {
      throw new Error(`Santander: Nosso número deve ter até 12 dígitos. Recebido: ${nossoNumero?.length || 0} dígitos`)
    }

    // Garantir tamanhos exatos (padStart não trunca, então usamos slice)
    const codigoFormatado = String(beneficiario.getCodigoBeneficiario() || "").padStart(7, "0").slice(-7)
    const nossoNumeroFormatado = String(nossoNumero || "").padStart(12, "0").slice(-12)
    const digitoNossoNumero = String(beneficiario.getDigitoNossoNumero() || mod11Santander(nossoNumeroFormatado)).slice(-1)
    const carteiraFormatada = String(carteira || "101").padStart(3, "0").slice(-3)

    // Campo livre Santander (25 posições):
    // 9 + código cedente (7) + nosso número (12) + DV nosso número (1) + IOS (1) + carteira (3)
    const campoLivre = [
      "9", // Fixo
      codigoFormatado.substring(0, 4), // 4 primeiros dígitos código cedente
      codigoFormatado.substring(4), // 3 últimos dígitos código cedente
      nossoNumeroFormatado.substring(0, 7), // 7 primeiros dígitos nosso número
      nossoNumeroFormatado.substring(7), // 5 últimos dígitos nosso número
      digitoNossoNumero, // DV nosso número
      "0", // IOS - Identificador de Operação no Sistema (0 para não seguradoras)
      carteiraFormatada, // Carteira
    ]

    return new BarcodeBuilder(boleto).comCampoLivre(campoLivre)
  }

  // Sobrescreve para exibir agência/código beneficiário SEM o DV no PDF
  getAgenciaECodigoBeneficiario(boleto: any) {
    const beneficiario = boleto.getBeneficiario()
    const codigo = String(beneficiario.getCodigoBeneficiario() || "").padStart(7, "0")
    // Exibe sem DV: AAAA/CCCCCCC
    return beneficiario.getAgenciaFormatada() + "/" + codigo
  }
}

// DV do nosso número Santander para exibição (formatado)
const dvNossoNumeroSantander = (nossoNumero: string): string => {
  const base = nossoNumero.padStart(12, "0")
  return mod11Santander(base)
}

type CedenteSantander = {
  razaoSocial: string
  cnpj: string
  agencia: string
  agenciaDigito?: string | null
  conta: string
  contaDigito?: string | null
  carteira: string
  codigoBeneficiario?: string | null
}

export async function generateSantanderBoletoPdf({
  cedente,
  sacado,
  titulo,
  destinoDir = "/tmp",
  nomeArquivo = "boleto-santander",
}: {
  cedente: CedenteSantander
  sacado: Sacado
  titulo: Titulo
  destinoDir?: string
  nomeArquivo?: string
}) {
  const carteira = String(cedente.carteira || "101").padStart(3, "0")
  const agencia = String(cedente.agencia || "").padStart(4, "0")
  // IMPORTANTE: A biblioteca gerar-boletos usa "conta" como codigoBeneficiario internamente
  const codigoBeneficiario = String(cedente.codigoBeneficiario || "").padStart(7, "0")
  const contaDigito = String(cedente.contaDigito || "0")
  const nossoNumero = String(titulo.nossoNumero || "").padStart(12, "0")
  const dvNN = dvNossoNumeroSantander(nossoNumero)
  const numeroDocumento = String(titulo.numeroDocumento || "").padStart(10, "0")

  const boleto = {
    banco: new LegacySantander(),
    pagador: {
      nome: sacado.nome,
      RegistroNacional: sacado.cnpj || sacado.cpf,
      endereco: {
        logradouro: sacado.logradouro || "",
        bairro: sacado.bairro || "",
        cidade: sacado.cidade || "",
        estadoUF: sacado.uf || "",
        cep: sacado.cep || "",
      },
    },
    beneficiario: {
      nome: cedente.razaoSocial,
      cnpj: cedente.cnpj,
      dadosBancarios: {
        carteira,
        agencia,
        agenciaDigito: String(cedente.agenciaDigito || "0"),
        // A biblioteca usa "conta" para definir codigoBeneficiario internamente
        conta: codigoBeneficiario,
        contaDigito,
        nossoNumero,
        nossoNumeroDigito: dvNN,
      },
      endereco: {
        logradouro: "",
        bairro: "",
        cidade: "",
        estadoUF: "",
        cep: "",
      },
    },
    boleto: {
      numeroDocumento,
      especieDocumento: "DM",
      valor: Number(titulo.valor),
      datas: {
        vencimento: titulo.vencimento,
        processamento: titulo.emissao || new Date(),
        documentos: titulo.emissao || new Date(),
      },
    },
    instrucoes: [
      titulo.mensagem1 || "ATENÇÃO: NÃO RECONHECEMOS BOLETOS ATUALIZADOS PELA INTERNET.",
      titulo.mensagem2 || "APOS O VENCIMENTO COBRAR MULTA R$ 15,49 E MORA DE 1,99% AO DIA",
    ],
  }

  const novoBoleto = new Boletos(boleto)
  novoBoleto.gerarBoleto()

  const outDir = path.resolve(destinoDir)
  const { filePath } = await novoBoleto.pdfFile(outDir, nomeArquivo)
  return { filePath }
}

