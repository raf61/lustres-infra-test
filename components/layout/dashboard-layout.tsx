"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Building2, LogOut, Menu, X, Bell, Settings, PanelLeft, Trash2, Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { getMenuForRole } from "@/lib/navigation/menu-config"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Role } from "@/lib/constants/roles"

interface Notification {
  id: string;
  content: string;
  createdAt: string;
}

interface DashboardLayoutProps {
  children: React.ReactNode
  hideHeader?: boolean
}

export function DashboardLayout({ children, hideHeader = false }: DashboardLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = useSession()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const sidebarStorageKey = "dashboard_sidebar_collapsed"

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/user/notifications")
      const data = await res.json()
      if (Array.isArray(data)) setNotifications(data)
    } catch (error) {
      console.error("Erro ao buscar notificações", error)
    }
  }

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch(`/api/user/notifications?id=${id}`, { method: 'DELETE' })
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch (error) {
      console.error("Erro ao deletar notificação", error)
    }
  }

  const clearNotifications = async () => {
    try {
      await fetch("/api/user/notifications", { method: "DELETE" })
      setNotifications([])
    } catch (error) {
      console.error("Erro ao limpar notificações", error)
    }
  }

  // Filtra o menu baseado na role do usuário
  const userRole = (session?.user as { role?: Role } | undefined)?.role
  const navigationGroups = useMemo(() => getMenuForRole(userRole), [userRole])

  useEffect(() => {
    if (userRole === "VENDEDOR") {
      fetchNotifications()
      // Poll a cada 30 segundos (simples e sem overhead de socket por enquanto)
      const interval = setInterval(fetchNotifications, 30000)
      return () => clearInterval(interval)
    }
  }, [userRole])

  useEffect(() => {
    const storedState = localStorage.getItem(sidebarStorageKey)
    if (storedState === "true") {
      setSidebarCollapsed(true)
    }
  }, [])

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((current) => {
      const next = !current
      localStorage.setItem(sidebarStorageKey, String(next))
      return next
    })
  }

  const handleLogout = async () => {
    localStorage.removeItem("userRole")
    await signOut({ callbackUrl: "/" })
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 text-foreground bg-card transform transition-all duration-300 ease-in-out lg:translate-x-0 border-r border-border shadow-2xl shadow-blue-900/10 font-sans",
          sidebarCollapsed ? "lg:w-20" : "lg:w-64",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-screen flex-col overflow-hidden">
          {/* Logo */}
          <div
            className={cn(
              "flex h-20 items-center justify-between px-6 border-b border-border flex-shrink-0 bg-background/50 backdrop-blur-md",
              sidebarCollapsed && "lg:px-0 lg:justify-center",
            )}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 kpi-glow">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div className={cn("flex flex-col", sidebarCollapsed && "lg:hidden")}>
                <span className="font-black text-sm tracking-tight text-foreground leading-none">Casarão Lustres</span>
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">Infraestrutura IA</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden text-foreground hover:bg-white/10" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="px-4 py-4">
            <Select defaultValue="global">
              <SelectTrigger className="w-full bg-background/50 border-border/50 text-foreground text-[10px] font-black uppercase tracking-widest h-10 focus:ring-0 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <SelectValue placeholder="Selecionar Unidade" />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                <SelectItem value="global" className="text-[10px] font-bold uppercase focus:bg-primary focus:text-white">Visão Global</SelectItem>
                <SelectItem value="u1" className="text-[10px] font-bold uppercase focus:bg-primary focus:text-white">Unidade 1</SelectItem>
                <SelectItem value="u2" className="text-[10px] font-bold uppercase focus:bg-primary focus:text-white">Unidade 2</SelectItem>
                <SelectItem value="u3" className="text-[10px] font-bold uppercase focus:bg-primary focus:text-white">Unidade 3</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full py-3">
              <nav className="px-3 space-y-0.5">
                {navigationGroups.map((group) =>
                  group.items.map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <button
                        key={item.name + item.href}
                        onClick={() => {
                          router.push(item.href)
                          setSidebarOpen(false)
                        }}
                        title={sidebarCollapsed ? item.name : undefined}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-left group",
                          sidebarCollapsed && "lg:justify-center lg:px-0",
                          isActive
                            ? "bg-primary/15 text-primary font-bold"
                            : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                        )}
                      >
                        <item.icon
                          className={cn(
                            "h-[18px] w-[18px] shrink-0 transition-colors",
                            isActive ? "text-primary" : "text-slate-500 group-hover:text-slate-300"
                          )}
                        />
                        <span className={cn(
                          "text-[15px] font-semibold truncate",
                          sidebarCollapsed && "lg:hidden"
                        )}>
                          {item.name}
                        </span>
                        {isActive && (
                          <span className={cn(
                            "ml-auto h-1.5 w-1.5 rounded-full bg-primary shrink-0",
                            sidebarCollapsed && "lg:hidden"
                          )} />
                        )}
                      </button>
                    )
                  })
                )}
              </nav>
            </ScrollArea>
          </div>

          {/* Rodapé fixo */}
          <div className="border-t border-white/5 p-3 flex-shrink-0">

          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={cn("lg:pl-64 transition-[padding] duration-300 min-h-screen flex flex-col", sidebarCollapsed && "lg:pl-20")}>
        {/* Top bar */}
        {!hideHeader && (
          <header className="sticky top-0 z-30 flex h-20 items-center gap-4 border-b border-border bg-background/50 backdrop-blur-xl px-8 text-foreground flex-shrink-0">
            <Button variant="ghost" size="icon" className="lg:hidden text-foreground hover:bg-white/10" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex text-foreground hover:bg-white/10"
              onClick={toggleSidebarCollapsed}
            >
              <PanelLeft className="h-5 w-5" />
            </Button>

            <div className="flex-1" />

            {userRole === "VENDEDOR" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative text-[#0f1f3f] hover:bg-slate-100">
                    <Bell className="h-5 w-5" />
                    {notifications.length > 0 && (
                      <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 bg-card border-border shadow-2xl p-0">
                  <div className="p-4 border-b border-border bg-background/50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-[10px] uppercase tracking-widest text-foreground">Notificações</h3>
                      <span className="text-[9px] bg-primary text-white px-2 py-0.5 rounded-full font-black">
                        {notifications.length} NOVAS
                      </span>
                    </div>
                    {notifications.length > 0 && (
                      <button
                        onClick={clearNotifications}
                        className="text-[10px] text-zinc-400 hover:text-red-500 transition-colors flex items-center gap-1 font-medium group"
                      >
                        <Trash2 size={12} className="group-hover:scale-110 transition-transform" />
                        Limpar tudo
                      </button>
                    )}
                  </div>
                  <ScrollArea className="max-h-[400px]">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-zinc-400 text-xs italic">
                        Nenhuma notificação por enquanto.
                      </div>
                    ) : (
                      <div className="py-2 w-full overflow-x-hidden">
                        {notifications.map((n) => (
                          <div
                            key={n.id}
                            className="group relative flex items-start gap-3 px-4 py-3 hover:bg-blue-50/30 transition-colors border-b border-border/50 last:border-0 w-full"
                          >
                            <div className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                            <div className="flex-1 min-w-0 pr-8">
                              <p className="text-[11px] font-bold text-foreground leading-snug break-all whitespace-pre-wrap max-w-full">
                                {n.content}
                              </p>
                              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-1 block">
                                {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <button
                              onClick={(e) => deleteNotification(n.id, e)}
                              className="absolute top-3 right-2 p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition-all opacity-40 hover:opacity-100 bg-white/50 z-10"
                              title="Remover"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>

                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-3 text-foreground hover:bg-white/10 px-4 h-11 rounded-xl">
                  <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                    <AvatarFallback className="bg-primary/20 text-primary font-black uppercase">
                      {session?.user?.name?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:flex flex-col items-start leading-none">
                    <span className="font-black text-[11px] uppercase tracking-widest">
                      {session?.user?.name || "Usuário"}
                    </span>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">
                      {userRole || "Acesso"}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 bg-card border-border shadow-2xl p-2 rounded-2xl">
                <DropdownMenuLabel className="text-foreground text-[10px] font-black uppercase tracking-widest p-3">Minha Conta</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border/50" />

                <DropdownMenuItem onClick={handleLogout} className="text-destructive hover:bg-accent">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
        )}

        {/* Page content */}
        <main className={cn(
          "bg-background flex-1",
          hideHeader ? "p-0 overflow-hidden" : "p-8 min-h-[calc(100vh-80px)]"
        )}>{children}</main>
      </div>
    </div>
  )
}
