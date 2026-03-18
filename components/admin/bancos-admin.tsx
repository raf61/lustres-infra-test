"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Banknote, Loader2 } from "lucide-react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

type Banco = {
  id: number
  nome: string
  razaoSocial: string
  cnpj: string
  bancoCodigo: number
  agencia: string
  agenciaDigito: string | null
  conta: string
  contaDigito: string | null
  carteira: string
  codigoBeneficiario: string | null
  codigoTransmissao: string | null
  endereco: Record<string, any> | null
  createdAt: string
  updatedAt: string
}

const fetchJson = async <T,>(input: RequestInfo, init?: RequestInit) => {
  const res = await fetch(input, init)
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(payload?.error || "Erro ao carregar dados.")
  }
  return payload as T
}

export function BancosAdmin() {
  const [bancos, setBancos] = useState<Banco[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadBancos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchJson<{ data: Banco[] }>("/api/bancos", { cache: "no-store" })
      setBancos(result.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar bancos.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBancos().catch(console.error)
  }, [loadBancos])

  const tableContent = useMemo(() => {
    if (loading) {
      return (
        <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Carregando...
        </div>
      )
    }
    if (error) {
      return (
        <div className="flex items-center justify-between rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => loadBancos().catch(console.error)}>
            Tentar novamente
          </Button>
        </div>
      )
    }
    return (
        
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px] text-xs uppercase text-muted-foreground">ID</TableHead>
              <TableHead className="min-w-[200px] text-xs uppercase text-muted-foreground">Nome</TableHead>
              <TableHead className="text-xs uppercase text-muted-foreground">CNPJ</TableHead>
              <TableHead className="text-xs uppercase text-muted-foreground">Banco</TableHead>
              <TableHead className="text-xs uppercase text-muted-foreground">Agência</TableHead>
              <TableHead className="text-xs uppercase text-muted-foreground">Conta</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {bancos.map((banco) => (
              <TableRow key={banco.id} className="hover:bg-slate-50">
                <TableCell className="font-semibold text-foreground">#{banco.id}</TableCell>
                <TableCell>
                  <div className="font-medium text-foreground">{banco.nome}</div>
                  <p className="text-xs text-muted-foreground">{banco.razaoSocial}</p>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{banco.cnpj}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{banco.bancoCodigo}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {banco.agencia}
                  {banco.agenciaDigito ? `-${banco.agenciaDigito}` : ""}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {banco.conta}
                  {banco.contaDigito ? `-${banco.contaDigito}` : ""}
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }, [bancos, error, loadBancos, loading])

  return (
    <DashboardLayout>
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Banknote className="h-6 w-6 text-blue-700" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Bancos</h1>
            <p className="text-sm text-muted-foreground">Visualização de bancos cadastrados.</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de bancos</CardTitle>
        </CardHeader>
        <CardContent>{tableContent}</CardContent>
      </Card>

    </div>
    </DashboardLayout>
  )
}

