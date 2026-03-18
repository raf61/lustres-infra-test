const https = require("node:https")
const { URL } = require("node:url")
const { PrismaClient } = require("@prisma/client")
const { formatCnpjForDatabase } = require("../utils/cnpj")

const prisma = new PrismaClient()

const LEGACY_API_URL = process.env.LEGACY_API_URL ?? "https://cb-api.idevweb.app/api/clientes"
const LEGACY_TOKEN = process.env.LEGACY_API_TOKEN ?? "Aft5VzWmQx8LK8YWiH4kdIAlRrbVgsEtw53CuzZmCxlluIpyF4kYZLrPjzDEDSFF"
const DEFAULT_PAGE_SIZE = Number(process.env.LEGACY_PAGE_SIZE ?? "50")
const IMPORT_LIMIT = Number(process.env.IMPORT_LEGACY_LIMIT ?? "5")

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
          return reject(new Error(`Falha na requisição (${res.statusCode}): ${body}`))
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

function mapLegacyToNew(legacy) {
  const telefoneAntigos = []
  if (legacy.gerente) telefoneAntigos.push(`gerente:[${legacy.gerente}]`)
  if (legacy.portaria) telefoneAntigos.push(`portaria:[${legacy.portaria}]`)
  if (legacy.residencial) telefoneAntigos.push(`residencial:[${legacy.residencial}]`)
  if (legacy.outros) telefoneAntigos.push(`outros:[${legacy.outros}]`)

  const observacaoExtra = telefoneAntigos.length > 0 ? ` | telefones antigos { ${telefoneAntigos.join(" , ")} }` : ""
  const observacao = `${legacy.observacao ?? ""}${observacaoExtra}`.trim()

  return {
    id: legacy.id,
    razaoSocial: legacy.razaoSocial,
    cnpj: formatCnpjForDatabase(legacy.cpfCnpj),
    cep: legacy.cep || null,
    logradouro: legacy.logradouro || null,
    numero: legacy.numero || null,
    complemento: legacy.complemento || null,
    bairro: legacy.bairro || null,
    cidade: legacy.cidade || null,
    estado: legacy.estado || null,
    telefoneCondominio: legacy.telefone || null,
    telefoneSindico: legacy.celular || null,
    telefonePorteiro: legacy.portaria || null,
    dataInicioMandato: legacy.dataInicial ? new Date(legacy.dataInicial) : null,
    dataFimMandato: legacy.dataFinal ? new Date(legacy.dataFinal) : null,
    observacao: observacao.length > 0 ? observacao : null,
  }
}

async function fetchLegacyClients(page, pageSize) {
  const url = new URL(LEGACY_API_URL)
  url.searchParams.set("page", String(page))
  url.searchParams.set("pageSize", String(pageSize))

  const data = await httpGetJson(url.toString(), {
    accept: "*/*",
    Token: LEGACY_TOKEN,
  })
  //console.log(data)

  const clients = data
  if (!Array.isArray(clients)) {
    throw new Error("Resposta inesperada da API legada")
  }
  return clients
}

async function fetchLegacyClientById(clientId) {
  const PAGE_SIZE = 100
  let page = 1
  let maxPages = 1000 // Limite de segurança para evitar loop infinito

  console.info(`Buscando cliente ID ${clientId} nas páginas da API legada...`)

  while (page <= maxPages) {
    const clients = await fetchLegacyClients(page, PAGE_SIZE)

    if (clients.length === 0) {
      throw new Error(`Cliente com ID ${clientId} não encontrado na API legada (páginas verificadas: ${page - 1})`)
    }

    // Pegar o primeiro e último ID da página
    const firstId = clients[0]?.id
    const lastId = clients[clients.length - 1]?.id

    if (!firstId || !lastId) {
      throw new Error("Resposta da API não contém IDs válidos")
    }

    // Verificar se o ID procurado está nesta página
    if (clientId >= firstId && clientId <= lastId) {
      // Procurar o cliente específico na lista
      const client = clients.find((c) => c.id === clientId)
      if (client) {
        console.info(`Cliente ID ${clientId} encontrado na página ${page}`)
        return client
      }
      // Se não encontrou mas está no intervalo, pode ser que o ID não exista
      throw new Error(`Cliente com ID ${clientId} não encontrado (estava no intervalo da página ${page}, mas não está na lista)`)
    }

    // Se o ID procurado é menor que o primeiro ID da página, não vai encontrar mais
    if (clientId < firstId) {
      throw new Error(`Cliente com ID ${clientId} não encontrado. O ID é menor que o primeiro ID da página ${page} (${firstId})`)
    }

    // Se chegou aqui, o ID é maior que o último da página, continuar para próxima
    console.info(`Página ${page}: IDs ${firstId}-${lastId}, cliente ${clientId} não está aqui. Continuando...`)
    page += 1
  }

  throw new Error(`Cliente com ID ${clientId} não encontrado após verificar ${maxPages} páginas`)
}

async function importLegacyClients(limit = IMPORT_LIMIT, pageSize = DEFAULT_PAGE_SIZE) {
  let totalImported = 0
  let page = 1

  while (totalImported < limit) {
    const clients = await fetchLegacyClients(page, pageSize)
    console.log(clients)
    if (clients.length === 0) break
    for (const legacyClient of clients) {
      const mapped = mapLegacyToNew(legacyClient)

      await prisma.client.upsert({
        where: { id: mapped.id },
        update: mapped,
        create: {
          ...mapped,
        },
      })

      totalImported += 1
      if (totalImported >= limit) {
        break
      }
    }

    if (clients.length < pageSize) {
      break
    }

    page += 1
  }

  return { totalImported, pagesFetched: page }
}

async function importLegacyClientById(clientId) {
  console.info(`Buscando cliente legado com ID: ${clientId}`)
  const legacyClient = await fetchLegacyClientById(clientId)
  console.info(`Cliente encontrado: ${legacyClient.razaoSocial || legacyClient.nome || "N/A"}`)

  const mapped = mapLegacyToNew(legacyClient)

  console.info(`Importando cliente ID ${mapped.id}...`)
  const result = await prisma.client.upsert({
    where: { id: mapped.id },
    update: mapped,
    create: {
      ...mapped,
    },
  })

  console.info(`Cliente ${result.id} importado/atualizado com sucesso!`)
  return { totalImported: 1, clientId: result.id }
}

async function main() {
  // Verificar se há flag --id
  const idIndex = process.argv.indexOf("--id")
  if (idIndex !== -1 && process.argv[idIndex + 1]) {
    const clientId = Number.parseInt(process.argv[idIndex + 1], 10)
    if (Number.isNaN(clientId)) {
      console.error("Erro: ID do cliente deve ser um número válido")
      process.exitCode = 1
      return
    }

    console.info(`Iniciando importação de cliente específico (ID=${clientId})`)
    const result = await importLegacyClientById(clientId)
    console.info(`Importação concluída. Cliente importado: ${result.clientId}`)
    return
  }

  // Modo normal: importação em lote
  const limit = Number(process.argv[2] ?? IMPORT_LIMIT)
  const pageSize = Number(process.argv[3] ?? DEFAULT_PAGE_SIZE)

  console.info(`Iniciando importação de clientes legados (limite=${limit}, pageSize=${pageSize})`)
  const result = await importLegacyClients(limit, pageSize)
  console.info(`Importação concluída. Clientes importados: ${result.totalImported}`)
}

main()
  .catch((error) => {
    console.error("Erro durante importação de clientes legados:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
