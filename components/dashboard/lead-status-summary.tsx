"use client"

export function LeadStatusSummary({ timeRange = "Mês" }: { timeRange?: string }) {
  const data = [
    { name: "Em Aberto", value: timeRange === "Hoje" ? 12 : timeRange === "Semana" ? 48 : 148, color: "bg-blue-500", textColor: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
    { name: "Compraram", value: timeRange === "Hoje" ? 4 : timeRange === "Semana" ? 22 : 84, color: "bg-emerald-500", textColor: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
    { name: "IA em Curso", value: timeRange === "Hoje" ? 8 : timeRange === "Semana" ? 25 : 65, color: "bg-orange-500", textColor: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
    { name: "Perdidos", value: timeRange === "Hoje" ? 2 : timeRange === "Semana" ? 12 : 52, color: "bg-red-500", textColor: "text-red-700", bg: "bg-red-50 border-red-200" },
  ]

  const total = data.reduce((acc, d) => acc + d.value, 0)

  return (
    <div className="space-y-2.5">
      {data.map((item) => (
        <div key={item.name} className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${item.bg}`}>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${item.color}`} />
            <span className="text-xs font-medium text-foreground">{item.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${item.textColor}`}>{item.value}</span>
            <span className="text-[10px] text-muted-foreground">{((item.value / total) * 100).toFixed(0)}%</span>
          </div>
        </div>
      ))}
    </div>
  )
}
