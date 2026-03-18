"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react"

const activities = [
  {
    id: "1",
    user: "Carlos Mendes",
    action: "Fechou contrato com Condomínio Atlântico",
    time: "2 horas atrás",
    type: "success",
  },
  {
    id: "2",
    user: "José Técnico",
    action: "Concluiu manutenção no Edifício Barra Garden",
    time: "4 horas atrás",
    type: "success",
  },
  {
    id: "3",
    user: "SAC",
    action: "Aguardando aprovação de peças - Residencial Plaza",
    time: "5 horas atrás",
    type: "pending",
  },
  {
    id: "4",
    user: "Roberto Lima",
    action: "Cliente não renovou contrato",
    time: "1 dia atrás",
    type: "error",
  },
]

const iconMap = {
  success: CheckCircle2,
  pending: Clock,
  error: XCircle,
  warning: AlertCircle,
}

const colorMap = {
  success: "text-green-500",
  pending: "text-yellow-500",
  error: "text-red-500",
  warning: "text-orange-500",
}

export function RecentActivity() {
  return (
    <div className="space-y-4">
      {activities.map((activity) => {
        const Icon = iconMap[activity.type as keyof typeof iconMap]
        const color = colorMap[activity.type as keyof typeof colorMap]

        return (
          <div key={activity.id} className="flex items-start gap-4">
            <Avatar className="h-8 w-8 bg-secondary">
              <AvatarFallback className="text-xs text-secondary-foreground">
                {activity.user
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium text-foreground">{activity.user}</p>
              <p className="text-sm text-muted-foreground">{activity.action}</p>
              <p className="text-xs text-muted-foreground">{activity.time}</p>
            </div>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        )
      })}
    </div>
  )
}
