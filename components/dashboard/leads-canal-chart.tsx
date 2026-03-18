"use client"

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from "recharts"

const data = [
    { name: "WhatsApp", value: 42, color: "hsl(var(--primary))" },
    { name: "Instagram", value: 24, color: "hsl(var(--accent))" },
    { name: "Google Ads", value: 18, color: "hsl(var(--warning))" },
    { name: "Indicação", value: 10, color: "hsl(var(--success))" },
    { name: "Site", value: 6, color: "hsl(var(--secondary))" },
]

export function LeadsCanalChart() {
    return (
        <ResponsiveContainer width="100%" height={260}>
            <PieChart>
                <Pie
                    data={data}
                    cx="40%"
                    cy="40%"
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                </Pie>
                <Tooltip
                    contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border) / 0.5)",
                        borderRadius: "16px",
                        boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)",
                        padding: "12px"
                    }}
                    labelStyle={{ display: 'none' }}
                    itemStyle={{ color: 'hsl(var(--foreground))', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}
                />
                <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    iconType="circle"
                    formatter={(value, entry: any) => (
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-4">
                            {value} <span className="text-foreground ml-2">{entry.payload.value}%</span>
                        </span>
                    )}
                />
            </PieChart>
        </ResponsiveContainer>
    )
}
