import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getConversationsByUnit, getClientsByUnit, getSellersByUnit } from '@/data/mockData';
import type { UnitFilter } from '@/components/Layout';
import { Bot, ArrowRightLeft, TrendingUp, Clock, Users, Zap, Brain, Target, MessageSquare, AlertTriangle, ThumbsUp, ThumbsDown } from 'lucide-react';

const AIAnalytics = () => {
  const { unitFilter } = useOutletContext<{ unitFilter: UnitFilter }>();
  const convs = getConversationsByUnit(unitFilter);
  const allClients = getClientsByUnit(unitFilter);
  const unitSellers = getSellersByUnit(unitFilter);

  // AI metrics
  const aiActiveNow = convs.filter(c => c.isAIActive).length;
  const totalAIHandled = convs.length; // all went through AI
  const handedOff = convs.filter(c => c.wasHandedOff).length;
  const closedFromAI = convs.filter(c => c.wasHandedOff && c.stage === 'fechado').length;
  const lostFromAI = convs.filter(c => c.wasHandedOff && c.stage === 'perdido').length;
  const inNegotiation = convs.filter(c => c.wasHandedOff && (c.stage === 'negociacao' || c.stage === 'orcamento')).length;
  const qualified = convs.filter(c => c.wasHandedOff && c.stage === 'qualificado').length;

  const aiConversionRate = handedOff > 0 ? ((closedFromAI / handedOff) * 100).toFixed(1) : '0';
  const handoffRate = totalAIHandled > 0 ? ((handedOff / totalAIHandled) * 100).toFixed(1) : '0';
  const avgResponseTimeAI = '0.3'; // seconds mock
  const avgResponseTimeHuman = '25'; // minutes - real scenario

  // Leads by source that AI reactivated
  const reactivated = allClients.filter(c => c.source === 'Reativação IA').length;
  const fromWhatsApp = allClients.filter(c => c.source === 'WhatsApp').length;
  const fromInstagram = allClients.filter(c => c.source === 'Instagram').length;

  // Mock daily data — ~150/week
  const dailyAIData = [
    { day: 'Seg', atendidos: 28, handoffs: 18, fechados: 5 },
    { day: 'Ter', atendidos: 32, handoffs: 22, fechados: 7 },
    { day: 'Qua', atendidos: 35, handoffs: 24, fechados: 8 },
    { day: 'Qui', atendidos: 30, handoffs: 20, fechados: 6 },
    { day: 'Sex', atendidos: 38, handoffs: 26, fechados: 9 },
    { day: 'Sáb', atendidos: 22, handoffs: 14, fechados: 4 },
    { day: 'Dom', atendidos: 12, handoffs: 8, fechados: 2 },
  ];

  // Response time comparison
  const responseComparison = [
    { metrica: 'Tempo Resposta', ia: 18, humano: 1500 }, // seconds (25min)
    { metrica: 'Primeira Msg', ia: 3, humano: 300 }, // seconds (5min)
  ];

  // Satisfaction / Interest level distribution  
  const interestData = [
    { name: 'Muito interessado', value: 35, color: 'hsl(133, 58%, 45%)' },
    { name: 'Interessado', value: 28, color: 'hsl(220, 100%, 50%)' },
    { name: 'Morno', value: 22, color: 'hsl(30, 91%, 60%)' },
    { name: 'Frio/Perdido', value: 15, color: 'hsl(0, 84%, 60%)' },
  ];

  // AI Insights
  const insights = [
    { icon: Zap, text: 'IA respondeu 197 leads essa semana — 94% em menos de 30 segundos', type: 'success' },
    { icon: Target, text: 'Taxa de qualificação da IA: 62% dos leads passados para vendedores eram qualificados', type: 'success' },
    { icon: AlertTriangle, text: '18 leads perdidos após handoff — vendedor Roberto Alves demora 25min p/ responder (média geral: 25min)', type: 'warning' },
    { icon: Brain, text: 'Leads reativados pela IA têm 23% mais conversão que leads frios de Google Ads', type: 'success' },
    { icon: MessageSquare, text: 'Horário pico de contato: 9h-11h e 14h-16h. IA cobre 100% — vendedores cobrem 78%', type: 'info' },
    { icon: TrendingUp, text: 'Cross-sell por IA (espelhos pós-sacada) gerou R$ 18.600 este mês', type: 'success' },
  ];

  const kpis = [
    { label: 'IA Ativa Agora', value: aiActiveNow, subLabel: 'conversas em andamento', icon: Bot, color: 'text-warning' },
    { label: 'Total Atendidos pela IA', value: totalAIHandled, subLabel: 'esta semana', icon: MessageSquare, color: 'text-primary' },
    { label: 'Handoffs Realizados', value: handedOff, subLabel: `${handoffRate}% dos atendimentos`, icon: ArrowRightLeft, color: 'text-cyan-400' },
    { label: 'Fechados pós-IA', value: closedFromAI, subLabel: `${aiConversionRate}% conversão`, icon: TrendingUp, color: 'text-success' },
    { label: 'Em Negociação', value: inNegotiation, subLabel: 'aguardando fechamento', icon: Target, color: 'text-purple-400' },
    { label: 'Leads Perdidos', value: lostFromAI, subLabel: 'após handoff', icon: ThumbsDown, color: 'text-destructive' },
    { label: 'Tempo Resposta IA', value: `${avgResponseTimeAI}s`, subLabel: `vs ${avgResponseTimeHuman}min humano`, icon: Clock, color: 'text-success' },
    { label: 'Leads Reativados', value: reactivated, subLabel: 'pela campanha IA', icon: Zap, color: 'text-warning' },
  ];

  return (
    <div className="p-6 space-y-6 overflow-auto">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Análise da IA</h1>
        <p className="text-sm text-muted-foreground font-body">Performance, métricas e insights do atendimento automatizado</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="glass-card p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-muted-foreground font-body uppercase tracking-wider">{kpi.label}</span>
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
            </div>
            <p className="font-display text-2xl font-bold text-foreground">{kpi.value}</p>
            <p className="text-[10px] text-muted-foreground font-body mt-0.5">{kpi.subLabel}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Daily AI Performance */}
        <div className="col-span-2 glass-card p-5 rounded-lg">
          <h3 className="font-display text-sm font-semibold text-foreground mb-4">Performance Diária da IA</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dailyAIData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 18%)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(215, 15%, 55%)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(215, 15%, 55%)' }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(215, 22%, 11%)', border: '1px solid hsl(215, 20%, 18%)', borderRadius: 8, color: '#F0F6FC' }} />
              <Bar dataKey="atendidos" fill="hsl(220, 100%, 50%)" radius={[4, 4, 0, 0]} name="Atendidos" />
              <Bar dataKey="handoffs" fill="hsl(30, 91%, 60%)" radius={[4, 4, 0, 0]} name="Handoffs" />
              <Bar dataKey="fechados" fill="hsl(133, 58%, 45%)" radius={[4, 4, 0, 0]} name="Fechados" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Interest Distribution */}
        <div className="glass-card p-5 rounded-lg">
          <h3 className="font-display text-sm font-semibold text-foreground mb-4">Nível de Interesse dos Leads</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={interestData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} dataKey="value" stroke="none">
                {interestData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'hsl(215, 22%, 11%)', border: '1px solid hsl(215, 20%, 18%)', borderRadius: 8, color: '#F0F6FC' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {interestData.map(d => (
              <div key={d.name} className="flex items-center justify-between text-xs font-body">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-muted-foreground">{d.name}</span>
                </div>
                <span className="text-foreground font-medium">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Response Time Comparison */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-5 rounded-lg">
          <h3 className="font-display text-sm font-semibold text-foreground mb-4">⚡ Velocidade: IA vs Humano</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-body mb-1">
                <span className="text-muted-foreground">Tempo de resposta médio</span>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 bg-success/10 border border-success/30 rounded-lg p-3 text-center">
                  <Bot className="w-5 h-5 text-success mx-auto mb-1" />
                  <p className="font-display text-xl font-bold text-success">18s</p>
                  <p className="text-[10px] text-muted-foreground font-body">IA</p>
                </div>
                <div className="flex-1 bg-warning/10 border border-warning/30 rounded-lg p-3 text-center">
                  <Users className="w-5 h-5 text-warning mx-auto mb-1" />
                  <p className="font-display text-xl font-bold text-warning">25min</p>
                  <p className="text-[10px] text-muted-foreground font-body">Humano</p>
                </div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs font-body mb-1">
                <span className="text-muted-foreground">Disponibilidade</span>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 bg-success/10 border border-success/30 rounded-lg p-3 text-center">
                  <p className="font-display text-xl font-bold text-success">24/7</p>
                  <p className="text-[10px] text-muted-foreground font-body">IA — sempre online</p>
                </div>
                <div className="flex-1 bg-secondary rounded-lg p-3 text-center">
                  <p className="font-display text-xl font-bold text-foreground">8h-18h</p>
                  <p className="text-[10px] text-muted-foreground font-body">Horário comercial</p>
                </div>
              </div>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <p className="text-xs font-body text-primary font-medium">💡 A IA captura leads fora do horário comercial que representam 34% do total de contatos</p>
            </div>
          </div>
        </div>

        {/* AI Insights */}
        <div className="glass-card p-5 rounded-lg">
          <h3 className="font-display text-sm font-semibold text-foreground mb-4">🧠 Insights da IA</h3>
          <div className="space-y-2.5">
            {insights.map((insight, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`p-2.5 rounded-lg border text-xs font-body ${
                  insight.type === 'success' ? 'bg-success/5 border-success/20 text-foreground' :
                  insight.type === 'warning' ? 'bg-warning/5 border-warning/20 text-foreground' :
                  'bg-primary/5 border-primary/20 text-foreground'
                }`}
              >
                <div className="flex items-start gap-2">
                  <insight.icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                    insight.type === 'success' ? 'text-success' :
                    insight.type === 'warning' ? 'text-warning' : 'text-primary'
                  }`} />
                  <span>{insight.text}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Conversion Funnel specific to AI */}
      <div className="glass-card p-5 rounded-lg">
        <h3 className="font-display text-sm font-semibold text-foreground mb-4">Funil de Conversão da IA</h3>
        <div className="flex items-center gap-2">
          {[
            { label: 'Contato Inicial', value: totalAIHandled, color: 'bg-primary' },
            { label: 'Qualificados', value: qualified + inNegotiation + closedFromAI, color: 'bg-cyan-500' },
            { label: 'Handoff → Vendedor', value: handedOff, color: 'bg-warning' },
            { label: 'Em Negociação', value: inNegotiation, color: 'bg-purple-500' },
            { label: 'Fechados', value: closedFromAI, color: 'bg-success' },
          ].map((step, i, arr) => (
            <div key={step.label} className="flex items-center gap-2 flex-1">
              <div className="flex-1 text-center">
                <div className={`${step.color} rounded-lg py-3 px-2`}>
                  <p className="font-display text-xl font-bold text-foreground">{step.value}</p>
                </div>
                <p className="text-[10px] text-muted-foreground font-body mt-1">{step.label}</p>
                {i > 0 && (
                  <p className="text-[9px] text-muted-foreground font-body">
                    {arr[i - 1].value > 0 ? `${((step.value / arr[i - 1].value) * 100).toFixed(0)}%` : '—'}
                  </p>
                )}
              </div>
              {i < arr.length - 1 && <span className="text-muted-foreground text-lg">→</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AIAnalytics;
