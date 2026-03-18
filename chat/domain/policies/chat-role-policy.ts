export type ChatAssigneeFilter = "me" | "all" | "unassigned"

export type ChatAssigneeScope =
  | { mode: "all" }
  | { mode: "mine_or_unassigned"; userId: string }

export function enforceAssigneeFilterForRole(params: {
  role?: string | null
  requested?: ChatAssigneeFilter
}): ChatAssigneeFilter {
  const { role, requested } = params
  if (role === "VENDEDOR") return "me"
  return requested ?? "all"
}

export function buildSearchAssigneeScopeForRole(params: {
  role?: string | null
  userId: string
}): ChatAssigneeScope {
  const { role, userId } = params
  if (role === "VENDEDOR") {
    return { mode: "mine_or_unassigned", userId }
  }
  return { mode: "all" }
}

