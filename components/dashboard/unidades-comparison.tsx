"use client"

import { cn } from "@/lib/utils"

const units = [
    { name: "Unidade 1", leads: 480, fechados: 68, conv: "14.2%", faturamento: "R$ 508k" },
    { name: "Unidade 2", leads: 440, fechados: 40, conv: "9.1%", faturamento: "R$ 498k" },
    { name: "Unidade 3", leads: 320, fechados: 52, conv: "16.2%", faturamento: "R$ 412k" },
]

export function UnidadesComparison() {
    return (
        <div className="space-y-4 pt-2">
            {units.map((unit) => (
                <div key={unit.name} className="p-4 rounded-2xl border border-border/50 bg-background/50 shadow-2xl space-y-4 hover:border-primary/30 transition-all group">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-foreground uppercase tracking-widest group-hover:text-primary transition-colors">{unit.name}</span>
                        <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 shadow-lg kpi-glow">{unit.faturamento}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="text-center p-3 rounded-xl bg-card border border-border/50 shadow-xl group-hover:bg-background transition-colors">
                            <span className="block text-[8px] font-black text-muted-foreground uppercase mb-1.5 tracking-widest">Leads</span>
                            <span className="text-sm font-black text-foreground leading-none">{unit.leads}</span>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-card border border-border/50 shadow-xl group-hover:bg-background transition-colors">
                            <span className="block text-[8px] font-black text-muted-foreground uppercase mb-1.5 tracking-widest">Ganhos</span>
                            <span className="text-sm font-black text-emerald-500 leading-none">{unit.fechados}</span>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-card border border-border/50 shadow-xl group-hover:bg-background transition-colors">
                            <span className="block text-[8px] font-black text-muted-foreground uppercase mb-1.5 tracking-widest">Taxa</span>
                            <span className="text-sm font-black text-primary leading-none">{unit.conv}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}
