/**
 * Roles do Sistema - Fonte Centralizada
 * 
 * Este arquivo é a fonte única de verdade para as roles do sistema.
 * Importado por: middleware, menu, componentes de permissão, etc.
 */

export const ROLES = [
  "MASTER",
  "ADMINISTRADOR", 
  "SUPERVISOR",
  "VENDEDOR",
  "PESQUISADOR",
  "TECNICO",
  "FINANCEIRO",
  "SAC",
  "CHATBOT",
] as const

export type Role = typeof ROLES[number]

