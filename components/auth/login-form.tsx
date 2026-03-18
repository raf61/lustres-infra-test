"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn, getSession } from "next-auth/react"
import { Button } from "@/components/ui/button"

// Mapa de rotas padrão por role (mesmo do proxy.ts)
const DEFAULT_ROUTE_BY_ROLE: Record<string, string> = {
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Lock, Mail, Building2 } from "lucide-react"

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("Email ou senha inválidos")
      } else {
        localStorage.removeItem("userRole") // Limpa dados de sessão anterior
        
        // Busca a sessão atualizada para obter o role
        const session = await getSession()
        const role = (session?.user as any)?.role as string | undefined
        const defaultRoute = role ? DEFAULT_ROUTE_BY_ROLE[role] : "/dashboard"
        
        router.push(defaultRoute)
        router.refresh()
      }
    } catch (err) {
      setError("Ocorreu um erro ao tentar entrar")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md border-border">
      <CardHeader className="space-y-4 text-center">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
          <Building2 className="w-8 h-8 text-primary" />
        </div>
        <div>
          <CardTitle className="text-2xl font-bold">Sistema de Gestão</CardTitle>
          <CardDescription className="text-muted-foreground">Controle de Clientes e Manutenção</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md text-center">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">
              Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 bg-card border-border text-foreground"
                required
                disabled={isLoading}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground">
              Senha
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 bg-card border-border text-foreground"
                required
                disabled={isLoading}
              />
            </div>
          </div>
          <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}>
            {isLoading ? "Entrando..." : "Entrar no Sistema"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
