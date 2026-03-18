"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Users, UserCheck, Calendar, DollarSign, AlertCircle, TrendingUp, Bot, Clock, MessageSquare, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

type InadimplenciaData = {
  total: number
  quantidade: number
}

type DashboardMasterData = {
  inadimplencia: InadimplenciaData
  clientes: {
    ativos: number
  }
  vendasMes: number
  leadsHoje: number
  vencidos: number
  // Mock data for demo feel
  taxaConversao: number
  iaAtiva: number
  tempoMedioResp: string
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}k`
  }
  return `R$ ${value.toFixed(0)}`
}

export function StatsCards({ timeRange = "Mês" }: { timeRange?: string }) {
  const [dashboardData, setDashboardData] = useState<DashboardMasterData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch("/api/dashboard/master")
        if (response.ok) {
          const data: DashboardMasterData = await response.json()
          setDashboardData(data)
        }
      } catch (error) {
        console.error("Erro ao carregar dados do dashboard:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  const stats = [
    {
      name: "Total de Leads",
      value: timeRange === "Hoje" ? "42" : timeRange === "Semana" ? "284" : "2,482",
      change: "+12.5% MENSAL",
      icon: Users,
      color: "border-primary",
      iconColor: "text-primary",
      isLoading: loading,
    },
    {
      name: "Leads Ativos",
      value: timeRange === "Hoje" ? "12" : timeRange === "Semana" ? "86" : "1,842",
      change: "BASE EM DIA",
      icon: UserCheck,
      color: "border-emerald-500",
      iconColor: "text-emerald-500",
      isLoading: loading,
    },
    {
      name: "Conversas com I.A.",
      value: "28",
      change: "EM TEMPO REAL",
      icon: Bot,
      color: "border-purple-500",
      iconColor: "text-purple-500",
      isLoading: loading,
    },
    {
      name: "Taxa Conversão",
      value: "34.4%",
      change: "+5.2% MÊS ANT.",
      icon: TrendingUp,
      color: "border-orange-500",
      iconColor: "text-orange-500",
      isLoading: loading,
    },
    {
      name: "Taxa Conv. Follow-up IA",
      value: "18.2%",
      change: "MÉDIA GLOBAL",
      icon: MessageSquare,
      color: "border-indigo-500",
      iconColor: "text-indigo-500",
      isLoading: loading,
    },
    {
      name: "Tempo Médio Resp",
      value: "1.4min",
      change: "I.A: 12seg",
      icon: Clock,
      color: "border-cyan-500",
      iconColor: "text-cyan-500",
      isLoading: loading,
    },
    {
      name: "Leads Perdidos",
      value: "24",
      change: "REVERSÃO: 12%",
      icon: AlertCircle,
      color: "border-red-500",
      iconColor: "text-red-500",
      isLoading: loading,
    },
  ]

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 ">
      {stats.map((stat) => (
        <Card key={stat.name} className={cn(
          "relative overflow-hidden border-border/50 bg-card shadow-2xl transition-all duration-300 group glass-card",
        )}>
          {/* Subtle line indicator */}
          <div className={cn("absolute left-0 top-0 bottom-0 w-1 opacity-80", stat.color, "bg-current")} />

          <CardContent className="p-3 relative z-10">
            <div className="flex justify-between items-start mb-2">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none mt-1">{stat.name}</p>
              <div className={cn("p-1.5 rounded-lg bg-background/50 text-foreground shadow-inner kpi-glow")}>
                <stat.icon className={cn("h-3 w-3", stat.iconColor)} />
              </div>
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xl font-bold tracking-tighter text-foreground font-display leading-tight">{stat.value}</h3>
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md border",
                  stat.change.includes("+") ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-muted text-muted-foreground border-border"
                )}>
                  {stat.change}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
