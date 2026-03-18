"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { maskCNPJ, maskCEP, maskPhone, unmask, validateCNPJ, validateCEP } from "@/lib/formatters"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Building2, User, MapPin, Building, UserCircle, Loader2, Plus } from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check } from "lucide-react"

type Administradora = {
  id: number
  nome: string
}
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

type CategoriaValue = "explorado" | "ativo" | "agendado"

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
  sindicoNome: string
  sindicoTelefone: string
  sindicoWhatsapp: string
  sindicoEmail: string
  sindicoAniversario: string
  dataFimMandato: string
  porteiroNome: string
  porteiroTelefone: string
  administradoraId: string
  administradoraNome: string
  qtdSPDA: string
  categoria: CategoriaValue
  observacoes: string
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
  sindicoNome: "",
  sindicoTelefone: "",
  sindicoWhatsapp: "",
  sindicoEmail: "",
  sindicoAniversario: "",
  dataFimMandato: "",
  porteiroNome: "",
  porteiroTelefone: "",
  administradoraId: "",
  administradoraNome: "",
  qtdSPDA: "",
  categoria: "explorado",
  observacoes: "",
}

const estadosBrasil = [
  { value: "AC", label: "Acre (AC)" },
  { value: "AL", label: "Alagoas (AL)" },
  { value: "AP", label: "Amapá (AP)" },
  { value: "AM", label: "Amazonas (AM)" },
  { value: "BA", label: "Bahia (BA)" },
  { value: "CE", label: "Ceará (CE)" },
  { value: "DF", label: "Distrito Federal (DF)" },
  { value: "ES", label: "Espírito Santo (ES)" },
  { value: "GO", label: "Goiás (GO)" },
  { value: "MA", label: "Maranhão (MA)" },
  { value: "MT", label: "Mato Grosso (MT)" },
  { value: "MS", label: "Mato Grosso do Sul (MS)" },
  { value: "MG", label: "Minas Gerais (MG)" },
  { value: "PA", label: "Pará (PA)" },
  { value: "PB", label: "Paraíba (PB)" },
  { value: "PR", label: "Paraná (PR)" },
  { value: "PE", label: "Pernambuco (PE)" },
  { value: "PI", label: "Piauí (PI)" },
  { value: "RJ", label: "Rio de Janeiro (RJ)" },
  { value: "RN", label: "Rio Grande do Norte (RN)" },
  { value: "RS", label: "Rio Grande do Sul (RS)" },
  { value: "RO", label: "Rondônia (RO)" },
  { value: "RR", label: "Roraima (RR)" },
  { value: "SC", label: "Santa Catarina (SC)" },
  { value: "SP", label: "São Paulo (SP)" },
  { value: "SE", label: "Sergipe (SE)" },
  { value: "TO", label: "Tocantins (TO)" },
]

const formatCnpjForApi = (cnpjDigits: string) => {
  if (cnpjDigits.length !== 14) return null
  return `${cnpjDigits.slice(0, 2)}.${cnpjDigits.slice(2, 5)}.${cnpjDigits.slice(5, 8)}/${cnpjDigits.slice(8)}`
}

interface CadastroClienteDialogProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function CadastroClienteDialog({ open, onClose, onSuccess }: CadastroClienteDialogProps) {
  const { toast } = useToast()
  const [step, setStep] = useState(1)
  const [openAdmCombobox, setOpenAdmCombobox] = useState(false)
  const [formData, setFormData] = useState<FormState>(initialFormState)
  const [submitting, setSubmitting] = useState(false)
  const [cnpjLookupStatus, setCnpjLookupStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [cnpjLookupMessage, setCnpjLookupMessage] = useState<string | null>(null)
  const [lastFetchedCnpj, setLastFetchedCnpj] = useState("")
  const [cnpjDuplicate, setCnpjDuplicate] = useState(false)
  const cnpjCheckRef = useRef(0)
  
  // Estado para administradoras
  const [administradoras, setAdministradoras] = useState<Administradora[]>([])
  const [loadingAdministradoras, setLoadingAdministradoras] = useState(false)
  const [criarAdmDialogOpen, setCriarAdmDialogOpen] = useState(false)
  const [novaAdmNome, setNovaAdmNome] = useState("")
  const [criandoAdm, setCriandoAdm] = useState(false)

  const resetForm = useCallback(() => {
    setFormData(initialFormState)
    setStep(1)
    setCnpjLookupStatus("idle")
    setCnpjLookupMessage(null)
    setLastFetchedCnpj("")
  }, [])

  useEffect(() => {
    if (!open) {
      resetForm()
    }
  }, [open, resetForm])

  // Carrega administradoras do banco de dados
  useEffect(() => {
    if (open && administradoras.length === 0) {
      setLoadingAdministradoras(true)
      fetch("/api/administradoras")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data?.data)) {
            setAdministradoras(data.data)
          }
        })
        .catch((err) => console.error("Erro ao carregar administradoras:", err))
        .finally(() => setLoadingAdministradoras(false))
    }
  }, [open, administradoras.length])

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
        body: JSON.stringify({ nome: novaAdmNome.trim() }),
      })
      
      if (!res.ok) throw new Error("Erro ao criar administradora")
      
      const data = await res.json()
      const novaAdm = data.data as Administradora
      
      setAdministradoras((prev) => [...prev, novaAdm])
      setFormData({ ...formData, administradoraId: String(novaAdm.id), administradoraNome: novaAdm.nome })
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
      setCnpjLookupMessage("Buscando dados do CNPJ...")

      try {
        const response = await fetch(`https://api.opencnpj.org/${formatted}`)
        if (!response.ok) {
          throw new Error(`CNPJ não localizado (${response.status})`)
        }
        const data = await response.json()
        applyCnpjData(data)
        setCnpjLookupStatus("success")
        setCnpjLookupMessage("Dados preenchidos automaticamente.")
        setLastFetchedCnpj(cnpjDigits)
      } catch (error) {
        console.error("Erro ao buscar dados do CNPJ:", error)
        setCnpjLookupStatus("error")
        setCnpjLookupMessage("Não foi possível obter dados para este CNPJ.")
        setLastFetchedCnpj("")
      }
    },
    [applyCnpjData, cnpjLookupStatus, lastFetchedCnpj],
  )

  const checkCnpjDuplicate = useCallback(async (cnpjDigits: string) => {
    if (cnpjDigits.length !== 14) return false
    const requestId = cnpjCheckRef.current + 1
    cnpjCheckRef.current = requestId
    try {
      const params = new URLSearchParams()
      params.set("cnpj", cnpjDigits)
      params.set("limit", "1")
      const res = await fetch(`/api/clients?${params.toString()}`)
      const body = await res.json().catch(() => ({}))
      if (cnpjCheckRef.current !== requestId) return false
      const alreadyExists = Array.isArray(body.data) && body.data.length > 0
      setCnpjDuplicate(alreadyExists)
      if (alreadyExists) {
        setCnpjLookupMessage("CNPJ já cadastrado.")
        setCnpjLookupStatus("error")
      } else {
        setCnpjLookupStatus((prev) => (prev === "error" ? "idle" : prev))
        if (cnpjLookupMessage === "CNPJ já cadastrado.") {
          setCnpjLookupMessage(null)
        }
      }
      return alreadyExists
    } catch (error) {
      console.error("Erro ao verificar CNPJ:", error)
      return false
    }
  }, [cnpjLookupMessage])

  const handleSubmit = useCallback(async () => {
    if (submitting) return

    if (!validateCNPJ(formData.cnpj)) {
      toast({
        title: "CNPJ inválido",
        description: "Informe um CNPJ válido para continuar.",
        variant: "destructive",
      })
      setStep(1)
      return
    }

    if (cnpjDuplicate) {
      toast({
        title: "CNPJ já cadastrado",
        description: "Este CNPJ já existe na base. Não é possível criar um novo lead.",
        variant: "destructive",
      })
      setStep(1)
      return
    }

    if (!formData.razaoSocial) {
      toast({
        title: "Razão social obrigatória",
        description: "Preencha a razão social do condomínio.",
        variant: "destructive",
      })
      setStep(1)
      return
    }

    const payload = {
      cnpj: formData.cnpj,
      razaoSocial: formData.razaoSocial,
      ultimaManutencao: formData.ultimaManutencao || null,
      cep: formData.cep,
      logradouro: formData.logradouro,
      numero: formData.numero,
      complemento: formData.complemento,
      bairro: formData.bairro,
      cidade: formData.cidade,
      estado: formData.estado,
      telefoneCondominio: formData.telefoneCondominio,
      nomeSindico: formData.sindicoNome,
      telefoneSindico: formData.sindicoTelefone,
      sindicoWhatsapp: formData.sindicoWhatsapp,
      emailSindico: formData.sindicoEmail,
      sindicoAniversario: formData.sindicoAniversario,
      dataFimMandato: formData.dataFimMandato,
      porteiroNome: formData.porteiroNome,
      porteiroTelefone: formData.porteiroTelefone,
      administradoraId: formData.administradoraId,
      qtdSPDA: formData.qtdSPDA,
      observacoes: formData.observacoes,
      categoria: "explorado",
    }

    try {
      setSubmitting(true)
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        throw new Error(errorBody?.error ?? "Erro ao criar lead")
      }

      toast({
        title: "Lead criado com sucesso",
        description: "O cliente foi cadastrado como explorado.",
      })
      onSuccess?.()
      onClose()
      resetForm()
    } catch (error) {
      toast({
        title: "Erro ao criar lead",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }, [formData, onClose, onSuccess, resetForm, submitting, toast])

  const administradoraSelecionada = administradoras.find((adm) => String(adm.id) === formData.administradoraId)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Cadastrar Novo Cliente/Lead
          </DialogTitle>
          <DialogDescription>
            Preencha todos os dados do condomínio. CNPJ é obrigatório para evitar duplicidade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Indicador de Etapas */}
          <div className="flex items-center justify-center gap-2">
            <div className={`h-2 w-16 rounded-full ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
            <div className={`h-2 w-16 rounded-full ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
            <div className={`h-2 w-16 rounded-full ${step >= 3 ? "bg-primary" : "bg-muted"}`} />
            <div className={`h-2 w-16 rounded-full ${step >= 4 ? "bg-primary" : "bg-muted"}`} />
          </div>

          {/* Etapa 1: Dados Básicos do Condomínio */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Building2 className="h-5 w-5 text-primary" />
                Dados Básicos do Condomínio
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cnpj">CNPJ *</Label>
                  <Input
                    id="cnpj"
                    placeholder="00.000.000/0000-00"
                    value={maskCNPJ(formData.cnpj)}
                    onChange={(e) => {
                      const rawValue = unmask(e.target.value)
                      setFormData({ ...formData, cnpj: rawValue })
                      setCnpjDuplicate(false)

                      if (rawValue.length < 14) {
                        setCnpjLookupStatus("idle")
                        setCnpjLookupMessage(null)
                        setLastFetchedCnpj("")
                        return
                      }

                      if (validateCNPJ(rawValue)) {
                        void (async () => {
                          const duplicated = await checkCnpjDuplicate(rawValue)
                          if (!duplicated) {
                            await fetchCnpjData(rawValue)
                          }
                        })()
                      }
                    }}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Obrigatório para evitar duplicidade</p>
                  {cnpjLookupStatus === "loading" && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {cnpjLookupMessage ?? "Buscando dados..."}
                    </p>
                  )}
                  {cnpjLookupStatus === "success" && cnpjLookupMessage && (
                    <p className="text-xs text-green-600 mt-1">{cnpjLookupMessage}</p>
                  )}
                  {cnpjLookupStatus === "error" && cnpjLookupMessage && (
                    <p className="text-xs text-red-500 mt-1">{cnpjLookupMessage}</p>
                  )}
                  {formData.cnpj && !validateCNPJ(formData.cnpj) && (
                    <p className="text-xs text-red-500 mt-1">CNPJ inválido</p>
                  )}
                  {cnpjDuplicate && (
                    <p className="text-xs text-red-500 mt-1">CNPJ já cadastrado na base. Não é possível criar.</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="razaoSocial">Razão Social *</Label>
                  <Input
                    id="razaoSocial"
                    placeholder="Razão social do condomínio"
                    value={formData.razaoSocial}
                    onChange={(e) => setFormData({ ...formData, razaoSocial: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="ultimaManutencao">Última Manutenção</Label>
                  <Input
                    id="ultimaManutencao"
                    type="date"
                    value={formData.ultimaManutencao}
                    onChange={(e) => setFormData({ ...formData, ultimaManutencao: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="qtdSPDA">Quantidade de SPDA</Label>
                  <Input
                    id="qtdSPDA"
                    type="number"
                    placeholder="Ex: 2"
                    value={formData.qtdSPDA}
                    onChange={(e) => setFormData({ ...formData, qtdSPDA: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="telefoneCondominio">Telefone do Condomínio</Label>
                  <Input
                    id="telefoneCondominio"
                    placeholder="(00) 0000-0000"
                    value={maskPhone(formData.telefoneCondominio)}
                    onChange={(e) => {
                      const rawValue = unmask(e.target.value)
                      setFormData({ ...formData, telefoneCondominio: rawValue })
                    }}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Opcional</p>
                </div>
              </div>
            </div>
          )}

          {/* Etapa 2: Endereço */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <MapPin className="h-5 w-5 text-primary" />
                Endereço do Condomínio
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="cep">CEP *</Label>
                  <Input
                    id="cep"
                    placeholder="00000-000"
                    value={maskCEP(formData.cep)}
                    onChange={(e) => {
                      const rawValue = unmask(e.target.value)
                      setFormData({ ...formData, cep: rawValue })
                    }}
                    className="mt-1"
                  />
                  {formData.cep && !validateCEP(formData.cep) && (
                    <p className="text-xs text-red-500 mt-1">CEP inválido (deve ter 8 dígitos)</p>
                  )}
                </div>

                <div className="col-span-2">
                  <Label htmlFor="logradouro">Logradouro *</Label>
                  <Input
                    id="logradouro"
                    placeholder="Rua, Avenida, etc."
                    value={formData.logradouro}
                    onChange={(e) => setFormData({ ...formData, logradouro: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="numero">Número *</Label>
                  <Input
                    id="numero"
                    placeholder="123"
                    value={formData.numero}
                    onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="complemento">Complemento</Label>
                  <Input
                    id="complemento"
                    placeholder="Bloco, Apto, etc."
                    value={formData.complemento}
                    onChange={(e) => setFormData({ ...formData, complemento: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="bairro">Bairro *</Label>
                  <Input
                    id="bairro"
                    placeholder="Ex: Copacabana"
                    value={formData.bairro}
                    onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="cidade">Cidade *</Label>
                  <Input
                    id="cidade"
                    placeholder="Ex: Rio de Janeiro"
                    value={formData.cidade}
                    onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="estado">Estado (UF) *</Label>
                  <Select value={formData.estado} onValueChange={(v) => setFormData({ ...formData, estado: v })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione o estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {estadosBrasil.map((estado) => (
                        <SelectItem key={estado.value} value={estado.value}>
                          {estado.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Etapa 3: Síndico, Porteiro e Administradora */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Dados do Síndico */}
              <div>
                <div className="flex items-center gap-2 text-lg font-semibold mb-4">
                  <User className="h-5 w-5 text-primary" />
                  Dados do Síndico
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="sindicoNome">Nome do Síndico *</Label>
                    <Input
                      id="sindicoNome"
                      placeholder="Nome completo"
                      value={formData.sindicoNome}
                      onChange={(e) => setFormData({ ...formData, sindicoNome: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="sindicoTelefone">Telefone *</Label>
                    <Input
                      id="sindicoTelefone"
                      placeholder="(00) 00000-0000"
                      value={maskPhone(formData.sindicoTelefone)}
                      onChange={(e) => {
                        const rawValue = unmask(e.target.value)
                        setFormData({ ...formData, sindicoTelefone: rawValue })
                      }}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="sindicoWhatsapp">WhatsApp *</Label>
                    <Input
                      id="sindicoWhatsapp"
                      placeholder="(00) 00000-0000"
                      value={formData.sindicoWhatsapp}
                      onChange={(e) => setFormData({ ...formData, sindicoWhatsapp: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="sindicoEmail">Email *</Label>
                    <Input
                      id="sindicoEmail"
                      type="email"
                      placeholder="email@exemplo.com"
                      value={formData.sindicoEmail}
                      onChange={(e) => setFormData({ ...formData, sindicoEmail: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="sindicoAniversario">Aniversário do Síndico</Label>
                    <Input
                      id="sindicoAniversario"
                      type="date"
                      value={formData.sindicoAniversario}
                      onChange={(e) => setFormData({ ...formData, sindicoAniversario: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="dataFimMandato">Fim do Mandato</Label>
                    <Input
                      id="dataFimMandato"
                      type="date"
                      value={formData.dataFimMandato}
                      onChange={(e) => setFormData({ ...formData, dataFimMandato: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Dados do Porteiro */}
              <div>
                <div className="flex items-center gap-2 text-lg font-semibold mb-4">
                  <UserCircle className="h-5 w-5 text-primary" />
                  Dados do Porteiro
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="porteiroNome">Nome do Porteiro</Label>
                    <Input
                      id="porteiroNome"
                      placeholder="Nome completo"
                      value={formData.porteiroNome}
                      onChange={(e) => setFormData({ ...formData, porteiroNome: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="porteiroTelefone">Telefone do Porteiro</Label>
                    <Input
                      id="porteiroTelefone"
                      placeholder="(00) 00000-0000"
                      value={maskPhone(formData.porteiroTelefone)}
                      onChange={(e) => {
                        const rawValue = unmask(e.target.value)
                        setFormData({ ...formData, porteiroTelefone: rawValue })
                      }}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Administradora */}
              <div>
                <div className="flex items-center gap-2 text-lg font-semibold mb-4">
                  <Building className="h-5 w-5 text-primary" />
                  Administradora do Condomínio
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Administradora</Label>
                    <div className="flex gap-2 mt-1">
                      <Popover open={openAdmCombobox} onOpenChange={setOpenAdmCombobox}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openAdmCombobox}
                            className="flex-1 justify-between bg-transparent"
                            disabled={loadingAdministradoras}
                          >
                            {loadingAdministradoras
                              ? "Carregando..."
                              : formData.administradoraId
                                ? administradoras.find((adm) => String(adm.id) === formData.administradoraId)?.nome
                                : "Selecione ou digite para buscar..."}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                          <Command>
                            <CommandInput placeholder="Buscar administradora..." />
                            <CommandList>
                              <CommandEmpty>
                                {loadingAdministradoras ? "Carregando..." : "Nenhuma administradora encontrada."}
                              </CommandEmpty>
                              <CommandGroup>
                                {administradoras.map((adm) => (
                                  <CommandItem
                                    key={adm.id}
                                    value={adm.nome}
                                    onSelect={() => {
                                      setFormData({ ...formData, administradoraId: String(adm.id), administradoraNome: adm.nome })
                                      setOpenAdmCombobox(false)
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        formData.administradoraId === String(adm.id) ? "opacity-100" : "opacity-0",
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
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCriarAdmDialogOpen(true)}
                        title="Criar nova administradora"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Digite para buscar ou clique em + para criar nova.</p>
                  </div>

                  {administradoraSelecionada && (
                    <div className="p-4 bg-muted rounded-lg space-y-2">
                      <p className="text-sm font-semibold">Administradora selecionada:</p>
                      <p className="text-sm">{administradoraSelecionada.nome}</p>
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}

          {/* Etapa 4: Categoria e Responsável */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <MapPin className="h-5 w-5 text-primary" />
                Classificação do Lead
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="categoria">Categoria *</Label>
                  <Select
                    value={formData.categoria}
                    disabled
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="explorado">Livre sem Data</SelectItem>
                      <SelectItem value="ativo">Cliente Ativo</SelectItem>
                      <SelectItem value="agendado">Livre com Data</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Novos leads sempre iniciam como "Livre sem Data".
                  </p>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    placeholder="Informações adicionais sobre o lead..."
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    className="mt-1 min-h-[100px]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Botões de Navegação */}
          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={() => (step > 1 ? setStep(step - 1) : onClose())}>
              {step === 1 ? "Cancelar" : "Voltar"}
            </Button>
            <Button
              onClick={() => (step < 4 ? setStep(step + 1) : void handleSubmit())}
              disabled={step === 4 && submitting}
            >
              {step === 4 ? (
                submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cadastrando...
                  </span>
                ) : (
                  "Cadastrar Cliente"
                )
              ) : (
                "Próximo"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Dialog Criar Administradora */}
      <Dialog open={criarAdmDialogOpen} onOpenChange={setCriarAdmDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Nova Administradora</DialogTitle>
            <DialogDescription>
              Preencha o nome da nova administradora.
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
    </Dialog>
  )
}
