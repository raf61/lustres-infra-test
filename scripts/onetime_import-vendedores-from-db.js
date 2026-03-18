const sql = require("mssql")
const { PrismaClient, Role } = require("@prisma/client")
const { parseISO, parse } = require("date-fns")
const { toZonedTime } = require("date-fns-tz")
const bcrypt = require("bcryptjs")

const prisma = new PrismaClient()

/**
 * Cria ou atualiza o usuário master do sistema
 */
async function createMasterUser() {
  const masterEmail = "master@empresabrasileiraderaios.com.br"
  const masterPassword = "master2026$"
  const passwordHash = await bcrypt.hash(masterPassword, 10)

  const existingUser = await prisma.user.findUnique({
    where: { email: masterEmail },
  })

  const masterId = "1" // ID fixo para o master (string numérica)

  if (existingUser) {
    await prisma.user.update({
      where: { email: masterEmail },
      data: {
        name: "Master",
        passwordHash: passwordHash,
        role: Role.MASTER,
        active: true,
      },
    })
    console.info(`✅ Usuário master atualizado: ${masterEmail} (ID: ${existingUser.id})`)
  } else {
    await prisma.user.create({
      data: {
        id: masterId,
        email: masterEmail,
        name: "Master",
        passwordHash: passwordHash,
        role: Role.MASTER,
        active: true,
      },
    })
    console.info(`✅ Usuário master criado: ${masterEmail} (ID: ${masterId})`)
  }
}

// Configuração de conexão SQL Server
// IMPORTANTE: Se a tabela Pessoa não estiver no banco "master", 
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
 * Parse de datas do legado: só aplica +3h quando chegar como Date (driver).
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
  if (brDate) return brDate

  return null
}

/**
 * Mapeia o nível de acesso legado para o Role do sistema novo
 * Por enquanto, todos serão VENDEDOR conforme solicitado
 */
function mapNivelAcessoToRole(nivelAcesso) {
  // Por enquanto, sempre retorna VENDEDOR
  return Role.VENDEDOR
}

function mapLegacyToNew(legacy) {
  return {
    id: String(legacy.Id), // ID legado como string numérica (ex: "2094")
    name: legacy.Nome || "Sem nome",
    email: legacy.Email || "",
    passwordHash: legacy.Senha || "legacy_password", // Por enquanto sem hash
    role: mapNivelAcessoToRole(legacy.NivelAcesso),
    createdAt: parseDate(legacy.DataCadastro) || new Date(),
    active: legacy.Stats === "Ativo" ? true : false,
  }
}

async function fetchLegacyVendedoresFromDb(page, pageSize, vendedorIds = null) {
  const pool = await sql.connect(SQL_SERVER_CONFIG)

  try {
    let query
    let request

    if (vendedorIds && Array.isArray(vendedorIds) && vendedorIds.length > 0) {
      // Buscar vendedores específicos por IDs
      const idsList = vendedorIds.map((id) => Number.parseInt(id, 10)).filter((id) => !Number.isNaN(id))
      if (idsList.length === 0) {
        return []
      }

      // Construir query com placeholders dinâmicos
      const placeholders = idsList.map((_, index) => `@id${index}`).join(",")
      query = `
        SELECT 
          Id, DataCadastro, Nome, Email, EmailAlternativo, Senha, NivelAcesso, Stats, Foto
        FROM ${DB_SCHEMA}.Pessoa
        WHERE Id IN (${placeholders})
        AND (NivelAcesso = 'Vendedor' OR NivelAcesso = 'VENDEDOR' OR NivelAcesso = 'vendedor')
        ORDER BY Id
      `
      request = pool.request()
      idsList.forEach((id, index) => {
        request.input(`id${index}`, sql.Int, id)
      })
    } else {
      // Buscar com paginação, filtrando apenas vendedores
      const offset = (page - 1) * pageSize
      query = `
        SELECT 
          Id, DataCadastro, Nome, Email, EmailAlternativo, Senha, NivelAcesso, Stats, Foto
        FROM ${DB_SCHEMA}.Pessoa
        WHERE NivelAcesso = 'Vendedor' OR NivelAcesso = 'VENDEDOR' OR NivelAcesso = 'vendedor'
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
      console.error(`   Exemplo: SQL_SERVER_DATABASE=nome_do_banco node scripts/import-vendedores-from-db.js`)
      console.error("\n   Ou exporte antes de executar:")
      console.error(`   export SQL_SERVER_DATABASE=nome_do_banco`)
      console.error(`   node scripts/import-vendedores-from-db.js\n`)
    }
    throw error
  } finally {
    await pool.close()
  }
}

async function fetchLegacyVendedorByIdFromDb(vendedorId) {
  const pool = await sql.connect(SQL_SERVER_CONFIG)

  try {
    const query = `
      SELECT 
        Id, DataCadastro, Nome, Email, EmailAlternativo, Senha, NivelAcesso, Stats, Foto
      FROM ${DB_SCHEMA}.Pessoa
      WHERE Id = @vendedorId
      AND (NivelAcesso = 'Vendedor' OR NivelAcesso = 'VENDEDOR' OR NivelAcesso = 'vendedor')
    `
    const request = pool.request()
    request.input("vendedorId", sql.Int, vendedorId)

    const result = await request.query(query)
    if (result.recordset.length === 0) {
      throw new Error(`Vendedor com ID ${vendedorId} não encontrado no banco de dados ou não é um vendedor`)
    }
    return result.recordset[0]
  } catch (error) {
    if (error.message && error.message.includes("Invalid object name")) {
      console.error("\n❌ ERRO: Tabela não encontrada!")
      console.error(`   Banco de dados atual: ${SQL_SERVER_CONFIG.database}`)
      console.error(`   Schema: ${DB_SCHEMA}`)
      console.error("\n💡 SOLUÇÃO:")
      console.error("   Defina a variável de ambiente SQL_SERVER_DATABASE com o nome correto do banco:")
      console.error(`   Exemplo: SQL_SERVER_DATABASE=nome_do_banco node scripts/import-vendedores-from-db.js ${vendedorId}`)
      console.error("\n   Ou exporte antes de executar:")
      console.error(`   export SQL_SERVER_DATABASE=nome_do_banco`)
      console.error(`   node scripts/import-vendedores-from-db.js ${vendedorId}\n`)
    }
    throw error
  } finally {
    await pool.close()
  }
}

async function importLegacyVendedores(pageSize = DEFAULT_PAGE_SIZE, vendedorIds = null) {
  let totalImported = 0
  let page = 1

  while (true) {
    const vendedores = await fetchLegacyVendedoresFromDb(page, pageSize, vendedorIds)
    if (vendedores.length === 0) break

    for (const legacyVendedor of vendedores) {
      const mapped = mapLegacyToNew(legacyVendedor)

      // Forçar active=true apenas para IDs permitidos
      const ALLOW_ACTIVE_IDS = new Set([
        2029,
        2023,
        17709,
        13833,
        27420,
        25466,
        27710,
        28292,
        28528,
        28910
      ]
      )
      const legacyIdNum = Number.parseInt(String(legacyVendedor.Id), 10)
      if (!Number.isNaN(legacyIdNum)) {
        mapped.active = ALLOW_ACTIVE_IDS.has(legacyIdNum)
      } else {
        mapped.active = false
      }

      // Verificar se o email já existe (User tem email único)
      const existingUser = await prisma.user.findUnique({
        where: { email: mapped.email },
      })

      if (existingUser) {
        // Atualizar usuário existente
        await prisma.user.update({
          where: { email: mapped.email },
          data: {
            name: mapped.name,
            passwordHash: mapped.passwordHash,
            role: mapped.role,
            createdAt: mapped.createdAt,
            active: mapped.active,
          },
        })
        console.info(`Vendedor atualizado: ${mapped.name} (${mapped.email})`)
      } else {
        // Criar novo usuário
        await prisma.user.create({
          data: mapped,
        })
        console.info(`Vendedor criado: ${mapped.name} (${mapped.email})`)
      }

      totalImported += 1
      if (totalImported % 50 === 0) {
        console.info(`Importados ${totalImported} vendedores...`)
      }
    }

    // Se foi busca por IDs específicos, não precisa paginar
    if (vendedorIds && Array.isArray(vendedorIds) && vendedorIds.length > 0) {
      break
    }

    if (vendedores.length < pageSize) {
      break
    }

    page += 1
  }

  return { totalImported, pagesFetched: page }
}

async function importLegacyVendedorById(vendedorId) {
  console.info(`Buscando vendedor legado com ID: ${vendedorId}`)
  const legacyVendedor = await fetchLegacyVendedorByIdFromDb(vendedorId)
  console.info(`Vendedor encontrado: ${legacyVendedor.Nome || "N/A"}`)

  const mapped = mapLegacyToNew(legacyVendedor)

  // Verificar se o email já existe
  const existingUser = await prisma.user.findUnique({
    where: { email: mapped.email },
  })

  if (existingUser) {
    console.info(`Atualizando vendedor existente: ${mapped.email}`)
    await prisma.user.update({
      where: { email: mapped.email },
      data: {
        name: mapped.name,
        passwordHash: mapped.passwordHash,
        role: mapped.role,
        createdAt: mapped.createdAt,
        active: mapped.active,
      },
    })
    console.info(`Vendedor ${existingUser.id} atualizado com sucesso!`)
    return { totalImported: 1, vendedorId: existingUser.id }
  } else {
    console.info(`Criando novo vendedor: ${mapped.email}`)
    const result = await prisma.user.create({
      data: mapped,
    })
    console.info(`Vendedor ${result.id} criado com sucesso!`)
    return { totalImported: 1, vendedorId: result.id }
  }
}

async function main() {
  // Primeiro, criar/atualizar o usuário master
  console.info("Criando/atualizando usuário master...")
  await createMasterUser()

  // Verificar se há flag --id
  const idIndex = process.argv.indexOf("--id")
  if (idIndex !== -1 && process.argv[idIndex + 1]) {
    const vendedorId = Number.parseInt(process.argv[idIndex + 1], 10)
    if (Number.isNaN(vendedorId)) {
      console.error("Erro: ID do vendedor deve ser um número válido")
      process.exitCode = 1
      return
    }

    console.info(`Iniciando importação de vendedor específico (ID=${vendedorId})`)
    const result = await importLegacyVendedorById(vendedorId)
    console.info(`Importação concluída. Vendedor importado: ${result.vendedorId}`)
    return
  }

  // Verificar se há IDs específicos passados como argumentos
  const vendedorIds = process.argv.slice(2)
    .filter((arg) => !arg.startsWith("--"))
    .map((arg) => {
      const id = Number.parseInt(arg, 10)
      return Number.isNaN(id) ? null : id
    })
    .filter((id) => id !== null)
  const hasSpecificIds = vendedorIds.length > 0

  // Modo normal: importação em lote
  const pageSize = Number(process.argv[2] ?? DEFAULT_PAGE_SIZE)

  if (hasSpecificIds) {
    console.info(`Iniciando importação de vendedores específicos (IDs=${vendedorIds.join(", ")})`)
  } else {
    console.info(`Iniciando importação de vendedores legados (pageSize=${pageSize})`)
  }

  const result = await importLegacyVendedores(pageSize, hasSpecificIds ? vendedorIds : null)
  console.info(`Importação concluída. Vendedores importados: ${result.totalImported}`)
}

main()
  .catch((error) => {
    console.error("Erro durante importação de vendedores legados:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

