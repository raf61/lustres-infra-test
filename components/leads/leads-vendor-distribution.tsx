"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Users, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

type VendorData = {
  vendedorId: string | null
  vendedor: string
  total: number
}

type DistributionResponse = {
  distribution: VendorData[]
  total: number
}

// Cores para vendedores
const VENDOR_COLORS = [
  { bg: "bg-blue-500", text: "text-white" },
  { bg: "bg-emerald-500", text: "text-white" },
  { bg: "bg-violet-500", text: "text-white" },
  { bg: "bg-amber-500", text: "text-slate-900" },
  { bg: "bg-rose-500", text: "text-white" },
  { bg: "bg-cyan-500", text: "text-white" },
  { bg: "bg-orange-500", text: "text-white" },
  { bg: "bg-teal-500", text: "text-white" },
  { bg: "bg-pink-500", text: "text-white" },
  { bg: "bg-indigo-500", text: "text-white" },
  { bg: "bg-lime-500", text: "text-slate-900" },
  { bg: "bg-purple-500", text: "text-white" },
]

const getVendorConfig = (index: number) => VENDOR_COLORS[index % VENDOR_COLORS.length]

// Cor especial para "Sem Vendedor"
const NO_VENDOR_CONFIG = { bg: "bg-slate-400", text: "text-white" }

export interface LeadsVendorDistributionProps {
  /** Filtros ativos para buscar a distribuição (query params) */
  filters: Record<string, string>
  /** Classe CSS adicional */
  className?: string
  /** Título customizado */
  title?: string
  /** Callback quando um vendedor é clicado (vendedorId é null para "Sem Vendedor") */
  onVendorClick?: (vendedorId: string | null, vendorName: string) => void
  /** ID do vendedor atualmente selecionado (para highlight) - "sem" para Sem Vendedor */
  selectedVendorId?: string | null
}

export function LeadsVendorDistribution({
  filters,
  className,
  title = "Distribuição por Vendedor",
  onVendorClick,
  selectedVendorId,
}: LeadsVendorDistributionProps) {
  const [data, setData] = useState<VendorData[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDistribution = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value)
      })

      const response = await fetch(`/api/clients/stats/by-vendor?${params.toString()}`)
      if (!response.ok) {
        throw new Error("Erro ao buscar distribuição")
      }
      const payload: DistributionResponse = await response.json()
      
      setData(payload.distribution)
      setTotal(payload.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchDistribution()
  }, [fetchDistribution])

  if (loading) {
    return (
      <Card className={cn("border-border bg-card", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end justify-between gap-1 h-40 px-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="flex-1 h-full" />
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={cn("border-border bg-card", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
            <Users className="h-4 w-4" />
            Erro ao carregar distribuição
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card className={cn("border-border bg-card", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nenhum dado disponível</p>
        </CardContent>
      </Card>
    )
  }

  const maxValue = Math.max(...data.map((d) => d.total))

  return (
    <Card className={cn("border-border bg-card overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>{data.length} vendedores</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gráfico de barras horizontais (sem "Sem Vendedor") */}
        {(() => {
          const chartData = data.filter(item => item.vendedorId !== null)
          const maxTotal = Math.max(...chartData.map(item => item.total), 1)
          
          if (chartData.length === 0) {
            return (
              <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
                Nenhum vendedor atribuído
              </div>
            )
          }
          
          return (
            <div className="space-y-2">
              {chartData.map((item, index) => {
                const barWidth = (item.total / maxTotal) * 100
                const config = getVendorConfig(index)
                const isSelected = selectedVendorId === item.vendedorId
                
                return (
                  <div
                    key={item.vendedorId}
                    className={cn(
                      "group cursor-pointer transition-all duration-200",
                      onVendorClick && "hover:opacity-80",
                      isSelected && "ring-2 ring-primary ring-offset-1 rounded"
                    )}
                    onClick={() => onVendorClick?.(item.vendedorId, item.vendedor)}
                    title={`${item.vendedor}: ${item.total.toLocaleString("pt-BR")} leads`}
                  >
                    <div className="flex items-center gap-2">
                      {/* Nome do vendedor */}
                      <span className="text-xs font-medium text-foreground w-24 truncate" title={item.vendedor}>
                        {item.vendedor}
                      </span>
                      {/* Barra */}
                      <div className="flex-1 h-6 bg-muted/30 rounded overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded transition-all duration-500 ease-out flex items-center justify-end pr-2",
                            config.bg,
                            "group-hover:brightness-110",
                            isSelected && "brightness-110"
                          )}
                          style={{ width: `${Math.max(barWidth, 3)}%` }}
                        >
                          <span className={cn("text-[11px] font-bold tabular-nums", config.text)}>
                            {item.total.toLocaleString("pt-BR")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}

        {/* Badge apenas para "Sem Vendedor" */}
        {(() => {
          const semVendedor = data.find(item => item.vendedorId === null)
          if (!semVendedor) return null
          
          const percentage = total > 0 ? (semVendedor.total / total) * 100 : 0
          const isSelected = selectedVendorId === "sem"
          
          return (
            <div className="pt-2 border-t border-border/50">
              <button
                onClick={() => onVendorClick?.(null, semVendedor.vendedor)}
                disabled={!onVendorClick}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all shadow-sm",
                  NO_VENDOR_CONFIG.bg,
                  NO_VENDOR_CONFIG.text,
                  onVendorClick && "hover:scale-105 hover:shadow-md cursor-pointer hover:brightness-110",
                  !onVendorClick && "cursor-default",
                  isSelected && "ring-2 ring-primary ring-offset-2 scale-105"
                )}
              >
                <span className="font-bold">{semVendedor.vendedor}</span>
                <span className="tabular-nums font-semibold">{semVendedor.total.toLocaleString("pt-BR")}</span>
                <span className="opacity-75 text-[10px]">({percentage.toFixed(0)}%)</span>
              </button>
            </div>
          )
        })()}

        {/* Resumo total */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground">Total geral</span>
          <span className="text-lg font-bold text-foreground tabular-nums">
            {total.toLocaleString("pt-BR")}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

