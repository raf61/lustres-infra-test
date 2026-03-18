const sql = require("mssql")
const { PrismaClient } = require("@prisma/client")
const { parseISO, parse } = require("date-fns")
const { resetSequences } = require("./utils/reset-sequences")

const prisma = new PrismaClient()

// Configuração do SQL Server (legado)
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

const DB_SCHEMA = process.env.SQL_SERVER_SCHEMA ?? "sistema.dbo"
const DEFAULT_PAGE_SIZE = Number(process.env.LEGACY_PAGE_SIZE ?? "10000")

function toFloat(value) {
  if (value === null || value === undefined) return null
  const num = Number.parseFloat(
    value
      .replace(/\./g, "")   // remove separador de milhar
      .replace(",", ".")   // troca vírgula por ponto
  );
  return Number.isNaN(num) ? null : num
}

const LEGACY_OFFSET_MIN = 180 // -03:00
const isValidDate = (d) => d instanceof Date && !Number.isNaN(d.getTime())

function parseDate(value) {
  if (!value) return null

  // Se já é Date, aplicar +3h (legado é wall-time -03) e manter horário.
  if (value instanceof Date && isValidDate(value)) {
    return new Date(value.getTime() + LEGACY_OFFSET_MIN * 60 * 1000)
  }

  const str = String(value).trim()
  if (!str) return null

  // Strings com offset/Z: respeitar o offset informado (sem ajuste extra)
  if (/[+-]\d{2}:?\d{2}|Z$/i.test(str)) {
    const d = parseISO(str)
    return isValidDate(d) ? d : null
  }

  // ISO date-only
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = parse(str, "yyyy-MM-dd", new Date())
    if (isValidDate(d)) return d
  }

  // dd/mm/yyyy
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) {
    const [, d, mo, y] = m
    const dt = new Date(Number(y), Number(mo) - 1, Number(d))
    if (isValidDate(dt)) return dt
  }

  // ISO datetime sem offset: tratar como wall-time -03, somando +3h
  const isoNoOffset = ["yyyy-MM-dd'T'HH:mm:ss.SSS", "yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd HH:mm:ss"]
  for (const p of isoNoOffset) {
    const parsed = parse(str, p, new Date())
    if (isValidDate(parsed)) return parsed
  }

  return null
}

// ---------------- Dados Cadastrais ----------------
function mapLegacyToDadosCad(legacy) {
  return {
    id: legacy.Id,
    idUser: String(legacy.IdPessoa),
    cpf: legacy.Cpf ?? "",
    cep: legacy.Cep ?? "",
    logradouro: legacy.Logradouro ?? null,
    numero: legacy.Numero ?? null,
    complemento: legacy.Complemento ?? null,
    bairro: legacy.Bairro ?? null,
    cidade: legacy.Cidade ?? null,
    estado: legacy.Estado ?? null,
    telefone: legacy.Telefone ?? null,
    celular: legacy.Celular ?? null,
    banco: legacy.Banco ?? null,
    agencia: legacy.Agencia ?? null,
    conta: legacy.Conta ?? null,
    metaMin: toFloat(legacy.MetaAte),
    metaMinPerc: toFloat(legacy.MetaAtePerc),
    metaNormal: toFloat(legacy.MetaAcima),
    metaNormalPerc: toFloat(legacy.MetaAcimaPerc),
    observacao: legacy.Observacao ?? null,
    salario: null,
  }
}

async function fetchLegacyFuncionarios(page, pageSize) {

  const pool = await sql.connect(SQL_SERVER_CONFIG)
  try {
    const offset = (page - 1) * pageSize
    const request = pool.request()
    request.input("offset", sql.Int, offset)
    request.input("pageSize", sql.Int, pageSize)
    const query = `
      SELECT
        f.Id, f.IdPessoa, f.Cpf, f.Cep, f.Logradouro, f.Numero, f.Complemento, f.Bairro, f.Cidade, f.Estado,
        f.Telefone, f.Celular, f.Banco, f.Agencia, f.Conta, f.MetaAte, f.MetaAtePerc, f.MetaAcima, f.MetaAcimaPerc,
        f.Observacao
      FROM ${DB_SCHEMA}.Funcionario f
      ORDER BY f.Id
      OFFSET @offset ROWS
      FETCH NEXT @pageSize ROWS ONLY
    `
    const result = await request.query(query)
    return result.recordset || []
  } finally {
    await pool.close()
  }
}

async function countLegacyFuncionarios() {
  const pool = await sql.connect(SQL_SERVER_CONFIG)
  try {
    const query = `SELECT COUNT(1) as total FROM ${DB_SCHEMA}.Funcionario`
    const result = await pool.request().query(query)
    return result.recordset?.[0]?.total ?? 0
  } finally {
    await pool.close()
  }
}

async function importDadosCadastrais() {
  let total = 0
  let page = 1
  const totalRegistros = await countLegacyFuncionarios().catch(() => null)
  if (totalRegistros !== null) {
    console.log(`▶️  Importando dados cadastrais: ${totalRegistros} registros no legado`)
  } else {
    console.log("▶️  Importando dados cadastrais (total desconhecido)")
  }
  while (true) {
    const funcionarios = await fetchLegacyFuncionarios(page, DEFAULT_PAGE_SIZE)
    if (funcionarios.length === 0) break

    const mapped = funcionarios.map(mapLegacyToDadosCad).filter((m) => m.idUser && m.cpf && m.cep)

    const userIds = [...new Set(mapped.map((m) => m.idUser))]
    const existingUsers = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true } })
    const existingIds = new Set(existingUsers.map((u) => u.id))
    const valid = mapped.filter((m) => {
      if (!existingIds.has(m.idUser)) {
        console.warn(`❌ Dados cadastrais pulado: user ${m.idUser} não encontrado (func ${m.id})`)
        return false
      }
      return true
    })

    const batch = valid

    try {
      const res = await prisma.userDadosCadastrais.createMany({ data: batch, skipDuplicates: true })
      total += res.count
    } catch (err) {
      console.error("⚠️  createMany dados cadastrais falhou, fallback item a item:", err.message ?? err)
      for (const m of batch) {
        try {
          await prisma.userDadosCadastrais.upsert({
            where: { id: m.id },
            update: m,
            create: m,
          })
          total += 1
        } catch (e) {
          console.error(`❌ Erro ao gravar dados cadastrais func ${m.id} (user ${m.idUser}):`, e.message ?? e)
        }
      }
    }

    page += 1
  }
  console.log(`🎉 Dados cadastrais finalizado. Total: ${total}`)
}

// ---------------- Lançamentos ----------------
function mapLegacyLancamento(legacy) {
  return {
    id: legacy.Id,
    userId: String(legacy.IdPessoa),
    data: parseDate(legacy.Data),
    descricao: legacy.Descricao ?? "",
    valor: legacy.Valor !== null && legacy.Valor !== undefined ? Number(legacy.Valor) : null,
    tipo: legacy.Tipo ?? "Despesa",
  }
}

async function fetchLegacyLancamentos(page, pageSize) {
  const pool = await sql.connect(SQL_SERVER_CONFIG)
  try {
    const offset = (page - 1) * pageSize
    const request = pool.request()
    request.input("offset", sql.Int, offset)
    request.input("pageSize", sql.Int, pageSize)
    const query = `
      SELECT
        fl.Id,
        fl.IdFuncionario,
        fl.Data,
        fl.Descricao,
        fl.Valor,
        fl.Tipo,
        f.IdPessoa
      FROM ${DB_SCHEMA}.FuncionarioLancamento fl
      INNER JOIN ${DB_SCHEMA}.Funcionario f ON f.Id = fl.IdFuncionario
      ORDER BY fl.Id
      OFFSET @offset ROWS
      FETCH NEXT @pageSize ROWS ONLY
    `
    const result = await request.query(query)
    return result.recordset || []
  } finally {
    await pool.close()
  }
}

async function countLegacyLancamentos() {
  const pool = await sql.connect(SQL_SERVER_CONFIG)
  try {
    const query = `SELECT COUNT(1) as total FROM ${DB_SCHEMA}.FuncionarioLancamento`
    const result = await pool.request().query(query)
    return result.recordset?.[0]?.total ?? 0
  } finally {
    await pool.close()
  }
}

async function importLancamentos() {
  let total = 0
  let page = 1
  const totalRegistros = await countLegacyLancamentos().catch(() => null)
  if (totalRegistros !== null) {
    console.log(`▶️  Importando lançamentos: ${totalRegistros} registros no legado`)
  } else {
    console.log("▶️  Importando lançamentos (total desconhecido)")
  }
  while (true) {
    const lancs = await fetchLegacyLancamentos(page, DEFAULT_PAGE_SIZE)
    if (lancs.length === 0) break

    const mapped = lancs.map(mapLegacyLancamento).filter((m) => m.userId && m.descricao)

    const userIds = [...new Set(mapped.map((m) => m.userId))]
    const existingUsers = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true } })
    const existingIds = new Set(existingUsers.map((u) => u.id))

    const valid = mapped.filter((m) => {
      if (!existingIds.has(m.userId)) {
        console.warn(`❌ Lançamento pulado: user ${m.userId} não encontrado (lanc ${m.id})`)
        return false
      }
      return true
    })

    const batch = valid

    try {
      const res = await prisma.userLancamento.createMany({ data: batch, skipDuplicates: true })
      total += res.count
    } catch (err) {
      console.error("⚠️  createMany lançamentos falhou, fallback item a item:", err.message ?? err)
      for (const m of batch) {
        try {
          await prisma.userLancamento.upsert({
            where: { id: m.id },
            update: m,
            create: m,
          })
          total += 1
        } catch (e) {
          console.error(`❌ Erro ao gravar lançamento ${m.id} (user ${m.userId}):`, e.message ?? e)
        }
      }
    }

    page += 1
  }
  console.log(`🎉 Lançamentos finalizado. Total: ${total}`)
}

// ---------------- Comissões ----------------
function mapLegacyComissao(legacy) {

  return {
    data: {
      id: legacy.Id,
      createdAt: parseDate(legacy.Data),
      vencimento: parseDate(legacy.Vencimento),
      pedidoId: legacy.IdPedido ?? null,
      valor: legacy.Valor !== null && legacy.Valor !== undefined ? Number(legacy.Valor) : null,
    },
    pago: legacy.Pago === true || legacy.Pago === 1,
    pagamento: legacy.Pagamento ? new Date(legacy.Pagamento) : null,
  }
}

async function fetchLegacyComissoes(page, pageSize) {
  const pool = await sql.connect(SQL_SERVER_CONFIG)
  try {
    const offset = (page - 1) * pageSize
    const request = pool.request()
    request.input("offset", sql.Int, offset)
    request.input("pageSize", sql.Int, pageSize)
    const query = `
      SELECT
        Id,
        Data,
        Vencimento,
        IdPedido,
        Valor,
        Pago,
        Pagamento
      FROM ${DB_SCHEMA}.Comissao
      ORDER BY Id
      OFFSET @offset ROWS
      FETCH NEXT @pageSize ROWS ONLY
    `
    const result = await request.query(query)
    return result.recordset || []
  } finally {
    await pool.close()
  }
}

async function countLegacyComissoes() {
  const pool = await sql.connect(SQL_SERVER_CONFIG)
  try {
    const query = `SELECT COUNT(1) as total FROM ${DB_SCHEMA}.Comissao`
    const result = await pool.request().query(query)
    return result.recordset?.[0]?.total ?? 0
  } finally {
    await pool.close()
  }
}

async function importComissoes() {
  let total = 0
  let totalContas = 0
  let page = 1
  let categoriaComissaoId = null
  try {
    const cat = await prisma.contaPagarCategoria.findFirst({ where: { nome: "Comissões" } })
    if (cat) {
      categoriaComissaoId = cat.id
    } else {
      const created = await prisma.contaPagarCategoria.create({ data: { nome: "Comissões" } })
      categoriaComissaoId = created.id
    }
  } catch (e) {
    console.error("⚠️  Não foi possível garantir categoria 'Comissões':", e.message ?? e)
  }
  const totalRegistros = await countLegacyComissoes().catch(() => null)
  if (totalRegistros !== null) {
    console.log(`▶️  Importando comissões: ${totalRegistros} registros no legado`)
  } else {
    console.log("▶️  Importando comissões (total desconhecido)")
  }
  while (true) {
    const comissoes = await fetchLegacyComissoes(page, DEFAULT_PAGE_SIZE)
    if (comissoes.length === 0) break

    const mapped = comissoes
      .map(mapLegacyComissao)
      .filter((c) => c.data.createdAt && c.data.vencimento && c.data.pedidoId !== null && c.data.valor !== null)

    const pedidoIds = [...new Set(mapped.map((c) => Number(c.data.pedidoId)).filter((n) => Number.isInteger(n)))]
    const existingPedidos = await prisma.pedido.findMany({
      where: { id: { in: pedidoIds } },
      select: { id: true },
    })
    const existingPedidoIds = new Set(existingPedidos.map((p) => p.id))

    const valid = mapped.filter((c) => {
      if (!existingPedidoIds.has(c.data.pedidoId)) {
        console.warn(`❌ Comissão ${c.data.id} pulada: pedido ${c.data.pedidoId} não encontrado`)
        return false
      }
      return true
    })

    let vendedoresPorPedido = new Map()
    try {
      const pedidosComVendedor = await prisma.pedido.findMany({
        where: { id: { in: pedidoIds } },
        select: {
          id: true,
          orcamento: {
            select: {
              vendedor: {
                select: { fullname: true, name: true },
              },
            },
          },
          vendedor: { select: { fullname: true, name: true } },
        },
      })
      vendedoresPorPedido = new Map(
        pedidosComVendedor.map((p) => {
          const nome =
            p.orcamento?.vendedor?.fullname ??
            p.orcamento?.vendedor?.name ??
            p.vendedor?.fullname ??
            p.vendedor?.name ??
            "Vendedor"
          return [p.id, nome]
        }),
      )
    } catch (e) {
      console.error("⚠️  Falha ao buscar vendedores para pedidos:", e.message ?? e)
    }

    const comissoesBatch = valid.map((c) => c.data)
    const contasBatch = valid.map((c) => {
      const pago = c.pago === true
      const pagamento = c.pagamento ?? null
      const vendedorNome = vendedoresPorPedido.get(c.data.pedidoId) ?? "Vendedor"
      return {
        descricao: `Comissão pedido #${c.data.pedidoId} - ${vendedorNome}`,
        categoriaId: categoriaComissaoId,
        valor: c.data.valor,
        status: pago ? 1 : 0,
        vencimento: c.data.vencimento,
        pagoEm: pago ? pagamento ?? c.data.vencimento : null,
        comissaoId: c.data.id,
      }
    })

    try {
      const res = await prisma.comissao.createMany({ data: comissoesBatch, skipDuplicates: true })
      total += res.count
      console.log(`✅ Comissões importadas (parcial): +${res.count} (total ${total})`)
    } catch (err) {
      console.error("⚠️  createMany comissões falhou, fallback item a item:", err.message ?? err)
      for (const m of comissoesBatch) {
        try {
          await prisma.comissao.upsert({
            where: { id: m.id },
            update: m,
            create: m,
          })
          total += 1
        } catch (e) {
          console.error(`❌ Erro ao gravar comissão ${m.id} (pedido ${m.pedidoId}):`, e.message ?? e)
        }
      }
    }

    try {
      const resConta = await prisma.contaPagar.createMany({ data: contasBatch, skipDuplicates: true })
      totalContas += resConta.count
      console.log(`✅ Contas a pagar de comissão importadas (parcial): +${resConta.count} (total ${totalContas})`)
    } catch (err) {
      console.error("⚠️  createMany contas a pagar (comissões) falhou, fallback item a item:", err.message ?? err)
      for (const m of contasBatch) {
        try {
          await prisma.contaPagar.create({
            data: m,
          })
          totalContas += 1
        } catch (e) {
          console.error(`❌ Erro ao gravar conta de comissão (comissaoId ${m.comissaoId}):`, e.message ?? e)
        }
      }
    }

    page += 1
  }
  console.log(`🎉 Comissões finalizado. Total: ${total}. Contas de comissão: ${totalContas}`)
}

async function main() {
  const args = process.argv.slice(2)

  const onlyComissoes = args.includes("--only-comissoes")
  const skipDadosCadastrais = args.includes("--skip-dados-cadastrais")
  const skipLancamentos = args.includes("--skip-lancamentos")

  if (onlyComissoes) {
    console.log("🎯 Modo: Importar APENAS comissões")
    await importComissoes()
    await resetSequences(prisma, ["Comissao", "ContaPagar", "ContaPagarCategoria"])
    return
  }

  if (!skipDadosCadastrais) {
    await importDadosCadastrais()
  } else {
    console.log("⏭️  Pulando dados cadastrais (--skip-dados-cadastrais)")
  }

  if (!skipLancamentos) {
    await importLancamentos()
  } else {
    console.log("⏭️  Pulando lançamentos (--skip-lancamentos)")
  }

  await importComissoes()
  await resetSequences(prisma, ["UserLancamento", "Comissao", "ContaPagar", "ContaPagarCategoria"])
}

main()
  .catch((err) => {
    console.error("Erro na importação:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

