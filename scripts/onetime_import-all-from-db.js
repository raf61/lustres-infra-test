const sql = require("mssql")
const { PrismaClient, OrcamentoStatus, PedidoStatus, Role } = require("@prisma/client")
const { parseISO, parse } = require("date-fns")
const { resetSequences } = require("./utils/reset-sequences")
const { toZonedTime } = require("date-fns-tz")
const { formatCnpjForDatabase } = require("./utils/cnpj")

const prisma = new PrismaClient()

// Configuração de conexão SQL Server
// IMPORTANTE: Se as tabelas não estiverem no banco "master", 
// defina a variável de ambiente SQL_SERVER_DATABASE com o nome correto do banco
// Exemplo: SQL_SERVER_DATABASE=nome_do_banco node scripts/import-all-from-db.js
const SQL_SERVER_CONFIG = {
  server: process.env.SQL_SERVER_HOST ?? "localhost",
  port: Number(process.env.SQL_SERVER_PORT ?? "1433"),
  user: process.env.SQL_SERVER_USER ?? "sa",
  password: process.env.SQL_SERVER_PASSWORD ?? "Passw0rd_",
  database: process.env.SQL_SERVER_DATABASE ?? "master",
  requestTimeout: 120000, // 2 minutos para queries grandes
  connectionTimeout: 30000, // 30 segundos para conectar
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
}

// Pool SQL Server global (NUNCA FECHAR)
const sqlPool = new sql.ConnectionPool(SQL_SERVER_CONFIG).connect()

// Schema padrão (dbo é o schema padrão do SQL Server)
const DB_SCHEMA = process.env.SQL_SERVER_SCHEMA ?? "sistema.dbo"

// Configurações de paginação
const DEFAULT_PAGE_SIZE = Number(process.env.LEGACY_PAGE_SIZE ?? "50")
const CLIENTS_PAGE_SIZE = 100 // Hard-coded para busca de clientes

// Lista de IDs de vendedores ativos (para validar clientes)
let allowedVendedorIds = new Set()
// Lista de IDs de todos os vendedores (para validar orçamentos e pedidos)
let allVendedorIds = new Set()

// Mapeamentos de status
const ORCAMENTO_STATUS_MAP = {
  imprimir: OrcamentoStatus.EM_ABERTO,
  aprovado: OrcamentoStatus.APROVADO,
  reprovado: OrcamentoStatus.REPROVADO,
  cancelado: OrcamentoStatus.CANCELADO,
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

// ========== FUNÇÃO DE PARSING DE DATAS FLEXÍVEL ==========

/**
 * Parse de datas do legado: só aplica +3h em valores que chegam como Date (driver).
 * Strings são parseadas e retornadas sem ajuste.
 */
const LEGACY_TZ = "America/Sao_Paulo"
const LEGACY_OFFSET_MIN = 180 // -03:00
const isValidDate = (d) => d instanceof Date && !Number.isNaN(d.getTime())
const parsePattern = (value, pattern) => {
  const d = parse(value, pattern, new Date())
  return isValidDate(d) ? d : null
}
const stripOffset = (s) => s.replace(/[+-]\d{2}:?\d{2}$|Z$/i, "")

function parseDate(dateValue) {
  if (!dateValue) return null
  if (dateValue instanceof Date) {
    // Apenas valores não-string recebem o ajuste +3h (wall-time -03 -> UTC)
    return isValidDate(dateValue) ? new Date(dateValue.getTime() + LEGACY_OFFSET_MIN * 60 * 1000) : null
  }

  const dateString = String(dateValue).trim()
  if (!dateString) return null

  // ISO com offset/Z: respeitar o offset informado (sem ajuste)
  if (/[+-]\d{2}:?\d{2}|Z$/i.test(dateString)) {
    const d = parseISO(dateString)
    if (isValidDate(d)) return d
  }

  // ISO date-only -> parede -03
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const parsed = parsePattern(dateString, "yyyy-MM-dd")
    return parsed ?? null
  }

  // ISO datetime sem offset -> parede -03
  const isoNoOffsetPatterns = ["yyyy-MM-dd'T'HH:mm:ss.SSS", "yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd HH:mm:ss"]
  for (const p of isoNoOffsetPatterns) {
    const parsed = parsePattern(dateString, p)
    if (parsed) {
      return parsed
    }
  }

  // dd/MM/yyyy
  const brDate = parsePattern(dateString, "dd/MM/yyyy")
  if (brDate) {
    return brDate
  }

  // dd/MM/yyyy HH:mm:ss
  const brDateTime = parsePattern(dateString, "dd/MM/yyyy HH:mm:ss")
  if (brDateTime) {
    return brDateTime
  }

  return null
}

/**
 * Normaliza razão social:
 * - Remove espaços no início e fim (trim)
 * - Colapsa múltiplos espaços em um só ("cliente  do   predio" -> "cliente do predio")
 */
function normalizeRazaoSocial(value) {
  if (!value) return null
  return String(value).trim().replace(/\s+/g, " ")
}

async function resetImportSequences() {
  await resetSequences(prisma, ["Client", "Orcamento", "OrcamentoItem", "Pedido", "PedidoItem", "Debito"])
}

// ========== FUNÇÕES DE VENDEDORES ==========

/**
 * Busca os IDs dos vendedores ativos no banco de dados novo
 * Retorna um Set com os IDs (tanto numéricos quanto strings)
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

    for (const vendedor of vendedores) {
      idsSet.add(vendedor.id)
      const numericId = Number.parseInt(vendedor.id, 10)
      if (!Number.isNaN(numericId) && numericId.toString() === vendedor.id) {
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

/**
 * Busca os IDs de TODOS os vendedores no banco de dados novo (ativos e inativos)
 * Retorna um Set com os IDs (tanto numéricos quanto strings)
 */
async function fetchAllVendedorIds() {
  try {
    const vendedores = await prisma.user.findMany({
      where: {
        role: Role.VENDEDOR,
      },
      select: {
        id: true,
      },
    })

    const idsSet = new Set()

    for (const vendedor of vendedores) {
      idsSet.add(vendedor.id)
      const numericId = Number.parseInt(vendedor.id, 10)
      if (!Number.isNaN(numericId) && numericId.toString() === vendedor.id) {
        idsSet.add(numericId)
      }
    }

    console.info(`Encontrados ${vendedores.length} vendedores (todos)`)
    return idsSet
  } catch (error) {
    console.error("Erro ao buscar IDs de todos os vendedores:", error)
    return new Set()
  }
}

// ========== FUNÇÕES DE CLIENTES ==========

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

    if (!Number.isNaN(cadastradorIdNum) && (allowedVendedorIds.has(cadastradorIdNum) || allowedVendedorIds.has(cadastradorIdStr))) {
      vendedorId = cadastradorIdStr
    }
  }

  const rawCnpj = legacy.CpfCnpj || legacy.CNPJ || ""
  let formattedCnpj
  try {
    formattedCnpj = formatCnpjForDatabase(rawCnpj)
  } catch (error) {
    console.error(`✗ CNPJ inválido para cliente legacy ${legacy.Id ?? legacy.id ?? "?"}: ${rawCnpj}`)
    return null
  }

  return {
    id: legacy.Id,
    razaoSocial: normalizeRazaoSocial(legacy.RazaoSocial || legacy.Nome) || "Sem nome",
    cnpj: formattedCnpj,
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
  const pool = await sqlPool

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
      console.error(`   Exemplo: SQL_SERVER_DATABASE=nome_do_banco node scripts/import-all-from-db.js`)
      console.error("\n   Ou exporte antes de executar:")
      console.error(`   export SQL_SERVER_DATABASE=nome_do_banco`)
      console.error(`   node scripts/import-all-from-db.js\n`)
    }
    throw error
  }
}

async function fetchLegacyClientByIdFromDb(clientId) {
  const pool = await sqlPool

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
      console.error(`   Exemplo: SQL_SERVER_DATABASE=nome_do_banco node scripts/import-all-from-db.js ${clientId}`)
      console.error("\n   Ou exporte antes de executar:")
      console.error(`   export SQL_SERVER_DATABASE=nome_do_banco`)
      console.error(`   node scripts/import-all-from-db.js ${clientId}\n`)
    }
    throw error
  }
}

async function importLegacyClient(clientId) {
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
  return result
}

// ========== FUNÇÕES DE ORÇAMENTOS ==========

function mapLegacyBudget(legacy, clientId) {
  const statusKey = (legacy.Stats ?? legacy.Status ?? "").toString().trim().toLowerCase()

  let status = OrcamentoStatus.EM_ABERTO
  if (statusKey === "aprovado") {
    status = OrcamentoStatus.APROVADO
  } else if (statusKey === "cancelado") {
    status = OrcamentoStatus.CANCELADO
  }

  const extraObservacoes = []
  if (legacy.FormaPagamento) extraObservacoes.push(`formaPagamento:[${legacy.FormaPagamento}]`)
  if (legacy.Visita) extraObservacoes.push(`visita:[${legacy.Visita}]`)
  if (legacy.Garantia != null) extraObservacoes.push(`garantia:[${legacy.Garantia}]`)

  const observacoes = extraObservacoes.length > 0 ? extraObservacoes.join(" | ") : null

  // Validar se o vendedor existe (pode ser ativo ou inativo para orçamentos)
  let vendedorId = null
  if (legacy.IdPessoa != null) {
    const vendedorIdStr = String(legacy.IdPessoa)
    const vendedorIdNum = Number.parseInt(vendedorIdStr, 10)
    // Verificar se o vendedor existe na lista de todos os vendedores
    if (!Number.isNaN(vendedorIdNum) && (allVendedorIds.has(vendedorIdStr) || allVendedorIds.has(vendedorIdNum))) {
      vendedorId = vendedorIdStr
    }
    // Se não existir, vendedorId permanece null (foreign key permite null)
  }

  return {
    id: legacy.Id,
    clienteId: clientId,
    empresaId: mapEmpresaId(legacy.Empresa),
    status,
    parcelas: legacy.Parcelas ?? null,
    primeiroVencimento: parseDate(legacy.PrimeiroVencimento),
    observacoes,
    anexo: legacy.Anexo ?? null,
    vendedorId: vendedorId,
    createdAt: parseDate(legacy.Cadastro) || new Date(),
    updatedAt: parseDate(legacy.Cadastro) || new Date(),
  }
}

async function fetchLegacyBudgetsFromDb(clientId) {
  const pool = await sqlPool

  try {
    const query = `
      SELECT 
        Id, IdCliente, IdPessoa, Stats, FormaPagamento, Visita, Garantia,
        Parcelas, PrimeiroVencimento, Empresa, Anexo, Cadastro
      FROM ${DB_SCHEMA}.Orcamento
      WHERE IdCliente = @clientId
      ORDER BY Id
    `
    const request = pool.request()
    request.input("clientId", sql.Int, clientId)

    const result = await request.query(query)
    return result.recordset || []
  } catch (error) {
    throw error
  }
}

async function importLegacyBudgets(clientId) {
  const budgets = await fetchLegacyBudgetsFromDb(clientId)
  if (budgets.length === 0) {
    return { totalImported: 0 }
  }

  const mappedBudgets = budgets.map((legacyBudget) => mapLegacyBudget(legacyBudget, Number(clientId)))

  // Deletar orçamentos existentes do cliente antes de recriar
  const budgetIds = mappedBudgets.map((b) => b.id)
  await prisma.orcamento.deleteMany({
    where: {
      id: { in: budgetIds },
    },
  })

  // Criar todos de uma vez
  await prisma.orcamento.createMany({
    data: mappedBudgets,
    skipDuplicates: true,
  })

  return { totalImported: mappedBudgets.length }
}

// ========== FUNÇÕES DE PEDIDOS ==========

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

function resolveBancoEmissorId(legacyBanco, legacyEmpresa) {
  if (!legacyBanco) return null

  const bancoKey = legacyBanco.toString().trim().toLowerCase()
  const empresaKey = (legacyEmpresa || "").toString().trim().toLowerCase()

  if (bancoKey === "san") {
    if (empresaKey === "franklin instalações") return 3
    return 4
  }

  if (bancoKey === "ii") {
    if (empresaKey === "sis. cob. assertiva") return 2
    if (empresaKey === "empresa brasileira de raios") return 1
    return 2
  }

  return null
}

function mapLegacyOrder(legacy, clientId) {
  const statusKey = (legacy.Stats ?? legacy.Status ?? "").toString().trim().toLowerCase()
  const status = PEDIDO_STATUS_MAP[statusKey] ?? PedidoStatus.AGUARDANDO

  const geradoComissaoRaw = legacy.GeradoComissao
  const geradoComissao =
    geradoComissaoRaw === true ||
    geradoComissaoRaw === 1 ||
    geradoComissaoRaw === "1" ||
    (typeof geradoComissaoRaw === "string" && geradoComissaoRaw.toLowerCase() === "true")

  // Validar se o vendedor existe (pode ser ativo ou inativo para pedidos)
  let vendedorId = null
  if (legacy.IdPessoa != null) {
    const vendedorIdStr = String(legacy.IdPessoa)
    const vendedorIdNum = Number.parseInt(vendedorIdStr, 10)
    // Verificar se o vendedor existe na lista de todos os vendedores
    if (!Number.isNaN(vendedorIdNum) && (allVendedorIds.has(vendedorIdStr) || allVendedorIds.has(vendedorIdNum))) {
      vendedorId = vendedorIdStr
    }
    // Se não existir, vendedorId permanece null (foreign key permite null)
  }

  return {
    id: legacy.Id,
    orcamentoId: legacy.IdOrcamento,
    clienteId: clientId,
    status,
    // Medição ôhmica vinda do legado (p.Medicao); mantém null se ausente/não numérico
    medicaoOhmica: legacy.Medicao != null && !Number.isNaN(Number(legacy.Medicao)) ? Number(legacy.Medicao) : null,
    observacoes: buildObservacoes(legacy),
    legacyBanco: legacy.BancoEmissor ?? null,
    legacyEmpresaFaturamento: legacy.Empresa ?? null,
    bancoEmissorId: resolveBancoEmissorId(legacy.BancoEmissor, legacy.Empresa),
    geradoComissao,
    vendedorId: vendedorId,
    createdAt: parseDate(legacy.Cadastro) || new Date(),
    updatedAt: parseDate(legacy.Cadastro) || new Date(),
  }
}

async function fetchLegacyOrdersFromDb(clientId) {
  const pool = await sqlPool

  try {
    const query = `
      SELECT 
        p.Id, p.Cadastro, p.IdOrcamento, p.Stats, p.FormaPagamento, p.Garantia, p.Obsercacoes, p.Medicao,
        p.BancoEmissor, p.GeradoComissao, p.DataCertificado, p.Rota, p.RotaConcluido, p.StatusRota,
        p.ObsercacaoRota, p.Empresa, p.NumNf, o.IdPessoa, o.IdCliente
      FROM ${DB_SCHEMA}.Pedido p
      INNER JOIN ${DB_SCHEMA}.Orcamento o ON p.IdOrcamento = o.Id
      WHERE o.IdCliente = @clientId
      ORDER BY p.Id
    `
    const request = pool.request()
    request.input("clientId", sql.Int, clientId)

    const result = await request.query(query)
    return result.recordset || []
  } catch (error) {
    throw error
  }
}

async function importLegacyOrders(clientId) {
  const orders = await fetchLegacyOrdersFromDb(clientId)
  if (orders.length === 0) {
    return { totalImported: 0 }
  }

  const mappedOrders = orders.map((legacyOrder) => mapLegacyOrder(legacyOrder, legacyOrder.IdCliente))

  // Deletar pedidos existentes do cliente antes de recriar
  const orderIds = mappedOrders.map((o) => o.id)
  await prisma.pedido.deleteMany({
    where: {
      id: { in: orderIds },
    },
  })

  // Criar todos de uma vez
  await prisma.pedido.createMany({
    data: mappedOrders,
    skipDuplicates: true,
  })

  return { totalImported: mappedOrders.length }
}

// ========== FUNÇÕES DE ITENS DE ORÇAMENTOS ==========

function mapLegacyOrcamentoItem(legacy) {
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

async function fetchLegacyOrcamentoItemsFromDb(orcamentoIds) {
  if (!orcamentoIds || orcamentoIds.length === 0) {
    return []
  }

  const pool = await sqlPool

  try {
    // Construir query com IN para todos os orçamentos
    const placeholders = orcamentoIds.map((_, index) => `@id${index}`).join(",")
    const query = `
      SELECT 
        Id, Cadastro, IdOrcamento, IdItem, Quantidade, Valor
      FROM ${DB_SCHEMA}.OrcamentoItem
      WHERE IdOrcamento IN (${placeholders})
      ORDER BY Id
    `
    const request = pool.request()
    orcamentoIds.forEach((id, index) => {
      request.input(`id${index}`, sql.Int, id)
    })

    const result = await request.query(query)
    return result.recordset || []
  } catch (error) {
    throw error
  }
}

async function importLegacyOrcamentoItems(orcamentoIds) {
  if (!orcamentoIds || orcamentoIds.length === 0) {
    return { totalImported: 0 }
  }

  const items = await fetchLegacyOrcamentoItemsFromDb(orcamentoIds)
  if (items.length === 0) {
    return { totalImported: 0 }
  }

  const mappedItems = items.map((legacyItem) => mapLegacyOrcamentoItem(legacyItem))

  // Deletar itens existentes desses orçamentos antes de recriar
  const itemIds = mappedItems.map((i) => i.id)
  await prisma.orcamentoItem.deleteMany({
    where: {
      id: { in: itemIds },
    },
  })

  // Criar todos de uma vez
  await prisma.orcamentoItem.createMany({
    data: mappedItems,
    skipDuplicates: true,
  })

  return { totalImported: mappedItems.length }
}

// ========== FUNÇÕES DE ITENS DE PEDIDOS ==========

function mapLegacyPedidoItem(legacy) {
  return {
    id: legacy.Id,
    pedidoId: legacy.IdPedido,
    itemId: BigInt(legacy.IdItem),
    quantidade: legacy.Quantidade ? Number.parseInt(legacy.Quantidade, 10) : 0,
    valorUnitarioPraticado: legacy.Valor ? Number.parseFloat(legacy.Valor) : 0,
    createdAt: parseDate(legacy.Cadastro) || new Date(),
    updatedAt: parseDate(legacy.Cadastro) || new Date(),
  }
}

async function fetchLegacyPedidoItemsFromDb(pedidoIds) {
  if (!pedidoIds || pedidoIds.length === 0) {
    return []
  }

  const pool = await sqlPool

  try {
    // Construir query com IN para todos os pedidos
    const placeholders = pedidoIds.map((_, index) => `@id${index}`).join(",")
    const query = `
      SELECT 
        Id, Cadastro, IdPedido, IdItem, Quantidade, Valor
      FROM ${DB_SCHEMA}.PedidoItem
      WHERE IdPedido IN (${placeholders})
      ORDER BY Id
    `
    const request = pool.request()
    pedidoIds.forEach((id, index) => {
      request.input(`id${index}`, sql.Int, id)
    })

    const result = await request.query(query)
    return result.recordset || []
  } catch (error) {
    throw error
  }
}

async function importLegacyPedidoItems(pedidoIds) {
  if (!pedidoIds || pedidoIds.length === 0) {
    return { totalImported: 0 }
  }

  const items = await fetchLegacyPedidoItemsFromDb(pedidoIds)
  if (items.length === 0) {
    return { totalImported: 0 }
  }

  const mappedItems = items.map((legacyItem) => mapLegacyPedidoItem(legacyItem))

  // Deletar itens existentes desses pedidos antes de recriar
  const itemIds = mappedItems.map((i) => i.id)
  await prisma.pedidoItem.deleteMany({
    where: {
      id: { in: itemIds },
    },
  })

  // Criar todos de uma vez
  await prisma.pedidoItem.createMany({
    data: mappedItems,
    skipDuplicates: true,
  })

  return { totalImported: mappedItems.length }
}

// ========== FUNÇÕES PARA BUSCAR DADOS EM LOTE ==========

async function fetchAllClientsFromDb(page, pageSize, clientIds = null) {
  const pool = await sqlPool

  try {
    let query
    let request

    if (clientIds && Array.isArray(clientIds) && clientIds.length > 0) {
      const idsList = clientIds.map((id) => Number.parseInt(id, 10)).filter((id) => !Number.isNaN(id))
      if (idsList.length === 0) {
        return []
      }

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
      console.error("   Defina a variável de ambiente SQL_SERVER_DATABASE com o nome correto do banco")
      throw error
    }
    throw error
  }
}

async function fetchAllBudgetsFromDb(clientIds = null) {
  const pool = await sqlPool

  try {
    let query
    let request

    if (clientIds && clientIds.length > 0) {
      // Buscar orçamentos de clientes específicos
      const placeholders = clientIds.map((_, index) => `@id${index}`).join(",")
      query = `
        SELECT 
          Id, IdCliente, IdPessoa, Stats, FormaPagamento, Visita, Garantia,
          Parcelas, PrimeiroVencimento, Empresa, Anexo, Cadastro
        FROM ${DB_SCHEMA}.Orcamento
        WHERE IdCliente IN (${placeholders})
        ORDER BY Id
      `
      request = pool.request()
      clientIds.forEach((id, index) => {
        request.input(`id${index}`, sql.Int, id)
      })
    } else {
      // Buscar TODOS os orçamentos (sem filtro)
      query = `
        SELECT 
          Id, IdCliente, IdPessoa, Stats, FormaPagamento, Visita, Garantia,
          Parcelas, PrimeiroVencimento, Empresa, Anexo, Cadastro
        FROM ${DB_SCHEMA}.Orcamento
        ORDER BY Id
      `
      request = pool.request()
    }

    const result = await request.query(query)
    return result.recordset || []
  } catch (error) {
    throw error
  }
}

async function fetchAllBudgetItemsFromDb(orcamentoIds) {
  if (!orcamentoIds || orcamentoIds.length === 0) {
    return []
  }

  const pool = await sqlPool
  const MAX_PARAMS = 2000 // Limite seguro (SQL Server suporta 2100, deixamos margem)
  const allItems = []

  try {
    // Dividir em chunks para não exceder o limite de parâmetros
    for (let i = 0; i < orcamentoIds.length; i += MAX_PARAMS) {
      const chunk = orcamentoIds.slice(i, i + MAX_PARAMS)
      const placeholders = chunk.map((_, index) => `@id${index}`).join(",")
      const query = `
        SELECT 
          Id, Cadastro, IdOrcamento, IdItem, Quantidade, Valor
        FROM ${DB_SCHEMA}.OrcamentoItem
        WHERE IdOrcamento IN (${placeholders})
        ORDER BY Id
      `
      const request = pool.request()
      chunk.forEach((id, index) => {
        request.input(`id${index}`, sql.Int, id)
      })

      const result = await request.query(query)
      allItems.push(...(result.recordset || []))
    }

    return allItems
  } catch (error) {
    throw error
  }
}

async function fetchAllOrdersFromDb(clientIds = null) {
  const pool = await sqlPool

  try {
    let query
    let request

    if (clientIds && clientIds.length > 0) {
      // Buscar pedidos de clientes específicos
      const placeholders = clientIds.map((_, index) => `@id${index}`).join(",")
      query = `
        SELECT 
          p.Id, p.Cadastro, p.IdOrcamento, p.Stats, p.FormaPagamento, p.Garantia, p.Obsercacoes, p.Medicao,
          p.BancoEmissor, p.GeradoComissao, p.DataCertificado, p.Rota, p.RotaConcluido, p.StatusRota,
          p.ObsercacaoRota, p.Empresa, p.NumNf, o.IdPessoa, o.IdCliente
        FROM ${DB_SCHEMA}.Pedido p
        INNER JOIN ${DB_SCHEMA}.Orcamento o ON p.IdOrcamento = o.Id
        WHERE o.IdCliente IN (${placeholders})
        ORDER BY p.Id
      `
      request = pool.request()
      clientIds.forEach((id, index) => {
        request.input(`id${index}`, sql.Int, id)
      })
    } else {
      // Buscar TODOS os pedidos (sem filtro)
      query = `
        SELECT 
          p.Id, p.Cadastro, p.IdOrcamento, p.Stats, p.FormaPagamento, p.Garantia, p.Obsercacoes, p.Medicao,
          p.BancoEmissor, p.GeradoComissao, p.DataCertificado, p.Rota, p.RotaConcluido, p.StatusRota,
          p.ObsercacaoRota, p.Empresa, p.NumNf, o.IdPessoa, o.IdCliente
        FROM ${DB_SCHEMA}.Pedido p
        INNER JOIN ${DB_SCHEMA}.Orcamento o ON p.IdOrcamento = o.Id
        ORDER BY p.Id
      `
      request = pool.request()
    }

    const result = await request.query(query)
    return result.recordset || []
  } catch (error) {
    throw error
  }
}

async function fetchAllOrderItemsFromDb(pedidoIds) {
  if (!pedidoIds || pedidoIds.length === 0) {
    return []
  }

  const pool = await sqlPool
  const MAX_PARAMS = 2000 // Limite seguro (SQL Server suporta 2100, deixamos margem)
  const allItems = []

  try {
    // Dividir em chunks para não exceder o limite de parâmetros
    for (let i = 0; i < pedidoIds.length; i += MAX_PARAMS) {
      const chunk = pedidoIds.slice(i, i + MAX_PARAMS)
      const placeholders = chunk.map((_, index) => `@id${index}`).join(",")
      const query = `
        SELECT 
          Id, Cadastro, IdPedido, IdItem, Quantidade, Valor
        FROM ${DB_SCHEMA}.PedidoItem
        WHERE IdPedido IN (${placeholders})
        ORDER BY Id
      `
      const request = pool.request()
      chunk.forEach((id, index) => {
        request.input(`id${index}`, sql.Int, id)
      })

      const result = await request.query(query)
      allItems.push(...(result.recordset || []))
    }

    return allItems
  } catch (error) {
    throw error
  }
}

// ========== FUNÇÕES DE DÉBITOS ==========

function mapLegacyDebito(legacy) {
  // Garantir que remessa sempre tenha um valor (0 ou 1)



  remessa = legacy.Remessa


  // Garantir que stats sempre tenha um valor (-1, 0 ou 2)
  const stats = legacy.Stats


  return {
    id: legacy.Id,
    pedidoId: legacy.IdPedido,
    clienteId: legacy.IdCliente, // IdCliente obtido via JOIN
    receber: legacy.Receber ? Number.parseFloat(legacy.Receber) : 0,
    dataOcorrencia: parseDate(legacy.DatOcorrencia),
    recebido: legacy.Recebido != null ? Number.parseFloat(legacy.Recebido) : null,
    vencimento: parseDate(legacy.Vencimento),
    acrescimos: legacy.Acrescimos != null ? Number.parseFloat(legacy.Acrescimos) : null,
    descontos: legacy.Descontos != null ? Number.parseFloat(legacy.Descontos) : null,
    email: legacy.Email || null,
    banCobrador: legacy.BanCobrador || null,
    stats: stats,
    remessa: remessa,
    linkBoleto: legacy.LinkBoleto || null,
    createdAt: parseDate(legacy.Data) || new Date(),
    updatedAt: parseDate(legacy.Data) || new Date(),
  }
}

async function fetchAllDebitosFromDb(pedidoIds = null) {
  const pool = await sqlPool

  try {
    let query
    let request

    if (pedidoIds && pedidoIds.length > 0) {
      // Buscar débitos de pedidos específicos - chunk menor por causa dos JOINs
      const MAX_PARAMS = 10 // Chunk menor para queries com JOIN (era 2000)
      const allDebitos = []
      const totalChunks = Math.ceil(pedidoIds.length / MAX_PARAMS)

      // Dividir em chunks para não exceder o limite de parâmetros
      for (let i = 0; i < pedidoIds.length; i += MAX_PARAMS) {
        const chunkNum = Math.floor(i / MAX_PARAMS) + 1
        const chunk = pedidoIds.slice(i, i + MAX_PARAMS)
        const placeholders = chunk.map((_, index) => `@id${index}`).join(",")

        console.info(`   📦 Buscando débitos chunk ${chunkNum}/${totalChunks} (${chunk.length} pedidos)...`)

        query = `
          SELECT 
            d.Id, d.IdPedido, d.Vencimento, d.[Data] AS Data, d.Receber, d.DatOcorrencia, d.Recebido, 
            d.Acrescimos, d.Descontos, d.Email, d.BanCobrador, d.Stats, d.Remessa, d.LinkBoleto,
            o.IdCliente
          FROM ${DB_SCHEMA}.Debito d
          INNER JOIN ${DB_SCHEMA}.Pedido p ON d.IdPedido = p.Id
          INNER JOIN ${DB_SCHEMA}.Orcamento o ON p.IdOrcamento = o.Id
          WHERE d.IdPedido IN (${placeholders})
          ORDER BY d.Id
        `
        request = pool.request()
        chunk.forEach((id, index) => {
          request.input(`id${index}`, sql.Int, id)
        })

        const result = await request.query(query)
        const found = result.recordset?.length || 0
        allDebitos.push(...(result.recordset || []))
        console.info(`   ✓ Chunk ${chunkNum}: ${found} débitos encontrados (total: ${allDebitos.length})`)
      }

      return allDebitos
    } else {
      // Buscar TODOS os débitos (sem filtro) - usando paginação
      console.info("   📦 Buscando todos os débitos (sem filtro)...")
      query = `
        SELECT 
          d.Id, d.IdPedido, d.Vencimento, d.[Data] AS Data, d.Receber, d.DatOcorrencia, d.Recebido, 
          d.Acrescimos, d.Descontos, d.Email, d.BanCobrador, d.Stats, d.Remessa, d.LinkBoleto,
          o.IdCliente
        FROM ${DB_SCHEMA}.Debito d
        INNER JOIN ${DB_SCHEMA}.Pedido p ON d.IdPedido = p.Id
        INNER JOIN ${DB_SCHEMA}.Orcamento o ON p.IdOrcamento = o.Id
        ORDER BY d.Id
      `
      request = pool.request()
    }

    const result = await request.query(query)
    return result.recordset || []
  } catch (error) {
    throw error
  }
}

// ========== FUNÇÕES DE VERIFICAÇÃO DE INTEGRIDADE ==========

/**
 * Conta registros de uma tabela no banco antigo (COUNT direto no SQL Server)
 */
async function countLegacyTableDirect(tableName, whereClause = "") {
  const pool = await sqlPool
  try {
    const query = `SELECT COUNT(*) AS total FROM ${DB_SCHEMA}.${tableName} ${whereClause}`
    const result = await pool.request().query(query)
    return result.recordset[0]?.total || 0
  } catch (error) {
    console.error(`Erro ao contar registros de ${tableName} no banco antigo:`, error.message)
    return 0
  }
}

/**
 * Busca todos os IDs de uma tabela no banco antigo
 */
async function fetchAllIdsFromLegacyTable(tableName, idColumn = "Id", whereClause = "") {
  const pool = await sqlPool
  try {
    const query = `SELECT ${idColumn} FROM ${DB_SCHEMA}.${tableName} ${whereClause} ORDER BY ${idColumn}`
    const result = await pool.request().query(query)
    return new Set((result.recordset || []).map((r) => r[idColumn]))
  } catch (error) {
    console.error(`Erro ao buscar IDs de ${tableName} no banco antigo:`, error.message)
    return new Set()
  }
}

/**
 * Verifica integridade de uma tabela comparando contagens e IDs
 */
async function verifyTableIntegrity(tableName, prismaModel, idColumn = "id", legacyWhereClause = "", description = "") {
  console.info(`\n🔍 Verificando integridade de ${description || tableName}...`)

  // Contar no banco antigo (COUNT direto no SQL Server)
  const legacyCount = await countLegacyTableDirect(tableName, legacyWhereClause)

  // Contar no banco novo (COUNT direto no PostgreSQL)
  const newCount = await prismaModel.count()

  console.info(`   Banco antigo (COUNT): ${legacyCount} registros`)
  console.info(`   Banco novo (COUNT): ${newCount} registros`)

  if (legacyCount === newCount) {
    console.info(`   ✅ Contagens idênticas - nenhuma perda de dados`)
    return { match: true, legacyCount, newCount, missingIds: [] }
  }

  console.warn(`   ⚠️  DIVERGÊNCIA DETECTADA: ${Math.abs(legacyCount - newCount)} registros de diferença`)

  // Se houver divergência, identificar IDs faltantes
  const legacyIds = await fetchAllIdsFromLegacyTable(tableName, idColumn === "id" ? "Id" : idColumn, legacyWhereClause)
  const newIds = new Set(
    (await prismaModel.findMany({ select: { [idColumn]: true } })).map((r) => r[idColumn])
  )

  const missingIds = []
  for (const legacyId of legacyIds) {
    if (!newIds.has(legacyId)) {
      missingIds.push(legacyId)
    }
  }

  if (missingIds.length > 0) {
    console.warn(`   ❌ ${missingIds.length} registros NÃO FORAM IMPORTADOS:`)
    // Mostrar apenas os primeiros 20 IDs faltantes para não poluir o console
    const idsToShow = missingIds.slice(0, 20)
    idsToShow.forEach((id) => {
      console.warn(`      - ${tableName} ID ${id}`)
    })
    if (missingIds.length > 20) {
      console.warn(`      ... e mais ${missingIds.length - 20} registros`)
    }
  }

  return { match: false, legacyCount, newCount, missingIds }
}

/**
 * Verifica integridade de débitos (com filtro por pedidos existentes no banco novo)
 */
async function verifyDebitosIntegrity() {
  console.info(`\n🔍 Verificando integridade de Débitos...`)

  // Buscar todos os IDs de pedidos do banco novo
  const allPedidoIds = new Set(
    (await prisma.pedido.findMany({ select: { id: true } })).map((p) => p.id)
  )

  if (allPedidoIds.size === 0) {
    console.warn(`   ⚠️  Nenhum pedido encontrado no banco novo. Pulando verificação de débitos.`)
    return { match: true, legacyCount: 0, newCount: 0, missingIds: [] }
  }

  // Contar débitos no banco antigo que pertencem a pedidos existentes no banco novo (COUNT direto)
  const pool = await sqlPool
  let legacyCount = 0
  let legacyIds = new Set()

  try {
    // Dividir em chunks para não exceder limite de parâmetros
    const MAX_PARAMS = 2000
    const pedidoIdsArray = Array.from(allPedidoIds)

    for (let i = 0; i < pedidoIdsArray.length; i += MAX_PARAMS) {
      const chunk = pedidoIdsArray.slice(i, i + MAX_PARAMS)
      const placeholders = chunk.map((_, index) => `@id${index}`).join(",")
      // COUNT direto no SQL Server
      const countQuery = `
        SELECT COUNT(*) AS total
        FROM ${DB_SCHEMA}.Debito d
        WHERE d.IdPedido IN (${placeholders})
      `
      const request = pool.request()
      chunk.forEach((id, index) => {
        request.input(`id${index}`, sql.Int, id)
      })

      const countResult = await request.query(countQuery)
      legacyCount += countResult.recordset[0]?.total || 0

      // Buscar IDs para análise detalhada se necessário
      const idsQuery = `
        SELECT d.Id
        FROM ${DB_SCHEMA}.Debito d
        WHERE d.IdPedido IN (${placeholders})
      `
      const idsRequest = pool.request()
      chunk.forEach((id, index) => {
        idsRequest.input(`id${index}`, sql.Int, id)
      })
      const idsResult = await idsRequest.query(idsQuery)
      const chunkIds = (idsResult.recordset || []).map((r) => r.Id)
      chunkIds.forEach((id) => legacyIds.add(id))
    }
  } catch (error) {
    console.error(`Erro ao contar débitos no banco antigo:`, error.message)
    return { match: false, legacyCount: 0, newCount: 0, missingIds: [] }
  }

  // Contar no banco novo (COUNT direto no PostgreSQL)
  const newCount = await prisma.debito.count()

  console.info(`   Banco antigo (COUNT): ${legacyCount} registros`)
  console.info(`   Banco novo (COUNT): ${newCount} registros`)

  if (legacyCount === newCount) {
    console.info(`   ✅ Contagens idênticas - nenhuma perda de dados`)
    return { match: true, legacyCount, newCount, missingIds: [] }
  }

  console.warn(`   ⚠️  DIVERGÊNCIA DETECTADA: ${Math.abs(legacyCount - newCount)} registros de diferença`)

  // Identificar IDs faltantes
  const newIds = new Set(
    (await prisma.debito.findMany({ select: { id: true } })).map((r) => r.id)
  )

  const missingIds = []
  for (const legacyId of legacyIds) {
    if (!newIds.has(legacyId)) {
      missingIds.push(legacyId)
    }
  }

  if (missingIds.length > 0) {
    console.warn(`   ❌ ${missingIds.length} registros NÃO FORAM IMPORTADOS:`)
    const idsToShow = missingIds.slice(0, 20)
    idsToShow.forEach((id) => {
      console.warn(`      - Débito ID ${id}`)
    })
    if (missingIds.length > 20) {
      console.warn(`      ... e mais ${missingIds.length - 20} registros`)
    }
  }

  return { match: false, legacyCount, newCount, missingIds }
}

// ========== FUNÇÃO PARA IMPORTAR APENAS DÉBITOS ==========

async function importOnlyDebitos() {
  console.info("========== MODO: Importar apenas débitos ==========")

  // Buscar todos os IDs de pedidos do banco novo
  const allPedidosForDebitos = await prisma.pedido.findMany({
    select: { id: true },
  })
  const allPedidoIdsForDebitos = allPedidosForDebitos.map((p) => p.id)

  // Buscar todos os IDs de clientes importados para validação
  const importedClientIdsForDebitos = await prisma.client.findMany({
    select: { id: true },
  })
  const importedClientIdsSetForDebitos = new Set(importedClientIdsForDebitos.map((c) => c.id))
  console.info(`✓ ${importedClientIdsForDebitos.length} clientes encontrados no banco novo para validação`)

  let totalDebitos = 0
  if (allPedidoIdsForDebitos.length > 0) {
    console.info(`Buscando débitos de ${allPedidoIdsForDebitos.length} pedidos...`)
    const debitos = await fetchAllDebitosFromDb(allPedidoIdsForDebitos)

    if (debitos.length > 0) {
      // Processar em batches menores para evitar limite de variáveis do PostgreSQL (32767)
      const BATCH_SIZE = 10000 // Limite seguro para deleteMany/createMany
      const mappedDebitos = []
      const failedDebitos = []
      const invalidDebitos = []

      // Buscar todos os IDs de pedidos válidos para validação
      const validPedidoIdsSet = new Set(allPedidoIdsForDebitos)

      for (const legacy of debitos) {
        try {
          // Validar se o pedidoId existe no banco novo
          if (!validPedidoIdsSet.has(legacy.IdPedido)) {
            invalidDebitos.push({ debito: legacy, reason: `pedidoId ${legacy.IdPedido} não encontrado` })
            console.warn(`   ⚠️  Débito ID ${legacy.Id}: pedidoId ${legacy.IdPedido} não encontrado`)
            continue
          }

          // Validar se o clienteId existe no banco novo
          if (!importedClientIdsSetForDebitos.has(legacy.IdCliente)) {
            invalidDebitos.push({ debito: legacy, reason: `clienteId ${legacy.IdCliente} não encontrado` })
            console.warn(`   ⚠️  Débito ID ${legacy.Id}: clienteId ${legacy.IdCliente} não encontrado`)
            continue
          }

          const mapped = mapLegacyDebito(legacy)
          mappedDebitos.push(mapped)
        } catch (error) {
          failedDebitos.push({ debito: legacy, error: error.message })
          console.error(`   ✗ Erro ao mapear débito ID ${legacy.Id}: ${error.message}`)
        }
      }

      if (invalidDebitos.length > 0) {
        console.warn(`⚠️  ${invalidDebitos.length} débitos ignorados (pedidoId ou clienteId não existe no banco novo)`)
      }

      if (mappedDebitos.length > 0) {
        // Processar deleteMany/createMany em batches
        for (let i = 0; i < mappedDebitos.length; i += BATCH_SIZE) {
          const batch = mappedDebitos.slice(i, i + BATCH_SIZE)
          const debitoIdsToImport = batch.map((d) => d.id)

          try {
            await prisma.debito.deleteMany({
              where: { id: { in: debitoIdsToImport } },
            })
            await prisma.debito.createMany({
              data: batch,
              skipDuplicates: true,
            })

            totalDebitos += batch.length
            console.info(`✓ ${batch.length} débitos importados (total: ${totalDebitos})`)
          } catch (error) {
            console.error(`✗ Erro ao importar batch de débitos: ${error.message}`)
            console.error(`   IDs do batch: ${debitoIdsToImport.slice(0, 10).join(", ")}...`)
          }
        }
      }

      if (failedDebitos.length > 0) {
        console.warn(`⚠️  ${failedDebitos.length} débitos falharam no mapeamento`)
      }
    }
  }

  console.info(`\n========== RESUMO ==========`)
  console.info(`Débitos importados: ${totalDebitos}`)

  // ========== VERIFICAÇÃO DE INTEGRIDADE ==========
  console.info(`\n========== VERIFICAÇÃO DE INTEGRIDADE ==========`)
  await verifyDebitosIntegrity()
  await resetImportSequences()

  return { totalDebitos }
}

// ========== FUNÇÃO MAIN ==========

async function main() {
  const args = process.argv.slice(2)

  // Verificar se a flag --only-debitos foi passada
  if (args.includes("--only-debitos") || args.includes("--skip-to-debitos")) {
    await importOnlyDebitos()
    return
  }

  // Buscar IDs dos vendedores ativos no início (para validar clientes)
  console.info("Buscando IDs de vendedores ativos...")
  allowedVendedorIds = await fetchActiveVendedorIds()

  if (allowedVendedorIds.size === 0) {
    console.warn("⚠️  Nenhum vendedor ativo encontrado. O campo vendedorId de clientes não será preenchido.")
  }

  // Buscar IDs de todos os vendedores (para validar orçamentos e pedidos)
  console.info("Buscando IDs de todos os vendedores...")
  allVendedorIds = await fetchAllVendedorIds()

  if (allVendedorIds.size === 0) {
    console.warn("⚠️  Nenhum vendedor encontrado. O campo vendedorId de orçamentos e pedidos não será preenchido.")
  }

  // Remover flags dos argumentos
  const filteredArgs = args.filter((arg) => !arg.startsWith("--"))
  const BATCH_SIZE = 1000 // Processar 1000 clientes por vez

  // Se não houver argumentos, buscar todos os clientes do banco de dados
  if (filteredArgs.length === 0) {
    console.info("Modo: Importar todos os clientes do banco de dados")
    console.info(`Tamanho do lote: ${BATCH_SIZE} clientes`)

    // Verificar flag --skip-clients
    const skipClients = args.includes("--skip-clients")
    let totalClients = 0

    // ========== FASE 1: IMPORTAR TODOS OS CLIENTES ==========
    if (skipClients) {
      console.info(`\n========== FASE 1: PULANDO clientes (--skip-clients) ==========`)
      console.info(`⏭️  Clientes não serão importados. Usando clientes existentes no banco novo.`)
    } else {
      console.info(`\n========== FASE 1: Importando todos os clientes ==========`)
      let page = 1
      let allClients = []

      while (true) {
        console.info(`Buscando clientes (página ${page})...`)
        const clients = await fetchAllClientsFromDb(page, BATCH_SIZE)

        if (clients.length === 0) {
          break
        }

        const mappedClients = clients.map((legacy) => mapLegacyToNew(legacy)).filter(Boolean)
        const clientIdsToImport = mappedClients.map((c) => c.id)

        await prisma.client.deleteMany({
          where: { id: { in: clientIdsToImport } },
        })
        await prisma.client.createMany({
          data: mappedClients,
          skipDuplicates: true,
        })

        allClients.push(...clients)
        totalClients += mappedClients.length
        console.info(`✓ ${mappedClients.length} clientes importados (total: ${totalClients})`)

        if (clients.length < BATCH_SIZE) {
          break
        }

        page += 1
      }

      console.info(`\n✓ FASE 1 concluída: ${totalClients} clientes importados`)
    }

    // ========== FASE 2: IMPORTAR TODOS OS ORÇAMENTOS ==========
    console.info(`\n========== FASE 2: Importando todos os orçamentos ==========`)

    // Buscar IDs dos clientes realmente importados no banco novo (para validação)
    const importedClients = await prisma.client.findMany({
      select: { id: true },
    })
    const importedClientIdsSet = new Set(importedClients.map((c) => c.id))
    console.info(`✓ ${importedClients.length} clientes encontrados no banco novo para validação`)

    // Buscar TODOS os orçamentos do banco antigo (sem filtro de cliente)
    console.info(`Buscando todos os orçamentos do banco antigo...`)
    const allBudgets = await fetchAllBudgetsFromDb()
    console.info(`✓ ${allBudgets.length} orçamentos encontrados no banco antigo`)

    // Filtrar apenas orçamentos cujo cliente existe no banco novo
    const validBudgets = []
    const invalidBudgets = []

    for (const budget of allBudgets) {
      if (importedClientIdsSet.has(budget.IdCliente)) {
        validBudgets.push(budget)
      } else {
        invalidBudgets.push(budget)
      }
    }

    if (invalidBudgets.length > 0) {
      console.warn(`⚠️  ${invalidBudgets.length} orçamentos ignorados (cliente não existe no banco novo):`)
      invalidBudgets.forEach((b) => {
        console.warn(`   - Orçamento ID ${b.Id}: clienteId ${b.IdCliente} não encontrado`)
      })
    }

    let totalBudgets = 0
    if (validBudgets.length > 0) {
      // Processar em batches menores para evitar limite de variáveis do PostgreSQL (32767)
      const BATCH_SIZE = 10000 // Limite seguro para deleteMany/createMany
      for (let i = 0; i < validBudgets.length; i += BATCH_SIZE) {
        const batch = validBudgets.slice(i, i + BATCH_SIZE)
        const mappedBudgets = []
        const failedBudgets = []

        for (const legacy of batch) {
          try {
            const mapped = mapLegacyBudget(legacy, legacy.IdCliente)
            mappedBudgets.push(mapped)
          } catch (error) {
            failedBudgets.push({ budget: legacy, error: error.message })
            console.error(`   ✗ Erro ao mapear orçamento ID ${legacy.Id}: ${error.message}`)
          }
        }

        if (mappedBudgets.length > 0) {
          const budgetIdsToImport = mappedBudgets.map((b) => b.id)

          try {
            await prisma.orcamento.deleteMany({
              where: { id: { in: budgetIdsToImport } },
            })
            await prisma.orcamento.createMany({
              data: mappedBudgets,
              skipDuplicates: true,
            })

            totalBudgets += mappedBudgets.length
            console.info(`✓ ${mappedBudgets.length} orçamentos importados (total: ${totalBudgets})`)
          } catch (error) {
            console.error(`✗ Erro ao importar batch de orçamentos: ${error.message}`)
            console.error(`   IDs do batch: ${budgetIdsToImport.slice(0, 10).join(", ")}...`)
          }
        }

        if (failedBudgets.length > 0) {
          console.warn(`⚠️  ${failedBudgets.length} orçamentos falharam no mapeamento`)
        }
      }
    }

    console.info(`\n✓ FASE 2 concluída: ${totalBudgets} orçamentos importados`)

    // ========== FASE 3: IMPORTAR TODOS OS ITENS DE ORÇAMENTOS ==========
    console.info(`\n========== FASE 3: Importando todos os itens de orçamentos ==========`)

    // Buscar todos os IDs de itens válidos no banco novo (para validação)
    const allItems = await prisma.item.findMany({
      select: { id: true },
    })
    let validItemIdsSet = new Set(allItems.map((item) => item.id.toString()))
    console.info(`✓ ${allItems.length} itens encontrados no banco novo para validação`)

    // Buscar todos os IDs de orçamentos do banco novo
    const allOrcamentos = await prisma.orcamento.findMany({
      select: { id: true },
    })
    const allOrcamentoIds = allOrcamentos.map((o) => o.id)

    let totalBudgetItems = 0
    if (allOrcamentoIds.length > 0) {
      console.info(`Buscando itens de ${allOrcamentoIds.length} orçamentos...`)
      const budgetItems = await fetchAllBudgetItemsFromDb(allOrcamentoIds)

      if (budgetItems.length > 0) {
        // Processar em batches menores para evitar limite de variáveis do PostgreSQL (32767)
        const BATCH_SIZE = 10000 // Limite seguro para deleteMany/createMany
        const mappedBudgetItems = []
        const failedItems = []
        const invalidItemIds = []

        for (const legacy of budgetItems) {
          try {
            const mapped = mapLegacyOrcamentoItem(legacy)
            // Validar se o itemId existe no banco novo
            const itemIdStr = mapped.itemId.toString()
            if (validItemIdsSet.has(itemIdStr)) {
              mappedBudgetItems.push(mapped)
            } else {
              invalidItemIds.push({ item: legacy, itemId: mapped.itemId })
              console.warn(`   ⚠️  Item de orçamento ID ${legacy.Id}: itemId ${mapped.itemId} não encontrado`)
            }
          } catch (error) {
            failedItems.push({ item: legacy, error: error.message })
            console.error(`   ✗ Erro ao mapear item de orçamento ID ${legacy.Id}: ${error.message}`)
          }
        }

        if (invalidItemIds.length > 0) {
          console.warn(`⚠️  ${invalidItemIds.length} itens de orçamentos ignorados (itemId não existe no banco novo)`)
        }

        if (mappedBudgetItems.length > 0) {
          // Processar deleteMany/createMany em batches
          for (let i = 0; i < mappedBudgetItems.length; i += BATCH_SIZE) {
            const batch = mappedBudgetItems.slice(i, i + BATCH_SIZE)
            const itemIdsToImport = batch.map((item) => item.id)

            try {
              await prisma.orcamentoItem.deleteMany({
                where: { id: { in: itemIdsToImport } },
              })
              await prisma.orcamentoItem.createMany({
                data: batch,
                skipDuplicates: true,
              })

              totalBudgetItems += batch.length
              console.info(`✓ ${batch.length} itens de orçamentos importados (total: ${totalBudgetItems})`)
            } catch (error) {
              console.error(`✗ Erro ao importar batch de itens de orçamentos: ${error.message}`)
              console.error(`   IDs do batch: ${itemIdsToImport.slice(0, 10).join(", ")}...`)
            }
          }
        }

        if (failedItems.length > 0) {
          console.warn(`⚠️  ${failedItems.length} itens de orçamentos falharam no mapeamento`)
        }
      }
    }

    console.info(`\n✓ FASE 3 concluída: ${totalBudgetItems} itens de orçamentos importados`)

    // ========== FASE 4: IMPORTAR TODOS OS PEDIDOS ==========
    console.info(`\n========== FASE 4: Importando todos os pedidos ==========`)
    // Reutilizar o Set de clientes importados (já foi criado na Fase 2)

    // Buscar TODOS os pedidos do banco antigo (sem filtro de cliente)
    console.info(`Buscando todos os pedidos do banco antigo...`)
    const allOrders = await fetchAllOrdersFromDb()
    console.info(`✓ ${allOrders.length} pedidos encontrados no banco antigo`)

    // Filtrar apenas pedidos cujo cliente existe no banco novo
    const validOrders = []
    const invalidOrders = []

    for (const order of allOrders) {
      if (importedClientIdsSet.has(order.IdCliente)) {
        validOrders.push(order)
      } else {
        invalidOrders.push(order)
      }
    }

    if (invalidOrders.length > 0) {
      console.warn(`⚠️  ${invalidOrders.length} pedidos ignorados (cliente não existe no banco novo):`)
      invalidOrders.forEach((o) => {
        console.warn(`   - Pedido ID ${o.Id}: clienteId ${o.IdCliente} não encontrado`)
      })
    }

    let totalOrders = 0
    if (validOrders.length > 0) {
      // Processar em batches menores para evitar limite de variáveis do PostgreSQL (32767)
      const BATCH_SIZE = 10000 // Limite seguro para deleteMany/createMany
      for (let i = 0; i < validOrders.length; i += BATCH_SIZE) {
        const batch = validOrders.slice(i, i + BATCH_SIZE)
        const mappedOrders = []
        const failedOrders = []

        for (const legacy of batch) {
          try {
            const mapped = mapLegacyOrder(legacy, legacy.IdCliente)
            mappedOrders.push(mapped)
          } catch (error) {
            failedOrders.push({ order: legacy, error: error.message })
            console.error(`   ✗ Erro ao mapear pedido ID ${legacy.Id}: ${error.message}`)
          }
        }

        if (mappedOrders.length > 0) {
          const orderIdsToImport = mappedOrders.map((o) => o.id)

          try {
            await prisma.pedido.deleteMany({
              where: { id: { in: orderIdsToImport } },
            })
            await prisma.pedido.createMany({
              data: mappedOrders,
              skipDuplicates: true,
            })

            totalOrders += mappedOrders.length
            console.info(`✓ ${mappedOrders.length} pedidos importados (total: ${totalOrders})`)
          } catch (error) {
            console.error(`✗ Erro ao importar batch de pedidos: ${error.message}`)
            console.error(`   IDs do batch: ${orderIdsToImport.slice(0, 10).join(", ")}...`)
          }
        }

        if (failedOrders.length > 0) {
          console.warn(`⚠️  ${failedOrders.length} pedidos falharam no mapeamento`)
        }
      }
    }

    console.info(`\n✓ FASE 4 concluída: ${totalOrders} pedidos importados`)

    // ========== FASE 5: IMPORTAR TODOS OS ITENS DE PEDIDOS ==========
    console.info(`\n========== FASE 5: Importando todos os itens de pedidos ==========`)

    // Reutilizar o Set de itens válidos (já foi criado na Fase 3)
    // Se não foi criado (caso Fase 3 tenha sido pulada), buscar novamente
    if (!validItemIdsSet || validItemIdsSet.size === 0) {
      const allItems = await prisma.item.findMany({
        select: { id: true },
      })
      validItemIdsSet = new Set(allItems.map((item) => item.id.toString()))
      console.info(`✓ ${allItems.length} itens encontrados no banco novo para validação`)
    }

    // Buscar todos os IDs de pedidos do banco novo
    const allPedidos = await prisma.pedido.findMany({
      select: { id: true },
    })
    const allPedidoIds = allPedidos.map((p) => p.id)

    let totalOrderItems = 0
    if (allPedidoIds.length > 0) {
      console.info(`Buscando itens de ${allPedidoIds.length} pedidos...`)
      const orderItems = await fetchAllOrderItemsFromDb(allPedidoIds)

      if (orderItems.length > 0) {
        // Processar em batches menores para evitar limite de variáveis do PostgreSQL (32767)
        const BATCH_SIZE = 10000 // Limite seguro para deleteMany/createMany
        const mappedOrderItems = []
        const failedItems = []
        const invalidItemIds = []

        for (const legacy of orderItems) {
          try {
            const mapped = mapLegacyPedidoItem(legacy)
            // Validar se o itemId existe no banco novo
            const itemIdStr = mapped.itemId.toString()
            if (validItemIdsSet.has(itemIdStr)) {
              mappedOrderItems.push(mapped)
            } else {
              invalidItemIds.push({ item: legacy, itemId: mapped.itemId })
              console.warn(`   ⚠️  Item de pedido ID ${legacy.Id}: itemId ${mapped.itemId} não encontrado`)
            }
          } catch (error) {
            failedItems.push({ item: legacy, error: error.message })
            console.error(`   ✗ Erro ao mapear item de pedido ID ${legacy.Id}: ${error.message}`)
          }
        }

        if (invalidItemIds.length > 0) {
          console.warn(`⚠️  ${invalidItemIds.length} itens de pedidos ignorados (itemId não existe no banco novo)`)
        }

        if (mappedOrderItems.length > 0) {
          // Processar deleteMany/createMany em batches
          for (let i = 0; i < mappedOrderItems.length; i += BATCH_SIZE) {
            const batch = mappedOrderItems.slice(i, i + BATCH_SIZE)
            const itemIdsToImport = batch.map((item) => item.id)

            try {
              await prisma.pedidoItem.deleteMany({
                where: { id: { in: itemIdsToImport } },
              })
              await prisma.pedidoItem.createMany({
                data: batch,
                skipDuplicates: true,
              })

              totalOrderItems += batch.length
              console.info(`✓ ${batch.length} itens de pedidos importados (total: ${totalOrderItems})`)
            } catch (error) {
              console.error(`✗ Erro ao importar batch de itens de pedidos: ${error.message}`)
              console.error(`   IDs do batch: ${itemIdsToImport.slice(0, 10).join(", ")}...`)
            }
          }
        }

        if (failedItems.length > 0) {
          console.warn(`⚠️  ${failedItems.length} itens de pedidos falharam no mapeamento`)
        }
      }
    }

    console.info(`\n✓ FASE 5 concluída: ${totalOrderItems} itens de pedidos importados`)

    console.info(`\n========== RESUMO FINAL ==========`)
    console.info(`Clientes importados: ${totalClients}`)
    console.info(`Orçamentos importados: ${totalBudgets}`)
    console.info(`Itens de orçamentos importados: ${totalBudgetItems}`)
    console.info(`Pedidos importados: ${totalOrders}`)
    console.info(`Itens de pedidos importados: ${totalOrderItems}`)

    // ========== VERIFICAÇÃO DE INTEGRIDADE ==========
    console.info(`\n========== VERIFICAÇÃO DE INTEGRIDADE ==========`)

    // Verificar cada tabela importada
    await verifyTableIntegrity("Cliente", prisma.client, "id", "", "Clientes")

    // Para orçamentos, verificar apenas os que pertencem a clientes importados
    const importedClientIdsForVerification = await prisma.client.findMany({ select: { id: true } })
    const clientIdsForWhere = importedClientIdsForVerification.map((c) => c.id)
    if (clientIdsForWhere.length > 0) {
      // Construir WHERE clause com IN (limitado a 2000 por vez)
      const MAX_PARAMS = 2000
      let allLegacyOrcamentoIds = new Set()
      let totalLegacyOrcamentos = 0

      for (let i = 0; i < clientIdsForWhere.length; i += MAX_PARAMS) {
        const chunk = clientIdsForWhere.slice(i, i + MAX_PARAMS)
        const pool = await sqlPool
        const placeholders = chunk.map((_, index) => `@id${index}`).join(",")
        const query = `SELECT Id FROM ${DB_SCHEMA}.Orcamento WHERE IdCliente IN (${placeholders})`
        const request = pool.request()
        chunk.forEach((id, index) => {
          request.input(`id${index}`, sql.Int, id)
        })
        const result = await request.query(query)
        const chunkIds = (result.recordset || []).map((r) => r.Id)
        totalLegacyOrcamentos += chunkIds.length
        chunkIds.forEach((id) => allLegacyOrcamentoIds.add(id))
      }

      const newOrcamentoCount = await prisma.orcamento.count()
      console.info(`\n🔍 Verificando integridade de Orçamentos...`)
      console.info(`   Banco antigo (de clientes importados): ${totalLegacyOrcamentos} registros`)
      console.info(`   Banco novo: ${newOrcamentoCount} registros`)

      if (totalLegacyOrcamentos === newOrcamentoCount) {
        console.info(`   ✅ Contagens idênticas - nenhuma perda de dados`)
      } else {
        console.warn(`   ⚠️  DIVERGÊNCIA DETECTADA: ${Math.abs(totalLegacyOrcamentos - newOrcamentoCount)} registros de diferença`)
        const newOrcamentoIds = new Set(
          (await prisma.orcamento.findMany({ select: { id: true } })).map((r) => r.id)
        )
        const missingIds = Array.from(allLegacyOrcamentoIds).filter((id) => !newOrcamentoIds.has(id))
        if (missingIds.length > 0) {
          console.warn(`   ❌ ${missingIds.length} registros NÃO FORAM IMPORTADOS:`)
          missingIds.slice(0, 20).forEach((id) => {
            console.warn(`      - Orçamento ID ${id}`)
          })
          if (missingIds.length > 20) {
            console.warn(`      ... e mais ${missingIds.length - 20} registros`)
          }
        }
      }
    }

    // Verificar itens de orçamentos (apenas dos orçamentos importados)
    const allOrcamentoIdsForVerification = await prisma.orcamento.findMany({ select: { id: true } })
    const orcamentoIdsForWhere = allOrcamentoIdsForVerification.map((o) => o.id)
    if (orcamentoIdsForWhere.length > 0) {
      const MAX_PARAMS = 2000
      let totalLegacyOrcamentoItems = 0
      let allLegacyOrcamentoItemIds = new Set()

      for (let i = 0; i < orcamentoIdsForWhere.length; i += MAX_PARAMS) {
        const chunk = orcamentoIdsForWhere.slice(i, i + MAX_PARAMS)
        const pool = await sqlPool
        const placeholders = chunk.map((_, index) => `@id${index}`).join(",")
        // COUNT direto no SQL Server
        const countQuery = `SELECT COUNT(*) AS total FROM ${DB_SCHEMA}.OrcamentoItem WHERE IdOrcamento IN (${placeholders})`
        const countRequest = pool.request()
        chunk.forEach((id, index) => {
          countRequest.input(`id${index}`, sql.Int, id)
        })
        const countResult = await countRequest.query(countQuery)
        totalLegacyOrcamentoItems += countResult.recordset[0]?.total || 0

        // Buscar IDs para análise detalhada
        const idsQuery = `SELECT Id FROM ${DB_SCHEMA}.OrcamentoItem WHERE IdOrcamento IN (${placeholders})`
        const idsRequest = pool.request()
        chunk.forEach((id, index) => {
          idsRequest.input(`id${index}`, sql.Int, id)
        })
        const idsResult = await idsRequest.query(idsQuery)
        const chunkIds = (idsResult.recordset || []).map((r) => r.Id)
        chunkIds.forEach((id) => allLegacyOrcamentoItemIds.add(id))
      }

      // COUNT direto no PostgreSQL
      const newOrcamentoItemCount = await prisma.orcamentoItem.count()
      console.info(`\n🔍 Verificando integridade de Itens de Orçamentos...`)
      console.info(`   Banco antigo (COUNT): ${totalLegacyOrcamentoItems} registros`)
      console.info(`   Banco novo (COUNT): ${newOrcamentoItemCount} registros`)

      if (totalLegacyOrcamentoItems === newOrcamentoItemCount) {
        console.info(`   ✅ Contagens idênticas - nenhuma perda de dados`)
      } else {
        console.warn(`   ⚠️  DIVERGÊNCIA DETECTADA: ${Math.abs(totalLegacyOrcamentoItems - newOrcamentoItemCount)} registros de diferença`)
        const newOrcamentoItemIds = new Set(
          (await prisma.orcamentoItem.findMany({ select: { id: true } })).map((r) => r.id)
        )
        const missingIds = Array.from(allLegacyOrcamentoItemIds).filter((id) => !newOrcamentoItemIds.has(id))
        if (missingIds.length > 0) {
          console.warn(`   ❌ ${missingIds.length} registros NÃO FORAM IMPORTADOS:`)
          missingIds.slice(0, 20).forEach((id) => {
            console.warn(`      - Item de orçamento ID ${id}`)
          })
          if (missingIds.length > 20) {
            console.warn(`      ... e mais ${missingIds.length - 20} registros`)
          }
        }
      }
    }

    // Verificar pedidos (apenas dos clientes importados)
    if (clientIdsForWhere.length > 0) {
      const MAX_PARAMS = 2000
      let totalLegacyPedidos = 0
      let allLegacyPedidoIds = new Set()

      for (let i = 0; i < clientIdsForWhere.length; i += MAX_PARAMS) {
        const chunk = clientIdsForWhere.slice(i, i + MAX_PARAMS)
        const pool = await sqlPool
        const placeholders = chunk.map((_, index) => `@id${index}`).join(",")
        const query = `
          SELECT p.Id
          FROM ${DB_SCHEMA}.Pedido p
          INNER JOIN ${DB_SCHEMA}.Orcamento o ON p.IdOrcamento = o.Id
          WHERE o.IdCliente IN (${placeholders})
        `
        const request = pool.request()
        chunk.forEach((id, index) => {
          request.input(`id${index}`, sql.Int, id)
        })
        const result = await request.query(query)
        const chunkIds = (result.recordset || []).map((r) => r.Id)
        totalLegacyPedidos += chunkIds.length
        chunkIds.forEach((id) => allLegacyPedidoIds.add(id))
      }

      const newPedidoCount = await prisma.pedido.count()
      console.info(`\n🔍 Verificando integridade de Pedidos...`)
      console.info(`   Banco antigo (de clientes importados): ${totalLegacyPedidos} registros`)
      console.info(`   Banco novo: ${newPedidoCount} registros`)

      if (totalLegacyPedidos === newPedidoCount) {
        console.info(`   ✅ Contagens idênticas - nenhuma perda de dados`)
      } else {
        console.warn(`   ⚠️  DIVERGÊNCIA DETECTADA: ${Math.abs(totalLegacyPedidos - newPedidoCount)} registros de diferença`)
        const newPedidoIds = new Set(
          (await prisma.pedido.findMany({ select: { id: true } })).map((r) => r.id)
        )
        const missingIds = Array.from(allLegacyPedidoIds).filter((id) => !newPedidoIds.has(id))
        if (missingIds.length > 0) {
          console.warn(`   ❌ ${missingIds.length} registros NÃO FORAM IMPORTADOS:`)
          missingIds.slice(0, 20).forEach((id) => {
            console.warn(`      - Pedido ID ${id}`)
          })
          if (missingIds.length > 20) {
            console.warn(`      ... e mais ${missingIds.length - 20} registros`)
          }
        }
      }
    }

    // Verificar itens de pedidos (apenas dos pedidos importados)
    const allPedidoIdsForVerification = await prisma.pedido.findMany({ select: { id: true } })
    const pedidoIdsForWhere = allPedidoIdsForVerification.map((p) => p.id)
    if (pedidoIdsForWhere.length > 0) {
      const MAX_PARAMS = 2000
      let totalLegacyPedidoItems = 0
      let allLegacyPedidoItemIds = new Set()

      for (let i = 0; i < pedidoIdsForWhere.length; i += MAX_PARAMS) {
        const chunk = pedidoIdsForWhere.slice(i, i + MAX_PARAMS)
        const pool = await sqlPool
        const placeholders = chunk.map((_, index) => `@id${index}`).join(",")
        // COUNT direto no SQL Server
        const countQuery = `SELECT COUNT(*) AS total FROM ${DB_SCHEMA}.PedidoItem WHERE IdPedido IN (${placeholders})`
        const countRequest = pool.request()
        chunk.forEach((id, index) => {
          countRequest.input(`id${index}`, sql.Int, id)
        })
        const countResult = await countRequest.query(countQuery)
        totalLegacyPedidoItems += countResult.recordset[0]?.total || 0

        // Buscar IDs para análise detalhada
        const idsQuery = `SELECT Id FROM ${DB_SCHEMA}.PedidoItem WHERE IdPedido IN (${placeholders})`
        const idsRequest = pool.request()
        chunk.forEach((id, index) => {
          idsRequest.input(`id${index}`, sql.Int, id)
        })
        const idsResult = await idsRequest.query(idsQuery)
        const chunkIds = (idsResult.recordset || []).map((r) => r.Id)
        chunkIds.forEach((id) => allLegacyPedidoItemIds.add(id))
      }

      // COUNT direto no PostgreSQL
      const newPedidoItemCount = await prisma.pedidoItem.count()
      console.info(`\n🔍 Verificando integridade de Itens de Pedidos...`)
      console.info(`   Banco antigo (COUNT): ${totalLegacyPedidoItems} registros`)
      console.info(`   Banco novo (COUNT): ${newPedidoItemCount} registros`)

      if (totalLegacyPedidoItems === newPedidoItemCount) {
        console.info(`   ✅ Contagens idênticas - nenhuma perda de dados`)
      } else {
        console.warn(`   ⚠️  DIVERGÊNCIA DETECTADA: ${Math.abs(totalLegacyPedidoItems - newPedidoItemCount)} registros de diferença`)
        const newPedidoItemIds = new Set(
          (await prisma.pedidoItem.findMany({ select: { id: true } })).map((r) => r.id)
        )
        const missingIds = Array.from(allLegacyPedidoItemIds).filter((id) => !newPedidoItemIds.has(id))
        if (missingIds.length > 0) {
          console.warn(`   ❌ ${missingIds.length} registros NÃO FORAM IMPORTADOS:`)
          missingIds.slice(0, 20).forEach((id) => {
            console.warn(`      - Item de pedido ID ${id}`)
          })
          if (missingIds.length > 20) {
            console.warn(`      ... e mais ${missingIds.length - 20} registros`)
          }
        }
      }
    }

    await resetImportSequences()
    return
  }

  // Se houver argumentos, são IDs específicos de clientes
  const clientIds = filteredArgs.map((arg) => {
    const id = Number.parseInt(arg, 10)
    if (Number.isNaN(id) || id <= 0) {
      throw new Error(`ID inválido: ${arg}`)
    }
    return id
  })

  console.info(`Modo: Importar clientes específicos`)
  console.info(`IDs: ${clientIds.join(", ")}`)

  // Buscar todos os dados de uma vez
  console.info(`\nBuscando todos os dados...`)
  const clients = await fetchAllClientsFromDb(1, clientIds.length, clientIds)
  console.info(`✓ ${clients.length} clientes buscados`)

  const clientIdsFound = clients.map((c) => c.Id)
  const budgets = await fetchAllBudgetsFromDb(clientIdsFound)
  console.info(`✓ ${budgets.length} orçamentos buscados`)

  const orcamentoIds = budgets.map((b) => b.Id)
  const budgetItems = await fetchAllBudgetItemsFromDb(orcamentoIds)
  console.info(`✓ ${budgetItems.length} itens de orçamentos buscados`)

  const orders = await fetchAllOrdersFromDb(clientIdsFound)
  console.info(`✓ ${orders.length} pedidos buscados`)

  const pedidoIds = orders.map((o) => o.Id)
  const orderItems = await fetchAllOrderItemsFromDb(pedidoIds)
  console.info(`✓ ${orderItems.length} itens de pedidos buscados`)

  // Importar tudo
  console.info(`\nImportando dados...`)

  const mappedClients = clients.map((legacy) => mapLegacyToNew(legacy)).filter(Boolean)
  const clientIdsToImport = mappedClients.map((c) => c.id)
  await prisma.client.deleteMany({
    where: { id: { in: clientIdsToImport } },
  })
  await prisma.client.createMany({
    data: mappedClients,
    skipDuplicates: true,
  })
  console.info(`✓ ${mappedClients.length} clientes importados`)

  // Buscar todos os IDs de clientes importados para validação (usado em múltiplos lugares)
  const importedClientIds = await prisma.client.findMany({
    select: { id: true },
  })
  const importedClientIdsSet = new Set(importedClientIds.map((c) => c.id))

  if (budgets.length > 0) {

    // Filtrar apenas orçamentos cujo cliente existe
    const validBudgets = budgets.filter((b) => importedClientIdsSet.has(b.IdCliente))

    if (validBudgets.length < budgets.length) {
      const skipped = budgets.length - validBudgets.length
      console.warn(`⚠️  ${skipped} orçamentos ignorados (cliente não existe)`)
    }

    if (validBudgets.length > 0) {
      const mappedBudgets = validBudgets.map((legacy) => mapLegacyBudget(legacy, legacy.IdCliente))
      const budgetIdsToImport = mappedBudgets.map((b) => b.id)
      await prisma.orcamento.deleteMany({
        where: { id: { in: budgetIdsToImport } },
      })
      await prisma.orcamento.createMany({
        data: mappedBudgets,
        skipDuplicates: true,
      })
      console.info(`✓ ${mappedBudgets.length} orçamentos importados`)
    }
  }

  if (budgetItems.length > 0) {
    const mappedBudgetItems = budgetItems.map((legacy) => mapLegacyOrcamentoItem(legacy))
    const itemIdsToImport = mappedBudgetItems.map((i) => i.id)
    await prisma.orcamentoItem.deleteMany({
      where: { id: { in: itemIdsToImport } },
    })
    await prisma.orcamentoItem.createMany({
      data: mappedBudgetItems,
      skipDuplicates: true,
    })
    console.info(`✓ ${mappedBudgetItems.length} itens de orçamentos importados`)
  }

  if (orders.length > 0) {
    // Filtrar apenas pedidos cujo cliente existe (usando Set já criado)
    const validOrders = []
    const invalidOrders = []

    for (const order of orders) {
      if (importedClientIdsSet.has(order.IdCliente)) {
        validOrders.push(order)
      } else {
        invalidOrders.push(order)
      }
    }

    if (invalidOrders.length > 0) {
      console.warn(`⚠️  ${invalidOrders.length} pedidos ignorados (cliente não existe):`)
      invalidOrders.forEach((o) => {
        console.warn(`   - Pedido ID ${o.Id}: clienteId ${o.IdCliente} não encontrado`)
      })
    }

    if (validOrders.length > 0) {
      const BATCH_SIZE = 10000
      const mappedOrders = []
      const failedOrders = []

      for (const legacy of validOrders) {
        try {
          const mapped = mapLegacyOrder(legacy, legacy.IdCliente)
          mappedOrders.push(mapped)
        } catch (error) {
          failedOrders.push({ order: legacy, error: error.message })
          console.error(`   ✗ Erro ao mapear pedido ID ${legacy.Id}: ${error.message}`)
        }
      }

      if (mappedOrders.length > 0) {
        for (let i = 0; i < mappedOrders.length; i += BATCH_SIZE) {
          const batch = mappedOrders.slice(i, i + BATCH_SIZE)
          const orderIdsToImport = batch.map((o) => o.id)

          try {
            await prisma.pedido.deleteMany({
              where: { id: { in: orderIdsToImport } },
            })
            await prisma.pedido.createMany({
              data: batch,
              skipDuplicates: true,
            })
            console.info(`✓ ${batch.length} pedidos importados`)
          } catch (error) {
            console.error(`✗ Erro ao importar batch de pedidos: ${error.message}`)
            console.error(`   IDs do batch: ${orderIdsToImport.slice(0, 10).join(", ")}...`)
          }
        }
      }

      if (failedOrders.length > 0) {
        console.warn(`⚠️  ${failedOrders.length} pedidos falharam no mapeamento`)
      }
    }
  }

  if (orderItems.length > 0) {
    const BATCH_SIZE = 10000
    const mappedOrderItems = []
    const failedItems = []

    for (const legacy of orderItems) {
      try {
        const mapped = mapLegacyPedidoItem(legacy)
        mappedOrderItems.push(mapped)
      } catch (error) {
        failedItems.push({ item: legacy, error: error.message })
        console.error(`   ✗ Erro ao mapear item de pedido ID ${legacy.Id}: ${error.message}`)
      }
    }

    if (mappedOrderItems.length > 0) {
      for (let i = 0; i < mappedOrderItems.length; i += BATCH_SIZE) {
        const batch = mappedOrderItems.slice(i, i + BATCH_SIZE)
        const itemIdsToImport = batch.map((item) => item.id)

        try {
          await prisma.pedidoItem.deleteMany({
            where: { id: { in: itemIdsToImport } },
          })
          await prisma.pedidoItem.createMany({
            data: batch,
            skipDuplicates: true,
          })
          console.info(`✓ ${batch.length} itens de pedidos importados`)
        } catch (error) {
          console.error(`✗ Erro ao importar batch de itens de pedidos: ${error.message}`)
          console.error(`   IDs do batch: ${itemIdsToImport.slice(0, 10).join(", ")}...`)
        }
      }
    }

    if (failedItems.length > 0) {
      console.warn(`⚠️  ${failedItems.length} itens de pedidos falharam no mapeamento`)
    }
  }

  console.info(`\n========== RESUMO FINAL ==========`)
  console.info(`Clientes importados: ${mappedClients.length}`)
  console.info(`Orçamentos importados: ${budgets.length}`)
  console.info(`Itens de orçamentos importados: ${budgetItems.length}`)
  console.info(`Pedidos importados: ${orders.length}`)
  console.info(`Itens de pedidos importados: ${orderItems.length}`)

  // ========== VERIFICAÇÃO DE INTEGRIDADE ==========
  console.info(`\n========== VERIFICAÇÃO DE INTEGRIDADE ==========`)

  // Verificar apenas os clientes importados
  if (clientIds.length > 0) {
    const clientIdsStr = clientIds.map((id) => `'${id}'`).join(",")
    const whereClause = `WHERE Id IN (${clientIds.join(",")})`
    await verifyTableIntegrity("Cliente", prisma.client, "id", whereClause, "Clientes (IDs específicos)")
  }

  // Verificar orçamentos, itens de orçamentos, pedidos e itens de pedidos dos clientes importados
  // (usar a mesma lógica do modo normal, mas apenas para os clientes específicos)
  const importedClientIdsForVerification = await prisma.client.findMany({
    where: { id: { in: clientIds } },
    select: { id: true }
  })
  const clientIdsForWhere = importedClientIdsForVerification.map((c) => c.id)

  if (clientIdsForWhere.length > 0) {
    // Verificar orçamentos
    const MAX_PARAMS = 2000
    let totalLegacyOrcamentos = 0
    let allLegacyOrcamentoIdsForSpecific = new Set()

    for (let i = 0; i < clientIdsForWhere.length; i += MAX_PARAMS) {
      const chunk = clientIdsForWhere.slice(i, i + MAX_PARAMS)
      const pool = await sqlPool
      const placeholders = chunk.map((_, index) => `@id${index}`).join(",")
      const query = `SELECT Id FROM ${DB_SCHEMA}.Orcamento WHERE IdCliente IN (${placeholders})`
      const request = pool.request()
      chunk.forEach((id, index) => {
        request.input(`id${index}`, sql.Int, id)
      })
      const result = await request.query(query)
      const chunkIds = (result.recordset || []).map((r) => r.Id)
      totalLegacyOrcamentos += chunkIds.length
      chunkIds.forEach((id) => allLegacyOrcamentoIdsForSpecific.add(id))
    }

    // COUNT direto no PostgreSQL
    const newOrcamentoCount = await prisma.orcamento.count({ where: { clienteId: { in: clientIdsForWhere } } })
    console.info(`\n🔍 Verificando integridade de Orçamentos (clientes específicos)...`)
    console.info(`   Banco antigo (COUNT): ${totalLegacyOrcamentos} registros`)
    console.info(`   Banco novo (COUNT): ${newOrcamentoCount} registros`)

    if (totalLegacyOrcamentos !== newOrcamentoCount) {
      console.warn(`   ⚠️  DIVERGÊNCIA DETECTADA: ${Math.abs(totalLegacyOrcamentos - newOrcamentoCount)} registros de diferença`)
    } else {
      console.info(`   ✅ Contagens idênticas`)
    }

    // Verificar itens de orçamentos, pedidos e itens de pedidos de forma similar
    // (simplificado para não repetir muito código)
    const allOrcamentoIdsForSpecific = Array.from(allLegacyOrcamentoIdsForSpecific)
    if (allOrcamentoIdsForSpecific.length > 0) {
      const pool = await sqlPool
      const MAX_PARAMS_ITEMS = 2000
      let totalLegacyOrcamentoItems = 0

      for (let i = 0; i < allOrcamentoIdsForSpecific.length; i += MAX_PARAMS_ITEMS) {
        const chunk = allOrcamentoIdsForSpecific.slice(i, i + MAX_PARAMS_ITEMS)
        const placeholders = chunk.map((_, index) => `@id${index}`).join(",")
        // COUNT direto no SQL Server
        const countQuery = `SELECT COUNT(*) AS total FROM ${DB_SCHEMA}.OrcamentoItem WHERE IdOrcamento IN (${placeholders})`
        const countRequest = pool.request()
        chunk.forEach((id, index) => {
          countRequest.input(`id${index}`, sql.Int, id)
        })
        const countResult = await countRequest.query(countQuery)
        totalLegacyOrcamentoItems += countResult.recordset[0]?.total || 0
      }

      // COUNT direto no PostgreSQL
      const newOrcamentoItemCount = await prisma.orcamentoItem.count({
        where: { orcamentoId: { in: allOrcamentoIdsForSpecific } }
      })
      console.info(`\n🔍 Verificando integridade de Itens de Orçamentos...`)
      console.info(`   Banco antigo (COUNT): ${totalLegacyOrcamentoItems} registros`)
      console.info(`   Banco novo (COUNT): ${newOrcamentoItemCount} registros`)
      if (totalLegacyOrcamentoItems === newOrcamentoItemCount) {
        console.info(`   ✅ Contagens idênticas`)
      } else {
        console.warn(`   ⚠️  DIVERGÊNCIA: ${Math.abs(totalLegacyOrcamentoItems - newOrcamentoItemCount)} registros`)
      }
    }

    // Verificar pedidos
    let totalLegacyPedidos = 0
    let allLegacyPedidoIdsForSpecific = new Set()

    for (let i = 0; i < clientIdsForWhere.length; i += MAX_PARAMS) {
      const chunk = clientIdsForWhere.slice(i, i + MAX_PARAMS)
      const pool = await sqlPool
      const placeholders = chunk.map((_, index) => `@id${index}`).join(",")
      // COUNT direto no SQL Server
      const countQuery = `
        SELECT COUNT(*) AS total
        FROM ${DB_SCHEMA}.Pedido p
        INNER JOIN ${DB_SCHEMA}.Orcamento o ON p.IdOrcamento = o.Id
        WHERE o.IdCliente IN (${placeholders})
      `
      const countRequest = pool.request()
      chunk.forEach((id, index) => {
        countRequest.input(`id${index}`, sql.Int, id)
      })
      const countResult = await countRequest.query(countQuery)
      totalLegacyPedidos += countResult.recordset[0]?.total || 0

      // Buscar IDs para análise detalhada
      const idsQuery = `
        SELECT p.Id
        FROM ${DB_SCHEMA}.Pedido p
        INNER JOIN ${DB_SCHEMA}.Orcamento o ON p.IdOrcamento = o.Id
        WHERE o.IdCliente IN (${placeholders})
      `
      const idsRequest = pool.request()
      chunk.forEach((id, index) => {
        idsRequest.input(`id${index}`, sql.Int, id)
      })
      const idsResult = await idsRequest.query(idsQuery)
      const chunkIds = (idsResult.recordset || []).map((r) => r.Id)
      chunkIds.forEach((id) => allLegacyPedidoIdsForSpecific.add(id))
    }

    // COUNT direto no PostgreSQL
    const newPedidoCount = await prisma.pedido.count({ where: { clienteId: { in: clientIdsForWhere } } })
    console.info(`\n🔍 Verificando integridade de Pedidos...`)
    console.info(`   Banco antigo (COUNT): ${totalLegacyPedidos} registros`)
    console.info(`   Banco novo (COUNT): ${newPedidoCount} registros`)
    if (totalLegacyPedidos === newPedidoCount) {
      console.info(`   ✅ Contagens idênticas`)
    } else {
      console.warn(`   ⚠️  DIVERGÊNCIA: ${Math.abs(totalLegacyPedidos - newPedidoCount)} registros`)
    }

    // Verificar itens de pedidos
    const allPedidoIdsArrayForSpecific = Array.from(allLegacyPedidoIdsForSpecific)
    if (allPedidoIdsArrayForSpecific.length > 0) {
      const pool = await sqlPool
      let totalLegacyPedidoItems = 0

      for (let i = 0; i < allPedidoIdsArrayForSpecific.length; i += MAX_PARAMS_ITEMS) {
        const chunk = allPedidoIdsArrayForSpecific.slice(i, i + MAX_PARAMS_ITEMS)
        const placeholders = chunk.map((_, index) => `@id${index}`).join(",")
        // COUNT direto no SQL Server
        const countQuery = `SELECT COUNT(*) AS total FROM ${DB_SCHEMA}.PedidoItem WHERE IdPedido IN (${placeholders})`
        const countRequest = pool.request()
        chunk.forEach((id, index) => {
          countRequest.input(`id${index}`, sql.Int, id)
        })
        const countResult = await countRequest.query(countQuery)
        totalLegacyPedidoItems += countResult.recordset[0]?.total || 0
      }

      // COUNT direto no PostgreSQL
      const newPedidoItemCount = await prisma.pedidoItem.count({
        where: { pedidoId: { in: allPedidoIdsArrayForSpecific } }
      })
      console.info(`\n🔍 Verificando integridade de Itens de Pedidos...`)
      console.info(`   Banco antigo (COUNT): ${totalLegacyPedidoItems} registros`)
      console.info(`   Banco novo (COUNT): ${newPedidoItemCount} registros`)
      if (totalLegacyPedidoItems === newPedidoItemCount) {
        console.info(`   ✅ Contagens idênticas`)
      } else {
        console.warn(`   ⚠️  DIVERGÊNCIA: ${Math.abs(totalLegacyPedidoItems - newPedidoItemCount)} registros`)
      }
    }
  }

  await resetImportSequences()
}

main()
  .catch((error) => {
    console.error("Erro durante importação:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })



