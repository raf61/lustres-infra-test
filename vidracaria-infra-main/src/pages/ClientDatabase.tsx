import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getClientsByUnit, getSellersByUnit, STAGE_LABELS, products, messageTemplates } from '@/data/mockData';
import type { UnitFilter } from '@/components/Layout';
import { Search, Filter, Send, Download, Phone, ChevronDown, ChevronUp, X, MessageSquare, Zap } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

const ClientDatabase = () => {
  const { unitFilter } = useOutletContext<{ unitFilter: UnitFilter }>();
  const allClients = getClientsByUnit(unitFilter);
  const unitSellers = getSellersByUnit(unitFilter);

  const [search, setSearch] = useState('');
  const [purchaseDays, setPurchaseDays] = useState<number | ''>('');
  const [budgetDays, setBudgetDays] = useState<number | ''>('');
  const [productFilter, setProductFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modals
  const [showDisparo, setShowDisparo] = useState(false);
  const [showReativacao, setShowReativacao] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [disparoSchedule, setDisparoSchedule] = useState('now');

  const today = new Date('2026-03-16');

  const filtered = useMemo(() => {
    return allClients.filter(c => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.phone.includes(search)) return false;
      if (stageFilter && c.stage !== stageFilter) return false;
      if (purchaseDays !== '') {
        const daysAgo = new Date(today);
        daysAgo.setDate(daysAgo.getDate() - Number(purchaseDays));
        if (!c.lastPurchase || new Date(c.lastPurchase) > daysAgo) return false;
      }
      if (budgetDays !== '') {
        const daysAgo = new Date(today);
        daysAgo.setDate(daysAgo.getDate() - Number(budgetDays));
        if (!c.budgetDate || new Date(c.budgetDate) > daysAgo) return false;
      }
      if (productFilter && !c.purchaseHistory.some(p => p.product === productFilter)) return false;
      return true;
    });
  }, [allClients, search, purchaseDays, budgetDays, productFilter, stageFilter]);

  const toggleId = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(c => c.id)));
  };

  const clearFilters = () => {
    setSearch(''); setPurchaseDays(''); setBudgetDays(''); setProductFilter(''); setStageFilter('');
  };

  const handleDisparo = () => {
    const tpl = messageTemplates.find(t => t.id === selectedTemplate);
    const msg = tpl ? tpl.content : customMessage;
    toast.success(`Disparo enviado para ${selectedIds.size} clientes!\n\nMensagem: "${msg.substring(0, 50)}..."\nAgendamento: ${disparoSchedule === 'now' ? 'Imediato' : disparoSchedule}`);
    setShowDisparo(false);
    setSelectedIds(new Set());
    setSelectedTemplate('');
    setCustomMessage('');
  };

  const handleReativacao = () => {
    toast.success(`Campanha de reativação criada para ${selectedIds.size} clientes!\nA IA iniciará o contato automaticamente.`);
    setShowReativacao(false);
    setSelectedIds(new Set());
  };

  return (
    <div className="p-6 space-y-4 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Base de Clientes</h1>
          <p className="text-sm text-muted-foreground font-body">{allClients.length} clientes cadastrados • {filtered.length} exibidos</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-primary" />
          <h3 className="font-display text-sm font-semibold text-foreground">Segmentação</h3>
          {(search || purchaseDays !== '' || budgetDays !== '' || productFilter || stageFilter) && (
            <button onClick={clearFilters} className="ml-auto text-xs text-destructive font-body flex items-center gap-1 hover:underline">
              <X className="w-3 h-3" /> Limpar filtros
            </button>
          )}
        </div>
        <div className="grid grid-cols-5 gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome ou telefone"
              className="w-full bg-secondary border border-border rounded-lg pl-8 pr-3 py-2 text-xs font-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
          <select value={purchaseDays} onChange={e => setPurchaseDays(e.target.value === '' ? '' : Number(e.target.value))}
            className="bg-secondary border border-border rounded-lg px-3 py-2 text-xs font-body text-foreground focus:outline-none">
            <option value="">Última compra</option>
            <option value={30}>Comprou há 30+ dias</option>
            <option value={60}>Comprou há 60+ dias</option>
            <option value={90}>Comprou há 90+ dias</option>
            <option value={180}>Comprou há 180+ dias</option>
          </select>
          <select value={budgetDays} onChange={e => setBudgetDays(e.target.value === '' ? '' : Number(e.target.value))}
            className="bg-secondary border border-border rounded-lg px-3 py-2 text-xs font-body text-foreground focus:outline-none">
            <option value="">Orçamento</option>
            <option value={7}>Orçamento há 7+ dias</option>
            <option value={15}>Orçamento há 15+ dias</option>
            <option value={30}>Orçamento há 30+ dias</option>
          </select>
          <select value={productFilter} onChange={e => setProductFilter(e.target.value)}
            className="bg-secondary border border-border rounded-lg px-3 py-2 text-xs font-body text-foreground focus:outline-none">
            <option value="">Produto</option>
            {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
          <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
            className="bg-secondary border border-border rounded-lg px-3 py-2 text-xs font-body text-foreground focus:outline-none">
            <option value="">Estágio</option>
            {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Mass Actions */}
      {selectedIds.size > 0 && (
        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-3 rounded-lg border border-primary/30 flex items-center justify-between">
          <span className="text-sm font-body text-primary font-medium">{selectedIds.size} clientes selecionados</span>
          <div className="flex gap-2">
            <button onClick={() => setShowDisparo(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-lg font-body font-medium hover:bg-primary/90">
              <Send className="w-3 h-3" /> Disparo em Massa
            </button>
            <button onClick={() => setShowReativacao(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-warning text-warning-foreground text-xs rounded-lg font-body font-medium hover:bg-warning/90">
              <Zap className="w-3 h-3" /> Reativação IA
            </button>
            <button onClick={() => toast.success('Exportação CSV iniciada!')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-foreground text-xs rounded-lg font-body font-medium hover:bg-surface-hover">
              <Download className="w-3 h-3" /> Exportar
            </button>
          </div>
        </motion.div>
      )}

      {/* Client Table */}
      <div className="glass-card rounded-lg overflow-hidden">
        <table className="w-full text-sm font-body">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="text-left p-3 w-8">
                <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll} className="rounded border-border bg-secondary" />
              </th>
              <th className="text-left p-3 text-xs text-muted-foreground font-medium">Cliente</th>
              <th className="text-left p-3 text-xs text-muted-foreground font-medium">Contato</th>
              <th className="text-left p-3 text-xs text-muted-foreground font-medium">Estágio</th>
              <th className="text-left p-3 text-xs text-muted-foreground font-medium">Fonte</th>
              <th className="text-left p-3 text-xs text-muted-foreground font-medium">Últ. Compra</th>
              <th className="text-left p-3 text-xs text-muted-foreground font-medium">Últ. Contato</th>
              <th className="text-right p-3 text-xs text-muted-foreground font-medium">Valor</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 50).map(client => (
              <>
                <tr key={client.id} className={`border-b border-border/50 hover:bg-surface-hover transition-colors cursor-pointer ${expandedId === client.id ? 'bg-surface-hover' : ''}`}
                  onClick={() => setExpandedId(expandedId === client.id ? null : client.id)}>
                  <td className="p-3" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(client.id)} onChange={() => toggleId(client.id)} className="rounded border-border bg-secondary" />
                  </td>
                  <td className="p-3">
                    <p className="text-foreground font-medium">{client.name}</p>
                    <p className="text-[10px] text-muted-foreground">{client.erpCode} • {client.city}</p>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="w-3 h-3" /> {client.phone}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${STAGE_LABELS[client.stage] ? 'bg-primary/20 text-primary' : ''} font-medium`}>{STAGE_LABELS[client.stage]}</span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{client.source}</td>
                  <td className="p-3 text-xs text-muted-foreground">{client.lastPurchase ? new Date(client.lastPurchase).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(client.lastContact).toLocaleDateString('pt-BR')}</td>
                  <td className="p-3 text-right text-xs text-foreground font-medium">
                    {client.purchaseHistory.length > 0 ? `R$ ${client.purchaseHistory.reduce((s, p) => s + p.value, 0).toLocaleString()}` : '—'}
                  </td>
                  <td className="p-3">
                    {expandedId === client.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </td>
                </tr>
                {expandedId === client.id && (
                  <tr key={`${client.id}-detail`}>
                    <td colSpan={9} className="p-0">
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-4 bg-secondary/30 border-b border-border">
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <h4 className="text-xs text-muted-foreground uppercase tracking-wider font-body mb-2">Dados Pessoais</h4>
                            <div className="space-y-1 text-xs font-body">
                              <p className="text-foreground">{client.email}</p>
                              <p className="text-foreground">CPF: {client.cpf}</p>
                              <p className="text-foreground">{client.address}</p>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-xs text-muted-foreground uppercase tracking-wider font-body mb-2">Notas</h4>
                            <p className="text-xs text-foreground font-body">{client.notes}</p>
                          </div>
                          <div>
                            <h4 className="text-xs text-muted-foreground uppercase tracking-wider font-body mb-2">Orçamento</h4>
                            <p className="text-xs font-body text-foreground">{client.hasBudget ? `Sim — ${client.budgetDate ? new Date(client.budgetDate).toLocaleDateString('pt-BR') : ''}` : 'Não solicitado'}</p>
                          </div>
                          <div>
                            <h4 className="text-xs text-muted-foreground uppercase tracking-wider font-body mb-2">Histórico de Compras</h4>
                            {client.purchaseHistory.length > 0 ? (
                              <div className="space-y-1">
                                {client.purchaseHistory.map(p => (
                                  <div key={p.id} className="text-xs font-body">
                                    <span className="text-foreground">{p.product}</span>
                                    <span className="text-muted-foreground"> — R$ {p.value.toLocaleString()} ({p.invoice})</span>
                                  </div>
                                ))}
                              </div>
                            ) : <p className="text-xs text-muted-foreground font-body">Sem compras</p>}
                          </div>
                        </div>
                      </motion.div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-12 text-center text-muted-foreground font-body">Nenhum cliente encontrado</div>
        )}
        {filtered.length > 50 && (
          <div className="p-3 text-center text-xs text-muted-foreground font-body border-t border-border">
            Exibindo 50 de {filtered.length} resultados
          </div>
        )}
      </div>

      {/* Disparo em Massa Dialog */}
      <Dialog open={showDisparo} onOpenChange={setShowDisparo}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-foreground flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" /> Disparo em Massa
            </DialogTitle>
            <DialogDescription className="font-body text-muted-foreground">
              Enviar mensagem para {selectedIds.size} clientes selecionados
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground font-body uppercase tracking-wider mb-1.5 block">Template de Mensagem</label>
              <select value={selectedTemplate} onChange={e => { setSelectedTemplate(e.target.value); setCustomMessage(''); }}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-body text-foreground focus:outline-none">
                <option value="">Selecionar template...</option>
                {messageTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                ))}
              </select>
            </div>
            {selectedTemplate && (
              <div className="bg-secondary/50 border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground font-body mb-1">Pré-visualização:</p>
                <p className="text-sm font-body text-foreground whitespace-pre-line">
                  {messageTemplates.find(t => t.id === selectedTemplate)?.content}
                </p>
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground font-body uppercase tracking-wider mb-1.5 block">Ou mensagem personalizada</label>
              <textarea value={customMessage} onChange={e => { setCustomMessage(e.target.value); setSelectedTemplate(''); }}
                placeholder="Digite sua mensagem..."
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none h-24 resize-none" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-body uppercase tracking-wider mb-1.5 block">Agendamento</label>
              <div className="flex gap-2">
                {[
                  { val: 'now', label: 'Enviar agora' },
                  { val: '30min', label: 'Em 30 min' },
                  { val: '1h', label: 'Em 1 hora' },
                  { val: 'schedule', label: 'Agendar' },
                ].map(opt => (
                  <button key={opt.val} onClick={() => setDisparoSchedule(opt.val)}
                    className={`flex-1 text-xs py-2 rounded-lg font-body transition-colors ${disparoSchedule === opt.val ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-surface-hover'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setShowDisparo(false)} className="px-4 py-2 text-sm font-body text-muted-foreground hover:text-foreground">
              Cancelar
            </button>
            <button onClick={handleDisparo} disabled={!selectedTemplate && !customMessage}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-body font-medium disabled:opacity-50 flex items-center gap-2">
              <Send className="w-3.5 h-3.5" /> Enviar para {selectedIds.size} clientes
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reativação IA Dialog */}
      <Dialog open={showReativacao} onOpenChange={setShowReativacao}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-foreground flex items-center gap-2">
              <Zap className="w-5 h-5 text-warning" /> Reativação por IA
            </DialogTitle>
            <DialogDescription className="font-body text-muted-foreground">
              A IA entrará em contato de forma humanizada com {selectedIds.size} clientes
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-warning/5 border border-warning/20 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-display font-semibold text-foreground">Como funciona:</h4>
              <div className="space-y-2 text-xs font-body text-foreground">
                <div className="flex items-start gap-2">
                  <span className="text-warning font-bold">1.</span>
                  <span>A IA envia mensagem personalizada baseada no histórico do cliente</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-warning font-bold">2.</span>
                  <span>Se o cliente responder, a IA conversa de forma humanizada</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-warning font-bold">3.</span>
                  <span>Quando identificar interesse, faz handoff para o vendedor responsável</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-warning font-bold">4.</span>
                  <span>O gestor acompanha tudo pelo Dashboard e Central de Chat</span>
                </div>
              </div>
            </div>
            <div className="bg-secondary rounded-lg p-3">
              <p className="text-xs font-body text-muted-foreground mb-1">Estimativa de resultados:</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-display font-bold text-foreground">{Math.round(selectedIds.size * 0.35)}</p>
                  <p className="text-[9px] text-muted-foreground">Responderão (~35%)</p>
                </div>
                <div>
                  <p className="text-lg font-display font-bold text-warning">{Math.round(selectedIds.size * 0.18)}</p>
                  <p className="text-[9px] text-muted-foreground">Interessados (~18%)</p>
                </div>
                <div>
                  <p className="text-lg font-display font-bold text-success">{Math.round(selectedIds.size * 0.08)}</p>
                  <p className="text-[9px] text-muted-foreground">Fecharão (~8%)</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setShowReativacao(false)} className="px-4 py-2 text-sm font-body text-muted-foreground">Cancelar</button>
            <button onClick={handleReativacao}
              className="px-4 py-2 bg-warning text-warning-foreground rounded-lg text-sm font-body font-medium flex items-center gap-2">
              <Zap className="w-3.5 h-3.5" /> Iniciar Reativação
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientDatabase;
