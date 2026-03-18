const sql = require("mssql")
const { PrismaClient } = require("@prisma/client")
const { parseISO, parse } = require("date-fns")
const { resetSequences } = require("./utils/reset-sequences")
const { toZonedTime } = require("date-fns-tz")

const prisma = new PrismaClient()

// Configuração de conexão SQL Server
// IMPORTANTE: Se a tabela Item não estiver no banco "master", 
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
 * Parse de datas do legado: só aplica +3h quando chega como Date (driver).
 * Strings são parseadas sem ajuste extra.
 */
const LEGACY_TZ = "America/Sao_Paulo"
const isValidDate = (d) => d instanceof Date && !Number.isNaN(d.getTime())
const parsePattern = (value, pattern) => {
  const d = parse(value, pattern, new Date())
  return isValidDate(d) ? d : null
}
const stripOffset = (s) => s.replace(/[+-]\d{2}:?\d{2}$|Z$/i, "")

function parseDate(dateValue) {
  if (!dateValue) return null
  if (dateValue instanceof Date) {
    return isValidDate(dateValue) ? new Date(dateValue.getTime() + 180 * 60 * 1000) : null
  }

  const dateString = String(dateValue).trim()
  if (!dateString) return null

  // Strings com offset/Z: respeitar o offset (sem +3h)
  if (/[+-]\d{2}:?\d{2}|Z$/i.test(dateString)) {
    const d = parseISO(dateString)
    return isValidDate(d) ? d : null
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const parsed = parsePattern(dateString, "yyyy-MM-dd")
    return parsed ?? null
  }

  const isoNoOffsetPatterns = ["yyyy-MM-dd'T'HH:mm:ss.SSS", "yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd HH:mm:ss"]
  for (const p of isoNoOffsetPatterns) {
    const parsed = parsePattern(dateString, p)
    if (parsed) {
      return parsed
    }
  }

  const brDate = parsePattern(dateString, "dd/MM/yyyy")
  if (brDate) {
    return brDate
  }

  return null
}

// Máximo para INT4 (32-bit signed integer)
const MAX_INT4 = 2147483647

/**
 * Limita um número inteiro ao máximo permitido para INT4
 * Se o valor for maior que o máximo, retorna máximo - 1
 */
function clampToInt4(value) {
  if (value == null) return 0
  const num = Number.parseInt(value, 10)
  if (Number.isNaN(num)) return 0
  if (num > MAX_INT4) return MAX_INT4 - 1
  if (num < -MAX_INT4) return -MAX_INT4 + 1
  return num
}

function mapLegacyToNew(legacy) {
  return {
    id: BigInt(legacy.Id),
    nome: legacy.Nome || "Sem nome",
    valor: legacy.Valor ? Number.parseFloat(legacy.Valor) : 0,
    categoria: legacy.Categoria || null,
    estoque: clampToInt4(legacy.Estoque),
    createdAt: parseDate(legacy.DataCadastro) || new Date(),
  }
}

async function fetchLegacyItemsFromDb(page, pageSize, itemIds = null) {
  const pool = await sql.connect(SQL_SERVER_CONFIG)

  try {
    let query
    let request

    if (itemIds && Array.isArray(itemIds) && itemIds.length > 0) {
      // Buscar itens específicos por IDs
      const idsList = itemIds.map((id) => Number.parseInt(id, 10)).filter((id) => !Number.isNaN(id))
      if (idsList.length === 0) {
        return []
      }

      // Construir query com placeholders dinâmicos
      const placeholders = idsList.map((_, index) => `@id${index}`).join(",")
      query = `
        SELECT 
          Id, DataCadastro, IdFornecedor, Nome, Valor, Stats, Categoria, Estoque
        FROM ${DB_SCHEMA}.Item
        WHERE Id IN (${placeholders})
        ORDER BY Id
      `
      request = pool.request()
      idsList.forEach((id, index) => {
        request.input(`id${index}`, sql.BigInt, id)
      })
    } else {
      // Buscar com paginação
      const offset = (page - 1) * pageSize
      query = `
        SELECT 
          Id, DataCadastro, IdFornecedor, Nome, Valor, Stats, Categoria, Estoque
        FROM ${DB_SCHEMA}.Item
        ORDER BY Id
        OFFSET @offset ROWS
        FETCH NEXT @pageSize ROWS ONLY
      `
      request = pool.request()
      request.input("offset", sql.Int, offset)
      request.input("pageSize", sql.Int, pageSize)
    }

    const result = await request.query(query)
    return result.recordset || []
  } catch (error) {
    if (error.message && error.message.includes("Invalid object name")) {
      console.error("\n❌ ERRO: Tabela não encontrada!")
      console.error(`   Banco de dados atual: ${SQL_SERVER_CONFIG.database}`)
      console.error(`   Schema: ${DB_SCHEMA}`)
      console.error("\n💡 SOLUÇÃO:")
      console.error("   Defina a variável de ambiente SQL_SERVER_DATABASE com o nome correto do banco:")
      console.error(`   Exemplo: SQL_SERVER_DATABASE=nome_do_banco node scripts/import-items-from-db.js`)
      console.error("\n   Ou exporte antes de executar:")
      console.error(`   export SQL_SERVER_DATABASE=nome_do_banco`)
      console.error(`   node scripts/import-items-from-db.js\n`)
    }
    throw error
  } finally {
    await pool.close()
  }
}

async function fetchLegacyItemByIdFromDb(itemId) {
  const pool = await sql.connect(SQL_SERVER_CONFIG)

  try {
    const query = `
      SELECT 
        Id, DataCadastro, IdFornecedor, Nome, Valor, Stats, Categoria, Estoque
      FROM ${DB_SCHEMA}.Item
      WHERE Id = @itemId
    `
    const request = pool.request()
    request.input("itemId", sql.BigInt, itemId)

    const result = await request.query(query)
    if (result.recordset.length === 0) {
      throw new Error(`Item com ID ${itemId} não encontrado no banco de dados`)
    }
    return result.recordset[0]
  } catch (error) {
    if (error.message && error.message.includes("Invalid object name")) {
      console.error("\n❌ ERRO: Tabela não encontrada!")
      console.error(`   Banco de dados atual: ${SQL_SERVER_CONFIG.database}`)
      console.error(`   Schema: ${DB_SCHEMA}`)
      console.error("\n💡 SOLUÇÃO:")
      console.error("   Defina a variável de ambiente SQL_SERVER_DATABASE com o nome correto do banco:")
      console.error(`   Exemplo: SQL_SERVER_DATABASE=nome_do_banco node scripts/import-items-from-db.js ${itemId}`)
      console.error("\n   Ou exporte antes de executar:")
      console.error(`   export SQL_SERVER_DATABASE=nome_do_banco`)
      console.error(`   node scripts/import-items-from-db.js ${itemId}\n`)
    }
    throw error
  } finally {
    await pool.close()
  }
}

async function importLegacyItems(pageSize = DEFAULT_PAGE_SIZE, itemIds = null) {
  let totalImported = 0
  let page = 1

  while (true) {
    const items = await fetchLegacyItemsFromDb(page, pageSize, itemIds)
    if (items.length === 0) break

    for (const legacyItem of items) {
      const mapped = mapLegacyToNew(legacyItem)

      await prisma.item.upsert({
        where: { id: mapped.id },
        update: mapped,
        create: mapped,
      })

      totalImported += 1
      if (totalImported % 50 === 0) {
        console.info(`Importados ${totalImported} itens...`)
      }
    }

    // Se foi busca por IDs específicos, não precisa paginar
    if (itemIds && Array.isArray(itemIds) && itemIds.length > 0) {
      break
    }

    if (items.length < pageSize) {
      break
    }

    page += 1
  }

  return { totalImported, pagesFetched: page }
}

async function importLegacyItemById(itemId) {
  console.info(`Buscando item legado com ID: ${itemId}`)
  const legacyItem = await fetchLegacyItemByIdFromDb(itemId)
  console.info(`Item encontrado: ${legacyItem.Nome || "N/A"}`)

  const mapped = mapLegacyToNew(legacyItem)

  console.info(`Importando item ID ${mapped.id}...`)
  const result = await prisma.item.upsert({
    where: { id: mapped.id },
    update: mapped,
    create: mapped,
  })

  console.info(`Item ${result.id} importado/atualizado com sucesso!`)
  return { totalImported: 1, itemId: result.id }
}

async function main() {
  // Verificar se há flag --id
  const idIndex = process.argv.indexOf("--id")
  if (idIndex !== -1 && process.argv[idIndex + 1]) {
    const itemId = BigInt(process.argv[idIndex + 1])
    if (!itemId) {
      console.error("Erro: ID do item deve ser um número válido")
      process.exitCode = 1
      return
    }

    console.info(`Iniciando importação de item específico (ID=${itemId})`)
    const result = await importLegacyItemById(itemId)
    console.info(`Importação concluída. Item importado: ${result.itemId}`)
    return
  }

  // Verificar se há IDs específicos passados como argumentos
  const itemIds = process.argv.slice(2)
    .filter((arg) => !arg.startsWith("--"))
    .map((arg) => {
      try {
        return BigInt(arg)
      } catch {
        return null
      }
    })
    .filter((id) => id !== null)
  const hasSpecificIds = itemIds.length > 0

  // Modo normal: importação em lote
  const pageSize = Number(process.argv[2] ?? DEFAULT_PAGE_SIZE)

  if (hasSpecificIds) {
    console.info(`Iniciando importação de itens específicos (IDs=${itemIds.join(", ")})`)
  } else {
    console.info(`Iniciando importação de itens legados (pageSize=${pageSize})`)
  }

  const result = await importLegacyItems(pageSize, hasSpecificIds ? itemIds : null)
  console.info(`Importação concluída. Itens importados: ${result.totalImported}`)
  await resetSequences(prisma, ["Item"])
}

main()
  .catch((error) => {
    console.error("Erro durante importação de itens legados:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

