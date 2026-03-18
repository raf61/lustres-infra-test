"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, Wallet, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

type VendedorResumo = {
  id: string
  nome: string
  totalPedidos: number
  totalVendas: number
}

type VendedorComCarteira = VendedorResumo & {
  totalClientes?: number
  clientesVencidos?: number
}

type VendasExtrasStats = {
  totalPedidos: number
  totalVendas: number
}

type Periodo = "mes" | "trimestre" | "semestre" | "ano" | "total"
type Modo = "carteira" | "vendas"

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const getPeriodoLabel = (periodo: Periodo, mes: number, ano: number) => {
  switch (periodo) {
    case "mes": return `${MESES[mes - 1]} ${ano}`
    case "trimestre": {
      const t = Math.ceil(mes / 3)
      return `${t}º Tri ${ano}`
    }
    case "semestre": return `${mes <= 6 ? "1º" : "2º"} Sem ${ano}`
    case "ano": return `${ano}`
    case "total": return "Total"
  }
}

export function VendedoresAnalise() {
  const router = useRouter()

  // Modo: carteira ou vendas
  const [modo, setModo] = useState<Modo>("carteira")

  // Estado para modo vendas
  const [vendedores, setVendedores] = useState<VendedorResumo[]>([])
  const [semVendedor, setSemVendedor] = useState<VendasExtrasStats | null>(null)
  const [outrosVendedores, setOutrosVendedores] = useState<VendasExtrasStats | null>(null)
  const [loadingVendas, setLoadingVendas] = useState(false)

  // Estado para modo carteira
  const [vendedoresCarteira, setVendedoresCarteira] = useState<VendedorComCarteira[]>([])
  const [loadingCarteira, setLoadingCarteira] = useState(true)

  const [error, setError] = useState<string | null>(null)

  // Estado do período (só para modo vendas)
  const now = new Date()
  const [periodo, setPeriodo] = useState<Periodo>("mes")
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())

  // Fetch carteira de vendedores
  const fetchCarteira = useCallback(async () => {
    setLoadingCarteira(true)
    setError(null)
    try {
      // Buscar vendedores base
      const res = await fetch(`/api/vendedores/analise?periodo=total`, { cache: "no-store" })
      if (!res.ok) throw new Error("Falha ao carregar vendedores")
      const json = await res.json()
      const vendedoresBase: VendedorResumo[] = json.data ?? []

      // Para cada vendedor, buscar quantidade de clientes e vencidos
      const vendedoresComCarteira: VendedorComCarteira[] = await Promise.all(
        vendedoresBase.map(async (v) => {
          try {
            const resDetail = await fetch(`/api/vendedores/${v.id}/analise`, { cache: "no-store" })
            if (!resDetail.ok) return { ...v, totalClientes: 0, clientesVencidos: 0 }
            const detail = await resDetail.json()
            return {
              ...v,
              totalClientes: detail.data?.totalClientes ?? 0,
              clientesVencidos: detail.data?.clientesVencidos ?? 0,
            }
          } catch {
            return { ...v, totalClientes: 0, clientesVencidos: 0 }
          }
        })
      )

      // Ordenar por quantidade de clientes (decrescente)
      vendedoresComCarteira.sort((a, b) => (b.totalClientes ?? 0) - (a.totalClientes ?? 0))
      setVendedoresCarteira(vendedoresComCarteira)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setLoadingCarteira(false)
    }
  }, [])

  // Fetch vendas do período
  const fetchVendas = useCallback(async () => {
    setLoadingVendas(true)
    setError(null)
    try {
      const params = new URLSearchParams({ periodo, mes: String(mes), ano: String(ano) })
      const res = await fetch(`/api/vendedores/analise?${params}`, { cache: "no-store" })
      if (!res.ok) throw new Error("Falha ao carregar vendedores")
      const json = await res.json()
      setVendedores(json.data ?? [])
      setSemVendedor(json.semVendedor ?? null)
      setOutrosVendedores(json.outrosVendedores ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setLoadingVendas(false)
    }
  }, [periodo, mes, ano])

  useEffect(() => {
    if (modo === "carteira") {
      fetchCarteira()
    } else {
      fetchVendas()
    }
  }, [modo, fetchCarteira, fetchVendas])

  const navegarPeriodo = (direcao: "anterior" | "proximo") => {
    if (periodo === "total") return

    const delta = direcao === "anterior" ? -1 : 1

    if (periodo === "mes") {
      let novoMes = mes + delta
      let novoAno = ano
      if (novoMes < 1) { novoMes = 12; novoAno-- }
      if (novoMes > 12) { novoMes = 1; novoAno++ }
      setMes(novoMes)
      setAno(novoAno)
    } else if (periodo === "trimestre") {
      let novoMes = mes + (delta * 3)
      let novoAno = ano
      if (novoMes < 1) { novoMes = 10; novoAno-- }
      if (novoMes > 12) { novoMes = 1; novoAno++ }
      setMes(novoMes)
      setAno(novoAno)
    } else if (periodo === "semestre") {
      let novoMes = mes + (delta * 6)
      let novoAno = ano
      if (novoMes < 1) { novoMes = 7; novoAno-- }
      if (novoMes > 12) { novoMes = 1; novoAno++ }
      setMes(novoMes)
      setAno(novoAno)
    } else if (periodo === "ano") {
      setAno(ano + delta)
    }
  }

  // Clique em vendedor vai direto para a rota
  const handleVendedorClick = (vendedorId: string) => {
    router.push(`/dashboard/analise-vendedores?vendedorId=${vendedorId}`)
  }

  // Clique no card (área sem vendedor) vai para a rota geral
  const handleCardClick = (e: React.MouseEvent) => {
    // Só navega se clicou diretamente no container, não em um vendedor
    if (e.target === e.currentTarget) {
      router.push("/dashboard/analise-vendedores")
    }
  }

  const loading = modo === "carteira" ? loadingCarteira : loadingVendas
  const listaVendedores = modo === "carteira" ? vendedoresCarteira : vendedores

  // Seletor de modo
  const ModoSelector = () => (
    <div className="flex items-center gap-1 mb-2">
      <Button
        variant={modo === "carteira" ? "default" : "ghost"}
        size="sm"
        className={cn(
          "h-7 text-[10px] font-bold uppercase tracking-wider px-3",
          modo === "carteira" ? "bg-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
        )}
        onClick={() => setModo("carteira")}
      >
        Carteira
      </Button>
      <Button
        variant={modo === "vendas" ? "default" : "ghost"}
        size="sm"
        className={cn(
          "h-7 text-[10px] font-bold uppercase tracking-wider px-3",
          modo === "vendas" ? "bg-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
        )}
        onClick={() => setModo("vendas")}
      >
        Vendas
      </Button>
    </div>
  )

  // Seletor de período (só para modo vendas)
  const PeriodoSelector = () => (
    <div className="flex items-center justify-between gap-2 mb-2 p-1.5 bg-slate-50 rounded-lg border border-slate-100">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => navegarPeriodo("anterior")}
          disabled={periodo === "total"}
        >
          <ChevronLeft className="h-3 w-3" />
        </Button>
        <span className="text-[10px] font-bold text-slate-600 min-w-[70px] text-center uppercase tracking-tight">
          {getPeriodoLabel(periodo, mes, ano)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => navegarPeriodo("proximo")}
          disabled={periodo === "total"}
        >
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
      <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
        <SelectTrigger className="h-6 w-[80px] text-[10px] bg-white border-slate-200">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="mes" className="text-[10px]">Mês</SelectItem>
          <SelectItem value="trimestre" className="text-[10px]">Trimestre</SelectItem>
          <SelectItem value="semestre" className="text-[10px]">Semestre</SelectItem>
          <SelectItem value="ano" className="text-[10px]">Ano</SelectItem>
          <SelectItem value="total" className="text-[10px]">Total</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )

  if (error) {
    return (
      <div>
        <ModoSelector />
        <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={modo === "carteira" ? fetchCarteira : fetchVendas}>
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div>
        <ModoSelector />
        {modo === "vendas" && <PeriodoSelector />}
        <div className="flex min-h-[180px] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  // Verificar se há algo para mostrar (vendedores OU extras no modo vendas)
  const temSemVendedor = modo === "vendas" && semVendedor && (semVendedor.totalPedidos > 0 || semVendedor.totalVendas > 0)
  const temOutrosVendedores = modo === "vendas" && outrosVendedores && (outrosVendedores.totalPedidos > 0 || outrosVendedores.totalVendas > 0)
  const temAlgoParaMostrar = listaVendedores.length > 0 || temSemVendedor || temOutrosVendedores

  if (!temAlgoParaMostrar) {
    return (
      <div>
        <ModoSelector />
        {modo === "vendas" && <PeriodoSelector />}
        <div className="flex min-h-[180px] items-center justify-center text-sm text-muted-foreground">
          {modo === "carteira" ? "Nenhum vendedor encontrado." : "Nenhuma venda no período."}
        </div>
      </div>
    )
  }

  return (
    <div onClick={handleCardClick} className="cursor-pointer">
      <ModoSelector />
      {modo === "vendas" && <PeriodoSelector />}

      <div className="space-y-0.5 max-h-[220px] overflow-y-auto">
        {listaVendedores.map((vendedor) => {
          const isCarteira = modo === "carteira"
          const vendedorCarteira = vendedor as VendedorComCarteira
          const valorPrincipal = isCarteira
            ? vendedorCarteira.totalClientes ?? 0
            : vendedor.totalVendas
          const vencidos = vendedorCarteira.clientesVencidos ?? 0

          return (
            <div
              key={vendedor.id}
              onClick={(e) => {
                e.stopPropagation()
                handleVendedorClick(vendedor.id)
              }}
              className="flex items-center justify-between gap-2 px-2 py-2 border-b border-slate-50 last:border-0 cursor-pointer transition-colors hover:bg-slate-50/80"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase">
                  {vendedor.nome.substring(0, 2)}
                </div>
                <div className="flex flex-col min-w-0">
                  <p className="text-[11px] font-semibold text-slate-700 truncate">{vendedor.nome}</p>
                  {vencidos > 0 && (
                    <span className="text-[9px] font-medium text-orange-600">
                      {vencidos} follow-ups pendentes
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[11px] font-bold tabular-nums text-slate-900">
                {isCarteira ? valorPrincipal : formatCurrency(valorPrincipal)}
              </span>
            </div>
          )
        })}

        {/* Categorias extras - apenas no modo vendas, sempre no final (fora da ordenação) */}
        {(temOutrosVendedores || temSemVendedor) && (
          <div className="mt-2 pt-2 border-t border-slate-200 space-y-0.5">
            {/* Outros Vendedores (inativos) */}
            {temOutrosVendedores && (
              <div className="flex items-center justify-between gap-2 px-2 py-2 rounded-md">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-semibold w-4 text-center flex-shrink-0 text-slate-400">—</span>
                  <p className="text-[12px] font-medium text-slate-500 truncate italic">Outros vendedores</p>
                </div>
                <span className="text-[11px] font-semibold tabular-nums text-slate-400 max-w-[110px] truncate text-right">
                  {formatCurrency(outrosVendedores!.totalVendas)}
                </span>
              </div>
            )}

            {/* Sem Vendedor */}
            {temSemVendedor && (
              <div className="flex items-center justify-between gap-2 px-2 py-2 rounded-md">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-semibold w-4 text-center flex-shrink-0 text-slate-400">—</span>
                  <p className="text-[12px] font-medium text-slate-500 truncate italic">Sem vendedor</p>
                </div>
                <span className="text-[11px] font-semibold tabular-nums text-slate-400 max-w-[110px] truncate text-right">
                  {formatCurrency(semVendedor!.totalVendas)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
