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
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, PlusCircle, Search, Trash2 } from "lucide-react"

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

interface CriarOrcamentoDialogProps {
  clienteId: string | number
  clienteNome?: string
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
})

const formatCurrency = (value: number) => currencyFormatter.format(value)

const MIN_SUGGESTION_LENGTH = 2
const SUGGESTION_LIMIT = 10
const SEARCH_THROTTLE_MS = 350

export function CriarOrcamentoDialog({ clienteId, clienteNome, open, onClose, onSuccess }: CriarOrcamentoDialogProps) {
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
  const [garantiaInput, setGarantiaInput] = useState("12")
  const [observacoes, setObservacoes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const throttledTermRef = useRef("")
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const total = useMemo(
    () => items.reduce((acc, item) => acc + item.quantidade * item.valor, 0),
    [items],
  )
  const parcelasNumber = parcelasInput ? Number.parseInt(parcelasInput, 10) : null
  const canSubmit =
    !submitting && items.length > 0 && Boolean(primeiroVencimento) && Boolean(parcelasNumber && parcelasNumber > 0)

  const resetForm = useCallback(() => {
    setItemSearch("")
    setSuggestions([])
    setSuggestionError(null)
    setItems([])
    setParcelasInput("")
    setPrimeiroVencimento("")
    setGarantiaInput("12")
    setObservacoes("")
    setSubmitting(false)
    setFormError(null)
    throttledTermRef.current = ""
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

  useEffect(() => {
    if (open) {
      fetchSuggestions("")
      const loadEmpresasEPadrao = async () => {
        try {
          setEmpresasLoading(true)
          const [empRes, lastEmpRes] = await Promise.all([
            fetch("/api/empresas"),
            fetch(`/api/clients/${clienteId}/last-empresa`),
          ])

          const empJson = await empRes.json().catch(() => ({}))
          if (!empRes.ok) throw new Error(empJson?.error || "Erro ao carregar empresas")
          const lista = Array.isArray(empJson?.data) ? empJson.data : []
          setEmpresas(lista)

          let defaultId = lista.some((e: { id: number }) => e.id === 1) ? 1 : lista[0]?.id

          const lastJson = await lastEmpRes.json().catch(() => ({}))
          if (lastEmpRes.ok && typeof lastJson?.empresaId === "number") {
            defaultId = lastJson.empresaId
          }

          if (defaultId) setEmpresaId(defaultId)
        } catch (err) {
          console.error(err)
          setEmpresas([])
          setEmpresaId(1)
        } finally {
          setEmpresasLoading(false)
        }
      }

      loadEmpresasEPadrao().catch(console.error)
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
    }
  }, [open, fetchSuggestions, resetForm])

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
    setItems((prev) => prev.filter((item) => item.itemId !== itemId))
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
    setFormError(null)
    setSubmitting(true)
    try {
      const payload = {
        clienteId,
        itens: items.map((item) => ({
          itemId: item.itemId,
          quantidade: item.quantidade,
          valor: item.valor,
        })),
        parcelas: parcelasNumber,
        primeiroVencimento,
        garantiaMeses: garantiaInput ? Number.parseInt(garantiaInput, 10) : null,
        observacoes: observacoes.trim() || null,
        empresaId,
      }

      const response = await fetch("/api/orcamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error ?? "Erro ao criar orçamento.")
      }

      toast({
        title: "Orçamento criado com sucesso!",
        description: `Total ${formatCurrency(total)} para ${clienteNome ?? "o cliente"}.`,
      })

      onSuccess?.()
      onClose()
      resetForm()
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : "Erro ao criar orçamento."
      setFormError(message)
      toast({
        title: "Não foi possível criar o orçamento",
        description: message,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => (!value ? onClose() : undefined)}>
      <DialogContent className="w-[min(100vw-2rem,960px)] max-h-[90vh] overflow-hidden sm:max-w-3xl border-border bg-card shadow-2xl">
        <DialogHeader>
          <DialogTitle>Criar orçamento</DialogTitle>
          <DialogDescription>
            Monte um orçamento oficial para {clienteNome ?? "o cliente"} utilizando apenas produtos/serviços cadastrados.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-140px)] pr-3">
          <div className="space-y-6 py-2">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">Empresa</Label>
                <Select
                  value={empresasLoading ? undefined : String(empresaId)}
                  onValueChange={(value) => setEmpresaId(Number(value))}
                  disabled={empresasLoading}
                >
                  <SelectTrigger>
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
              <Label className="text-sm font-semibold text-foreground">Adicionar produtos/serviços</Label>
              <div className="flex flex-col gap-2 rounded-xl border border-border bg-secondary/20 p-4">
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
                      className="pl-10"
                    />
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>

                </div>
                <div className="rounded-lg border border-dashed border-border/70 bg-background overflow-hidden">
                  <ScrollArea className="max-h-56 overflow-y-auto">
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
                      <div className="divide-y divide-border/60 bg-secondary/10">
                        {suggestions.map((suggestion) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              addItemFromSuggestion(suggestion)
                            }}
                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-secondary/30"
                          >
                            <div>
                              <p className="text-sm font-semibold text-foreground">{suggestion.nome}</p>
                              {suggestion.categoria && (
                                <p className="text-xs text-muted-foreground">{suggestion.categoria}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold text-foreground">
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
              </div>
            </div>

            <div className="rounded-xl border border-border bg-secondary/10 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto/Serviço</TableHead>
                      <TableHead className="w-32">Quantidade</TableHead>
                      <TableHead className="w-40">Valor unitário</TableHead>
                      <TableHead className="w-32 text-right">Subtotal</TableHead>
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                          Nenhum item adicionado ainda.
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item) => (
                        <TableRow key={item.itemId}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">{item.nome}</span>
                              <Badge variant="outline" className="w-fit text-xs text-muted-foreground">
                                #{item.itemId}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              value={item.quantidade}
                              onChange={(event) => handleItemFieldChange(item.itemId, "quantidade", event.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.valor}
                              onChange={(event) => handleItemFieldChange(item.itemId, "valor", event.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-right font-semibold text-foreground">
                            {formatCurrency(item.quantidade * item.valor)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => removeItem(item.itemId)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                    {items.length > 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-right font-semibold">
                          Total
                        </TableCell>
                        <TableCell className="text-right text-lg font-bold text-foreground">
                          {formatCurrency(total)}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="parcelas">Parcelas*</Label>
                <Input
                  id="parcelas"
                  type="number"
                  min={1}
                  placeholder="Ex: 6"
                  value={parcelasInput}
                  onChange={(event) => setParcelasInput(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="primeiro-vencimento">1º vencimento*</Label>
                <Input
                  id="primeiro-vencimento"
                  type="date"
                  value={primeiroVencimento}
                  onChange={(event) => setPrimeiroVencimento(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="garantia">Garantia (meses)</Label>
                <Input
                  id="garantia"
                  type="number"
                  min={0}
                  placeholder="Ex: 12"
                  value={garantiaInput}
                  onChange={(event) => setGarantiaInput(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                rows={4}
                placeholder="Informações adicionais, condições comerciais..."
                value={observacoes}
                onChange={(event) => setObservacoes(event.target.value)}
              />
            </div>

            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
          </div>
          <div className="gap-2 pb-5">
            <Button variant="outline" onClick={() => onClose()} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar orçamento"
              )}
            </Button>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 pt-10">

        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

