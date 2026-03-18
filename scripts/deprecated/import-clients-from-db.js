const sql = require("mssql")
const { PrismaClient, Role } = require("@prisma/client")
const { formatCnpjForDatabase } = require("../utils/cnpj")

const prisma = new PrismaClient()

// Configuração de conexão SQL Server
// IMPORTANTE: Se a tabela Cliente não estiver no banco "master", 
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
const IMPORT_LIMIT = Number(process.env.IMPORT_LEGACY_LIMIT ?? "5")

// Lista de IDs de vendedores ativos (será preenchida no início do script)
let allowedVendedorIds = new Set()

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

/**
 * Busca os IDs dos vendedores ativos no banco de dados novo
 * Retorna um Set com os IDs (tanto numéricos quanto strings)
 * Os vendedores foram importados com id = String(IdLegado), então precisamos
 * armazenar ambos os formatos para comparação
 */
async function fetchActiveVendedorIds() {
  try {
    const vendedores = await prisma.user.findMany({
      where: {
        role: Role.VENDEDOR,
        active: true,
      },
      select: {
        id: true,
      },
    })

    const idsSet = new Set()
    
    // Como os vendedores foram importados com id = String(IdLegado),
    // adicionamos tanto o id string quanto o número correspondente
    // para permitir comparação com o campo Cadastrador (que é numérico)
    for (const vendedor of vendedores) {
      // Adicionar o id string (formato usado no banco)
      idsSet.add(vendedor.id)
      
      // Tentar converter para número e adicionar também (para comparação com Cadastrador)
      const numericId = Number.parseInt(vendedor.id, 10)
      if (!Number.isNaN(numericId) && numericId.toString() === vendedor.id) {
        // Só adicionar o número se o id string for realmente um número válido
        idsSet.add(numericId)
      }
    }

    console.info(`Encontrados ${vendedores.length} vendedores ativos`)
    return idsSet
  } catch (error) {
    console.error("Erro ao buscar IDs de vendedores ativos:", error)
    return new Set()
  }
}

function mapLegacyToNew(legacy) {
  const telefoneAntigos = []
  if (legacy.Gerente) telefoneAntigos.push(`gerente:[${legacy.Gerente}]`)
  if (legacy.Portaria) telefoneAntigos.push(`portaria:[${legacy.Portaria}]`)
  if (legacy.Residencial) telefoneAntigos.push(`residencial:[${legacy.Residencial}]`)
  if (legacy.Outros) telefoneAntigos.push(`outros:[${legacy.Outros}]`)

  const observacaoExtra = telefoneAntigos.length > 0 ? ` | telefones antigos { ${telefoneAntigos.join(" , ")} }` : ""
  const observacao = `${legacy.Observacao ?? ""}${observacaoExtra}`.trim()

  // Verificar se Cadastrador está na lista de IDs permitidos
  let vendedorId = null
  if (legacy.Cadastrador != null) {
    const cadastradorId = legacy.Cadastrador
    const cadastradorIdNum = Number.parseInt(cadastradorId, 10)
    const cadastradorIdStr = String(cadastradorId)
    
    // Verificar se está na lista (pode ser número ou string)
    // O id do User foi criado como String(IdLegado) no script de importação de vendedores
    if (!Number.isNaN(cadastradorIdNum) && (allowedVendedorIds.has(cadastradorIdNum) || allowedVendedorIds.has(cadastradorIdStr))) {
      // Converter o ID numérico legado para string (formato usado no User)
      vendedorId = cadastradorIdStr
    }
  }

  return {
    id: legacy.Id,
    razaoSocial: legacy.RazaoSocial || legacy.Nome || "Sem nome",
    cnpj: formatCnpjForDatabase(legacy.CpfCnpj || legacy.CNPJ || ""),
    cep: legacy.Cep || null,
    logradouro: legacy.Logradouro || null,
    numero: legacy.Numero || null,
    complemento: legacy.Complemento || null,
    bairro: legacy.Bairro || null,
    cidade: legacy.Cidade || null,
    estado: legacy.Estado || null,
    telefoneCondominio: legacy.Telefone || null,
    telefoneSindico: legacy.Celular || null,
    telefonePorteiro: legacy.Portaria || null,
    nomeSindico: legacy.SindicoNome || null,
    emailSindico: legacy.SindicoEmail || null,
    dataInicioMandato: parseDate(legacy.DataInicial),
    dataFimMandato: parseDate(legacy.DataFinal),
    observacao: observacao.length > 0 ? observacao : null,
    vendedorId: vendedorId,
  }
}

async function fetchLegacyClientsFromDb(page, pageSize, clientIds = null) {
  const pool = await sql.connect(SQL_SERVER_CONFIG)

  try {
    let query
    let request

    if (clientIds && Array.isArray(clientIds) && clientIds.length > 0) {
      // Buscar clientes específicos por IDs
      const idsList = clientIds.map((id) => Number.parseInt(id, 10)).filter((id) => !Number.isNaN(id))
      if (idsList.length === 0) {
        return []
      }

      // Construir query com placeholders dinâmicos
      const placeholders = idsList.map((_, index) => `@id${index}`).join(",")
      query = `
        SELECT 
          c.Id, c.RazaoSocial, c.CpfCnpj, c.Cep, c.Logradouro, c.Numero, c.Complemento, 
          c.Bairro, c.Cidade, c.Estado, c.Telefone, c.Celular, c.Portaria, 
          c.Residencial, c.Outros, c.DataInicial, c.DataFinal, c.Observacao, c.Gerente, c.Cadastrador,
          p.Nome AS SindicoNome, p.Email AS SindicoEmail
        FROM ${DB_SCHEMA}.Cliente c
        LEFT JOIN ${DB_SCHEMA}.Pessoa p ON c.IdPessoa = p.Id
        WHERE c.Id IN (${placeholders})
        ORDER BY c.Id
      `
      request = pool.request()
      idsList.forEach((id, index) => {
        request.input(`id${index}`, sql.Int, id)
      })
    } else {
      // Buscar com paginação
      const offset = (page - 1) * pageSize
      query = `
        SELECT 
          c.Id, c.RazaoSocial, c.CpfCnpj, c.Cep, c.Logradouro, c.Numero, c.Complemento, 
          c.Bairro, c.Cidade, c.Estado, c.Telefone, c.Celular, c.Portaria, 
          c.Residencial, c.Outros, c.DataInicial, c.DataFinal, c.Observacao, c.Gerente, c.Cadastrador,
          p.Nome AS SindicoNome, p.Email AS SindicoEmail
        FROM ${DB_SCHEMA}.Cliente c
        LEFT JOIN ${DB_SCHEMA}.Pessoa p ON c.IdPessoa = p.Id
        ORDER BY c.Id
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
      console.error(`   Exemplo: SQL_SERVER_DATABASE=nome_do_banco node scripts/import-clients-from-db.js 18090`)
      console.error("\n   Ou exporte antes de executar:")
      console.error(`   export SQL_SERVER_DATABASE=nome_do_banco`)
      console.error(`   node scripts/import-clients-from-db.js 18090\n`)
    }
    throw error
  } finally {
    await pool.close()
  }
}

async function fetchLegacyClientByIdFromDb(clientId) {
  const pool = await sql.connect(SQL_SERVER_CONFIG)

  try {
    const query = `
      SELECT 
        c.Id, c.RazaoSocial, c.CpfCnpj, c.Cep, c.Logradouro, c.Numero, c.Complemento, 
        c.Bairro, c.Cidade, c.Estado, c.Telefone, c.Celular, c.Portaria, 
        c.Residencial, c.Outros, c.DataInicial, c.DataFinal, c.Observacao, c.Gerente, c.Cadastrador,
        p.Nome AS SindicoNome, p.Email AS SindicoEmail
      FROM ${DB_SCHEMA}.Cliente c
      LEFT JOIN ${DB_SCHEMA}.Pessoa p ON c.IdPessoa = p.Id
      WHERE c.Id = @clientId
    `
    const request = pool.request()
    request.input("clientId", sql.Int, clientId)

    const result = await request.query(query)
    if (result.recordset.length === 0) {
      throw new Error(`Cliente com ID ${clientId} não encontrado no banco de dados`)
    }
    return result.recordset[0]
  } catch (error) {
    if (error.message && error.message.includes("Invalid object name")) {
      console.error("\n❌ ERRO: Tabela não encontrada!")
      console.error(`   Banco de dados atual: ${SQL_SERVER_CONFIG.database}`)
      console.error(`   Schema: ${DB_SCHEMA}`)
      console.error("\n💡 SOLUÇÃO:")
      console.error("   Defina a variável de ambiente SQL_SERVER_DATABASE com o nome correto do banco:")
      console.error(`   Exemplo: SQL_SERVER_DATABASE=nome_do_banco node scripts/import-clients-from-db.js 18090`)
      console.error("\n   Ou exporte antes de executar:")
      console.error(`   export SQL_SERVER_DATABASE=nome_do_banco`)
      console.error(`   node scripts/import-clients-from-db.js 18090\n`)
    }
    throw error
  } finally {
    await pool.close()
  }
}

async function importLegacyClients(limit = IMPORT_LIMIT, pageSize = DEFAULT_PAGE_SIZE, clientIds = null) {
  let totalImported = 0
  let page = 1

  while (totalImported < limit) {
    const clients = await fetchLegacyClientsFromDb(page, pageSize, clientIds)
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

    // Se foi busca por IDs específicos, não precisa paginar
    if (clientIds && Array.isArray(clientIds) && clientIds.length > 0) {
      break
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
  const legacyClient = await fetchLegacyClientByIdFromDb(clientId)
  console.info(`Cliente encontrado: ${legacyClient.RazaoSocial || legacyClient.Nome || "N/A"}`)

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
  // Buscar IDs dos vendedores ativos no início
  console.info("Buscando IDs de vendedores ativos...")
  allowedVendedorIds = await fetchActiveVendedorIds()
  
  if (allowedVendedorIds.size === 0) {
    console.warn("⚠️  Nenhum vendedor ativo encontrado. O campo vendedorId não será preenchido.")
  }

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

  // Verificar se há IDs específicos passados como argumentos
  const clientIds = process.argv.slice(2).filter((arg) => !Number.isNaN(Number.parseInt(arg, 10)) && !arg.startsWith("--"))
  const hasSpecificIds = clientIds.length > 0

  // Modo normal: importação em lote
  const limit = hasSpecificIds ? Number.MAX_SAFE_INTEGER : Number(process.argv[2] ?? IMPORT_LIMIT)
  const pageSize = Number(process.argv[3] ?? DEFAULT_PAGE_SIZE)

  if (hasSpecificIds) {
    console.info(`Iniciando importação de clientes específicos (IDs=${clientIds.join(", ")})`)
  } else {
    console.info(`Iniciando importação de clientes legados (limite=${limit}, pageSize=${pageSize})`)
  }

  const result = await importLegacyClients(limit, pageSize, hasSpecificIds ? clientIds : null)
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

