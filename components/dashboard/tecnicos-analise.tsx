"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Eye } from "lucide-react"

type TecnicoResumo = {
  id: string
  nome: string
  pendentes: number
  emExecucao: null | {
    visitaId: number
    pedidoId: number | null
    endereco: string
  }
}

export function TecnicosAnalise() {
  const [data, setData] = useState<TecnicoResumo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/dashboard/master/tecnicos", { cache: "no-store" })
        const payload = await response.json()
        setData(payload.data ?? [])
      } catch (error) {
        console.error("Erro ao carregar técnicos:", error)
        setData([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando técnicos...</p>
  }

  if (!data.length) {
    return <p className="text-sm text-muted-foreground">Nenhum técnico encontrado.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[60px]">Ver</TableHead>
          <TableHead>Técnico</TableHead>
          <TableHead>Visitas pendentes</TableHead>
          <TableHead>Em execução</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((tecnico) => (
          <TableRow key={tecnico.id}>
            <TableCell>
              <Button asChild size="icon" variant="ghost">
                <Link href={`/dashboard/tecnico?tecnicoId=${tecnico.id}`}>
                  <Eye className="h-4 w-4" />
                </Link>
              </Button>
            </TableCell>
            <TableCell className="font-medium">{tecnico.nome}</TableCell>
            <TableCell>{tecnico.pendentes}</TableCell>
            <TableCell>
              {tecnico.emExecucao ? (
                <div className="space-y-1 text-xs">
                  <Badge variant="secondary">Em execução</Badge>
                  <div>{tecnico.emExecucao.endereco}</div>
                  <div className="text-muted-foreground">
                    Pedido #{tecnico.emExecucao.pedidoId ?? "—"}
                  </div>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

