"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  LayoutDashboard,
  GitPullRequestArrow,
  MessageSquare,
  Leaf,
  Megaphone,
  Users,
  Shield,
  Zap,
  BarChart2,
  UserSquare2,
  CalendarDays,
} from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { label: "Dashboard",            href: "/demo-corretor",                    icon: LayoutDashboard },
  { label: "Pipeline de Vendas",   href: "/demo-corretor/funil",              icon: GitPullRequestArrow },
  { label: "WhatsApp",             href: "/demo-corretor/whatsapp",           icon: MessageSquare },
  { label: "Nutrição de Leads",    href: "/demo-corretor/nutricao",           icon: Leaf },
  { label: "Campanhas",            href: "/demo-corretor/campanhas",          icon: Megaphone },
  { label: "Base de Clientes",     href: "/demo-corretor/clientes",           icon: Users },
  { label: "Análise de Leads",     href: "/demo-corretor/analise-leads",      icon: BarChart2 },
  { label: "Análise de Vendedores",href: "/demo-corretor/analise-vendedores", icon: UserSquare2 },
  { label: "Renovações",            href: "/demo-corretor/renovacoes",         icon: CalendarDays },
]

export default function DemoCorretorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isWhatsApp = pathname === "/demo-corretor/whatsapp"

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-60 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 px-4 border-b border-sidebar-border flex-shrink-0">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center shadow-sm">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-semibold text-[13px] text-sidebar-foreground tracking-tight">SegureAI</span>
            <span className="text-[9px] text-sidebar-foreground/40 font-medium mt-0.5 tracking-wide">Plataforma para Corretoras</span>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full py-3">
            <nav className="px-2 space-y-px">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-all duration-100 text-left group",
                      isActive
                        ? "bg-sidebar-primary/15 text-sidebar-primary font-medium"
                        : "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive ? "text-sidebar-primary" : "text-sidebar-foreground/35 group-hover:text-sidebar-foreground/70"
                      )}
                    />
                    <span className="text-[12px] truncate">{item.label}</span>
                    {isActive && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary shrink-0" />
                    )}
                  </Link>
                )
              })}
            </nav>
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="border-t border-sidebar-border px-3 py-3 flex-shrink-0">
          <div className="flex items-center gap-2 px-1">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Zap className="w-3 h-3 text-emerald-400" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[11px] font-medium text-sidebar-foreground leading-none">Sofia — IA Ativa</span>
              <span className="text-[9px] text-sidebar-foreground/40 mt-0.5">23 conversas em andamento</span>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className={cn("pl-60 flex flex-col flex-1", isWhatsApp ? "h-screen overflow-hidden" : "min-h-screen")}>
        {/* Top bar — hidden on WhatsApp */}
        {!isWhatsApp && (
          <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-border bg-card px-6 text-foreground flex-shrink-0">
            <span className="text-xs text-muted-foreground">Demo — Corretora de Seguros</span>
            <div className="flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              IA Ativa
            </div>
            <div className="flex-1" />
            <span className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">SegureAI</span> · Plano Empresarial
            </span>
          </header>
        )}

        {/* Page content */}
        <main className={cn(
          "bg-background flex-1",
          isWhatsApp ? "p-0 h-full overflow-hidden flex flex-col" : "p-6"
        )}>
          {children}
        </main>
      </div>
    </div>
  )
}
