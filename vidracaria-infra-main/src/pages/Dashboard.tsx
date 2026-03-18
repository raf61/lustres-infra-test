import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getUnitMetrics, getFunnelData, getSellersByUnit, getConversationsByUnit, STAGE_LABELS, units } from '@/data/mockData';
import type { UnitFilter } from '@/components/Layout';
import { TrendingUp, Users, Bot, MessageSquare, DollarSign, Clock, ArrowRightLeft, BarChart3, ChevronRight, Calendar } from 'lucide-react';

const Dashboard = () => {
  const { unitFilter } = useOutletContext<{ unitFilter: UnitFilter }>();
  const metrics = getUnitMetrics(unitFilter);
  const funnel = getFunnelData(unitFilter);
  const unitSellers = getSellersByUnit(unitFilter);
  const convs = getConversationsByUnit(unitFilter);
  const [timePeriod, setTimePeriod] = useState<'today' | 'week' | 'month' | 'quarter'>('month');

  const aiConvs = convs.filter(c => c.isAIActive).length;
  const humanConvs = convs.filter(c => !c.isAIActive).length;

  // Adjust numbers based on time period for realism
  const periodMultiplier = timePeriod === 'today' ? 0.05 : timePeriod === 'week' ? 0.25 : timePeriod === 'month' ? 1 : 3;
  const periodLabel = timePeriod === 'today' ? 'Hoje' : timePeriod === 'week' ? 'Esta Semana' : timePeriod === 'month' ? 'Este Mês' : 'Trimestre';

  const salesEvolution = [
    { month: 'Out', vendas: unitFilter === 'all' ? 385000 : unitFilter === 'unit-1' ? 195000 : 190000 },
    { month: 'Nov', vendas: unitFilter === 'all' ? 465000 : unitFilter === 'unit-1' ? 235000 : 230000 },
    { month: 'Dez', vendas: unitFilter === 'all' ? 548000 : unitFilter === 'unit-1' ? 278000 : 270000 },
    { month: 'Jan', vendas: unitFilter === 'all' ? 632000 : unitFilter === 'unit-1' ? 320000 : 312000 },
    { month: 'Fev', vendas: unitFilter === 'all' ? 738000 : unitFilter === 'unit-1' ? 375000 : 363000 },
    { month: 'Mar', vendas: unitFilter === 'all' ? 812000 : unitFilter === 'unit-1' ? 412000 : 400000 },
  ];

  const channelData = [
    { name: 'WhatsApp', value: 42 },
    { name: 'Instagram', value: 24 },
    { name: 'Google Ads', value: 18 },
    { name: 'Indicação', value: 10 },
    { name: 'Site', value: 6 },
  ];
  const CHANNEL_COLORS = ['hsl(220, 100%, 50%)', 'hsl(280, 70%, 50%)', 'hsl(30, 91%, 60%)', 'hsl(133, 58%, 45%)', 'hsl(200, 60%, 50%)'];

  const followUpData = [
    { name: '1º Follow-up', taxa: 45, conversao: 12, valor: 'R$ 48k' },
    { name: '2º Follow-up', taxa: 32, conversao: 18, valor: 'R$ 62k' },
    { name: '3º Follow-up', taxa: 22, conversao: 25, valor: 'R$ 85k' },
    { name: '4º Follow-up', taxa: 15, conversao: 31, valor: 'R$ 112k' },
  ];

  const leadsTimeData = {
    today: { novos: 8, total: metrics.totalLeads, fechados: 2 },
    week: { novos: 34, total: metrics.totalLeads, fechados: 11 },
    month: { novos: 128, total: metrics.totalLeads, fechados: 42 },
    quarter: { novos: 356, total: metrics.totalLeads, fechados: 118 },
  };

  const currentPeriod = leadsTimeData[timePeriod];

  const kpis = [
    { label: 'Total de Leads', value: metrics.totalLeads, delta: '+12%', icon: Users, color: 'text-primary' },
    { label: 'Leads Novos', value: currentPeriod.novos, delta: periodLabel, icon: TrendingUp, color: 'text-cyan-400' },
    { label: 'Vendas Fechadas', value: currentPeriod.fechados, delta: periodLabel, icon: BarChart3, color: 'text-success' },
    { label: 'Faturamento', value: `R$ ${(812 * periodMultiplier).toFixed(0)}k`, delta: '+18% vs anterior', icon: DollarSign, color: 'text-success' },
    { label: 'Taxa Conversão', value: `${metrics.conversionRate.toFixed(1)}%`, delta: '+2.3pp', icon: TrendingUp, color: 'text-warning' },
    { label: 'IA Ativa', value: metrics.aiActive, delta: `${metrics.handoffs} handoffs`, icon: Bot, color: 'text-primary' },
    { label: 'Tempo Médio Resp.', value: `${metrics.avgResponseTime.toFixed(1)}min`, delta: 'IA: 18s', icon: Clock, color: 'text-cyan-400' },
    { label: 'Conv. Follow-up', value: `${metrics.followUpConversion.toFixed(1)}%`, delta: 'R$ 307k gerado', icon: MessageSquare, color: 'text-purple-400' },
  ];

  const unitComparison = unitFilter === 'all' ? units.map(u => {
    const m = getUnitMetrics(u.id);
    return { name: u.name.replace('Unidade ', 'Und. '), leads: m.totalLeads, fechados: m.closed, faturamento: m.totalSales / 1000, conversao: m.conversionRate };
  }) : null;

  return (
    <div className="p-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Dashboard Estratégico</h1>
          <p className="text-sm text-muted-foreground font-body">Visão geral de desempenho e métricas de vendas</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-secondary rounded-lg p-0.5">
            {(['today', 'week', 'month', 'quarter'] as const).map(p => (
              <button key={p} onClick={() => setTimePeriod(p)}
                className={`text-[11px] px-2.5 py-1.5 rounded font-body transition-colors ${timePeriod === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {p === 'today' ? 'Hoje' : p === 'week' ? 'Semana' : p === 'month' ? 'Mês' : 'Trimestre'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-muted-foreground font-body">Tempo real</span>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="glass-card p-4 rounded-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-muted-foreground font-body uppercase tracking-wider">{kpi.label}</span>
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
            </div>
            <p className="font-display text-2xl font-bold text-foreground">{kpi.value}</p>
            <p className="text-[10px] text-success font-body mt-0.5">{kpi.delta}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 glass-card p-5 rounded-lg">
          <h3 className="font-display text-sm font-semibold text-foreground mb-4">Evolução de Faturamento (R$)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={salesEvolution}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(220, 100%, 50%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(220, 100%, 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 18%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(215, 15%, 55%)' }} />
              <YAxis tick={{ fontSize: 12, fill: 'hsl(215, 15%, 55%)' }} tickFormatter={v => `${v / 1000}k`} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(215, 22%, 11%)', border: '1px solid hsl(215, 20%, 18%)', borderRadius: 8, color: '#F0F6FC' }} formatter={(v: number) => [`R$ ${v.toLocaleString()}`, 'Faturamento']} />
              <Area type="monotone" dataKey="vendas" stroke="hsl(220, 100%, 50%)" fill="url(#salesGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5 rounded-lg">
          <h3 className="font-display text-sm font-semibold text-foreground mb-4">Leads por Canal</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={channelData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} dataKey="value" stroke="none">
                {channelData.map((_, i) => <Cell key={i} fill={CHANNEL_COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'hsl(215, 22%, 11%)', border: '1px solid hsl(215, 20%, 18%)', borderRadius: 8, color: '#F0F6FC' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {channelData.map((ch, i) => (
              <div key={ch.name} className="flex items-center justify-between text-xs font-body">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[i] }} />
                  <span className="text-muted-foreground">{ch.name}</span>
                </div>
                <span className="text-foreground font-medium">{ch.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-lg">
          <h3 className="font-display text-sm font-semibold text-foreground mb-4">Funil de Vendas</h3>
          <div className="space-y-2">
            {funnel.map((s, i) => {
              const maxCount = Math.max(...funnel.map(f => f.count));
              const width = maxCount > 0 ? (s.count / maxCount) * 100 : 0;
              return (
                <div key={s.stage} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-body w-24 truncate">{s.label}</span>
                  <div className="flex-1 h-6 bg-secondary rounded overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${width}%` }}
                      transition={{ delay: i * 0.1, duration: 0.5 }}
                      className={`h-full ${['bg-blue-500', 'bg-warning', 'bg-cyan-500', 'bg-purple-500', 'bg-yellow-500', 'bg-success', 'bg-destructive'][i]} rounded flex items-center justify-end pr-2`}
                    >
                      <span className="text-[10px] font-bold text-foreground">{s.count}</span>
                    </motion.div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Follow-up ROI */}
        <div className="glass-card p-5 rounded-lg">
          <h3 className="font-display text-sm font-semibold text-foreground mb-4">💰 ROI do Follow-up</h3>
          <div className="space-y-2.5">
            {followUpData.map((f, i) => (
              <div key={f.name} className="bg-secondary rounded-lg p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-body text-foreground font-medium">{f.name}</span>
                  <span className="text-xs font-body text-success font-bold">{f.valor}</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <div className="h-1.5 bg-card rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${f.taxa}%` }} />
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-0.5">Resposta: {f.taxa}%</p>
                  </div>
                  <div className="flex-1">
                    <div className="h-1.5 bg-card rounded-full overflow-hidden">
                      <div className="h-full bg-success rounded-full" style={{ width: `${f.conversao}%` }} />
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-0.5">Conversão: {f.conversao}%</p>
                  </div>
                </div>
              </div>
            ))}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-2 mt-2">
              <p className="text-[10px] text-primary font-body font-medium">💡 O 3º follow-up tem a melhor relação custo/conversão (+25%)</p>
            </div>
          </div>
        </div>

        {/* Unit Comparison or AI vs Human */}
        <div className="glass-card p-5 rounded-lg">
          {unitComparison ? (
            <>
              <h3 className="font-display text-sm font-semibold text-foreground mb-4">Comparativo de Unidades</h3>
              <div className="space-y-4">
                {unitComparison.map(u => (
                  <div key={u.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-body text-foreground font-medium">{u.name}</span>
                      <span className="text-xs text-success font-body font-bold">R$ {u.faturamento.toFixed(0)}k</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-secondary rounded p-2 text-center">
                        <p className="text-[9px] text-muted-foreground">Leads</p>
                        <p className="text-sm font-display font-bold text-foreground">{u.leads}</p>
                      </div>
                      <div className="bg-secondary rounded p-2 text-center">
                        <p className="text-[9px] text-muted-foreground">Fechados</p>
                        <p className="text-sm font-display font-bold text-success">{u.fechados}</p>
                      </div>
                      <div className="bg-secondary rounded p-2 text-center">
                        <p className="text-[9px] text-muted-foreground">Conv.</p>
                        <p className="text-sm font-display font-bold text-warning">{u.conversao.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h3 className="font-display text-sm font-semibold text-foreground mb-4">IA vs Humano</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                  <Bot className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground font-body">Conversas IA ativas</p>
                    <p className="text-2xl font-display font-bold text-foreground">{aiConvs}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                  <Users className="w-8 h-8 text-success" />
                  <div>
                    <p className="text-xs text-muted-foreground font-body">Conversas com vendedor</p>
                    <p className="text-2xl font-display font-bold text-foreground">{humanConvs}</p>
                  </div>
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-body">Taxa Handoff</p>
                  <p className="text-xl font-display font-bold text-warning">{convs.length > 0 ? ((humanConvs / convs.length) * 100).toFixed(0) : 0}%</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Top Sellers */}
      <div className="glass-card p-5 rounded-lg">
        <h3 className="font-display text-sm font-semibold text-foreground mb-4">Ranking de Vendedores</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-xs text-muted-foreground font-medium">#</th>
                <th className="text-left py-2 text-xs text-muted-foreground font-medium">Vendedor</th>
                <th className="text-left py-2 text-xs text-muted-foreground font-medium">Unidade</th>
                <th className="text-right py-2 text-xs text-muted-foreground font-medium">Leads</th>
                <th className="text-right py-2 text-xs text-muted-foreground font-medium">Fechados</th>
                <th className="text-right py-2 text-xs text-muted-foreground font-medium">Conversão</th>
                <th className="text-right py-2 text-xs text-muted-foreground font-medium">Faturamento</th>
                <th className="text-right py-2 text-xs text-muted-foreground font-medium">Tempo Resp.</th>
              </tr>
            </thead>
            <tbody>
              {[...unitSellers].sort((a, b) => b.metrics.totalSales - a.metrics.totalSales).map((s, i) => (
                <tr key={s.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                  <td className="py-3 text-muted-foreground">{i + 1}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">{s.avatar}</div>
                      <span className="text-foreground">{s.name}</span>
                    </div>
                  </td>
                  <td className="py-3 text-muted-foreground">{units.find(u => u.id === s.unitId)?.name.replace('Unidade ', 'Und. ')}</td>
                  <td className="py-3 text-right text-foreground">{s.metrics.leadsReceived}</td>
                  <td className="py-3 text-right text-success font-medium">{s.metrics.leadsClosed}</td>
                  <td className="py-3 text-right text-warning font-medium">{s.metrics.conversionRate}%</td>
                  <td className="py-3 text-right text-foreground font-medium">R$ {(s.metrics.totalSales / 1000).toFixed(0)}k</td>
                  <td className="py-3 text-right text-muted-foreground">{s.metrics.avgResponseTime}min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
