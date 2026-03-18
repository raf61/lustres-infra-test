// Limite máximo para filtros de listagem/atribuição de clientes
export const CLIENTS_MAX_LIMIT = 250

// Informações das empresas para documentos operacionais
export type EmpresaContato = {
  email: string
  telefone: string
  site: string
}

export const EMPRESA_CONTATO: Record<string, EmpresaContato> = {
  // EBR - Empresa Brasileira de Raios
  EBR: {
    email: "contato@empresabrasileiraderaios.com.br",
    telefone: "0800-123-0133",
    site: "empresabrasileiraderaios.com.br",
  },
  // Franklin
  FRANKLIN: {
    email: "contato@pararaiosfranklin.com.br",
    telefone: "4003-1571",
    site: "pararaiosfranklin.com.br",
  },
}

// Função helper para obter contato da empresa pelo nome
export function getEmpresaContato(empresaNome?: string | null): EmpresaContato {
  if (!empresaNome) return EMPRESA_CONTATO.EBR

  const nomeUpper = empresaNome.toUpperCase()
  if (nomeUpper.includes("FRANKLIN")) {
    return EMPRESA_CONTATO.FRANKLIN
  }
  // Default para EBR
  if (nomeUpper.includes("EMPRESA BRASILEIRA DE RAIOS")) {
    return EMPRESA_CONTATO.EBR
  }
  return { email: "", telefone: "", site: "" }
}

