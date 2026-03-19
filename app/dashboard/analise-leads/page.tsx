"use client"

import { Suspense } from "react"
import { AnaliseLeadsPage } from "@/components/analise-leads/analise-leads-page"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Loader2 } from "lucide-react"

export default function Page() {
  return (
    <DashboardLayout>
      <Suspense
        fallback={
          <div className="flex min-h-[400px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <AnaliseLeadsPage />
      </Suspense>
    </DashboardLayout>
  )
}
