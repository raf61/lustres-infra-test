"use client"

import { ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Area, AreaChart } from "recharts"

const data = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  leads: Math.floor(Math.random() * 15) + 20, // Entre 20 e 35 leads por dia
}))

export function LeadsDayChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.3)" />
        <XAxis
          dataKey="day"
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
          tickFormatter={(value) => `${value}`}
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
          formatter={(value: number) => [value, "Leads"]}
        />
        <Area
          type="monotone"
          dataKey="leads"
          stroke="hsl(var(--primary))"
          strokeWidth={4}
          fillOpacity={1}
          fill="url(#colorLeads)"
          animationDuration={2000}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
