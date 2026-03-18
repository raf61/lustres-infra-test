import {
  generatePropostaOrcamentoPdf,
  type PropostaEmpresaKey,
  type PropostaOrcamentoInput,
} from "../../lib/documents/proposta-orcamento"

export type GeneratePropostaPdfInput = {
  empresa: PropostaEmpresaKey | string
  razaoSocial: string
  vocativo: string
  produto: string
  valorPorEquipamento: number | string
  valorUnitario: number | string
  subtotal?: number | string
  numeroParcelas: number | string
  primeiraParcela: string
  garantiaMeses: number | string
  consultorNome: string
  consultorCelular: string
  consultorEmail: string
  cnpj?: string
  endereco?: string
  cnpjEmpresa?: string
  data?: string
  conclusaoDias?: number | string
}

export type GeneratePropostaPdfOutput = {
  buffer: Buffer
  fileName: string
}

const parseRequiredNumber = (value: number | string | undefined, field: string) => {
  const parsed = Number(String(value ?? "").replace(",", "."))
  if (!Number.isFinite(parsed)) {
    throw new Error(`Campo invalido: ${field}.`)
  }
  return parsed
}

const parseRequiredString = (value: string | undefined, field: string) => {
  const trimmed = String(value ?? "").trim()
  if (!trimmed) {
    throw new Error(`Campo obrigatorio: ${field}.`)
  }
  return trimmed
}

const parseEmpresa = (value: string): PropostaEmpresaKey => {
  if (value === "EBR" || value === "FRANKLIN") return value
  throw new Error("Empresa invalida.")
}

const sanitizeFileName = (value: string) => {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
  const compact = normalized.replace(/\s+/g, "-").replace(/-+/g, "-")
  return compact || "proposta"
}

export class GeneratePropostaPdfUseCase {
  async execute(input: GeneratePropostaPdfInput): Promise<GeneratePropostaPdfOutput> {
    const empresa = parseEmpresa(parseRequiredString(input.empresa, "empresa"))
    const razaoSocial = parseRequiredString(input.razaoSocial, "razaoSocial")
    const vocativo = parseRequiredString(input.vocativo, "vocativo")
    const produto = parseRequiredString(input.produto, "produto")
    const valorPorEquipamento = parseRequiredNumber(input.valorPorEquipamento, "valorPorEquipamento")
    const valorUnitario = parseRequiredNumber(input.valorUnitario, "valorUnitario")
    const numeroParcelas = parseRequiredNumber(input.numeroParcelas, "numeroParcelas")
    const garantiaMeses = parseRequiredNumber(input.garantiaMeses, "garantiaMeses")
    const primeiraParcela = parseRequiredString(input.primeiraParcela, "primeiraParcela")
    const consultorNome = parseRequiredString(input.consultorNome, "consultorNome")
    const consultorCelular = parseRequiredString(input.consultorCelular, "consultorCelular")
    const consultorEmail = parseRequiredString(input.consultorEmail, "consultorEmail")

    if (numeroParcelas <= 0) {
      throw new Error("Numero de parcelas deve ser maior que zero.")
    }

    const subtotalRaw =
      input.subtotal === undefined || input.subtotal === null || input.subtotal === ""
        ? valorPorEquipamento * valorUnitario
        : parseRequiredNumber(input.subtotal, "subtotal")

    const propostaInput: PropostaOrcamentoInput = {
      empresa,
      razaoSocial,
      vocativo,
      produto,
      valorPorEquipamento,
      valorUnitario,
      subtotal: subtotalRaw,
      numeroParcelas,
      primeiraParcela,
      garantiaMeses,
      consultorNome,
      consultorCelular,
      consultorEmail,
      cnpj: input.cnpj,
      endereco: input.endereco,
      cnpjEmpresa: input.cnpjEmpresa,
      data: input.data,
      conclusaoDias: input.conclusaoDias ? Number(input.conclusaoDias) : undefined,
    }

    const buffer = await generatePropostaOrcamentoPdf(propostaInput)

    const fileName = `proposta-${sanitizeFileName(razaoSocial)}.pdf`

    return { buffer, fileName }
  }
}

