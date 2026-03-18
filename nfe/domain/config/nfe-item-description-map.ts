
/**
 * Mapeamento de descrições de itens para Nota Fiscal.
 * Permite transformar o nome interno do sistema em um nome mais formal para a NF.
 * A busca é CASE INSENSITIVE.
 */

export function getItemNfeDescription(item: any): string {
    // Tenta pegar o nome do item (seja do relacionamento ou direto)
    const nomeOriginal = (item.item?.nome || item.nome || "").trim()

    if (!nomeOriginal) return "Serviço"

    const nomeLower = nomeOriginal.toLowerCase()

    // 1. Regras de "CONTÉM" (Palavra-chave -> Descrição Completa)
    // A ordem importa! As primeiras regras têm prioridade.
    const regrasDeContem = [
        { chave: "adequação", label: "ADEQUAÇÃO EM SPDA" },
        { chave: "manutenção em spda", label: "MANUTENÇÃO DE SPDA" },
        { chave: "gaiola de faraday", label: "INSTALAÇÃO DE GAIOLA DE FARADAY" },
        { chave: "pintura", label: "PINTURA DE MASTRO/ESTRUTURA" },
        { chave: "instalação", label: "INSTALAÇÃO DE SPDA" },
        { chave: "projeto", label: "ELABORAÇÃO DE PROJETO TÉCNICO SPDA" },
        { chave: "laudo", label: "EMISSÃO DE LAUDO TÉCNICO DE SPDA" },
        { chave: "certificado", label: "EMISSÃO DE CERTIFICADO DE MANUTENÇÃO DE SPDA" },
        { chave: "avaliação", label: "AVALIAÇÃO TÉCNICA SEMESTRAL DE SPDA" },
        { chave: "verificação", label: "VERIFICAÇÃO TÉCNICA DE SPDA" },
        { chave: "aterramento", label: "MANUTENÇÃO NO SISTEMA DE ATERRAMENTO DE SPDA" },
        { chave: "visita", label: "VISITA TÉCNICA DE SPDA" },

        // Regra Genérica para SPDA (se não caiu nas de cima)
        { chave: "spda", label: "SERVIÇOS EM SISTEMA DE SPDA" },
    ]

    for (const regra of regrasDeContem) {
        if (nomeLower.includes(regra.chave.toLowerCase())) {
            // Retorna em Upper Case para padronizar
            return regra.label.toUpperCase()
        }
    }

    // 2. Fallback: Se não casar com nada, usa o nome do sistema em Upper Case
    return nomeOriginal.toUpperCase()
}
