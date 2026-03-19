import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { authConfig } from "./auth.config"

/**
 * Configuração COMPLETA do Auth.js - COM providers, COM Prisma
 * Usada pelas rotas de API para login/logout
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log("[Auth] Authorize attempt for:", credentials?.email);
        if (!credentials?.email || !credentials?.password) {
          console.warn("[Auth] Missing credentials");
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) {
          console.warn("[Auth] User not found:", credentials.email);
          return null;
        }

        if (!user.passwordHash) {
          console.warn("[Auth] User has no password hash:", credentials.email);
          return null;
        }

        if (!user.active) {
          console.warn("[Auth] User is inactive:", credentials.email);
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isPasswordValid) {
          console.warn("[Auth] Invalid password for:", credentials.email);
          return null;
        }

        console.log("[Auth] Login successful for:", user.email);
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
})

