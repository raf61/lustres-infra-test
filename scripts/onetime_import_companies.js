/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client")
const { extractDigits, formatCnpjDigits } = require("./utils/cnpj")
const { resetSequences } = require("./utils/reset-sequences")

const prisma = new PrismaClient()

const EMPRESAS = [
  { id: 1, nome: "Empresa Brasileira de Raios", logoUrl: "/logo_ebr.png" },
  { id: 2, nome: "Franklin Instalações", logoUrl: "/logo_franklin.png"},
]

const FILIAIS = {
  2: [
    { cnpj: "27.552.196/0001-83", uf: "RJ" },
    { cnpj: "27.552.196/0002-64", uf: "SP" },
    { cnpj: "27.552.196/0003-45", uf: "PR" },
    { cnpj: "27.552.196/0004-26", uf: "DF" },
    { cnpj: "27.552.196/0005-07", uf: "CE" },
    { cnpj: "27.552.196/0006-98", uf: "PE" },
  ],
  1: [
    { cnpj: "51.621.017/0001-05", uf: "RJ" },
    { cnpj: "51.621.017/0002-88", uf: "DF" },
    { cnpj: "51.621.017/0003-69", uf: "PR" },
    { cnpj: "51.621.017/0004-40", uf: "PE" },
    { cnpj: "51.621.017/0005-20", uf: "SP" },
  ],
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function formatCnpj(cnpjRaw) {
  const digits = extractDigits(cnpjRaw)
  const formatted = formatCnpjDigits(digits)
  if (!formatted) {
    throw new Error(`CNPJ inválido: ${cnpjRaw}`)
  }
  return formatted
}

async function fetchCnpjData(cnpjFormatted) {
  const url = `https://api.opencnpj.org/${cnpjFormatted}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Falha ao buscar CNPJ ${cnpjFormatted} (${response.status})`)
  }
  return response.json()
}

function buildDadosCadastrais(data) {
  const firstPhone = Array.isArray(data?.telefones) ? data.telefones.find((tel) => !tel?.is_fax) : null

  return {
    razao_social: data?.razao_social ?? "",
    logradouro: data?.logradouro ?? "",
    numero: data?.numero ?? "",
    complemento: data?.complemento ?? "",
    municipio: data?.municipio ?? "",
    bairro: data?.bairro ?? "",
    cep: data?.cep ? String(data.cep).replace(/\D/g, "") : "",
    tel: firstPhone ? `${firstPhone.ddd ?? ""}${firstPhone.numero ?? ""}`.replace(/\D/g, "") : "",
  }
}

async function upsertEmpresas() {
  for (const empresa of EMPRESAS) {
    await prisma.empresa.upsert({
      where: { id: empresa.id },
      update: { nome: empresa.nome },
      create: { id: empresa.id, nome: empresa.nome, logoUrl: empresa.logoUrl },
    })
    console.info(`✅ Empresa garantida: [${empresa.id}] ${empresa.nome}`)
  }
}

async function upsertFilial(empresaId, filial) {
  const cnpjFormatted = formatCnpj(filial.cnpj)
  let cnpjData = null

  try {
    cnpjData = await fetchCnpjData(cnpjFormatted)
  } catch (error) {
    console.error(`⚠️  Não foi possível obter dados do CNPJ ${cnpjFormatted}:`, error.message)
  }

  const uf = (cnpjData?.uf || filial.uf || "").toUpperCase()
  const dadosCadastrais = buildDadosCadastrais(cnpjData || {})
  const inscricaoMunicipal =
    cnpjData?.inscricoes_municipais?.[0]?.inscricao ??
    cnpjData?.inscricoes_estaduais?.[0]?.inscricao ??
    cnpjData?.inscricao_municipal ??
    null
  const codAtividade = cnpjData?.cnae_fiscal_descricao ?? cnpjData?.cnae_fiscal ?? null

  await prisma.filial.upsert({
    where: { cnpj: cnpjFormatted },
    update: {
      empresaId,
      uf,
      dadosCadastrais,
      inscricao_municipal: inscricaoMunicipal,
      cod_atividade: codAtividade,
    },
    create: {
      empresaId,
      cnpj: cnpjFormatted,
      uf,
      dadosCadastrais,
      inscricao_municipal: inscricaoMunicipal,
      cod_atividade: codAtividade,
    },
  })

  console.info(`✅ Filial garantida: Empresa ${empresaId} - ${cnpjFormatted} (${uf})`)
}

async function upsertFiliais() {
  for (const [empresaIdStr, listaFiliais] of Object.entries(FILIAIS)) {
    const empresaId = Number(empresaIdStr)
    for (const filial of listaFiliais) {
      await upsertFilial(empresaId, filial)
      await delay(300) // evitar throttling na API pública
    }
  }
}

async function main() {
  console.info("Iniciando importação de empresas e filiais...")
  await upsertEmpresas()
  await upsertFiliais()
  await resetSequences(prisma, ["Empresa", "Filial"])
  console.info("✅ Concluído.")
}

main()
  .catch((error) => {
    console.error("Erro na importação de empresas/filiais:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
