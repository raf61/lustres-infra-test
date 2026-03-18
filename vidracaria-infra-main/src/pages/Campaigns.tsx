import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { products, campaigns, messageTemplates, clients, STAGE_LABELS } from '@/data/mockData';
import type { UnitFilter } from '@/components/Layout';
import { Megaphone, Package, TrendingUp, Send, Play, Pause, Eye, X, Zap, Users, Target, Calendar, Clock, Filter } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

const Campaigns = () => {
  const { unitFilter } = useOutletContext<{ unitFilter: UnitFilter }>();
  const [tab, setTab] = useState<'campaigns' | 'products'>('campaigns');
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  // Create Campaign Modal
  const [showCreate, setShowCreate] = useState(false);
  const [newCamp, setNewCamp] = useState({
    name: '', product: '', segment: 'all', template: '', scheduleType: 'now', scheduleDate: '',
    targetDays: '90', targetStage: '',
  });

  // Campaign Report Modal
  const [showReport, setShowReport] = useState<string | null>(null);

  const productChartData = products.map(p => ({
    name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
    vendas: p.salesCount,
    receita: p.revenue / 1000,
  }));

  const segmentOptions = [
    { value: 'all', label: 'Base completa ativa' },
    { value: 'no_purchase_30', label: 'Sem compra > 30 dias' },
    { value: 'no_purchase_60', label: 'Sem compra > 60 dias' },
    { value: 'no_purchase_90', label: 'Sem compra > 90 dias' },
    { value: 'budget_open', label: 'Orçamento aberto sem retorno' },
    { value: 'lost', label: 'Leads perdidos' },
    { value: 'closed_crossell', label: 'Clientes fechados (cross-sell)' },
  ];

  const getSegmentCount = (seg: string) => {
    const today = new Date('2026-03-16');
    switch (seg) {
      case 'no_purchase_30': return clients.filter(c => { if (!c.lastPurchase) return true; return (today.getTime() - new Date(c.lastPurchase).getTime()) / 86400000 > 30; }).length;
      case 'no_purchase_60': return clients.filter(c => { if (!c.lastPurchase) return true; return (today.getTime() - new Date(c.lastPurchase).getTime()) / 86400000 > 60; }).length;
      case 'no_purchase_90': return clients.filter(c => { if (!c.lastPurchase) return true; return (today.getTime() - new Date(c.lastPurchase).getTime()) / 86400000 > 90; }).length;
      case 'budget_open': return clients.filter(c => c.hasBudget && c.stage !== 'fechado').length;
      case 'lost': return clients.filter(c => c.stage === 'perdido').length;
      case 'closed_crossell': return clients.filter(c => c.stage === 'fechado').length;
      default: return clients.length;
    }
  };

  const handleCreateCampaign = () => {
    const count = getSegmentCount(newCamp.segment);
    toast.success(`Campanha "${newCamp.name}" criada!\n${count} clientes no segmento.\n${newCamp.scheduleType === 'now' ? 'Enviando agora...' : `Agendada para ${newCamp.scheduleDate || 'data selecionada'}`}`);
    setShowCreate(false);
    setNewCamp({ name: '', product: '', segment: 'all', template: '', scheduleType: 'now', scheduleDate: '', targetDays: '90', targetStage: '' });
  };

  const reportCampaign = campaigns.find(c => c.id === showReport);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Campanhas & Produtos</h1>
          <p className="text-sm text-muted-foreground font-body">Promoções, disparos e análise de produtos (Protheus)</p>
        </div>
        <div className="flex gap-1">
          {(['campaigns', 'products'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-xs px-3 py-1.5 rounded-lg font-body transition-colors ${tab === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-surface-hover'}`}>
              {t === 'campaigns' ? 'Campanhas' : 'Produtos'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'campaigns' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {campaigns.map((camp, i) => (
              <motion.div
                key={camp.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`glass-card p-5 rounded-lg cursor-pointer hover:border-primary/30 transition-all ${selectedCampaign === camp.id ? 'border-primary/50' : ''}`}
                onClick={() => setSelectedCampaign(selectedCampaign === camp.id ? null : camp.id)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-primary" />
                    <h3 className="font-display text-sm font-semibold text-foreground">{camp.name}</h3>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-body font-medium ${
                    camp.status === 'active' ? 'bg-success/20 text-success' :
                    camp.status === 'scheduled' ? 'bg-warning/20 text-warning' : 'bg-muted text-muted-foreground'
                  }`}>
                    {camp.status === 'active' ? 'Ativa' : camp.status === 'scheduled' ? 'Agendada' : 'Finalizada'}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-3">
                  <div><p className="text-[10px] text-muted-foreground font-body">Alvo</p><p className="text-lg font-display font-bold text-foreground">{camp.targetCount}</p></div>
                  <div><p className="text-[10px] text-muted-foreground font-body">Enviados</p><p className="text-lg font-display font-bold text-foreground">{camp.sentCount}</p></div>
                  <div><p className="text-[10px] text-muted-foreground font-body">Resposta</p><p className="text-lg font-display font-bold text-warning">{camp.responseRate}%</p></div>
                  <div><p className="text-[10px] text-muted-foreground font-body">Conversão</p><p className="text-lg font-display font-bold text-success">{camp.conversionRate}%</p></div>
                </div>

                <div className="flex items-center justify-between text-xs font-body">
                  <span className="text-muted-foreground">Segmento: {camp.segment}</span>
                  <span className="text-muted-foreground">Produto: {camp.product}</span>
                </div>

                {selectedCampaign === camp.id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 pt-4 border-t border-border">
                    <div className="flex gap-2">
                      {camp.status === 'active' && (
                        <button onClick={(e) => { e.stopPropagation(); toast.success('Campanha pausada!'); }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-warning/20 text-warning text-xs rounded-lg font-body hover:bg-warning/30">
                          <Pause className="w-3 h-3" /> Pausar
                        </button>
                      )}
                      {camp.status === 'scheduled' && (
                        <button onClick={(e) => { e.stopPropagation(); toast.success('Campanha iniciada!'); }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-success/20 text-success text-xs rounded-lg font-body hover:bg-success/30">
                          <Play className="w-3 h-3" /> Iniciar
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); setShowReport(camp.id); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-secondary text-foreground text-xs rounded-lg font-body hover:bg-surface-hover">
                        <Eye className="w-3 h-3" /> Ver Relatório
                      </button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>

          <button onClick={() => setShowCreate(true)}
            className="w-full glass-card p-4 rounded-lg border-dashed border-2 border-primary/30 hover:border-primary/60 transition-colors flex items-center justify-center gap-2 text-primary font-body text-sm">
            <Send className="w-4 h-4" /> Criar Nova Campanha
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="glass-card p-5 rounded-lg">
            <h3 className="font-display text-sm font-semibold text-foreground mb-4">Vendas por Produto (Protheus ERP)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={productChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 18%)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(215, 15%, 55%)' }} angle={-25} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(215, 15%, 55%)' }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(215, 22%, 11%)', border: '1px solid hsl(215, 20%, 18%)', borderRadius: 8, color: '#F0F6FC' }} />
                <Bar dataKey="vendas" fill="hsl(220, 100%, 50%)" radius={[4, 4, 0, 0]} name="Unidades Vendidas" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card rounded-lg overflow-hidden">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium">Produto</th>
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium">Categoria</th>
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium">Cód. ERP</th>
                  <th className="text-right p-3 text-xs text-muted-foreground font-medium">Preço Médio</th>
                  <th className="text-right p-3 text-xs text-muted-foreground font-medium">Vendas</th>
                  <th className="text-right p-3 text-xs text-muted-foreground font-medium">Receita</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-surface-hover transition-colors">
                    <td className="p-3"><div className="flex items-center gap-2"><Package className="w-4 h-4 text-primary" /><span className="text-foreground font-medium">{p.name}</span></div></td>
                    <td className="p-3 text-muted-foreground">{p.category}</td>
                    <td className="p-3 text-muted-foreground">{p.erpCode}</td>
                    <td className="p-3 text-right text-foreground">R$ {p.avgPrice.toLocaleString()}</td>
                    <td className="p-3 text-right text-foreground font-medium">{p.salesCount}</td>
                    <td className="p-3 text-right text-success font-medium">R$ {(p.revenue / 1000).toFixed(0)}k</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-secondary/30 font-medium">
                  <td className="p-3 text-foreground" colSpan={4}>Total</td>
                  <td className="p-3 text-right text-foreground">{products.reduce((s, p) => s + p.salesCount, 0)}</td>
                  <td className="p-3 text-right text-success">R$ {(products.reduce((s, p) => s + p.revenue, 0) / 1000).toFixed(0)}k</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Create Campaign Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-card border-border max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-foreground flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary" /> Criar Nova Campanha
            </DialogTitle>
            <DialogDescription className="font-body text-muted-foreground">Configure todos os detalhes da campanha</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground font-body uppercase tracking-wider mb-1.5 block">Nome da Campanha *</label>
              <input value={newCamp.name} onChange={e => setNewCamp({ ...newCamp, name: e.target.value })}
                placeholder="Ex: Reativação - Março 2026"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground font-body uppercase tracking-wider mb-1.5 block">Produto Alvo</label>
                <select value={newCamp.product} onChange={e => setNewCamp({ ...newCamp, product: e.target.value })}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-body text-foreground focus:outline-none">
                  <option value="">Todos os produtos</option>
                  {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-body uppercase tracking-wider mb-1.5 block">Segmento</label>
                <select value={newCamp.segment} onChange={e => setNewCamp({ ...newCamp, segment: e.target.value })}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-body text-foreground focus:outline-none">
                  {segmentOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            {/* Segment Preview */}
            <div className="bg-secondary/50 border border-border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-xs font-body text-foreground font-medium">Clientes no segmento</span>
                </div>
                <span className="text-lg font-display font-bold text-primary">{getSegmentCount(newCamp.segment)}</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-body uppercase tracking-wider mb-1.5 block">Template de Mensagem</label>
              <select value={newCamp.template} onChange={e => setNewCamp({ ...newCamp, template: e.target.value })}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-body text-foreground focus:outline-none">
                <option value="">Selecionar template...</option>
                {messageTemplates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.category})</option>)}
              </select>
            </div>

            {newCamp.template && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground font-body mb-1">Pré-visualização:</p>
                <p className="text-xs font-body text-foreground whitespace-pre-line">
                  {messageTemplates.find(t => t.id === newCamp.template)?.content}
                </p>
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground font-body uppercase tracking-wider mb-1.5 block">Agendamento</label>
              <div className="flex gap-2">
                {[
                  { val: 'now', label: 'Enviar agora', icon: Zap },
                  { val: 'schedule', label: 'Agendar', icon: Calendar },
                ].map(opt => (
                  <button key={opt.val} onClick={() => setNewCamp({ ...newCamp, scheduleType: opt.val })}
                    className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-2.5 rounded-lg font-body transition-colors ${
                      newCamp.scheduleType === opt.val ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-surface-hover'
                    }`}>
                    <opt.icon className="w-3 h-3" /> {opt.label}
                  </button>
                ))}
              </div>
              {newCamp.scheduleType === 'schedule' && (
                <input type="datetime-local" value={newCamp.scheduleDate} onChange={e => setNewCamp({ ...newCamp, scheduleDate: e.target.value })}
                  className="w-full mt-2 bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-body text-foreground focus:outline-none" />
              )}
            </div>

            {/* Estimated Results */}
            <div className="bg-success/5 border border-success/20 rounded-lg p-3">
              <p className="text-xs font-body text-muted-foreground mb-2">📊 Estimativa de resultados:</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-lg font-display font-bold text-foreground">{getSegmentCount(newCamp.segment)}</p>
                  <p className="text-[9px] text-muted-foreground">Alvos</p>
                </div>
                <div>
                  <p className="text-lg font-display font-bold text-primary">{Math.round(getSegmentCount(newCamp.segment) * 0.36)}</p>
                  <p className="text-[9px] text-muted-foreground">Respostas (~36%)</p>
                </div>
                <div>
                  <p className="text-lg font-display font-bold text-warning">{Math.round(getSegmentCount(newCamp.segment) * 0.18)}</p>
                  <p className="text-[9px] text-muted-foreground">Interessados (~18%)</p>
                </div>
                <div>
                  <p className="text-lg font-display font-bold text-success">{Math.round(getSegmentCount(newCamp.segment) * 0.09)}</p>
                  <p className="text-[9px] text-muted-foreground">Conversões (~9%)</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-body text-muted-foreground hover:text-foreground">Cancelar</button>
            <button onClick={handleCreateCampaign} disabled={!newCamp.name}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-body font-medium disabled:opacity-50 flex items-center gap-2">
              <Send className="w-3.5 h-3.5" /> Criar Campanha
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Campaign Report Dialog */}
      <Dialog open={!!showReport} onOpenChange={() => setShowReport(null)}>
        <DialogContent className="bg-card border-border max-w-lg">
          {reportCampaign && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-foreground flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-success" /> Relatório: {reportCampaign.name}
                </DialogTitle>
                <DialogDescription className="font-body text-muted-foreground">Resultados detalhados da campanha</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="glass-card p-3 rounded-lg text-center">
                    <p className="text-[10px] text-muted-foreground font-body">Mensagens Enviadas</p>
                    <p className="text-2xl font-display font-bold text-foreground">{reportCampaign.sentCount}</p>
                  </div>
                  <div className="glass-card p-3 rounded-lg text-center">
                    <p className="text-[10px] text-muted-foreground font-body">Responderam</p>
                    <p className="text-2xl font-display font-bold text-primary">{Math.round(reportCampaign.sentCount * reportCampaign.responseRate / 100)}</p>
                    <p className="text-[9px] text-muted-foreground">{reportCampaign.responseRate}%</p>
                  </div>
                  <div className="glass-card p-3 rounded-lg text-center">
                    <p className="text-[10px] text-muted-foreground font-body">Interessados</p>
                    <p className="text-2xl font-display font-bold text-warning">{Math.round(reportCampaign.sentCount * reportCampaign.responseRate / 100 * 0.55)}</p>
                    <p className="text-[9px] text-muted-foreground">~55% dos responderam</p>
                  </div>
                  <div className="glass-card p-3 rounded-lg text-center">
                    <p className="text-[10px] text-muted-foreground font-body">Convertidos</p>
                    <p className="text-2xl font-display font-bold text-success">{Math.round(reportCampaign.sentCount * reportCampaign.conversionRate / 100)}</p>
                    <p className="text-[9px] text-muted-foreground">{reportCampaign.conversionRate}%</p>
                  </div>
                </div>

                <div className="glass-card p-3 rounded-lg">
                  <p className="text-[10px] text-muted-foreground font-body mb-2">Receita Estimada Gerada</p>
                  <p className="text-2xl font-display font-bold text-success">
                    R$ {(Math.round(reportCampaign.sentCount * reportCampaign.conversionRate / 100) * 8500).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-body">Baseado no ticket médio de R$ 8.500</p>
                </div>

                <div className="glass-card p-3 rounded-lg">
                  <p className="text-[10px] text-muted-foreground font-body mb-2">Timeline</p>
                  <div className="space-y-2 text-xs font-body">
                    <div className="flex justify-between"><span className="text-foreground">Criada em</span><span className="text-muted-foreground">{new Date(reportCampaign.createdAt).toLocaleDateString('pt-BR')}</span></div>
                    <div className="flex justify-between"><span className="text-foreground">Segmento</span><span className="text-muted-foreground">{reportCampaign.segment}</span></div>
                    <div className="flex justify-between"><span className="text-foreground">Produto</span><span className="text-muted-foreground">{reportCampaign.product}</span></div>
                    <div className="flex justify-between"><span className="text-foreground">Status</span>
                      <span className={`${reportCampaign.status === 'active' ? 'text-success' : reportCampaign.status === 'scheduled' ? 'text-warning' : 'text-muted-foreground'}`}>
                        {reportCampaign.status === 'active' ? 'Ativa' : reportCampaign.status === 'scheduled' ? 'Agendada' : 'Finalizada'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Campaigns;
