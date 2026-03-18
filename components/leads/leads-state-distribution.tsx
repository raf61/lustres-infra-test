"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { MapPin, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

type StateData = {
  estado: string
  total: number
}

type DistributionResponse = {
  distribution: StateData[]
  total: number
}

// Nomes completos dos estados
const STATE_NAMES: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
  "N/I": "Não informado",
}

const getStateName = (uf: string) => STATE_NAMES[uf] || uf

// Cores e configurações de contraste para cada estado
const STATE_CONFIG: Record<string, { bg: string; text: string }> = {
  // Sudeste - Tons de azul (texto branco)
  SP: { bg: "bg-blue-500", text: "text-white" },
  RJ: { bg: "bg-blue-600", text: "text-white" },
  MG: { bg: "bg-blue-400", text: "text-white" },
  ES: { bg: "bg-sky-500", text: "text-white" },
  // Sul - Tons de verde (texto branco)
  PR: { bg: "bg-emerald-500", text: "text-white" },
  SC: { bg: "bg-emerald-600", text: "text-white" },
  RS: { bg: "bg-green-600", text: "text-white" },
  // Nordeste - Tons de laranja/amarelo
  BA: { bg: "bg-amber-500", text: "text-slate-900" },
  PE: { bg: "bg-orange-500", text: "text-white" },
  CE: { bg: "bg-orange-600", text: "text-white" },
  MA: { bg: "bg-amber-600", text: "text-white" },
  PB: { bg: "bg-orange-700", text: "text-white" },
  RN: { bg: "bg-amber-400", text: "text-slate-900" },
  AL: { bg: "bg-yellow-500", text: "text-slate-900" },
  SE: { bg: "bg-orange-500", text: "text-white" },
  PI: { bg: "bg-yellow-400", text: "text-slate-900" },
  // Centro-Oeste - Tons de roxo (texto branco)
  GO: { bg: "bg-violet-500", text: "text-white" },
  MT: { bg: "bg-violet-600", text: "text-white" },
  MS: { bg: "bg-purple-600", text: "text-white" },
  DF: { bg: "bg-purple-500", text: "text-white" },
  // Norte - Tons de teal/cyan (texto branco)
  AM: { bg: "bg-teal-500", text: "text-white" },
  PA: { bg: "bg-teal-600", text: "text-white" },
  AC: { bg: "bg-cyan-600", text: "text-white" },
  RO: { bg: "bg-teal-700", text: "text-white" },
  RR: { bg: "bg-cyan-500", text: "text-white" },
  AP: { bg: "bg-teal-500", text: "text-white" },
  TO: { bg: "bg-cyan-700", text: "text-white" },
  // Não informado
  "N/I": { bg: "bg-slate-500", text: "text-white" },
}

const getStateConfig = (estado: string) => STATE_CONFIG[estado] || { bg: "bg-slate-500", text: "text-white" }

export interface LeadsStateDistributionProps {
  /** Filtros ativos para buscar a distribuição (query params) */
  filters: Record<string, string>
  /** Classe CSS adicional */
  className?: string
  /** Título customizado */
  title?: string
  /** Número máximo de estados a exibir (resto agrupa em "Outros") */
  maxStates?: number
  /** Callback quando um estado é clicado */
  onStateClick?: (estado: string) => void
  /** Estado atualmente selecionado (para highlight) */
  selectedState?: string | null
}

export function LeadsStateDistribution({
  filters,
  className,
  title = "Distribuição por Estado",
  onStateClick,
  selectedState,
}: LeadsStateDistributionProps) {
  const [data, setData] = useState<StateData[]>([])
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

      const response = await fetch(`/api/clients/stats/by-state?${params.toString()}`)
      if (!response.ok) throw new Error("Erro ao buscar dados")

      const result: DistributionResponse = await response.json()
      setData(result.distribution)
      setTotal(result.total)
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
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-1 items-end h-32">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="flex-1 rounded-t" style={{ height: `${30 + Math.random() * 70}%` }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={cn("border-border bg-card", className)}>
        <CardContent className="py-6 text-center text-muted-foreground">
          {error}
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card className={cn("border-border bg-card", className)}>
        <CardContent className="py-6 text-center text-muted-foreground">
          Nenhum dado disponível
        </CardContent>
      </Card>
    )
  }

  const maxValue = Math.max(...data.map((d) => d.total))

  return (
    <Card className={cn("border-border bg-card overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="font-semibold text-foreground">{data.length}</span>
            <span>estados</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gráfico de barras verticais */}
        <div className="relative">
          {/* Container das barras */}
          <div className="flex items-end justify-center gap-3 px-2" style={{ height: "160px" }}>
            {data.map((item) => {
              const barHeight = maxValue > 0 ? (item.total / maxValue) * 100 : 0
              const config = getStateConfig(item.estado)
              const isSelected = selectedState === item.estado
              const stateName = getStateName(item.estado)

              return (
                <div
                  key={item.estado}
                  className={cn(
                    "w-12 group cursor-pointer transition-all duration-200",
                    onStateClick && "hover:opacity-80",
                    isSelected && "ring-2 ring-primary ring-offset-1 rounded-t"
                  )}
                  onClick={() => onStateClick?.(item.estado)}
                  title={`${stateName}: ${item.total.toLocaleString("pt-BR")} leads`}
                  style={{ height: "100%" }}
                >
                  <div className="h-full flex flex-col justify-end items-center">
                    {/* Valor no topo */}
                    <span className="text-[9px] font-semibold text-foreground mb-0.5 tabular-nums">
                      {item.total.toLocaleString("pt-BR")}
                    </span>
                    {/* Barra com UF dentro */}
                    <div
                      className={cn(
                        "w-full rounded-t-sm transition-all duration-500 ease-out min-h-[20px] flex items-end justify-center pb-1",
                        config.bg,
                        config.text,
                        "group-hover:brightness-110",
                        isSelected && "brightness-110"
                      )}
                      style={{ height: `${Math.max(barHeight, 15)}%` }}
                    >
                      <span className="text-[10px] font-bold">{item.estado}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {/* Labels dos estados - nomes completos */}
          <div className="flex justify-center gap-3 px-2 mt-2">
            {data.map((item) => {
              const stateName = getStateName(item.estado)
              return (
                <div key={item.estado} className="w-12 text-center">
                  <span 
                    className="text-[9px] font-medium text-muted-foreground block leading-tight"
                    title={stateName}
                  >
                    {stateName}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Badges para todos os estados */}
        <div className="pt-3 border-t border-border/50">
          <div className="flex flex-wrap gap-2">
            {data.map((item) => {
              const percentage = total > 0 ? (item.total / total) * 100 : 0
              const config = getStateConfig(item.estado)
              const isSelected = selectedState === item.estado
              const stateName = getStateName(item.estado)

              return (
                <button
                  key={item.estado}
                  onClick={() => onStateClick?.(item.estado)}
                  disabled={!onStateClick}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all shadow-sm",
                    config.bg,
                    config.text,
                    onStateClick && "hover:scale-105 hover:shadow-md cursor-pointer hover:brightness-110",
                    !onStateClick && "cursor-default",
                    isSelected && "ring-2 ring-primary ring-offset-2 scale-105"
                  )}
                >
                  <span className="font-bold">{stateName}</span>
                  <span className="tabular-nums font-semibold">{item.total.toLocaleString("pt-BR")}</span>
                  <span className="opacity-75 text-xs">({percentage.toFixed(0)}%)</span>
                </button>
              )
            })}
          </div>
        </div>

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
