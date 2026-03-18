/* eslint-disable no-console */
function quoteIdent(ident) {
    // "Pedido" -> ""Pedido"" (escape) e envolve com aspas duplas
    return `"${String(ident).replace(/"/g, '""')}"`
  }
  
  function quoteLiteral(str) {
    // string literal SQL segura (pra pg_get_serial_sequence)
    return `'${String(str).replace(/'/g, "''")}'`
  }
  
  async function resetTableSequence(prisma, tableName, idColumn = "id") {
    const qTable = quoteIdent(tableName)
    const qCol = quoteIdent(idColumn)
  
    // string literal precisa conter o nome qualificado e com aspas duplas se houver maiúsculas
    const seqTableArg = quoteLiteral(qTable)     // ex: '"Pedido"' (com aspas duplas DENTRO da string)
    const seqColArg = quoteLiteral(idColumn)     // coluna é passada sem aspas duplas aqui, só texto 'id'
  
    const query = `
      SELECT setval(
        pg_get_serial_sequence(${seqTableArg}, ${seqColArg}),
        COALESCE((SELECT MAX(${qCol}) FROM ${qTable}), 0),
        true
      );
    `
  
    console.log(query)
    await prisma.$executeRawUnsafe(query)
    console.info(`🔄 Sequence resetada: ${tableName}.${idColumn}`)
  }
  
  async function resetSequences(prisma, tables) {
    for (const t of tables) {
      if (typeof t === "string") {
        await resetTableSequence(prisma, t)
      } else {
        await resetTableSequence(prisma, t, "id")
      }
    }
  }
  
  module.exports = {
    resetTableSequence,
    resetSequences,
  }