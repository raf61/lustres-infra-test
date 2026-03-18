import { Suspense } from "react"
import { AnalisePesquisadoresPage } from "@/components/analise-pesquisadores/analise-pesquisadores-page"

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AnalisePesquisadoresPage />
    </Suspense>
  )
}

