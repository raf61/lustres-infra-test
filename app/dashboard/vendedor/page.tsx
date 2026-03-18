import { Suspense } from "react"
import { VendedorDashboard } from "@/components/dashboard/vendedor-dashboard"
import { ChatProvider } from "@/lib/chat"

function VendedorDashboardFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  )
}

export default function VendedorPage() {
  return (
    <Suspense fallback={<VendedorDashboardFallback />}>
      <VendedorDashboard />
    </Suspense>
  )
}
