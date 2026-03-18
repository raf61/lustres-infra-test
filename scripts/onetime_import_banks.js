const { PrismaClient } = require("@prisma/client")

// Fix para erro "prepared statement s0 already exists" (PgBouncer/Supabase)
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("pgbouncer=true")) {
  const separator = process.env.DATABASE_URL.includes("?") ? "&" : "?"
  process.env.DATABASE_URL = `${process.env.DATABASE_URL}${separator}pgbouncer=true`
  console.log("🔧 Ajustando conexão para modo PgBouncer (pgbouncer=true)")
}

const prisma = new PrismaClient()

// Dados estáticos trazidos do legado (Itaú/Santander x Franklin/EBR e Assertiva)
const BANCOS = [
  {
    nome: "Itau - Franklin/EBR",
    razaoSocial: "Franklin Instalacoes de Pararaios LTDA",
    cnpj: "27.552.196/0001-83",
    bancoCodigo: 341,
    agencia: "0309",
    agenciaDigito: "",
    conta: "99676",
    contaDigito: "7",
    carteira: "109",
    codigoBeneficiario: "123",
    codigoTransmissao: null,
    endereco: {
      logradouro: "R DIAS DA CRUZ",
      numero: "685",
      bairro: "MEIER",
      cidade: "RIO DE JANEIRO",
      uf: "RJ",
      cep: "20720-011",
      complemento: "",
    },

  },
  {
    nome: "Itau - Assertiva",
    razaoSocial: "SISTEMA DE COBRANCAS ASSERTIVAS LTDA",
    cnpj: "54.229.821/0001-23",
    bancoCodigo: 341,
    agencia: "0309",
    agenciaDigito: "",
    conta: "98957",
    contaDigito: "2",
    carteira: "109",
    codigoBeneficiario: "123",
    codigoTransmissao: null,
    endereco: {
      logradouro: "R BARAO DE MESQUITA",
      numero: "950",
      bairro: "GRAJAU",
      cidade: "RIO DE JANEIRO",
      uf: "RJ",
      cep: "20540-004",
      complemento: "LOJA 5 INTERNA",
    },
  },
  {
    nome: "Santander - Franklin/EBR",
    razaoSocial: "Franklin Instalacoes de Pararaios LTDA",
    cnpj: "27.552.196/0001-83",
    bancoCodigo: 33,
    agencia: "3957",
    agenciaDigito: "",
    conta: "13004240",
    contaDigito: "8",
    carteira: "101",
    codigoBeneficiario: "0138979",
    codigoTransmissao: "395700000138979",
    endereco: {
      logradouro: "R DIAS DA CRUZ",
      numero: "685",
      bairro: "MEIER",
      cidade: "RIO DE JANEIRO",
      uf: "RJ",
      cep: "20720-011",
      complemento: "",
    },
  },
  {
    nome: "Santander - Assertiva",
    razaoSocial: "SISTEMA DE COBRANCAS ASSERTIVA",
    cnpj: "54.229.821/0001-23",
    bancoCodigo: 33,
    agencia: "3455",
    agenciaDigito: "",
    conta: "13007504",
    contaDigito: "1",
    carteira: "101",
    codigoBeneficiario: "619509",
    codigoTransmissao: "345500000619509",
    endereco: {
      logradouro: "R BARAO DE MESQUITA",
      numero: "950",
      bairro: "GRAJAU",
      cidade: "RIO DE JANEIRO",
      uf: "RJ",
      cep: "20540-004",
      complemento: "LOJA 5 INTERNA",
    },

  },
]

async function upsertBancoWithId(id, data) {
  // Primeiro tenta deletar se existir com esse ID (para garantir a ordem)
  await prisma.banco.deleteMany({ where: { id } })

  // Cria com o ID específico
  await prisma.banco.create({
    data: {
      id,
      nome: data.nome,
      razaoSocial: data.razaoSocial,
      cnpj: data.cnpj,
      bancoCodigo: data.bancoCodigo,
      agencia: data.agencia,
      agenciaDigito: data.agenciaDigito,
      conta: data.conta,
      contaDigito: data.contaDigito,
      carteira: data.carteira,
      codigoBeneficiario: data.codigoBeneficiario,
      codigoTransmissao: data.codigoTransmissao,
      endereco: data.endereco,
    },
  })
  console.info(`✅ Banco criado com ID ${id}: ${data.nome}`)
}

async function main() {
  console.info("Iniciando importação de bancos do legado...")
  console.info("⚠️  IDs serão forçados: 1, 2, 3, 4 na ordem da lista")

  // Deleta todos os bancos existentes primeiro (para evitar conflitos)
  await prisma.banco.deleteMany({})
  console.info("🗑️  Bancos existentes removidos")

  // Cria cada banco com ID específico (1, 2, 3, 4)
  for (let i = 0; i < BANCOS.length; i++) {
    const id = i + 1 // IDs: 1, 2, 3, 4
    await upsertBancoWithId(id, BANCOS[i])
  }

  // Reseta a sequence do PostgreSQL para continuar após o último ID
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Banco"', 'id'), ${BANCOS.length}, true)`)
  console.info(`🔄 Sequence resetada para ${BANCOS.length}`)

  console.info("✅ Concluído.")
}

main()
  .catch((error) => {
    console.error("Erro na importação de bancos:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

