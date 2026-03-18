"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Can } from "@/components/auth/can"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, PlusCircle, Search, Trash2, Ban } from "lucide-react"
import { toDateInputValue } from "@/lib/date-utils"

type ItemSuggestion = {
  id: string
  nome: string
  valor: number
  categoria: string | null
}

type OrcamentoItemDraft = {
  itemId: string
  nome: string
  quantidade: number
  valor: number
}

interface EditarOrcamentoDialogProps {
  orcamentoId: number | null
  clienteId: number
  clienteNome?: string
  filialUf?: string | null
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

const ORCAMENTO_CANCEL_ROLES = ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] as const

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
})

const formatCurrency = (value: number) => currencyFormatter.format(value)

const MIN_SUGGESTION_LENGTH = 2
const SUGGESTION_LIMIT = 10
const SEARCH_THROTTLE_MS = 350

const getOrcamentoStatusStyle = (status: string | null) => {
  const rawStatus = status?.toUpperCase() ?? ""
  const isAprovado = rawStatus === "APROVADO" || rawStatus === "CONCLUIDO"
  const isCancelado = rawStatus === "CANCELADO"

  if (isCancelado) return "border-red-500 bg-red-100 text-red-700"
  if (isAprovado) return "border-emerald-500 bg-emerald-500 text-white"
  return "border-gray-400 bg-gray-200 text-gray-700"
}

const getOrcamentoStatusLabel = (status: string | null) => {
  const statusMap: Record<string, string> = {
    EM_ABERTO: "Em aberto",
    CANCELADO: "Cancelado",
    APROVADO: "Aprovado",
    CONCLUIDO: "Concluído",
    PENDENTE: "Pendente",
  }
  return statusMap[status?.toUpperCase() ?? ""] ?? status ?? "—"
}

export function EditarOrcamentoDialog({
  orcamentoId,
  clienteId,
  clienteNome,
  filialUf,
  open,
  onClose,
  onSuccess,
}: EditarOrcamentoDialogProps) {
  const { toast } = useToast()
  const [empresas, setEmpresas] = useState<Array<{ id: number; nome: string }>>([])
  const [empresaId, setEmpresaId] = useState<number>(1)
  const [empresasLoading, setEmpresasLoading] = useState(false)

  const [itemSearch, setItemSearch] = useState("")
  const [suggestions, setSuggestions] = useState<ItemSuggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [suggestionError, setSuggestionError] = useState<string | null>(null)

  const [items, setItems] = useState<OrcamentoItemDraft[]>([])
  const [parcelasInput, setParcelasInput] = useState("")
  const [primeiroVencimento, setPrimeiroVencimento] = useState("")
  const [garantiaInput, setGarantiaInput] = useState("")
  const [observacoes, setObservacoes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [statusBloqueado, setStatusBloqueado] = useState(false)
  const [orcamentoStatus, setOrcamentoStatus] = useState<string | null>(null)
  const [loadingOrcamento, setLoadingOrcamento] = useState(true)
  const [searchFocused, setSearchFocused] = useState(false)
  const [showAddItems, setShowAddItems] = useState(false)
  const [originalSignature, setOriginalSignature] = useState("")
  const [originalItemIds, setOriginalItemIds] = useState<string[]>([])
  const [tirarPedidoLoading, setTirarPedidoLoading] = useState(false)
  const [cancelandoOrcamento, setCancelandoOrcamento] = useState(false)

  const throttledTermRef = useRef("")
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const searchBlurTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const total = useMemo(
    () => items.reduce((acc, item) => acc + item.quantidade * item.valor, 0),
    [items],
  )
  const parcelasNumber = parcelasInput ? Number.parseInt(parcelasInput, 10) : null

  const buildSignature = useCallback((data: {
    empresaId?: number
    parcelas?: string
    primeiroVencimento?: string
    garantia?: string
    observacoes?: string
    items?: OrcamentoItemDraft[]
  }) => {
    return JSON.stringify({
      empresaId: data.empresaId ?? 1,
      parcelas: data.parcelas ?? "",
      primeiroVencimento: data.primeiroVencimento ?? "",
      garantia: data.garantia ?? "",
      observacoes: data.observacoes ?? "",
      items: (data.items ?? []).map((i) => ({
        itemId: i.itemId,
        quantidade: i.quantidade,
        valor: i.valor,
      })),
    })
  }, [])

  const currentSignature = useMemo(
    () => buildSignature({
      empresaId,
      parcelas: parcelasInput,
      primeiroVencimento,
      garantia: garantiaInput,
      observacoes,
      items,
    }),
    [buildSignature, empresaId, parcelasInput, primeiroVencimento, garantiaInput, observacoes, items],
  )

  const hasChanges = useMemo(() => {
    if (originalSignature === "") return false
    if (currentSignature !== originalSignature) return true
    // Also check if items were removed (in case signature comparison has issues)
    const currentItemIds = items.map(i => i.itemId)
    const itemsRemoved = originalItemIds.some(id => !currentItemIds.includes(id))
    const itemsAdded = currentItemIds.some(id => !originalItemIds.includes(id))
    return itemsRemoved || itemsAdded
  }, [currentSignature, originalSignature, items, originalItemIds])

  const canSubmit =
    !submitting &&
    items.length > 0 &&
    Boolean(primeiroVencimento) &&
    Boolean(parcelasNumber && parcelasNumber > 0) &&
    !statusBloqueado &&
    hasChanges

  const resetForm = useCallback(() => {
    setItemSearch("")
    setSuggestions([])
    setSuggestionError(null)
    setItems([])
    setParcelasInput("")
    setPrimeiroVencimento("")
    setGarantiaInput("")
    setObservacoes("")
    setSubmitting(false)
    setFormError(null)
    setStatusBloqueado(false)
    setOrcamentoStatus(null)
    throttledTermRef.current = ""
    setSearchFocused(false)
    setShowAddItems(false)
    setOriginalSignature("")
    setOriginalItemIds([])
    if (searchBlurTimeoutRef.current) {
      clearTimeout(searchBlurTimeoutRef.current)
      searchBlurTimeoutRef.current = null
    }
    if (throttleTimeoutRef.current) {
      clearTimeout(throttleTimeoutRef.current)
      throttleTimeoutRef.current = null
    }
    setEmpresaId(1)
  }, [])

  const fetchSuggestions = useCallback(
    async (term: string) => {
      if (!open) return

      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      const controller = new AbortController()
      abortControllerRef.current = controller

      setLoadingSuggestions(true)
      setSuggestionError(null)

      try {
        const params = new URLSearchParams()
        if (term.trim().length > 0) {
          params.set("query", term.trim())
        }
        params.set("limit", String(SUGGESTION_LIMIT))

        const response = await fetch(`/api/items?${params.toString()}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error("Erro ao carregar produtos/serviços.")
        }

        const result = await response.json()
        setSuggestions(Array.isArray(result.data) ? result.data : [])
      } catch (error) {
        if ((error as Error).name === "AbortError") return
        console.error(error)
        setSuggestionError("Não foi possível carregar os produtos. Tente novamente.")
      } finally {
        setLoadingSuggestions(false)
      }
    },
    [open],
  )

  const scheduleSuggestionFetch = useCallback(
    (term: string) => {
      throttledTermRef.current = term
      if (throttleTimeoutRef.current) return
      throttleTimeoutRef.current = setTimeout(() => {
        throttleTimeoutRef.current = null
        fetchSuggestions(throttledTermRef.current)
      }, SEARCH_THROTTLE_MS)
    },
    [fetchSuggestions],
  )

  const loadEmpresas = useCallback(async () => {
    try {
      setEmpresasLoading(true)
      const empRes = await fetch("/api/empresas")
      const empJson = await empRes.json().catch(() => ({}))
      if (!empRes.ok) throw new Error(empJson?.error || "Erro ao carregar empresas")
      const lista = Array.isArray(empJson?.data) ? empJson.data : []
      setEmpresas(lista)
      let defaultId = lista.some((e: { id: number }) => e.id === 1) ? 1 : lista[0]?.id
      if (defaultId) setEmpresaId(defaultId)
    } catch (err) {
      console.error(err)
      setEmpresas([])
      setEmpresaId(1)
    } finally {
      setEmpresasLoading(false)
    }
  }, [])

  const parseGarantiaFromObservacoes = (obs: string | null | undefined) => {
    if (!obs) return ""
    const match = obs.match(/garantia:\[(\d+)\]/i)
    return match ? match[1] : ""
  }

  const loadOrcamento = useCallback(async () => {
    if (!orcamentoId) {
      setLoadingOrcamento(false)
      return
    }
    try {
      setLoadingOrcamento(true)
      const res = await fetch(`/api/orcamentos/${orcamentoId}`)
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || "Erro ao carregar orçamento.")

      const data = payload.data
      if (!data) throw new Error("Dados do orçamento não encontrados.")

      const loadedEmpresaId = data.empresaId ?? 1
      const loadedParcelas = data.parcelas?.toString() ?? ""
      const loadedPrimeiroVencimento = toDateInputValue(data.primeiroVencimento)
      const loadedObservacoes = data.observacoes ?? ""
      const loadedGarantia = parseGarantiaFromObservacoes(data.observacoes)
      const loadedItems = (data.itens ?? []).map((it: any) => ({
        itemId: String(it.itemId),
        nome: it.nome,
        quantidade: it.quantidade,
        valor: it.valor,
      }))

      setEmpresaId(loadedEmpresaId)
      setParcelasInput(loadedParcelas)
      setPrimeiroVencimento(loadedPrimeiroVencimento)
      setObservacoes(loadedObservacoes)
      setGarantiaInput(loadedGarantia)
      setItems(loadedItems)
      setStatusBloqueado(data.status === "APROVADO" || data.status === "CANCELADO")
      setOrcamentoStatus(data.status ?? null)

      // Set original signature for change detection
      setOriginalSignature(buildSignature({
        empresaId: loadedEmpresaId,
        parcelas: loadedParcelas,
        primeiroVencimento: loadedPrimeiroVencimento,
        garantia: loadedGarantia,
        observacoes: loadedObservacoes,
        items: loadedItems,
      }))
      setOriginalItemIds(loadedItems.map((it: OrcamentoItemDraft) => it.itemId))
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Erro ao carregar orçamento",
        description: error instanceof Error ? error.message : "Falha ao carregar dados.",
      })
    }
    setLoadingOrcamento(false)
  }, [orcamentoId, toast])

  useEffect(() => {
    if (open) {
      setLoadingOrcamento(true)
      fetchSuggestions("")
      loadEmpresas().catch(console.error)
      loadOrcamento().catch(console.error)
    } else {
      resetForm()
    }

    return () => {
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current)
        throttleTimeoutRef.current = null
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (searchBlurTimeoutRef.current) {
        clearTimeout(searchBlurTimeoutRef.current)
        searchBlurTimeoutRef.current = null
      }
    }
  }, [open, fetchSuggestions, loadEmpresas, loadOrcamento, resetForm])

  const addItemFromSuggestion = useCallback((suggestion: ItemSuggestion) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.itemId === suggestion.id)
      if (existing) {
        return prev.map((item) =>
          item.itemId === suggestion.id ? { ...item, quantidade: item.quantidade + 1 } : item,
        )
      }
      return [
        ...prev,
        {
          itemId: suggestion.id,
          nome: suggestion.nome,
          quantidade: 1,
          valor: suggestion.valor,
        },
      ]
    })
    setItemSearch("")
    setSuggestions([])
  }, [])

  const handleItemFieldChange = (itemId: string, field: "quantidade" | "valor", value: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.itemId !== itemId) return item
        if (field === "quantidade") {
          const parsed = Number.parseInt(value, 10)
          return { ...item, quantidade: Number.isNaN(parsed) || parsed <= 0 ? 1 : parsed }
        }
        const parsed = Number.parseFloat(value.replace(",", "."))
        return { ...item, valor: Number.isNaN(parsed) || parsed < 0 ? 0 : Number(parsed.toFixed(2)) }
      }),
    )
  }

  const removeItem = (itemId: string) => {
    setItems((prev) => {
      const newItems = prev.filter((item) => item.itemId !== itemId)
      // Force a new array reference to ensure React detects the change
      return [...newItems]
    })
  }

  const handleTirarPedido = async () => {
    if (!orcamentoId) return
    setTirarPedidoLoading(true)
    try {
      const response = await fetch(`/api/orcamentos/${orcamentoId}/pedido`, {
        method: "POST",
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(result.error ?? "Erro ao tirar pedido.")
      }
      toast({
        title: "Pedido criado!",
        description: `Pedido #${result.data?.id} criado com sucesso.`,
      })
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : "Erro ao tirar pedido."
      toast({
        title: "Erro ao tirar pedido",
        description: message,
        variant: "destructive",
      })
    } finally {
      setTirarPedidoLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (items.length === 0) {
      setFormError("Adicione pelo menos um produto ou serviço.")
      return
    }
    if (!primeiroVencimento) {
      setFormError("Informe a data do 1º vencimento.")
      return
    }
    if (!parcelasNumber || parcelasNumber <= 0) {
      setFormError("Informe um número válido de parcelas.")
      return
    }
    if (statusBloqueado) {
      setFormError("Orçamento aprovado ou cancelado não pode ser alterado.")
      return
    }

    setFormError(null)
    setSubmitting(true)
    try {
      const payload = {
        empresaId,
        itens: items.map((item) => ({
          itemId: Number(item.itemId),
          quantidade: item.quantidade,
          valor: item.valor,
        })),
        parcelas: parcelasNumber,
        primeiroVencimento,
        garantiaMeses: garantiaInput ? Number.parseInt(garantiaInput, 10) : null,
        observacoes: observacoes.trim() || null,
      }

      const response = await fetch(`/api/orcamentos/${orcamentoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(result.error ?? "Erro ao atualizar orçamento.")
      }

      toast({
        title: "Orçamento atualizado!",
        description: `Total ${formatCurrency(total)} para ${clienteNome ?? "o cliente"}.`,
      })

      onSuccess?.()
      onClose()
      resetForm()
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : "Erro ao atualizar orçamento."
      setFormError(message)
      toast({
        title: "Não foi possível atualizar o orçamento",
        description: message,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelarOrcamento = async () => {
    if (!orcamentoId) return
    if (!window.confirm(`Cancelar o orçamento #${orcamentoId}?`)) return
    setCancelandoOrcamento(true)
    try {
      const response = await fetch(`/api/orcamentos/${orcamentoId}/cancelar`, { method: "POST" })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(result.error ?? "Erro ao cancelar orçamento.")
      }
      toast({
        title: "Orçamento cancelado",
        description: `Orçamento #${orcamentoId} marcado como cancelado.`,
      })
      setOrcamentoStatus("CANCELADO")
      setStatusBloqueado(true)
      onSuccess?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao cancelar orçamento."
      toast({
        title: "Erro ao cancelar orçamento",
        description: message,
        variant: "destructive",
      })
    } finally {
      setCancelandoOrcamento(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => (!value ? onClose() : undefined)}>
      <DialogContent className="w-[min(100vw-2rem,860px)] max-h-[85vh] overflow-hidden sm:max-w-3xl border-border bg-card shadow-2xl">
        <DialogHeader className="flex flex-row items-start pt-5 justify-between gap-4">
          <div>
            <DialogTitle className="text-[14px] flex items-center gap-2">
              Orçamento #{orcamentoId}
              {orcamentoStatus && (
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${getOrcamentoStatusStyle(orcamentoStatus)}`}>
                  {getOrcamentoStatusLabel(orcamentoStatus)}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-[12px] text-muted-foreground">
              {clienteNome ?? "Cliente"}{filialUf && ` • Filial: ${filialUf}`} • {empresaId === 1 ? "Unidade 1" : empresaId === 2 ? "Unidade 2" : "Empresa Selecionada"}
            </DialogDescription>
          </div>
          {!statusBloqueado && !loadingOrcamento && (
            <div className="flex items-center gap-2">
              <Can roles={[...ORCAMENTO_CANCEL_ROLES]}>
                <Button
                  variant="outline"
                  className="h-8 px-3 text-[12px] text-red-600 hover:text-red-700"
                  onClick={handleCancelarOrcamento}
                  disabled={cancelandoOrcamento}
                >
                  {cancelandoOrcamento ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Ban className="mr-1 h-3 w-3" />}
                  Cancelar orçamento
                </Button>
              </Can>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={tirarPedidoLoading || items.length === 0 || hasChanges}
                    className="h-8 px-3 text-[12px] bg-emerald-600 hover:bg-emerald-700"
                    title={hasChanges ? "Salve as alterações antes de tirar pedido" : undefined}
                  >
                    {tirarPedidoLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                    Tirar Pedido
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar criação de pedido</AlertDialogTitle>
                    <AlertDialogDescription>
                      Deseja criar um pedido a partir deste orçamento? Esta ação irá gerar um novo pedido com os itens atuais.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={tirarPedidoLoading}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleTirarPedido}
                      disabled={tirarPedidoLoading}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {tirarPedidoLoading ? "Criando..." : "Confirmar"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-120px)] pr-3">
          <div className="space-y-4 py-1">
            {loadingOrcamento ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <p className="text-[13px]">Carregando...</p>
              </div>
            ) : (
              <>


                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-[12px] font-semibold text-foreground">Empresa</Label>
                    <Select
                      value={empresasLoading ? undefined : String(empresaId)}
                      onValueChange={(value) => setEmpresaId(Number(value))}
                      disabled={empresasLoading || statusBloqueado}
                    >
                      <SelectTrigger className="h-8 text-[13px]">
                        <SelectValue placeholder={empresasLoading ? "Carregando..." : "Selecione a empresa"} />
                      </SelectTrigger>
                      <SelectContent>
                        {empresas.map((empresa) => (
                          <SelectItem key={empresa.id} value={String(empresa.id)}>
                            {empresa.id === 1 ? "Unidade 1" : empresa.id === 2 ? "Unidade 2" : empresa.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {!statusBloqueado && showAddItems && (
                    <div className="flex flex-col gap-2 rounded-md border border-border/80 bg-muted/30 p-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <div className="flex-1 relative">
                          <Input
                            placeholder="Busque por nome..."
                            value={itemSearch}
                            onChange={(event) => {
                              const value = event.target.value
                              setItemSearch(value)
                              if (value.trim().length === 0) {
                                scheduleSuggestionFetch("")
                                return
                              }
                              if (value.trim().length >= MIN_SUGGESTION_LENGTH) {
                                scheduleSuggestionFetch(value)
                              }
                            }}
                            className="pl-10 h-8 text-[13px]"
                            disabled={statusBloqueado}
                            onFocus={() => {
                              if (searchBlurTimeoutRef.current) {
                                clearTimeout(searchBlurTimeoutRef.current)
                                searchBlurTimeoutRef.current = null
                              }
                              setSearchFocused(true)
                            }}
                            onBlur={() => {
                              if (searchBlurTimeoutRef.current) clearTimeout(searchBlurTimeoutRef.current)
                              searchBlurTimeoutRef.current = setTimeout(() => setSearchFocused(false), 200)
                            }}
                            autoFocus
                          />
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowAddItems(false)
                            setItemSearch("")
                            setSearchFocused(false)
                          }}
                          className="h-8 px-2 text-[11px] text-muted-foreground"
                        >
                          Fechar
                        </Button>
                      </div>
                      {searchFocused ? (
                        <div className="rounded-lg border border-dashed border-border/70 bg-background overflow-hidden">
                          <ScrollArea className="max-h-40 overflow-y-auto">
                            {loadingSuggestions ? (
                              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Carregando itens...
                              </div>
                            ) : suggestionError ? (
                              <div className="py-4 text-center text-sm text-destructive">{suggestionError}</div>
                            ) : suggestions.length === 0 ? (
                              <div className="py-4 text-center text-sm text-muted-foreground">
                                {itemSearch.trim().length >= MIN_SUGGESTION_LENGTH
                                  ? "Nenhum item encontrado."
                                  : "Digite ao menos duas letras para buscar."}
                              </div>
                            ) : (
                              <div className="divide-y divide-border/60 bg-secondary/20">
                                {suggestions.map((suggestion) => (
                                  <button
                                    key={suggestion.id}
                                    type="button"
                                    onMouseDown={(e) => {
                                      e.preventDefault()
                                      addItemFromSuggestion(suggestion)
                                    }}
                                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-secondary/40"
                                    disabled={statusBloqueado}
                                  >
                                    <div>
                                      <p className="text-[12px] font-semibold text-foreground">{suggestion.nome}</p>
                                      {suggestion.categoria && (
                                        <p className="text-[11px] text-muted-foreground">{suggestion.categoria}</p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-[12px] font-semibold text-foreground">
                                        {formatCurrency(suggestion.valor)}
                                      </span>
                                      <PlusCircle className="h-4 w-4 text-blue-600" />
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </ScrollArea>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {!statusBloqueado && !showAddItems && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddItems(true)
                        fetchSuggestions("")
                      }}
                      className="text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 mb-1"
                    >
                      <PlusCircle className="h-3 w-3" />
                      Adicionar produto/serviço
                    </button>
                  )}

                  <div className="rounded-lg border border-border/80 bg-card shadow-sm">
                    {items.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        Nenhum item adicionado.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            <TableHead className="py-1.5">Produto/Serviço</TableHead>
                            <TableHead className="w-24 py-1.5">Qtd</TableHead>
                            <TableHead className="w-28 py-1.5">Valor</TableHead>
                            <TableHead className="w-28 py-1.5">Subtotal</TableHead>
                            <TableHead className="w-10 py-1.5"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((item) => (
                            <TableRow key={item.itemId}>
                              <TableCell className="font-semibold text-foreground text-[12px] py-1.5">{item.nome}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={1}
                                  value={item.quantidade}
                                  onChange={(e) => handleItemFieldChange(item.itemId, "quantidade", e.target.value)}
                                  className="h-7 text-[12px]"
                                  disabled={statusBloqueado}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.valor}
                                  onChange={(e) => handleItemFieldChange(item.itemId, "valor", e.target.value)}
                                  className="h-7 text-[12px]"
                                  disabled={statusBloqueado}
                                />
                              </TableCell>
                              <TableCell className="font-semibold text-foreground text-[12px] py-1.5">
                                {formatCurrency(item.quantidade * item.valor)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => removeItem(item.itemId)}
                                  disabled={statusBloqueado}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell colSpan={3} className="text-right text-[11px] font-semibold uppercase text-muted-foreground py-1.5">
                              Total
                            </TableCell>
                            <TableCell className="font-semibold text-foreground text-[12px] py-1.5">
                              {formatCurrency(total)}
                            </TableCell>
                            <TableCell />
                          </TableRow>
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-[12px] font-semibold text-foreground">Parcelas</Label>
                    <Input
                      value={parcelasInput}
                      onChange={(e) => setParcelasInput(e.target.value)}
                      placeholder="Ex.: 12"
                      disabled={statusBloqueado}
                      className="h-8 text-[13px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[12px] font-semibold text-foreground">1º vencimento</Label>
                    <Input
                      type="date"
                      value={primeiroVencimento}
                      onChange={(e) => setPrimeiroVencimento(e.target.value)}
                      disabled={statusBloqueado}
                      className="h-8 text-[13px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[12px] font-semibold text-foreground">Garantia (meses)</Label>
                    <Input
                      value={garantiaInput}
                      onChange={(e) => setGarantiaInput(e.target.value)}
                      placeholder="Opcional"
                      disabled={statusBloqueado}
                      className="h-8 text-[13px]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[12px] font-semibold text-foreground">Observações</Label>
                  <Textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Informações adicionais"
                    className="min-h-20 text-[13px]"
                    disabled={statusBloqueado}
                  />
                </div>

                {formError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                ) : null}
              </>
            )}
          </div>
          <DialogFooter className="mt-4 pb-10 flex justify-between gap-3">
            <Button variant="outline" onClick={onClose} className="h-7 px-3 text-[12px]">
              Fechar
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit} variant={canSubmit ? "default" : "outline"} className="h-7 px-3 text-[12px]">
              {submitting ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
              Salvar alterações
            </Button>
          </DialogFooter>
        </ScrollArea>


      </DialogContent>
    </Dialog>
  )
}

