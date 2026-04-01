"use client";

import { useEffect, useState } from "react";
import { useChat, ChatFilters as Filters } from "@/lib/chat";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MessageSquare, Clock, CheckCircle, User, Users, Search, Bot } from "lucide-react";
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

  const assigneeTabs: Array<{ value: Filters["assignee"]; label: string }> = [
    { value: "me", label: "Minhas" },
    { value: "all", label: "Todas" },
  ];

  const statusTabs: Array<{
    value: Filters["status"];
    label: string;
    countKey: keyof StatusCounts;
  }> = [
    { value: "open", label: "Abertas", countKey: "open" },
    { value: "waiting", label: "Aguardando", countKey: "waiting" },
    { value: "resolved", label: "Resolvidas", countKey: "resolved" },
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

  return (
    <div className="flex flex-col border-b border-border">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold text-foreground tracking-tight">Conversas</h2>
            <div className={cn(
              "h-1.5 w-1.5 rounded-full shrink-0",
              isConnected ? "bg-emerald-500" : "bg-red-400"
            )} title={isConnected ? "Conectado" : "Desconectado"} />
          </div>
          <NewConversationDialog
            inboxId={filters.inboxId}
            openConversationById={openConversationById}
            className="h-7 px-3 text-xs font-medium rounded-lg bg-primary text-white border-none hover:bg-primary/90 transition-colors"
          />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            readOnly
            onClick={() => setSearchDialogOpen(true)}
            placeholder="Buscar contato ou telefone..."
            className="w-full bg-muted/60 border-0 rounded-xl pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all cursor-pointer hover:bg-muted/80"
          />
        </div>
      </div>

      {/* Assignee tabs */}
      {!isVendedor && (
        <div className="flex px-3 gap-1 pb-2">
          {assigneeTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() =>
                setFilters(
                  tab.value === "me"
                    ? { assignee: tab.value, assigneeId: null }
                    : { assignee: tab.value }
                )
              }
              className={cn(
                "flex-1 py-1.5 rounded-lg text-xs font-medium transition-all",
                filters.assignee === tab.value
                  ? "bg-primary text-white"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Status tabs */}
      <div className="flex px-3 gap-1 pb-3">
        {statusTabs.map((tab) => {
          const count = statusCounts[tab.countKey] || 0;
          const isActive = filters.status === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setFilters({ status: tab.value })}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-all",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {tab.label}
              {count > 0 && (
                <span className={cn(
                  "inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold",
                  isActive ? "bg-primary text-white" : "bg-muted-foreground/20 text-muted-foreground"
                )}>
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Compact filters row */}
      <div className="px-3 pb-3 space-y-1.5">
        <div className="flex items-center gap-1.5">
          {shouldShowAssigneeSelect && (
            <Select
              value={filters.assigneeId || "all"}
              onValueChange={(value) =>
                setFilters({ assigneeId: value === "all" ? null : value })
              }
            >
              <SelectTrigger className="h-7 text-xs bg-muted/60 border-0 rounded-lg flex-1 focus:ring-primary/30">
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos os vendedores</SelectItem>
                {vendors.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id} className="text-xs">
                    {vendor.name || vendor.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select
            value={filters.inboxId || inboxes[0]?.id || ""}
            onValueChange={(value) => setFilters({ inboxId: value })}
          >
            <SelectTrigger className="h-7 text-xs bg-muted/60 border-0 rounded-lg flex-1 focus:ring-primary/30">
              <SelectValue placeholder="Canal" />
            </SelectTrigger>
            <SelectContent>
              {inboxes.map((inbox) => (
                <SelectItem key={inbox.id} value={inbox.id} className="text-xs">
                  {inbox.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Bot button: inline when only 1 select, else on next row */}
          {!shouldShowAssigneeSelect && (
            <button
              onClick={handleAiToggle}
              title={showAiOnly ? "Mostrar todas" : "Filtrar conversas com IA ativa"}
              className={cn(
                "h-7 w-7 shrink-0 rounded-lg flex items-center justify-center transition-all",
                showAiOnly
                  ? "bg-orange-500 text-white"
                  : "bg-muted/60 text-muted-foreground hover:text-orange-500 hover:bg-orange-50"
              )}
            >
              <Bot className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Bot button on its own row when 2 selects are visible */}
        {shouldShowAssigneeSelect && (
          <button
            onClick={handleAiToggle}
            title={showAiOnly ? "Mostrar todas" : "Filtrar conversas com IA ativa"}
            className={cn(
              "h-7 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-all",
              showAiOnly
                ? "bg-orange-500 text-white"
                : "bg-muted/60 text-muted-foreground hover:text-orange-500 hover:bg-orange-50"
            )}
          >
            <Bot className="h-3.5 w-3.5" />
            {showAiOnly ? "Somente IA" : "Filtrar por I.A."}
          </button>
        )}
      </div>

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
