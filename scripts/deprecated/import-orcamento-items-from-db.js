const sql = require("mssql")
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

// Configuração de conexão SQL Server
// IMPORTANTE: Se a tabela OrcamentoItem não estiver no banco "master", 
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
const IMPORT_LIMIT = Number(process.env.IMPORT_LEGACY_LIMIT ?? "1000")

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

function mapLegacyToNew(legacy) {
  return {
    id: legacy.Id,
    orcamentoId: legacy.IdOrcamento,
    itemId: BigInt(legacy.IdItem),
    quantidade: legacy.Quantidade ? Number.parseInt(legacy.Quantidade, 10) : 0,
    valor: legacy.Valor ? Number.parseFloat(legacy.Valor) : 0,
    createdAt: parseDate(legacy.Cadastro) || new Date(),
    updatedAt: parseDate(legacy.Cadastro) || new Date(),
  }
}

async function fetchLegacyOrcamentoItemsFromDb(orcamentoId, page, pageSize) {
  const pool = await sql.connect(SQL_SERVER_CONFIG)

  try {
    const offset = (page - 1) * pageSize
    const query = `
      SELECT 
        Id, Cadastro, IdOrcamento, IdItem, Quantidade, Valor
      FROM ${DB_SCHEMA}.OrcamentoItem
      WHERE IdOrcamento = @orcamentoId
      ORDER BY Id
      OFFSET @offset ROWS
      FETCH NEXT @pageSize ROWS ONLY
    `
    const request = pool.request()
    request.input("orcamentoId", sql.Int, orcamentoId)
    request.input("offset", sql.Int, offset)
    request.input("pageSize", sql.Int, pageSize)

    const result = await request.query(query)
    return result.recordset || []
  } catch (error) {
    if (error.message && error.message.includes("Invalid object name")) {
      console.error("\n❌ ERRO: Tabela não encontrada!")
      console.error(`   Banco de dados atual: ${SQL_SERVER_CONFIG.database}`)
      console.error(`   Schema: ${DB_SCHEMA}`)
      console.error("\n💡 SOLUÇÃO:")
      console.error("   Defina a variável de ambiente SQL_SERVER_DATABASE com o nome correto do banco:")
      console.error(`   Exemplo: SQL_SERVER_DATABASE=nome_do_banco node scripts/import-orcamento-items-from-db.js ${orcamentoId}`)
      console.error("\n   Ou exporte antes de executar:")
      console.error(`   export SQL_SERVER_DATABASE=nome_do_banco`)
      console.error(`   node scripts/import-orcamento-items-from-db.js ${orcamentoId}\n`)
    }
    throw error
  } finally {
    await pool.close()
  }
}

async function importLegacyOrcamentoItems(orcamentoId, pageSize = DEFAULT_PAGE_SIZE) {
  let totalImported = 0
  let page = 1

  while (true) {
    const items = await fetchLegacyOrcamentoItemsFromDb(orcamentoId, page, pageSize)
    if (items.length === 0) break

    for (const legacyItem of items) {
      const mapped = mapLegacyToNew(legacyItem)

      await prisma.orcamentoItem.upsert({
        where: { id: mapped.id },
        update: mapped,
        create: mapped,
      })

      totalImported += 1
      if (totalImported % 50 === 0) {
        console.info(`Importados ${totalImported} itens do orçamento ${orcamentoId}...`)
      }
    }

    if (items.length < pageSize) {
      break
    }

    page += 1
  }

  return { totalImported, pagesFetched: page }
}

async function main() {
  const clientIdArg = process.argv[2]
  if (!clientIdArg) {
    console.error("Erro: Informe o ID do cliente como primeiro argumento")
    console.error("Exemplo: node scripts/import-orcamento-items-from-db.js 123")
    process.exitCode = 1
    return
  }

  const clientId = Number.parseInt(clientIdArg, 10)
  if (Number.isNaN(clientId) || clientId <= 0) {
    console.error("Erro: ID do cliente deve ser um número válido")
    process.exitCode = 1
    return
  }

  // Buscar todos os orçamentos do cliente no banco novo
  console.info(`Buscando orçamentos do cliente ${clientId} no banco de dados novo...`)
  const orcamentos = await prisma.orcamento.findMany({
    where: {
      clienteId: clientId,
    },
    select: {
      id: true,
    },
    orderBy: {
      id: "asc",
    },
  })

  if (orcamentos.length === 0) {
    console.warn(`Nenhum orçamento encontrado para o cliente ${clientId}`)
    return
  }

  console.info(`Encontrados ${orcamentos.length} orçamentos para o cliente ${clientId}`)

  let totalItemsImported = 0
  const pageSize = Number(process.argv[3] ?? DEFAULT_PAGE_SIZE)

  // Para cada orçamento, importar seus itens do banco antigo
  for (const orcamento of orcamentos) {
    console.info(`\nImportando itens do orçamento ${orcamento.id}...`)
    const result = await importLegacyOrcamentoItems(orcamento.id, pageSize)
    totalItemsImported += result.totalImported
    console.info(`✓ Orçamento ${orcamento.id}: ${result.totalImported} itens importados`)
  }

  console.info(`\n========== RESUMO FINAL ==========`)
  console.info(`Orçamentos processados: ${orcamentos.length}`)
  console.info(`Total de itens importados: ${totalItemsImported}`)
}

main()
  .catch((error) => {
    console.error("Erro durante importação de itens do orçamento:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

