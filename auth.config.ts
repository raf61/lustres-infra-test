import type { NextAuthConfig } from "next-auth"

/**
 * Configuração BASE do Auth.js - SEM providers, SEM Prisma
 * Usada pelo middleware para verificar sessões existentes
 */
export const authConfig = {
  pages: {
    signIn: "/",
  },
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }: any) {
      if (user) {
        token.role = user.role
        token.id = user.id
      }
      return token
    },
    session({ session, token }: any) {
      if (token && session.user) {
        session.user.role = token.role
        session.user.id = token.id
      }
      return session
    },
  },
  providers: [], // Vazio aqui - providers ficam no auth.ts
} satisfies NextAuthConfig

