import { generatePropostaOrcamentoPdf } from "./lib/documents/proposta-orcamento"
import fs from "node:fs/promises"
import path from "node:path"

async function main() {
    console.log("🚀 Iniciando teste de geração de Proposta (Main function)...")

    const input = {
        empresa: "EBR" as const,
        razaoSocial: "CONDOMÍNIO VILLAGE DAS PALMEIRAS",
        cnpj: "12.345.678/0001-90",
        endereco: "Rua das Flores, 123 - Centro, Rio de Janeiro - RJ",
        vocativo: "SÍNDICO E CORPO DIRETIVO",
        valorUnitario: 500,
        subtotal: 500,
        numeroParcelas: 5,
        garantiaMeses: 12,
        consultorNome: "Rafael Antunes",
        consultorCelular: "21 99999-9999",
        consultorEmail: "rafael@sistemaebr.com.br",
        cnpjEmpresa: "11.222.333/0001-44", // CNPJ Dinâmico da Filial/EBR
        data: "06/03/2026",
        conclusaoDias: 10,
        produto: "Manutenção em SPDA",
        valorPorEquipamento: 1,
        primeiraParcela: "10 de Abril de 2026"
    }

    try {
        const buffer = await generatePropostaOrcamentoPdf(input)
        const outputPath = path.resolve("./test-proposta-main.pdf")
        await fs.writeFile(outputPath, buffer)
        console.log(`✅ Proposta gerada com sucesso em: ${outputPath}`)
    } catch (error) {
        console.error("❌ Erro ao gerar proposta:", error)
    }
}

main().catch(console.error)
