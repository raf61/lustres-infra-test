const sql = require("mssql")
const { PrismaClient, PedidoStatus } = require("@prisma/client")

const prisma = new PrismaClient()

// Configuração de conexão SQL Server
// IMPORTANTE: Se a tabela Pedido não estiver no banco "master", 
// defina a variável de ambiente SQL_SERVER_DATABASE com o nome correto do banco
const SQL_SERVER_CONFIG = {
  server: process.env.SQL_SERVER_HOST ?? "localhost",
  port: Number(process.env.SQL_SERVER_PORT ?? "1433"),
  user: process.env.SQL_SERVER_USER ?? "sa",
  password: process.env.SQL_SERVER_PASSWORD ?? "Passw0rd_",
  database: process.env.SQL_SERVER_DATABASE ?? "master",
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
}

// Schema padrão (dbo é o schema padrão do SQL Server)
const DB_SCHEMA = process.env.SQL_SERVER_SCHEMA ?? "sistema.dbo"

const DEFAULT_PAGE_SIZE = Number(process.env.LEGACY_PAGE_SIZE ?? "50")
const IMPORT_LIMIT = Number(process.env.IMPORT_LEGACY_LIMIT ?? "50")

const STATUS_MAP = {
  aprovado: PedidoStatus.CONCLUIDO,
  concluido: PedidoStatus.CONCLUIDO,
  aguardando: PedidoStatus.AGUARDANDO,
  agendado: PedidoStatus.AGENDADO_OU_EXECUCAO,
}

/**
 * Parse uma data que pode estar em formato ISO (2017-01-10T00:00:00) ou brasileiro (dd/mm/YYYY)
 * @param {string|Date} dateValue - String da data ou objeto Date
 * @returns {Date|null} - Objeto Date ou null se inválido
 */
function parseDate(dateValue) {
  if (!dateValue) return null
  if (dateValue instanceof Date) {
    return Number.isNaN(dateValue.getTime()) ? null : dateValue
  }

  const dateString = String(dateValue).trim()
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
    const date = new Date(Number.parseInt(year, 10), Number.parseInt(month, 10) - 1, Number.parseInt(day, 10))
    if (!Number.isNaN(date.getTime())) {
      return date
    }
  }

  return null
}

function buildObservacoes(legacy) {
  const extra = []
  if (legacy.FormaPagamento) extra.push(`formaPagamento:[${legacy.FormaPagamento}]`)
  if (legacy.Garantia != null) extra.push(`garantia:[${legacy.Garantia}]`)
  if (legacy.Medicao) extra.push(`medicao:[${legacy.Medicao}]`)
  if (legacy.BancoEmissor) extra.push(`bancoEmissor:[${legacy.BancoEmissor}]`)
  if (legacy.Rota) extra.push(`rota:[${legacy.Rota}]`)
  if (legacy.RotaConcluido) extra.push(`rotaConcluido:[${legacy.RotaConcluido}]`)
  if (legacy.StatusRota) extra.push(`statusRota:[${legacy.StatusRota}]`)
  if (legacy.ObsercacaoRota) extra.push(`observacaoRota:[${legacy.ObsercacaoRota}]`)
  if (legacy.NumNf) extra.push(`numNf:[${legacy.NumNf}]`)
  if (legacy.DataCertificado) extra.push(`dataCertificado:[${legacy.DataCertificado}]`)
  if (legacy.GeradoComissao != null) extra.push(`geradoComissao:[${legacy.GeradoComissao}]`)
  if (legacy.Empresa) extra.push(`empresa:[${legacy.Empresa}]`)

  const extras = extra.length > 0 ? `extras { ${extra.join(" , ")} }` : ""
  return extras.length > 0 ? extras : null
}

function mapLegacyOrder(legacy, clientId) {
  const statusKey = (legacy.Stats ?? legacy.Status ?? "").toString().trim().toLowerCase()
  const status = STATUS_MAP[statusKey] ?? PedidoStatus.AGUARDANDO

  return {
    id: legacy.Id,
    orcamentoId: legacy.IdOrcamento,
    clienteId: clientId,
    status,
    observacoes: buildObservacoes(legacy),
    vendedorId: legacy.IdPessoa ? String(legacy.IdPessoa) : null,
    createdAt: parseDate(legacy.Cadastro) || new Date(),
    updatedAt: parseDate(legacy.Cadastro) || new Date(),
  }
}

async function fetchLegacyOrdersFromDb(clientId, page, pageSize) {
  const pool = await sql.connect(SQL_SERVER_CONFIG)

  try {
    const offset = (page - 1) * pageSize
    const query = `
      SELECT 
        p.Id, p.Cadastro, p.IdOrcamento, p.Stats, p.FormaPagamento, p.Garantia, p.Obsercacoes, p.Medicao,
        p.BancoEmissor, p.GeradoComissao, p.DataCertificado, p.Rota, p.RotaConcluido, p.StatusRota,
        p.ObsercacaoRota, p.Empresa, p.NumNf, o.IdPessoa
      FROM ${DB_SCHEMA}.Pedido p
      INNER JOIN ${DB_SCHEMA}.Orcamento o ON p.IdOrcamento = o.Id
      WHERE o.IdCliente = @clientId
      ORDER BY p.Id
      OFFSET @offset ROWS
      FETCH NEXT @pageSize ROWS ONLY
    `
    const request = pool.request()
    request.input("clientId", sql.Int, clientId)
    request.input("offset", sql.Int, offset)
    request.input("pageSize", sql.Int, pageSize)

    const result = await request.query(query)
    return result.recordset || []
  } finally {
    await pool.close()
  }
}

async function importLegacyOrders(clientId, pageSize = DEFAULT_PAGE_SIZE) {
  let totalImported = 0
  let page = 1

  while (true) {
    const orders = await fetchLegacyOrdersFromDb(clientId, page, pageSize)
    if (orders.length === 0) break

    for (const legacyOrder of orders) {
      // Buscar o clienteId através do orcamentoId
      const orcamento = await prisma.orcamento.findUnique({
        where: { id: legacyOrder.IdOrcamento },
        select: { clienteId: true },
      })

      if (!orcamento) {
        console.warn(`Orçamento ${legacyOrder.IdOrcamento} não encontrado. Pulando pedido ${legacyOrder.Id}...`)
        continue
      }

      const mapped = mapLegacyOrder(legacyOrder, orcamento.clienteId)
      console.log(`Importando pedido ID ${mapped.id}...`)

      await prisma.pedido.upsert({
        where: { id: mapped.id },
        update: mapped,
        create: mapped,
      })

      totalImported += 1
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

  const pageSize = Number(process.argv[3] ?? DEFAULT_PAGE_SIZE)

  console.info(`Importando pedidos do cliente ${clientId} (pageSize=${pageSize})`)
  const result = await importLegacyOrders(clientId, pageSize)
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

