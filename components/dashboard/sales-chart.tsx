"use client"

import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Area, AreaChart } from "recharts"

const data = [
  { month: "Jan", vendas: 450000, meta: 500000 },
  { month: "Fev", vendas: 520000, meta: 500000 },
  { month: "Mar", vendas: 480000, meta: 500000 },
  { month: "Abr", vendas: 610000, meta: 550000 },
  { month: "Mai", vendas: 550000, meta: 550000 },
  { month: "Jun", vendas: 670000, meta: 600000 },
  { month: "Jul", vendas: 690000, meta: 600000 },
  { month: "Ago", vendas: 580000, meta: 600000 },
  { month: "Set", vendas: 630000, meta: 600000 },
  { month: "Out", vendas: 750000, meta: 650000 },
  { month: "Nov", vendas: 820000, meta: 700000 },
  { month: "Dez", vendas: 910000, meta: 750000 },
]

export function SalesChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.3)" />
        <XAxis
          dataKey="month"
          stroke="hsl(var(--muted-foreground))"
          fontSize={10}
          fontWeight={900}
          tickLine={false}
          axisLine={false}
          dy={10}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={10}
          fontWeight={900}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `R$ ${value / 1000}k`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border) / 0.5)",
            borderRadius: "16px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
            padding: "16px"
          }}
          labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 900, marginBottom: "8px", textTransform: "uppercase", fontSize: "10px", letterSpacing: "0.1em" }}
          itemStyle={{ fontSize: "11px", fontWeight: 700, padding: "2px 0", color: "hsl(var(--primary))" }}
          formatter={(value: number) => [`R$ ${value.toLocaleString()}`, "Faturamento"]}
        />
        <Area
          type="monotone"
          dataKey="vendas"
          stroke="hsl(var(--primary))"
          strokeWidth={4}
          fillOpacity={1}
          fill="url(#colorVendas)"
          animationDuration={2000}
        />
        <Line
          type="monotone"
          dataKey="meta"
          stroke="hsl(var(--muted-foreground) / 0.5)"
          strokeWidth={2}
          strokeDasharray="8 8"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
