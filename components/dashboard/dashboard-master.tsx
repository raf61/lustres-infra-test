"use client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { SalesChart } from "@/components/dashboard/sales-chart"
import { AlertasVencidos } from "@/components/dashboard/alertas-vencidos"
import { Badge } from "@/components/ui/badge"
import { BarChart3, TrendingUp, Users, AlertTriangle, MessageSquare, Bot, Clock, ChevronRight } from "lucide-react"
import { Can } from "@/components/auth/can"
import { cn } from "@/lib/utils"
import { LeadsDayChart } from "@/components/dashboard/leads-day-chart"
import { LeadStatusSummary } from "@/components/dashboard/lead-status-summary"
import { SalesFunnel } from "@/components/dashboard/sales-funnel"
import { UnidadesComparison } from "@/components/dashboard/unidades-comparison"
import { VendedoresRanking } from "@/components/dashboard/vendedores-ranking"
import { useState } from "react"

export function DashboardMaster() {
  const router = useRouter()
  const [timeRange, setTimeRange] = useState("Mês")

  const handleVendedoresCardClick = () => {
    router.push("/dashboard/analise-vendedores")
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-3xl font-bold tracking-tighter text-foreground font-display uppercase italic lora-font">Dashboard</h1>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-[10px] font-bold text-primary border border-primary/20 uppercase tracking-widest kpi-glow">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Live: Central de I.A.
              </div>
            </div>
            <p className="text-[10px] font-bold text-muted-foreground bg-card px-3 py-1.5 rounded-lg border border-border inline-block mt-2 uppercase tracking-widest">
              Performance Estratégica Consolidada — Lustres & Design
            </p>
          </div>

          <div className="flex items-center gap-1 bg-card p-1 rounded-xl border border-border shadow-2xl">
            {["Hoje", "Semana", "Mês", "Trimestre"].map((p) => (
              <Button
                key={p}
                variant={p === timeRange ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "h-8 px-4 text-[10px] font-bold uppercase tracking-widest transition-all rounded-lg",
                  p === timeRange ? "bg-primary text-white shadow-lg kpi-glow" : "text-muted-foreground hover:text-white"
                )}
                onClick={() => setTimeRange(p)}
              >
                {p}
              </Button>
            ))}
          </div>
        </div>

        <StatsCards timeRange={timeRange} />

        <div className="grid gap-6 lg:grid-cols-7 text-foreground">
          <Card className="lg:col-span-4 border-border/50 bg-card shadow-2xl overflow-hidden glass-card">
            <CardHeader className="border-b border-border/50 px-6 py-5 bg-background/50 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Leads por Dia</CardTitle>
                  <CardDescription className="text-[10px] font-semibold text-muted-foreground/60 uppercase mt-1">Volume de entrada de novas oportunidades</CardDescription>
                </div>
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary kpi-glow">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <LeadsDayChart />
            </CardContent>
          </Card>

          <Card className="lg:col-span-3 border-border/50 bg-card shadow-2xl overflow-hidden glass-card">
            <CardHeader className="border-b border-border/50 px-6 py-5 bg-background/50 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status Geral dos Leads</CardTitle>
                  <CardDescription className="text-[10px] font-semibold text-muted-foreground/60 uppercase mt-1">Distribuição do funil em tempo real</CardDescription>
                </div>
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary kpi-glow">
                  <BarChart3 className="h-4 w-4" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <LeadStatusSummary />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-7 ">
          <Card className="lg:col-span-3 border-border/50 bg-card shadow-2xl overflow-hidden border-t-4 border-t-primary glass-card">
            <CardHeader className="px-6 py-5 pb-0 space-y-0">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Funil de Vendas</CardTitle>
            </CardHeader>
            <CardContent className="px-6 py-5 pt-2">
              <SalesFunnel />
            </CardContent>
          </Card>

          <Card className="lg:col-span-4 border-border/50 bg-card shadow-2xl overflow-hidden border-t-4 border-t-slate-500 glass-card">
            <CardHeader className="px-6 py-5 pb-0 space-y-0">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Comparativo de Unidades</CardTitle>
            </CardHeader>
            <CardContent className="px-6 py-5 pt-2">
              <UnidadesComparison />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <Card
            className="lg:col-span-12 border-border/50 bg-card shadow-2xl overflow-hidden glass-card cursor-pointer hover:border-primary/50 transition-all hover:scale-[1.005] group"
            onClick={handleVendedoresCardClick}
          >
            <CardHeader className="border-b border-border/50 px-6 py-5 space-y-0 bg-background/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  Ranking Estratégico de Vendedores
                  <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all" />
                </CardTitle>
                <CardDescription className="text-[10px] font-semibold text-muted-foreground/60 uppercase mt-1">Desempenho individual e conversão em tempo real</CardDescription>
              </div>
              <Button size="sm" variant="outline" className="h-8 px-4 text-[9px] font-bold uppercase tracking-widest rounded-lg border-primary/20 bg-primary/5 text-primary">Análise Detalhada</Button>
            </CardHeader>
            <CardContent className="p-0">
              <VendedoresRanking />
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
