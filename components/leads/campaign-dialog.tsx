"use client"

import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  Bot, Send, Users, Loader2, Sparkles, MessageSquare,
  Search, Filter, X, Info, Megaphone, Braces, CheckSquare,
  Square, ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CampaignDialogProps {
  open: boolean
  onClose: () => void
  selectedCount: number
  selectedClients: Array<{ id: string; nomeSindico?: string | null; telefoneSindico?: string | null }>
  vendedores: { id: string; name: string }[]
}

// ─── Mock CRM recipients (realistic data) ─────────────────────────────────────

const KANBAN_STAGES = [
  { code: 0, label: "A fazer contato",  cls: "bg-slate-100 text-slate-600 border-slate-200" },
  { code: 1, label: "Contato feito",    cls: "bg-blue-100 text-blue-700 border-blue-200" },
  { code: 2, label: "Follow-up 1",      cls: "bg-amber-100 text-amber-700 border-amber-200" },
  { code: 3, label: "Follow-up 2",      cls: "bg-orange-100 text-orange-700 border-orange-200" },
  { code: 4, label: "Interessado",      cls: "bg-sky-100 text-sky-700 border-sky-200" },
  { code: 5, label: "Negociando",       cls: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { code: 6, label: "Venda Realizada",  cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { code: 7, label: "Perdido",          cls: "bg-red-100 text-red-700 border-red-200" },
]

const BAIRROS = ["Benfica","Recreio","Barra da Tijuca","Ipanema","Copacabana","Centro","Tijuca","Botafogo","Flamengo","Madureira"]
const NOMES = [
  "Carlos Mendonça","Fernanda Lima","Ricardo Alves","Patrícia Souza","Eduardo Rocha",
  "Juliana Costa","Marcelo Ferreira","Amanda Pereira","Bruno Teixeira","Larissa Nunes",
  "Rafael Cardoso","Camila Martins","Gustavo Barbosa","Renata Carvalho","Felipe Araújo",
  "Mônica Pinto","Thiago Gomes","Vanessa Oliveira","Leandro Santos","Tatiana Correia",
  "Rodrigo Melo","Priscila Ribeiro","Fábio Nascimento","Sandra Moreira","André Sousa",
]
const CONDOMINIOS = [
  "Cond. Jardim das Flores","Ed. Solar dos Pinheiros","Res. Nova Lisboa","Cond. Bela Vista",
  "Ed. Porto Seguro","Res. Das Palmeiras","Cond. Alto da Serra","Ed. Parque Verde",
  "Res. Brisa do Mar","Cond. Vila Real","Ed. Monte Alegre","Res. Primavera",
]

const INSURANCES = ["Seguro Auto", "Seguro Vida", "Residencial", "Empresarial", "RC Obras", "Saúde Individual", "Frota", "Seguro Viagem"]

const MOCK_CLIENTS = Array.from({ length: 280 }, (_, i) => {
  const seed = (i * 1337 + 7) % 1000
  const mesesSemContato = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12][i % 10]
  const temOrcamento = seed % 3 !== 0
  return {
    id: `c${i}`,
    nomeSindico: NOMES[i % NOMES.length],
    condominio: CONDOMINIOS[i % CONDOMINIOS.length],
    phone: `(21) 9${(10000000 + (i * 31337) % 90000000).toString().padStart(8, "0")}`,
    bairro: BAIRROS[i % BAIRROS.length],
    kanbanCode: i % 8,
    categoria: (["ativo", "agendado", "explorado"] as const)[i % 3],
    mesesSemContato,
    temOrcamento,
    valorUltimoOrcamento: temOrcamento ? 1000 + (seed * 47) % 15000 : 0,
    seguro: INSURANCES[i % INSURANCES.length],
    score: 60 + (seed % 40)
  }
})

// ─── Message templates ────────────────────────────────────────────────────────

const TEMPLATES = [
  { id: "1", name: "Renovação Seguro Auto",    desc: "Aviso de vencimento de apólice",        content: "Olá {{contact.name}}, aqui é da nossa Corretora. Notei que seu Seguro Auto está próximo do vencimento. Posso te enviar as melhores cotações de renovação?" },
  { id: "2", name: "Seguro Residencial Condomínio", desc: "Oferta para unidades autônomas", content: "Prezado {{contact.name}}, temos uma condição especial de Seguro Residencial para o {{contact.condominio}}. Gostaria de proteger seu patrimônio por menos de R$ 1/dia?" },
  { id: "3", name: "Análise de Riscos (PJ)",   desc: "Consultoria para seguros empresariais", content: "Olá {{contact.name}}! Podemos agendar uma rápida conversa para avaliar os riscos da sua empresa e otimizar seus custos com seguros?" },
  { id: "4", name: "Follow-up Cotação",       desc: "Recontato para cotações enviadas",     content: "Oi {{contact.name}}, tudo bem? Passando para ver se conseguiu analisar as cotações que te enviei. Alguma dúvida?" },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function CampaignDialog({ open, onClose, selectedClients, vendedores }: CampaignDialogProps) {
  const { toast } = useToast()

  // Campaign config
  const [isAI, setIsAI] = useState(true)
  const [campaignName, setCampaignName] = useState("")
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [customMessage, setCustomMessage] = useState("")
  const [aiInstructions, setAiInstructions] = useState("Aja como um corretor de seguros sênior. Seja cordial, técnico e breve. Foque em agendar uma conversa, tirar dúvidas sobre coberturas ou confirmar o recebimento da cotação.")
  const [selectedVendedor, setSelectedVendedor] = useState("")
  const [sending, setSending] = useState(false)

  // Recipient filters
  const [search, setSearch] = useState("")
  const [filterKanban, setFilterKanban] = useState<number[]>([])
  const [filterCategoria, setFilterCategoria] = useState<string[]>([])
  const [filterBairro, setFilterBairro] = useState("")
  const [filterMesesSemContato, setFilterMesesSemContato] = useState<number | null>(null)
  const [filterOrcamento, setFilterOrcamento] = useState<"todos" | "com" | "sem">("todos")
  const [filterSeguro, setFilterSeguro] = useState("")
  const [filterMinScore, setFilterMinScore] = useState<number>(0)

  // Selected recipients
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(selectedClients.map(c => c.id))
  )
  const [showFilters, setShowFilters] = useState(false)

  // Apply filters
  const filteredClients = useMemo(() => {
    return MOCK_CLIENTS.filter(c => {
      if (search) {
        const q = search.toLowerCase()
        if (!c.nomeSindico.toLowerCase().includes(q) && !c.phone.includes(q) && !c.condominio.toLowerCase().includes(q)) return false
      }
      if (filterKanban.length > 0 && !filterKanban.includes(c.kanbanCode)) return false
      if (filterCategoria.length > 0 && !filterCategoria.includes(c.categoria)) return false
      if (filterBairro && c.bairro !== filterBairro) return false
      if (filterMesesSemContato !== null && c.mesesSemContato < filterMesesSemContato) return false
      if (filterOrcamento === "com" && !c.temOrcamento) return false
      if (filterOrcamento === "sem" && c.temOrcamento) return false
      if (filterSeguro && c.seguro !== filterSeguro) return false
      if (c.score < filterMinScore) return false
      return true
    })
  }, [search, filterKanban, filterCategoria, filterBairro, filterMesesSemContato, filterOrcamento, filterSeguro, filterMinScore])

  const activeFilterCount = [
    filterKanban.length > 0,
    filterCategoria.length > 0,
    !!filterBairro,
    filterMesesSemContato !== null,
    filterOrcamento !== "todos",
    !!filterSeguro,
    filterMinScore > 0,
  ].filter(Boolean).length

  const toggleKanban = (code: number) =>
    setFilterKanban(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code])

  const toggleCategoria = (cat: string) =>
    setFilterCategoria(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])

  const selectAll = () => setSelectedIds(new Set(filteredClients.map(c => c.id)))
  const clearAll  = () => setSelectedIds(new Set())
  const toggleId  = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectedInFiltered = filteredClients.filter(c => selectedIds.has(c.id)).length

  const handleFire = () => {
    if (!campaignName.trim()) {
      toast({ title: "Nome da campanha obrigatório", variant: "destructive" }); return
    }
    if (selectedIds.size === 0) {
      toast({ title: "Selecione ao menos um destinatário", variant: "destructive" }); return
    }
    setSending(true)
    setTimeout(() => {
      setSending(false)
      toast({ title: "Campanha iniciada", description: `Disparo para ${selectedIds.size} destinatários em processamento.` })
      onClose()
    }, 2000)
  }

  const clearFilters = () => {
    setFilterKanban([]); setFilterCategoria([]); setFilterBairro("")
    setFilterMesesSemContato(null); setFilterOrcamento("todos"); setSearch("")
    setFilterSeguro(""); setFilterMinScore(0)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[82rem] p-0 overflow-hidden border border-border bg-background flex flex-col h-[90vh]">

        {/* ── Header ── */}
        <div className="border-b border-border px-5 py-4 bg-muted/20 shrink-0 flex items-center justify-between">
          <div>
            <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-primary" />
              Nova Campanha
            </DialogTitle>
            <DialogDescription className="text-[11px] text-muted-foreground mt-0.5">
              Selecione os destinatários e configure o disparo
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span><span className="font-bold text-foreground">{selectedIds.size}</span> selecionados</span>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* ── Left: Recipient Selector ── */}
          <div className="w-[22rem] border-r border-border flex flex-col shrink-0 bg-muted/10">

            {/* Search + filter toggle */}
            <div className="p-3 border-b border-border space-y-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Nome, condomínio ou telefone..."
                  className="w-full h-8 pl-8 pr-3 text-[11px] bg-background border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowFilters(v => !v)}
                  className={cn(
                    "flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-lg transition-all",
                    showFilters ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Filter className="h-3 w-3" />
                  Filtros
                  {activeFilterCount > 0 && (
                    <span className={cn("h-4 w-4 rounded-full text-[9px] font-bold flex items-center justify-center",
                      showFilters ? "bg-white text-primary" : "bg-primary text-white"
                    )}>
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="font-medium text-foreground">{filteredClients.length}</span> de {MOCK_CLIENTS.length}
                </div>
              </div>
            </div>

            {/* Filters panel */}
            {showFilters && (
              <div className="border-b border-border bg-background p-3 space-y-3 shrink-0">
                {/* Kanban stage */}
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Estágio no pipeline</p>
                  <div className="flex flex-wrap gap-1">
                    {KANBAN_STAGES.map(s => (
                      <button
                        key={s.code}
                        onClick={() => toggleKanban(s.code)}
                        className={cn(
                          "text-[9px] font-medium px-1.5 py-0.5 rounded border transition-all",
                          filterKanban.includes(s.code) ? s.cls : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Categoria */}
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Categoria do lead</p>
                  <div className="flex gap-1">
                    {[
                      { v: "ativo",      l: "Ativo",    cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
                      { v: "agendado",   l: "Agendado", cls: "bg-sky-100 text-sky-700 border-sky-200" },
                      { v: "explorado",  l: "Explorado",cls: "bg-slate-100 text-slate-600 border-slate-200" },
                    ].map(c => (
                      <button
                        key={c.v}
                        onClick={() => toggleCategoria(c.v)}
                        className={cn(
                          "text-[10px] font-medium px-2 py-1 rounded border transition-all",
                          filterCategoria.includes(c.v) ? c.cls : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                        )}
                      >
                        {c.l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bairro */}
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Bairro</p>
                  <select
                    value={filterBairro}
                    onChange={e => setFilterBairro(e.target.value)}
                    className="w-full h-7 text-[10px] bg-background border border-border rounded-lg px-2 outline-none focus:ring-1 focus:ring-primary/30 appearance-none"
                  >
                    <option value="">Todos os bairros</option>
                    {BAIRROS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                {/* Seguro */}
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Produto de Seguro</p>
                  <select
                    value={filterSeguro}
                    onChange={e => setFilterSeguro(e.target.value)}
                    className="w-full h-7 text-[10px] bg-background border border-border rounded-lg px-2 outline-none focus:ring-1 focus:ring-primary/30 appearance-none"
                  >
                    <option value="">Todos os produtos</option>
                    {INSURANCES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>

                {/* Score */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground">Score IA Mínimo</p>
                    <span className="text-[10px] font-bold text-primary">{filterMinScore}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="100" step="5"
                    value={filterMinScore}
                    onChange={e => setFilterMinScore(Number(e.target.value))}
                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

                {/* Sem contato há */}
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Sem contato há pelo menos</p>
                  <div className="flex gap-1">
                    {[null,1,2,3,6,12].map(m => (
                      <button
                        key={String(m)}
                        onClick={() => setFilterMesesSemContato(m)}
                        className={cn(
                          "text-[10px] font-medium px-2 py-1 rounded border transition-all",
                          filterMesesSemContato === m
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                        )}
                      >
                        {m === null ? "Todos" : `${m}m`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Orçamento */}
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Orçamento</p>
                  <div className="flex gap-1">
                    {[
                      { v: "todos", l: "Todos" },
                      { v: "com",   l: "Com orçamento" },
                      { v: "sem",   l: "Sem orçamento" },
                    ].map(o => (
                      <button
                        key={o.v}
                        onClick={() => setFilterOrcamento(o.v as "todos"|"com"|"sem")}
                        className={cn(
                          "text-[10px] font-medium px-2 py-1 rounded border transition-all",
                          filterOrcamento === o.v
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                        )}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>

                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                  >
                    <X className="h-3 w-3" />Limpar filtros
                  </button>
                )}
              </div>
            )}

            {/* Select/clear all */}
            <div className="px-3 py-2 border-b border-border shrink-0 flex items-center justify-between bg-muted/5">
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAll}
                  className="text-[10px] font-medium text-primary hover:underline flex items-center gap-1"
                >
                  <CheckSquare className="h-3 w-3" />Selecionar todos ({filteredClients.length})
                </button>
              </div>
              <button
                onClick={clearAll}
                className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
              >
                <Square className="h-3 w-3" />Limpar
              </button>
            </div>

            {/* Client list */}
            <ScrollArea className="flex-1">
              <div className="divide-y divide-border/40">
                {filteredClients.length === 0 ? (
                  <div className="p-6 text-center text-[11px] text-muted-foreground">
                    Nenhum destinatário com esses filtros
                  </div>
                ) : filteredClients.map(c => {
                  const stage = KANBAN_STAGES.find(s => s.code === c.kanbanCode)
                  const checked = selectedIds.has(c.id)
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleId(c.id)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors",
                        checked ? "bg-primary/5" : "hover:bg-muted/40"
                      )}
                    >
                      <div className={cn(
                        "h-3.5 w-3.5 rounded border shrink-0 mt-0.5 flex items-center justify-center transition-colors",
                        checked ? "bg-primary border-primary" : "border-border bg-background"
                      )}>
                        {checked && <span className="text-white text-[8px] font-bold leading-none">✓</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-foreground truncate leading-tight">{c.nomeSindico}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{c.condominio}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className={cn("text-[8px] font-medium px-1 py-0.5 rounded border", stage?.cls)}>
                            {stage?.label}
                          </span>
                          <span className="text-[9px] text-muted-foreground/60">{c.bairro}</span>
                          <span className="text-muted-foreground/40 text-[9px]">•</span>
                          <span className="text-[9px] font-bold text-emerald-600">{c.score}%</span>
                        </div>
                        <p className="text-[9px] text-primary/70 mt-0.5 font-medium">{c.seguro}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>

            {/* Selection summary */}
            <div className="px-3 py-2 border-t border-border bg-muted/10 shrink-0">
              <p className="text-[10px] text-muted-foreground">
                <span className="font-semibold text-foreground">{selectedInFiltered}</span> selecionados nessa listagem ·{" "}
                <span className="font-semibold text-primary">{selectedIds.size}</span> no total
              </p>
            </div>
          </div>

          {/* ── Right: Campaign Config ── */}
          <ScrollArea className="flex-1 bg-background">
            <div className="p-6 space-y-6 max-w-2xl">

              {/* Campaign name */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-muted-foreground">Nome da campanha</Label>
                <Input
                  placeholder="Ex: Campanha de Renovação — Abril"
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  className="h-9 border-border text-sm"
                />
              </div>

              {/* AI toggle + vendor */}
              <div className="border border-border rounded-xl p-4 space-y-4 bg-muted/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Bot className={cn("h-4 w-4", isAI ? "text-primary" : "text-muted-foreground")} />
                    <div>
                      <p className="text-[12px] font-semibold text-foreground">Assistência por I.A.</p>
                      <p className="text-[10px] text-muted-foreground">Respostas automáticas e qualificação</p>
                    </div>
                  </div>
                  <Switch checked={isAI} onCheckedChange={setIsAI} />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-muted-foreground">Consultor responsável</Label>
                  <select
                    className="w-full bg-background border border-border rounded-lg h-8 px-3 text-[12px] outline-none focus:ring-1 focus:ring-primary/30 appearance-none"
                    value={selectedVendedor}
                    onChange={e => setSelectedVendedor(e.target.value)}
                  >
                    <option value="">Manter atual do lead</option>
                    {vendedores.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Templates */}
              <div className="space-y-2">
                <Label className="text-[11px] font-medium text-muted-foreground">Template de mensagem</Label>
                <div className="space-y-1.5">
                  {TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedTemplate(t.id); setCustomMessage(t.content) }}
                      className={cn(
                        "w-full text-left p-3 rounded-xl border transition-all",
                        selectedTemplate === t.id
                          ? "bg-primary/5 border-primary/40 ring-1 ring-primary/20"
                          : "bg-muted/30 border-border hover:bg-muted/50"
                      )}
                    >
                      <p className="text-[12px] font-semibold text-foreground">{t.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Message content */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                    <MessageSquare className="h-3 w-3" />Conteúdo do disparo
                  </Label>
                  <div className="flex items-center gap-1">
                    {[
                      { label: "{{contact.name}}", title: "Nome do síndico" },
                      { label: "{{vendor.name}}", title: "Nome do vendedor" },
                    ].map(v => (
                      <button
                        key={v.label}
                        onClick={() => setCustomMessage(p => p + ` ${v.label}`)}
                        title={v.title}
                        className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground hover:text-foreground border border-border transition-colors"
                      >
                        <Braces className="h-2.5 w-2.5 inline mr-0.5" />{v.title}
                      </button>
                    ))}
                  </div>
                </div>
                <Textarea
                  value={customMessage}
                  onChange={e => setCustomMessage(e.target.value)}
                  placeholder="Conteúdo que será enviado na campanha..."
                  className="min-h-[120px] border-border bg-background text-sm leading-relaxed resize-none"
                />
              </div>

              {/* AI instructions */}
              {isAI && (
                <div className="border border-border rounded-xl p-4 bg-muted/10 space-y-2">
                  <Label className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-primary" />Comportamento da I.A.
                  </Label>
                  <Textarea
                    value={aiInstructions}
                    onChange={e => setAiInstructions(e.target.value)}
                    placeholder="Ex: Seja formal, foque em agendamento..."
                    className="min-h-[80px] border-border bg-background text-[12px] leading-relaxed resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3 shrink-0" />
                    Define como a I.A. deve interagir após o disparo inicial.
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3.5 border-t border-border bg-muted/10 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">{selectedIds.size}</span> destinatários selecionados
            {selectedIds.size === 0 && <span className="text-amber-600 ml-1.5">— selecione ao menos um</span>}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} className="h-8 px-4 text-[11px] font-medium">
              Cancelar
            </Button>
            <Button
              onClick={handleFire}
              disabled={sending || selectedIds.size === 0}
              className="h-8 px-5 text-[11px] font-medium gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {sending ? "Processando..." : `Iniciar disparo (${selectedIds.size})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
