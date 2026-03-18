const https = require("node:https")
const { URL } = require("node:url")
const { PrismaClient, OrcamentoTipo, OrcamentoStatus, PedidoStatus } = require("@prisma/client")
const { formatCnpjForDatabase } = require("../utils/cnpj")

const prisma = new PrismaClient()

// URLs e tokens da API legada
const LEGACY_CLIENTS_URL = process.env.LEGACY_API_URL ?? "https://cb-api.idevweb.app/api/clientes"
const LEGACY_BUDGETS_URL = process.env.LEGACY_BUDGETS_URL ?? "https://cb-api.idevweb.app/api/orcamentos"
const LEGACY_ORDERS_URL = process.env.LEGACY_ORDERS_URL ?? "https://cb-api.idevweb.app/api/pedidos"
const LEGACY_TOKEN = process.env.LEGACY_API_TOKEN ?? "Aft5VzWmQx8LK8YWiH4kdIAlRrbVgsEtw53CuzZmCxlluIpyF4kYZLrPjzDEDSFF"

// Configurações de paginação
const DEFAULT_PAGE_SIZE = Number(process.env.LEGACY_PAGE_SIZE ?? "50")
const CLIENTS_PAGE_SIZE = 100 // Hard-coded para busca de clientes
const BUDGETS_IMPORT_LIMIT = Number(process.env.IMPORT_LEGACY_LIMIT ?? "50")
const ORDERS_IMPORT_LIMIT = Number(process.env.IMPORT_LEGACY_LIMIT ?? "50")

// Mapeamentos de status
const ORCAMENTO_STATUS_MAP = {
  imprimir: OrcamentoStatus.EM_ABERTO,
  aprovado: OrcamentoStatus.APROVADO,
  reprovado: OrcamentoStatus.REPROVADO,
  cancelado: OrcamentoStatus.CANCELADO,
}

const ORCAMENTO_TIPO_MAP = {
  vistoria: OrcamentoTipo.VISTORIADO,
  orcamento: OrcamentoTipo.ORCAMENTO,
}

const FRANKLIN_NAMES = new Set([
  "Franklin Instalações".toLowerCase(),
  "Franklin Instalacoes".toLowerCase(), // fallback sem acento
])

const mapEmpresaId = (legacyCompanyName) => {
  const name = (legacyCompanyName ?? "").toString().trim().toLowerCase()
  if (!name) return null
  return FRANKLIN_NAMES.has(name) ? 2 : 1
}

const PEDIDO_STATUS_MAP = {
  aprovado: PedidoStatus.CONCLUIDO,
  concluido: PedidoStatus.CONCLUIDO,
  aguardando: PedidoStatus.AGUARDANDO,
  agendado: PedidoStatus.AGENDADO_OU_EXECUCAO,
}

// Função HTTP genérica
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

// ========== FUNÇÃO DE PARSING DE DATAS FLEXÍVEL ==========

/**
 * Parse uma data que pode estar em formato ISO (2017-01-10T00:00:00) ou brasileiro (dd/mm/YYYY)
 * @param {string} dateString - String da data
 * @returns {Date|null} - Objeto Date ou null se inválido
 */
function parseDate(dateString) {
  if (!dateString) return null
  
  // Tentar formato ISO primeiro
  const isoDate = new Date(dateString)
  if (!Number.isNaN(isoDate.getTime())) {
    return isoDate
  }
  
  // Tentar formato brasileiro dd/mm/YYYY ou dd/mm/yyyy
  const brDateMatch = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (brDateMatch) {
    const [, day, month, year] = brDateMatch
    // new Date usa formato mm/dd/yyyy (mês começa em 0)
    const date = new Date(Number.parseInt(year, 10), Number.parseInt(month, 10) - 1, Number.parseInt(day, 10))
    if (!Number.isNaN(date.getTime())) {
      return date
    }
  }
  
  // Se não conseguiu parsear, retorna null
  console.warn(`Data inválida ou formato não reconhecido: ${dateString}`)
  return null
}

// ========== FUNÇÕES DE CLIENTES (do import-old-clients.js) ==========

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
    dataInicioMandato: parseDate(legacy.dataInicial),
    dataFimMandato: parseDate(legacy.dataFinal),
    observacao: observacao.length > 0 ? observacao : null,
  }
}

async function fetchLegacyClients(page, pageSize) {
  const url = new URL(LEGACY_CLIENTS_URL)
  url.searchParams.set("page", String(page))
  url.searchParams.set("pageSize", String(pageSize))

  const data = await httpGetJson(url.toString(), {
    accept: "*/*",
    Token: LEGACY_TOKEN,
  })

  const clients = data
  if (!Array.isArray(clients)) {
    throw new Error("Resposta inesperada da API legada")
  }
  return clients
}

async function fetchLegacyClientById(clientId) {
  const PAGE_SIZE = 100
  let page = 1
  let maxPages = 1000

  console.info(`Buscando cliente ID ${clientId} nas páginas da API legada...`)

  while (page <= maxPages) {
    const clients = await fetchLegacyClients(page, PAGE_SIZE)

    if (clients.length === 0) {
      throw new Error(`Cliente com ID ${clientId} não encontrado na API legada (páginas verificadas: ${page - 1})`)
    }

    const firstId = clients[0]?.id
    const lastId = clients[clients.length - 1]?.id

    if (!firstId || !lastId) {
      throw new Error("Resposta da API não contém IDs válidos")
    }

    if (clientId >= firstId && clientId <= lastId) {
      const client = clients.find((c) => c.id === clientId)
      if (client) {
        console.info(`Cliente ID ${clientId} encontrado na página ${page}`)
        return client
      }
      throw new Error(`Cliente com ID ${clientId} não encontrado (estava no intervalo da página ${page}, mas não está na lista)`)
    }

    if (clientId < firstId) {
      throw new Error(`Cliente com ID ${clientId} não encontrado. O ID é menor que o primeiro ID da página ${page} (${firstId})`)
    }

    console.info(`Página ${page}: IDs ${firstId}-${lastId}, cliente ${clientId} não está aqui. Continuando...`)
    page += 1
  }

  throw new Error(`Cliente com ID ${clientId} não encontrado após verificar ${maxPages} páginas`)
}

async function importLegacyClient(clientId) {
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
  return result
}

// ========== FUNÇÕES DE ORÇAMENTOS (do import-old-budgets.js) ==========

function mapLegacyBudget(legacy, clientId) {
  const tipoKey = (legacy.tipo ?? "").toString().trim().toLowerCase()
  const statusKey = (legacy.stats ?? legacy.status ?? "").toString().trim().toLowerCase()

  const tipo = ORCAMENTO_TIPO_MAP[tipoKey] ?? null
  const status = statusKey == "aprovado" ? OrcamentoStatus.APROVADO : OrcamentoStatus.EM_ABERTO

  const extraObservacoes = []
  if (legacy.nome) extraObservacoes.push(`nome:[${legacy.nome}]`)
  if (legacy.formaPagamento) extraObservacoes.push(`formaPagamento:[${legacy.formaPagamento}]`)
  if (legacy.visita) extraObservacoes.push(`visita:[${legacy.visita}]`)
  if (legacy.garantia != null) extraObservacoes.push(`garantia:[${legacy.garantia}]`)

  let observacoes = ((legacy.observacoes ? legacy.observacoes : "") + (extraObservacoes.length > 0 ? extraObservacoes.join(" | ") : ""))
  observacoes = observacoes ? observacoes.trim() : null

  return {
    id: legacy.id,
    clienteId: clientId,
    empresaId: mapEmpresaId(legacy.nomeEmpresa ?? legacy.empresa),
    status,
    parcelas: legacy.parcelas ?? null,
    primeiroVencimento: parseDate(legacy.primeiroVencimento),
    observacoes,
    anexo: legacy.anexo ?? null,
    createdAt: parseDate(legacy.cadastro) || new Date(),
    updatedAt: parseDate(legacy.cadastro) || new Date(),
  }
}

async function fetchLegacyBudgets(clientId, page, pageSize) {
  const url = new URL(`${LEGACY_BUDGETS_URL}/${clientId}`)
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

async function importLegacyBudgets(clientId, limit = BUDGETS_IMPORT_LIMIT, pageSize = DEFAULT_PAGE_SIZE) {
  let totalImported = 0
  let page = 1

  while (totalImported < limit) {
    const budgets = await fetchLegacyBudgets(clientId, page, pageSize)
    if (budgets.length === 0) break

    for (const legacyBudget of budgets) {
      const mapped = mapLegacyBudget(legacyBudget, Number(clientId))
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

// ========== FUNÇÕES DE PEDIDOS (do import-old-orders.js) ==========

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
  const status = PEDIDO_STATUS_MAP[statusKey] ?? PedidoStatus.AGUARDANDO

  return {
    id: legacy.id,
    orcamentoId: legacy.idOrcamento,
    clienteId: clientId,
    status,
    observacoes: buildObservacoes(legacy),
    createdAt: parseDate(legacy.cadastro) || new Date(),
    updatedAt: parseDate(legacy.cadastro) || new Date(),
  }
}

async function fetchLegacyOrders(clientId, page, pageSize) {
  const url = new URL(`${LEGACY_ORDERS_URL}/${clientId}`)
  url.searchParams.set("page", String(page))
  url.searchParams.set("pageSize", String(pageSize))

  const data = await httpGetJson(url.toString(), {
    accept: "*/*",
    Token: LEGACY_TOKEN,
  })

  const orders = data?.data ?? data?.items ?? data?.pedidos ?? data
  if (!Array.isArray(orders)) {
    throw new Error("Resposta inesperada da API de pedidos")
  }
  return orders
}

async function importLegacyOrders(clientId, limit = ORDERS_IMPORT_LIMIT, pageSize = DEFAULT_PAGE_SIZE) {
  let totalImported = 0
  let page = 1

  while (totalImported < limit) {
    const orders = await fetchLegacyOrders(clientId, page, pageSize)
    if (orders.length === 0) break

    for (const legacyOrder of orders) {
      const mapped = mapLegacyOrder(legacyOrder, clientId)

      await prisma.pedido.upsert({
        where: { id: mapped.id },
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

// ========== FUNÇÃO PRINCIPAL DE PROCESSAMENTO ==========

async function processClient(clientId) {
  console.info(`\n========== Processando cliente ID: ${clientId} ==========`)

  let budgetsImported = 0
  let ordersImported = 0

  try {
    // 1. Importar cliente
    const client = await importLegacyClient(clientId)
    console.info(`✓ Cliente ${clientId} importado`)

    // 2. Importar orçamentos do cliente (apenas se o cliente foi importado com sucesso)
    try {
      console.info(`\nImportando orçamentos do cliente ${clientId}...`)
      const budgetsResult = await importLegacyBudgets(clientId, BUDGETS_IMPORT_LIMIT, DEFAULT_PAGE_SIZE)
      budgetsImported = budgetsResult.totalImported
      console.info(`✓ Orçamentos importados: ${budgetsResult.totalImported}`)
    } catch (error) {
      console.error(`✗ Erro ao importar orçamentos do cliente ${clientId}:`, error.message)
      // Continua mesmo se houver erro nos orçamentos
    }

    // 3. Importar pedidos do cliente (apenas se o cliente foi importado com sucesso)
    try {
      console.info(`\nImportando pedidos do cliente ${clientId}...`)
      const ordersResult = await importLegacyOrders(clientId, ORDERS_IMPORT_LIMIT, DEFAULT_PAGE_SIZE)
      ordersImported = ordersResult.totalImported
      console.info(`✓ Pedidos importados: ${ordersResult.totalImported}`)
    } catch (error) {
      console.error(`✗ Erro ao importar pedidos do cliente ${clientId}:`, error.message)
      // Continua mesmo se houver erro nos pedidos
    }

    return {
      clientId,
      success: true,
      budgetsImported,
      ordersImported,
    }
  } catch (error) {
    console.error(`✗ Erro ao processar cliente ${clientId}:`, error.message)
    return {
      clientId,
      success: false,
      error: error.message,
      budgetsImported: 0,
      ordersImported: 0,
    }
  }
}

// ========== FUNÇÃO MAIN ==========

async function main() {
  const args = process.argv.slice(2)

  // Se não houver argumentos, buscar todos os clientes do banco de dados
  if (args.length === 0) {
    console.info("Modo: Importar todos os clientes do banco de dados")
    console.info(`Tamanho da página: ${CLIENTS_PAGE_SIZE}`)

    let page = 1
    let totalProcessed = 0
    let totalClients = 0
    let totalBudgets = 0
    let totalOrders = 0
    const errors = []

    while (true) {
      console.info(`\n========== Buscando clientes do banco (página ${page}) ==========`)
      
      const clients = await prisma.client.findMany({
        take: CLIENTS_PAGE_SIZE,
        skip: (page - 1) * CLIENTS_PAGE_SIZE,
        orderBy: { id: "asc" },
        select: { id: true },
      })

      if (clients.length === 0) {
        console.info("Não há mais clientes para processar.")
        break
      }

      console.info(`Encontrados ${clients.length} clientes na página ${page}`)

      for (const client of clients) {
        const result = await processClient(client.id)
        totalProcessed += 1
        totalClients += 1
        totalBudgets += result.budgetsImported
        totalOrders += result.ordersImported

        if (!result.success) {
          errors.push(result)
        }
      }

      if (clients.length < CLIENTS_PAGE_SIZE) {
        break
      }

      page += 1
    }

    console.info(`\n========== RESUMO FINAL ==========`)
    console.info(`Clientes processados: ${totalClients}`)
    console.info(`Orçamentos importados: ${totalBudgets}`)
    console.info(`Pedidos importados: ${totalOrders}`)
    if (errors.length > 0) {
      console.info(`Erros encontrados: ${errors.length}`)
      errors.forEach((e) => {
        console.error(`  - Cliente ${e.clientId}: ${e.error}`)
      })
    }
    return
  }

  // Se houver argumentos, são IDs específicos de clientes
  const clientIds = args.map((arg) => {
    const id = Number.parseInt(arg, 10)
    if (Number.isNaN(id) || id <= 0) {
      throw new Error(`ID inválido: ${arg}`)
    }
    return id
  })

  console.info(`Modo: Importar clientes específicos`)
  console.info(`IDs: ${clientIds.join(", ")}`)

  let totalClients = 0
  let totalBudgets = 0
  let totalOrders = 0
  const errors = []

  for (const clientId of clientIds) {
    const result = await processClient(clientId)
    totalClients += 1
    totalBudgets += result.budgetsImported
    totalOrders += result.ordersImported

    if (!result.success) {
      errors.push(result)
    }
  }

  console.info(`\n========== RESUMO FINAL ==========`)
  console.info(`Clientes processados: ${totalClients}`)
  console.info(`Orçamentos importados: ${totalBudgets}`)
  console.info(`Pedidos importados: ${totalOrders}`)
  if (errors.length > 0) {
    console.info(`Erros encontrados: ${errors.length}`)
    errors.forEach((e) => {
      console.error(`  - Cliente ${e.clientId}: ${e.error}`)
    })
  }
}

main()
  .catch((error) => {
    console.error("Erro durante importação:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

