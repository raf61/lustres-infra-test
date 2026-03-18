"use client"

import { useSession } from "next-auth/react"
import type { ReactNode } from "react"

// Roles disponíveis no sistema
type Role = "MASTER" | "ADMINISTRADOR" | "SUPERVISOR" | "VENDEDOR" | "PESQUISADOR" | "TECNICO" | "FINANCEIRO" | "SAC" | "CHATBOT"

interface CanProps {
  /** Roles que podem ver o conteúdo */
  roles: Role[]
  /** Conteúdo a ser renderizado se o usuário tiver permissão */
  children: ReactNode
  /** Conteúdo alternativo se não tiver permissão (opcional) */
  fallback?: ReactNode
}

/**
 * Componente centralizado para controle de acesso baseado em role.
 * Só renderiza o children se o usuário logado tiver uma das roles especificadas.
 * 
 * @example
 * ```tsx
 * <Can roles={["MASTER", "ADMINISTRADOR"]}>
 *   <Button>Ação restrita</Button>
 * </Can>
 * ```
 */
export function Can({ roles, children, fallback = null }: CanProps) {
  const { data: session, status } = useSession()

  // Enquanto carrega, não mostra nada
  if (status === "loading") {
    return null
  }

  // Se não está logado, não mostra
  if (!session?.user) {
    return <>{fallback}</>
  }

  const userRole = (session.user as { role?: string }).role

  // Se o usuário não tem role ou a role não está na lista permitida
  if (!userRole || !roles.includes(userRole as Role)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * Hook para verificar se o usuário tem uma das roles especificadas.
 * Útil quando precisa de lógica condicional além de renderização.
 * 
 * @example
 * ```tsx
 * const canApprove = useCanAccess(["MASTER", "ADMINISTRADOR"])
 * if (canApprove) { ... }
 * ```
 */
export function useCanAccess(roles: Role[]): boolean {
  const { data: session, status } = useSession()

  if (status === "loading" || !session?.user) {
    return false
  }

  const userRole = (session.user as { role?: string }).role

  if (!userRole) {
    return false
  }

  return roles.includes(userRole as Role)
}

