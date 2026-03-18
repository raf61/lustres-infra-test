import { Suspense } from "react"
import { ServicosTecnicos } from "@/components/tecnico/servicos-tecnicos"

export default function TecnicoPage() {
  return (
    <Suspense fallback={null}>
      <ServicosTecnicos />
    </Suspense>
  )
}
