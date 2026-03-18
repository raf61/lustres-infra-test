
import { NfeStatus } from "@prisma/client"

export type NfeStatusInfo = {
    label: string
    color: string
    bg: string
    border: string
    description?: string
}

export const NFE_STATUS_MAP: Record<NfeStatus, NfeStatusInfo> = {
    CREATED: {
        label: "Pendente",
        color: "text-slate-700",
        bg: "bg-slate-100",
        border: "border-slate-200",
        description: "Aguardando ação para processamento."
    },
    QUEUED: {
        label: "Aguardando Emissão",
        color: "text-blue-700",
        bg: "bg-blue-50",
        border: "border-blue-200",
        description: "Nota enviada para a prefeitura, aguardando autorização."
    },
    AUTHORIZED: {
        label: "Autorizada",
        color: "text-emerald-700",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        description: "Nota fiscal emitida e autorizada com sucesso."
    },
    ERROR: {
        label: "Erro",
        color: "text-red-700",
        bg: "bg-red-50",
        border: "border-red-200",
        description: "Ocorreu uma falha no processamento da nota."
    },
    CANCELLED: {
        label: "Cancelada",
        color: "text-gray-700",
        bg: "bg-gray-100",
        border: "border-gray-200",
        description: "Nota fiscal cancelada na prefeitura."
    }
}

export function getNfeStatusInfo(status: NfeStatus): NfeStatusInfo {
    return NFE_STATUS_MAP[status] || {
        label: status,
        color: "text-slate-700",
        bg: "bg-slate-100",
        border: "border-slate-200"
    }
}
