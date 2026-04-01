import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from "next/server"

// Cria instância LEVE do Auth.js (sem providers, sem Prisma)
// Consegue verificar sessões existentes, mas não criar novas
const { auth } = NextAuth(authConfig)

// Definido localmente para evitar importar @prisma/client
type Role = "MASTER" | "ADMINISTRADOR" | "SUPERVISOR" | "VENDEDOR" | "PESQUISADOR" | "TECNICO" | "FINANCEIRO" | "SAC" | "CHATBOT"

// ============================================================================
// CONFIGURAÇÃO DE ROTAS PÚBLICAS
// Rotas que NÃO exigem autenticação
// ============================================================================
const PUBLIC_ROUTES = [
  "/",              // Página de login
  "/api/auth",      // Rotas de autenticação do Auth.js
  "/proposta",      // Proposta comercial pública
] as const

// ============================================================================
// ROTA PADRÃO POR ROLE
// Define para onde o usuário é redirecionado após login ou quando não tem
// permissão para acessar uma rota específica
// ============================================================================
const DEFAULT_ROUTE_BY_ROLE: Record<Role, string> = {
  MASTER: "/dashboard",
  ADMINISTRADOR: "/dashboard",
  SUPERVISOR: "/dashboard/supervisao",
  VENDEDOR: "/dashboard/vendedor",
  TECNICO: "/dashboard/tecnico",
  FINANCEIRO: "/dashboard/financeiro",
  SAC: "/dashboard/sac",
  PESQUISADOR: "/dashboard/leads/geral",
  CHATBOT: "/dashboard",
}

// ============================================================================
// CONFIGURAÇÃO DE AUTORIZAÇÃO POR ROLE
// Define quais roles podem acessar cada prefixo de rota
// A regra mais específica (prefixo mais longo) tem prioridade
// 
// Formato:
// - { prefix, roles } - acesso total para essas roles
// - { prefix, roles, blockMethods: { ROLE: ["POST", "PUT"] } } - bloqueia métodos específicos por role
// ============================================================================
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
type RouteGuard = {
  prefix: string
  roles: Role[]
  blockMethods?: Partial<Record<Role, HttpMethod[]>>  // Métodos bloqueados por role
}

const ROUTE_GUARDS: RouteGuard[] = [
  // -------------------------------------------------------------------------
  // PÁGINAS DO DASHBOARD
  // -------------------------------------------------------------------------

  // Admin/Master - acesso total
  { prefix: "/dashboard/admin/aprovacoes", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] },
  { prefix: "/dashboard/adm-aprovacoes", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] },
  { prefix: "/dashboard/admin", roles: ["MASTER", "ADMINISTRADOR"] },
  { prefix: "/dashboard/usuarios", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] },
  { prefix: "/dashboard/bancos", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] },

  // Financeiro
  { prefix: "/dashboard/financeiro/nfe", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] },
  { prefix: "/dashboard/financeiro", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] },
  { prefix: "/dashboard/cobranca", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] },

  // Supervisão e Operações
  { prefix: "/dashboard/supervisao", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR"] },
  { prefix: "/dashboard/analise-cancelamento", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO", "SUPERVISOR"] },

  // Técnico
  { prefix: "/dashboard/tecnico", roles: ["MASTER", "ADMINISTRADOR", "TECNICO"] },

  // SAC
  { prefix: "/dashboard/sac", roles: ["MASTER", "ADMINISTRADOR", "SAC"] },

  // Chat
  { prefix: "/dashboard/chat", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "SAC", "CHATBOT", "VENDEDOR"] },

  // Pesquisador
  { prefix: "/dashboard/pesquisador", roles: ["MASTER", "ADMINISTRADOR", "PESQUISADOR"] },

  // Vendedor
  { prefix: "/dashboard/vendedor", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "VENDEDOR"] },

  // Gestão
  { prefix: "/dashboard/estoque", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR"] },
  { prefix: "/dashboard/filiais", roles: ["MASTER", "ADMINISTRADOR"] },
  { prefix: "/dashboard/administradoras", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR"] },

  // Relatórios e Análise
  { prefix: "/dashboard/relatorios", roles: ["MASTER", "ADMINISTRADOR"] },
  { prefix: "/dashboard/analise-vendedores", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR"] },
  { prefix: "/dashboard/analise-tecnicos", roles: ["MASTER", "ADMINISTRADOR"] },
  { prefix: "/dashboard/analise-pesquisadores", roles: ["MASTER", "ADMINISTRADOR"] },

  // Leads - VENDEDOR não tem acesso
  { prefix: "/dashboard/leads/cadastro-geral", roles: ["MASTER", "ADMINISTRADOR", "PESQUISADOR"] },
  { prefix: "/dashboard/leads", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "PESQUISADOR", "FINANCEIRO"] },
  { prefix: "/dashboard/pedidos", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "VENDEDOR", "FINANCEIRO", "SAC"] },
  { prefix: "/dashboard/orcamentos", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "VENDEDOR", "FINANCEIRO"] },

  // Dashboard principal - todos autenticados
  { prefix: "/dashboard", roles: ["MASTER", "ADMINISTRADOR"] },

  // -------------------------------------------------------------------------
  // APIs
  // -------------------------------------------------------------------------

  // APIs Admin
  // Aprovação final: FINANCEIRO pode listar e aprovar
  { prefix: "/api/admin/aprovacoes/*/aprovar", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] },
  { prefix: "/api/admin/aprovacoes", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"], blockMethods: { FINANCEIRO: ["POST", "PUT", "PATCH", "DELETE"] } },
  { prefix: "/api/admin", roles: ["MASTER", "ADMINISTRADOR"] },
  { prefix: "/api/usuarios/*/dados-cadastrais", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] },
  { prefix: "/api/usuarios/*/lancamentos", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] },
  { prefix: "/api/usuarios", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "FINANCEIRO"], blockMethods: { SUPERVISOR: ["POST", "PUT", "PATCH", "DELETE"] } },
  { prefix: "/api/bancos", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] },

  // APIs Financeiro
  { prefix: "/api/financeiro/comissoes", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"], blockMethods: { ADMINISTRADOR: ["POST", "PUT", "PATCH", "DELETE"] } },
  { prefix: "/api/financeiro", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] },
  { prefix: "/api/financeiro/contas-receber", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] },
  { prefix: "/api/cobranca", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] },

  // APIs Supervisão
  { prefix: "/api/supervisao", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR"] },
  { prefix: "/api/analise-cancelamento", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO", "SUPERVISOR"] },

  // APIs Técnico
  { prefix: "/api/tecnico", roles: ["MASTER", "ADMINISTRADOR", "TECNICO"] },

  // APIs SAC
  { prefix: "/api/sac", roles: ["MASTER", "ADMINISTRADOR", "SAC"] },

  // APIs Pesquisador
  { prefix: "/api/pesquisador", roles: ["MASTER", "ADMINISTRADOR", "PESQUISADOR"] },
  { prefix: "/api/fichas/exists-in-research", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO", "PESQUISADOR", "VENDEDOR"] },
  { prefix: "/api/fichas", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO", "PESQUISADOR"] },

  // APIs Vendedor
  { prefix: "/api/vendedor/clients/retornar-pesquisa", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "VENDEDOR", "PESQUISADOR", "FINANCEIRO", "SAC", "TECNICO"] },
  { prefix: "/api/vendedor/inadimplencia", roles: ["MASTER", "ADMINISTRADOR", "VENDEDOR"] },
  { prefix: "/api/vendedor", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "VENDEDOR"] },
  { prefix: "/api/vendedores", roles: ["MASTER", "ADMINISTRADOR", "PESQUISADOR", "FINANCEIRO", "SUPERVISOR"] },
  { prefix: "/api/pesquisadores", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "PESQUISADOR"] },

  // APIs Gestão
  { prefix: "/api/estoque", roles: ["MASTER", "ADMINISTRADOR"] },
  {
    prefix: "/api/filiais",
    roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO", "VENDEDOR", "SUPERVISOR", "SAC"],
    blockMethods: {
      VENDEDOR: ["POST", "PUT", "PATCH", "DELETE"],
      SUPERVISOR: ["POST", "PUT", "PATCH", "DELETE"],
      SAC: ["POST", "PUT", "PATCH", "DELETE"],
    }
  },
  { prefix: "/api/empresas", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "VENDEDOR", "FINANCEIRO"] },
  { prefix: "/api/administradoras", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "VENDEDOR", "TECNICO", "FINANCEIRO", "SAC", "PESQUISADOR"] },

  // APIs de Relatórios - apenas MASTER e ADMINISTRADOR
  { prefix: "/api/relatorio", roles: ["MASTER", "ADMINISTRADOR"] },

  // APIs restritas - apenas MASTER e ADMINISTRADOR
  { prefix: "/api/clients/atribuir-vendedor", roles: ["MASTER", "ADMINISTRADOR", "PESQUISADOR", "FINANCEIRO"] },
  { prefix: "/api/clients/liberar-vendedor", roles: ["MASTER", "ADMINISTRADOR"] },
  { prefix: "/api/fichas/atribuir-pesquisador", roles: ["MASTER", "FINANCEIRO"] },
  { prefix: "/api/vendedor/atribuicao-automatica", roles: ["MASTER"] },
  // VENDEDOR pode atribuir/desatribuir sessões (POST), mas não pode alterar via PUT/PATCH/DELETE
  // SUPERVISOR: somente leitura (GET) para acompanhar status no chat
  {
    prefix: "/api/chatbot/sessions",
    roles: ["MASTER", "ADMINISTRADOR", "VENDEDOR", "SUPERVISOR"],
    blockMethods: {
      VENDEDOR: ["PUT", "PATCH", "DELETE"],
      SUPERVISOR: ["POST", "PUT", "PATCH", "DELETE"],
    },
  },
  { prefix: "/api/chatbot", roles: ["MASTER", "ADMINISTRADOR"] },
  {
    prefix: "/api/chatbot/flows",
    roles: ["MASTER", "ADMINISTRADOR", "VENDEDOR", "SUPERVISOR"],
    blockMethods: {
      VENDEDOR: ["POST", "PUT", "PATCH", "DELETE"],
      SUPERVISOR: ["POST", "PUT", "PATCH", "DELETE"],
    },
  },
  { prefix: "/api/mandatos", roles: ["MASTER", "ADMINISTRADOR"] },

  // APIs de Clientes - VENDEDOR pode criar/ver registros de clientes
  { prefix: "/api/clients", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "VENDEDOR", "PESQUISADOR", "SAC", "FINANCEIRO"] },
  { prefix: "/api/clientes", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "VENDEDOR", "PESQUISADOR", "SAC"] },

  // Pedidos e Orçamentos - SUPERVISOR só pode ler (GET), não pode criar/editar
  {
    prefix: "/api/pedidos/*/debitos",
    roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "VENDEDOR", "FINANCEIRO", "SAC"],
    blockMethods: { SUPERVISOR: ["POST", "PUT", "PATCH", "DELETE"], VENDEDOR: ["POST", "PUT", "PATCH", "DELETE"], SAC: ["POST", "PUT", "PATCH", "DELETE"] },
  },
  { prefix: "/api/pedidos/*/boletos", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] },
  { prefix: "/api/pedidos/*/cancelar", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] },
  { prefix: "/api/pedidos/*/assign", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO", "SUPERVISOR"] },
  { prefix: "/api/pedidos/*/items/quantities", roles: ["MASTER", "ADMINISTRADOR", "TECNICO"] },
  { prefix: "/api/pedidos", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "VENDEDOR", "FINANCEIRO", "SAC"], blockMethods: { SUPERVISOR: ["POST", "PUT", "PATCH", "DELETE"] } },
  { prefix: "/api/orcamentos/*/empresa", roles: ["MASTER", "FINANCEIRO"], },
  { prefix: "/api/orcamentos/*/cancelar", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] },
  { prefix: "/api/orcamentos", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "VENDEDOR", "FINANCEIRO"], blockMethods: { SUPERVISOR: ["POST", "PUT", "PATCH", "DELETE"] } },
  { prefix: "/api/items", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "SAC", "VENDEDOR", "TECNICO", "FINANCEIRO"] },
  { prefix: "/api/visitas", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "TECNICO", "VENDEDOR"] },
  { prefix: "/api/documentos-operacionais", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "TECNICO", "SAC", "FINANCEIRO", "VENDEDOR"] },
  { prefix: "/api/boletos", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO", "VENDEDOR"] },
  { prefix: "/api/remessas", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] },
  { prefix: "/api/retornos", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] },
  { prefix: "/api/nfe/issue", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] },
  { prefix: "/api/nfe/*/sync", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO", "SUPERVISOR", "SAC"] },
  { prefix: "/api/nfe/*/download", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO", "SUPERVISOR", "SAC", "VENDEDOR"] },
  { prefix: "/api/nfe/*/xml", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO", "SUPERVISOR", "SAC"] },
  { prefix: "/api/nfe", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] },
  { prefix: "/api/storage", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "VENDEDOR", "TECNICO", "SAC"] },
  { prefix: "/api/cnpj", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "VENDEDOR", "PESQUISADOR"] },
  { prefix: "/api/dashboard", roles: ["MASTER", "ADMINISTRADOR"] },
  { prefix: "/api/cron", roles: ["MASTER", "ADMINISTRADOR"] },
  { prefix: "/api/gerentes-vinculo", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "PESQUISADOR", "VENDEDOR"] },
  { prefix: "/api/cancelar-pedido-concluido", roles: ["MASTER", "ADMINISTRADOR"] },

  // APIs de Chat - apenas roles que devem acessar o módulo de chat
  { prefix: "/api/chat", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "SAC", "CHATBOT", "VENDEDOR"] },

  // Rotas dinâmicas - use * como wildcard para segmentos dinâmicas
  { prefix: "/api/pedidos/*/aprovacao-precoce", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO"] },

  // APIs de Exportação ART - rotas específicas antes do guard genérico /api/pedidos
  { prefix: "/api/pedidos/export-art", roles: ["MASTER", "ADMINISTRADOR", "FINANCEIRO", "SUPERVISOR", "VENDEDOR"] },

  // Fallback: qualquer outra API exige autenticação
  { prefix: "/api", roles: ["MASTER", "ADMINISTRADOR", "SUPERVISOR", "VENDEDOR", "TECNICO", "FINANCEIRO", "SAC", "PESQUISADOR"] },
]

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) =>
    pathname === route || pathname.startsWith(route + "/")
  )
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api")
}

function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header =
    request.headers.get("x-cron-secret") || request.headers.get("authorization")
  return header === secret || header === `Bearer ${secret}`
}

function getDefaultRouteForRole(role: Role | null): string {
  if (!role) return "/dashboard"
  return DEFAULT_ROUTE_BY_ROLE[role] ?? "/dashboard"
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  // Suporte a wildcard (*) para rotas dinâmicas
  if (prefix.includes("*")) {
    // Converte /api/pedidos/*/aprovacao-precoce em regex: /api/pedidos/[^/]+/aprovacao-precoce
    const regexPattern = prefix.replace(/\*/g, "[^/]+")
    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(pathname)
  }
  // Prefixo normal
  return pathname === prefix || pathname.startsWith(prefix + "/")
}

function findMatchingGuard(pathname: string) {
  // Filtra as regras que correspondem ao pathname
  const matchingGuards = ROUTE_GUARDS.filter((guard) => matchesPrefix(pathname, guard.prefix))

  // Retorna a regra mais específica (prefixo mais longo)
  return matchingGuards.sort((a, b) => b.prefix.length - a.prefix.length)[0] ?? null
}

function isMethodBlocked(guard: RouteGuard, role: Role, method: string): boolean {
  if (!guard.blockMethods) return false
  const blockedMethods = guard.blockMethods[role]
  if (!blockedMethods) return false
  return blockedMethods.includes(method as HttpMethod)
}

// ============================================================================
// MIDDLEWARE PRINCIPAL
// Usa auth.config.ts (leve, sem Prisma)
// ============================================================================

export default auth((req) => {
  const pathname = req.nextUrl.pathname
  const method = req.method
  const isLoggedIn = !!req.auth
  const userRole = (req.auth?.user as any)?.role as Role | null

  // 1. Rotas públicas - permite acesso
  if (isPublicRoute(pathname)) {
    // Se já está logado e tenta acessar a página de login, redireciona para sua rota padrão
    if (pathname === "/" && isLoggedIn) {
      const defaultRoute = getDefaultRouteForRole(userRole)
      return NextResponse.redirect(new URL(defaultRoute, req.nextUrl))
    }
    return NextResponse.next()
  }

  // 2. Verifica autenticação
  if (!isLoggedIn) {
    if (pathname.startsWith("/api/cron") && isCronAuthorized(req)) {
      return NextResponse.next()
    }
    if (isApiRoute(pathname)) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }
    return NextResponse.redirect(new URL("/", req.nextUrl))
  }

  if (pathname.startsWith("/api/cron") && isCronAuthorized(req)) {
    return NextResponse.next()
  }

  // 3. Verifica autorização (role + método HTTP)
  const guard = findMatchingGuard(pathname)

  if (guard) {
    // Primeiro: verifica se a role tem acesso à rota
    if (!userRole || !guard.roles.includes(userRole)) {
      if (isApiRoute(pathname)) {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
      }
      const defaultRoute = getDefaultRouteForRole(userRole)
      return NextResponse.redirect(new URL(defaultRoute, req.nextUrl))
    }

    // Segundo: verifica se o método está bloqueado para essa role
    if (userRole && isMethodBlocked(guard, userRole, method)) {
      if (isApiRoute(pathname)) {
        return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 })
      }
      const defaultRoute = getDefaultRouteForRole(userRole)
      return NextResponse.redirect(new URL(defaultRoute, req.nextUrl))
    }
  }

  // 4. Tudo OK - permite acesso
  return NextResponse.next()
})

// ============================================================================
// CONFIGURAÇÃO DO MATCHER
// ============================================================================

export const config = {
  matcher: [
    /*
     * Executa o middleware em TODAS as rotas, EXCETO:
     * - _next/static (arquivos estáticos do build)
     * - _next/image (otimização de imagens)
     * - favicon.ico
     * - Arquivos com extensões de assets comuns
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2|ttf|eot)$).*)",
  ],
}

