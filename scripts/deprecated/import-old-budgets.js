const https = require("node:https")
const { URL } = require("node:url")
const { PrismaClient, OrcamentoTipo, OrcamentoStatus } = require("@prisma/client")

const prisma = new PrismaClient()

const LEGACY_API_URL = process.env.LEGACY_BUDGETS_URL ?? "https://cb-api.idevweb.app/api/orcamentos"
const LEGACY_TOKEN = process.env.LEGACY_API_TOKEN ?? "Aft5VzWmQx8LK8YWiH4kdIAlRrbVgsEtw53CuzZmCxlluIpyF4kYZLrPjzDEDSFF"
const DEFAULT_PAGE_SIZE = Number(process.env.LEGACY_PAGE_SIZE ?? "50")
const IMPORT_LIMIT = Number(process.env.IMPORT_LEGACY_LIMIT ?? "50")

const STATUS_MAP = {
  imprimir: OrcamentoStatus.EM_ABERTO,
  aprovado: OrcamentoStatus.APROVADO,
  reprovado: OrcamentoStatus.REPROVADO,
  cancelado: OrcamentoStatus.CANCELADO,
}

const TIPO_MAP = {
  vistoria: OrcamentoTipo.VISTORIADO,
  orcamento: OrcamentoTipo.ORCAMENTO,
}

function httpGetJson(url, headers = {}) {
  const parsed = new URL(url)
  const options = {
    method: "GET",
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    port: parsed.port,
    path: `${parsed.pathname}${parsed.search}`,
    headers,
  }

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = ""
      res.setEncoding("utf8")
      res.on("data", (chunk) => {
        body += chunk
      })
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`Request failed (${res.statusCode}): ${body}`))
        }
        try {
          resolve(body ? JSON.parse(body) : {})
        } catch (error) {
          reject(error)
        }
      })
    })

    req.on("error", reject)
    req.end()
  })
}

function mapLegacyBudget(legacy, clientId) {
  const tipoKey = (legacy.tipo ?? "").toString().trim().toLowerCase()
  const statusKey = (legacy.stats ?? legacy.status ?? "").toString().trim().toLowerCase()

  const tipo = TIPO_MAP[tipoKey] ?? null
  const status = statusKey == "aprovado" ? OrcamentoStatus.APROVADO : OrcamentoStatus.EM_ABERTO

  const extraObservacoes = []
  if (legacy.nome) extraObservacoes.push(`nome:[${legacy.nome}]`)
  if (legacy.formaPagamento) extraObservacoes.push(`formaPagamento:[${legacy.formaPagamento}]`)
  if (legacy.visita) extraObservacoes.push(`visita:[${legacy.visita}]`)
  if (legacy.garantia != null) extraObservacoes.push(`garantia:[${legacy.garantia}]`)

  let observacoes = ((legacy.observacoes? legacy.observacoes : "") + (extraObservacoes.length > 0 ? extraObservacoes.join(" | ") : ""))
  observacoes = observacoes? observacoes.trim() : null

  return {
    id: legacy.id,
    clienteId: clientId,
    //tipo, ( entender )
    status,
    parcelas: legacy.parcelas ?? null,
    primeiroVencimento: legacy.primeiroVencimento ? new Date(legacy.primeiroVencimento) : null,
    observacoes,
    //vendedorId:"" (entender)
    anexo: legacy.anexo ?? null,
    createdAt: legacy.cadastro ? new Date(legacy.cadastro) : new Date(),
    updatedAt: legacy.cadastro ? new Date(legacy.cadastro) : new Date(),
  }
}

async function fetchLegacyBudgets(clientId, page, pageSize) {
  const url = new URL(`${LEGACY_API_URL}/${clientId}`)
  url.searchParams.set("page", String(page))
  url.searchParams.set("pageSize", String(pageSize))

  const data = await httpGetJson(url.toString(), {
    accept: "*/*",
    Token: LEGACY_TOKEN,
  })

  const budgets = data?.data ?? data?.items ?? data?.orcamentos ?? data
  if (!Array.isArray(budgets)) {
    throw new Error("Resposta inesperada da API de orçamentos")
  }
  return budgets
}

async function importLegacyBudgets(clientId, limit = IMPORT_LIMIT, pageSize = DEFAULT_PAGE_SIZE) {
  let totalImported = 0
  let page = 1

  while (totalImported < limit) {
    const budgets = await fetchLegacyBudgets(clientId, page, pageSize)
    if (budgets.length === 0) break

    for (const legacyBudget of budgets) {
      const mapped = mapLegacyBudget(legacyBudget, Number(clientId))
      console.log(mapped)
      await prisma.orcamento.upsert({
        where: { id: mapped.id },
        update: mapped,
        create: mapped,
      })

      totalImported += 1
      if (totalImported >= limit) {
        break
      }
    }

    if (budgets.length < pageSize) {
      break
    }

    page += 1
  }

  return { totalImported, pagesFetched: page }
}

async function main() {
  const clientIdArg = process.argv[2]
  if (!clientIdArg) {
    throw new Error("Informe o ID do cliente legado como primeiro argumento")
  }

  const clientId = Number(clientIdArg)
  if (Number.isNaN(clientId) || clientId <= 0) {
    throw new Error("ID do cliente inválido")
  }

  const limit = Number(process.argv[3] ?? IMPORT_LIMIT)
  const pageSize = Number(process.argv[4] ?? DEFAULT_PAGE_SIZE)

  console.info(`Importando orçamentos do cliente ${clientId} (limite=${limit}, pageSize=${pageSize})`)
  const result = await importLegacyBudgets(clientId, limit, pageSize)
  console.info(`Importação concluída. Orçamentos importados: ${result.totalImported}`)
}

main()
  .catch((error) => {
    console.error("Erro durante importação de orçamentos legados:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
