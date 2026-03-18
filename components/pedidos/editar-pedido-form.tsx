"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Plus, PlusCircle, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toDateInputValue } from "@/lib/date-utils"
import { useCanAccess } from "@/components/auth/can"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

type ItemSuggestion = {
  id: string
  nome: string
  valor: number
  categoria: string | null
}

type PedidoItemDraft = {
  itemId: string
  nome: string
  quantidade: number
  valor: number
}

type BancoOption = { id: number; nome: string }

type PedidoItemInput = {
  itemId?: number | null
  nome: string
  quantidade: number
  valorUnitario: number
}

interface EditarPedidoFormProps {
  pedidoId: number | null
  orcamentoId?: number | null
  status?: string | null
  clienteNome?: string | null
  bancoEmissorId?: number | null
  legacyBanco?: string | null
  observacoes?: string | null
  detalhamento?: string | null
  isOs?: boolean
  itens: PedidoItemInput[]
  open: boolean
  onSuccess?: () => void
  parcelas?: number | null
  primeiroVencimento?: string | null
  medicaoOhmica?: number | null
  medicaoOhmicaMulti?: Array<{ torre: string; valor: number }> | null
}

const MIN_SUGGESTION_LENGTH = 2
const SUGGESTION_LIMIT = 10
const SEARCH_THROTTLE_MS = 350

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
})
const formatCurrency = (value: number) => currencyFormatter.format(value)

export function EditarPedidoForm({
  pedidoId,
  orcamentoId,
  status,
  clienteNome,
  bancoEmissorId,
  legacyBanco,
  observacoes,
  detalhamento,
  isOs,
  itens,
  open,
  onSuccess,
  parcelas,
  primeiroVencimento,
  medicaoOhmica,
  medicaoOhmicaMulti,
}: EditarPedidoFormProps) {
  const { toast } = useToast()
  const [items, setItems] = useState<PedidoItemDraft[]>([])
  const [itemSearch, setItemSearch] = useState("")
  const [suggestions, setSuggestions] = useState<ItemSuggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [suggestionError, setSuggestionError] = useState<string | null>(null)
  const [bancos, setBancos] = useState<BancoOption[]>([])
  const [loadingBancos, setLoadingBancos] = useState(false)
  const [bancosError, setBancosError] = useState<string | null>(null)
  const [bancoSelecionado, setBancoSelecionado] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [loadingPedido, setLoadingPedido] = useState(true)
  const [parcelasInput, setParcelasInput] = useState("")
  const [primeiroVencimentoInput, setPrimeiroVencimentoInput] = useState("")
  const [medicaoOhmicaInput, setMedicaoOhmicaInput] = useState("")
  const [observacoesInput, setObservacoesInput] = useState("")
  const [detalhamentoInput, setDetalhamentoInput] = useState("")
  const [medicoesMulti, setMedicoesMulti] = useState<Array<{ torre: string; valor: string }>>(
    medicaoOhmicaMulti ? (medicaoOhmicaMulti as any[]).map(m => ({ torre: String(m.torre), valor: String(m.valor) })) : []
  )
  const [isMedicaoDialogOpen, setIsMedicaoDialogOpen] = useState(false)
  const [originalSignature, setOriginalSignature] = useState("")
  const [initialParcelas, setInitialParcelas] = useState("")
  const [initialPrimeiro, setInitialPrimeiro] = useState("")
  const [initialMedicaoOhmica, setInitialMedicaoOhmica] = useState("")
  const [initialMedicoesMulti, setInitialMedicoesMulti] = useState<string>("")
  const [initialObservacoes, setInitialObservacoes] = useState("")
  const [initialDetalhamento, setInitialDetalhamento] = useState("")
  const [initialItemsCount, setInitialItemsCount] = useState(0)
  const [searchFocused, setSearchFocused] = useState(false)
  const [showAddItems, setShowAddItems] = useState(false)

  const throttledTermRef = useRef("")
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const lastLoadedSignatureRef = useRef("")
  const searchBlurTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const isConcluido = (status ?? "").toUpperCase() === "CONCLUIDO"
  const isAdminOrFinance = useCanAccess(["MASTER", "ADMINISTRADOR", "FINANCEIRO"])
  const blockEdit = isConcluido && !isAdminOrFinance

  const total = useMemo(() => items.reduce((acc, item) => acc + item.quantidade * item.valor, 0), [items])

  const buildSignature = useCallback((data: {
    banco?: string
    parcelas?: string
    primeiroVencimento?: string
    medicaoOhmica?: string
    medicoesMulti?: Array<{ torre: string; valor: string }>
    observacoes?: string
    detalhamento?: string
    items?: PedidoItemDraft[]
  }) => {
    return JSON.stringify({
      banco: data.banco ?? "",
      parcelas: data.parcelas ?? "",
      primeiroVencimento: data.primeiroVencimento ?? "",
      medicaoOhmica: data.medicaoOhmica ?? "",
      medicoesMulti: data.medicoesMulti ?? [],
      observacoes: data.observacoes ?? "",
      detalhamento: data.detalhamento ?? "",
      items: (data.items ?? []).map((i) => ({
        itemId: i.itemId,
        quantidade: i.quantidade,
        valor: i.valor,
      })),
    })
  }, [])

  const currentSignature = useMemo(
    () =>
      buildSignature({
        banco: bancoSelecionado,
        parcelas: parcelasInput,
        primeiroVencimento: primeiroVencimentoInput,
        medicaoOhmica: medicaoOhmicaInput,
        medicoesMulti: medicoesMulti,
        observacoes: observacoesInput,
        detalhamento: detalhamentoInput,
        items,
      }),
    [buildSignature, bancoSelecionado, parcelasInput, primeiroVencimentoInput, medicaoOhmicaInput, medicoesMulti, observacoesInput, detalhamentoInput, items],
  )
  const hasChanges = useMemo(
    () => originalSignature !== "" && currentSignature !== originalSignature,
    [currentSignature, originalSignature],
  )

  const canSubmit = !submitting && !blockEdit && hasChanges && (items.length > 0 || initialItemsCount === 0)

  const resetForm = useCallback(() => {
    setItems([])
    setItemSearch("")
    setSuggestions([])
    setSuggestionError(null)
    setBancoSelecionado("")
    setFormError(null)
    setSubmitting(false)
    setLoadingPedido(true)
    setOriginalSignature("")
    setInitialParcelas("")
    setInitialPrimeiro("")
    setInitialMedicaoOhmica("")
    setInitialMedicoesMulti("")
    setInitialObservacoes("")
    setInitialDetalhamento("")
    setMedicaoOhmicaInput("")
    setMedicoesMulti([])
    setObservacoesInput("")
    setDetalhamentoInput("")
    setInitialItemsCount(0)
    lastLoadedSignatureRef.current = ""
    throttledTermRef.current = ""
    setSearchFocused(false)
    setShowAddItems(false)
    setIsMedicaoDialogOpen(false)
    if (searchBlurTimeoutRef.current) {
      clearTimeout(searchBlurTimeoutRef.current)
      searchBlurTimeoutRef.current = null
    }
    if (throttleTimeoutRef.current) {
      clearTimeout(throttleTimeoutRef.current)
      throttleTimeoutRef.current = null
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  const fetchSuggestions = useCallback(
    async (term: string) => {
      if (!open) return
      if (abortControllerRef.current) abortControllerRef.current.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller
      setLoadingSuggestions(true)
      setSuggestionError(null)
      try {
        const params = new URLSearchParams()
        if (term.trim().length > 0) params.set("query", term.trim())
        params.set("limit", String(SUGGESTION_LIMIT))
        const res = await fetch(`/api/items?${params.toString()}`, { signal: controller.signal })
        if (!res.ok) throw new Error("Erro ao carregar produtos/serviços.")
        const json = await res.json()
        setSuggestions(Array.isArray(json.data) ? json.data : [])
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

  const loadBancos = useCallback(async () => {
    try {
      setLoadingBancos(true)
      setBancosError(null)
      const res = await fetch("/api/bancos")
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Erro ao carregar bancos")
      setBancos(Array.isArray(json.data) ? json.data : [])
    } catch (error) {
      console.error(error)
      setBancosError(error instanceof Error ? error.message : "Erro ao carregar bancos")
    } finally {
      setLoadingBancos(false)
    }
  }, [])

  const propsData = useMemo(() => {
    const mappedItems = (itens ?? []).map((it) => ({
      itemId: String(it.itemId ?? ""),
      nome: it.nome,
      quantidade: it.quantidade,
      valor: it.valorUnitario,
    }))
    const bancoVal = bancoEmissorId ? bancoEmissorId.toString() : ""
    const parcelasVal = parcelas ? String(parcelas) : ""
    const primeiroVal = toDateInputValue(primeiroVencimento)
    const medicaoOhmicaVal = medicaoOhmica !== null && medicaoOhmica !== undefined ? String(medicaoOhmica) : ""
    const medicoesMultiVal = (medicaoOhmicaMulti ?? []).map(m => ({ torre: String(m.torre || ""), valor: String(m.valor || "") }))
    const observacoesVal = observacoes ?? ""
    const detalhamentoVal = detalhamento ?? ""

    return {
      mappedItems,
      bancoVal,
      parcelasVal,
      primeiroVal,
      medicaoOhmicaVal,
      observacoesVal,
      detalhamentoVal,
      signature: buildSignature({
        banco: bancoVal,
        parcelas: parcelasVal,
        primeiroVencimento: primeiroVal,
        medicaoOhmica: medicaoOhmicaVal,
        medicoesMulti: medicoesMultiVal,
        observacoes: observacoesVal,
        detalhamento: detalhamentoVal,
        items: mappedItems,
      }),
    }
  }, [bancoEmissorId, itens, parcelas, primeiroVencimento, medicaoOhmica, medicaoOhmicaMulti, observacoes, detalhamento, buildSignature])

  useEffect(() => {
    if (open) {
      resetForm()
      fetchSuggestions("")
      loadBancos().catch(console.error)
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
  }, [open, fetchSuggestions, resetForm, loadBancos])

  useEffect(() => {
    if (!open) return
    if (!pedidoId) {
      setLoadingPedido(false)
      return
    }
    if (!propsData.signature) return

    if (propsData.signature !== lastLoadedSignatureRef.current) {
      setLoadingPedido(true)
    } else if (loadingPedido) {
      // Caso já esteja sincronizado, libera a tela.
      setLoadingPedido(false)
    }
  }, [open, pedidoId, propsData.signature, loadingPedido])

  useEffect(() => {
    if (!open) return
    if (!pedidoId) {
      setLoadingPedido(false)
      return
    }
    if (!propsData.signature || propsData.signature === lastLoadedSignatureRef.current) return

    lastLoadedSignatureRef.current = propsData.signature
    setItems(propsData.mappedItems)
    setBancoSelecionado(propsData.bancoVal)
    setParcelasInput(propsData.parcelasVal)
    setPrimeiroVencimentoInput(propsData.primeiroVal)
    setMedicaoOhmicaInput(propsData.medicaoOhmicaVal)
    setMedicoesMulti(medicaoOhmicaMulti ? medicaoOhmicaMulti.map(m => ({ torre: m.torre, valor: String(m.valor) })) : [])
    setObservacoesInput(propsData.observacoesVal)
    setDetalhamentoInput(propsData.detalhamentoVal)
    setInitialParcelas(propsData.parcelasVal)
    setInitialPrimeiro(propsData.primeiroVal)
    setInitialMedicaoOhmica(propsData.medicaoOhmicaVal)
    setInitialMedicoesMulti(JSON.stringify(medicaoOhmicaMulti ?? []))
    setInitialObservacoes(propsData.observacoesVal)
    setInitialDetalhamento(propsData.detalhamentoVal)
    setInitialItemsCount(propsData.mappedItems.length)
    setOriginalSignature(propsData.signature)
    setFormError(null)
    setLoadingPedido(false)
  }, [open, pedidoId, propsData, medicaoOhmicaMulti])

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

  const handleItemFieldChange = (index: number, field: "quantidade" | "valor", value: string) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        if (field === "quantidade") {
          const parsed = Number.parseInt(value, 10)
          return { ...item, quantidade: Number.isNaN(parsed) || parsed <= 0 ? 1 : parsed }
        }
        const parsed = Number.parseFloat(value.replace(",", "."))
        return { ...item, valor: Number.isNaN(parsed) || parsed < 0 ? 0 : Number(parsed.toFixed(2)) }
      }),
    )
  }

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!pedidoId) return
    if (blockEdit) {
      setFormError("Pedido concluído não pode ser alterado.")
      return
    }
    if (items.length === 0 && initialItemsCount > 0) {
      setFormError("Adicione ao menos um produto/serviço.")
      return
    }
    if (items.some((i) => !i.itemId || Number.isNaN(Number.parseInt(i.itemId, 10)))) {
      setFormError("Selecione um produto/serviço para todos os itens.")
      return
    }

    setFormError(null)
    setSubmitting(true)
    try {
      if (orcamentoId) {
        const parcelasNumber = parcelasInput ? Number.parseInt(parcelasInput, 10) : null
        const financeChanged =
          parcelasInput !== initialParcelas || primeiroVencimentoInput !== initialPrimeiro

        if (financeChanged) {
          if (!parcelasNumber || parcelasNumber <= 0) {
            throw new Error("Parcelas inválidas.")
          }
          if (!primeiroVencimentoInput) {
            throw new Error("Informe o 1º vencimento.")
          }
          const resOrc = await fetch(`/api/pedidos/${pedidoId}/orcamento-financeiro`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              parcelas: parcelasNumber,
              primeiroVencimento: primeiroVencimentoInput,
            }),
          })
          const bodyOrc = await resOrc.json().catch(() => ({}))
          if (!resOrc.ok) {
            throw new Error(bodyOrc.error ?? "Erro ao atualizar parcelas e vencimento.")
          }
        }
      }

      const bancoIdNumber = bancoSelecionado ? Number.parseInt(bancoSelecionado, 10) : null
      if (bancoIdNumber && bancoIdNumber !== bancoEmissorId) {
        const resBanco = await fetch(`/api/pedidos/${pedidoId}/banco`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bancoEmissorId: bancoIdNumber }),
        })
        const bodyBanco = await resBanco.json().catch(() => ({}))
        if (!resBanco.ok) {
          throw new Error(bodyBanco.error ?? "Erro ao atualizar banco do pedido.")
        }
      }

      const medicaoOhmicaChanged = medicaoOhmicaInput !== initialMedicaoOhmica
      const medicoesMultiSerialized = JSON.stringify(medicoesMulti.map(m => ({ torre: m.torre, valor: Number.parseFloat(m.valor) || 0 })))
      const medicoesMultiChanged = medicoesMultiSerialized !== initialMedicoesMulti
      const observacoesChanged = observacoesInput !== initialObservacoes
      const detalhamentoChanged = isOs ? detalhamentoInput !== initialDetalhamento : false
      if (medicaoOhmicaChanged || medicoesMultiChanged || observacoesChanged || detalhamentoChanged) {
        const medicaoRaw = medicaoOhmicaInput.trim()
        const medicaoValue = medicaoRaw === "" ? null : Number.parseFloat(medicaoRaw)
        if (medicaoRaw !== "" && Number.isNaN(medicaoValue)) {
          throw new Error("Medição ôhmica inválida.")
        }
        const resPedido = await fetch(`/api/pedidos/${pedidoId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            medicaoOhmica: medicaoOhmicaChanged ? medicaoValue : undefined,
            medicaoOhmicaMulti: medicoesMultiChanged ? medicoesMulti
              .filter(m => m.valor.trim() !== "")
              .map(m => ({
                torre: m.torre || "",
                valor: Number.parseFloat(m.valor) || 0
              })) : undefined,
            observacoes: observacoesChanged ? (observacoesInput.trim() || null) : undefined,
            detalhamento: detalhamentoChanged ? (detalhamentoInput.trim() || null) : undefined,
          }),
        })
        const bodyPedido = await resPedido.json().catch(() => ({}))
        if (!resPedido.ok) {
          throw new Error(bodyPedido.error ?? "Erro ao atualizar dados do pedido.")
        }
      }

      if (items.length > 0) {
        const payload = {
          items: items.map((item) => ({
            itemId: Number.parseInt(item.itemId, 10),
            quantidade: item.quantidade,
            valorUnitario: item.valor,
          })),
        }

        const res = await fetch(`/api/pedidos/${pedidoId}/items`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(body.error ?? "Erro ao salvar itens do pedido.")
        }
      }

      toast({
        title: isConcluido ? "Atenção: Pedido Concluído Editado" : "Pedido atualizado",
        description: isConcluido
          ? "Você editou um pedido concluído com sucesso. Verifique se não é necessário uma mudança na nota fiscal ou nos débitos."
          : `Total ${formatCurrency(total)}${clienteNome ? ` para ${clienteNome}` : ""}.`,
      })
      // Considera o estado atual como sincronizado após salvar
      setInitialParcelas(parcelasInput)
      setInitialPrimeiro(primeiroVencimentoInput)
      setInitialMedicaoOhmica(medicaoOhmicaInput)
      setInitialMedicoesMulti(JSON.stringify(medicoesMulti.map(m => ({ torre: m.torre, valor: Number.parseFloat(m.valor) || 0 }))))
      setInitialObservacoes(observacoesInput)
      setInitialDetalhamento(detalhamentoInput)
      setOriginalSignature(
        buildSignature({
          banco: bancoSelecionado,
          parcelas: parcelasInput,
          primeiroVencimento: primeiroVencimentoInput,
          medicaoOhmica: medicaoOhmicaInput,
          medicoesMulti: medicoesMulti,
          observacoes: observacoesInput,
          detalhamento: detalhamentoInput,
          items,
        }),
      )
      onSuccess?.()
    } catch (error) {
      console.error(error)
      const message = error instanceof Error ? error.message : "Erro ao atualizar pedido."
      setFormError(message)
      toast({
        title: "Não foi possível atualizar o pedido",
        description: message,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const isHydrating =
    loadingPedido ||
    (open && Boolean(pedidoId) && Boolean(propsData.signature) && propsData.signature !== lastLoadedSignatureRef.current)

  return (
    <div className="space-y-4 max-h-[500px] overflow-y-auto rounded-xl border border-border bg-card shadow-sm p-4">
      {isHydrating ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Carregando pedido...</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            {!isOs && (
              <>
                <div className="space-y-1">
                  <Label className="text-[12px] font-semibold text-foreground">Parcelas</Label>
                  <Input
                    value={parcelasInput}
                    onChange={(e) => setParcelasInput(e.target.value)}
                    placeholder="Ex.: 12"
                    disabled={blockEdit}
                    className="h-8 text-[13px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[12px] font-semibold text-foreground">1º vencimento</Label>
                  <Input
                    type="date"
                    value={primeiroVencimentoInput}
                    onChange={(e) => setPrimeiroVencimentoInput(e.target.value)}
                    disabled={blockEdit}
                    className="h-8 text-[13px]"
                  />
                </div>
              </>
            )}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[12px] font-semibold text-foreground tracking-tight">Medições (Ω)</Label>
                {!blockEdit && (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-[10px] uppercase font-bold text-blue-600 no-underline hover:no-underline"
                    onClick={() => setIsMedicaoDialogOpen(true)}
                  >
                    Edit
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-1 items-center min-h-[32px] border rounded-md p-1 px-2 border-border bg-card shadow-sm overflow-hidden">
                {medicoesMulti.filter(m => m.valor.trim() !== "").length > 0 ? (
                  medicoesMulti.filter(m => m.valor.trim() !== "").map((med, idx) => (
                    <span key={idx} className="text-[11px] font-mono text-foreground bg-secondary border border-border/40 px-1 rounded whitespace-nowrap">
                      {med.valor}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-muted-foreground/60 italic">vazio</span>
                )}
              </div>

              <Dialog open={isMedicaoDialogOpen} onOpenChange={setIsMedicaoDialogOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-sm uppercase font-bold text-foreground">Editar Medições</DialogTitle>
                    <DialogDescription className="text-xs">Detalhamento ôhmico (Ω).</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-3">
                    <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                      {medicoesMulti.map((med, idx) => (
                        <div key={idx} className="flex gap-2 items-center bg-secondary p-2 rounded-md border border-border">
                          <div className="flex-1">
                            <Label className="text-[10px] uppercase text-muted-foreground font-semibold">Torre/Local</Label>
                            <Input
                              placeholder="Filtro"
                              value={med.torre}
                              onChange={(e) => {
                                const next = [...medicoesMulti]
                                next[idx].torre = e.target.value
                                setMedicoesMulti(next)
                              }}
                              className="h-8 text-[12px] mt-0.5"
                            />
                          </div>
                          <div className="w-24">
                            <Label className="text-[10px] uppercase text-muted-foreground font-semibold">Valor</Label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.0"
                              value={med.valor}
                              onChange={(e) => {
                                const next = [...medicoesMulti]
                                next[idx].valor = e.target.value
                                setMedicoesMulti(next)
                                if (idx === 0) setMedicaoOhmicaInput(e.target.value)
                              }}
                              className="h-8 text-[12px] mt-0.5"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 mt-4"
                            onClick={() => setMedicoesMulti(prev => prev.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full border-dashed h-9 text-xs text-muted-foreground"
                      onClick={() => setMedicoesMulti(prev => [...prev, { torre: "", valor: "" }])}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Ponto
                    </Button>
                  </div>
                  <DialogFooter>
                    <Button type="button" className="w-full h-9 text-xs" onClick={() => setIsMedicaoDialogOpen(false)}>
                      Confirmar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {!isOs && (
              <div className="space-y-1">
                <Label className="text-[12px] font-semibold text-foreground">Banco emissor</Label>
                <Select
                  value={bancoSelecionado || undefined}
                  onValueChange={(value) => setBancoSelecionado(value)}
                  disabled={loadingBancos || ((isConcluido || Boolean(bancoEmissorId)) && !isAdminOrFinance)}
                >
                  <SelectTrigger className="w-full h-8 text-[13px]">
                    <SelectValue placeholder={loadingBancos ? "Carregando bancos..." : "Selecione um banco"} />
                  </SelectTrigger>
                  <SelectContent>
                    {bancos.map((banco) => (
                      <SelectItem key={banco.id} value={banco.id.toString()} className="text-[13px]">
                        {banco.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Banco legado: {legacyBanco ?? "—"}</p>
                {bancosError ? <span className="text-[11px] text-destructive">{bancosError}</span> : null}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-[12px] font-semibold text-foreground">Observações(aparecem para a supervisão técnica, e para o técnico também)</Label>
            <Textarea
              value={observacoesInput}
              onChange={(e) => setObservacoesInput(e.target.value)}
              placeholder="Observações do pedido(aparecem para a supervisão técnica, e para o técnico também.)..."
              rows={3}
              disabled={blockEdit}
              className="text-[13px]"
            />
          </div>

          {isOs && (
            <div className="space-y-1">
              <Label className="text-[12px] font-semibold text-foreground">Detalhamento (serviço a ser executado, vai no documento de O.S)</Label>
              <Textarea
                value={detalhamentoInput}
                onChange={(e) => setDetalhamentoInput(e.target.value)}
                placeholder="Descreva o serviço a ser executado (vai no documento)."
                rows={3}
                disabled={blockEdit}
                className="text-[13px]"
              />
            </div>
          )}

          {!isOs && (
            <div className="space-y-3">
              {!blockEdit && showAddItems && (
                <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-muted/30 p-4">
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
                        disabled={blockEdit}
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
                      <SearchIcon />
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
                          <div className="divide-y divide-border/60">
                            {suggestions.map((suggestion) => (
                              <button
                                key={suggestion.id}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  addItemFromSuggestion(suggestion)
                                }}
                                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-secondary/40"
                                disabled={blockEdit}
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

              {!blockEdit && !showAddItems && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAddItems(true)
                    fetchSuggestions("")
                  }}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                >
                  <PlusCircle className="h-3 w-3" />
                  Adicionar produto/serviço
                </button>
              )}

              <div className="rounded-lg border border-border/80 bg-card shadow-sm overflow-x-auto">
                {items.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum item adicionado.
                  </div>
                ) : (
                  <Table className="min-w-[600px] sm:min-w-0">
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
                      {items.map((item, index) => (
                        <TableRow key={`${item.itemId}-${index}`}>
                          <TableCell className="font-semibold text-foreground text-[12px] py-1.5">{item.nome}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              value={item.quantidade}
                              onChange={(e) => handleItemFieldChange(index, "quantidade", e.target.value)}
                              className="h-9 sm:h-7 text-sm sm:text-[12px]"
                              disabled={blockEdit}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.valor}
                              onChange={(e) => handleItemFieldChange(index, "valor", e.target.value)}
                              className="h-9 sm:h-7 text-sm sm:text-[12px]"
                              disabled={blockEdit}
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
                              onClick={() => removeItem(index)}
                              disabled={blockEdit}
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
                        <TableCell className="font-semibold text-foreground text-[12px] py-1.5">{formatCurrency(total)}</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}

          {
            formError ? (
              <Alert variant="destructive" >
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={!canSubmit} variant={canSubmit ? "default" : "outline"} className="h-7 px-3 text-[12px]">
              {submitting ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
              Salvar alterações
            </Button>
          </div>
        </>
      )}
    </div >
  )
}

const SearchIcon = () => (
  <svg
    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)


