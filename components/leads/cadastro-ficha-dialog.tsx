"use client"

import { useCallback, useEffect, useState } from "react"
import { maskCNPJ, maskCEP, maskPhone, unmask, validateCNPJ, validateCEP } from "@/lib/formatters"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Building2, Loader2, Plus, Check } from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

type FormState = {
  cnpj: string
  razaoSocial: string
  ultimaManutencao: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  telefoneCondominio: string
  celularCondominio: string
  sindicoNome: string
  sindicoTelefone: string
  sindicoEmail: string
  sindicoAniversario: string
  dataInicioMandato: string
  dataFimMandato: string
  porteiroNome: string
  porteiroTelefone: string
  administradoraId: string
  qtdSPDA: string
  observacao: string
  dataContatoAgendado: string
}

const initialFormState: FormState = {
  cnpj: "",
  razaoSocial: "",
  ultimaManutencao: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  telefoneCondominio: "",
  celularCondominio: "",
  sindicoNome: "",
  sindicoTelefone: "",
  sindicoEmail: "",
  sindicoAniversario: "",
  dataInicioMandato: "",
  dataFimMandato: "",
  porteiroNome: "",
  porteiroTelefone: "",
  administradoraId: "",
  qtdSPDA: "",
  observacao: "",
  dataContatoAgendado: "",
}

const estadosBrasil = [
  { value: "AC", label: "AC" }, { value: "AL", label: "AL" }, { value: "AP", label: "AP" },
  { value: "AM", label: "AM" }, { value: "BA", label: "BA" }, { value: "CE", label: "CE" },
  { value: "DF", label: "DF" }, { value: "ES", label: "ES" }, { value: "GO", label: "GO" },
  { value: "MA", label: "MA" }, { value: "MT", label: "MT" }, { value: "MS", label: "MS" },
  { value: "MG", label: "MG" }, { value: "PA", label: "PA" }, { value: "PB", label: "PB" },
  { value: "PR", label: "PR" }, { value: "PE", label: "PE" }, { value: "PI", label: "PI" },
  { value: "RJ", label: "RJ" }, { value: "RN", label: "RN" }, { value: "RS", label: "RS" },
  { value: "RO", label: "RO" }, { value: "RR", label: "RR" }, { value: "SC", label: "SC" },
  { value: "SP", label: "SP" }, { value: "SE", label: "SE" }, { value: "TO", label: "TO" },
]

const formatCnpjForApi = (cnpjDigits: string) => {
  if (cnpjDigits.length !== 14) return null
  return `${cnpjDigits.slice(0, 2)}.${cnpjDigits.slice(2, 5)}.${cnpjDigits.slice(5, 8)}/${cnpjDigits.slice(8)}`
}

type Administradora = { id: number; nome: string }

interface CadastroFichaDialogProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function CadastroFichaDialog({ open, onClose, onSuccess }: CadastroFichaDialogProps) {
  const { toast } = useToast()
  const [openAdmCombobox, setOpenAdmCombobox] = useState(false)
  const [formData, setFormData] = useState<FormState>(initialFormState)
  const [submitting, setSubmitting] = useState(false)
  const [cnpjLookupStatus, setCnpjLookupStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [administradoras, setAdministradoras] = useState<Administradora[]>([])
  const [loadingAdministradoras, setLoadingAdministradoras] = useState(false)
  const [cnpjLookupMessage, setCnpjLookupMessage] = useState<string | null>(null)
  const [lastFetchedCnpj, setLastFetchedCnpj] = useState("")
  const [cnpjDuplicado, setCnpjDuplicado] = useState(false)
  const [cnpjDuplicadoMsg, setCnpjDuplicadoMsg] = useState<string | null>(null)
  const [criarAdmDialogOpen, setCriarAdmDialogOpen] = useState(false)
  const [novaAdmNome, setNovaAdmNome] = useState("")
  const [criandoAdm, setCriandoAdm] = useState(false)

  const resetForm = useCallback(() => {
    setFormData(initialFormState)
    setCnpjLookupStatus("idle")
    setCnpjLookupMessage(null)
    setLastFetchedCnpj("")
    setCnpjDuplicado(false)
    setCnpjDuplicadoMsg(null)
  }, [])

  useEffect(() => {
    if (!open) resetForm()
  }, [open, resetForm])

  useEffect(() => {
    if (open && administradoras.length === 0) {
      setLoadingAdministradoras(true)
      fetch("/api/administradoras")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data?.data)) setAdministradoras(data.data)
        })
        .catch((err) => console.error("Erro ao carregar administradoras:", err))
        .finally(() => setLoadingAdministradoras(false))
    }
  }, [open, administradoras.length])

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
        body: JSON.stringify({ nome: novaAdmNome.trim() }),
      })
      if (!res.ok) throw new Error("Erro ao criar administradora")
      const data = await res.json()
      const novaAdm = data.data as Administradora
      setAdministradoras((prev) => [...prev, novaAdm])
      setFormData({ ...formData, administradoraId: String(novaAdm.id) })
      setCriarAdmDialogOpen(false)
      setNovaAdmNome("")
      toast({ title: "Administradora criada com sucesso" })
    } catch (error) {
      console.error("Erro ao criar administradora:", error)
      toast({ variant: "destructive", title: "Erro ao criar administradora" })
    } finally {
      setCriandoAdm(false)
    }
  }

  const applyCnpjData = useCallback((data: any) => {
    setFormData((prev) => {
      const firstPhone = Array.isArray(data?.telefones)
        ? data.telefones.find((tel: any) => !tel?.is_fax)
        : null
      const uf = typeof data?.uf === "string" ? data.uf.trim().toUpperCase() : undefined
      return {
        ...prev,
        razaoSocial: data?.razao_social ?? prev.razaoSocial,
        logradouro: data?.logradouro ?? prev.logradouro,
        numero: data?.numero ?? prev.numero,
        complemento: data?.complemento ?? prev.complemento,
        bairro: data?.bairro ?? prev.bairro,
        cidade: data?.municipio ?? prev.cidade,
        estado: uf ?? prev.estado,
        cep: data?.cep ? data.cep.replace(/\D/g, "") : prev.cep,
        telefoneCondominio: firstPhone
          ? `${firstPhone.ddd ?? ""}${firstPhone.numero ?? ""}`.replace(/\D/g, "")
          : prev.telefoneCondominio,
        sindicoEmail: data?.email ?? prev.sindicoEmail,
      }
    })
  }, [])

  const fetchCnpjData = useCallback(
    async (cnpjDigits: string) => {
      if (cnpjDigits.length !== 14) return
      if (cnpjDigits === lastFetchedCnpj && cnpjLookupStatus === "success") return
      const formatted = formatCnpjForApi(cnpjDigits)
      if (!formatted) return

      setCnpjLookupStatus("loading")
      setCnpjLookupMessage("Verificando CNPJ...")
      setCnpjDuplicado(false)
      setCnpjDuplicadoMsg(null)

      try {
        const verificaResponse = await fetch(`/api/cnpj/verificar?cnpj=${cnpjDigits}`)
        if (verificaResponse.ok) {
          const verificaData = await verificaResponse.json()
          if (verificaData.existe) {
            setCnpjDuplicado(true)
            setCnpjDuplicadoMsg(verificaData.mensagem)
            setCnpjLookupStatus("error")
            setCnpjLookupMessage(null)
            toast({ title: "CNPJ já cadastrado", description: verificaData.mensagem, variant: "destructive" })
            return
          }
        }
        setCnpjLookupMessage("Buscando dados...")
        const response = await fetch(`https://api.opencnpj.org/${formatted}`)
        if (!response.ok) throw new Error(`CNPJ não localizado (${response.status})`)
        const data = await response.json()
        applyCnpjData(data)
        setCnpjLookupStatus("success")
        setCnpjLookupMessage("Dados preenchidos.")
        setLastFetchedCnpj(cnpjDigits)
      } catch (error) {
        console.error("Erro ao buscar dados do CNPJ:", error)
        setCnpjLookupStatus("error")
        setCnpjLookupMessage("Não foi possível obter dados.")
        setLastFetchedCnpj("")
      }
    },
    [applyCnpjData, cnpjLookupStatus, lastFetchedCnpj, toast],
  )

  const handleSubmit = useCallback(async () => {
    if (submitting) return
    if (!validateCNPJ(formData.cnpj)) {
      toast({ title: "CNPJ inválido", description: "Informe um CNPJ válido.", variant: "destructive" })
      return
    }

    const payload = {
      cnpj: formData.cnpj,
      razaoSocial: formData.razaoSocial || null,
      ultimaManutencao: formData.ultimaManutencao || null,
      cep: formData.cep || null,
      logradouro: formData.logradouro || null,
      numero: formData.numero || null,
      complemento: formData.complemento || null,
      bairro: formData.bairro || null,
      cidade: formData.cidade || null,
      estado: formData.estado || null,
      telefoneCondominio: formData.telefoneCondominio || null,
      celularCondominio: formData.celularCondominio || null,
      nomeSindico: formData.sindicoNome || null,
      telefoneSindico: formData.sindicoTelefone || null,
      emailSindico: formData.sindicoEmail || null,
      dataAniversarioSindico: formData.sindicoAniversario || null,
      dataInicioMandato: formData.dataInicioMandato || null,
      dataFimMandato: formData.dataFimMandato || null,
      nomePorteiro: formData.porteiroNome || null,
      telefonePorteiro: formData.porteiroTelefone || null,
      administradoraId: formData.administradoraId || null,
      quantidadeSPDA: formData.qtdSPDA ? parseInt(formData.qtdSPDA, 10) : null,
      observacao: formData.observacao || null,
      dataContatoAgendado: formData.dataContatoAgendado || null,
    }

    try {
      setSubmitting(true)
      const response = await fetch("/api/fichas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        throw new Error(errorBody?.error ?? "Erro ao criar ficha")
      }
      toast({ title: "Ficha criada com sucesso" })
      onSuccess?.()
      onClose()
      resetForm()
    } catch (error) {
      toast({ title: "Erro ao criar ficha", description: error instanceof Error ? error.message : "Erro desconhecido", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }, [formData, onClose, onSuccess, resetForm, submitting, toast])

  // Componente de campo enxuto
  const Field = ({
    label,
    value,
    onChange,
    type = "text",
    placeholder,
    colSpan,
    error,
    suffix,
  }: {
    label: string
    value: string
    onChange: (value: string) => void
    type?: "text" | "date" | "datetime-local" | "number" | "email"
    placeholder?: string
    colSpan?: number
    error?: string
    suffix?: React.ReactNode
  }) => (
    <div className={colSpan ? `col-span-${colSpan}` : ""} style={colSpan ? { gridColumn: `span ${colSpan}` } : {}}>
      <label className="text-[11px] font-semibold text-muted-foreground mb-0.5 block">{label}</label>
      <div className="flex gap-1">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "flex-1 min-w-0 rounded-md border bg-transparent px-2 py-1.5 text-[13px] shadow-xs transition-[color,box-shadow] outline-none",
            "border-input focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "placeholder:text-muted-foreground bg-background"
          )}
        />
        {suffix}
      </div>
      {error && <p className="text-[10px] text-red-500 mt-0.5">{error}</p>}
    </div>
  )

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto py-4 px-5">
          <DialogHeader className="pb-2 border-b border-border mb-3">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-blue-600" />
              Nova Ficha
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Dados Básicos */}
            <section>
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Dados do Condomínio</h3>
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-muted-foreground mb-0.5 block">CNPJ *</label>
                  <input
                    type="text"
                    value={maskCNPJ(formData.cnpj)}
                    onChange={(e) => {
                      const rawValue = unmask(e.target.value)
                      setFormData({ ...formData, cnpj: rawValue })
                      if (rawValue.length < 14) {
                        setCnpjLookupStatus("idle")
                        setCnpjLookupMessage(null)
                        setLastFetchedCnpj("")
                        return
                      }
                      if (validateCNPJ(rawValue)) void fetchCnpjData(rawValue)
                    }}
                    placeholder="00.000.000/0000-00"
                    className={cn(
                      "w-full rounded-md border bg-transparent px-2 py-1.5 text-[13px] shadow-xs outline-none",
                      "border-input focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] bg-background"
                    )}
                  />
                  {cnpjLookupStatus === "loading" && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> {cnpjLookupMessage}
                    </p>
                  )}
                  {cnpjLookupStatus === "success" && <p className="text-[10px] text-green-600 mt-0.5">{cnpjLookupMessage}</p>}
                  {cnpjDuplicado && <p className="text-[10px] text-red-500 mt-0.5 font-semibold">{cnpjDuplicadoMsg}</p>}
                  {formData.cnpj && !validateCNPJ(formData.cnpj) && <p className="text-[10px] text-red-500 mt-0.5">CNPJ inválido</p>}
                </div>
                <Field label="Razão Social" value={formData.razaoSocial} onChange={(v) => setFormData({ ...formData, razaoSocial: v })} colSpan={2} />
                <Field label="Últ. Manutenção" value={formData.ultimaManutencao} onChange={(v) => setFormData({ ...formData, ultimaManutencao: v })} type="date" />
                <Field label="Qtd SPDA" value={formData.qtdSPDA} onChange={(v) => setFormData({ ...formData, qtdSPDA: v })} type="number" placeholder="0" />
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground mb-0.5 block">Telefone</label>
                  <input
                    type="text"
                    value={maskPhone(formData.telefoneCondominio)}
                    onChange={(e) => setFormData({ ...formData, telefoneCondominio: unmask(e.target.value) })}
                    placeholder="(00) 0000-0000"
                    className="w-full rounded-md border bg-transparent px-2 py-1.5 text-[13px] shadow-xs outline-none border-input focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] bg-background"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground mb-0.5 block">Celular</label>
                  <input
                    type="text"
                    value={maskPhone(formData.celularCondominio)}
                    onChange={(e) => setFormData({ ...formData, celularCondominio: unmask(e.target.value) })}
                    placeholder="(00) 00000-0000"
                    className="w-full rounded-md border bg-transparent px-2 py-1.5 text-[13px] shadow-xs outline-none border-input focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] bg-background"
                  />
                </div>
              </div>
            </section>

            {/* Endereço */}
            <section>
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Endereço</h3>
              <div className="grid grid-cols-6 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground mb-0.5 block">CEP</label>
                  <input
                    type="text"
                    value={maskCEP(formData.cep)}
                    onChange={(e) => setFormData({ ...formData, cep: unmask(e.target.value) })}
                    placeholder="00000-000"
                    className="w-full rounded-md border bg-transparent px-2 py-1.5 text-[13px] shadow-xs outline-none border-input focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] bg-background"
                  />
                </div>
                <Field label="Logradouro" value={formData.logradouro} onChange={(v) => setFormData({ ...formData, logradouro: v })} colSpan={3} />
                <Field label="Nº" value={formData.numero} onChange={(v) => setFormData({ ...formData, numero: v })} />
                <Field label="Compl." value={formData.complemento} onChange={(v) => setFormData({ ...formData, complemento: v })} />
                <Field label="Bairro" value={formData.bairro} onChange={(v) => setFormData({ ...formData, bairro: v })} colSpan={2} />
                <Field label="Cidade" value={formData.cidade} onChange={(v) => setFormData({ ...formData, cidade: v })} colSpan={2} />
                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-muted-foreground mb-0.5 block">UF</label>
                  <Select value={formData.estado} onValueChange={(v) => setFormData({ ...formData, estado: v })}>
                    <SelectTrigger className="h-8 text-[13px]">
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {estadosBrasil.map((e) => (
                        <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Síndico */}
            <section>
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Síndico</h3>
              <div className="grid grid-cols-4 gap-2">
                <Field label="Nome" value={formData.sindicoNome} onChange={(v) => setFormData({ ...formData, sindicoNome: v })} colSpan={2} />
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground mb-0.5 block">Telefone</label>
                  <input
                    type="text"
                    value={maskPhone(formData.sindicoTelefone)}
                    onChange={(e) => setFormData({ ...formData, sindicoTelefone: unmask(e.target.value) })}
                    placeholder="(00) 00000-0000"
                    className="w-full rounded-md border bg-transparent px-2 py-1.5 text-[13px] shadow-xs outline-none border-input focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] bg-background"
                  />
                </div>
                <Field label="Email" value={formData.sindicoEmail} onChange={(v) => setFormData({ ...formData, sindicoEmail: v })} type="email" />
                <Field label="Aniversário" value={formData.sindicoAniversario} onChange={(v) => setFormData({ ...formData, sindicoAniversario: v })} type="date" />
                <Field label="Início Mandato" value={formData.dataInicioMandato} onChange={(v) => setFormData({ ...formData, dataInicioMandato: v })} type="date" />
                <Field label="Fim Mandato" value={formData.dataFimMandato} onChange={(v) => setFormData({ ...formData, dataFimMandato: v })} type="date" />
              </div>
            </section>

            {/* Porteiro */}
            <section>
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Porteiro</h3>
              <div className="grid grid-cols-4 gap-2">
                <Field label="Nome" value={formData.porteiroNome} onChange={(v) => setFormData({ ...formData, porteiroNome: v })} colSpan={2} />
                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-muted-foreground mb-0.5 block">Telefone</label>
                  <input
                    type="text"
                    value={maskPhone(formData.porteiroTelefone)}
                    onChange={(e) => setFormData({ ...formData, porteiroTelefone: unmask(e.target.value) })}
                    placeholder="(00) 00000-0000"
                    className="w-full rounded-md border bg-transparent px-2 py-1.5 text-[13px] shadow-xs outline-none border-input focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] bg-background"
                  />
                </div>
              </div>
            </section>

            {/* Administradora e Agendamento */}
            <section>
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Administradora & Agendamento</h3>
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-muted-foreground mb-0.5 block">Administradora</label>
                  <div className="flex gap-1">
                    <Popover open={openAdmCombobox} onOpenChange={setOpenAdmCombobox}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 justify-between text-[13px] h-8 font-normal" disabled={loadingAdministradoras}>
                          {loadingAdministradoras ? "Carregando..." : formData.administradoraId ? administradoras.find((a) => String(a.id) === formData.administradoraId)?.nome : "Selecionar..."}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-0">
                        <Command>
                          <CommandInput placeholder="Buscar..." />
                          <CommandList>
                            <CommandEmpty>Nenhuma encontrada.</CommandEmpty>
                            <CommandGroup>
                              {administradoras.map((adm) => (
                                <CommandItem key={adm.id} value={adm.nome} onSelect={() => { setFormData({ ...formData, administradoraId: String(adm.id) }); setOpenAdmCombobox(false) }}>
                                  <Check className={cn("mr-2 h-3 w-3", formData.administradoraId === String(adm.id) ? "opacity-100" : "opacity-0")} />
                                  {adm.nome}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCriarAdmDialogOpen(true)} title="Criar nova"><Plus className="h-3 w-3" /></Button>
                  </div>
                </div>
                <Field label="Contato Agendado" value={formData.dataContatoAgendado} onChange={(v) => setFormData({ ...formData, dataContatoAgendado: v })} type="datetime-local" colSpan={2} />
              </div>
            </section>

            {/* Observações */}
            <section>
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Observações</h3>
              <Textarea
                value={formData.observacao}
                onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                placeholder="Informações adicionais..."
                className="min-h-16 text-[13px]"
              />
            </section>
          </div>

          <DialogFooter className="mt-4 pt-3 border-t border-border">
            <Button variant="outline" onClick={onClose} size="sm">Cancelar</Button>
            <Button onClick={handleSubmit} disabled={cnpjDuplicado || !validateCNPJ(formData.cnpj) || submitting} size="sm">
              {submitting ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Salvando...</> : "Criar Ficha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Criar Administradora */}
      <Dialog open={criarAdmDialogOpen} onOpenChange={setCriarAdmDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Nova Administradora</DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <Label htmlFor="novaAdmNome" className="text-[11px]">Nome *</Label>
            <Input id="novaAdmNome" value={novaAdmNome} onChange={(e) => setNovaAdmNome(e.target.value)} placeholder="Nome da administradora" className="mt-1 text-[13px]" />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCriarAdmDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={criarAdministradora} disabled={criandoAdm}>
              {criandoAdm ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Criando...</> : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
