"use client"

import { TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

const followups = [
    { step: "1º Follow-up", resposta: 45, conversao: 12, valor: "R$ 48k", color: "bg-primary" },
    { step: "2º Follow-up", resposta: 32, conversao: 18, valor: "R$ 62k", color: "bg-emerald-500" },
    { step: "3º Follow-up", resposta: 22, conversao: 25, valor: "R$ 85k", color: "bg-purple-500" },
    { step: "4º Follow-up", resposta: 15, conversao: 31, valor: "R$ 112k", color: "bg-indigo-600" },
]

export function FollowupRoi() {
    return (
        <div className="space-y-6 pt-2">
            {followups.map((f) => (
                <div key={f.step} className="group transition-transform hover:scale-[1.01]">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-foreground uppercase tracking-widest">{f.step}</span>
                        <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shadow-lg kpi-glow">{f.valor}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-[8px] font-black text-muted-foreground uppercase tracking-widest">
                                <span>Resposta</span>
                                <span>{f.resposta}%</span>
                            </div>
                            <div className="h-1.5 bg-background/50 rounded-full overflow-hidden border border-border/50">
                                <div className="h-full bg-muted-foreground/30 rounded-full transition-all duration-1000" style={{ width: `${f.resposta}%` }} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-[8px] font-black text-muted-foreground uppercase tracking-widest">
                                <span>Conversão</span>
                                <span>{f.conversao}%</span>
                            </div>
                            <div className="h-1.5 bg-background/50 rounded-full overflow-hidden border border-border/50">
                                <div className={cn("h-full rounded-full shadow-lg transition-all duration-1000 kpi-glow", f.color)} style={{ width: `${f.conversao}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
            <div className="mt-6 p-4 bg-primary/10 rounded-2xl border border-primary/20 shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-primary opacity-5 group-hover:opacity-10 transition-opacity" />
                <p className="text-[10px] text-foreground font-black uppercase tracking-widest leading-relaxed flex items-center gap-3 relative z-10">
                    <TrendingUp className="h-4 w-4 text-primary animate-pulse" />
                    O 3º follow-up tem o melhor ROI (+25%).
                </p>
            </div>
        </div>
    )
}
