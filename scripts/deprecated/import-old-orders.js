const https = require("node:https")
const { URL } = require("node:url")
const { PrismaClient, PedidoStatus } = require("@prisma/client")

const prisma = new PrismaClient()

const LEGACY_API_URL = process.env.LEGACY_ORDERS_URL ?? "https://cb-api.idevweb.app/api/pedidos"
const LEGACY_TOKEN = process.env.LEGACY_API_TOKEN ?? "Aft5VzWmQx8LK8YWiH4kdIAlRrbVgsEtw53CuzZmCxlluIpyF4kYZLrPjzDEDSFF"
const DEFAULT_PAGE_SIZE = Number(process.env.LEGACY_PAGE_SIZE ?? "50")
const IMPORT_LIMIT = Number(process.env.IMPORT_LEGACY_LIMIT ?? "50")

const STATUS_MAP = {
  aprovado: PedidoStatus.CONCLUIDO,
  concluido: PedidoStatus.CONCLUIDO,
  aguardando: PedidoStatus.AGUARDANDO,
  agendado: PedidoStatus.AGENDADO_OU_EXECUCAO,
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

function buildObservacoes(legacy) {
  const extra = []
  if (legacy.formaPagamento) extra.push(`formaPagamento:[${legacy.formaPagamento}]`)
  if (legacy.garantia != null) extra.push(`garantia:[${legacy.garantia}]`)
  if (legacy.medicao) extra.push(`medicao:[${legacy.medicao}]`)
  if (legacy.bancoEmissor) extra.push(`bancoEmissor:[${legacy.bancoEmissor}]`)
  if (legacy.rota) extra.push(`rota:[${legacy.rota}]`)
  if (legacy.rotaConcluido) extra.push(`rotaConcluido:[${legacy.rotaConcluido}]`)
  if (legacy.statusRota) extra.push(`statusRota:[${legacy.statusRota}]`)
  if (legacy.observacaoRota) extra.push(`observacaoRota:[${legacy.observacaoRota}]`)
  if (legacy.numNf) extra.push(`numNf:[${legacy.numNf}]`)
  if (legacy.dataCertificado) extra.push(`dataCertificado:[${legacy.dataCertificado}]`)
  if (legacy.geradoComissao != null) extra.push(`geradoComissao:[${legacy.geradoComissao}]`)
  if (legacy.idTecnico) extra.push(`idTecnico:[${legacy.idTecnico}]`)

  const base = legacy.obsercacoes ?? legacy.observacoes ?? ""
  const extras = extra.length > 0 ? ` | extras { ${extra.join(" , ")} }` : ""
  const texto = `${base}${extras}`.trim()
  return texto.length > 0 ? texto : null
}

function mapLegacyOrder(legacy, clientId) {
  const statusKey = (legacy.stats ?? legacy.status ?? "").toString().trim().toLowerCase()
  const status = STATUS_MAP[statusKey] ?? PedidoStatus.AGUARDANDO

  return {
    id: legacy.id,
    orcamentoId: legacy.idOrcamento,
    clienteId: clientId,
    status,
    observacoes: buildObservacoes(legacy),
    //vendedorId: legacy.idTecnico ? String(legacy.idTecnico) : null,
    createdAt: legacy.cadastro ? new Date(legacy.cadastro) : new Date(),
    updatedAt: legacy.cadastro ? new Date(legacy.cadastro) : new Date(),
  }
}

async function fetchLegacyOrders(clientId, page, pageSize) {
  const url = new URL(`${LEGACY_API_URL}/${clientId}`)
  url.searchParams.set("page", String(page))
  url.searchParams.set("pageSize", String(pageSize))

  const data = await httpGetJson(url.toString(), {
    accept: "*/*",
    Token: LEGACY_TOKEN,
  })
  console.log(data)
  const orders = data?.data ?? data?.items ?? data?.pedidos ?? data
  if (!Array.isArray(orders)) {
    throw new Error("Resposta inesperada da API de pedidos")
  }
  return orders
}

async function importLegacyOrders(clientId, limit = IMPORT_LIMIT, pageSize = DEFAULT_PAGE_SIZE) {
  let totalImported = 0
  let page = 1

  while (totalImported < limit) {
    const orders = await fetchLegacyOrders(clientId, page, pageSize)
    if (orders.length === 0) break
    for (const legacyOrder of orders) {
        const mapped = mapLegacyOrder(legacyOrder, clientId)
        
        
        await prisma.pedido.upsert({
            where: { id: mapped.id},
            update: mapped,
            create: mapped,
          })

      totalImported += 1
      if (totalImported >= limit) {
        break
      }
    }

    if (orders.length < pageSize) {
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

  console.info(`Importando pedidos do cliente ${clientId} (limite=${limit}, pageSize=${pageSize})`)
  const result = await importLegacyOrders(clientId, limit, pageSize)
  console.info(`Importação concluída. Pedidos importados: ${result.totalImported}`)
}

main()
  .catch((error) => {
    console.error("Erro durante importação de pedidos legados:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


