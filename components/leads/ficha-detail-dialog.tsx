"use client"

import { useCallback, useEffect, useState, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  ShieldCheck,
  Loader2,
  Clock3,
  MessageSquare,
  Send,
} from "lucide-react"
import {
  maskCEP,
  maskCNPJ,
  maskPhone,
  unmask,
  formatCNPJ,
  formatRazaoSocial,
} from "@/lib/formatters"
import { toDateInputValue, toDateTimeInputValue } from "@/lib/date-utils"
import { AdministradoraGerentesManager } from "@/components/administradoras/administradora-gerentes-manager"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ESPECIFICACAO_CONDOMINIO_OPTIONS, getEspecificacaoCondominioLabel, type EspecificacaoCondominioType } from "@/lib/constants/especificacao-condominio"

type FichaSummary = {
  id: number
  cnpj: string
  razaoSocial?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
  nomeSindico?: string | null
  telefoneSindico?: string | null
  observacao?: string | null
  ultimaAtualizacao?: string | null
}

type FichaDetailDialogProps = {
  ficha: FichaSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate?: () => void
}

type RawFichaDetail = {
  id: number
  cnpj: string
  razaoSocial: string | null
  fichaStatus: string
  ultimaManutencao: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  estado: string | null
  cidade: string | null
  telefoneCondominio: string | null
  celularCondominio: string | null
  nomeSindico: string | null
  telefoneSindico: string | null
  dataInicioMandato: string | null
  dataFimMandato: string | null
  dataAniversarioSindico: string | null
  emailSindico: string | null
  nomePorteiro: string | null
  telefonePorteiro: string | null
  quantidadeSPDA: number | null
  especificacaoCondominio: EspecificacaoCondominioType | null
  observacao: string | null
  dataContatoAgendado: string | null
  administradora: { id: string; nome: string } | null
  pesquisador: { id: string; name: string | null } | null
  createdAt: string
  updatedAt: string
  logs: { id: number; tipo: string; createdAt: string; user: { id: string | null; name: string | null } }[]
}

type ClientRegistroItem = {
  id: number
  clientId: number
  mensagem: string
  userId: string
  userName: string
  createdAt: string
  updatedAt: string
}

// Agora usando toDateInputValue de lib/date-utils

const fichaStatusLabel: Record<string, string> = {
  EM_PESQUISA: "Em pesquisa",
  FINALIZADA: "Finalizada",
}

export function FichaDetailDialog({ ficha, open, onOpenChange, onUpdate }: FichaDetailDialogProps) {
  const { toast } = useToast()
  const [fichaDetail, setFichaDetail] = useState<RawFichaDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingData, setEditingData] = useState<Partial<RawFichaDetail>>({})
  const [originalData, setOriginalData] = useState<Partial<RawFichaDetail>>({})
  const [saving, setSaving] = useState(false)
  const [enviandoVendas, setEnviandoVendas] = useState(false)
  const [confirmEnviarOpen, setConfirmEnviarOpen] = useState(false)

  // Registros state
  const [registros, setRegistros] = useState<ClientRegistroItem[]>([])
  const [loadingRegistros, setLoadingRegistros] = useState(false)
  const [registrosError, setRegistrosError] = useState<string | null>(null)
  const [newRegistroText, setNewRegistroText] = useState("")
  const [creatingRegistro, setCreatingRegistro] = useState(false)
  const registrosLateralRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when registros change
  useEffect(() => {
    if (registrosLateralRef.current) {
      registrosLateralRef.current.scrollTop = registrosLateralRef.current.scrollHeight
    }
  }, [registros])


  const loadRegistros = useCallback(
    async (signal?: AbortSignal) => {
      if (!ficha?.cnpj) return
      try {
        setLoadingRegistros(true)
        setRegistrosError(null)

        const response = await fetch(`/api/fichas/client-registros?cnpj=${ficha.cnpj}`, {
          signal,
        })

        if (!response.ok) {
          throw new Error("Erro ao carregar registros")
        }

        const data = await response.json()
        setRegistros(data.data ?? [])
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        setRegistrosError(err instanceof Error ? err.message : "Erro desconhecido")
        console.error("Erro ao carregar registros:", err)
      } finally {
        setLoadingRegistros(false)
      }
    },
    [ficha?.cnpj]
  )

  const createRegistro = useCallback(async () => {
    if (!newRegistroText.trim() || !ficha?.cnpj) return

    setCreatingRegistro(true)
    try {
      const response = await fetch(`/api/fichas/client-registros`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cnpj: ficha.cnpj,
          mensagem: newRegistroText.trim(),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Erro ao criar registro")
      }

      setNewRegistroText("")
      await loadRegistros()
    } catch (err) {
      toast({
        title: "Erro ao criar registro",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      })
    } finally {
      setCreatingRegistro(false)
    }
  }, [newRegistroText, ficha?.cnpj, loadRegistros, toast])

  const loadFichaDetail = useCallback(
    async (signal?: AbortSignal) => {
      if (!ficha) return

      try {
        setLoading(true)
        setError(null)
        setFichaDetail(null)

        const response = await fetch(`/api/fichas/${ficha.id}`, { signal })

        if (!response.ok) {
          throw new Error("Erro ao carregar detalhes da ficha")
        }

        const data = (await response.json()) as RawFichaDetail
        setFichaDetail(data)

        const initialData: Partial<RawFichaDetail> = {
          razaoSocial: data.razaoSocial,
          cep: data.cep,
          logradouro: data.logradouro,
          numero: data.numero,
          complemento: data.complemento,
          bairro: data.bairro,
          cidade: data.cidade,
          estado: data.estado,
          telefoneCondominio: data.telefoneCondominio,
          celularCondominio: data.celularCondominio,
          nomeSindico: data.nomeSindico,
          telefoneSindico: data.telefoneSindico,
          emailSindico: data.emailSindico,
          dataAniversarioSindico: toDateInputValue(data.dataAniversarioSindico),
          dataInicioMandato: toDateInputValue(data.dataInicioMandato),
          dataFimMandato: toDateInputValue(data.dataFimMandato),
          nomePorteiro: data.nomePorteiro,
          telefonePorteiro: data.telefonePorteiro,
          quantidadeSPDA: data.quantidadeSPDA,
          especificacaoCondominio: data.especificacaoCondominio,
          observacao: data.observacao,
          // dataContatoAgendado usa datetime-local (YYYY-MM-DDTHH:mm)
          dataContatoAgendado: toDateTimeInputValue(data.dataContatoAgendado),
          ultimaManutencao: toDateInputValue(data.ultimaManutencao),
        }
        setEditingData(initialData)
        setOriginalData(JSON.parse(JSON.stringify(initialData)))
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        setError(err instanceof Error ? err.message : "Erro desconhecido")
        console.error("Erro ao carregar detalhes da ficha:", err)
      } finally {
        setLoading(false)
      }
    },
    [ficha],
  )

  useEffect(() => {
    if (!open || !ficha) {
      setEditingData({})
      setOriginalData({})
      setFichaDetail(null)
      setError(null)
      return
    }

    const controller = new AbortController()
    loadFichaDetail(controller.signal).catch(console.error)
    loadRegistros(controller.signal).catch(console.error)

    return () => {
      controller.abort()
    }
  }, [open, ficha, loadFichaDetail])

  const hasChanges = () => {
    return JSON.stringify(editingData) !== JSON.stringify(originalData)
  }

  const handleSave = async () => {
    if (!fichaDetail) return

    try {
      setSaving(true)

      const payload = {
        razaoSocial: editingData.razaoSocial ?? fichaDetail.razaoSocial,
        cep: editingData.cep ? unmask(editingData.cep.toString()) : null,
        logradouro: editingData.logradouro ?? fichaDetail.logradouro ?? null,
        numero: editingData.numero ?? fichaDetail.numero ?? null,
        complemento: editingData.complemento ?? fichaDetail.complemento ?? null,
        bairro: editingData.bairro ?? fichaDetail.bairro ?? null,
        cidade: editingData.cidade ?? fichaDetail.cidade ?? null,
        estado: editingData.estado ?? fichaDetail.estado ?? null,
        telefoneCondominio: editingData.telefoneCondominio ? unmask(editingData.telefoneCondominio.toString()) : null,
        celularCondominio: editingData.celularCondominio ? unmask(editingData.celularCondominio.toString()) : null,
        nomeSindico: editingData.nomeSindico ?? fichaDetail.nomeSindico ?? null,
        telefoneSindico: editingData.telefoneSindico ? unmask(editingData.telefoneSindico.toString()) : null,
        emailSindico: editingData.emailSindico ?? fichaDetail.emailSindico ?? null,
        dataAniversarioSindico: editingData.dataAniversarioSindico || null,
        dataInicioMandato: editingData.dataInicioMandato || null,
        dataFimMandato: editingData.dataFimMandato || null,
        nomePorteiro: editingData.nomePorteiro ?? fichaDetail.nomePorteiro ?? null,
        telefonePorteiro: editingData.telefonePorteiro ? unmask(editingData.telefonePorteiro.toString()) : null,
        quantidadeSPDA: editingData.quantidadeSPDA ?? fichaDetail.quantidadeSPDA ?? null,
        especificacaoCondominio: editingData.especificacaoCondominio ?? fichaDetail.especificacaoCondominio ?? null,
        observacao: editingData.observacao ?? fichaDetail.observacao ?? null,
        dataContatoAgendado: editingData.dataContatoAgendado || null,
        ultimaManutencao: editingData.ultimaManutencao || null,
      }

      const response = await fetch(`/api/fichas/${fichaDetail.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error("Erro ao salvar alterações")
      }

      const updatedData = (await response.json()) as RawFichaDetail
      setFichaDetail(updatedData)

      const updatedInitialData: Partial<RawFichaDetail> = {
        razaoSocial: updatedData.razaoSocial,
        cep: updatedData.cep,
        logradouro: updatedData.logradouro,
        numero: updatedData.numero,
        complemento: updatedData.complemento,
        bairro: updatedData.bairro,
        cidade: updatedData.cidade,
        estado: updatedData.estado,
        telefoneCondominio: updatedData.telefoneCondominio,
        celularCondominio: updatedData.celularCondominio,
        nomeSindico: updatedData.nomeSindico,
        telefoneSindico: updatedData.telefoneSindico,
        emailSindico: updatedData.emailSindico,
        dataAniversarioSindico: toDateInputValue(updatedData.dataAniversarioSindico),
        dataInicioMandato: toDateInputValue(updatedData.dataInicioMandato),
        dataFimMandato: toDateInputValue(updatedData.dataFimMandato),
        nomePorteiro: updatedData.nomePorteiro,
        telefonePorteiro: updatedData.telefonePorteiro,
        quantidadeSPDA: updatedData.quantidadeSPDA,
        especificacaoCondominio: updatedData.especificacaoCondominio,
        observacao: updatedData.observacao,
        // dataContatoAgendado usa datetime-local (YYYY-MM-DDTHH:mm)
        dataContatoAgendado: toDateTimeInputValue(updatedData.dataContatoAgendado),
        ultimaManutencao: toDateInputValue(updatedData.ultimaManutencao),
      }
      setEditingData(updatedInitialData)
      setOriginalData(JSON.parse(JSON.stringify(updatedInitialData)))

      toast({
        title: "Ficha atualizada!",
        description: "As informações foram salvas com sucesso.",
      })

      onUpdate?.()
    } catch (err) {
      console.error("Erro ao salvar:", err)
      toast({
        title: "Erro ao salvar",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const updateEditingField = (field: keyof RawFichaDetail, value: string | number | null) => {
    setEditingData((prev) => ({ ...prev, [field]: value }))
  }

  const handleEnviarParaVendas = async () => {
    if (!fichaDetail) return

    try {
      setEnviandoVendas(true)
      const response = await fetch(`/api/fichas/${fichaDetail.id}/enviar-vendas`, {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erro ao enviar para vendas")
      }

      toast({
        title: "Enviado para vendas!",
        description: "A ficha foi convertida em cliente com sucesso.",
      })

      setConfirmEnviarOpen(false)
      onOpenChange(false)
      onUpdate?.()
    } catch (err) {
      console.error("Erro ao enviar para vendas:", err)
      toast({
        title: "Erro ao enviar para vendas",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      })
    } finally {
      setEnviandoVendas(false)
    }
  }

  const renderField = (
    label: string,
    field: keyof RawFichaDetail,
    value: string | number | null | undefined,
    type: "text" | "number" | "date" | "datetime-local" | "textarea" | "cep" | "cnpj" | "phone" = "text",
    placeholder?: string,
  ) => {
    const displayValue = value ?? null
    const editValue = (editingData[field] as string | number | null | undefined) ?? displayValue

    if (type === "textarea") {
      return (
        <div>
          <p className="text-xs font-semibold text-foreground mb-1">{label}</p>
          <Textarea
            value={editValue?.toString() ?? ""}
            onChange={(e) => updateEditingField(field, e.target.value || null)}
            placeholder={placeholder || "Não informado"}
            className="min-h-16 text-xs bg-background border-border focus:border-blue-500"
          />
        </div>
      )
    }

    let displayValueFormatted = editValue?.toString() ?? ""
    let onChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value
      if (type === "number") {
        const numValue = rawValue ? Number.parseInt(rawValue, 10) : null
        updateEditingField(field, numValue)
      } else {
        updateEditingField(field, rawValue || null)
      }
    }

    if (type === "cep") {
      displayValueFormatted = maskCEP(displayValueFormatted)
      onChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = unmask(e.target.value)
        updateEditingField(field, rawValue || null)
      }
    } else if (type === "cnpj") {
      displayValueFormatted = maskCNPJ(displayValueFormatted)
      onChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = unmask(e.target.value)
        updateEditingField(field, rawValue || null)
      }
    } else if (type === "phone") {
      displayValueFormatted = maskPhone(displayValueFormatted)
      onChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = unmask(e.target.value)
        updateEditingField(field, rawValue || null)
      }
    }

    const inputType = type === "date" || type === "number" || type === "datetime-local" ? type : "text"

    return (
      <div>
        <p className="text-xs font-semibold text-foreground mb-1">{label}</p>
        <input
          type={inputType}
          data-slot="input"
          value={displayValueFormatted}
          onChange={onChangeHandler}
          placeholder={placeholder || "Não informado"}
          className={cn(
            "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive text-[0.8rem] bg-background border-border focus:border-blue-500",
          )}
        />
      </div>
    )
  }

  if (!ficha) {
    return null
  }

  const shouldShowSkeleton = loading || (!fichaDetail && !error)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-4xl !max-w-6xl h-[100dvh] md:h-[90vh] max-h-[100dvh] md:max-h-[calc(100vh-24px)] overflow-hidden bg-card border-border text-sm p-4 sm:p-6">
        {shouldShowSkeleton ? (
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <Skeleton className="h-6 w-48" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
            <div className="space-y-6">
              {Array.from({ length: 3 }).map((_, sectionIndex) => (
                <div key={sectionIndex} className="space-y-3">
                  <Skeleton className="h-4 w-40" />
                  <div className="grid grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Skeleton key={index} className="h-16 w-full" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
            <p>{error}</p>
            <Button variant="outline" onClick={() => loadFichaDetail().catch(console.error)}>
              Tentar novamente
            </Button>
          </div>
        ) : fichaDetail ? (
          <div className="flex flex-col md:flex-row gap-6 h-full min-h-0 overflow-hidden">
            <div className="flex-1 min-w-0 flex flex-col h-full overflow-y-auto pr-2">
              <DialogHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1.5">
                      <DialogTitle className="text-sm md:text-lg font-bold text-foreground flex items-center gap-2 leading-tight">
                        <Building2 className="h-6 w-6 md:h-8 md:w-8 text-blue-600" />
                        {fichaDetail.razaoSocial ? formatRazaoSocial(fichaDetail.razaoSocial) : "Ficha sem nome"}
                      </DialogTitle>


                    </div>
                    <DialogDescription className="text-sm text-muted-foreground">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-mono">CNPJ: {formatCNPJ(fichaDetail.cnpj)}</span>
                        <span className="text-foreground font-semibold">
                          Pesquisador:{" "}
                          <span className="font-medium text-muted-foreground">
                            {fichaDetail.pesquisador?.name ?? "Não atribuído"}
                          </span>
                        </span>
                      </div>
                    </DialogDescription>
                  </div>
                  <div className="flex flex-col h-full justify-between items-end gap-3">
                    <div className="flex gap-2">
                      <Button
                        className="bg-green-600 hover:bg-green-700 text-white h-10 px-4"
                        onClick={() => setConfirmEnviarOpen(true)}
                        disabled={fichaDetail.fichaStatus === "FINALIZADA" || hasChanges()}
                        title={hasChanges() ? "Salve as alterações antes de enviar para vendas" : undefined}
                      >
                        Enviar para Vendas
                      </Button>
                      <Button
                        className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-4"
                        onClick={handleSave}
                        disabled={!hasChanges() || saving}
                      >
                        {saving ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Salvando...
                          </span>
                        ) : (
                          "Salvar"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <Tabs defaultValue="info" className="mt-4 w-full">
                <TabsList className="inline-flex rounded-2xl border border-slate-300 bg-white p-0 shadow-sm overflow-hidden">
                  <TabsTrigger
                    value="info"
                    className="px-6 py-3 text-sm font-semibold text-slate-600 transition data-[state=active]:bg-blue-600 data-[state=active]:text-white border-r border-slate-300 last:border-r-0"
                  >
                    Informações
                  </TabsTrigger>
                  <TabsTrigger
                    value="historico"
                    className="px-6 py-3 text-sm font-semibold text-slate-600 transition data-[state=active]:bg-blue-600 data-[state=active]:text-white last:border-r-0 border-r border-slate-300"
                  >
                    Histórico
                  </TabsTrigger>
                  <TabsTrigger
                    value="registros"
                    className="px-6 py-3 text-sm font-semibold text-slate-600 transition data-[state=active]:bg-blue-600 data-[state=active]:text-white last:border-r-0 sm:hidden"
                  >
                    Registros
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-3 mt-3">
                  {/* Datas e Controle - no topo */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">Datas e Controle</h3>
                    <div className="bg-muted/50 p-3 rounded-lg border border-border">
                      <div className="grid grid-cols-2 gap-3">
                        {renderField("Última Manutenção", "ultimaManutencao", toDateInputValue(fichaDetail.ultimaManutencao), "date")}
                        {renderField("Próximo Contato", "dataContatoAgendado", toDateTimeInputValue(fichaDetail.dataContatoAgendado), "datetime-local")}
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-border" />

                  {/* Dados do Condomínio */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-blue-600" />
                      Dados do Condomínio
                    </h3>
                    <div className="bg-muted/50 p-3 rounded-lg border border-border">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {renderField("Razão Social", "razaoSocial", fichaDetail.razaoSocial)}
                        <div>
                          <p className="text-xs font-semibold text-foreground mb-1">CNPJ</p>
                          <p className="text-sm font-mono text-muted-foreground py-2">
                            {formatCNPJ(fichaDetail.cnpj)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                        {renderField("Telefone do Condomínio", "telefoneCondominio", fichaDetail.telefoneCondominio, "phone")}
                        {renderField("Celular do Condomínio", "celularCondominio", fichaDetail.celularCondominio, "phone")}
                        {renderField("Quantidade de SPDA", "quantidadeSPDA", fichaDetail.quantidadeSPDA, "number")}
                        <div>
                          <p className="text-xs font-semibold text-foreground mb-1">Tipo de Condomínio</p>
                          <Select
                            value={editingData.especificacaoCondominio ?? fichaDetail.especificacaoCondominio ?? undefined}
                            onValueChange={(val) => updateEditingField("especificacaoCondominio", val)}
                          >
                            <SelectTrigger className="h-10 text-[0.8rem] bg-background border-border">
                              <SelectValue placeholder="Não informado" />
                            </SelectTrigger>
                            <SelectContent>
                              {ESPECIFICACAO_CONDOMINIO_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="mt-4 border-t border-border pt-3">
                        <div className="grid gap-3">
                          {renderField("CEP", "cep", fichaDetail.cep, "cep")}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {renderField("Logradouro", "logradouro", fichaDetail.logradouro)}
                            <div className="w-auto">
                              {renderField("Número", "numero", fichaDetail.numero)}
                            </div>
                            {renderField("Complemento", "complemento", fichaDetail.complemento)}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {renderField("Bairro", "bairro", fichaDetail.bairro)}
                            {renderField("Cidade", "cidade", fichaDetail.cidade)}
                            {renderField("Estado", "estado", fichaDetail.estado)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-border" />

                  {/* Síndico */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-600" />
                      Síndico
                    </h3>
                    <div className="bg-muted/50 p-3 rounded-lg border border-border">
                      <div className="grid grid-cols-2 gap-3">
                        {renderField("Nome do Síndico", "nomeSindico", fichaDetail.nomeSindico)}
                        {renderField("Telefone do Síndico", "telefoneSindico", fichaDetail.telefoneSindico, "phone")}
                        {renderField("Email do Síndico", "emailSindico", fichaDetail.emailSindico, "text", "email@exemplo.com")}
                        {renderField("Aniversário do Síndico", "dataAniversarioSindico", toDateInputValue(fichaDetail.dataAniversarioSindico), "date")}
                        {renderField("Início do Mandato", "dataInicioMandato", toDateInputValue(fichaDetail.dataInicioMandato), "date")}
                        {renderField("Fim do Mandato", "dataFimMandato", toDateInputValue(fichaDetail.dataFimMandato), "date")}
                      </div>
                    </div>
                  </div>

                  {/* Porteiro */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-blue-600" />
                      Porteiro
                    </h3>
                    <div className="bg-muted/50 p-3 rounded-lg border border-border">
                      <div className="grid grid-cols-2 gap-3">
                        {renderField("Nome do Porteiro", "nomePorteiro", fichaDetail.nomePorteiro)}
                        {renderField("Telefone do Porteiro", "telefonePorteiro", fichaDetail.telefonePorteiro, "phone")}
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-border" />

                  {/* Observações */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      Observações
                    </h3>
                    <div className="bg-muted/50 p-3 rounded-lg border border-border">
                      {renderField("Observações", "observacao", fichaDetail.observacao, "textarea")}
                    </div>
                  </div>

                  <Separator className="bg-border" />

                  {/* Administradora e Gerentes */}
                  <AdministradoraGerentesManager
                    fichaId={fichaDetail.id}
                    administradoraAtual={fichaDetail.administradora ? { id: Number(fichaDetail.administradora.id), nome: fichaDetail.administradora.nome } : null}
                    onSave={() => loadFichaDetail().catch(console.error)}
                  />
                </TabsContent>

                <TabsContent value="historico" className="mt-4">
                  <div className="bg-muted/50 p-4 rounded-lg border border-border space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock3 className="h-4 w-4 text-blue-600" />
                      <span>
                        Criada em {new Date(fichaDetail.createdAt).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <Separator className="bg-border" />
                    <div className="space-y-3">
                      {fichaDetail.logs && fichaDetail.logs.length > 0 ? (
                        fichaDetail.logs.map((log) => (
                          <div key={log.id} className="flex items-start gap-3 p-3 rounded-md border border-border bg-background">

                            <div className="flex-1 space-y-1">
                              <p className="text-sm font-semibold text-foreground">
                                {log.tipo === "ENVIADO" ? "Enviado para vendas" : log.tipo === "RETORNADO" ? "Retornado" : log.tipo}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {log.user?.name ?? "Usuário desconhecido"} • {new Date(log.createdAt).toLocaleString("pt-BR")}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhum histórico registrado.</p>
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* Aba de registros — só usada no mobile. No desktop é o painel lateral. */}
                <TabsContent value="registros" className="mt-1 flex-1 overflow-y-auto flex flex-col min-h-[400px] sm:hidden">
                  {loadingRegistros ? (
                    <div className="flex items-center justify-center flex-1 text-muted-foreground py-8">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span className="text-[12px]">Carregando...</span>
                    </div>
                  ) : registrosError ? (
                    <div className="text-center py-4 text-destructive text-[12px]">
                      <p>{registrosError}</p>
                      <Button variant="outline" size="sm" className="mt-2 h-7 text-[11px]" onClick={() => loadRegistros()}>
                        Tentar novamente
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div ref={registrosLateralRef} className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0 flex flex-col">
                        {registros.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground flex-1 flex flex-col items-center justify-center">
                            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                            <p className="text-[11px]">Nenhum registro</p>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1" />
                            {registros.map((registro) => (
                              <div key={registro.id} className="bg-muted/40 border border-border/60 rounded-md p-2">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] font-semibold text-foreground truncate max-w-[120px]">
                                    {registro.userName}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground">
                                    {new Date(registro.createdAt).toLocaleString("pt-BR", {
                                      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                                <p className="text-[11px] text-foreground whitespace-pre-wrap break-words">
                                  {registro.mensagem}
                                </p>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                      <div className="flex-shrink-0 pt-2 border-t border-border mt-2">
                        <div className="flex gap-2 items-end">
                          <Textarea
                            placeholder="Novo registro..."
                            value={newRegistroText}
                            onChange={(e) => setNewRegistroText(e.target.value)}
                            className="flex-1 min-h-[50px] max-h-[80px] text-[12px] resize-y"
                          />
                          <Button
                            onClick={createRegistro}
                            disabled={!newRegistroText.trim() || creatingRegistro}
                            className="h-9 w-9 rounded-full p-0 bg-blue-600 hover:bg-blue-700 flex-shrink-0"
                          >
                            {creatingRegistro ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>

              <div className="flex justify-between items-center gap-2 pt-4 border-t border-border/60">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border bg-transparent text-base">
                  Fechar
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white text-base px-6"
                  onClick={handleSave}
                  disabled={!hasChanges() || saving}
                >
                  {saving ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </div>

            {/* Lateral Registros Panel - Apenas no desktop (md+) */}
            <div className="hidden md:flex w-[300px] flex-shrink-0 border-l border-border pl-4 flex-col h-full overflow-hidden">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                <MessageSquare className="h-4 w-4 text-blue-600" />
                <h3 className="text-[13px] font-semibold text-foreground">Registros</h3>
              </div>

              {loadingRegistros ? (
                <div className="flex items-center justify-center flex-1 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-[12px]">Carregando...</span>
                </div>
              ) : registrosError ? (
                <div className="text-center py-4 text-destructive text-[12px] flex-1">
                  <p>{registrosError}</p>
                  <Button variant="outline" size="sm" className="mt-2 h-7 text-[11px]" onClick={() => loadRegistros()}>
                    Tentar novamente
                  </Button>
                </div>
              ) : (
                <>
                  {/* Lista de registros - scrollable */}
                  <div
                    ref={registrosLateralRef}
                    className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0 flex flex-col"
                  >
                    {registros.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground flex-1 flex flex-col items-center justify-center">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p className="text-[11px]">Nenhum registro</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1" />
                        {registros.map((registro) => (
                          <div
                            key={registro.id}
                            className="bg-muted/40 border border-border/60 rounded-md p-2"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-semibold text-foreground truncate max-w-[100px]">
                                {registro.userName}
                              </span>
                              <span className="text-[9px] text-muted-foreground">
                                {new Date(registro.createdAt).toLocaleString("pt-BR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <p className="text-[11px] text-foreground whitespace-pre-wrap break-words">
                              {registro.mensagem}
                            </p>
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  {/* Input para novo registro - fixed at bottom */}
                  <div className="flex-shrink-0 pt-2 border-t border-border mt-2">
                    <div className="flex gap-2 items-end">
                      <Textarea
                        placeholder="Novo registro..."
                        value={newRegistroText}
                        onChange={(e) => setNewRegistroText(e.target.value)}
                        className="flex-1 min-h-[50px] max-h-[80px] text-[12px] resize-y"
                      />
                      <Button
                        onClick={createRegistro}
                        disabled={!newRegistroText.trim() || creatingRegistro}
                        className="h-9 w-9 rounded-full p-0 bg-blue-600 hover:bg-blue-700 flex-shrink-0"
                      >
                        {creatingRegistro ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>

      {/* Dialog de confirmação para enviar para vendas */}
      <Dialog open={confirmEnviarOpen} onOpenChange={setConfirmEnviarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">
              Confirmar envio para vendas
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Ao confirmar, esta ficha será convertida em um cliente e ficará disponível para o time de vendas.
              {fichaDetail?.razaoSocial && (
                <span className="block mt-2 font-semibold text-foreground">
                  {fichaDetail.razaoSocial}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfirmEnviarOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleEnviarParaVendas}
              disabled={enviandoVendas}
            >
              {enviandoVendas ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </span>
              ) : (
                "Confirmar"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
