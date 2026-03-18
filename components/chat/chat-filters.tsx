"use client";

import { useEffect, useState } from "react";
import { useChat, ChatFilters as Filters } from "@/lib/chat";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Inbox, Clock, CheckCircle, MessageSquare, User, Users, Search, Bot } from "lucide-react";
import type { StatusCounts } from "@/lib/chat/api";
import { NewConversationDialog } from "./new-conversation-dialog";
import { ContactSearchDialog } from "./contact-search-dialog";

type VendorOption = {
  id: string;
  name: string | null;
  email?: string | null;
};

interface ChatFiltersProps {
  onAiFilterChange?: (showAiOnly: boolean) => void;
}

export function ChatFilters({ onAiFilterChange }: ChatFiltersProps = {}) {
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [showAiOnly, setShowAiOnly] = useState(false);

  const handleAiToggle = () => {
    const next = !showAiOnly;
    setShowAiOnly(next);
    onAiFilterChange?.(next);
  };

  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [vendorsLoaded, setVendorsLoaded] = useState(false);
  const { state, setFilters, statusCounts, openConversationById } = useChat();
  const { filters, inboxes = [], isConnected } = state;
  const { data: session } = useSession();
  const role = (session?.user as { role?: string | null })?.role ?? null;
  const isVendedor = role === "VENDEDOR";
  const isMasterOrAdmin = role === "MASTER" || role === "ADMINISTRADOR";
  const shouldShowAssigneeSelect = isMasterOrAdmin && filters.assignee === "all";

  const assigneeTabs: Array<{
    value: Filters["assignee"];
    label: string;
    icon: React.ReactNode;
  }> = [
      {
        value: "me",
        label: "Minhas",
        icon: <User className="h-3.5 w-3.5" />,
      },
      {
        value: "all",
        label: "Todas",
        icon: <Users className="h-3.5 w-3.5" />,
      },
    ];

  useEffect(() => {
    if (isVendedor && filters.assignee !== "me") {
      setFilters({ assignee: "me", assigneeId: null });
    }
  }, [filters.assignee, isVendedor, setFilters]);

  useEffect(() => {
    if (!shouldShowAssigneeSelect || vendorsLoaded) return;
    const loadVendors = async () => {
      try {
        const response = await fetch("/api/vendedores");
        if (!response.ok) return;
        const data = await response.json();
        setVendors(data?.data || []);
        setVendorsLoaded(true);
      } catch (error) {
        console.error("[Chat] Failed to load vendors:", error);
      }
    };
    loadVendors();
  }, [shouldShowAssigneeSelect, vendorsLoaded]);

  const statusTabs: Array<{
    value: Filters["status"];
    label: string;
    icon: React.ReactNode;
    countKey: keyof StatusCounts;
  }> = [
      {
        value: "open",
        label: "Abertas",
        icon: <MessageSquare className="h-3.5 w-3.5" />,
        countKey: "open",
      },
      {
        value: "waiting",
        label: "Esperando",
        icon: <Clock className="h-3.5 w-3.5" />,
        countKey: "waiting",
      },
      {
        value: "resolved",
        label: "Resolvidas",
        icon: <CheckCircle className="h-3.5 w-3.5" />,
        countKey: "resolved",
      },
    ];

  return (
    <div className="p-4 border-b border-border space-y-3 bg-background/50">
      {/* Header com busca e nova conversa */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-sm font-bold text-foreground uppercase tracking-widest">
              Central de Chat
            </h2>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-[8px] font-bold text-emerald-500 border border-emerald-500/20 uppercase tracking-widest kpi-glow">
              <div className={cn("h-1 w-1 rounded-full animate-pulse", isConnected ? "bg-emerald-500" : "bg-red-500")} />
              {isConnected ? "Live" : "Offline"}
            </div>
          </div>
          <NewConversationDialog
            inboxId={filters.inboxId}
            openConversationById={openConversationById}
            className="h-8 px-3 text-[9px] font-bold uppercase tracking-widest rounded-lg bg-primary text-white shadow-lg kpi-glow border-none hover:bg-primary/90"
          />
        </div>

        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            readOnly
            onClick={() => setSearchDialogOpen(true)}
            placeholder="Buscar por cliente ou telefone..."
            className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold uppercase tracking-widest text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all cursor-pointer hover:border-primary/30"
          />
        </div>
      </div>

      {/* Nível 1: Minhas | Todas */}
      <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg border border-border/50 shadow-inner">
        {assigneeTabs.map((tab) => (
          <Button
            key={tab.value}
            variant="ghost"
            size="sm"
            onClick={() =>
              setFilters(
                tab.value === "me"
                  ? { assignee: tab.value, assigneeId: null }
                  : { assignee: tab.value }
              )
            }
            className={cn(
              "flex-1 h-7 text-[10px] font-bold uppercase tracking-widest gap-2 transition-all rounded-md shadow-none",
              filters.assignee === tab.value
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            {tab.icon}
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Nível 2: Status */}
      <div className="flex gap-1.5">
        {statusTabs.map((tab) => {
          const count = statusCounts[tab.countKey] || 0;
          const isActive = filters.status === tab.value;

          return (
            <button
              key={tab.value}
              onClick={() => setFilters({ status: tab.value })}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-2 rounded-xl border transition-all relative overflow-hidden",
                isActive
                  ? "bg-primary border-primary text-white shadow-lg"
                  : "bg-card/80 border-border text-foreground hover:border-primary/40 hover:bg-primary/5"
              )}
            >
              <div className={cn("mb-1", isActive ? "text-white" : "text-muted-foreground")}>
                {tab.icon}
              </div>
              <span className={cn("text-[8px] font-bold uppercase tracking-widest", isActive ? "text-white" : "text-foreground/70")}>{tab.label}</span>
              {count > 0 && (
                <div className={cn(
                  "absolute top-1.5 right-1.5 h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full text-[8px] font-black shadow ring-1 ring-background",
                  isActive ? "bg-white text-primary" : "bg-primary text-white"
                )}>
                  {count > 99 ? "99+" : count}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Filtros de Vendedor e Caixa + IA */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={filters.assigneeId || "all"}
            onValueChange={(value) =>
              setFilters({ assigneeId: value === "all" ? null : value })
            }
            disabled={!shouldShowAssigneeSelect}
          >
            <SelectTrigger className="h-7 text-[9px] font-bold uppercase tracking-widest bg-card border-border rounded-lg">
              <SelectValue placeholder="Vendedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Filtro Vendedor</SelectItem>
              {vendors.map((vendor) => (
                <SelectItem key={vendor.id} value={vendor.id} className="text-[9px] font-bold uppercase tracking-widest">
                  {vendor.name || vendor.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.inboxId || inboxes[0]?.id || ""}
            onValueChange={(value) => setFilters({ inboxId: value })}
          >
            <SelectTrigger className="h-7 text-[9px] font-bold uppercase tracking-widest bg-card border-border rounded-lg">
              <SelectValue placeholder="Canais" />
            </SelectTrigger>
            <SelectContent>
              {inboxes.map((inbox) => (
                <SelectItem key={inbox.id} value={inbox.id} className="text-[9px] font-bold uppercase tracking-widest">
                  {inbox.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filtro de IA — front-end apenas */}
        <button
          onClick={handleAiToggle}
          className={cn(
            "w-full flex items-center justify-center gap-1.5 h-7 rounded-lg border text-[9px] font-bold uppercase tracking-widest transition-all",
            showAiOnly
              ? "bg-orange-500 border-orange-500 text-white shadow-md"
              : "bg-card border-border text-muted-foreground hover:border-orange-500/40 hover:text-orange-400"
          )}
        >
          <Bot className="h-3 w-3" />
          {showAiOnly ? "Só com I.A. ✓" : "Filtrar com I.A."}
        </button>
      </div>

      {/* Dialogs */}
      {filters.inboxId && (
        <ContactSearchDialog
          open={searchDialogOpen}
          onOpenChange={setSearchDialogOpen}
          inboxId={filters.inboxId}
        />
      )}
    </div>
  );
}
