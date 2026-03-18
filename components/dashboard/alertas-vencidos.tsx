"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, AlertCircle, RefreshCw, Clock, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ClienteDetailDialog } from "@/components/leads/cliente-detail-dialog"

type ClienteVencido = {
  id: number
  cnpj: string
  razaoSocial: string
  cidade: string | null
  estado: string | null
  vendedorNome: string | null
  ultimoPedidoData: string | null
  mesVencimento: string
  diasVencido: number
}

const formatRazaoSocial = (razao: string) => {
  if (!razao) return "—"
  return razao
}

export function AlertasVencidos() {
  const [clientes, setClientes] = useState<ClienteVencido[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null)

  const fetchVencidos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/clientes/vencidos", { cache: "no-store" })
      if (!res.ok) throw new Error("Falha ao carregar clientes vencidos")
      const json = await res.json()
      setClientes(json.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchVencidos()
  }, [fetchVencidos])

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-[10px] font-black uppercase text-destructive tracking-widest">
        <AlertCircle className="h-5 w-5" />
        <span>{error}</span>
        <Button variant="outline" size="sm" onClick={fetchVencidos} className="mt-2 text-[10px] font-black uppercase tracking-widest border-destructive/20 hover:bg-destructive/10">
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (clientes.length === 0) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
        <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center shadow-lg kpi-glow border border-emerald-500/20">
          <AlertCircle className="h-6 w-6 text-emerald-500" />
        </div>
        <div>
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Base em dia</p>
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight mt-1">Todos os clientes ativos estão saudáveis.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {/* Header com total */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/50">
          <Badge variant="destructive" className="text-[9px] font-black uppercase tracking-widest kpi-glow">
            {clientes.length} RISCO{clientes.length !== 1 ? "S" : ""}
          </Badge>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-background" onClick={fetchVencidos}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Lista de clientes */}
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border">
          {clientes.map((cliente) => (
            <div
              key={cliente.id}
              onClick={() => setSelectedClienteId(cliente.id)}
              className={cn(
                "rounded-xl p-3 border transition-all cursor-pointer hover:shadow-2xl relative overflow-hidden group",
                cliente.diasVencido > 60
                  ? "bg-red-500/5 border-red-500/20 hover:border-red-500/40"
                  : cliente.diasVencido > 30
                    ? "bg-orange-500/5 border-orange-500/20 hover:border-orange-500/40"
                    : "bg-amber-500/5 border-amber-200/20 hover:border-amber-400/40"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-foreground truncate uppercase tracking-widest group-hover:text-primary transition-colors">
                    {formatRazaoSocial(cliente.razaoSocial)}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2 text-[9px] font-bold text-muted-foreground uppercase tracking-tight">
                    <User className="h-3 w-3 flex-shrink-0 text-primary/60" />
                    <span className="truncate">{cliente.vendedorNome ?? "Sem vendedor"}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <Badge
                    className={cn(
                      "text-[9px] font-black uppercase mb-1 shadow-lg",
                      cliente.diasVencido > 60 ? "bg-red-600 text-white" : cliente.diasVencido > 30 ? "bg-orange-600 text-white" : "bg-amber-500 text-white"
                    )}
                  >
                    {cliente.diasVencido}D
                  </Badge>
                  <div className="flex items-center gap-1 justify-end text-[8px] font-black text-muted-foreground/60 uppercase tracking-widest mt-1">
                    <Clock className="h-2.5 w-2.5" />
                    {cliente.mesVencimento}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ClientDetailDialog */}
      {selectedClienteId && (
        <ClienteDetailDialog
          clienteId={selectedClienteId}
          open={!!selectedClienteId}
          onClose={() => setSelectedClienteId(null)}
        />
      )}
    </>
  )
}
