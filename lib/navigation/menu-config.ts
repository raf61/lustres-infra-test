/**
 * Configuração Centralizada do Menu de Navegação
 * 
 * Edite este arquivo para:
 * - Adicionar/remover itens de menu
 * - Mudar permissões de acesso
 * - Reorganizar grupos
 */

import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Calendar,
  Database,
  Wrench,
  HeadphonesIcon,
  DollarSign,
  BarChart3,
  Package,
  Building2,
  CheckCircle,
  UserCircle,
  ClipboardList,
  FileText,
  MessageSquare,
  Landmark,
  XCircle,
  Folder,
  UserCheck,
  Contact,
  UserMinus,
  Component,
  Receipt,
  ScrollText,
  Megaphone,
} from "lucide-react"

import { type Role } from "@/lib/constants/roles"

// ============================================================================
// TIPOS
// ============================================================================

export interface MenuItem {
  name: string
  href: string
  icon: LucideIcon
  /** Roles que podem ver este item. Se não definido, herda do grupo. */
  roles?: Role[]
}

export interface MenuGroup {
  label: string
  /** Roles que podem ver este grupo inteiro. Itens herdam se não tiverem roles próprias. */
  roles: Role[]
  items: MenuItem[]
}

// ============================================================================
// CONFIGURAÇÃO DO MENU
// ============================================================================

export const MENU_CONFIG: MenuGroup[] = [
  // -------------------------------------------------------------------------
  // PRINCIPAL
  // -------------------------------------------------------------------------
  {
    label: "Principal",
    roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"],
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["MASTER", "ADMINISTRADOR"] },
      { name: "WhatsApp Central", href: "/dashboard/chat", icon: MessageSquare },
    ],
  },

  // -------------------------------------------------------------------------
  // CRM (MASTER) — vem antes de Leads
  // -------------------------------------------------------------------------
  {
    label: "CRM",
    roles: ["MASTER", "ADMINISTRADOR"],
    items: [
      { name: "Pipeline de Vendas", href: "/dashboard/vendedor", icon: Component, roles: ["MASTER", "ADMINISTRADOR"] },
    ],
  },

  // -------------------------------------------------------------------------
  // LEADS
  // -------------------------------------------------------------------------
  {
    label: "Leads",
    roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "PESQUISADOR", "FINANCEIRO"],
    items: [
      { name: "Base CRM", href: "/dashboard/leads/geral", icon: Database, roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "PESQUISADOR", "FINANCEIRO"] },
    ],
  },

  // -------------------------------------------------------------------------
  // PEDIDOS E ORÇAMENTOS
  // -------------------------------------------------------------------------
  {
    label: "Pedidos e Orçamentos",
    roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "FINANCEIRO", "SAC"],
    items: [
      { name: "Pedidos", href: "/dashboard/pedidos", icon: ClipboardList },
      { name: "Campanhas", href: "/dashboard/campaigns", icon: Megaphone },
      { name: "Orçamentos", href: "/dashboard/orcamentos", icon: FileText, roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "VENDEDOR", "FINANCEIRO"] },
      // { name: "Contratos", href: "/dashboard/contratos", icon: ScrollText, roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO", "VENDEDOR"] },
    ],
  },

  // -------------------------------------------------------------------------
  // PESQUISADOR
  // -------------------------------------------------------------------------
  {
    label: "Pesquisador",
    roles: ["PESQUISADOR"],
    items: [
      { name: "Dashboard Pesquisador", href: "/dashboard/pesquisador", icon: ClipboardList },
    ],
  },


  // -------------------------------------------------------------------------
  // VENDEDOR
  // -------------------------------------------------------------------------
  {
    label: "Vendedor",
    roles: ["VENDEDOR"],
    items: [
      { name: "Dashboard Vendedor", href: "/dashboard/vendedor", icon: UserCircle },
      { name: "Análise Leads", href: "/dashboard/analise-vendedores", icon: BarChart3 },
      { name: "WhatsApp Central", href: "/dashboard/chat", icon: MessageSquare },
    ],
  },

  // -------------------------------------------------------------------------
  // OPERAÇÕES
  // -------------------------------------------------------------------------
  {
    label: "Operações",
    roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "TECNICO", "SAC"],
    items: [
      // { name: "Supervisão Técnica", href: "/dashboard/supervisao", icon: ClipboardList, roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR"] },
      { name: "WhatsApp Central", href: "/dashboard/chat", icon: MessageSquare, roles: ["SUPERVISOR"] },
      { name: "Técnico", href: "/dashboard/tecnico", icon: Wrench, roles: ["TECNICO"] },
      // { name: "SAC", href: "/dashboard/sac", icon: HeadphonesIcon, roles: ["MASTER", "ADMINISTRADOR", "SAC"] },
    ],
  },

  // -------------------------------------------------------------------------
  // GESTÃO
  // -------------------------------------------------------------------------
  {
    label: "Gestão",
    roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"],
    items: [
      // { name: "Financeiro", href: "/dashboard/financeiro", icon: DollarSign, roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] },
      { name: "Usuários", href: "/dashboard/usuarios", icon: Users, roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] },
      { name: "Estoque", href: "/dashboard/estoque", icon: Package, roles: ["MASTER", "ADMINISTRADOR"] },
      { name: "Análise Leads & IA", href: "/dashboard/analise-leads", icon: BarChart3, roles: ["MASTER", "ADMINISTRADOR"] },
      { name: "Relatórios", href: "/dashboard/relatorios", icon: BarChart3, roles: ["MASTER", "ADMINISTRADOR"] },
      // { name: "Bancos", href: "/dashboard/bancos", icon: Landmark, roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] },
      // { name: "Filiais", href: "/dashboard/filiais", icon: Component, roles: ["MASTER", "ADMINISTRADOR"] },
      // { name: "Administradoras", href: "/dashboard/administradoras", icon: Building2, roles: ["MASTER", "ADMINISTRADOR"] },
      // { name: "Notas Fiscais", href: "/dashboard/financeiro/nfe", icon: Receipt, roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] },
    ],
  },
]

// ============================================================================
// FUNÇÃO PARA FILTRAR MENU POR ROLE
// ============================================================================

/**
 * Retorna apenas os grupos e itens de menu que a role pode acessar
 * - Se o item tem roles definidas, usa as roles do item
 * - Se não tem, herda as roles do grupo
 */
export function getMenuForRole(role: Role | null | undefined): MenuGroup[] {
  if (!role) return []

  return MENU_CONFIG
    // Primeiro filtra grupos que a role pode ver
    .filter(group => group.roles.includes(role))
    // Depois filtra itens dentro de cada grupo
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        // Se o item tem roles próprias, usa elas; senão herda do grupo
        const itemRoles = item.roles ?? group.roles
        return itemRoles.includes(role)
      })
    }))
    // Remove grupos que ficaram sem itens
    .filter(group => group.items.length > 0)
}

