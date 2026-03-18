"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import {
  Building2,
  Check,
  ChevronDown,
  Loader2,
  Plus,
  Search,
  User,
  X,
  UserPlus,
  Trash2,
} from "lucide-react"
import { maskPhone, unmask } from "@/lib/formatters"

type Administradora = {
  id: number
  nome: string
  cnpj?: string | null
}

type Gerente = {
  id: number
  nome: string
  email?: string | null
  celular?: string | null
  whatsapp?: string | null
}

type GerenteVinculado = Gerente & {
  vinculoId: number
}

type Props = {
  /** ID do cliente (se for cliente) */
  clientId?: number
  /** ID da ficha (se for ficha) */
  fichaId?: number
  /** Administradora atual */
  administradoraAtual?: { id: number; nome: string } | null
  /** Callback quando dados são salvos */
  onSave?: () => void
  /** Se está em modo somente leitura */
  readOnly?: boolean
}

export function AdministradoraGerentesManager({
  clientId,
  fichaId,
  administradoraAtual,
  onSave,
  readOnly = false,
}: Props) {
  const { toast } = useToast()

  // Estado da administradora
  const [administradoras, setAdministradoras] = useState<Administradora[]>([])
  const [loadingAdministradoras, setLoadingAdministradoras] = useState(false)
  const [administradoraSelecionada, setAdministradoraSelecionada] = useState<Administradora | null>(null)
  const [openAdmPopover, setOpenAdmPopover] = useState(false)
  const [searchAdm, setSearchAdm] = useState("")

  // Estado dos gerentes
  const [gerentesAdministradora, setGerentesAdministradora] = useState<Gerente[]>([])
  const [gerentesVinculados, setGerentesVinculados] = useState<GerenteVinculado[]>([])
  const [loadingGerentes, setLoadingGerentes] = useState(false)
  const [openGerentePopover, setOpenGerentePopover] = useState(false)
  const [searchGerente, setSearchGerente] = useState("")

  // Estado de criação
  const [criarAdmDialogOpen, setCriarAdmDialogOpen] = useState(false)
  const [novaAdmNome, setNovaAdmNome] = useState("")
  const [novaAdmCnpj, setNovaAdmCnpj] = useState("")
  const [criandoAdm, setCriandoAdm] = useState(false)

  const [criarGerenteDialogOpen, setCriarGerenteDialogOpen] = useState(false)
  const [novoGerenteNome, setNovoGerenteNome] = useState("")
  const [novoGerenteEmail, setNovoGerenteEmail] = useState("")
  const [novoGerenteCelular, setNovoGerenteCelular] = useState("")
  const [criandoGerente, setCriandoGerente] = useState(false)

  // Estado de salvamento
  const [saving, setSaving] = useState(false)

  // Inicializa com administradora atual
  useEffect(() => {
    if (administradoraAtual) {
      setAdministradoraSelecionada({
        id: administradoraAtual.id,
        nome: administradoraAtual.nome,
      })
    } else {
      setAdministradoraSelecionada(null)
    }
  }, [administradoraAtual])

  // Carrega administradoras
  const loadAdministradoras = useCallback(async () => {
    setLoadingAdministradoras(true)
    try {
      const res = await fetch("/api/administradoras")
      const data = await res.json()
      if (Array.isArray(data?.data)) {
        setAdministradoras(data.data)
      }
    } catch (error) {
      console.error("Erro ao carregar administradoras:", error)
    } finally {
      setLoadingAdministradoras(false)
    }
  }, [])

  // Carrega gerentes da administradora
  const loadGerentesAdministradora = useCallback(async (admId: number) => {
    setLoadingGerentes(true)
    try {
      const res = await fetch(`/api/administradoras/${admId}/gerentes`)
      const data = await res.json()
      if (Array.isArray(data?.data)) {
        setGerentesAdministradora(data.data)
      }
    } catch (error) {
      console.error("Erro ao carregar gerentes:", error)
    } finally {
      setLoadingGerentes(false)
    }
  }, [])

  // Carrega gerentes vinculados ao cliente/ficha
  const loadGerentesVinculados = useCallback(async () => {
    if (!clientId && !fichaId) return

    try {
      const param = clientId ? `clientId=${clientId}` : `fichaId=${fichaId}`
      const res = await fetch(`/api/gerentes-vinculo?${param}`)
      const data = await res.json()
      if (Array.isArray(data?.data)) {
        setGerentesVinculados(data.data)
      }
    } catch (error) {
      console.error("Erro ao carregar gerentes vinculados:", error)
    }
  }, [clientId, fichaId])

  // Carrega dados iniciais
  useEffect(() => {
    loadAdministradoras()
    loadGerentesVinculados()
  }, [loadAdministradoras, loadGerentesVinculados])

  // Quando muda a administradora selecionada, carrega os gerentes dela
  useEffect(() => {
    if (administradoraSelecionada) {
      loadGerentesAdministradora(administradoraSelecionada.id)
    } else {
      setGerentesAdministradora([])
    }
  }, [administradoraSelecionada, loadGerentesAdministradora])

  // Filtra administradoras pela pesquisa
  const administradorasFiltradas = administradoras.filter((adm) =>
    adm.nome.toLowerCase().includes(searchAdm.toLowerCase())
  )

  // Filtra gerentes pela pesquisa (exclui os já vinculados)
  const gerentesDisponiveis = gerentesAdministradora.filter(
    (g) => !gerentesVinculados.some((gv) => gv.id === g.id) &&
      g.nome.toLowerCase().includes(searchGerente.toLowerCase())
  )

  // Verifica se pode trocar administradora
  const podeAlterarAdministradora = gerentesVinculados.length === 0

  // Vincular gerente
  const vincularGerente = async (gerente: Gerente) => {
    if (!clientId && !fichaId) return

    setSaving(true)
    try {
      const res = await fetch(`/api/gerentes-vinculo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientId || null,
          fichaId: fichaId || null,
          gerenteId: gerente.id,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Erro ao vincular gerente")
      }

      const data = await res.json()
      setGerentesVinculados((prev) => [...prev, { ...gerente, vinculoId: data.vinculoId }])
      setOpenGerentePopover(false)

      toast({ title: "Gerente vinculado com sucesso" })
      onSave?.()
    } catch (error) {
      console.error("Erro ao vincular gerente:", error)
      toast({
        variant: "destructive",
        title: "Erro ao vincular gerente",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      })
    } finally {
      setSaving(false)
    }
  }

  // Desvincular gerente
  const desvincularGerente = async (gerente: GerenteVinculado) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/gerentes-vinculo?vinculoId=${gerente.vinculoId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Erro ao desvincular gerente")
      }

      setGerentesVinculados((prev) => prev.filter((g) => g.vinculoId !== gerente.vinculoId))

      toast({ title: "Gerente desvinculado com sucesso" })
      onSave?.()
    } catch (error) {
      console.error("Erro ao desvincular gerente:", error)
      toast({
        variant: "destructive",
        title: "Erro ao desvincular gerente",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      })
    } finally {
      setSaving(false)
    }
  }

  // Alterar administradora
  const alterarAdministradora = async (novaAdm: Administradora | null) => {
    if (!podeAlterarAdministradora) {
      toast({
        variant: "destructive",
        title: "Não é possível alterar",
        description: "Desvincule todos os gerentes antes de alterar a administradora.",
      })
      return
    }

    if (!clientId && !fichaId) {
      setAdministradoraSelecionada(novaAdm)
      setOpenAdmPopover(false)
      return
    }

    setSaving(true)
    try {
      const tipo = clientId ? "client" : "ficha"
      const id = clientId || fichaId

      const res = await fetch(`/api/${tipo}s/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ administradoraId: novaAdm?.id || null }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Erro ao alterar administradora")
      }

      setAdministradoraSelecionada(novaAdm)
      setOpenAdmPopover(false)

      toast({ title: novaAdm ? "Administradora alterada" : "Administradora removida" })
      onSave?.()
    } catch (error) {
      console.error("Erro ao alterar administradora:", error)
      toast({
        variant: "destructive",
        title: "Erro ao alterar administradora",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      })
    } finally {
      setSaving(false)
    }
  }

  // Criar nova administradora
  const criarAdministradora = async () => {
    if (!novaAdmNome.trim()) {
      toast({ variant: "destructive", title: "Nome é obrigatório" })
      return
    }

    setCriandoAdm(true)
    try {
      const res = await fetch("/api/administradoras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: novaAdmNome.trim(),
          cnpj: novaAdmCnpj ? unmask(novaAdmCnpj) : null,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Erro ao criar administradora")
      }

      const data = await res.json()
      const novaAdm = data.data as Administradora

      setAdministradoras((prev) => [...prev, novaAdm])
      await alterarAdministradora(novaAdm)

      setCriarAdmDialogOpen(false)
      setNovaAdmNome("")
      setNovaAdmCnpj("")

      toast({ title: "Administradora criada com sucesso" })
    } catch (error) {
      console.error("Erro ao criar administradora:", error)
      toast({
        variant: "destructive",
        title: "Erro ao criar administradora",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      })
    } finally {
      setCriandoAdm(false)
    }
  }

  // Criar novo gerente
  const criarGerente = async () => {
    if (!novoGerenteNome.trim()) {
      toast({ variant: "destructive", title: "Nome é obrigatório" })
      return
    }

    if (!administradoraSelecionada) {
      toast({ variant: "destructive", title: "Selecione uma administradora primeiro" })
      return
    }

    setCriandoGerente(true)
    try {
      const res = await fetch(`/api/administradoras/${administradoraSelecionada.id}/gerentes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: novoGerenteNome.trim(),
          email: novoGerenteEmail.trim() || null,
          celular: novoGerenteCelular ? unmask(novoGerenteCelular) : null,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Erro ao criar gerente")
      }

      const data = await res.json()
      const novoGerente = data.data as Gerente

      setGerentesAdministradora((prev) => [...prev, novoGerente])

      // Vincula automaticamente
      await vincularGerente(novoGerente)

      setCriarGerenteDialogOpen(false)
      setNovoGerenteNome("")
      setNovoGerenteEmail("")
      setNovoGerenteCelular("")

      toast({ title: "Gerente criado e vinculado com sucesso" })
      onSave?.()
    } catch (error) {
      console.error("Erro ao criar gerente:", error)
      toast({
        variant: "destructive",
        title: "Erro ao criar gerente",
        description: error instanceof Error ? error.message : "Erro desconhecido",
      })
    } finally {
      setCriandoGerente(false)
    }
  }

  // Modo somente leitura
  if (readOnly) {
    return (
      <div className="py-1.5">
        <h4 className="text-[11px] font-bold uppercase text-muted-foreground mb-1 flex items-center gap-1">
          <Building2 className="h-3 w-3" /> Administradora
        </h4>
        <div className="text-[13px] text-foreground">
          <p><strong>{administradoraSelecionada?.nome ?? "Não informado"}</strong></p>
          {gerentesVinculados.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {gerentesVinculados.map((gerente) => (
                <p key={gerente.vinculoId} className="text-[12px] text-muted-foreground">
                  • {gerente.nome}
                  {gerente.email && ` • ${gerente.email}`}
                  {gerente.celular && ` • ${gerente.celular}`}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="border border-border rounded-md p-3 space-y-3">
      <h4 className="text-[11px] font-bold uppercase text-foreground flex items-center gap-1">
        <Building2 className="h-3 w-3" /> Administradora e Gerentes
      </h4>

      {/* Seletor de Administradora */}
      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">Administradora</Label>
        <div className="flex gap-2">
          <div className="flex-1 flex gap-1">
            <Popover open={openAdmPopover} onOpenChange={setOpenAdmPopover}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  disabled={!podeAlterarAdministradora || saving}
                  className={cn(
                    "flex-1 justify-between text-[13px] h-9",
                    !podeAlterarAdministradora && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span className="truncate">{administradoraSelecionada?.nome || "Selecione..."}</span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Buscar administradora..."
                    value={searchAdm}
                    onValueChange={setSearchAdm}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {loadingAdministradoras ? "Carregando..." : "Nenhuma encontrada."}
                    </CommandEmpty>
                    {administradoraSelecionada && podeAlterarAdministradora && (
                      <CommandGroup heading="Ações">
                        <CommandItem
                          onSelect={() => {
                            if (window.confirm("Deseja remover o vínculo com esta administradora?")) {
                              alterarAdministradora(null)
                            }
                          }}
                          className="text-red-600 font-medium"
                        >
                          <X className="mr-2 h-4 w-4" />
                          Remover Administradora
                        </CommandItem>
                      </CommandGroup>
                    )}
                    <CommandGroup heading="Administradoras">
                      {administradorasFiltradas.map((adm) => (
                        <CommandItem
                          key={adm.id}
                          value={adm.nome}
                          onSelect={() => alterarAdministradora(adm)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              administradoraSelecionada?.id === adm.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {adm.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {administradoraSelecionada && podeAlterarAdministradora && (
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={() => {
                  if (window.confirm("Deseja remover o vínculo com esta administradora?")) {
                    alterarAdministradora(null)
                  }
                }}
                disabled={saving}
                title="Remover administradora"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setCriarAdmDialogOpen(true)}
            disabled={!podeAlterarAdministradora || saving}
            title="Criar nova administradora"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {!podeAlterarAdministradora && (
          <p className="text-[10px] text-amber-600">
            Desvincule todos os gerentes para poder alterar a administradora.
          </p>
        )}
      </div>

      <Separator />

      {/* Gerentes Vinculados */}
      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">Gerentes Vinculados</Label>

        {gerentesVinculados.length === 0 ? (
          <p className="text-[12px] text-muted-foreground italic">Nenhum gerente vinculado</p>
        ) : (
          <div className="space-y-1">
            {gerentesVinculados.map((gerente) => (
              <div
                key={gerente.vinculoId}
                className="flex items-center justify-between bg-muted/50 rounded px-2 py-1.5"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-[12px] font-medium truncate">{gerente.nome}</span>
                  </div>
                  {(gerente.email || gerente.celular) && (
                    <div className="text-[11px] text-muted-foreground ml-5 truncate">
                      {gerente.email}{gerente.email && gerente.celular && " • "}{gerente.celular}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                  onClick={() => desvincularGerente(gerente)}
                  disabled={saving}
                  title="Desvincular gerente"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Adicionar Gerente */}
      {administradoraSelecionada && (
        <div className="flex gap-2">
          <Popover open={openGerentePopover} onOpenChange={setOpenGerentePopover}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="flex-1 justify-start text-[12px] h-8 gap-2"
                disabled={saving || loadingGerentes}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Adicionar gerente...
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Buscar gerente..."
                  value={searchGerente}
                  onValueChange={setSearchGerente}
                />
                <CommandList>
                  <CommandEmpty>
                    {loadingGerentes ? "Carregando..." : "Nenhum gerente encontrado."}
                  </CommandEmpty>
                  <CommandGroup>
                    {gerentesDisponiveis.map((gerente) => (
                      <CommandItem
                        key={gerente.id}
                        value={gerente.nome}
                        onSelect={() => vincularGerente(gerente)}
                      >
                        <User className="mr-2 h-4 w-4" />
                        <div>
                          <p className="text-sm">{gerente.nome}</p>
                          {gerente.email && (
                            <p className="text-xs text-muted-foreground">{gerente.email}</p>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCriarGerenteDialogOpen(true)}
            disabled={saving}
            title="Criar novo gerente"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Dialog Criar Administradora */}
      <Dialog open={criarAdmDialogOpen} onOpenChange={setCriarAdmDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Nova Administradora</DialogTitle>
            <DialogDescription>
              Preencha os dados da nova administradora.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="novaAdmNome">Nome *</Label>
              <Input
                id="novaAdmNome"
                placeholder="Nome da administradora"
                value={novaAdmNome}
                onChange={(e) => setNovaAdmNome(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="novaAdmCnpj">CNPJ (opcional)</Label>
              <Input
                id="novaAdmCnpj"
                placeholder="00.000.000/0000-00"
                value={novaAdmCnpj}
                onChange={(e) => setNovaAdmCnpj(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCriarAdmDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={criarAdministradora} disabled={criandoAdm}>
              {criandoAdm ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Criando...
                </span>
              ) : (
                "Criar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Criar Gerente */}
      <Dialog open={criarGerenteDialogOpen} onOpenChange={setCriarGerenteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Novo Gerente</DialogTitle>
            <DialogDescription>
              Preencha os dados do novo gerente para {administradoraSelecionada?.nome}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="novoGerenteNome">Nome *</Label>
              <Input
                id="novoGerenteNome"
                placeholder="Nome do gerente"
                value={novoGerenteNome}
                onChange={(e) => setNovoGerenteNome(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="novoGerenteEmail">Email (opcional)</Label>
              <Input
                id="novoGerenteEmail"
                type="email"
                placeholder="email@exemplo.com"
                value={novoGerenteEmail}
                onChange={(e) => setNovoGerenteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="novoGerenteCelular">Celular (opcional)</Label>
              <Input
                id="novoGerenteCelular"
                placeholder="(00) 00000-0000"
                value={maskPhone(novoGerenteCelular)}
                onChange={(e) => setNovoGerenteCelular(unmask(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCriarGerenteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={criarGerente} disabled={criandoGerente}>
              {criandoGerente ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Criando...
                </span>
              ) : (
                "Criar e Vincular"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

