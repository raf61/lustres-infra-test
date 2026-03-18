import { Suspense } from "react"
import { AnaliseTecnicosPage } from "@/components/analise-tecnicos/analise-tecnicos-page"

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AnaliseTecnicosPage />
    </Suspense>
  )
}

