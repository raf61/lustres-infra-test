const sql = require("mssql")
const { PrismaClient, OrcamentoStatus } = require("@prisma/client")

const prisma = new PrismaClient()

// Configuração de conexão SQL Server
// IMPORTANTE: Se a tabela Orcamento não estiver no banco "master", 
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
const DB_SCHEMA = "sistema.dbo"

const DEFAULT_PAGE_SIZE = Number(process.env.LEGACY_PAGE_SIZE ?? "50")
const IMPORT_LIMIT = Number(process.env.IMPORT_LEGACY_LIMIT ?? "50")

const STATUS_MAP = {
  imprimir: OrcamentoStatus.EM_ABERTO,
  aprovado: OrcamentoStatus.APROVADO,
  reprovado: OrcamentoStatus.REPROVADO,
  cancelado: OrcamentoStatus.CANCELADO,
}

const FRANKLIN_NAMES = new Set([
  "Franklin Instalações".toLowerCase(),
  "Franklin Instalacoes".toLowerCase(), // fallback sem acento
])

function mapEmpresaId(legacyCompanyName) {
  const name = (legacyCompanyName ?? "").toString().trim().toLowerCase()
  if (!name) return null
  return FRANKLIN_NAMES.has(name) ? 2 : 1
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

function mapLegacyBudget(legacy, clientId) {
  const statusKey = (legacy.Stats ?? legacy.Status ?? "").toString().trim().toLowerCase()

  const status = statusKey === "aprovado" ? OrcamentoStatus.APROVADO : OrcamentoStatus.EM_ABERTO

  const extraObservacoes = []
  if (legacy.FormaPagamento) extraObservacoes.push(`formaPagamento:[${legacy.FormaPagamento}]`)
  if (legacy.Visita) extraObservacoes.push(`visita:[${legacy.Visita}]`)
  if (legacy.Garantia != null) extraObservacoes.push(`garantia:[${legacy.Garantia}]`)

  const observacoes = extraObservacoes.length > 0 ? extraObservacoes.join(" | ") : null

  return {
    id: legacy.Id,
    clienteId: clientId,
    empresaId: mapEmpresaId(legacy.Empresa),
    status,
    parcelas: legacy.Parcelas ?? null,
    primeiroVencimento: parseDate(legacy.PrimeiroVencimento),
    observacoes,
    anexo: legacy.Anexo ?? null,
    vendedorId: legacy.IdPessoa ? String(legacy.IdPessoa) : null,
    createdAt: parseDate(legacy.Cadastro) || new Date(),
    updatedAt: parseDate(legacy.Cadastro) || new Date(),
  }
}

async function fetchLegacyBudgetsFromDb(clientId, page, pageSize) {
  const pool = await sql.connect(SQL_SERVER_CONFIG)

  try {
    const offset = (page - 1) * pageSize
    const query = `
      SELECT 
        Id, IdCliente, IdPessoa, Stats, FormaPagamento, Visita, Garantia,
        Parcelas, PrimeiroVencimento, Anexo, Cadastro
      FROM ${DB_SCHEMA}.Orcamento
      WHERE IdCliente = @clientId
      ORDER BY Id
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

async function importLegacyBudgets(clientId, pageSize = DEFAULT_PAGE_SIZE) {
  let totalImported = 0
  let page = 1

  while (true) {
    const budgets = await fetchLegacyBudgetsFromDb(clientId, page, pageSize)
    if (budgets.length === 0) break

    for (const legacyBudget of budgets) {
      const mapped = mapLegacyBudget(legacyBudget, Number(clientId))
      console.log(`Importando orçamento ID ${mapped.id}...`)
      await prisma.orcamento.upsert({
        where: { id: mapped.id },
        update: mapped,
        create: mapped,
      })

      totalImported += 1
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

  const pageSize = Number(process.argv[3] ?? DEFAULT_PAGE_SIZE)

  console.info(`Importando orçamentos do cliente ${clientId} (pageSize=${pageSize})`)
  const result = await importLegacyBudgets(clientId, pageSize)
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

