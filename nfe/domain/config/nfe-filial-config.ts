
import { EbrRjFactory } from "../factories/filiais/ebr-rj.factory"
import { EbrDfFactory } from "../factories/filiais/ebr-df.factory"
import { EbrPeFactory } from "../factories/filiais/ebr-pe.factory"
import { EbrPrFactory } from "../factories/filiais/ebr-pr.factory"
import { EbrSpFactory } from "../factories/filiais/ebr-sp.factory"
import { FranklinRjFactory } from "../factories/filiais/franklin-rj.factory"

// Mapeamento: Empresa ID -> UF -> Configuração + Factory
export const NFE_COMPANY_REGISTRY = {
    1: { // EBR (ID 1)
        'RJ': {
            nfeIoCompanyId: "a068244125d04b68bd834f896239bf07",
            factory: EbrRjFactory,
            active: true
        },
        'DF': {
            nfeIoCompanyId: "3f665424bf66463c8934543ddccedcea",
            factory: EbrDfFactory,
            active: true // Desativado
        },
        'PE': {
            nfeIoCompanyId: "168b938b4c9145b29795d08bbebf0ffe",
            factory: EbrPeFactory,
            active: true
        },
        'PR': {
            nfeIoCompanyId: "bec05bcfbce74b0f887a6a179623ce36",
            factory: EbrPrFactory,
            active: true // Habilitado
        },
        'SP': {
            nfeIoCompanyId: "b2b6a4027a474d1789f91591011ede30",
            factory: EbrSpFactory,
            active: true
        }
    },
    2: { // Franklin (ID 2)
        'RJ': {
            nfeIoCompanyId: "fc84183542f046f686b991fb479b7daf",
            factory: FranklinRjFactory,
            active: true
        }
    }
} as const

export function getNfeConfig(empresaId: number, filialUf: string) {
    const empresaConfig = NFE_COMPANY_REGISTRY[empresaId as keyof typeof NFE_COMPANY_REGISTRY]
    if (!empresaConfig) return null

    return (empresaConfig[filialUf as keyof typeof empresaConfig] as any) || null
}
