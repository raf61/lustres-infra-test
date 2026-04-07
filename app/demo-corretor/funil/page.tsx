"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { 
  Bot, User, 
  Search, Plus, 
  MoreHorizontal, 
  Phone, Mail, 
  MessageCircle, 
  Calendar, 
  DollarSign, 
  TrendingUp,
  Shield,
  ArrowRight,
  GripVertical,
  CheckCircle2,
  X,
  CalendarDays
} from "lucide-react"

import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// ─── Types ────────────────────────────────────────────────────────────────────

type LeadType = "PF" | "PJ"
type MoverType = "IA" | "humano"

interface Lead {
  id: string
  name: string
  tipo: LeadType
  seguro: string
  comissao: number
  tempo: string
  mover: MoverType
  phone: string
  email: string
  score: number
  lastActivityAt?: string
  lastMessage?: string
  unreadCount?: number
}

interface Column {
  id: string
  label: string
  headerBgColor: string
  dotColor?: string
  leads: Lead[]
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const NAMES = ["Adriana", "Bruno", "Caio", "Daniela", "Eduardo", "Fernanda", "Gabriel", "Heloísa", "Igor", "Juliana", "Kevin", "Letícia", "Marcos", "Natália", "Otávio", "Priscila", "Ricardo", "Simone", "Thiago", "Vera", "Marcelo", "Larissa", "Gustavo", "Camila", "Felipe"]
const SURNAMES = ["Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes", "Costa", "Carvalho", "Martins", "Barbosa", "Araújo"]
const INSURANCES = ["Seguro Auto", "Seguro Vida", "Residencial", "Empresarial", "RC Obras", "Saúde Individual", "Frota", "Seguro Viagem", "Patrimonial", "Saúde Coletiva"]

function generateMockLeads(count: number, baseId: string, options: { mover?: MoverType, scoreRange?: [number, number] } = {}): Lead[] {
  return Array.from({ length: count }, (_, i) => {
    const name = `${NAMES[Math.floor(Math.random() * NAMES.length)]} ${SURNAMES[Math.floor(Math.random() * SURNAMES.length)]}`
    const isPJ = Math.random() > 0.75
    const tipo: LeadType = isPJ ? "PJ" : "PF"
    const score = options.scoreRange 
      ? Math.floor(Math.random() * (options.scoreRange[1] - options.scoreRange[0])) + options.scoreRange[0]
      : Math.floor(Math.random() * 30) + 70
    
    return {
      id: `${baseId}-${i}`,
      name: isPJ ? `${name} ${Math.random() > 0.5 ? "S.A." : "Ltda"}` : name,
      tipo,
      seguro: INSURANCES[Math.floor(Math.random() * INSURANCES.length)],
      comissao: isPJ ? Math.floor(Math.random() * 15000) + 2000 : Math.floor(Math.random() * 800) + 150,
      tempo: `${Math.floor(Math.random() * 48) + 1}h`,
      mover: options.mover || (Math.random() > 0.3 ? "IA" : "humano"),
      phone: `(11) 9${Math.floor(Math.random() * 89999999 + 10000000)}`,
      email: `${name.toLowerCase().split(" ").join(".")}@exemplo.com.br`,
      score,
      lastActivityAt: Math.random() > 0.5 ? `${Math.floor(Math.random() * 12 + 8)}:${Math.floor(Math.random() * 59).toString().padStart(2, "0")}` : "Ontem",
      lastMessage: Math.random() > 0.4 ? "Aguardando retorno da cotação enviada." : undefined,
      unreadCount: Math.random() > 0.9 ? Math.floor(Math.random() * 3) + 1 : undefined
    }
  })
}

const INITIAL_COLUMNS: Column[] = [
  {
    id: "livres-0", label: "Novas Cotações",
    headerBgColor: "border-slate-500",
    dotColor: "bg-slate-400",
    leads: generateMockLeads(25, "new"),
  },
  {
    id: "livres-1", label: "Contato Inicial",
    headerBgColor: "border-blue-500",
    dotColor: "bg-blue-400",
    leads: generateMockLeads(18, "contact"),
  },
  {
    id: "livres-2", label: "Follow-up 1",
    headerBgColor: "border-amber-500",
    dotColor: "bg-amber-400",
    leads: generateMockLeads(14, "fup1"),
  },
  {
    id: "orcados", label: "Negociação",
    headerBgColor: "border-sky-500",
    leads: generateMockLeads(12, "nego", { mover: "humano", scoreRange: [85, 98] }),
  },
  {
    id: "livres-7", label: "Venda Realizada",
    headerBgColor: "border-emerald-500",
    dotColor: "bg-emerald-400",
    leads: generateMockLeads(35, "won", { scoreRange: [100, 100] }).map(l => ({ ...l, tempo: "fechado" })),
  },
]


// ─── Lead Card Component ──────────────────────────────────────────────────────

function LeadCard({ lead, onClick, isSelected }: { lead: Lead, onClick: (lead: Lead) => void, isSelected?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: lead.id,
    data: {
      type: "Lead",
      lead,
    },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-30 border border-primary/50 bg-muted/20 rounded-lg h-24"
      />
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/card bg-card border border-border rounded-lg p-3 space-y-2 cursor-grab active:cursor-grabbing select-none transition-colors",
        "hover:border-primary/30",
        isSelected && "border-primary/60 ring-1 ring-primary/30"
      )}
      onClick={() => onClick(lead)}
    >
      {/* Selection row */}
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-start gap-2 min-w-0">
          <Checkbox className="h-3.5 w-3.5 mt-0.5 shrink-0" onClick={(e) => e.stopPropagation()} />
          <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2">
            {lead.name}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
           <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-5 w-5 p-0 hover:bg-muted">
                  <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px]">
                 <DropdownMenuItem className="text-xs font-medium">Ver Detalhes</DropdownMenuItem>
                 <DropdownMenuItem className="text-xs font-medium text-destructive">Perder Lead</DropdownMenuItem>
              </DropdownMenuContent>
           </DropdownMenu>
        </div>
      </div>

      {/* Product & Value */}
      <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
             <span className="truncate">{lead.seguro}</span>
             {lead.comissao > 1000 && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 bg-emerald-50 text-emerald-700 border-emerald-100">VENDA ALTA</Badge>
             )}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
             <span className="text-muted-foreground/60 font-normal">Comissão:</span>
             <span>R$ {lead.comissao.toLocaleString("pt-BR")}</span>
          </div>
      </div>

      {/* Status & Last Msg */}
      <div className="border-t border-border/50 pt-2 space-y-1.5">
          {lead.lastMessage ? (
              <div className="flex items-center justify-between gap-2 text-[10px]">
                 <p className="text-muted-foreground truncate flex-1">{lead.lastMessage}</p>
                 <span className="text-muted-foreground/60 shrink-0">• {lead.lastActivityAt}</span>
              </div>
          ) : (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                 <CalendarDays className="h-3 w-3" />
                 <span>Entrou há {lead.tempo}</span>
              </div>
          )}

          <div className="flex items-center justify-between">
             <div className="flex items-center gap-1.5">
                {lead.mover === "IA" ? (
                  <Bot className="h-3 w-3 text-sky-500" />
                ) : (
                  <User className="h-3 w-3 text-amber-500" />
                )}
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-wider",
                  lead.mover === "IA" ? "text-sky-600" : "text-amber-600"
                )}>
                  {lead.mover === "IA" ? "IA Ativa" : "C/ Corretor"}
                </span>
             </div>
             {lead.unreadCount ? (
                <Badge className="h-4 px-1 text-[9px] bg-blue-600 text-white border-none">{lead.unreadCount}</Badge>
             ) : (
                <img src="/icone-zap.png" alt="Zap" className="h-3 w-3 grayscale opacity-30 group-hover/card:grayscale-0 group-hover/card:opacity-100 transition-all" />
             )}
          </div>
      </div>
    </div>
  )
}

// ─── Lead Details Dialog ──────────────────────────────────────────────────────

function LeadDetailsDialog({ lead, open, onClose }: { lead: Lead | null, open: boolean, onClose: () => void }) {
  if (!lead) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-border bg-card shadow-2xl">
        <div className="h-1 w-full bg-primary" />
        
        <div className="p-6">
          <DialogHeader className="flex flex-row items-start justify-between space-y-0 pb-4 border-b border-border/50">
            <div className="flex items-start gap-4 text-left">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg border-2 border-primary/5">
                {lead.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-base font-bold text-foreground">{lead.name}</DialogTitle>
                  <Badge variant="outline" className="text-[9px] uppercase font-bold py-0 h-4">{lead.tipo}</Badge>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1.5"><Phone size={12} className="text-muted-foreground/60" /> {lead.phone}</span>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1.5"><Mail size={12} className="text-muted-foreground/60" /> {lead.email}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Propensão IA</p>
                <div className="text-2xl font-black text-emerald-600 leading-none">{lead.score}%</div>
            </div>
          </DialogHeader>

          <div className="mt-6 grid grid-cols-2 gap-6 bg-muted/20 p-4 rounded-xl border border-border/40">
             <div className="space-y-3">
               <div>
                 <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Produto</p>
                 <p className="text-xs font-bold flex items-center gap-1.5 mt-0.5">
                   <Shield size={13} className="text-primary" /> {lead.seguro}
                 </p>
               </div>
               <div>
                 <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Comissão Estimada</p>
                 <p className="text-xs font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
                   R$ {lead.comissao.toLocaleString("pt-BR")}
                 </p>
               </div>
             </div>
             <div className="space-y-3">
               <div>
                 <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</p>
                 <p className="text-xs font-bold flex items-center gap-1.5 mt-0.5">
                    {lead.tempo !== "fechado" ? `No funil há ${lead.tempo}` : "Concluído"}
                 </p>
               </div>
               <div>
                 <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Responsável</p>
                 <div className="mt-0.5">
                    {lead.mover === "IA" ? (
                      <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                        <Bot size={11} /> IA Sofia
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                        <User size={11} /> Corretor Humano
                      </span>
                    )}
                 </div>
               </div>
             </div>
          </div>

          <div className="mt-6">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Linha do Tempo</h4>
            <div className="space-y-3 pl-1">
              {[
                { time: "09:42", msg: "Proposta de Renovação Auto enviada por Sofia." },
                { time: "Ontem", msg: "Lead clicou no link da campanha de Instagram." },
              ].map((activity, i) => (
                <div key={i} className="flex gap-3 items-start relative pb-2">
                  {i < 1 && <div className="absolute left-[3px] top-4 bottom-0 w-px bg-border" />}
                  <div className="w-2 h-2 rounded-full bg-primary mt-1 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[11px] font-medium text-foreground leading-tight">{activity.msg}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5 uppercase font-bold">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="bg-muted p-4 border-t border-border flex sm:justify-between items-center bg-muted/40">
          <Button variant="ghost" size="sm" className="text-xs font-bold text-muted-foreground h-8 hover:bg-white border">
             <MessageCircle size={14} className="mr-2" /> Chat do Lead
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold bg-white">Transferir</Button>
            <Button size="sm" className="h-8 text-[11px] font-bold">Ver Proposta</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FunilPage() {
  const [columns, setColumns] = useState<Column[]>(INITIAL_COLUMNS)
  const [activeLead, setActiveLead] = useState<Lead | null>(null)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const findColumnOfLead = (leadId: string) => {
    return columns.find(col => col.leads.some(l => l.id === leadId))
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const activeLeadId = active.id as string
    const col = findColumnOfLead(activeLeadId)
    if (col) {
      const lead = col.leads.find(l => l.id === activeLeadId)
      if (lead) setActiveLead(lead)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeCol = findColumnOfLead(activeId)
    const overCol = columns.find(col => col.id === overId) || findColumnOfLead(overId)

    if (!activeCol || !overCol || activeCol === overCol) return

    setColumns(prev => {
      const activeLeads = [...activeCol.leads]
      const overLeads = [...overCol.leads]
      
      const leadIndex = activeLeads.findIndex(l => l.id === activeId)
      const [movedLead] = activeLeads.splice(leadIndex, 1)

      let overIndex = overLeads.findIndex(l => l.id === overId)
      if (overIndex === -1) overIndex = overLeads.length
      
      overLeads.splice(overIndex, 0, movedLead)

      return prev.map(col => {
        if (col.id === activeCol.id) return { ...col, leads: activeLeads }
        if (col.id === overCol.id) return { ...col, leads: overLeads }
        return col
      })
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveLead(null)
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeCol = findColumnOfLead(activeId)
    const overCol = findColumnOfLead(overId)

    if (!activeCol || !overCol || activeCol !== overCol) return

    const oldIndex = activeCol.leads.findIndex(l => l.id === activeId)
    const newIndex = activeCol.leads.findIndex(l => l.id === overId)

    if (oldIndex !== newIndex) {
      setColumns(prev => 
        prev.map(col => {
          if (col.id === activeCol.id) {
            return {
              ...col,
              leads: arrayMove(col.leads, oldIndex, newIndex)
            }
          }
          return col
        })
      )
    }
  }

  const handleCardClick = (lead: Lead) => {
    setSelectedLead(lead)
    setIsDialogOpen(true)
  }

  const stats = useMemo(() => {
    const total = columns.reduce((acc, col) => acc + col.leads.length, 0)
    const revenue = columns.reduce((acc, col) => acc + col.leads.reduce((a, l) => a + l.comissao, 0), 0)
    return { total, revenue }
  }, [columns])

  return (
    <div className="flex flex-col h-full space-y-4 overflow-hidden -mt-2">
      {/* Header — Estilo Original */}
      <div className="flex items-center justify-between flex-shrink-0 px-1 py-1">
        <div className="space-y-0.5">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Pipeline de Vendas
          </h1>
          <p className="text-[11px] text-muted-foreground flex items-center gap-2">
             <Bot className="h-3.5 w-3.5 text-sky-500" /> 
             I.A. moveu <span className="font-bold text-foreground">82%</span> dos leads este mês
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 bg-muted/30 border-border/60 border rounded-lg px-3 py-1.5">
             <div className="text-right">
                <p className="text-[9px] font-bold text-muted-foreground uppercase leading-none">Total leads</p>
                <p className="text-sm font-black leading-none mt-1">{stats.total}</p>
             </div>
             <div className="w-px h-6 bg-border/60" />
             <div className="text-right">
                <p className="text-[9px] font-bold text-muted-foreground uppercase leading-none">Comissão Proj.</p>
                <p className="text-sm font-black text-emerald-600 leading-none mt-1">R$ {(stats.revenue / 1000).toFixed(1)}k</p>
             </div>
          </div>
          <div className="relative">
             <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
             <input 
              placeholder="Buscar no funil..." 
              className="h-8 pl-8 pr-4 bg-card border-border border rounded-md text-[11px] outline-none focus:ring-1 focus:ring-primary w-40"
             />
          </div>
          <Button size="sm" className="h-8 rounded-md font-bold text-xs bg-primary hover:bg-primary/90">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Novo Lead
          </Button>
        </div>
      </div>

      {/* Kanban Board — Seguindo a UI original */}
      <div className="flex-1 overflow-x-auto min-h-0 select-none scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 h-full pb-4 min-w-max">
            {columns.map(col => (
              <div key={col.id} className="flex flex-col w-64 h-full rounded-lg border border-border/60 overflow-hidden bg-card transition-colors">
                {/* Header — Inspiração Original */}
                <div className={cn("px-3 py-2 flex items-center justify-between border-b-2 shrink-0 bg-card", col.headerBgColor)}>
                   <div className="flex items-center gap-2 min-w-0">
                      {col.leads.length > 0 && <Checkbox className="h-3.5 w-3.5 shrink-0" onClick={(e) => e.stopPropagation()} />}
                      {col.dotColor && <span className={cn("w-2 h-2 rounded-full shrink-0", col.dotColor)} />}
                      <h3 className="text-xs font-bold text-foreground truncate">{col.label}</h3>
                   </div>
                   <div className="flex items-center gap-1.5">
                      <span className="text-[10px] bg-background/50 px-1.5 py-0.5 rounded-full font-bold text-foreground">
                        {col.leads.length}
                      </span>
                   </div>
                </div>
                
                {/* Body — Inspiração Original (p-2 bg-secondary/30) */}
                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full bg-secondary/30">
                    <div className="p-2 space-y-2 min-h-[400px]">
                      <SortableContext id={col.id} items={col.leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
                        {col.leads.map(l => (
                          <LeadCard key={l.id} lead={l} onClick={handleCardClick} />
                        ))}
                        {col.leads.length === 0 && (
                          <p className="text-[10px] text-muted-foreground/60 text-center py-6 italic">Nenhum lead</p>
                        )}
                      </SortableContext>
                    </div>
                  </ScrollArea>
                </div>
              </div>
            ))}
          </div>

          <DragOverlay dropAnimation={{
            duration: 200,
            sideEffects: defaultDropAnimationSideEffects({
              styles: {
                active: {
                  opacity: '0.5',
                },
              },
            }),
          }}>
            {activeLead ? (
              <div className="w-60 bg-card border border-primary p-3 rounded-lg shadow-xl rotate-1 scale-102 pointer-events-none">
                <p className="text-xs font-bold">{activeLead.name}</p>
                <p className="text-[10px] text-muted-foreground">{activeLead.seguro}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <LeadDetailsDialog 
        lead={selectedLead} 
        open={isDialogOpen} 
        onClose={() => setIsDialogOpen(false)} 
      />
    </div>
  )
}
