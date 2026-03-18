"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Eye } from "lucide-react"

type PesquisadorResumo = {
  id: string
  nome: string
  totalFichas: number
}

export function PesquisadoresAnalise() {
  const [data, setData] = useState<PesquisadorResumo[]>([])
  const [totalGlobal, setTotalGlobal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/pesquisadores/analise?periodo=mes&tipo=ENVIADO", { cache: "no-store" })
        const payload = await response.json()
        setData(payload.data ?? [])
        setTotalGlobal(typeof payload.totalFichasGlobal === "number" ? payload.totalFichasGlobal : null)
      } catch (error) {
        console.error("Erro ao carregar pesquisadores:", error)
        setData([])
        setTotalGlobal(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totalMes = useMemo(
    () => (typeof totalGlobal === "number" ? totalGlobal : data.reduce((acc, item) => acc + (item.totalFichas ?? 0), 0)),
    [data, totalGlobal],
  )

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando pesquisadores...</p>
  }

  if (!data.length) {
    return <p className="text-sm text-muted-foreground">Nenhum pesquisador encontrado.</p>
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Total apuradas no mês: <span className="font-semibold text-foreground">{totalMes}</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">Ver</TableHead>
            <TableHead>Pesquisador</TableHead>
            <TableHead>Apuradas (mês)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <Button asChild size="icon" variant="ghost">
                  <Link href={`/dashboard/analise-pesquisadores?pesquisadorId=${p.id}`}>
                    <Eye className="h-4 w-4" />
                  </Link>
                </Button>
              </TableCell>
              <TableCell className="font-medium">{p.nome}</TableCell>
              <TableCell>{p.totalFichas}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

