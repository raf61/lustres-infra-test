"use client"

import { cn } from "@/lib/utils"

const stages = [
    { name: "Novo Lead", value: 182, color: "bg-primary" },
    { name: "Contato IA", value: 206, color: "bg-orange-500" },
    { name: "Qualificado", value: 144, color: "bg-cyan-500" },
    { name: "Orçamento", value: 150, color: "bg-purple-500" },
    { name: "Negociação", value: 75, color: "bg-yellow-500" },
    { name: "Fechado", value: 108, color: "bg-emerald-500" },
    { name: "Perdido", value: 55, color: "bg-red-500" },
]

export function SalesFunnel() {
    const maxValue = Math.max(...stages.map(s => s.value))

    return (
        <div className="space-y-4 py-2">
            {stages.map((stage) => (
                <div key={stage.name} className="group">
                    <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest mb-1.5 transition-colors group-hover:text-foreground">
                        <span className="text-muted-foreground/80 group-hover:text-foreground">{stage.name}</span>
                        <span className="text-foreground">{stage.value}</span>
                    </div>
                    <div className="h-2 w-full bg-background/50 rounded-full overflow-hidden border border-border/50 shadow-inner">
                        <div
                            className={cn(
                                "h-full rounded-full transition-all duration-1000 kpi-glow",
                                stage.color
                            )}
                            style={{ width: `${(stage.value / maxValue) * 100}%` }}
                        />
                    </div>
                </div>
            ))}
        </div>
    )
}
