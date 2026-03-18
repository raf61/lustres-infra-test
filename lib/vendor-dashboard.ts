import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

// Roles que podem visualizar dashboard de outros vendedores
const ADMIN_ROLES = ["MASTER", "ADMINISTRADOR"] as const

/**
 * Determina qual vendedorId usar baseado na sessão e query params.
 * 
 * - Se o usuário for MASTER/ADMINISTRADOR e passar ?vendedorId=X, usa X
 * - Caso contrário, usa o ID do usuário logado
 * - Retorna null se não conseguir determinar
 * 
 * @param searchParams - URLSearchParams da request (opcional)
 * @returns Promise com vendedorId e informações do contexto
 */
export async function getVendedorContext(searchParams?: URLSearchParams): Promise<{
  vendedorId: string | null
  isImpersonating: boolean
  isMaster: boolean
  userRole: string | null
  userId: string | null
}> {
  const session = await auth()

  if (!session?.user) {
    return { vendedorId: null, isImpersonating: false, isMaster: false, userRole: null, userId: null }
  }

  const userId = (session.user as { id?: string }).id ?? null
  const userRole = (session.user as { role?: string }).role ?? null

  // Verifica se é admin e se foi passado vendedorId na query
  const queryVendedorId = searchParams?.get("vendedorId")
  const isAdmin = userRole && ADMIN_ROLES.includes(userRole as typeof ADMIN_ROLES[number])
  const isMaster = userRole === "MASTER"

  if (isAdmin && queryVendedorId) {
    return {
      vendedorId: queryVendedorId,
      isImpersonating: true,
      isMaster,
      userRole,
      userId,
    }
  }

  return {
    vendedorId: userId,
    isImpersonating: false,
    isMaster,
    userRole,
    userId,
  }
}

/**
 * Verifica se o cliente pertence ao vendedor especificado.
 * Retorna true caso tenha acesso, false caso contrário.
 */
export async function vendorOwnsClient(clientId: number, vendedorId: string): Promise<boolean> {
  if (Number.isNaN(clientId) || !vendedorId) return false

  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      vendedorId: vendedorId,
    },
    select: { id: true },
  })

  return Boolean(client)
}

/**
 * Obtém o ID do usuário logado da sessão.
 * Útil para criação de pedidos/orçamentos.
 */
export async function getLoggedUserId(): Promise<string | null> {
  const session = await auth()
  return (session?.user as { id?: string })?.id ?? null
}
