"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Send, MessageSquare, TrendingUp, DollarSign, ChevronRight, Clock, CheckCircle2, Circle } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Mock Data ────────────────────────────────────────────────────────────────

const JORNADAS = [
  {
    id: "j1",
    name: "Renovação 90 dias",
    trigger: "Apólice vence em 90 dias",
    color: "border-l-blue-500",
    accentBg: "bg-blue-50",
    accentBorder: "border-blue-200",
    accentText: "text-blue-700",
    stats: { clientes: 842, responderam: 34, cotaram: 12 },
    steps: [
      {
        day: "Dia 0",
        canal: "WhatsApp",
        titulo: "Aviso amigável de renovação",
        msg: "Olá, [Nome]! Sua apólice de [Seguro] vence em 90 dias. Que tal já garantir a melhor opção? A Sofia pode comparar as seguradoras em minutos — sem burocracia!",
        status: "sent",
      },
      {
        day: "Dia 3",
        canal: "WhatsApp",
        titulo: "Comparação de preços",
        msg: "Oi [Nome]! Fizemos uma pesquisa rápida e encontramos opções com até 22% de economia no seu seguro. Quer ver as cotações? 🔍",
        status: "sent",
      },
      {
        day: "Dia 7",
        canal: "WhatsApp",
        titulo: "Push final",
        msg: "Ei [Nome]! Ainda dá tempo de garantir um preço melhor antes do vencimento. Me chame agora e a Sofia faz a cotação em 2 minutos!",
        status: "pending",
      },
    ],
  },
  {
    id: "j2",
    name: "Renovação 60 dias",
    trigger: "Apólice vence em 60 dias",
    color: "border-l-amber-500",
    accentBg: "bg-amber-50",
    accentBorder: "border-amber-200",
    accentText: "text-amber-700",
    stats: { clientes: 312, responderam: 41, cotaram: 19 },
    steps: [
      {
        day: "Dia 0",
        canal: "WhatsApp",
        titulo: "Urgência moderada",
        msg: "Olá [Nome], sua apólice vence em 60 dias. Já encontramos seguradoras com valores menores que o atual. Posso mostrar as opções?",
        status: "sent",
      },
      {
        day: "Dia 5",
        canal: "WhatsApp",
        titulo: "Proposta de comparação",
        msg: "[Nome], seguro mais barato não significa menos proteção — comparamos 5 seguradoras para você. Me responda SIM e a Sofia envia as cotações agora! 👇",
        status: "sent",
      },
      {
        day: "Dia 14",
        canal: "WhatsApp",
        titulo: "Ativação de urgência",
        msg: "⚠️ Faltam 46 dias para o vencimento, [Nome]. Não deixe para última hora. A Sofia ainda tem vagas para cotação hoje!",
        status: "pending",
      },
    ],
  },
  {
    id: "j3",
    name: "Renovação 30 dias",
    trigger: "Apólice vence em 30 dias",
    color: "border-l-red-500",
    accentBg: "bg-red-50",
    accentBorder: "border-red-200",
    accentText: "text-red-700",
    stats: { clientes: 142, responderam: 62, cotaram: 31 },
    steps: [
      {
        day: "Dia 0",
        canal: "WhatsApp",
        titulo: "URGENTE — 30 dias",
        msg: "URGENTE ⚠️ [Nome], sua apólice vence em 30 dias! Não fique sem cobertura. Responda agora e a Sofia faz a cotação em 2 minutos.",
        status: "sent",
      },
      {
        day: "Dia 7",
        canal: "WhatsApp",
        titulo: "FOMO — últimas vagas",
        msg: "⏰ Apenas 23 dias para o vencimento, [Nome]. Hoje ainda consigo uma cotação melhor que o valor atual. Amanhã pode não estar disponível.",
        status: "sent",
      },
      {
        day: "Dia 20",
        canal: "WhatsApp + Ligação",
        titulo: "Contato humano emergencial",
        msg: "Corretor Rodrigo entrará em contato hoje. Apólice vence em 10 dias — risco de ficar descoberto!",
        status: "pending",
      },
    ],
  },
  {
    id: "j4",
    name: "Reativação Base Inativa +180 dias",
    trigger: "Cliente sem interação há mais de 180 dias",
    color: "border-l-violet-500",
    accentBg: "bg-violet-50",
    accentBorder: "border-violet-200",
    accentText: "text-violet-700",
    stats: { clientes: 913, responderam: 28, cotaram: 8 },
    steps: [
      {
        day: "Dia 0",
        canal: "WhatsApp",
        titulo: "Reengajamento suave",
        msg: "Oi [Nome], tudo bem? Faz um tempinho que não nos falamos. Sabemos que seguros mudam — e os preços também! Posso te mostrar algo melhor que o seu atual?",
        status: "sent",
      },
      {
        day: "Dia 5",
        canal: "WhatsApp",
        titulo: "Oferta de valor",
        msg: "Oi [Nome]! Temos uma novidade: a Sofia agora compara 5 seguradoras ao mesmo tempo em 2 minutos, sem burocracia. Quer testar? É grátis! 🎯",
        status: "sent",
      },
      {
        day: "Dia 15",
        canal: "WhatsApp",
        titulo: "Última tentativa",
        msg: "[Nome], essa é minha última mensagem (prometo! 😅). Caso mude de ideia sobre comparar seguros, é só me chamar. Até logo!",
        status: "pending",
      },
    ],
  },
]

const FILA_HOJE = [
  { hora: "08:00", cliente: "Amanda Pereira", jornada: "Renovação 90d", msg: "Aviso amigável de renovação", canal: "WhatsApp", status: "enviado" },
  { hora: "08:30", cliente: "Carlos Mendonça", jornada: "Renovação 60d", msg: "Proposta de comparação", canal: "WhatsApp", status: "enviado" },
  { hora: "09:00", cliente: "Metalúrgica Soares", jornada: "Renovação 30d", msg: "URGENTE — 30 dias", canal: "WhatsApp", status: "enviado" },
  { hora: "09:30", cliente: "Bruno Teixeira", jornada: "Base Inativa", msg: "Reengajamento suave", canal: "WhatsApp", status: "enviado" },
  { hora: "10:00", cliente: "Larissa Nunes", jornada: "Renovação 90d", msg: "Comparação de preços", canal: "WhatsApp", status: "enviado" },
  { hora: "14:00", cliente: "Fernanda Lima", jornada: "Renovação 60d", msg: "Ativação de urgência", canal: "WhatsApp", status: "agendado" },
  { hora: "14:30", cliente: "TecnoFlex Indústria", jornada: "Renovação 30d", msg: "Contato humano emergencial", canal: "WhatsApp + Lig.", status: "agendado" },
  { hora: "16:00", cliente: "Ricardo Alves", jornada: "Base Inativa", msg: "Oferta de valor", canal: "WhatsApp", status: "agendado" },
  { hora: "17:00", cliente: "Eduardo Rocha", jornada: "Renovação 90d", msg: "Push final", canal: "WhatsApp", status: "agendado" },
]

// ─── Journey Card ─────────────────────────────────────────────────────────────

function JornadaCard({ j }: { j: typeof JORNADAS[0] }) {
  return (
    <div className={cn("border border-border rounded-xl bg-card overflow-hidden border-l-4", j.color)}>
      <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-foreground">{j.name}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Gatilho: {j.trigger}</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-right shrink-0">
          <div>
            <p className="font-bold text-foreground text-sm">{j.stats.clientes.toLocaleString("pt-BR")}</p>
            <p className="text-muted-foreground">clientes</p>
          </div>
          <div>
            <p className={cn("font-bold text-sm", j.accentText)}>{j.stats.responderam}%</p>
            <p className="text-muted-foreground">responderam</p>
          </div>
          <div>
            <p className="font-bold text-sm text-emerald-600">{j.stats.cotaram}%</p>
            <p className="text-muted-foreground">cotaram</p>
          </div>
        </div>
      </div>

      {/* Timeline steps */}
      <div className="px-5 py-4">
        <div className="flex items-start gap-0">
          {j.steps.map((step, i) => (
            <div key={i} className="flex items-start gap-0 flex-1">
              {/* Step */}
              <div className="flex-1">
                <div className={cn("border rounded-xl p-3", j.accentBg, j.accentBorder)}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded", j.accentBg, j.accentText, j.accentBorder, "border")}>
                      {step.day}
                    </span>
                    <span className="text-[9px] text-muted-foreground">{step.canal}</span>
                    {step.status === "sent" ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 ml-auto" />
                    ) : (
                      <Clock className="h-3 w-3 text-muted-foreground ml-auto" />
                    )}
                  </div>
                  <p className={cn("text-[11px] font-semibold mb-1", j.accentText)}>{step.titulo}</p>
                  <p className="text-[10px] text-muted-foreground leading-snug line-clamp-3">{step.msg}</p>
                </div>
              </div>
              {/* Arrow */}
              {i < j.steps.length - 1 && (
                <div className="flex items-center justify-center w-8 mt-6 shrink-0">
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NutricaoPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Nutrição de Leads</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Jornadas automáticas de follow-up e reativação — Sofia opera 24/7</p>
      </div>

      {/* Results KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Follow-ups enviados", value: "1.847", sub: "este mês", icon: Send, accentCls: "bg-blue-500", iconCls: "text-blue-500" },
          { label: "Taxa de resposta", value: "38%", sub: "média das jornadas", icon: MessageSquare, accentCls: "bg-sky-500", iconCls: "text-sky-500" },
          { label: "Convertidos em cotação", value: "247", sub: "13% do total enviado", icon: TrendingUp, accentCls: "bg-emerald-500", iconCls: "text-emerald-500" },
          { label: "Receita gerada", value: "R$ 42.800", sub: "comissões recuperadas", icon: DollarSign, accentCls: "bg-primary", iconCls: "text-primary" },
        ].map((kpi) => (
          <Card key={kpi.label} className="relative overflow-hidden border-border bg-card">
            <div className={cn("absolute left-0 top-0 bottom-0 w-[3px]", kpi.accentCls)} />
            <CardContent className="p-4 pl-5">
              <div className="flex items-start justify-between mb-2">
                <p className="text-[10px] font-medium text-muted-foreground leading-none">{kpi.label}</p>
                <kpi.icon className={cn("h-3.5 w-3.5 shrink-0", kpi.iconCls)} />
              </div>
              <p className="text-xl font-bold text-foreground leading-none">{kpi.value}</p>
              <p className="text-[10px] text-muted-foreground mt-1.5">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Section: Jornadas Ativas */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Jornadas Ativas</h2>
        <div className="space-y-4">
          {JORNADAS.map((j) => <JornadaCard key={j.id} j={j} />)}
        </div>
      </div>

      {/* Section: Fila de envios hoje */}
      <Card className="border-border bg-card">
        <CardHeader className="px-5 pt-4 pb-3 border-b border-border">
          <CardTitle className="text-sm font-semibold text-foreground">Fila de Envios — Hoje (07/04/2026)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 px-5 py-2 border-b border-border bg-muted/20">
            {[
              ["col-span-1", "Hora"],
              ["col-span-2", "Cliente"],
              ["col-span-2", "Jornada"],
              ["col-span-4", "Mensagem"],
              ["col-span-2", "Canal"],
              ["col-span-1", "Status"],
            ].map(([cls, label]) => (
              <div key={label} className={cn("text-[9px] font-semibold text-muted-foreground uppercase tracking-wide", cls)}>
                {label}
              </div>
            ))}
          </div>

          {FILA_HOJE.map((row, i) => (
            <div
              key={i}
              className={cn(
                "grid grid-cols-12 gap-2 px-5 py-3 items-center border-b border-border/40 last:border-0",
                i % 2 === 0 ? "bg-background" : "bg-muted/10"
              )}
            >
              <div className="col-span-1 text-[11px] font-mono font-medium text-foreground">{row.hora}</div>
              <div className="col-span-2 text-[11px] font-medium text-foreground truncate">{row.cliente}</div>
              <div className="col-span-2 text-[10px] text-muted-foreground truncate">{row.jornada}</div>
              <div className="col-span-4 text-[10px] text-muted-foreground truncate">{row.msg}</div>
              <div className="col-span-2 text-[10px] text-muted-foreground">{row.canal}</div>
              <div className="col-span-1">
                <span className={cn(
                  "text-[9px] font-medium px-1.5 py-0.5 rounded border",
                  row.status === "enviado"
                    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                )}>
                  {row.status === "enviado" ? "Enviado" : "Agendado"}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
