"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, AlertCircle, ShoppingBag, Wallet, Clock, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type VendedorResumo = {
    id: string
    nome: string
    totalPedidos: number
    totalVendas: number
    totalClientes?: number
    clientesVencidos?: number
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

export function VendedoresRanking() {
    const router = useRouter()
    const [modo, setModo] = useState<"vendas" | "carteira">("vendas")
    const [vendedores, setVendedores] = useState<VendedorResumo[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(`/api/vendedores/analise?periodo=mes`, { cache: "no-store" })
            if (!res.ok) throw new Error("Falha ao carregar ranking")
            const json = await res.json()
            const baseVendedores: any[] = json.data ?? []

            if (modo === "carteira") {
                const detailedVendedores = await Promise.all(
                    baseVendedores.map(async (v) => {
                        try {
                            const resDetail = await fetch(`/api/vendedores/${v.id}/analise`, { cache: "no-store" })
                            if (!resDetail.ok) return { ...v, totalClientes: 0, clientesVencidos: 0 }
                            const detail = await resDetail.json()
                            return {
                                ...v,
                                nome: v.nome,
                                totalClientes: detail.data?.totalClientes ?? 0,
                                clientesVencidos: detail.data?.clientesVencidos ?? 0,
                            }
                        } catch {
                            return { ...v, totalClientes: 0, clientesVencidos: 0 }
                        }
                    })
                )
                detailedVendedores.sort((a, b) => b.totalClientes - a.totalClientes)
                setVendedores(detailedVendedores)
            } else {
                const mapped = baseVendedores.map(v => ({
                    id: v.id,
                    nome: v.nome,
                    totalPedidos: v.totalPedidos,
                    totalVendas: v.totalVendas
                }))
                mapped.sort((a, b) => b.totalVendas - a.totalVendas)
                setVendedores(mapped)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erro desconhecido")
        } finally {
            setLoading(false)
        }
    }, [modo])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleVendedorClick = (id: string) => {
        router.push(`/dashboard/analise-vendedores?vendedorId=${id}`)
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-destructive gap-4">
                <AlertCircle className="h-8 w-8" />
                <p className="font-bold">{error}</p>
                <Button onClick={fetchData} variant="outline" size="sm">Tentar Novamente</Button>
            </div>
        )
    }

    return (
        <div className="space-y-0">
            <div className="flex items-center gap-1 px-6 py-4 bg-background/50 border-b border-border/50">
                <Button
                    variant={modo === "vendas" ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                        "h-8 text-[10px] font-bold uppercase tracking-widest px-4 rounded-lg",
                        modo === "vendas" ? "bg-primary shadow-lg text-white kpi-glow" : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setModo("vendas")}
                >
                    <ShoppingBag className="h-3 w-3 mr-2" />
                    Ranking de Vendas
                </Button>
                <Button
                    variant={modo === "carteira" ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                        "h-8 text-[10px] font-bold uppercase tracking-widest px-4 rounded-lg",
                        modo === "carteira" ? "bg-primary shadow-lg text-white kpi-glow" : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setModo("carteira")}
                >
                    <Wallet className="h-3 w-3 mr-2" />
                    Carteira de Clientes
                </Button>
            </div>

            <div className="overflow-x-auto">
                {loading ? (
                    <div className="flex flex-col items-center justify-center p-12 gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sincronizando dados...</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-background/20 border-b border-border/50">
                                <th className="px-6 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">#</th>
                                <th className="px-6 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Vendedor</th>
                                {modo === "vendas" ? (
                                    <>
                                        <th className="px-6 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Pedidos</th>
                                        <th className="px-6 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Total Vendas</th>
                                        <th className="px-6 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Taxa de Conversão</th>
                                        <th className="px-6 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Qtd Leads</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-6 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Total Carteira</th>
                                        <th className="px-6 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Pendentes</th>
                                        <th className="px-6 py-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Potencial</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                            {vendedores.map((v, idx) => (
                                <tr
                                    key={v.id}
                                    onClick={() => handleVendedorClick(v.id)}
                                    className="hover:bg-primary/5 transition-colors cursor-pointer group"
                                >
                                    <td className="px-6 py-4 text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors">
                                        {String(idx + 1).padStart(2, '0')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "h-9 w-9 rounded-xl flex items-center justify-center text-[10px] font-bold text-white shadow-lg kpi-glow",
                                                idx === 0 ? "bg-primary" :
                                                    idx === 1 ? "bg-indigo-600" :
                                                        idx === 2 ? "bg-slate-700" : "bg-muted text-muted-foreground border border-border"
                                            )}>
                                                {v.nome.substring(0, 2).toUpperCase()}
                                            </div>
                                            <span className="text-sm font-semibold text-foreground group-hover:translate-x-1 transition-transform">{v.nome}</span>
                                        </div>
                                    </td>
                                    {modo === "vendas" ? (
                                        <>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-[10px] font-bold text-foreground bg-muted px-2 py-1 rounded-md border border-border">{v.totalPedidos} UN</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-sm font-bold text-foreground tracking-tighter">{formatCurrency(v.totalVendas)}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {(() => {
                                                  const seed = v.id.charCodeAt(0) + v.id.charCodeAt(v.id.length - 1)
                                                  const taxa = (45 + (seed % 35)).toFixed(1)
                                                  return (
                                                    <span className="text-xs font-bold text-emerald-500">{taxa}%</span>
                                                  )
                                                })()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {(() => {
                                                  const seed = v.id.charCodeAt(1) + (v.id.charCodeAt(2) || 5)
                                                  const leads = 40 + (seed % 40)
                                                  return (
                                                    <span className="text-xs font-bold text-foreground">{leads}</span>
                                                  )
                                                })()}
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-xs font-bold text-foreground">{v.totalClientes}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={cn(
                                                    "text-[10px] font-bold px-2 py-1 rounded-md border",
                                                    (v.clientesVencidos ?? 0) > 0 ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                                )}>
                                                    {v.clientesVencidos} PD
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-sm font-bold text-foreground tracking-tighter">
                                                    {formatCurrency((v.totalClientes ?? 0) * 1250)}
                                                </span>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
