"use client"

import { Badge } from "@/components/ui/badge"
import { Calendar, MapPin } from "lucide-react"

const alerts = [
  {
    id: "1",
    cliente: "Condomínio Residencial Atlântico",
    dataVencimento: "2025-10-15",
    vendedor: "Carlos Mendes",
    status: "vencendo",
  },
  {
    id: "2",
    cliente: "Edifício Barra Garden",
    dataVencimento: "2025-10-20",
    vendedor: "Roberto Lima",
    status: "vencendo",
  },
  {
    id: "3",
    cliente: "Residencial Tijuca Plaza",
    dataVencimento: "2025-10-25",
    vendedor: "Fernanda Souza",
    status: "ok",
  },
]

export function MaintenanceAlerts() {
  return (
    <div className="space-y-4">
      {alerts.map((alert) => (
        <div key={alert.id} className="flex items-start justify-between p-4 rounded-lg border border-border bg-card/50">
          <div className="space-y-1 flex-1">
            <p className="font-medium text-sm text-foreground">{alert.cliente}</p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(alert.dataVencimento).toLocaleDateString("pt-BR")}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {alert.vendedor}
              </span>
            </div>
          </div>
          <Badge variant={alert.status === "vencendo" ? "destructive" : "secondary"} className="ml-2">
            {alert.status === "vencendo" ? "Vencendo" : "OK"}
          </Badge>
        </div>
      ))}
    </div>
  )
}
