import { auth } from "@/auth"

const ADMIN_ROLES = ["MASTER", "ADMINISTRADOR"] as const

export async function getTecnicoContext(searchParams?: URLSearchParams): Promise<{
  tecnicoId: string | null
  isImpersonating: boolean
  userRole: string | null
  userId: string | null
}> {
  const session = await auth()

  if (!session?.user) {
    return { tecnicoId: null, isImpersonating: false, userRole: null, userId: null }
  }

  const userId = (session.user as { id?: string }).id ?? null
  const userRole = (session.user as { role?: string }).role ?? null
  const queryTecnicoId = searchParams?.get("tecnicoId")
  const isAdmin = userRole && ADMIN_ROLES.includes(userRole as typeof ADMIN_ROLES[number])

  if (isAdmin && queryTecnicoId) {
    return {
      tecnicoId: queryTecnicoId,
      isImpersonating: true,
      userRole,
      userId,
    }
  }

  return {
    tecnicoId: userId,
    isImpersonating: false,
    userRole,
    userId,
  }
}

