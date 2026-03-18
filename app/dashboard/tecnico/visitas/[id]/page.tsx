"use client"

import type React from "react"
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Camera, CheckCircle2, FileCheck2, FileText, Loader2, MapPin, PenTool, Plus, Trash2, XCircle, X, Edit, Check } from "lucide-react"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { formatCNPJ, formatRazaoSocial } from "@/lib/formatters"
import {
  ESPECIFICACAO_CONDOMINIO_OPTIONS,
  getEspecificacaoCondominioLabel,
} from "@/lib/constants/especificacao-condominio"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type DocumentoOperacionalStatus = "PENDENTE" | "COMPLETO"
type DocumentoOperacionalTipo = "RELATORIO_VISTORIA" | "TERMO_CONCLUSAO" | "ORDEM_SERVICO"

type DocumentoOperacionalAssinatura = {
  id: number
  nomeCompletoAssinante: string
  cpfAssinante: string | null
  url: string | null
  localizacao: string
  dadosExtras?: any
}

type DocumentoOperacional = {
  id: number
  tipo: DocumentoOperacionalTipo
  status: DocumentoOperacionalStatus
  url: string | null
  downloadUrl?: string | null
  dadosExtras?: any | null
  assinaturas: DocumentoOperacionalAssinatura[]
}

type ChecklistSavedItem = {
  itemId: number
  nome: string
  quantidade: number
  condicoes?: string
}

type VisitaDetail = {
  id: number
  status: string
  dataMarcada: string
  observacao?: string | null
  dataRegistroInicio: string | null
  dataRegistroFim: string | null
  checklist: ChecklistSavedItem[] | null
  tipoVisita?: string | null
  sacMaterials?: Array<{ nome: string; quantidade: number }> | null
  cliente: {
    id: number
    razaoSocial: string
    cnpj: string
    endereco: string
    quantidadeAndares?: number | null
    quantidadeSPDA?: number | null
    especificacaoCondominio?: "COMERCIAL" | "RESIDENCIAL" | "MISTO" | null
  }
  itensProduto?: Array<{
    id: number
    nome: string
    categoria: string | null
    valorReferencia: number
  }>
  tecnico: {
    id: string
    nome: string
    dadosCadastrais?: {
      cpf: string | null
    } | null
  } | null
  pedido: {
    id: number
    status: string
    tipoEspecial?: "OS" | null
    observacoes?: string | null
    detalhamento?: string | null
    medicaoOhmica: number | null
    documentosOperacionais: DocumentoOperacional[]
    itens: Array<{
      itemId: number
      quantidade: number
      valorUnitarioPraticado: number
      nome: string
      categoria: string | null
      valorReferencia: number
    }>
  } | null
  orcamento: {
    id: number
    status: string
    itens: Array<{
      itemId: number
      quantidade: number
      valor: number
      nome: string
      categoria: string | null
      valorReferencia: number
    }>
  } | null
}

type ChecklistItem = {
  id: string
  itemId: number
  nome: string
  categoria: string | null
  quantidadeBase: number
  status: "ok" | "trocar"
  quantidadeTroca: number
  condicoes: string
  valorReferencia: number
}

const TIPO_SERVICO_OPCOES = [
  { value: "manutencao", label: "manutenção", precisaDescidas: false, template: "manutenção" },
  {
    value: "manutencao_pecas",
    label: "manutenção com fornecimento de peças",
    precisaDescidas: false,
    template: "manutenção com fornecimento de peças",
  },
  {
    value: "instalacao_estrutural",
    label: "instalação com aterramento estrutural com fornecimento de peças",
    precisaDescidas: false,
    template: "instalação com aterramento estrutural com fornecimento de peças",
  },
  {
    value: "instalacao_composto_descidas",
    label: "instalação com aterramento composto por X descidas de aterramento e fornecimento de peças",
    precisaDescidas: true,
    template: "instalação com aterramento composto por {x} descidas de aterramento e fornecimento de peças",
  },
  {
    value: "reinstalacao_estrutural",
    label: "reinstalação com aterramento estrutural com fornecimento de peças",
    precisaDescidas: false,
    template: "reinstalação com aterramento estrutural com fornecimento de peças",
  },
  {
    value: "reinstalacao_composto_descidas",
    label: "reinstalação com aterramento composto por X descidas de aterramento e fornecimento de peças",
    precisaDescidas: true,
    template: "reinstalação com aterramento composto por {x} descidas de aterramento e fornecimento de peças",
  },
  {
    value: "instalacao_gaiola",
    label: "instalação de gaiola de faraday",
    precisaDescidas: false,
    template: "instalação de gaiola de faraday",
  },
  {
    value: "reinstalacao_gaiola",
    label: "reinstalação de gaiola de faraday",
    precisaDescidas: false,
    template: "reinstalação de gaiola de faraday",
  },
]

export default function TecnicoVisitaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { toast } = useToast()
  const router = useRouter()
  const [visita, setVisita] = useState<VisitaDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isOsPedido = useMemo(() => visita?.pedido?.tipoEspecial === "OS", [visita])
  const shouldHideChecklist = useMemo(() =>
    isOsPedido ||
    visita?.tipoVisita === "SAC" ||
    visita?.tipoVisita === "Primeira visita com peças",
    [isOsPedido, visita])

  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [checklistLocked, setChecklistLocked] = useState(false)
  const [savingChecklist, setSavingChecklist] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [adjustQuantitiesOpen, setAdjustQuantitiesOpen] = useState(false)
  const [quantitiesToAdjust, setQuantitiesToAdjust] = useState<Array<{ itemId: number; nome: string; quantidade: number; editing?: boolean }>>([])
  const [isSavingQuantities, setIsSavingQuantities] = useState(false)
  const [docDialog, setDocDialog] = useState<{
    tipo: DocumentoOperacionalTipo
    documento: DocumentoOperacional | null
  } | null>(null)
  const [docActionLoading, setDocActionLoading] = useState(false)
  const [medicaoOhmica, setMedicaoOhmica] = useState<string>("")
  const [medicoesMulti, setMedicoesMulti] = useState<Array<{ torre: string; valor: string }>>([
    { torre: "Torre Principal", valor: "" }
  ])
  const [isMedicaoDialogOpen, setIsMedicaoDialogOpen] = useState(false)
  const [responsavelNome, setResponsavelNome] = useState("")
  const [responsavelCpf, setResponsavelCpf] = useState("")
  const [assinaturaResponsavel, setAssinaturaResponsavel] = useState<string | null>(null)
  const [assinaturaTecnico, setAssinaturaTecnico] = useState<string | null>(null)
  const [modalAssinaturaResponsavel, setModalAssinaturaResponsavel] = useState(false)
  const [modalAssinaturaTecnico, setModalAssinaturaTecnico] = useState(false)
  const [tipoServico, setTipoServico] = useState<string>("")
  const [descidasAterramento, setDescidasAterramento] = useState<string>("")
  const [docLocation, setDocLocation] = useState<string>("")
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "error">("idle")
  const [observacaoRelatorio, setObservacaoRelatorio] = useState<string>("")
  const [detalhamentoOs, setDetalhamentoOs] = useState<string>("")
  const [confirmSaveChecklist, setConfirmSaveChecklist] = useState(false)
  const [condominioDialogOpen, setCondominioDialogOpen] = useState(false)
  const [condominioTipo, setCondominioTipo] = useState<string>("")
  const [condominioAndares, setCondominioAndares] = useState<string>("")
  const [condominioSpda, setCondominioSpda] = useState<string>("")
  const [savingCondominio, setSavingCondominio] = useState(false)
  const responsavelCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const tecnicoCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawingResponsavel, setIsDrawingResponsavel] = useState(false)
  const [isDrawingTecnico, setIsDrawingTecnico] = useState(false)
  const [confirmMissingRelatorio, setConfirmMissingRelatorio] = useState(false)
  const [anexos, setAnexos] = useState<{ id: number; url: string; createdAt: string }[]>([])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploadingAnexo, setUploadingAnexo] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [anexosDialogOpen, setAnexosDialogOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const precisaDescidas = useMemo(
    () => TIPO_SERVICO_OPCOES.find((o) => o.value === tipoServico)?.precisaDescidas ?? false,
    [tipoServico],
  )

  const tipoServicoTexto = useMemo(() => {
    const opt = TIPO_SERVICO_OPCOES.find((o) => o.value === tipoServico)
    if (!opt) return ""
    if (!opt.precisaDescidas) return opt.template
    const n = Number(descidasAterramento)
    if (!Number.isFinite(n) || n <= 0) return ""
    return opt.template.replace("{x}", String(n))
  }, [descidasAterramento, tipoServico])

  const isValidCpf = useCallback((value: string) => {
    const digits = value.replace(/\D/g, "")
    if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false
    const calc = (len: number) => {
      const nums = digits.slice(0, len).split("").map(Number)
      const sum = nums.reduce((acc, num, idx) => acc + num * (len + 1 - idx), 0)
      const rest = (sum * 10) % 11
      return rest === 10 ? 0 : rest
    }
    return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10])
  }, [])

  const { id } = use(params)
  const visitaId = Number.parseInt(id, 10)

  const clearCanvas = (ref: React.RefObject<HTMLCanvasElement | null>) => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const resetDocumentoForm = () => {
    setResponsavelNome("")
    setResponsavelCpf("")
    setAssinaturaResponsavel(null)
    setAssinaturaTecnico(null)
    setTipoServico("")
    setDescidasAterramento("")
    setDocLocation("")
    setGeoStatus("idle")
    setObservacaoRelatorio("")
    setDetalhamentoOs("")
    clearCanvas(responsavelCanvasRef)
    clearCanvas(tecnicoCanvasRef)
    setIsDrawingResponsavel(false)
    setIsDrawingTecnico(false)
  }

  const getPointerPos = (
    event: React.PointerEvent<HTMLCanvasElement>,
    ref: React.RefObject<HTMLCanvasElement | null>,
  ) => {
    const canvas = ref.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    }
  }

  const startPointer = (
    event: React.PointerEvent<HTMLCanvasElement>,
    ref: React.RefObject<HTMLCanvasElement | null>,
    setDrawing: (value: boolean) => void,
  ) => {
    event.preventDefault()
    const canvas = ref.current
    if (!canvas) return
    canvas.setPointerCapture?.(event.pointerId)
    const pos = getPointerPos(event, ref)
    if (!pos) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    setDrawing(true)
  }

  const movePointer = (
    event: React.PointerEvent<HTMLCanvasElement>,
    ref: React.RefObject<HTMLCanvasElement | null>,
    isDrawing: boolean,
  ) => {
    if (!isDrawing) return
    event.preventDefault()
    const canvas = ref.current
    if (!canvas) return
    const pos = getPointerPos(event, ref)
    if (!pos) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = "#000"
    ctx.lineWidth = 2
    ctx.stroke()
  }

  const stopPointer = (
    event: React.PointerEvent<HTMLCanvasElement>,
    ref: React.RefObject<HTMLCanvasElement | null>,
    setDrawing: (value: boolean) => void,
  ) => {
    event.preventDefault()
    const canvas = ref.current
    if (canvas && canvas.releasePointerCapture) {
      try {
        canvas.releasePointerCapture(event.pointerId)
      } catch {
        // ignore
      }
    }
    setDrawing(false)
  }

  const saveSignature = (ref: React.RefObject<HTMLCanvasElement | null>, setter: (value: string | null) => void) => {
    const canvas = ref.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL("image/png")
    setter(dataUrl)
  }

  const handleClearSignature = (
    ref: React.RefObject<HTMLCanvasElement | null>,
    setter: (value: string | null) => void,
  ) => {
    clearCanvas(ref)
    setter(null)
  }

  const loadVisita = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/tecnico/visitas/${visitaId}`)
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao carregar visita.")
      }
      setVisita(payload as VisitaDetail)
      setVisita(payload as VisitaDetail)

      let initialTipo = payload?.cliente?.especificacaoCondominio ?? ""
      let initialAndares = payload?.cliente?.quantidadeAndares !== null && payload?.cliente?.quantidadeAndares !== undefined
        ? String(payload.cliente.quantidadeAndares)
        : ""

      // Recuperar do localStorage se não houver no banco
      if (!initialTipo) {
        const stored = localStorage.getItem(`visita-${visitaId}-cond-tipo`)
        if (stored) initialTipo = stored
      }
      if (!initialAndares) {
        const stored = localStorage.getItem(`visita-${visitaId}-cond-andares`)
        if (stored) initialAndares = stored
      }

      setCondominioTipo(initialTipo)
      setCondominioAndares(initialAndares)
      const itensFonte: ChecklistItem[] = []

      if (payload.itensProduto?.length) {
        payload.itensProduto.forEach((item: NonNullable<VisitaDetail["itensProduto"]>[number], index: number) => {
          itensFonte.push({
            id: `cat-${item.id}-${index}`,
            itemId: item.id,
            nome: item.nome,
            categoria: item.categoria,
            quantidadeBase: 1,
            status: "ok",
            quantidadeTroca: 1,
            condicoes: "",
            valorReferencia: item.valorReferencia ?? 0,
          })
        })
      }

      const checklistSalvo = Array.isArray(payload.checklist) ? (payload.checklist as ChecklistSavedItem[]) : null
      if (checklistSalvo !== null) {
        // aplica itens salvos (não-ok) sobre a base; demais ficam ok
        const mapSalvos = new Map<number, ChecklistSavedItem>()
        checklistSalvo.forEach((c) => mapSalvos.set(Number(c.itemId), c))
        const itensComStatus = itensFonte.map((item) => {
          const salvo = mapSalvos.get(item.itemId)
          if (salvo) {
            return {
              ...item,
              status: "trocar" as const,
              quantidadeTroca: salvo.quantidade > 0 ? salvo.quantidade : 1,
              condicoes: salvo.condicoes ?? "",
            }
          }
          return item
        })
        // se existir algum salvo que não está na fonte, adiciona para exibição
        mapSalvos.forEach((salvo, key) => {
          const exists = itensComStatus.some((i) => i.itemId === key)
          if (!exists) {
            itensComStatus.push({
              id: `extra-${key}`,
              itemId: key,
              nome: salvo.nome,
              categoria: null,
              quantidadeBase: 1,
              status: "trocar",
              quantidadeTroca: salvo.quantidade > 0 ? salvo.quantidade : 1,
              condicoes: salvo.condicoes ?? "",
              valorReferencia: 0,
            })
          }
        })

        setChecklist(itensComStatus)
        setChecklistLocked(true)
        // Limpa localStorage já que foi salvo no backend
        localStorage.removeItem(`checklist-visita-${visitaId}`)
      } else {
        // Tenta carregar do localStorage se não houver checklist salvo no backend
        const localStorageKey = `checklist-visita-${visitaId}`
        const cachedChecklist = localStorage.getItem(localStorageKey)

        if (cachedChecklist) {
          try {
            const parsed = JSON.parse(cachedChecklist) as ChecklistItem[]
            // Mescla com itensFonte para garantir integridade
            const merged = itensFonte.map((item) => {
              const cached = parsed.find((p) => p.itemId === item.itemId)
              if (cached) {
                return { ...item, ...cached, id: item.id }
              }
              return item
            })
            setChecklist(merged)
          } catch {
            setChecklist(itensFonte)
          }
        } else {
          setChecklist(itensFonte)
        }
        setChecklistLocked(false)
      }
      if (payload?.pedido?.medicaoOhmicaMulti && Array.isArray(payload.pedido.medicaoOhmicaMulti)) {
        setMedicoesMulti(payload.pedido.medicaoOhmicaMulti.map((m: any) => ({
          torre: String(m.torre || ""),
          valor: String(m.valor || "")
        })))
      } else if (payload?.pedido?.medicaoOhmica !== undefined && payload?.pedido?.medicaoOhmica !== null) {
        setMedicaoOhmica(String(payload.pedido.medicaoOhmica))
        setMedicoesMulti([{ torre: "", valor: String(payload.pedido.medicaoOhmica) }])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar a visita.")
    } finally {
      setLoading(false)
    }
  }, [visitaId])

  const loadAnexos = useCallback(async () => {
    try {
      const res = await fetch(`/api/visitas/${visitaId}/anexos`)
      if (res.ok) {
        const json = await res.json()
        setAnexos(json.data ?? [])
      }
    } catch { /* ignore */ }
  }, [visitaId])

  useEffect(() => {
    if (!Number.isNaN(visitaId)) {
      loadVisita().catch(console.error)
      loadAnexos().catch(console.error)
    } else {
      setError("ID inválido.")
      setLoading(false)
    }
  }, [loadVisita, loadAnexos, visitaId])

  // Salva checklist no localStorage quando houver alterações (e não estiver travado)
  useEffect(() => {
    if (!checklistLocked && checklist.length > 0 && !loading) {
      const localStorageKey = `checklist-visita-${visitaId}`
      localStorage.setItem(localStorageKey, JSON.stringify(checklist))
    }
  }, [checklist, checklistLocked, visitaId, loading])

  // Persistir dados do condomínio no localStorage
  useEffect(() => {
    if (visitaId && condominioTipo) {
      localStorage.setItem(`visita-${visitaId}-cond-tipo`, condominioTipo)
    }
  }, [visitaId, condominioTipo])

  useEffect(() => {
    if (visitaId && condominioAndares) {
      localStorage.setItem(`visita-${visitaId}-cond-andares`, condominioAndares)
    }
  }, [visitaId, condominioAndares])

  useEffect(() => {
    if (!docDialog) {
      resetDocumentoForm()
      return
    }

    setGeoStatus("loading")
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setDocLocation(`${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`)
          setGeoStatus("idle")
        },
        () => {
          setDocLocation("Localização não informada")
          setGeoStatus("error")
        },
      )
    } else {
      setDocLocation("Localização não disponível")
      setGeoStatus("error")
    }
  }, [docDialog])

  const documentoPorTipo = useCallback(
    (tipo: DocumentoOperacionalTipo) =>
      visita?.pedido?.documentosOperacionais?.find((doc) => doc.tipo === tipo) ?? null,
    [visita],
  )

  const canSubmitDocumento =
    Boolean(docDialog) &&
    responsavelNome.trim().length > 0 &&
    // CPF é opcional - se informado, deve ser válido
    (responsavelCpf.trim().length === 0 || isValidCpf(responsavelCpf)) &&
    Boolean(assinaturaResponsavel) &&
    (docDialog?.tipo !== "TERMO_CONCLUSAO" ? true : Boolean(tipoServicoTexto)) &&
    (docDialog?.tipo !== "ORDEM_SERVICO" ? true : Boolean(detalhamentoOs.trim())) &&
    // Assinatura do técnico é obrigatória para TERMO_CONCLUSAO, RELATORIO_VISTORIA e ORDEM_SERVICO
    (
      (docDialog?.tipo !== "TERMO_CONCLUSAO" &&
        docDialog?.tipo !== "RELATORIO_VISTORIA" &&
        docDialog?.tipo !== "ORDEM_SERVICO") ||
      Boolean(assinaturaTecnico)
    ) &&
    !docActionLoading

  const closeDocDialog = () => {
    setDocDialog(null)
    resetDocumentoForm()
  }

  const canEditAnexos = visita && visita.status !== "FINALIZADO" && visita.status !== "CANCELADO"

  const handleSaveCondominio = async () => {
    if (!visita) return
    const andaresValue =
      condominioAndares.trim() === "" ? null : Number.parseInt(condominioAndares.trim(), 10)
    if (condominioAndares.trim() !== "" && (!Number.isInteger(andaresValue) || (andaresValue ?? 0) < 0)) {
      toast({
        title: "Número de andares inválido",
        description: "Informe um número inteiro maior ou igual a zero.",
        variant: "destructive",
      })
      return
    }
    setSavingCondominio(true)
    try {
      const response = await fetch(`/api/tecnico/visitas/${visita.id}/cliente-basico`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          especificacaoCondominio: condominioTipo || null,
          quantidadeAndares: andaresValue,
          quantidadeSPDA: condominioSpda.trim() === "" ? null : Number.parseInt(condominioSpda, 10),
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível salvar os dados do condomínio.")
      }
      setVisita((prev) =>
        prev
          ? {
            ...prev,
            cliente: {
              ...prev.cliente,
              quantidadeAndares: payload.quantidadeAndares ?? null,
              quantidadeSPDA: payload.quantidadeSPDA ?? null,
              especificacaoCondominio: payload.especificacaoCondominio ?? null,
            },
          }
          : prev,
      )
      toast({ description: "Dados do condomínio atualizados." })
      setCondominioDialogOpen(false)
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Não foi possível salvar.",
        variant: "destructive",
      })
    } finally {
      setSavingCondominio(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPendingFiles((prev) => [...prev, ...Array.from(e.target.files!)])
    }
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }



  const uploadPendingFiles = async () => {
    if (!pendingFiles.length) return
    setUploadingAnexo(true)
    try {
      for (const file of pendingFiles) {
        const form = new FormData()
        form.append("file", file)
        await fetch(`/api/visitas/${visitaId}/anexos`, { method: "POST", body: form })
      }
      setPendingFiles([])
      await loadAnexos()
      toast({ description: "Anexos enviados com sucesso." })
    } catch (error) {
      toast({
        title: "Erro no upload",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setUploadingAnexo(false)
    }
  }

  const deleteAnexo = async (anexoId: number) => {
    try {
      await fetch(`/api/visitas/${visitaId}/anexos?anexoId=${anexoId}`, { method: "DELETE" })
      await loadAnexos()
    } catch {
      toast({ variant: "destructive", title: "Erro ao remover anexo." })
    }
  }

  const requiredSignatures = useCallback(
    (tipo: DocumentoOperacionalTipo) =>
      tipo === "TERMO_CONCLUSAO" || tipo === "RELATORIO_VISTORIA" || tipo === "ORDEM_SERVICO" ? 2 : 1,
    [],
  )

  const handleOpenDocumento = useCallback(
    (tipo: DocumentoOperacionalTipo) => {
      if (!visita?.pedido) {
        toast({
          title: "Pedido não encontrado",
          description: "Esta visita não está vinculada a um pedido.",
          variant: "destructive",
        })
        return
      }
      if (visita.status !== "EM_EXECUCAO") {
        toast({
          title: "Visita não iniciada",
          description: "Inicie a visita para gerar e assinar documentos.",
          variant: "destructive",
        })
        return
      }
      const existente = documentoPorTipo(tipo)
      resetDocumentoForm()
      setDocDialog({ tipo, documento: existente })
      if (existente?.dadosExtras) {
        const extras = existente.dadosExtras as { tipoServico?: string; observacao?: string; detalhamento?: string }
        if (extras.observacao) {
          setObservacaoRelatorio(String(extras.observacao))
        }
        if (extras.detalhamento) {
          setDetalhamentoOs(String(extras.detalhamento))
        }
        if (extras.tipoServico) {
          const match = TIPO_SERVICO_OPCOES.find((o) => {
            if (o.precisaDescidas) {
              const prefix = o.template.split("{x}")[0]
              return extras.tipoServico?.startsWith(prefix)
            }
            return extras.tipoServico === o.template
          })
          if (match) {
            setTipoServico(match.value)
            if (match.precisaDescidas) {
              const num = extras.tipoServico.match(/\d+/)?.[0]
              if (num) setDescidasAterramento(num)
            }
          }
        }
      }
    },
    [documentoPorTipo, resetDocumentoForm, toast, visita],
  )

  const handleSubmitDocumento = async () => {
    if (!visita || !docDialog) return
    if (!visita.pedido) {
      toast({
        title: "Pedido não encontrado",
        description: "Não é possível gerar documento sem pedido vinculado.",
        variant: "destructive",
      })
      return
    }

    if (!responsavelNome.trim() || !assinaturaResponsavel) {
      toast({
        title: "Campos obrigatórios",
        description: "Informe nome e a assinatura do responsável.",
        variant: "destructive",
      })
      return
    }

    // CPF é opcional - se informado, deve ser válido
    if (responsavelCpf.trim() && !isValidCpf(responsavelCpf)) {
      toast({
        title: "CPF inválido",
        description: "O CPF informado é inválido.",
        variant: "destructive",
      })
      return
    }

    // Assinatura do técnico é obrigatória para TERMO_CONCLUSAO, RELATORIO_VISTORIA e ORDEM_SERVICO
    if (
      (docDialog.tipo === "TERMO_CONCLUSAO" ||
        docDialog.tipo === "RELATORIO_VISTORIA" ||
        docDialog.tipo === "ORDEM_SERVICO") &&
      !assinaturaTecnico
    ) {
      toast({
        title: "Assinatura do técnico",
        description: "Colete a assinatura do técnico para concluir o documento.",
        variant: "destructive",
      })
      return
    }

    if (docDialog.tipo === "TERMO_CONCLUSAO") {
      if (!tipoServicoTexto) {
        toast({
          title: "Tipo do serviço obrigatório",
          description: "Selecione o tipo do serviço para o termo de conclusão.",
          variant: "destructive",
        })
        return
      }
      if (precisaDescidas && (!descidasAterramento || Number(descidasAterramento) <= 0)) {
        toast({
          title: "Informe as descidas",
          description: "Preencha o número de descidas de aterramento.",
          variant: "destructive",
        })
        return
      }
    }

    if (docDialog.tipo === "ORDEM_SERVICO") {
      if (!detalhamentoOs.trim()) {
        toast({
          title: "Detalhamento obrigatório",
          description: "Informe o detalhamento da ordem de serviço.",
          variant: "destructive",
        })
        return
      }
    }

    setDocActionLoading(true)
    try {
      const baseExtras =
        docDialog.documento?.dadosExtras &&
          typeof docDialog.documento.dadosExtras === "object" &&
          !Array.isArray(docDialog.documento.dadosExtras)
          ? (docDialog.documento.dadosExtras as Record<string, unknown>)
          : {}

      const extras: Record<string, unknown> = { ...baseExtras }
      if (docDialog.tipo === "TERMO_CONCLUSAO") {
        extras.tipoServico = tipoServicoTexto
        if (precisaDescidas) {
          extras.descidasAterramento = Number(descidasAterramento)
        }
      }
      if (docDialog.tipo === "RELATORIO_VISTORIA") {
        extras.observacao = observacaoRelatorio.trim() || null
        extras.visitaTecnicaId = visita.id
      }
      if (docDialog.tipo === "ORDEM_SERVICO") {
        extras.detalhamento = detalhamentoOs.trim() || null
      }
      let documentoId = docDialog.documento?.id
      let totalExistente = docDialog.documento?.assinaturas.length ?? 0
      let documentoBase: DocumentoOperacional | null = docDialog.documento ?? null
      if (!documentoId || docDialog.tipo === "TERMO_CONCLUSAO") {
        const response = await fetch(`/api/tecnico/visitas/${visita.id}/documentos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipo: docDialog.tipo, dadosExtras: extras }),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(payload?.error || "Não foi possível gerar o documento.")
        }
        documentoId = payload?.data?.id
        if (payload?.data?.assinaturas) {
          totalExistente = payload.data.assinaturas.length
        }
        if (payload?.data) {
          documentoBase = {
            id: payload.data.id,
            tipo: payload.data.tipo,
            status: payload.data.status,
            url: payload.data.url,
            dadosExtras: payload.data.dadosExtras,
            assinaturas: payload.data.assinaturas ?? [],
          }
        }
      }

      if (!documentoId) {
        throw new Error("Documento não foi criado.")
      }

      const localizacao = docLocation || "Localização não informada"
      const assinaturas: Array<{
        nomeCompletoAssinante: string
        cpfAssinante: string | null
        assinaturaDataUrl: string
        role?: "funcionario_condominio" | "funcionario_tecnico"
      }> = [
          {
            nomeCompletoAssinante: responsavelNome.trim(),
            cpfAssinante: responsavelCpf.trim() || null,
            assinaturaDataUrl: assinaturaResponsavel,
            // Role é obrigatória para TERMO_CONCLUSAO, RELATORIO_VISTORIA e ORDEM_SERVICO
            role:
              docDialog.tipo === "TERMO_CONCLUSAO" ||
                docDialog.tipo === "RELATORIO_VISTORIA" ||
                docDialog.tipo === "ORDEM_SERVICO"
                ? "funcionario_condominio"
                : undefined,
          },
        ]

      // Assinatura do técnico para TERMO_CONCLUSAO, RELATORIO_VISTORIA e ORDEM_SERVICO
      if (
        (docDialog.tipo === "TERMO_CONCLUSAO" ||
          docDialog.tipo === "RELATORIO_VISTORIA" ||
          docDialog.tipo === "ORDEM_SERVICO") &&
        assinaturaTecnico
      ) {
        assinaturas.push({
          nomeCompletoAssinante: visita.tecnico?.nome ?? "Técnico",
          cpfAssinante: visita.tecnico?.dadosCadastrais?.cpf ?? null,
          assinaturaDataUrl: assinaturaTecnico,
          role: "funcionario_tecnico",
        })
      }

      let statusFinal: DocumentoOperacionalStatus | null = documentoBase?.status ?? null
      let faltantes = Math.max(requiredSignatures(docDialog.tipo) - totalExistente, 0)
      const assinaturasNovas: DocumentoOperacionalAssinatura[] = []

      for (const assinatura of assinaturas) {
        if (faltantes <= 0) break
        const response = await fetch(`/api/documentos-operacionais/${documentoId}/assinaturas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...assinatura, localizacao }),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          const msg = payload?.error || "Não foi possível salvar a assinatura."
          // Se já tiver o número necessário de assinaturas, tratamos como sucesso silencioso
          if (msg.toLowerCase().includes("assinaturas suficientes") || msg.toLowerCase().includes("concluído")) {
            statusFinal = "COMPLETO"
            break
          }
          throw new Error(msg)
        }
        statusFinal = (payload?.data?.status as DocumentoOperacionalStatus) ?? null
        if (payload?.data?.assinatura) {
          assinaturasNovas.push({
            id: payload.data.assinatura.id,
            nomeCompletoAssinante: payload.data.assinatura.nomeCompletoAssinante,
            cpfAssinante: payload.data.assinatura.cpfAssinante,
            url: payload.data.assinatura.url,
            localizacao: payload.data.assinatura.localizacao,
            dadosExtras: payload.data.assinatura.dadosExtras,
          })
        }
        faltantes -= 1
      }

      toast({
        description: statusFinal === "COMPLETO" ? "Documento concluído." : "Assinatura registrada.",
      })
      // Atualiza estado local para refletir o documento sem reload
      setVisita((prev) => {
        if (!prev || !prev.pedido) return prev
        const docs = [...prev.pedido.documentosOperacionais]
        const docId = documentoBase?.id ?? documentoId!
        const idx = docs.findIndex((d) => d.id === docId)
        const baseDoc =
          idx >= 0
            ? docs[idx]
            : documentoBase ?? {
              id: docId,
              tipo: docDialog.tipo,
              status: statusFinal ?? "PENDENTE",
              url: null,
              assinaturas: [],
            }
        const assinaturasAtualizadas = [...(baseDoc.assinaturas ?? []), ...assinaturasNovas]
        const docAtualizado: DocumentoOperacional = {
          ...baseDoc,
          status: statusFinal ?? baseDoc.status,
          assinaturas: assinaturasAtualizadas,
        }
        if (idx >= 0) {
          docs[idx] = docAtualizado
        } else {
          docs.push(docAtualizado)
        }
        return {
          ...prev,
          pedido: { ...prev.pedido, documentosOperacionais: docs },
        }
      })
      closeDocDialog()
    } catch (err) {
      toast({
        title: "Erro ao salvar documento",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setDocActionLoading(false)
    }
  }

  const handleFinalize = () => {
    if (!visita) return

    // Validação obrigatória dos dados do condomínio
    if (!condominioTipo || !condominioAndares.trim()) {
      toast({
        title: "Dados do condomínio obrigatórios",
        description: "Informe o tipo e número de andares do condomínio antes de finalizar.",
        variant: "destructive",
      })
      setCondominioDialogOpen(true)
      return
    }


    if (isOsPedido) {
      const documentoOs = documentoPorTipo("ORDEM_SERVICO")
      if (!documentoOs || documentoOs.status !== "COMPLETO") {
        toast({
          title: "Documento pendente",
          description: "Finalize o documento de Ordem de Serviço antes de concluir a visita.",
          variant: "destructive",
        })
        return
      }
    } else {
      if (!shouldHideChecklist) {
        if (!checklistLocked) {
          toast({
            title: "Salve o checklist",
            description: "Salve o checklist antes de finalizar a visita.",
            variant: "destructive",
          })
          return
        }
        const faltandoStatus = checklist.some((item) => !item.status)
        if (faltandoStatus) {
          toast({
            title: "Checklist incompleto",
            description: "Marque todos os itens como OK ou Trocar.",
            variant: "destructive",
          })
          return
        }
      }

      if (!shouldHideChecklist) {
        const relatorio = documentoPorTipo("RELATORIO_VISTORIA")
        if (!relatorio || relatorio.status !== "COMPLETO") {
          toast({
            title: "Relatório de vistoria obrigatório",
            description: "Assine o relatório de vistoria antes de concluir a visita.",
            variant: "destructive",
          })
          return
        }
      }
    }

    // Verifica se algum "Serviço" no pedido tem quantidade diferente do SPDA
    const spdaQty = visita.cliente.quantidadeSPDA || 0
    const servicesWithMismatch = (visita.pedido?.itens || []).filter(item =>
      item.categoria === "Serviço" && item.quantidade !== spdaQty
    )

    if (servicesWithMismatch.length > 0) {
      setQuantitiesToAdjust(servicesWithMismatch.map(item => ({
        itemId: item.itemId,
        nome: item.nome,
        quantidade: item.quantidade,
        editing: false
      })))
      setAdjustQuantitiesOpen(true)
      return
    }

    setConfirmOpen(true)
  }

  const handleSaveQuantities = async () => {
    if (!visita || !visita.pedido) return

    // Filtra apenas o que realmente mudou para evitar requisições desnecessárias
    const itemsToUpdate = quantitiesToAdjust.filter(q => {
      const originalItem = visita.pedido?.itens.find(i => i.itemId === q.itemId)
      return originalItem && originalItem.quantidade !== q.quantidade
    }).map(q => ({
      itemId: q.itemId,
      quantidade: q.quantidade
    }))

    if (itemsToUpdate.length === 0) {
      setAdjustQuantitiesOpen(false)
      setConfirmOpen(true)
      return
    }

    setIsSavingQuantities(true)
    try {
      const response = await fetch(`/api/pedidos/${visita.pedido.id}/items/quantities`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsToUpdate }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Erro ao atualizar quantidades.")

      toast({ description: "Quantidades atualizadas com sucesso." })

      // Atualiza os dados da visita localmente
      const res = await fetch(`/api/tecnico/visitas/${visita.id}`)
      if (res.ok) {
        const data = await res.json()
        setVisita(data.data || data)
      }

      setAdjustQuantitiesOpen(false)
      setConfirmOpen(true)
    } catch (err) {
      toast({
        title: "Erro ao salvar",
        description: err instanceof Error ? err.message : "Não foi possível atualizar as quantidades.",
        variant: "destructive"
      })
    } finally {
      setIsSavingQuantities(false)
    }
  }

  const confirmFinalize = async () => {
    if (!visita) return
    const shouldHideChecklist = visita.pedido?.tipoEspecial === "OS" || visita.tipoVisita === "Primeira visita com peças"
    const itensExtras = shouldHideChecklist
      ? []
      : checklist
        .filter((item) => item.status === "trocar" && item.quantidadeTroca > 0)
        .map((item) => ({
          itemId: item.itemId,
          quantidade: item.quantidadeTroca,
          valorUnitario: item.valorReferencia,
        }))

    const medicaoValor = medicaoOhmica.trim() === "" ? null : Number.parseFloat(medicaoOhmica.trim())

    setFinalizing(true)
    try {
      if (!isOsPedido) {
        const relatorio = documentoPorTipo("RELATORIO_VISTORIA")
        const termo = documentoPorTipo("TERMO_CONCLUSAO")

        // Relatório de vistoria é sempre obrigatório para pedidos normais, a menos que o checklist seja ocultado
        if (!shouldHideChecklist && (!relatorio || relatorio.status !== "COMPLETO")) {
          toast({
            title: "Documentos pendentes",
            description: "O relatório de vistoria é obrigatório.",
            variant: "destructive",
          })
          setFinalizing(false)
          return
        }

        // Termo de conclusão é obrigatório apenas quando não houver itens extras
        if (itensExtras.length === 0) {
          if (!termo || termo.status !== "COMPLETO") {
            toast({
              title: "Termo de conclusão obrigatório",
              description: "Finalize o termo de conclusão antes de concluir o serviço sem extras.",
              variant: "destructive",
            })
            setFinalizing(false)
            return
          }

          if (medicaoValor === null || Number.isNaN(medicaoValor)) {
            toast({
              title: "Medição ôhmica obrigatória",
              description: "Informe a medição ôhmica antes de concluir o serviço sem extras.",
              variant: "destructive",
            })
            setFinalizing(false)
            return
          }
        }
      }

      const response = await fetch(`/api/tecnico/visitas/${visita.id}/finalizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklistConcluido: shouldHideChecklist ? undefined : true,
          itensExtras: shouldHideChecklist ? undefined : itensExtras,
          medicaoOhmica: medicaoValor ?? undefined,
          medicaoOhmicaMulti: medicoesMulti
            .filter(m => m.valor.trim() !== "")
            .map(m => ({
              torre: m.torre.trim(),
              valor: Number.parseFloat(m.valor.trim())
            }))
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao finalizar.")
      }
      toast({ description: "Visita finalizada." })
      if (!shouldHideChecklist) {
        localStorage.removeItem(`checklist-visita-${visita.id}`)
      }
      window.location.assign("/dashboard/tecnico")
    } catch (err) {
      toast({
        title: "Não foi possível finalizar",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setFinalizing(false)
      setConfirmOpen(false)
    }
  }

  const atualizarChecklist = useCallback(
    (idItem: string, updater: (current: ChecklistItem) => ChecklistItem) => {
      if (checklistLocked) return
      setChecklist((prev) => prev.map((item) => (item.id === idItem ? updater(item) : item)))
    },
    [checklistLocked],
  )

  const handleSaveChecklist = useCallback(async () => {
    if (!visita || checklistLocked) return
    const itensNaoOk = checklist
      .filter((item) => item.status === "trocar" && item.quantidadeTroca > 0)
      .map((item) => ({ ...item, condicoes: item.condicoes.trim() }))
      .filter((item) => item.condicoes.length > 0)
      .map((item) => ({
        itemId: item.itemId,
        nome: item.nome,
        quantidade: item.quantidadeTroca,
        condicoes: item.condicoes,
      }))
    // Validação: se há itens "trocar", todos devem ter condições
    const faltandoCondicoes = checklist.some(
      (item) => item.status === "trocar" && (!item.condicoes || item.condicoes.trim().length === 0),
    )
    if (faltandoCondicoes) {
      toast({
        title: "Preencha as condições",
        description: "Itens marcados como trocar precisam informar as condições.",
        variant: "destructive",
      })
      return
    }
    setSavingChecklist(true)
    try {
      const response = await fetch(`/api/tecnico/visitas/${visita.id}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: itensNaoOk }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível salvar o checklist.")
      }
      setChecklistLocked(true)
      setVisita((prev) => (prev ? { ...prev, checklist: itensNaoOk } : prev))
      toast({ description: "Checklist salvo." })
    } catch (err) {
      toast({
        title: "Erro ao salvar checklist",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setSavingChecklist(false)
    }
  }, [checklist, checklistLocked, toast, visita])

  const itensTroca = useMemo(() => checklist.filter((item) => item.status === "trocar"), [checklist])


  const documentosGrid = useMemo(() => {
    if (!visita?.pedido) {
      return (
        <Alert>
          <AlertDescription>Não há pedido vinculado a esta visita.</AlertDescription>
        </Alert>
      )
    }

    const shouldHideChecklist = visita.pedido?.tipoEspecial === "OS" || visita.tipoVisita === "Primeira visita com peças"

    return (
      <div className="grid gap-3 md:grid-cols-2">
        {(isOsPedido
          ? [
            {
              tipo: "ORDEM_SERVICO" as DocumentoOperacionalTipo,
              title: "Ordem de Serviço",
              description: "Assinatura do responsável e do técnico.",
            },
          ]
          : (shouldHideChecklist && visita?.tipoVisita !== "Ord. Serv."
            ? [
              {
                tipo: "TERMO_CONCLUSAO" as DocumentoOperacionalTipo,
                title: "Termo de Conclusão",
                description: "Assinatura do responsável e do técnico.",
              },
            ]
            : [
              {
                tipo: "RELATORIO_VISTORIA" as DocumentoOperacionalTipo,
                title: "Relatório de Vistoria",
                description: "Assinatura do responsável e do técnico.",
              },
              {
                tipo: "TERMO_CONCLUSAO" as DocumentoOperacionalTipo,
                title: "Termo de Conclusão",
                description: "Assinatura do responsável e do técnico.",
              },
            ]
          )
        ).map((item) => {
          const documento = documentoPorTipo(item.tipo)
          const isComplete = documento?.status === "COMPLETO"
          const isPending = documento?.status === "PENDENTE"
          const disabled = visita.status !== "EM_EXECUCAO" || isComplete
          const badgeClass = isComplete
            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
            : isPending
              ? "bg-amber-50 text-amber-700 border border-amber-100"
              : "bg-slate-100 text-slate-700 border border-slate-200"

          return (
            <Card key={item.tipo} className="border-slate-200">
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <p className="font-semibold">{item.title}</p>
                  </div>
                  <Badge className={`text-[11px] ${badgeClass}`}>{documento ? documento.status : "Não gerado"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{item.description}</p>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    Assinaturas: {documento ? documento.assinaturas.length : 0}/{requiredSignatures(item.tipo)}
                  </span>
                  {documento?.status === "COMPLETO" ? (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <FileCheck2 className="h-4 w-4" />
                      Concluído
                    </span>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant={isComplete ? "secondary" : isPending ? "outline" : "default"}
                  disabled={disabled}
                  onClick={() => handleOpenDocumento(item.tipo)}
                >
                  {isComplete ? "Documento concluído" : documento ? "Coletar assinatura" : "Gerar documento"}
                </Button>
                {visita.status !== "EM_EXECUCAO" ? (
                  <p className="text-[11px] text-amber-600">Inicie a visita para gerar/assinar.</p>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }, [documentoPorTipo, handleOpenDocumento, isOsPedido, requiredSignatures, visita])

  const checklistContent = useMemo(() => {
    if (isOsPedido) {
      return null
    }
    if (checklist.length === 0) {
      return (
        <Alert>
          <AlertDescription className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Nenhum item de material (categoria Produto) encontrado.
          </AlertDescription>
        </Alert>
      )
    }

    return (
      <div className="space-y-2">
        {checklist.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
          >
            {/* Nome e categoria */}
            <div className="space-y-0.5 mb-3">
              <p className="text-sm font-semibold text-foreground">{item.nome}</p>
              <p className="text-[11px] text-muted-foreground">
                Categoria: {item.categoria ?? "Produto"} • Qtde base: {item.quantidadeBase}
              </p>
            </div>

            {/* Status */}
            <div className="mb-3">
              <Label className="text-[11px] text-muted-foreground">Status</Label>
              <Select
                disabled={checklistLocked}
                value={item.status}
                onValueChange={(value: "ok" | "trocar") =>
                  atualizarChecklist(item.id, (curr) => ({ ...curr, status: value }))
                }
              >
                <SelectTrigger className="mt-1 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ok">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      OK
                    </div>
                  </SelectItem>
                  <SelectItem value="trocar">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      Trocar
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Campos extras quando status = trocar */}
            {item.status === "trocar" && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Qtd. troca</Label>
                  <Input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={item.quantidadeTroca}
                    disabled={checklistLocked}
                    onChange={(e) =>
                      atualizarChecklist(item.id, (curr) => ({
                        ...curr,
                        quantidadeTroca: Math.max(1, Number.parseInt(e.target.value) || 1),
                      }))
                    }
                    className="mt-1 h-10"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Condições *</Label>
                  <Input
                    value={item.condicoes}
                    disabled={checklistLocked}
                    onChange={(e) =>
                      atualizarChecklist(item.id, (curr) => ({
                        ...curr,
                        condicoes: e.target.value,
                      }))
                    }
                    className="mt-1 h-10"
                    placeholder="Descreva as condições encontradas"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }, [atualizarChecklist, checklist, checklistLocked, isOsPedido])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-48 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Carregando visita...
        </div>
      </DashboardLayout>
    )
  }

  if (error || !visita) {
    return (
      <DashboardLayout>
        <Alert variant="destructive">
          <AlertDescription>{error ?? "Visita não encontrada."}</AlertDescription>
        </Alert>
      </DashboardLayout>
    )
  }

  const statusBadge =
    visita.status === "FINALIZADO"
      ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
      : visita.status === "EM_EXECUCAO"
        ? "bg-amber-50 text-amber-700 border border-amber-100"
        : "bg-slate-100 text-slate-700 border border-slate-200"

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1 min-w-[220px]">
              <p className="text-xs uppercase tracking-wide text-slate-500">Visita técnica #{visita.id}</p>
              <h1 className="text-xl font-semibold text-foreground leading-tight">
                {formatRazaoSocial(visita.cliente.razaoSocial)}
              </h1>
              <p className="text-xs text-muted-foreground">{formatCNPJ(visita.cliente.cnpj)}</p>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <MapPin className="h-3.5 w-3.5 text-blue-500" />
                <span className="truncate">{visita.cliente.endereco}</span>
              </div>
              {visita.pedido?.tipoEspecial === "OS" ? (
                <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-amber-700">
                  Ordem de Serviço
                </p>
              ) : (
                <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-slate-600">
                  Pedido
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <Badge className={statusBadge}>{visita.status}</Badge>
              {visita.pedido ? (
                <Badge variant="outline" className="border-slate-200 bg-white">
                  Pedido #{visita.pedido.id} · {visita.pedido.status}
                </Badge>
              ) : null}
              {visita.tipoVisita ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] uppercase font-bold",
                    visita.tipoVisita === "SAC" && "border-orange-400 text-orange-600 bg-orange-50",
                    (visita.tipoVisita === "Primeira visita" || visita.tipoVisita === "Primeira visita com peças") && "border-blue-400 text-blue-600 bg-blue-50",
                    visita.tipoVisita === "Ord. Serv." && "border-yellow-400 text-yellow-700 bg-yellow-50"
                  )}
                >
                  {visita.tipoVisita}
                </Badge>
              ) : null}
              {visita.pedido?.tipoEspecial === "OS" ? (
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                  Ordem de Serviço
                </Badge>
              ) : null}
              {visita.orcamento ? (
                <Badge variant="outline" className="border-slate-200 bg-white">
                  Orçamento #{visita.orcamento.id} · {visita.orcamento.status}
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
              <p className="text-[11px] uppercase font-semibold text-slate-500">Agendada</p>
              <p className="text-sm font-semibold text-foreground">
                {new Date(visita.dataMarcada).toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
              <p className="text-[11px] uppercase font-semibold text-slate-500">Início</p>
              <p className="text-sm font-semibold text-foreground">
                {visita.dataRegistroInicio ? new Date(visita.dataRegistroInicio).toLocaleString("pt-BR") : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
              <p className="text-[11px] uppercase font-semibold text-slate-500">Término</p>
              <p className="text-sm font-semibold text-foreground">
                {visita.dataRegistroFim ? new Date(visita.dataRegistroFim).toLocaleString("pt-BR") : "—"}
              </p>
            </div>
          </div>
        </div>

        {visita.pedido?.tipoEspecial === "OS" && (
          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Detalhamento (serviço a ser executado)</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-foreground whitespace-pre-line">
              {visita.pedido.detalhamento?.trim() || "—"}
            </CardContent>
          </Card>
        )}

        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Observação da visita(para o técnico)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-foreground whitespace-pre-line">
            {visita.observacao?.trim() || "—"}
          </CardContent>
        </Card>

        {visita.pedido && (
          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Observação do pedido</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-foreground whitespace-pre-line">
              {visita.pedido.observacoes?.trim() || "—"}
            </CardContent>
          </Card>
        )}

        {visita.pedido?.tipoEspecial !== "OS" && visita.sacMaterials && visita.sacMaterials.length > 0 && (
          <Card className="border-orange-200/80 bg-orange-50/20 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-orange-800 flex items-center gap-2">
                <Plus className="h-5 w-5" /> {visita.tipoVisita === "SAC" ? "Todas as peças incluidas no pedido" : "Peças incluidas no pedido"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 sm:grid-cols-2">
                {visita.sacMaterials.map((mat, idx) => (
                  <li key={idx} className="flex justify-between items-center p-2 rounded-lg bg-orange-50 border border-orange-100 text-sm text-orange-900">
                    <span className="font-medium">{mat.nome}</span>
                    <Badge variant="outline" className="bg-white border-orange-200 text-orange-700 font-bold">
                      x{mat.quantidade}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {!shouldHideChecklist && (
          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Checklist de materiais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-600">
                  {checklistLocked ? "Checklist salvo e bloqueado para edição." : "Edite os itens e salve o checklist para prosseguir."}
                </p>
                {checklistLocked ? (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                    Checklist salvo
                  </Badge>
                ) : null}
              </div>
              {checklistContent}
              {!checklistLocked ? (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => setConfirmSaveChecklist(true)}
                    disabled={savingChecklist || checklist.length === 0}
                  >
                    {savingChecklist ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar checklist"
                    )}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        <Card className="mt-3 border-slate-200/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Dados do condomínio</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setCondominioTipo(visita.cliente.especificacaoCondominio ?? "")
                setCondominioAndares(
                  visita.cliente.quantidadeAndares !== null && visita.cliente.quantidadeAndares !== undefined
                    ? String(visita.cliente.quantidadeAndares)
                    : "",
                )
                setCondominioSpda(
                  visita.cliente.quantidadeSPDA !== null && visita.cliente.quantidadeSPDA !== undefined
                    ? String(visita.cliente.quantidadeSPDA)
                    : "",
                )
                setCondominioDialogOpen(true)
              }}
            >
              Editar
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
              <p className="text-[11px] uppercase font-semibold text-slate-500">Tipo de condomínio</p>
              <p className="text-sm font-semibold text-foreground">
                {getEspecificacaoCondominioLabel(visita.cliente.especificacaoCondominio ?? null)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
              <p className="text-[11px] uppercase font-semibold text-slate-500">Nº de andares</p>
              <p className="text-sm font-semibold text-foreground">
                {visita.cliente.quantidadeAndares ?? "—"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
              <p className="text-[11px] uppercase font-semibold text-slate-500">Qtd. SPDA</p>
              <p className="text-sm font-semibold text-foreground">
                {visita.cliente.quantidadeSPDA ?? "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-1.5 px-4 mb-4">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Medições Ôhmicas (Ω)</Label>
            <Button
              variant="link"
              size="sm"
              onClick={() => setIsMedicaoDialogOpen(true)}
              className="h-auto p-0 text-[10px] uppercase font-bold text-blue-600 no-underline hover:no-underline"
            >
              Adicionar / Editar
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5 items-center min-h-[28px]">
            {medicoesMulti.filter(m => m.valor.trim() !== "").length > 0 ? (
              medicoesMulti.filter(m => m.valor.trim() !== "").map((med, idx) => (
                <span key={idx} className="text-[13px] font-mono font-bold text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded shadow-sm">
                  {med.valor}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic">vazio</span>
            )}
          </div>

          <Dialog open={isMedicaoDialogOpen} onOpenChange={setIsMedicaoDialogOpen}>
            <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-sm uppercase font-bold">Editar Medições</DialogTitle>
                <DialogDescription className="text-xs">
                  Informe os valores de resistência (Ω) para cada ponto.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {medicoesMulti.map((med, idx) => (
                  <div key={idx} className="flex gap-2 items-end border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-[11px] uppercase font-semibold text-slate-500">Ponto / Local</Label>
                      <Input
                        placeholder="Ex: Torre A"
                        value={med.torre}
                        onChange={(e) => {
                          const newMed = [...medicoesMulti]
                          newMed[idx].torre = e.target.value
                          setMedicoesMulti(newMed)
                        }}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="w-24 space-y-1.5">
                      <Label className="text-[11px] uppercase font-semibold text-slate-500">Valor (Ω)</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        placeholder="0.0"
                        value={med.valor}
                        onChange={(e) => {
                          const newMed = [...medicoesMulti]
                          newMed[idx].valor = e.target.value
                          setMedicoesMulti(newMed)
                          if (idx === 0) setMedicaoOhmica(e.target.value)
                        }}
                        className="h-9 text-sm"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 h-9 w-9"
                      onClick={() => {
                        if (medicoesMulti.length === 1) {
                          setMedicoesMulti([{ torre: "", valor: "" }])
                        } else {
                          setMedicoesMulti(prev => prev.filter((_, i) => i !== idx))
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed py-5 text-muted-foreground"
                  onClick={() => setMedicoesMulti(prev => [...prev, { torre: "", valor: "" }])}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Ponto de Medição
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => setIsMedicaoDialogOpen(false)} className="w-full">
                  Confirmar Valores
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>


        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Documentos para assinatura</CardTitle>
            <CardDescription>Gere e colete assinaturas durante a execução.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {documentosGrid}
          </CardContent>
        </Card>

        {canEditAnexos && (
          <div className="space-y-3">
            <Button variant="outline" size="sm" onClick={() => setAnexosDialogOpen(true)}>
              <Camera className="h-4 w-4 mr-1" /> Adicionar fotos
            </Button>
            {anexos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {anexos.map((anx) => (
                  <div key={anx.id} className="relative group">
                    <button
                      type="button"
                      onClick={() => setPreviewImage(anx.url)}
                      className="h-16 w-16 rounded-lg border bg-slate-50 overflow-hidden"
                    >
                      <img src={anx.url} alt="" className="h-full w-full object-cover" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteAnexo(anx.id)}
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.back()}>
            Voltar
          </Button>
          <Button onClick={handleFinalize} disabled={finalizing || (!shouldHideChecklist && !checklistLocked)}>
            {finalizing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Finalizando...
              </>
            ) : (
              "Finalizar visita"
            )}
          </Button>
        </div>
      </div>

      {/* Modal Assinatura Responsável */}
      <Dialog open={condominioDialogOpen} onOpenChange={setCondominioDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dados do condomínio</DialogTitle>
            <DialogDescription>Atualize o tipo e a quantidade de andares.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo do condomínio</Label>
              <Select value={condominioTipo} onValueChange={setCondominioTipo}>
                <SelectTrigger className="mt-1">
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
            <div>
              <Label>Número de andares</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={condominioAndares}
                onChange={(e) => setCondominioAndares(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Quantidade de SPDA</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={condominioSpda}
                onChange={(e) => setCondominioSpda(e.target.value)}
                className="mt-1"
                placeholder="Ex: 1"
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setCondominioDialogOpen(false)} disabled={savingCondominio}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCondominio} disabled={savingCondominio}>
              {savingCondominio ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={modalAssinaturaResponsavel} onOpenChange={setModalAssinaturaResponsavel}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-4 w-4 text-blue-600" />
              Assinatura do responsável
            </DialogTitle>
            <DialogDescription>Desenhe a assinatura abaixo e clique em salvar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-dashed border-slate-300 p-3 bg-slate-50/50">
              <canvas
                ref={responsavelCanvasRef}
                width={900}
                height={240}
                className="w-full h-48 sm:h-60 rounded bg-white shadow-sm touch-none"
                onPointerDown={(e) => startPointer(e, responsavelCanvasRef, setIsDrawingResponsavel)}
                onPointerMove={(e) => movePointer(e, responsavelCanvasRef, isDrawingResponsavel)}
                onPointerUp={(e) => stopPointer(e, responsavelCanvasRef, setIsDrawingResponsavel)}
                onPointerCancel={(e) => stopPointer(e, responsavelCanvasRef, setIsDrawingResponsavel)}
              />
              <div className="flex flex-wrap gap-2 mt-3">
                <Button
                  variant="outline"
                  onClick={() => handleClearSignature(responsavelCanvasRef, setAssinaturaResponsavel)}
                  size="sm"
                >
                  Limpar
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    saveSignature(responsavelCanvasRef, setAssinaturaResponsavel)
                    setModalAssinaturaResponsavel(false)
                  }}
                >
                  Salvar assinatura
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => setModalAssinaturaResponsavel(false)}
                >
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Assinatura Técnico */}
      <Dialog open={modalAssinaturaTecnico} onOpenChange={setModalAssinaturaTecnico}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-4 w-4 text-emerald-600" />
              Assinatura do técnico
            </DialogTitle>
            <DialogDescription>Desenhe a assinatura do técnico e salve.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-dashed border-slate-300 p-3 bg-slate-50/50">
              <canvas
                ref={tecnicoCanvasRef}
                width={900}
                height={160}
                className="w-full h-40 sm:h-52 rounded bg-white shadow-sm touch-none"
                onPointerDown={(e) => startPointer(e, tecnicoCanvasRef, setIsDrawingTecnico)}
                onPointerMove={(e) => movePointer(e, tecnicoCanvasRef, isDrawingTecnico)}
                onPointerUp={(e) => stopPointer(e, tecnicoCanvasRef, setIsDrawingTecnico)}
                onPointerCancel={(e) => stopPointer(e, tecnicoCanvasRef, setIsDrawingTecnico)}
              />
              <div className="flex flex-wrap gap-2 mt-3">
                <Button
                  variant="outline"
                  onClick={() => handleClearSignature(tecnicoCanvasRef, setAssinaturaTecnico)}
                  size="sm"
                >
                  Limpar
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    saveSignature(tecnicoCanvasRef, setAssinaturaTecnico)
                    setModalAssinaturaTecnico(false)
                  }}
                >
                  Salvar assinatura
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => setModalAssinaturaTecnico(false)}
                >
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(docDialog)} onOpenChange={(open) => (!open ? closeDocDialog() : undefined)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5 text-blue-600" />
              {docDialog?.tipo === "TERMO_CONCLUSAO"
                ? "Termo de Conclusão"
                : docDialog?.tipo === "RELATORIO_VISTORIA"
                  ? "Relatório de Vistoria"
                  : "Ordem de Serviço"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do responsável, colete a assinatura na tela e confirme para salvar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Nome completo responsável *</Label>
                <Input
                  placeholder="Digite o nome completo"
                  value={responsavelNome}
                  onChange={(e) => setResponsavelNome(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>CPF do responsável (opcional)</Label>
                <Input
                  placeholder="Apenas números"
                  value={responsavelCpf}
                  maxLength={11}
                  inputMode="numeric"
                  pattern="\d{11}"
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 11)
                    setResponsavelCpf(digits)
                  }}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-4 w-4 text-blue-500" />
              <span>
                Localização: {geoStatus === "loading" ? "Capturando..." : docLocation || "Não informada"}
              </span>
              {geoStatus === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            </div>

            {docDialog?.tipo === "RELATORIO_VISTORIA" ? (
              <div>
                <Label>Observação</Label>
                <Textarea
                  value={observacaoRelatorio}
                  onChange={(e) => setObservacaoRelatorio(e.target.value)}
                  placeholder="Observações adicionais do relatório (opcional)"
                  className="mt-1 min-h-[80px]"
                />
              </div>
            ) : null}

            {docDialog?.tipo === "ORDEM_SERVICO" ? (
              <div>
                <Label>Detalhamento *(vai aparecer no documento de O.S)</Label>
                <Textarea
                  value={detalhamentoOs}
                  onChange={(e) => setDetalhamentoOs(e.target.value)}
                  placeholder="Descreva o detalhamento da ordem de serviço"
                  className="mt-1 min-h-[100px]"
                />
              </div>
            ) : null}

            {docDialog?.tipo === "TERMO_CONCLUSAO" ? (
              <div className="space-y-3">
                <div>
                  <Label>Tipo do serviço *</Label>
                  <Select
                    value={tipoServico}
                    onValueChange={(value) => {
                      setTipoServico(value)
                      const opt = TIPO_SERVICO_OPCOES.find((o) => o.value === value)
                      if (!opt?.precisaDescidas) setDescidasAterramento("")
                    }}
                  >
                    <SelectTrigger className="mt-1 min-h-[60px]">
                      <SelectValue placeholder="Selecione o tipo de serviço" />
                    </SelectTrigger>
                    <SelectContent className="max-w-[320px] sm:max-w-xs">
                      {TIPO_SERVICO_OPCOES.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="max-w-[280px] whitespace-normal leading-snug text-sm break-words">
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {precisaDescidas ? (
                  <div>
                    <Label>Número de descidas de aterramento *</Label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={descidasAterramento}
                      onChange={(e) => setDescidasAterramento(e.target.value)}
                      placeholder="Ex: 4"
                      className="mt-1"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <PenTool className="h-4 w-4 text-blue-600" />
                <p className="font-semibold text-sm">Assinatura do responsável</p>
              </div>
              <div className="space-y-2 rounded-lg border border-dashed border-slate-300 p-3 bg-slate-50/40">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-700">Assinatura na tela *</p>
                  {assinaturaResponsavel ? (
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                      Assinada
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                      Pendente
                    </Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setModalAssinaturaResponsavel(true)}
                >
                  {assinaturaResponsavel ? "Refazer assinatura" : "Assinar"}
                </Button>
                {!assinaturaResponsavel ? (
                  <p className="text-xs text-muted-foreground">Colete a assinatura antes de salvar o documento.</p>
                ) : null}
              </div>

            </div>

            {/* Assinatura do técnico obrigatória para TERMO_CONCLUSAO, RELATORIO_VISTORIA e ORDEM_SERVICO */}
            {(docDialog?.tipo === "TERMO_CONCLUSAO" ||
              docDialog?.tipo === "RELATORIO_VISTORIA" ||
              docDialog?.tipo === "ORDEM_SERVICO") ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <PenTool className="h-4 w-4 text-emerald-600" />
                  <p className="font-semibold text-sm">Assinatura do técnico</p>
                  <Badge variant="outline">
                    {visita.tecnico?.nome ?? "Técnico"}
                  </Badge>
                </div>
                <div className="space-y-2 rounded-lg border border-dashed border-slate-300 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-700">Assinatura do técnico *</p>
                    {assinaturaTecnico ? (
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                        Assinada
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                        Pendente
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setModalAssinaturaTecnico(true)}
                  >
                    {assinaturaTecnico ? "Refazer assinatura" : "Assinar"}
                  </Button>
                  {!assinaturaTecnico ? (
                    <p className="text-xs text-muted-foreground">Colete a assinatura do técnico antes de concluir.</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={closeDocDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitDocumento} disabled={!canSubmitDocumento}>
              {docActionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar documento"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar finalização</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Tem certeza que deseja finalizar esta visita?</p>
              {itensTroca.length > 0 ? (
                <p className="text-sm text-amber-600">
                  Há itens adicionais solicitados ({itensTroca.length}); uma lista extra será enviada para aprovação.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum item extra selecionado. O pedido seguirá para aprovação da supervisão.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={finalizing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmFinalize} disabled={finalizing}>
              {finalizing ? "Finalizando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {!shouldHideChecklist && (
        <AlertDialog open={confirmSaveChecklist} onOpenChange={setConfirmSaveChecklist}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Salvar checklist?</AlertDialogTitle>
              <AlertDialogDescription>
                O checklist será salvo e ficará bloqueado para edição nesta visita. Deseja continuar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={savingChecklist} onClick={() => setConfirmSaveChecklist(false)}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={savingChecklist}
                onClick={() => {
                  setConfirmSaveChecklist(false)
                  handleSaveChecklist()
                }}
              >
                {savingChecklist ? "Salvando..." : "Salvar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <Dialog open={adjustQuantitiesOpen} onOpenChange={setAdjustQuantitiesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">A quantidade de para-raios é {visita?.cliente.quantidadeSPDA || 0}</DialogTitle>
            <DialogDescription className="text-sm">
              Verifique se algum dos serviços abaixo necessita alterar a quantidade para condizer com o condomínio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {quantitiesToAdjust.map((item, idx) => (
              <div key={item.itemId} className="flex items-center justify-between gap-4 p-3 border rounded-lg bg-slate-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" title={item.nome}>{item.nome}</p>
                  <p className="text-xs text-muted-foreground">Quantidade atual: {item.quantidade}</p>
                </div>

                <div className="flex items-center gap-2">
                  {item.editing ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        className="w-16 h-8 text-center px-1"
                        value={item.quantidade}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0
                          setQuantitiesToAdjust(prev => prev.map((q, i) => i === idx ? { ...q, quantidade: val } : q))
                        }}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-green-600"
                        onClick={() => setQuantitiesToAdjust(prev => prev.map((q, i) => i === idx ? { ...q, editing: false } : q))}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5"
                      onClick={() => setQuantitiesToAdjust(prev => prev.map((q, i) => i === idx ? { ...q, editing: true } : q))}
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setAdjustQuantitiesOpen(false)} disabled={isSavingQuantities}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveQuantities}
              disabled={isSavingQuantities || quantitiesToAdjust.some(q => q.editing)}
              className="bg-blue-600 hover:bg-blue-700 font-bold"
            >
              {isSavingQuantities ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para adicionar fotos */}
      <Dialog open={anexosDialogOpen} onOpenChange={setAnexosDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-blue-600" />
              Adicionar fotos
            </DialogTitle>
            <DialogDescription>Selecione fotos para anexar a esta visita.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
              <Plus className="h-4 w-4 mr-1" /> Selecionar fotos
            </Button>
            {pendingFiles.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Fotos selecionadas (clique para pré-visualizar):</p>
                <div className="flex flex-wrap gap-2">
                  {pendingFiles.map((file, idx) => (
                    <div key={idx} className="relative group">
                      <button
                        type="button"
                        onClick={() => setPreviewImage(URL.createObjectURL(file))}
                        className="h-16 w-16 rounded-lg border bg-slate-50 overflow-hidden"
                      >
                        <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removePendingFile(idx)}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnexosDialogOpen(false)}>Cancelar</Button>
            <Button onClick={async () => { await uploadPendingFiles(); setAnexosDialogOpen(false) }} disabled={uploadingAnexo || pendingFiles.length === 0}>
              {uploadingAnexo ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Salvar fotos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview da imagem */}
      <Dialog open={Boolean(previewImage)} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">Pré-visualização</DialogTitle>
          {previewImage && (
            <img src={previewImage} alt="Preview" className="w-full h-auto rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
