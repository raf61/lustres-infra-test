"use client"

import { cn } from "@/lib/utils"

const units = [
    { name: "Unidade 1", leads: 480, fechados: 68, conv: "14.2%", faturamento: "R$ 508k" },
    { name: "Unidade 2", leads: 440, fechados: 40, conv: "9.1%", faturamento: "R$ 498k" },
    { name: "Unidade 3", leads: 320, fechados: 52, conv: "16.2%", faturamento: "R$ 412k" },
]

export function UnidadesComparison() {
    return (
        <div className="grid grid-cols-3 gap-3">
            {units.map((unit) => (
                <div key={unit.name} className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-foreground">{unit.name}</span>
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">{unit.faturamento}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="text-center">
                            <span className="block text-[10px] text-muted-foreground mb-0.5">Leads</span>
                            <span className="text-sm font-bold text-foreground">{unit.leads}</span>
                        </div>
                        <div className="text-center">
                            <span className="block text-[10px] text-muted-foreground mb-0.5">Ganhos</span>
                            <span className="text-sm font-bold text-emerald-700">{unit.fechados}</span>
                        </div>
                        <div className="text-center">
                            <span className="block text-[10px] text-muted-foreground mb-0.5">Taxa</span>
                            <span className="text-sm font-bold text-primary">{unit.conv}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}
