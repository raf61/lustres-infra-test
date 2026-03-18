import { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getSellersByUnit, getClientsBySeller, getConversationsBySeller, units, STAGE_LABELS, STAGE_COLORS } from '@/data/mockData';
import type { UnitFilter } from '@/components/Layout';
import type { Seller } from '@/data/mockData';
import { Users, TrendingUp, Clock, ArrowRightLeft, ChevronRight, Check, X, MessageSquare, Eye } from 'lucide-react';
import { toast } from 'sonner';

const SellerAnalytics = () => {
  const { unitFilter } = useOutletContext<{ unitFilter: UnitFilter }>();
  const navigate = useNavigate();
  const unitSellers = getSellersByUnit(unitFilter);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [timePeriod, setTimePeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [showRealloc, setShowRealloc] = useState(false);
  const [targetSeller, setTargetSeller] = useState('');

  const sellerClients = selectedSeller ? getClientsBySeller(selectedSeller.id) : [];
  const sellerConvs = selectedSeller ? getConversationsBySeller(selectedSeller.id) : [];

  const toggleClient = (id: string) => {
    setSelectedClients(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedClients.size === sellerClients.length) setSelectedClients(new Set());
    else setSelectedClients(new Set(sellerClients.map(c => c.id)));
  };

  const handleRealloc = () => {
    if (!targetSeller) return;
    const target = unitSellers.find(s => s.id === targetSeller);
    toast.success(`${selectedClients.size} clientes realocados para ${target?.name}!`);
    setSelectedClients(new Set());
    setShowRealloc(false);
  };

  const getSalesData = (seller: Seller) => {
    const monthly = seller.metrics.monthlySales;
    if (timePeriod === 'month') {
      return Object.entries(monthly).map(([k, v]) => ({
        period: k.split('-')[1] + '/' + k.split('-')[0].slice(2),
        vendas: v,
      }));
    }
    if (timePeriod === 'quarter') {
      return [
        { period: 'Q4/25', vendas: (monthly['2025-10'] || 0) + (monthly['2025-11'] || 0) + (monthly['2025-12'] || 0) },
        { period: 'Q1/26', vendas: (monthly['2026-01'] || 0) + (monthly['2026-02'] || 0) + (monthly['2026-03'] || 0) },
      ];
    }
    return [
      { period: '2025', vendas: Object.entries(monthly).filter(([k]) => k.startsWith('2025')).reduce((s, [, v]) => s + v, 0) },
      { period: '2026', vendas: Object.entries(monthly).filter(([k]) => k.startsWith('2026')).reduce((s, [, v]) => s + v, 0) },
    ];
  };

  const comparisonData = unitSellers.map(s => ({
    name: s.name.split(' ')[0],
    conversao: s.metrics.conversionRate,
    faturamento: s.metrics.totalSales / 1000,
    leads: s.metrics.leadsReceived,
  }));

  const handleViewConversation = (sellerId: string) => {
    // Navigate to chat center — in real app would filter by seller
    navigate('/chat');
    toast.info('Filtro de vendedor aplicado na Central de Chat');
  };

  return (
    <div className="flex h-full">
      {/* Seller List */}
      <div className="w-80 border-r border-border flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <h2 className="font-display text-lg font-bold text-foreground">Análise de Vendedores</h2>
          <p className="text-xs text-muted-foreground font-body mt-1">{unitSellers.length} vendedores</p>
        </div>

        <div className="p-3 border-b border-border">
          <h3 className="text-xs text-muted-foreground font-body mb-2 uppercase tracking-wider">Comparativo Conversão %</h3>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={comparisonData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(215, 15%, 55%)' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'hsl(215, 15%, 55%)' }} width={55} />
              <Bar dataKey="conversao" fill="hsl(220, 100%, 50%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1 overflow-auto scrollbar-thin">
          {unitSellers.sort((a, b) => b.metrics.totalSales - a.metrics.totalSales).map(seller => (
            <button
              key={seller.id}
              onClick={() => { setSelectedSeller(seller); setSelectedClients(new Set()); }}
              className={`w-full text-left p-4 border-b border-border/50 hover:bg-surface-hover transition-colors ${selectedSeller?.id === seller.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">{seller.avatar}</div>
                  <div>
                    <p className="text-sm font-body font-medium text-foreground">{seller.name}</p>
                    <p className="text-[10px] text-muted-foreground font-body">{seller.role} • {units.find(u => u.id === seller.unitId)?.name.replace('Unidade ', 'Und. ')}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="text-center">
                  <p className="text-lg font-display font-bold text-foreground">{seller.metrics.leadsClosed}</p>
                  <p className="text-[9px] text-muted-foreground">Fechados</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-display font-bold text-warning">{seller.metrics.conversionRate}%</p>
                  <p className="text-[9px] text-muted-foreground">Conversão</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-display font-bold text-success">R${(seller.metrics.totalSales / 1000).toFixed(0)}k</p>
                  <p className="text-[9px] text-muted-foreground">Vendas</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Seller Detail */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        {selectedSeller ? (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-xl font-bold text-primary font-display">{selectedSeller.avatar}</div>
                <div>
                  <h2 className="font-display text-xl font-bold text-foreground">{selectedSeller.name}</h2>
                  <p className="text-sm text-muted-foreground font-body">{selectedSeller.role} — {units.find(u => u.id === selectedSeller.unitId)?.name}</p>
                </div>
              </div>
              <button
                onClick={() => handleViewConversation(selectedSeller.id)}
                className="flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary text-xs rounded-lg font-body font-medium hover:bg-primary/20 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Ver Conversas
              </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: 'Leads Recebidos', value: selectedSeller.metrics.leadsReceived, icon: Users },
                { label: 'Fechados', value: selectedSeller.metrics.leadsClosed, icon: TrendingUp },
                { label: 'Conversão', value: `${selectedSeller.metrics.conversionRate}%`, icon: TrendingUp },
                { label: 'Tempo Resp.', value: `${selectedSeller.metrics.avgResponseTime}min`, icon: Clock },
                { label: 'Follow-ups', value: `${selectedSeller.metrics.followUps} (${selectedSeller.metrics.followUpConversion}%)`, icon: ArrowRightLeft },
              ].map(kpi => (
                <div key={kpi.label} className="glass-card p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <kpi.icon className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-body">{kpi.label}</span>
                  </div>
                  <p className="font-display text-xl font-bold text-foreground">{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Leads currently handling */}
            <div className="glass-card p-5 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-sm font-semibold text-foreground">Leads em Andamento</h3>
                <span className="text-xs text-muted-foreground font-body">{sellerConvs.length} conversas</span>
              </div>
              <div className="space-y-2 max-h-40 overflow-auto scrollbar-thin">
                {sellerConvs.map(conv => (
                  <div key={conv.id} className="flex items-center justify-between bg-secondary rounded-lg p-2.5 hover:bg-surface-hover transition-colors cursor-pointer"
                    onClick={() => { navigate('/chat'); toast.info(`Abrindo conversa com ${conv.clientName}`); }}>
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold ${conv.isAIActive ? 'bg-warning/20 text-warning' : 'bg-primary/20 text-primary'}`}>
                        {conv.clientName.split(' ').map(n => n[0]).slice(0, 2).join('')}
                      </div>
                      <div>
                        <p className="text-xs font-body font-medium text-foreground">{conv.clientName}</p>
                        <span className={`text-[9px] px-1 py-0.5 rounded ${STAGE_COLORS[conv.stage]} text-foreground font-medium`}>
                          {STAGE_LABELS[conv.stage]}
                        </span>
                      </div>
                    </div>
                    <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                ))}
                {sellerConvs.length === 0 && <p className="text-xs text-muted-foreground text-center py-4 font-body">Sem conversas ativas</p>}
              </div>
            </div>

            {/* Sales Chart */}
            <div className="glass-card p-5 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-sm font-semibold text-foreground">Vendas</h3>
                <div className="flex gap-1">
                  {(['month', 'quarter', 'year'] as const).map(p => (
                    <button key={p} onClick={() => setTimePeriod(p)}
                      className={`text-xs px-2.5 py-1 rounded font-body transition-colors ${timePeriod === p ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-surface-hover'}`}>
                      {p === 'month' ? 'Mês' : p === 'quarter' ? 'Trimestre' : 'Ano'}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={getSalesData(selectedSeller)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 18%)" />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'hsl(215, 15%, 55%)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(215, 15%, 55%)' }} tickFormatter={v => `${v / 1000}k`} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(215, 22%, 11%)', border: '1px solid hsl(215, 20%, 18%)', borderRadius: 8, color: '#F0F6FC' }} formatter={(v: number) => [`R$ ${v.toLocaleString()}`, 'Vendas']} />
                  <Bar dataKey="vendas" fill="hsl(220, 100%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Client Portfolio */}
            <div className="glass-card p-5 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display text-sm font-semibold text-foreground">Carteira de Clientes</h3>
                  <p className="text-xs text-muted-foreground font-body">{sellerClients.length} clientes alocados</p>
                </div>
                {selectedClients.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-primary font-body font-medium">{selectedClients.size} selecionados</span>
                    <button
                      onClick={() => setShowRealloc(true)}
                      className="px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-lg font-body font-medium hover:bg-primary/90 transition-colors"
                    >
                      Realocar
                    </button>
                  </div>
                )}
              </div>

              {showRealloc && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mb-4 p-4 bg-secondary rounded-lg border border-primary/30">
                  <h4 className="text-sm font-display font-semibold text-foreground mb-2">Realocar {selectedClients.size} clientes para:</h4>
                  <div className="flex gap-2">
                    <select value={targetSeller} onChange={e => setTargetSeller(e.target.value)}
                      className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm font-body text-foreground focus:outline-none">
                      <option value="">Selecione vendedor</option>
                      {unitSellers.filter(s => s.id !== selectedSeller.id).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <button onClick={handleRealloc} className="px-4 py-2 bg-success text-success-foreground rounded-lg text-sm font-body font-medium flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Confirmar
                    </button>
                    <button onClick={() => { setShowRealloc(false); setTargetSeller(''); }} className="px-3 py-2 bg-destructive/20 text-destructive rounded-lg text-sm font-body">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              )}

              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 w-8">
                      <input type="checkbox" checked={selectedClients.size === sellerClients.length && sellerClients.length > 0} onChange={toggleAll}
                        className="rounded border-border bg-secondary" />
                    </th>
                    <th className="text-left py-2 text-xs text-muted-foreground font-medium">Cliente</th>
                    <th className="text-left py-2 text-xs text-muted-foreground font-medium">Estágio</th>
                    <th className="text-left py-2 text-xs text-muted-foreground font-medium">Último Contato</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Compras</th>
                  </tr>
                </thead>
                <tbody>
                  {sellerClients.map(client => (
                    <tr key={client.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                      <td className="py-2">
                        <input type="checkbox" checked={selectedClients.has(client.id)} onChange={() => toggleClient(client.id)}
                          className="rounded border-border bg-secondary" />
                      </td>
                      <td className="py-2">
                        <p className="text-foreground">{client.name}</p>
                        <p className="text-[10px] text-muted-foreground">{client.phone}</p>
                      </td>
                      <td className="py-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${STAGE_COLORS[client.stage]} text-foreground font-medium`}>
                          {STAGE_LABELS[client.stage]}
                        </span>
                      </td>
                      <td className="py-2 text-muted-foreground text-xs">{new Date(client.lastContact).toLocaleDateString('pt-BR')}</td>
                      <td className="py-2 text-right text-foreground">
                        {client.purchaseHistory.length > 0
                          ? `R$ ${client.purchaseHistory.reduce((s, p) => s + p.value, 0).toLocaleString()}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                  {sellerClients.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Nenhum cliente alocado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center h-full text-muted-foreground font-body">
            Selecione um vendedor para ver detalhes
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerAnalytics;
