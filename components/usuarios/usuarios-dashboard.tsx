"use client"

import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import {
  Users,
  UserPlus,
  Search,
  Shield,
  ShieldCheck,
  Mail,
  Pencil,
  UserX,
  UserCheck,
  Loader2,
  Eye,
  EyeOff,
  Crown,
  Briefcase,
  Wrench,
  HeadphonesIcon,
  Bot,
  DollarSign,
  ClipboardList,
  CheckCircle,
  XCircle,
  Calendar,
  Trash2,
  BadgeDollarSign,
  RotateCcw,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClienteDetailDialog } from "@/components/leads/cliente-detail-dialog"
import { PedidoDetailsDialog } from "@/components/leads/pedido-details-dialog"

type Role =
  | "MASTER"
  | "ADMINISTRADOR"
  | "SUPERVISOR"
  | "VENDEDOR"
  | "PESQUISADOR"
  | "TECNICO"
  | "FINANCEIRO"
  | "SAC"
  | "CHATBOT"

type UserDto = {
  id: string
  name: string
  fullname: string | null
  email: string
  role: Role
  active: boolean
  createdAt: string
  updatedAt: string
}

type UserDadosCadastrais = {
  id: number
  idUser: string
  cpf: string
  cep: string
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  telefone: string | null
  celular: string | null
  banco: string | null
  agencia: string | null
  conta: string | null
  metaMin: number | null
  metaMinPerc: number | null
  metaNormal: number | null
  metaNormalPerc: number | null
  observacao: string | null
  salario: number | null
}

type UserLancamento = {
  id: number
  userId: string
  data: string
  descricao: string
  valor: number | null
  tipo: string
}

const roleConfig: Record<
  Role,
  { label: string; icon: React.ElementType; color: string; bgColor: string; borderColor: string }
> = {
  MASTER: {
    label: "Master",
    icon: Crown,
    color: "text-amber-600",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
  },
  ADMINISTRADOR: {
    label: "Administrador",
    icon: ShieldCheck,
    color: "text-purple-600",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
  },
  SUPERVISOR: {
    label: "Supervisor",
    icon: Shield,
    color: "text-blue-600",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
  VENDEDOR: {
    label: "Vendedor",
    icon: Briefcase,
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
  },
  PESQUISADOR: {
    label: "Pesquisador",
    icon: ClipboardList,
    color: "text-cyan-600",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30",
  },
  TECNICO: {
    label: "Técnico",
    icon: Wrench,
    color: "text-orange-600",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
  },
  FINANCEIRO: {
    label: "Financeiro",
    icon: DollarSign,
    color: "text-green-600",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
  },
  SAC: {
    label: "SAC",
    icon: HeadphonesIcon,
    color: "text-pink-600",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/30",
  },
  CHATBOT: {
    label: "Chatbot",
    icon: Bot,
    color: "text-muted-foreground",
    bgColor: "bg-secondary0/10",
    borderColor: "border-slate-500/30",
  },
}

const formatDate = (value: string) => {
  if (!value) return "—"
  const date = new Date(value)
  if (isNaN(date.getTime())) return "—"
  // Para evitar que o fuso horário mude o dia (ex: 20/03 vira 19/03),
  // usamos explicitamente o fuso de Brasília para a leitura
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo"
  })
}

// Função específica para campos que são "apenas data" (sem hora relevante)
// Se a data no banco for 00:00 UTC, ela vira 21:00 do dia anterior em local time.
const formatDateLocal = (value: string | Date) => {
  if (!value) return "—"
  const date = typeof value === "string" ? new Date(value) : value
  if (isNaN(date.getTime())) return "—"

  // Se a hora for zero, é provável que seja uma "data pura" vinda do banco como UTC 00:00
  // Nesse caso, o toLocaleDateString local (Brasil -3) vai subtrair 3 horas e mudar o dia.
  // Forçamos a exibição do que está no banco ignorando o deslocamento se for 00:00.
  const isMidnight = date.getUTCHours() === 0 && date.getUTCMinutes() === 0

  return date.toLocaleDateString("pt-BR", {
    timeZone: isMidnight ? "UTC" : "America/Sao_Paulo"
  })
}

export function UsuariosDashboard() {
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role
  const isMasterAdmin = userRole === "MASTER" || userRole === "ADMINISTRADOR" || userRole === "FINANCEIRO"
  const canEditComissoes = userRole === "MASTER" || userRole === "FINANCEIRO"

  const { toast } = useToast()
  const [usuarios, setUsuarios] = useState<UserDto[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterRole, setFilterRole] = useState<Role | "ALL">("ALL")
  const [filterActive, setFilterActive] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ACTIVE")
  const [novoDialogOpen, setNovoDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserDto | null>(null)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [confirmToggleUser, setConfirmToggleUser] = useState<UserDto | null>(null)
  const [toggling, setToggling] = useState(false)

  // Form fields
  const [formName, setFormName] = useState("")
  const [formFullname, setFormFullname] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formRole, setFormRole] = useState<Role>("VENDEDOR")
  const [formPassword, setFormPassword] = useState("")
  const [dadosCad, setDadosCad] = useState<UserDadosCadastrais | null>(null)
  const [dadosCadLoading, setDadosCadLoading] = useState(false)
  const [dadosCadSaving, setDadosCadSaving] = useState(false)
  const [dadosCadDirty, setDadosCadDirty] = useState(false)
  const [lancamentos, setLancamentos] = useState<UserLancamento[]>([])
  const [lancLoading, setLancLoading] = useState(false)
  const [lancSaving, setLancSaving] = useState(false)
  const [lancDeleting, setLancDeleting] = useState<number | null>(null)
  const [lancTipo, setLancTipo] = useState<"Despesa" | "Receita">("Despesa")
  const [lancData, setLancData] = useState("")
  const [lancDescricao, setLancDescricao] = useState("")
  const [lancValor, setLancValor] = useState("")
  const [lancDialogOpen, setLancDialogOpen] = useState(false)
  const [confirmDeleteLanc, setConfirmDeleteLanc] = useState<{ id: number; descricao: string } | null>(null)
  const [folhaMonth, setFolhaMonth] = useState(String(new Date().getMonth() + 1))
  const [folhaYear, setFolhaYear] = useState(String(new Date().getFullYear()))
  const [folhaData, setFolhaData] = useState<{
    user: { nome: string }
    comissoes: Array<{ id: number; valor: number; cliente: string; clienteId: number; pedidoId: number }>
    lancamentos: Array<{ id: number; descricao: string; valor: number; tipo: string }>
  } | null>(null)
  const [folhaLoading, setFolhaLoading] = useState(false)
  const [comissoes, setComissoes] = useState<any[]>([])
  const [comissoesLoading, setComissoesLoading] = useState(false)
  const [togglingComissao, setTogglingComissao] = useState<number | null>(null)
  const [comissoesPage, setComissoesPage] = useState(1)
  const [comissoesTotalPages, setComissoesTotalPages] = useState(1)
  const [clienteDetailId, setClienteDetailId] = useState<number | null>(null)
  const [pedidoDetailId, setPedidoDetailId] = useState<number | null>(null)
  const [pedidoDetailClienteNome, setPedidoDetailClienteNome] = useState<string | undefined>(undefined)
  // Comissão CRUD (apenas MASTER/FINANCEIRO)
  const [editComissaoOpen, setEditComissaoOpen] = useState(false)
  const [editComissaoTarget, setEditComissaoTarget] = useState<any | null>(null)
  const [editComissaoValor, setEditComissaoValor] = useState("")
  const [editComissaoVencimento, setEditComissaoVencimento] = useState("")
  const [savingComissao, setSavingComissao] = useState(false)
  const [deleteComissaoTarget, setDeleteComissaoTarget] = useState<any | null>(null)
  const [deletingComissao, setDeletingComissao] = useState(false)
  const [novaComissaoOpen, setNovaComissaoOpen] = useState(false)
  const [novaComissaoPedidoId, setNovaComissaoPedidoId] = useState("")
  const [novaComissaoValor, setNovaComissaoValor] = useState("")
  const [novaComissaoVencimento, setNovaComissaoVencimento] = useState("")
  const [creatingComissao, setCreatingComissao] = useState(false)


  const fetchUsuarios = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/usuarios")
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || "Erro ao carregar usuários.")
      setUsuarios(payload.data ?? [])
    } catch (error) {
      toast({
        title: "Erro ao carregar usuários",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchUsuarios().catch(console.error)
  }, [fetchUsuarios])

  const resetForm = () => {
    setFormName("")
    setFormFullname("")
    setFormEmail("")
    setFormRole("VENDEDOR")
    setFormPassword("")
    setShowPassword(false)
    setDadosCad(null)
    setDadosCadDirty(false)
    setLancamentos([])
    setLancTipo("Despesa")
    setLancData("")
    setLancDescricao("")
    setLancValor("")
  }

  const openNovoDialog = () => {
    resetForm()
    setNovoDialogOpen(true)
  }

  const openEditDialog = (user: UserDto) => {
    setEditUser(user)
    setFormName(user.name)
    setFormFullname(user.fullname || "")
    setFormEmail(user.email)
    setFormRole(user.role)
    setFormPassword("")
    setShowPassword(false)
    loadDadosCadastrais(user.id).catch(console.error)
    loadLancamentos(user.id).catch(console.error)
    fetchFolha(user.id, folhaMonth, folhaYear).catch(console.error)
    fetchComissoes(user.id).catch(console.error)
    setEditDialogOpen(true)
  }

  const loadDadosCadastrais = async (userId: string) => {
    setDadosCadLoading(true)
    try {
      const res = await fetch(`/api/usuarios/${userId}/dados-cadastrais`)
      if (res.status === 404) {
        setDadosCad(null)
        setDadosCadDirty(false)
        return
      }
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || "Erro ao carregar dados cadastrais.")
      setDadosCad(payload.data ?? null)
      setDadosCadDirty(false)
    } catch (error) {
      toast({
        title: "Erro ao carregar dados cadastrais",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setDadosCadLoading(false)
    }
  }

  const loadLancamentos = async (userId: string) => {
    setLancLoading(true)
    try {
      const res = await fetch(`/api/usuarios/${userId}/lancamentos`)
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.error || "Erro ao carregar lançamentos.")
      }
      const payload = await res.json()
      setLancamentos(payload.data ?? [])
    } catch (error) {
      toast({
        title: "Erro ao carregar lançamentos",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setLancLoading(false)
    }
  }

  const fetchFolha = useCallback(
    async (userId: string, targetMonth: string, targetYear: string) => {
      setFolhaLoading(true)
      try {
        const res = await fetch(`/api/usuarios/${userId}/folha?mes=${targetMonth}&ano=${targetYear}`)
        const payload = await res.json()
        if (!res.ok) throw new Error(payload?.error || "Erro ao carregar folha.")
        setFolhaData(payload.data)
      } catch (error) {
        toast({
          title: "Erro ao carregar folha",
          description: error instanceof Error ? error.message : "Tente novamente.",
          variant: "destructive",
        })
      } finally {
        setFolhaLoading(false)
      }
    },
    [toast]
  )

  const fetchComissoes = useCallback(async (userId: string, targetPage: number = 1) => {
    setComissoesLoading(true)
    try {
      const res = await fetch(`/api/usuarios/${userId}/comissoes?page=${targetPage}&limit=100`)
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || "Erro ao carregar comissões.")
      setComissoes(payload.data ?? [])
      setComissoesPage(payload.pagination?.page || 1)
      setComissoesTotalPages(payload.pagination?.pages || 1)
    } catch (error) {
      toast({
        title: "Erro ao carregar comissões",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setComissoesLoading(false)
    }
  }, [toast])

  const toggleComissaoStatus = async (item: any) => {
    if (!item.contaPagarId) {
      toast({
        title: "Operação não permitida",
        description: "Essa comissão não possui um registro vinculado no financeiro.",
        variant: "destructive",
      })
      return
    }

    setTogglingComissao(item.id)
    try {
      const newStatus = item.status === 1 ? 0 : 1
      const res = await fetch(`/api/financeiro/contas-pagar/${item.contaPagarId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          pagoEm: newStatus === 1 ? new Date().toISOString() : null
        })
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.error || "Erro ao atualizar status.")
      }

      toast({
        title: newStatus === 1 ? "Comissão Paga" : "Pagamento Estornado",
        description: "Status atualizado com sucesso.",
        className: "bg-emerald-50 border-emerald-200 text-emerald-800"
      })

      if (editUser) {
        fetchComissoes(editUser.id, comissoesPage)
        fetchFolha(editUser.id, folhaMonth, folhaYear)
      }
    } catch (error) {
      toast({
        title: "Erro ao atualizar status",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setTogglingComissao(null)
    }
  }

  // ── Comissão CRUD ────────────────────────────────────────────────────────────
  const handleEditComissao = (c: any) => {
    setEditComissaoTarget(c)
    setEditComissaoValor(String(c.valorComissao))
    setEditComissaoVencimento(c.vencimento ? c.vencimento.slice(0, 10) : "")
    setEditComissaoOpen(true)
  }

  const handleSaveEditComissao = async () => {
    if (!editComissaoTarget) return
    setSavingComissao(true)
    try {
      const res = await fetch(`/api/financeiro/comissoes/${editComissaoTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          valor: Number(editComissaoValor.replace(",", ".")),
          vencimento: editComissaoVencimento,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || "Erro ao salvar")
      toast({ description: "Comissão atualizada." })
      setEditComissaoOpen(false)
      if (editUser) fetchComissoes(editUser.id, comissoesPage)
    } catch (error) {
      toast({ title: "Erro", description: error instanceof Error ? error.message : "Erro desconhecido", variant: "destructive" })
    } finally {
      setSavingComissao(false)
    }
  }

  const handleDeleteComissao = async () => {
    if (!deleteComissaoTarget) return
    setDeletingComissao(true)
    try {
      const res = await fetch(`/api/financeiro/comissoes/${deleteComissaoTarget.id}`, { method: "DELETE" })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || "Erro ao apagar")
      toast({ description: "Comissão apagada." })
      setDeleteComissaoTarget(null)
      if (editUser) fetchComissoes(editUser.id, comissoesPage)
    } catch (error) {
      toast({ title: "Erro", description: error instanceof Error ? error.message : "Erro desconhecido", variant: "destructive" })
    } finally {
      setDeletingComissao(false)
    }
  }

  const handleCreateComissao = async () => {
    if (!novaComissaoPedidoId || !novaComissaoValor || !novaComissaoVencimento) {
      toast({ title: "Preencha todos os campos", variant: "destructive" })
      return
    }
    setCreatingComissao(true)
    try {
      const res = await fetch("/api/financeiro/comissoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedidoId: Number(novaComissaoPedidoId),
          valor: Number(novaComissaoValor.replace(",", ".")),
          vencimento: novaComissaoVencimento,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || "Erro ao criar")
      toast({ description: "Comissão criada com sucesso." })
      setNovaComissaoOpen(false)
      setNovaComissaoPedidoId("")
      setNovaComissaoValor("")
      setNovaComissaoVencimento("")
      if (editUser) fetchComissoes(editUser.id, comissoesPage)
    } catch (error) {
      toast({ title: "Erro", description: error instanceof Error ? error.message : "Erro desconhecido", variant: "destructive" })
    } finally {
      setCreatingComissao(false)
    }
  }

  const handleCriarUsuario = async () => {
    if (!formName.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" })
      return
    }
    if (!formEmail.trim()) {
      toast({ title: "Email é obrigatório", variant: "destructive" })
      return
    }
    if (!formPassword.trim()) {
      toast({ title: "Senha é obrigatória para novo usuário", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          fullname: formFullname.trim() || null,
          email: formEmail.trim().toLowerCase(),
          role: formRole,
          password: formPassword,
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || "Erro ao criar usuário.")
      toast({ description: "Usuário criado com sucesso!" })
      setNovoDialogOpen(false)
      resetForm()
      fetchUsuarios().catch(console.error)
    } catch (error) {
      toast({
        title: "Erro ao criar usuário",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleAtualizarUsuario = async () => {
    if (!editUser) return
    if (!formName.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" })
      return
    }
    if (!formEmail.trim()) {
      toast({ title: "Email é obrigatório", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/usuarios/${editUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          fullname: formFullname.trim() || null,
          email: formEmail.trim().toLowerCase(),
          role: formRole,
          password: formPassword.trim() || undefined,
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || "Erro ao atualizar usuário.")
      toast({ description: "Usuário atualizado com sucesso!" })
      setEditDialogOpen(false)
      setEditUser(null)
      resetForm()
      fetchUsuarios().catch(console.error)
    } catch (error) {
      toast({
        title: "Erro ao atualizar usuário",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSalvarDadosCadastrais = async () => {
    if (!editUser) return
    setDadosCadSaving(true)
    try {
      const body = {
        cpf: (dadosCad?.cpf ?? "").replace(/\D/g, ""),
        cep: dadosCad?.cep ?? "",
        logradouro: dadosCad?.logradouro ?? null,
        numero: dadosCad?.numero ?? null,
        complemento: dadosCad?.complemento ?? null,
        bairro: dadosCad?.bairro ?? null,
        cidade: dadosCad?.cidade ?? null,
        estado: dadosCad?.estado ?? null,
        telefone: dadosCad?.telefone ?? null,
        celular: dadosCad?.celular ?? null,
        banco: dadosCad?.banco ?? null,
        agencia: dadosCad?.agencia ?? null,
        conta: dadosCad?.conta ?? null,
        metaMin: dadosCad?.metaMin ?? null,
        metaMinPerc: dadosCad?.metaMinPerc ?? null,
        metaNormal: dadosCad?.metaNormal ?? null,
        metaNormalPerc: dadosCad?.metaNormalPerc ?? null,
        observacao: dadosCad?.observacao ?? null,
        salario: dadosCad?.salario ?? null,
      }

      const res = await fetch(`/api/usuarios/${editUser.id}/dados-cadastrais`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || "Erro ao salvar dados cadastrais.")
      toast({ description: "Dados cadastrais salvos com sucesso!" })
      setDadosCad(payload.data ?? null)
      setDadosCadDirty(false)
    } catch (error) {
      toast({
        title: "Erro ao salvar dados cadastrais",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setDadosCadSaving(false)
    }
  }

  const updateDadosCadField = (field: keyof UserDadosCadastrais, value: any) => {
    setDadosCad((prev) => {
      const next = { ...(prev ?? { id: 0, idUser: editUser?.id ?? "" } as UserDadosCadastrais), [field]: value }
      setDadosCadDirty(true)
      return next
    })
  }

  const handleCriarLancamento = async () => {
    if (!editUser) return
    if (!lancData || !lancDescricao.trim() || !lancValor.trim()) {
      toast({ title: "Preencha tipo, data, descrição e valor", variant: "destructive" })
      return
    }
    const valorNum = Number(lancValor.replace(",", "."))
    if (!Number.isFinite(valorNum)) {
      toast({ title: "Valor inválido", variant: "destructive" })
      return
    }
    setLancSaving(true)
    try {
      const res = await fetch(`/api/usuarios/${editUser.id}/lancamentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: lancTipo,
          data: lancData,
          descricao: lancDescricao.trim(),
          valor: valorNum,
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || "Erro ao criar lançamento.")
      toast({ description: "Lançamento criado com sucesso!" })
      setLancTipo("Despesa")
      setLancData("")
      setLancDescricao("")
      setLancValor("")
      setLancDialogOpen(false)
      loadLancamentos(editUser.id).catch(console.error)
    } catch (error) {
      toast({
        title: "Erro ao criar lançamento",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setLancSaving(false)
    }
  }

  const handleDeleteLancamento = async (idLanc: number) => {
    if (!editUser) return
    setLancDeleting(idLanc)
    try {
      const res = await fetch(`/api/usuarios/${editUser.id}/lancamentos/${idLanc}`, {
        method: "DELETE",
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || "Erro ao remover lançamento.")
      toast({ description: "Lançamento removido." })
      setLancamentos((prev) => prev.filter((l) => l.id !== idLanc))
    } catch (error) {
      toast({
        title: "Erro ao remover lançamento",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setLancDeleting(null)
    }
  }

  const handleConfirmToggleActive = async () => {
    if (!confirmToggleUser) return
    setToggling(true)
    try {
      let res: Response
      if (confirmToggleUser.active) {
        // Desativar: usar DELETE (que faz o cleanup de vendedor automaticamente)
        res = await fetch(`/api/usuarios/${confirmToggleUser.id}`, {
          method: "DELETE",
        })
      } else {
        // Ativar: usar PUT
        res = await fetch(`/api/usuarios/${confirmToggleUser.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: true }),
        })
      }
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || "Erro ao alterar status.")
      toast({
        description: confirmToggleUser.active ? "Usuário desativado" : "Usuário ativado",
      })
      setConfirmToggleUser(null)
      fetchUsuarios().catch(console.error)
    } catch (error) {
      toast({
        title: "Erro ao alterar status",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setToggling(false)
    }
  }

  // Filtros
  const filteredUsuarios = usuarios
    .filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.fullname && u.fullname.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesRole = filterRole === "ALL" || u.role === filterRole

      const matchesActive =
        filterActive === "ALL" ||
        (filterActive === "ACTIVE" && u.active) ||
        (filterActive === "INACTIVE" && !u.active)

      return matchesSearch && matchesRole && matchesActive
    })
    .sort((a, b) => {
      const roleOrder: Role[] = [
        "MASTER",
        "ADMINISTRADOR",
        "FINANCEIRO",
        "SUPERVISOR",
        "SAC",
        "VENDEDOR",
        "PESQUISADOR",
        "TECNICO",
        "CHATBOT",
      ]
      const indexA = roleOrder.indexOf(a.role)
      const indexB = roleOrder.indexOf(b.role)
      if (indexA !== indexB) return indexA - indexB
      return a.name.localeCompare(b.name)
    })

  // Stats
  const totalAtivos = usuarios.filter((u) => u.active).length
  const totalInativos = usuarios.filter((u) => !u.active).length
  const roleStats = usuarios.reduce(
    (acc, u) => {
      acc[u.role] = (acc[u.role] || 0) + 1
      return acc
    },
    {} as Record<Role, number>
  )

  const renderRoleBadge = (role: Role) => {
    const config = roleConfig[role]
    const Icon = config.icon
    return (
      <Badge
        className={`${config.bgColor} ${config.color} ${config.borderColor} border font-medium gap-1.5 px-2.5 py-1`}
      >
        <Icon className="h-3.5 w-3.5" />
        {config.label}
      </Badge>
    )
  }

  const renderFormFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Nome de usuário *</Label>
          <Input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Ex: joao.silva"
            className="border-border"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Nome completo</Label>
          <Input
            value={formFullname}
            onChange={(e) => setFormFullname(e.target.value)}
            placeholder="Ex: João da Silva Santos"
            className="border-border"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Email *</Label>
          <Input
            type="email"
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
            placeholder="joao@empresa.com.br"
            className="border-border"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Função *</Label>
          <Select value={formRole} onValueChange={(v) => setFormRole(v as Role)}>
            <SelectTrigger className="border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(roleConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <config.icon className={`h-4 w-4 ${config.color}`} />
                    {config.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Senha {editUser ? "(deixe vazio para manter)" : "*"}
          </Label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              placeholder={editUser ? "Nova senha (opcional)" : "Senha do usuário"}
              className="border-border pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1 h-7 w-7 p-0"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>
      </div>

    </div>
  )

  const renderDadosCadastraisForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">CPF</Label>
          <Input
            value={dadosCad?.cpf ?? ""}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 11)
              const formatted = digits
                .replace(/(\d{3})(\d)/, "$1.$2")
                .replace(/(\d{3})(\d)/, "$1.$2")
                .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
              updateDadosCadField("cpf", formatted)
            }}
            placeholder="000.000.000-00"
            className="border-border font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">CEP</Label>
          <Input
            value={dadosCad?.cep ?? ""}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 8)
              const formatted = digits.replace(/(\d{5})(\d)/, "$1-$2")
              updateDadosCadField("cep", formatted)
            }}
            placeholder="00000-000"
            className="border-border font-mono"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Logradouro</Label>
          <Input
            value={dadosCad?.logradouro ?? ""}
            onChange={(e) => updateDadosCadField("logradouro", e.target.value)}
            placeholder="Rua, avenida..."
            className="border-border"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Número</Label>
          <Input
            value={dadosCad?.numero ?? ""}
            onChange={(e) => updateDadosCadField("numero", e.target.value)}
            placeholder="123"
            className="border-border"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Complemento</Label>
          <Input
            value={dadosCad?.complemento ?? ""}
            onChange={(e) => updateDadosCadField("complemento", e.target.value)}
            placeholder="Apto, bloco..."
            className="border-border"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Bairro</Label>
          <Input
            value={dadosCad?.bairro ?? ""}
            onChange={(e) => updateDadosCadField("bairro", e.target.value)}
            placeholder="Bairro"
            className="border-border"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Cidade</Label>
          <Input
            value={dadosCad?.cidade ?? ""}
            onChange={(e) => updateDadosCadField("cidade", e.target.value)}
            placeholder="Cidade"
            className="border-border"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Estado</Label>
          <Input
            value={dadosCad?.estado ?? ""}
            onChange={(e) => updateDadosCadField("estado", e.target.value.toUpperCase().slice(0, 2))}
            placeholder="UF"
            className="border-border"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Telefone</Label>
          <Input
            value={dadosCad?.telefone ?? ""}
            onChange={(e) => updateDadosCadField("telefone", e.target.value)}
            placeholder="Telefone"
            className="border-border"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Celular</Label>
          <Input
            value={dadosCad?.celular ?? ""}
            onChange={(e) => updateDadosCadField("celular", e.target.value)}
            placeholder="Celular"
            className="border-border"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Banco</Label>
          <Input
            value={dadosCad?.banco ?? ""}
            onChange={(e) => updateDadosCadField("banco", e.target.value)}
            placeholder="Banco"
            className="border-border"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Agência</Label>
          <Input
            value={dadosCad?.agencia ?? ""}
            onChange={(e) => updateDadosCadField("agencia", e.target.value)}
            placeholder="0000"
            className="border-border"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Conta</Label>
          <Input
            value={dadosCad?.conta ?? ""}
            onChange={(e) => updateDadosCadField("conta", e.target.value)}
            placeholder="00000-0"
            className="border-border"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Observação</Label>
          <Input
            value={dadosCad?.observacao ?? ""}
            onChange={(e) => updateDadosCadField("observacao", e.target.value)}
            placeholder="Notas adicionais"
            className="border-border"
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Meta mínima</Label>
          <Input
            type="number"
            value={dadosCad?.metaMin ?? ""}
            onChange={(e) => updateDadosCadField("metaMin", e.target.value === "" ? null : Number(e.target.value))}
            placeholder="0"
            className="border-border"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Comissão Meta Mín. (%)</Label>
          <Input
            type="number"
            value={dadosCad?.metaMinPerc ?? ""}
            onChange={(e) =>
              updateDadosCadField("metaMinPerc", e.target.value === "" ? null : Number(e.target.value))
            }
            placeholder="0"
            className="border-border"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Meta normal</Label>
          <Input
            type="number"
            value={dadosCad?.metaNormal ?? ""}
            onChange={(e) => updateDadosCadField("metaNormal", e.target.value === "" ? null : Number(e.target.value))}
            placeholder="0"
            className="border-border"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Comissão normal (%)</Label>
          <Input
            type="number"
            value={dadosCad?.metaNormalPerc ?? ""}
            onChange={(e) =>
              updateDadosCadField("metaNormalPerc", e.target.value === "" ? null : Number(e.target.value))
            }
            placeholder="0"
            className="border-border"
          />
        </div>
        <div className="space-y-2 col-span-4 md:col-span-1">
          <Label className="text-sm font-medium">Salário</Label>
          <Input
            type="number"
            step="0.01"
            value={dadosCad?.salario ?? ""}
            onChange={(e) => updateDadosCadField("salario", e.target.value === "" ? null : Number(e.target.value))}
            placeholder="0,00"
            className="border-border"
          />
        </div>
      </div>
    </div>
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-600" />
              Gestão de Pessoas
            </h1>
            <p className="text-muted-foreground mt-1">
              Controle de acessos, permissões e funções do sistema
            </p>
          </div>
          {isMasterAdmin && (
            <Button onClick={openNovoDialog} className="bg-blue-600 hover:bg-blue-700">
              <UserPlus className="mr-2 h-4 w-4" />
              Novo Usuário
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Usuários
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{usuarios.length}</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Usuários Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{totalAtivos}</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Usuários Inativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{totalInativos}</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Funções Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {Object.keys(roleStats).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Table */}
        <Card className="border-border">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="text-foreground">Lista de Usuários</CardTitle>
                <CardDescription>
                  {filteredUsuarios.length} usuário(s) encontrado(s)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-border"
                />
              </div>
              <Select
                value={filterRole}
                onValueChange={(v) => setFilterRole(v as Role | "ALL")}
              >
                <SelectTrigger className="w-[180px] border-border">
                  <SelectValue placeholder="Filtrar por função" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas as funções</SelectItem>
                  <Separator className="my-1" />
                  {Object.entries(roleConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <config.icon className={`h-4 w-4 ${config.color}`} />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filterActive}
                onValueChange={(v) => setFilterActive(v as "ALL" | "ACTIVE" | "INACTIVE")}
              >
                <SelectTrigger className="w-[160px] border-border">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os status</SelectItem>
                  <SelectItem value="ACTIVE">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      Ativos
                    </div>
                  </SelectItem>
                  <SelectItem value="INACTIVE">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      Inativos
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead className="font-semibold">Usuário</TableHead>
                    <TableHead className="font-semibold">Função</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Criado em</TableHead>
                    <TableHead className="text-right font-semibold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="space-y-1">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-24" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-8 w-20 ml-auto" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredUsuarios.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Users className="h-12 w-12 text-muted-foreground/50" />
                          <p className="font-medium">Nenhum usuário encontrado</p>
                          <p className="text-sm">Tente ajustar os filtros de busca</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsuarios.map((user) => {
                      const config = roleConfig[user.role]
                      return (
                        <TableRow
                          key={user.id}
                          className={`hover:bg-accent/5 ${!user.active ? "opacity-60" : ""}`}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-md ${user.active
                                  ? "bg-gradient-to-br from-blue-500 to-indigo-600"
                                  : "bg-gradient-to-br from-slate-400 to-slate-500"
                                  }`}
                              >
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-foreground">{user.name}</p>
                                <p className="text-xs text-muted-foreground">{user.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{renderRoleBadge(user.role)}</TableCell>
                          <TableCell>
                            <Badge
                              className={`font-medium ${user.active
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                : "bg-red-500/10 text-red-600 border-red-500/30"
                                } border`}
                            >
                              {user.active ? (
                                <>
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Ativo
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Inativo
                                </>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDate(user.createdAt)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(user)}
                                className="hover:bg-blue-500/10 hover:text-blue-600"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {isMasterAdmin && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setConfirmToggleUser(user)}
                                  className={
                                    user.active
                                      ? "hover:bg-red-500/10 hover:text-red-600"
                                      : "hover:bg-emerald-500/10 hover:text-emerald-600"
                                  }
                                >
                                  {user.active ? (
                                    <UserX className="h-4 w-4" />
                                  ) : (
                                    <UserCheck className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog Novo Usuário */}
      <Dialog open={novoDialogOpen} onOpenChange={setNovoDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <UserPlus className="h-5 w-5 text-blue-600" />
              Novo Usuário
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do novo usuário. Os campos marcados com * são obrigatórios.
            </DialogDescription>
          </DialogHeader>
          {renderFormFields()}
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setNovoDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCriarUsuario}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Usuário"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar Usuário */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Pencil className="h-5 w-5 text-blue-600" />
              Editar Usuário
            </DialogTitle>
            <DialogDescription>
              Atualize os dados do usuário. Deixe a senha em branco para manter a atual.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basicos" className="mt-2">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basicos">Dados básicos</TabsTrigger>
              <TabsTrigger value="cad">Dados cadastrais</TabsTrigger>
              <TabsTrigger value="lanc">Lançamentos</TabsTrigger>
              <TabsTrigger value="comissoes" onClick={() => editUser && fetchComissoes(editUser.id)}>Comissões</TabsTrigger>
              <TabsTrigger value="folha" onClick={() => editUser && fetchFolha(editUser.id, folhaMonth, folhaYear)}>Folha</TabsTrigger>
            </TabsList>
            <TabsContent value="basicos" className="pt-4">
              {renderFormFields()}
              <DialogFooter className="gap-2 mt-6">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancelar
                </Button>
                {isMasterAdmin && (
                  <Button
                    onClick={handleAtualizarUsuario}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar Alterações"
                    )}
                  </Button>
                )}
              </DialogFooter>
            </TabsContent>

            <TabsContent value="cad" className="pt-4 space-y-4">
              {dadosCadLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando dados cadastrais...
                </div>
              ) : (
                renderDadosCadastraisForm()
              )}
              <DialogFooter className="gap-2 mt-6">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleSalvarDadosCadastrais}
                  disabled={dadosCadSaving || !dadosCadDirty}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {dadosCadSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar Dados Cadastrais"
                  )}
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="lanc" className="pt-4 space-y-4">
              <div className="flex justify-end">
                <Button
                  onClick={() => setLancDialogOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Novo lançamento
                </Button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="font-semibold border border-border">Data</TableHead>
                      <TableHead className="font-semibold border border-border">Descrição</TableHead>
                      <TableHead className="font-semibold border border-border">Tipo</TableHead>
                      <TableHead className="font-semibold border border-border">Valor</TableHead>
                      <TableHead className="font-semibold text-right border border-border">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lancLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-6 text-center text-muted-foreground border border-border">
                          <div className="flex items-center justify-center gap-2 text-sm">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Carregando lançamentos...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : lancamentos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-6 text-center text-muted-foreground border border-border">
                          Nenhum lançamento
                        </TableCell>
                      </TableRow>
                    ) : (
                      lancamentos.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="whitespace-nowrap border border-border">
                            {formatDateLocal(l.data)}
                          </TableCell>
                          <TableCell className="border border-border">{l.descricao}</TableCell>
                          <TableCell className="border border-border">
                            <Badge
                              className={
                                l.tipo === "Receita"
                                  ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                                  : "bg-red-500/10 text-red-700 border-red-500/30"
                              }
                            >
                              {l.tipo}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap border border-border">
                            {l.valor !== null && l.valor !== undefined
                              ? l.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right border border-border">
                            <div className="flex justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmDeleteLanc({ id: l.id, descricao: l.descricao })}
                                disabled={lancDeleting === l.id}
                                className="hover:bg-red-500/10 hover:text-red-600"
                              >
                                {lancDeleting === l.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
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
            <TabsContent value="folha" className="pt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3 bg-secondary p-3 rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Mês:</Label>
                  <Select
                    value={folhaMonth}
                    onValueChange={(v) => {
                      setFolhaMonth(v)
                      if (editUser) fetchFolha(editUser.id, v, folhaYear)
                    }}
                  >
                    <SelectTrigger className="w-32 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          {new Date(0, i).toLocaleString("pt-BR", { month: "long" })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Ano:</Label>
                  <Select
                    value={folhaYear}
                    onValueChange={(v) => {
                      setFolhaYear(v)
                      if (editUser) fetchFolha(editUser.id, folhaMonth, v)
                    }}
                  >
                    <SelectTrigger className="w-28 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => {
                        const year = new Date().getFullYear() - 5 + i
                        return (
                          <SelectItem key={year} value={String(year)}>
                            {year}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
                {folhaLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
              </div>

              {folhaLoading && !folhaData ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  Gerando extrato da folha...
                </div>
              ) : folhaData ? (
                <div className="border border-slate-300 rounded-lg overflow-hidden bg-card">
                  <Table className="border-collapse">
                    <TableHeader>
                      <TableRow className="bg-secondary hover:bg-secondary">
                        <TableHead colSpan={3} className="text-center font-bold text-foreground h-12 text-base">
                          {folhaData.user.nome.toUpperCase()} - {new Date(parseInt(folhaYear), parseInt(folhaMonth) - 1).toLocaleString("pt-BR", { month: "long" }).toUpperCase()}/{folhaYear}
                        </TableHead>
                      </TableRow>
                      <TableRow className="bg-secondary hover:bg-secondary">
                        <TableHead className="font-bold border border-slate-300 text-foreground text-center w-20">Pedido</TableHead>
                        <TableHead className="font-bold border border-slate-300 text-foreground">Cliente</TableHead>
                        <TableHead className="font-bold border border-slate-300 text-foreground text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Comissões */}
                      {folhaData.comissoes.map((c) => (
                        <TableRow key={`com-${c.id}`} className="hover:bg-secondary/50">
                          <TableCell className="border border-slate-300 text-center font-medium">
                            <button
                              onClick={() => {
                                setPedidoDetailClienteNome(c.cliente)
                                setPedidoDetailId(c.pedidoId)
                              }}
                              className="text-blue-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                              #{c.pedidoId}
                            </button>
                          </TableCell>
                          <TableCell className="border border-slate-300 pl-4 font-medium">
                            <button
                              onClick={() => setClienteDetailId(c.clienteId)}
                              className="text-blue-600 hover:underline cursor-pointer"
                            >
                              {c.cliente}
                            </button>
                          </TableCell>
                          <TableCell className="text-right border border-slate-300">
                            {c.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-secondary/50">
                        <TableCell colSpan={2} className="font-bold border border-slate-300 text-right"></TableCell>
                        <TableCell className="text-right font-bold border border-slate-300">
                          {folhaData.comissoes.reduce((acc, c) => acc + c.valor, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </TableCell>
                      </TableRow>

                      {/* Lançamentos */}
                      {folhaData.lancamentos.map((l) => (
                        <TableRow key={`lanc-${l.id}`} className="hover:bg-secondary/50">
                          <TableCell className="text-right border border-slate-300 font-medium whitespace-normal break-words py-2" colSpan={2}>
                            {l.descricao}
                          </TableCell>
                          <TableCell className={`text-right border border-slate-300 font-bold ${l.tipo === "Despesa" ? "text-red-600" : "text-emerald-600"}`}>
                            {(l.tipo === "Despesa" ? -l.valor : l.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Total Geral */}
                      <TableRow className="bg-secondary font-bold text-base">
                        <TableCell className="text-right border border-slate-300" colSpan={2}>Valor total</TableCell>
                        <TableCell className="text-right border border-slate-300 underline font-bold">
                          {(
                            folhaData.comissoes.reduce((acc, c) => acc + c.valor, 0) +
                            folhaData.lancamentos.reduce((acc, l) => acc + (l.tipo === "Despesa" ? -l.valor : l.valor), 0)
                          ).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ) : null}


            </TabsContent>

            <TabsContent value="comissoes" className="pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <BadgeDollarSign className="h-5 w-5 text-emerald-600" />
                  Gerenciamento de Comissões
                </h3>
                <div className="flex items-center gap-2">
                  {comissoesLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                  {canEditComissoes && (
                    <Button size="sm" variant="outline" onClick={() => setNovaComissaoOpen(true)} className="gap-1.5">
                      <UserPlus className="h-3.5 w-3.5" />
                      Nova Comissão
                    </Button>
                  )}
                </div>
              </div>

              <div className="border border-border rounded-lg overflow-hidden bg-card">
                <Table>
                  <TableHeader className="bg-secondary">
                    <TableRow>
                      <TableHead className="w-16">ID</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Total Pedido</TableHead>
                      <TableHead className="text-right">Comissão</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      {canEditComissoes && <TableHead className="w-20"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comissoesLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                          Carregando comissões...
                        </TableCell>
                      </TableRow>
                    ) : comissoes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                          Nenhuma comissão encontrada para este vendedor.
                        </TableCell>
                      </TableRow>
                    ) : (
                      comissoes.map((c) => (
                        <TableRow key={c.id} className="hover:bg-secondary/50">
                          <TableCell className="font-medium text-muted-foreground">#{c.id}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatDateLocal(c.vencimento)}</TableCell>
                          <TableCell>
                            <button
                              onClick={() => setClienteDetailId(c.clienteId)}
                              className="text-blue-600 hover:underline font-medium block text-left cursor-pointer"
                            >
                              {c.cliente}
                            </button>
                            <button
                              onClick={() => {
                                setPedidoDetailClienteNome(c.cliente)
                                setPedidoDetailId(c.pedidoId)
                              }}
                              className="text-[10px] text-muted-foreground/60 hover:text-blue-600 hover:underline cursor-pointer"
                            >
                              Pedido #{c.pedidoId}
                            </button>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {c.totalPedido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </TableCell>
                          <TableCell className="text-right font-bold text-emerald-700 whitespace-nowrap">
                            {c.valorComissao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </TableCell>
                          <TableCell className="text-center">
                            <button
                              onClick={() => !togglingComissao && toggleComissaoStatus(c)}
                              disabled={togglingComissao === c.id}
                              className={`transition-all active:scale-95 ${togglingComissao === c.id ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
                              title={c.status === 1 ? "Clique para estornar" : "Clique para pagar"}
                            >
                              {c.status === 1 ? (
                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200 gap-1.5 px-3 py-1">
                                  {togglingComissao === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                                  Pago
                                </Badge>
                              ) : (
                                <Badge className="bg-secondary text-muted-foreground hover:bg-border border-border gap-1.5 px-3 py-1">
                                  {togglingComissao === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />}
                                  A Pagar
                                </Badge>
                              )}
                            </button>
                          </TableCell>
                          {canEditComissoes && (
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleEditComissao(c)}
                                  title="Editar comissão"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-500 hover:text-red-600"
                                  onClick={() => setDeleteComissaoTarget(c)}
                                  title="Apagar comissão"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {comissoesTotalPages > 1 && (
                <div className="flex items-center justify-between px-2 py-4">
                  <div className="text-sm text-muted-foreground">
                    Página <span className="font-medium">{comissoesPage}</span> de <span className="font-medium">{comissoesTotalPages}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => editUser && fetchComissoes(editUser.id, comissoesPage - 1)}
                      disabled={comissoesPage <= 1 || comissoesLoading}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => editUser && fetchComissoes(editUser.id, comissoesPage + 1)}
                      disabled={comissoesPage >= comissoesTotalPages || comissoesLoading}
                    >
                      Próxima
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Editar Comissão ─────────────────────────────────────────── */}
      <Dialog open={editComissaoOpen} onOpenChange={setEditComissaoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Comissão #{editComissaoTarget?.id}</DialogTitle>
            <DialogDescription>Ajuste o valor ou vencimento. A conta a pagar vinculada será atualizada automaticamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Valor (R$)</Label>
              <Input
                value={editComissaoValor}
                onChange={(e) => setEditComissaoValor(e.target.value)}
                placeholder="0,00"
                type="number"
                min="0.01"
                step="0.01"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Vencimento</Label>
              <Input
                type="date"
                value={editComissaoVencimento}
                onChange={(e) => setEditComissaoVencimento(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditComissaoOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEditComissao} disabled={savingComissao}>
              {savingComissao ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Confirmar Exclusão ──────────────────────────────────────── */}
      <Dialog open={!!deleteComissaoTarget} onOpenChange={(o) => !o && setDeleteComissaoTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Apagar Comissão #{deleteComissaoTarget?.id}?</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. A comissão e a conta a pagar vinculada serão apagadas permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteComissaoTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteComissao} disabled={deletingComissao}>
              {deletingComissao ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Apagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Nova Comissão ───────────────────────────────────────────── */}
      <Dialog open={novaComissaoOpen} onOpenChange={setNovaComissaoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Comissão</DialogTitle>
            <DialogDescription>Crie uma comissão arbitrária vinculada a um pedido existente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">ID do Pedido</Label>
              <Input
                value={novaComissaoPedidoId}
                onChange={(e) => setNovaComissaoPedidoId(e.target.value)}
                placeholder="Ex: 1234"
                type="number"
                min="1"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Valor da Comissão (R$)</Label>
              <Input
                value={novaComissaoValor}
                onChange={(e) => setNovaComissaoValor(e.target.value)}
                placeholder="0,00"
                type="number"
                min="0.01"
                step="0.01"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Vencimento</Label>
              <Input
                type="date"
                value={novaComissaoVencimento}
                onChange={(e) => setNovaComissaoVencimento(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaComissaoOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateComissao} disabled={creatingComissao}>
              {creatingComissao ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Delete Lançamento */}
      <Dialog open={!!confirmDeleteLanc} onOpenChange={(open) => !open && setConfirmDeleteLanc(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remover lançamento</DialogTitle>
            <DialogDescription>
              {confirmDeleteLanc
                ? `Tem certeza que deseja remover o lançamento "${confirmDeleteLanc.descricao}"?`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDeleteLanc(null)}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={() => confirmDeleteLanc && handleDeleteLancamento(confirmDeleteLanc.id)}
              disabled={lancDeleting === confirmDeleteLanc?.id}
            >
              {lancDeleting === confirmDeleteLanc?.id ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removendo...
                </>
              ) : (
                "Remover"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Dialog Novo Lançamento */}
      <Dialog open={lancDialogOpen} onOpenChange={setLancDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo lançamento</DialogTitle>
            <DialogDescription>Informe os dados do lançamento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipo *</Label>
                <Select value={lancTipo} onValueChange={(v) => setLancTipo(v as "Despesa" | "Receita")}>
                  <SelectTrigger className="border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Despesa">Despesa</SelectItem>
                    <SelectItem value="Receita">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Data *</Label>
                <Input
                  type="date"
                  value={lancData}
                  onChange={(e) => setLancData(e.target.value)}
                  className="border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Valor *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={lancValor}
                  onChange={(e) => setLancValor(e.target.value)}
                  placeholder="0,00"
                  className="border-border"
                />
              </div>

            </div>
            <div className="space-y-2 col-span-4 md:col-span-1 md:col-start-4">
              <Label className="text-sm font-medium">Descrição *</Label>
              <Input
                value={lancDescricao}
                onChange={(e) => setLancDescricao(e.target.value)}
                placeholder="Ex: Adiantamento"
                className="border-border"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setLancDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCriarLancamento}
              disabled={lancSaving || !lancData || !lancDescricao.trim() || !lancValor.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {lancSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Criar lançamento"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Ativar/Desativar */}
      <Dialog open={!!confirmToggleUser} onOpenChange={(open) => !open && setConfirmToggleUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              {confirmToggleUser?.active ? (
                <UserX className="h-5 w-5 text-red-600" />
              ) : (
                <UserCheck className="h-5 w-5 text-green-600" />
              )}
              {confirmToggleUser?.active ? "Desativar Usuário" : "Ativar Usuário"}
            </DialogTitle>
            <DialogDescription>
              {confirmToggleUser?.active
                ? `Tem certeza que deseja desativar o usuário "${confirmToggleUser?.name}"? Ele não poderá mais acessar o sistema.`
                : `Tem certeza que deseja ativar o usuário "${confirmToggleUser?.name}"? Ele poderá acessar o sistema novamente.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfirmToggleUser(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmToggleActive}
              disabled={toggling}
              className={
                confirmToggleUser?.active
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
              }
            >
              {toggling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : confirmToggleUser?.active ? (
                "Desativar"
              ) : (
                "Ativar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Cliente Detail Dialog */}
      {clienteDetailId !== null && (
        <ClienteDetailDialog
          clienteId={clienteDetailId}
          open={true}
          onClose={() => setClienteDetailId(null)}
        />
      )}

      {/* Pedido Detail Dialog */}
      <PedidoDetailsDialog
        pedidoData={pedidoDetailId ? { id: pedidoDetailId, itens: [] } : null}
        clienteNome={pedidoDetailClienteNome}
        open={pedidoDetailId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPedidoDetailId(null)
            setPedidoDetailClienteNome(undefined)
          }
        }}
      />
    </DashboardLayout>
  )
}

