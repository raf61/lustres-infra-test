"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  ImageOff,
  Package,
  Pencil,
  Plus,
} from "lucide-react"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"

type ItemDto = {
  id: number
  nome: string
  valor: number
  categoria: string
  estoque: number
  fornecedor?: string | null
  urlFoto?: string | null
  precoCusto?: number | null
}

type MovDto = {
  id: number
  tipo: "ENTRADA" | "SAIDA"
  quantidade: number
  totalAntes: number
  totalDepois: number
  observacao: string
  createdAt: string
}

const formatDateTime = (value: string) => new Date(value).toLocaleString("pt-BR")

export function EstoqueDashboard() {
  const { toast } = useToast()
  const [itens, setItens] = useState<ItemDto[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<"produtos" | "servicos">("produtos")
  const [novoProdutoOpen, setNovoProdutoOpen] = useState(false)
  const [novoServicoOpen, setNovoServicoOpen] = useState(false)
  const [movDialog, setMovDialog] = useState<{ item: ItemDto; tipo: "ENTRADA" | "SAIDA" } | null>(null)
  const [historicoDialog, setHistoricoDialog] = useState<ItemDto | null>(null)
  const [movQuantidade, setMovQuantidade] = useState("")
  const [movObs, setMovObs] = useState("")
  const [movLoading, setMovLoading] = useState(false)
  const [historico, setHistorico] = useState<MovDto[]>([])
  const [novoNome, setNovoNome] = useState("")
  const [novoValor, setNovoValor] = useState("")
  const [novoFornecedor, setNovoFornecedor] = useState("")
  const [novoPrecoCusto, setNovoPrecoCusto] = useState("")
  const [novoFotoFile, setNovoFotoFile] = useState<File | null>(null)
  const [novoFotoPreview, setNovoFotoPreview] = useState<string | null>(null)
  const [novoFotoError, setNovoFotoError] = useState<string | null>(null)
  const [savingNovo, setSavingNovo] = useState(false)
  const [editItem, setEditItem] = useState<ItemDto | null>(null)
  const [editNome, setEditNome] = useState("")
  const [editValor, setEditValor] = useState("")
  const [editFornecedor, setEditFornecedor] = useState("")
  const [editPrecoCusto, setEditPrecoCusto] = useState("")
  const [editFotoUrl, setEditFotoUrl] = useState<string | null>(null)
  const [editFotoFile, setEditFotoFile] = useState<File | null>(null)
  const [editFotoPreview, setEditFotoPreview] = useState<string | null>(null)
  const [editFotoError, setEditFotoError] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleteStep, setDeleteStep] = useState(0)
  const [itemToDelete, setItemToDelete] = useState<ItemDto | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchItens = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/estoque/itens")
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || "Erro ao carregar itens.")
      setItens(payload.data ?? [])
    } catch (error) {
      toast({
        title: "Erro ao carregar estoque",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchItens().catch(console.error)
  }, [fetchItens])

  const uploadFotoFile = useCallback(async (file: File) => {
    const form = new FormData()
    form.append("file", file)
    form.append("folder", "items")
    const res = await fetch("/api/storage/upload", { method: "POST", body: form })
    const payload = await res.json()
    if (!res.ok) throw new Error(payload?.error || "Falha ao enviar imagem.")
    return payload.url as string
  }, [])

  const produtos = useMemo(() => itens.filter((i) => i.categoria === "Produto"), [itens])
  const servicos = useMemo(() => itens.filter((i) => i.categoria === "Serviço"), [itens])

  const handleCriarItem = useCallback(
    async (categoria: "Produto" | "Serviço") => {
      if (!novoNome.trim()) {
        toast({ title: "Nome obrigatório", variant: "destructive" })
        return
      }
      const valorNum = Number.parseFloat(novoValor)
      if (!Number.isFinite(valorNum) || valorNum <= 0) {
        toast({
          title: "Preço médio inválido",
          description: "Informe um valor maior que zero.",
          variant: "destructive",
        })
        return
      }
      const precoCustoNum =
        novoPrecoCusto.trim() === "" ? null : Number.parseFloat(novoPrecoCusto.replace(",", "."))
      if (precoCustoNum !== null && (!Number.isFinite(precoCustoNum) || precoCustoNum < 0)) {
        toast({
          title: "Preço de custo inválido",
          description: "Use zero ou um valor positivo.",
          variant: "destructive",
        })
        return
      }
      setNovoFotoError(null)
      setSavingNovo(true)
      try {
        let fotoUrl: string | null = null
        if (novoFotoFile) {
          try {
            fotoUrl = await uploadFotoFile(novoFotoFile)
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Falha ao enviar a imagem."
            setNovoFotoError(msg)
            throw err
          }
        }
        const res = await fetch("/api/estoque/itens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: novoNome,
            valor: valorNum,
            categoria,
            fornecedor: novoFornecedor.trim() || null,
            precoCusto: precoCustoNum,
            urlFoto: fotoUrl,
          }),
        })
        const payload = await res.json()
        if (!res.ok) throw new Error(payload?.error || "Erro ao salvar.")
        toast({ description: `${categoria} criado com sucesso.` })
        setNovoNome("")
        setNovoValor("")
        setNovoFornecedor("")
        setNovoPrecoCusto("")
        setNovoFotoFile(null)
        setNovoFotoPreview(null)
        setNovoFotoError(null)
        setNovoProdutoOpen(false)
        setNovoServicoOpen(false)
        fetchItens().catch(console.error)
      } catch (error) {
        toast({
          title: "Erro ao salvar",
          description: error instanceof Error ? error.message : "Tente novamente.",
          variant: "destructive",
        })
      } finally {
        setSavingNovo(false)
      }
    },
    [fetchItens, novoNome, novoValor, toast],
  )

  const openMovimentacao = (item: ItemDto, tipo: "ENTRADA" | "SAIDA") => {
    if (item.categoria === "Serviço") {
      toast({ title: "Serviço não movimenta estoque", variant: "destructive" })
      return
    }
    setMovObs("")
    setMovQuantidade("")
    setMovDialog({ item, tipo })
  }

  const submitMovimentacao = async () => {
    if (!movDialog) return
    const qtd = Number.parseInt(movQuantidade, 10)
    if (!Number.isFinite(qtd) || qtd <= 0) {
      toast({ title: "Quantidade inválida", description: "Informe um número maior que zero.", variant: "destructive" })
      return
    }
    setMovLoading(true)
    try {
      const res = await fetch("/api/estoque/movimentacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: movDialog.item.id,
          tipo: movDialog.tipo,
          quantidade: qtd,
          observacao: movObs,
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || "Erro ao lançar movimentação.")
      toast({ description: "Movimentação registrada." })
      setMovDialog(null)
      fetchItens().catch(console.error)
    } catch (error) {
      toast({
        title: "Erro ao movimentar",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setMovLoading(false)
    }
  }

  const openEdit = (item: ItemDto) => {
    setEditItem(item)
    setEditNome(item.nome)
    setEditValor(String(item.valor))
    setEditFornecedor(item.fornecedor ?? "")
    setEditPrecoCusto(item.precoCusto !== null && item.precoCusto !== undefined ? String(item.precoCusto) : "")
    setEditFotoUrl(item.urlFoto ?? null)
    setEditFotoPreview(item.urlFoto ?? null)
    setEditFotoFile(null)
    setEditFotoError(null)
  }

  const submitEdit = async () => {
    if (!editItem) return
    if (!editNome.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" })
      return
    }

    const valorNum = Number.parseFloat(editValor)
    if (!Number.isFinite(valorNum) || valorNum < 0) {
      toast({
        title: "Preço médio inválido",
        description: "Informe um valor maior que zero.",
        variant: "destructive",
      })
      return
    }

    const precoCustoNum =
      editPrecoCusto.trim() === "" ? null : Number.parseFloat(editPrecoCusto.replace(",", "."))
    if (precoCustoNum !== null && (!Number.isFinite(precoCustoNum) || precoCustoNum < 0)) {
      toast({
        title: "Preço de custo inválido",
        description: "Use zero ou um valor positivo.",
        variant: "destructive",
      })
      return
    }

    setEditFotoError(null)
    setSavingEdit(true)
    try {
      let fotoUrl = editFotoUrl ?? null
      if (editFotoFile) {
        try {
          fotoUrl = await uploadFotoFile(editFotoFile)
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Falha ao enviar a imagem."
          setEditFotoError(msg)
          throw err
        }
      }
      const res = await fetch(`/api/estoque/itens/${editItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: editNome,
          valor: valorNum,
          fornecedor: editFornecedor.trim() || null,
          precoCusto: precoCustoNum,
          urlFoto: fotoUrl,
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || "Erro ao atualizar.")
      toast({ description: "Item atualizado com sucesso." })
      setEditItem(null)
      setEditFotoFile(null)
      setEditFotoPreview(null)
      setEditFotoError(null)
      fetchItens().catch(console.error)
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async () => {
    if (!itemToDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/estoque/itens/${itemToDelete.id}`, {
        method: "DELETE",
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || "Erro ao apagar o item.")
      toast({ description: "Item excluído com sucesso." })
      setDeleteStep(0)
      setItemToDelete(null)
      fetchItens().catch(console.error)
    } catch (error) {
      toast({
        title: "Erro ao excluir",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  const openHistorico = async (item: ItemDto) => {
    setHistoricoDialog(item)
    try {
      const res = await fetch(`/api/estoque/movimentacoes?itemId=${item.id}`)
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || "Erro ao carregar histórico.")
      setHistorico(payload.data ?? [])
    } catch (error) {
      toast({
        title: "Erro ao carregar histórico",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      })
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Package className="h-8 w-8 text-primary" />
              Controle de Estoque
            </h1>
            <p className="text-muted-foreground">Gestão de almoxarifado e materiais</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setNovoServicoOpen(true)} variant="secondary">
              <Plus className="mr-2 h-4 w-4" />
              Novo Serviço
            </Button>
            <Button onClick={() => setNovoProdutoOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Produto
            </Button>
          </div>
        </div>



        <Card>
          <CardHeader className="pb-0">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList className="h-11 rounded-md bg-muted/60 p-1">
                <TabsTrigger
                  value="produtos"
                  className="rounded-md px-4 py-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  Produtos
                </TabsTrigger>
                <TabsTrigger
                  value="servicos"
                  className="rounded-md px-4 py-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  Serviços
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsContent value="produtos" className="p-4">
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[70px]">Foto</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Preço médio de venda</TableHead>
                        <TableHead>Preço de custo</TableHead>
                        <TableHead>Estoque</TableHead>
                        <TableHead className="w-[160px] text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            Carregando...
                          </TableCell>
                        </TableRow>
                      ) : produtos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            Nenhum produto cadastrado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        produtos.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>
                              <div className="h-14 w-14 overflow-hidden rounded border bg-white">
                                {p.urlFoto ? (
                                  <img src={p.urlFoto} alt={p.nome} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                    <ImageOff className="h-5 w-5" />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold text-foreground">{p.nome}</TableCell>
                            <TableCell className="text-muted-foreground">{p.fornecedor || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="font-semibold">
                                R$ {p.valor.toFixed(2)}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold">
                              {p.precoCusto !== null && p.precoCusto !== undefined ? `R$ ${p.precoCusto.toFixed(2)}` : "—"}
                            </TableCell>
                            <TableCell className="font-semibold">{p.estoque}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                                  <Pencil className="h-5 w-5" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => openMovimentacao(p, "ENTRADA")}>
                                  <ArrowUpCircle className="h-5 w-5 text-green-600" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => openMovimentacao(p, "SAIDA")}>
                                  <ArrowDownCircle className="h-5 w-5 text-red-600" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => openHistorico(p)}>
                                  <History className="h-5 w-5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => {
                                    setItemToDelete(p)
                                    setDeleteStep(1)
                                  }}
                                >
                                  <Package className="h-5 w-5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="servicos" className="p-4">
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Serviço</TableHead>
                        <TableHead>Preço médio de venda</TableHead>
                        <TableHead className="w-[100px] text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            Carregando...
                          </TableCell>
                        </TableRow>
                      ) : servicos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            Nenhum serviço cadastrado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        servicos.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-semibold text-foreground">{s.nome}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="font-semibold">
                                R$ {s.valor.toFixed(2)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                                  <Pencil className="h-5 w-5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => {
                                    setItemToDelete(s)
                                    setDeleteStep(1)
                                  }}
                                >
                                  <Package className="h-5 w-5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={novoProdutoOpen} onOpenChange={setNovoProdutoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo produto</DialogTitle>
            <DialogDescription>Nome e valor; estoque inicia em 0.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Foto do produto (opcional)</Label>
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 overflow-hidden rounded border bg-white">
                  {novoFotoPreview ? (
                    <img src={novoFotoPreview} alt="Foto do produto" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <ImageOff className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null
                      setNovoFotoFile(file)
                      setNovoFotoError(null)
                      if (file) {
                        const url = URL.createObjectURL(file)
                        setNovoFotoPreview(url)
                      } else {
                        setNovoFotoPreview(null)
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!novoFotoFile && !novoFotoPreview}
                      onClick={() => {
                        setNovoFotoFile(null)
                        setNovoFotoPreview(null)
                        setNovoFotoError(null)
                      }}
                    >
                      Remover foto
                    </Button>
                  </div>
                  {novoFotoError ? <p className="text-xs text-red-600">{novoFotoError}</p> : null}
                </div>
              </div>
            </div>
            <div>
              <Label>Nome</Label>
              <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
            </div>
            <div>
              <Label>Preço médio de venda</Label>
              <Input type="number" step="0.01" value={novoValor} onChange={(e) => setNovoValor(e.target.value)} />
            </div>
            <div>
              <Label>Preço de custo (opcional)</Label>
              <Input
                type="number"
                step="0.01"
                value={novoPrecoCusto}
                onChange={(e) => setNovoPrecoCusto(e.target.value)}
                placeholder="Ex: 15.00"
              />
            </div>
            <div>
              <Label>Fornecedor (opcional)</Label>
              <Input value={novoFornecedor} onChange={(e) => setNovoFornecedor(e.target.value)} placeholder="Ex: Fornecedor A" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoProdutoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => handleCriarItem("Produto")} disabled={savingNovo}>
              {savingNovo ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={novoServicoOpen} onOpenChange={setNovoServicoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo serviço</DialogTitle>
            <DialogDescription>Categoria definida como Serviço; sem estoque.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
            </div>
            <div>
              <Label>Preço médio de venda</Label>
              <Input type="number" step="0.01" value={novoValor} onChange={(e) => setNovoValor(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoServicoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => handleCriarItem("Serviço")} disabled={savingNovo}>
              {savingNovo ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(movDialog)} onOpenChange={(open) => (!open ? setMovDialog(null) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {movDialog?.tipo === "ENTRADA" ? "Entrada" : "Saída"} - {movDialog?.item.nome}
            </DialogTitle>
            <DialogDescription>Registre a movimentação de estoque.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Quantidade</Label>
              <Input
                type="number"
                min={1}
                value={movQuantidade}
                onChange={(e) => setMovQuantidade(e.target.value)}
                placeholder="Ex: 5"
              />
            </div>
            <div>
              <Label>Observação</Label>
              <Input
                value={movObs}
                onChange={(e) => setMovObs(e.target.value)}
                placeholder="Motivo da movimentação"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={submitMovimentacao} disabled={movLoading}>
              {movLoading ? "Lançando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(historicoDialog)} onOpenChange={(open) => (!open ? setHistoricoDialog(null) : undefined)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Histórico de movimentações</DialogTitle>
            <DialogDescription>{historicoDialog?.nome}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[420px] overflow-y-auto space-y-3">
            {historico.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem movimentações.</p>
            ) : (
              historico.map((mov) => (
                <div
                  key={mov.id}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">
                        {mov.tipo === "ENTRADA" ? "Entrada" : "Saída"} de {mov.quantidade} unidades
                      </p>
                      <p className="text-xs text-muted-foreground">{mov.observacao}</p>
                    </div>
                    <Badge variant="outline" className="font-semibold">
                      {mov.tipo === "ENTRADA" ? "+" : "-"}
                      {mov.quantidade}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span>{formatDateTime(mov.createdAt)}</span>
                    <span className="flex items-center gap-1">
                      Estoque: {mov.totalAntes} → {mov.totalDepois}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editItem)} onOpenChange={(open) => (!open ? setEditItem(null) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar item</DialogTitle>
            <DialogDescription>Atualize dados visíveis apenas no estoque.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Foto do produto (opcional)</Label>
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 overflow-hidden rounded border bg-white">
                  {editFotoPreview ? (
                    <img src={editFotoPreview} alt="Foto do produto" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <ImageOff className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null
                      setEditFotoFile(file)
                      setEditFotoError(null)
                      if (file) {
                        const url = URL.createObjectURL(file)
                        setEditFotoPreview(url)
                      } else {
                        setEditFotoPreview(editFotoUrl)
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!editFotoFile && !editFotoPreview}
                      onClick={() => {
                        setEditFotoFile(null)
                        setEditFotoPreview(null)
                        setEditFotoUrl(null)
                        setEditFotoError(null)
                      }}
                    >
                      Remover foto
                    </Button>
                  </div>
                  {editFotoError ? <p className="text-xs text-red-600">{editFotoError}</p> : null}
                </div>
              </div>
            </div>
            <div>
              <Label>Nome</Label>
              <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} />
            </div>
            <div>
              <Label>Preço médio de venda</Label>
              <Input type="number" step="0.01" value={editValor} onChange={(e) => setEditValor(e.target.value)} />
            </div>
            <div>
              <Label>Preço de custo (opcional)</Label>
              <Input
                type="number"
                step="0.01"
                value={editPrecoCusto}
                onChange={(e) => setEditPrecoCusto(e.target.value)}
                placeholder="Ex: 15.00"
              />
            </div>
            <div>
              <Label>Fornecedor (opcional)</Label>
              <Input value={editFornecedor} onChange={(e) => setEditFornecedor(e.target.value)} placeholder="Ex: Fornecedor A" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>
              Cancelar
            </Button>
            <Button onClick={submitEdit} disabled={savingEdit}>
              {savingEdit ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3 Popups de confirmação para exclusão */}
      <Dialog open={deleteStep === 1} onOpenChange={(open) => !open && setDeleteStep(0)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Primeira confirmação
            </DialogTitle>
            <DialogDescription>
              Você tem certeza que deseja excluir o item <span className="font-bold">"{itemToDelete?.nome}"</span>?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteStep(0)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => setDeleteStep(2)}>Sim, eu tenho certeza</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteStep === 2} onOpenChange={(open) => !open && setDeleteStep(0)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Segunda confirmação
            </DialogTitle>
            <DialogDescription>
              Atenção! A exclusão de um item pode afetar relatórios e históricos.
              Continuar com a exclusão de <span className="font-bold">"{itemToDelete?.nome}"</span>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteStep(0)}>Manter item</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={() => setDeleteStep(3)}>Continuar para confirmação final</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteStep === 3} onOpenChange={(open) => !open && setDeleteStep(0)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700 text-xl">
              <AlertTriangle className="h-6 w-6" />
              CONFIRMAÇÃO FINAL
            </DialogTitle>
            <DialogDescription className="text-foreground font-medium">
              Esta é a última chance. O item será removido permanentemente do banco de dados
              (apenas se ele tiver menos de 50 pedidos vinculados).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteStep(0)}>Desistir</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Excluindo..." : "EXCLUIR DEFINITIVAMENTE"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
