
"use client"

import { Badge } from "@/components/ui/badge"
import { NfeStatus } from "@prisma/client"
import { getNfeStatusInfo } from "@/nfe/domain/utils/nfe-status-utils"
import { cn } from "@/lib/utils"

interface NfeStatusBadgeProps {
    status: NfeStatus
    className?: string
}

export function NfeStatusBadge({ status, className }: NfeStatusBadgeProps) {
    const info = getNfeStatusInfo(status)

    return (
        <Badge
            variant="outline"
            className={cn(
                "font-semibold px-2 py-0.5 whitespace-nowrap",
                info.bg,
                info.color,
                info.border,
                className
            )}
            title={info.description}
        >
            {info.label}
        </Badge>
    )
}
