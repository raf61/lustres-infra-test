/**
 * Script para testar a geração dos 3 documentos operacionais
 * Execute com: npx ts-node --skip-project test-documents.ts
 * 
 * IMPORTANTE: Ajuste os IDs abaixo para valores existentes no seu banco de dados
 */

import { generateTermoConclusaoPdf } from "./lib/documents/termo-conclusao"
import { generateLaudoTecnicoPdf } from "./lib/documents/laudo-tecnico"
import { generateRelatorioVistoriaPdf } from "./lib/documents/relatorio-vistoria"
import { prisma } from "./lib/prisma"
import { storage } from "./lib/storage"

async function getSignedUrl(url: string | null): Promise<string | null> {
  if (!url) return null
  return await storage.getDownloadUrlFromStoredUrl(url, 3600) // 1 hora de validade
}

async function findTestIds() {
  // Busca um documento operacional existente para teste do termo de conclusão
  const documento = await prisma.documentoOperacional.findFirst({
    where: { tipo: "TERMO_CONCLUSAO" },
    orderBy: { createdAt: "desc" },
    select: { id: true, pedidoId: true },
  })

  // Busca um pedido existente para teste do laudo técnico
  const pedido = await prisma.pedido.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })

  // Busca uma visita técnica existente para teste do relatório de vistoria
  const visita = await prisma.visitaTecnica.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, pedidoId: true },
  })

  return { documento, pedido, visita }
}

export async function main() {
  console.log("🔍 Buscando IDs para teste...")

  const { documento, pedido, visita } = await findTestIds()

  console.log("\n📋 IDs encontrados:")
  console.log(`   Documento (Termo): ${documento?.id ?? "não encontrado"}`)
  console.log(`   Pedido (Laudo): ${pedido?.id ?? "não encontrado"}`)
  console.log(`   Visita (Relatório): ${visita?.id ?? "não encontrada"} (pedidoId: ${visita?.pedidoId ?? "?"})`)

  // ============================================
  // 1. TERMO DE CONCLUSÃO
  // ============================================
  if (documento?.id) {
    console.log("\n📄 Gerando Termo de Conclusão...")
    try {
      const termoUrl = await generateTermoConclusaoPdf({ documentoId: documento.id })
      if (termoUrl) {
        const signedUrl = await getSignedUrl(termoUrl)
        console.log(`   ✅ Termo gerado!`)
        console.log(`   📎 URL armazenada: ${termoUrl}`)
        console.log(`   🔗 URL para download: ${signedUrl}`)
      } else {
        console.log("   ⚠️ Termo não gerado (dados insuficientes)")
      }
    } catch (err) {
      console.error("   ❌ Erro ao gerar termo:", err)
    }
  } else {
    console.log("\n⚠️ Pulando Termo de Conclusão (sem documento encontrado)")
  }

  // ============================================
  // 2. LAUDO TÉCNICO
  // ============================================
  if (pedido?.id) {
    console.log("\n📄 Gerando Laudo Técnico...")
    try {
      const laudoUrl = await generateLaudoTecnicoPdf({ pedidoId: 1 })
      if (laudoUrl) {
        const signedUrl = await getSignedUrl(laudoUrl)
        console.log(`   ✅ Laudo gerado!`)
        console.log(`   📎 URL armazenada: ${laudoUrl}`)
        console.log(`   🔗 URL para download: ${signedUrl}`)
      } else {
        console.log("   ⚠️ Laudo não gerado (dados insuficientes)")
      }
    } catch (err) {
      console.error("   ❌ Erro ao gerar laudo:", err)
    }
  } else {
    console.log("\n⚠️ Pulando Laudo Técnico (sem pedido encontrado)")
  }

  // ============================================
  // 3. RELATÓRIO DE VISTORIA
  // ============================================
  if (visita?.id && visita?.pedidoId) {
    console.log("\n📄 Gerando Relatório de Vistoria...")
    try {
      const relatorioUrl = await generateRelatorioVistoriaPdf({
        pedidoId: 32307,
        visitaId: 224,
      })
      if (relatorioUrl) {
        const signedUrl = await getSignedUrl(relatorioUrl)
        console.log(`   ✅ Relatório gerado!`)
        console.log(`   📎 URL armazenada: ${relatorioUrl}`)
        console.log(`   🔗 URL para download: ${signedUrl}`)
      } else {
        console.log("   ⚠️ Relatório não gerado (dados insuficientes)")
      }
    } catch (err) {
      console.error("   ❌ Erro ao gerar relatório:", err)
    }
  } else {
    console.log("\n⚠️ Pulando Relatório de Vistoria (sem visita encontrada)")
  }

  console.log("\n✨ Teste finalizado!")
}

main()
  .catch((err) => {
    console.error("Erro fatal:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

