"use client"

import { Card, CardContent } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"

export function LeadStatusSummary({ timeRange = "Mês" }: { timeRange?: string }) {
  const data = [
    { name: "Em Aberto", value: timeRange === "Hoje" ? 12 : timeRange === "Semana" ? 48 : 148, color: "#3b82f6" },
    { name: "Perdidos", value: timeRange === "Hoje" ? 2 : timeRange === "Semana" ? 12 : 52, color: "#ef4444" },
    { name: "Compraram", value: timeRange === "Hoje" ? 4 : timeRange === "Semana" ? 22 : 84, color: "#10b981" },
    { name: "IA em Curso", value: timeRange === "Hoje" ? 8 : timeRange === "Semana" ? 25 : 65, color: "#8b5cf6" },
  ]
  return (
    <div className="h-[300px] w-100 flex flex-col md:flex-row items-center justify-between gap-4">
      <ResponsiveContainer width="100%" height="80%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
                backgroundColor: "hsl(var(--card))", 
                border: "1px solid hsl(var(--border) / 0.5)", 
                borderRadius: "12px" 
            }} 
            itemStyle={{ fontSize: "12px", fontWeight: "bold" }}
          />
        </PieChart>
      </ResponsiveContainer>
      
      <div className="flex flex-col gap-2 w-full md:w-auto min-w-[150px]">
        {data.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-background/50 border border-border/50">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{item.name}</span>
            </div>
            <span className="text-xs font-black">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
