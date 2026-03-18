import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getClientsByUnit, getSellersByUnit, getConversationsByUnit, STAGE_LABELS, STAGE_COLORS, STAGE_ORDER, sellers as allSellers, messageTemplates } from '@/data/mockData';
import type { UnitFilter } from '@/components/Layout';
import type { LeadStage, Client, Message } from '@/data/mockData';
import { GripVertical, User, Phone, Eye, MessageSquare, X, Edit3, Save, Send, Clock, FileText, History, Bot, ArrowRightLeft, ChevronRight, Mail, MapPin, CreditCard, StickyNote, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

type DetailTab = 'resumo' | 'registros' | 'chat' | 'historico';

const CRMKanban = () => {
  const { unitFilter } = useOutletContext<{ unitFilter: UnitFilter }>();
  const allClients = getClientsByUnit(unitFilter);
  const unitSellers = getSellersByUnit(unitFilter);
  const allConvs = getConversationsByUnit(unitFilter);
  const [sellerFilter, setSellerFilter] = useState('all');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('resumo');
  const [draggedClient, setDraggedClient] = useState<string | null>(null);

  // Editable fields
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  // Chat message input
  const [chatInput, setChatInput] = useState('');

  // Activity log mock
  const [activities] = useState([
    { id: 'a1', type: 'stage', text: 'Estágio alterado para Orçamento', date: '16/03/2026 10:30', user: 'IA' },
    { id: 'a2', type: 'note', text: 'Cliente pediu orçamento com urgência', date: '15/03/2026 16:00', user: 'Carlos Mendes' },
    { id: 'a3', type: 'call', text: 'Ligação de 4min — cliente interessado', date: '15/03/2026 14:20', user: 'Carlos Mendes' },
    { id: 'a4', type: 'handoff', text: 'Handoff da IA para vendedor', date: '15/03/2026 09:06', user: 'IA' },
    { id: 'a5', type: 'message', text: 'Primeira mensagem recebida via WhatsApp', date: '15/03/2026 09:00', user: 'Cliente' },
    { id: 'a6', type: 'created', text: 'Lead criado automaticamente pela IA', date: '15/03/2026 08:58', user: 'Sistema' },
  ]);

  const filtered = useMemo(() => {
    if (sellerFilter === 'all') return allClients;
    if (sellerFilter === 'unassigned') return allClients.filter(c => !c.sellerId);
    return allClients.filter(c => c.sellerId === sellerFilter);
  }, [allClients, sellerFilter]);

  const columns = STAGE_ORDER.map(stage => ({
    stage,
    label: STAGE_LABELS[stage],
    clients: filtered.filter(c => c.stage === stage),
  }));

  const handleDrop = (stage: LeadStage) => {
    if (!draggedClient) return;
    const client = allClients.find(c => c.id === draggedClient);
    if (client) {
      toast.success(`${client.name} movido para ${STAGE_LABELS[stage]}`);
    }
    setDraggedClient(null);
  };

  const openDetail = (client: Client) => {
    setSelectedClient(client);
    setDetailTab('resumo');
    setEditingField(null);
    setEditValues({});
  };

  const getClientConversation = (clientId: string) => {
    return allConvs.find(c => c.clientId === clientId);
  };

  const startEdit = (field: string, value: string) => {
    setEditingField(field);
    setEditValues({ ...editValues, [field]: value });
  };

  const saveEdit = (field: string) => {
    toast.success(`Campo "${field}" atualizado!`);
    setEditingField(null);
  };

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    toast.success('Mensagem enviada!');
    setChatInput('');
  };

  const renderEditableField = (label: string, field: string, value: string) => (
    <div className="group">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-body">{label}</p>
      {editingField === field ? (
        <div className="flex items-center gap-1 mt-0.5">
          <input
            value={editValues[field] ?? value}
            onChange={e => setEditValues({ ...editValues, [field]: e.target.value })}
            className="flex-1 bg-secondary border border-primary/30 rounded px-2 py-1 text-xs font-body text-foreground focus:outline-none"
            autoFocus
          />
          <button onClick={() => saveEdit(field)} className="text-success hover:text-success/80"><Save className="w-3 h-3" /></button>
          <button onClick={() => setEditingField(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
        </div>
      ) : (
        <div className="flex items-center gap-1 mt-0.5">
          <p className="text-xs text-foreground font-body">{value}</p>
          <button onClick={() => startEdit(field, value)} className="opacity-0 group-hover:opacity-100 transition-opacity">
            <Edit3 className="w-2.5 h-2.5 text-muted-foreground hover:text-primary" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">CRM Kanban</h1>
          <p className="text-sm text-muted-foreground font-body">{filtered.length} leads no pipeline</p>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-muted-foreground font-body">Vendedor:</span>
          <select
            value={sellerFilter}
            onChange={e => setSellerFilter(e.target.value)}
            className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs font-body text-foreground focus:outline-none"
          >
            <option value="all">Todos</option>
            <option value="unassigned">Sem vendedor</option>
            {unitSellers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-3 min-w-max h-full pb-4">
          {columns.map(col => (
            <div
              key={col.stage}
              className="w-64 flex flex-col shrink-0"
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(col.stage)}
            >
              <div className={`px-3 py-2 rounded-t-lg ${STAGE_COLORS[col.stage]} bg-opacity-20 border-b-2`}
                style={{ borderColor: 'currentColor' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-display font-bold text-foreground">{col.label}</span>
                  <span className="text-[10px] bg-background/50 px-1.5 py-0.5 rounded-full font-body font-bold text-foreground">
                    {col.clients.length}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 p-2 bg-secondary/30 rounded-b-lg scrollbar-thin">
                {col.clients.map(client => {
                  const seller = unitSellers.find(s => s.id === client.sellerId);
                  const conv = getClientConversation(client.id);
                  return (
                    <motion.div
                      key={client.id}
                      draggable
                      onDragStart={() => setDraggedClient(client.id)}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => openDetail(client)}
                      className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-primary/30 transition-colors group"
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="w-3 h-3 text-muted-foreground mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-body font-medium text-foreground truncate">{client.name}</p>
                            {conv?.isAIActive && (
                              <Bot className="w-3 h-3 text-warning shrink-0" />
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground font-body flex items-center gap-1 mt-0.5">
                            <Phone className="w-2.5 h-2.5" /> {client.phone}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[9px] text-muted-foreground font-body">{client.source}</span>
                            {seller ? (
                              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold text-primary">
                                {seller.avatar}
                              </div>
                            ) : (
                              <span className="text-[9px] text-muted-foreground italic">Sem vendedor</span>
                            )}
                          </div>
                          {client.purchaseHistory.length > 0 && (
                            <p className="text-[9px] text-success font-body mt-1">
                              R$ {client.purchaseHistory.reduce((s, p) => s + p.value, 0).toLocaleString()}
                            </p>
                          )}
                          <p className="text-[8px] text-muted-foreground/60 font-body mt-1">
                            Último contato: {new Date(client.lastContact).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                {col.clients.length === 0 && (
                  <p className="text-[10px] text-muted-foreground text-center py-4 font-body">Vazio</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full CRM Detail Dialog */}
      <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0">
          {selectedClient && (() => {
            const seller = allSellers.find(s => s.id === selectedClient.sellerId);
            const conv = getClientConversation(selectedClient.id);
            const tabs: { key: DetailTab; label: string; icon: typeof FileText }[] = [
              { key: 'resumo', label: 'Resumo', icon: User },
              { key: 'registros', label: 'Registros', icon: FileText },
              { key: 'chat', label: 'Chat', icon: MessageSquare },
              { key: 'historico', label: 'Histórico', icon: History },
            ];

            return (
              <>
                {/* Header */}
                <div className="px-6 pt-5 pb-3 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary font-display">
                        {selectedClient.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                      </div>
                      <div>
                        <DialogTitle className="font-display text-foreground text-lg">{selectedClient.name}</DialogTitle>
                        <DialogDescription className="font-body text-muted-foreground text-xs">
                          {selectedClient.erpCode} • {selectedClient.city} • {selectedClient.source}
                        </DialogDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-1 rounded-full font-body font-medium ${STAGE_COLORS[selectedClient.stage]} text-white`}>
                        {STAGE_LABELS[selectedClient.stage]}
                      </span>
                      {seller && (
                        <div className="flex items-center gap-1.5 bg-secondary rounded-full px-2 py-1">
                          <div className="w-4 h-4 rounded-full bg-primary/30 flex items-center justify-center text-[7px] font-bold text-primary">{seller.avatar}</div>
                          <span className="text-[10px] text-foreground font-body">{seller.name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1 mt-4">
                    {tabs.map(t => (
                      <button key={t.key} onClick={() => setDetailTab(t.key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-body rounded-lg transition-colors ${detailTab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface-hover'}`}>
                        <t.icon className="w-3 h-3" /> {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <AnimatePresence mode="wait">
                    {detailTab === 'resumo' && (
                      <motion.div key="resumo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <h4 className="text-xs text-muted-foreground uppercase tracking-wider font-body font-semibold flex items-center gap-1.5"><User className="w-3 h-3" /> Dados Pessoais</h4>
                            {renderEditableField('Nome', 'name', selectedClient.name)}
                            {renderEditableField('Telefone', 'phone', selectedClient.phone)}
                            {renderEditableField('Email', 'email', selectedClient.email)}
                            {renderEditableField('CPF', 'cpf', selectedClient.cpf)}
                            {renderEditableField('Endereço', 'address', `${selectedClient.address} — ${selectedClient.city}`)}
                          </div>
                          <div className="space-y-3">
                            <h4 className="text-xs text-muted-foreground uppercase tracking-wider font-body font-semibold flex items-center gap-1.5"><CreditCard className="w-3 h-3" /> Comercial</h4>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-body">Cód. ERP</p>
                              <p className="text-xs text-foreground font-body mt-0.5">{selectedClient.erpCode}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-body">Fonte</p>
                              <p className="text-xs text-foreground font-body mt-0.5">{selectedClient.source}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-body">Orçamento</p>
                              <p className="text-xs text-foreground font-body mt-0.5">{selectedClient.hasBudget ? `Sim — ${selectedClient.budgetDate ? new Date(selectedClient.budgetDate).toLocaleDateString('pt-BR') : ''}` : 'Não solicitado'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-body">Vendedor</p>
                              <p className="text-xs text-foreground font-body mt-0.5">{seller ? seller.name : 'Sem vendedor atribuído'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-body">Criado em</p>
                              <p className="text-xs text-foreground font-body mt-0.5">{new Date(selectedClient.createdAt).toLocaleDateString('pt-BR')}</p>
                            </div>
                          </div>
                        </div>

                        {/* Notes */}
                        <div className="border-t border-border pt-3">
                          <h4 className="text-xs text-muted-foreground uppercase tracking-wider font-body font-semibold flex items-center gap-1.5 mb-2"><StickyNote className="w-3 h-3" /> Notas</h4>
                          {renderEditableField('', 'notes', selectedClient.notes)}
                        </div>

                        {/* Quick Actions */}
                        <div className="border-t border-border pt-3">
                          <h4 className="text-xs text-muted-foreground uppercase tracking-wider font-body font-semibold mb-2">Ações Rápidas</h4>
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={() => { setDetailTab('chat'); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary text-xs rounded-lg font-body hover:bg-primary/20">
                              <MessageSquare className="w-3 h-3" /> Abrir Chat
                            </button>
                            <button onClick={() => toast.success('Ligação iniciada!')} className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success text-xs rounded-lg font-body hover:bg-success/20">
                              <Phone className="w-3 h-3" /> Ligar
                            </button>
                            <button onClick={() => toast.success('Email enviado!')} className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 text-cyan-400 text-xs rounded-lg font-body hover:bg-cyan-500/20">
                              <Mail className="w-3 h-3" /> Enviar Email
                            </button>
                            <button onClick={() => toast.success('Estágio atualizado!')} className="flex items-center gap-1.5 px-3 py-1.5 bg-warning/10 text-warning text-xs rounded-lg font-body hover:bg-warning/20">
                              <ArrowRightLeft className="w-3 h-3" /> Mover Estágio
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {detailTab === 'registros' && (
                      <motion.div key="registros" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                        {/* Add Note */}
                        <div className="glass-card p-3 rounded-lg">
                          <h4 className="text-xs text-muted-foreground uppercase tracking-wider font-body font-semibold mb-2 flex items-center gap-1.5"><Plus className="w-3 h-3" /> Novo Registro</h4>
                          <div className="flex gap-2">
                            <select className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-xs font-body text-foreground focus:outline-none">
                              <option>Nota</option>
                              <option>Ligação</option>
                              <option>Reunião</option>
                              <option>Email</option>
                              <option>Follow-up</option>
                              <option>Visita Técnica</option>
                            </select>
                            <input placeholder="Descreva a atividade..." className="flex-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs font-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none" />
                            <button onClick={() => toast.success('Registro adicionado!')} className="px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-lg font-body font-medium">Salvar</button>
                          </div>
                        </div>

                        {/* Activity Timeline */}
                        <div>
                          <h4 className="text-xs text-muted-foreground uppercase tracking-wider font-body font-semibold mb-3">Linha do Tempo</h4>
                          <div className="space-y-0">
                            {activities.map((act, i) => (
                              <div key={act.id} className="flex gap-3">
                                <div className="flex flex-col items-center">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                                    act.type === 'handoff' ? 'bg-warning/20' :
                                    act.type === 'stage' ? 'bg-primary/20' :
                                    act.type === 'call' ? 'bg-success/20' :
                                    act.type === 'note' ? 'bg-cyan-500/20' :
                                    'bg-secondary'
                                  }`}>
                                    {act.type === 'handoff' ? <ArrowRightLeft className="w-3 h-3 text-warning" /> :
                                     act.type === 'stage' ? <ChevronRight className="w-3 h-3 text-primary" /> :
                                     act.type === 'call' ? <Phone className="w-3 h-3 text-success" /> :
                                     act.type === 'note' ? <StickyNote className="w-3 h-3 text-cyan-400" /> :
                                     act.type === 'message' ? <MessageSquare className="w-3 h-3 text-muted-foreground" /> :
                                     <Clock className="w-3 h-3 text-muted-foreground" />}
                                  </div>
                                  {i < activities.length - 1 && <div className="w-px flex-1 bg-border my-1" />}
                                </div>
                                <div className="pb-4">
                                  <p className="text-xs text-foreground font-body">{act.text}</p>
                                  <p className="text-[10px] text-muted-foreground font-body mt-0.5">{act.date} • {act.user}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {detailTab === 'chat' && (
                      <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-[400px]">
                        {conv ? (
                          <>
                            {/* Chat header */}
                            <div className="flex items-center gap-2 pb-3 border-b border-border mb-3">
                              {conv.isAIActive && (
                                <span className="text-[10px] bg-warning/20 text-warning px-2 py-0.5 rounded-full font-body font-medium flex items-center gap-1"><Bot className="w-3 h-3" /> IA Ativa</span>
                              )}
                              {conv.wasHandedOff && (
                                <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-body font-medium flex items-center gap-1"><ArrowRightLeft className="w-3 h-3" /> Handoff realizado</span>
                              )}
                              <span className="text-[10px] text-muted-foreground font-body ml-auto">Inbox: {conv.inbox}</span>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                              {conv.messages.map(msg => (
                                <div key={msg.id} className={`flex ${msg.sender === 'client' ? 'justify-start' : 'justify-end'}`}>
                                  <div className={`max-w-[75%] rounded-lg px-3 py-2 text-xs font-body ${
                                    msg.isHandoff ? 'bg-warning/10 border border-warning/30 text-foreground w-full max-w-full' :
                                    msg.sender === 'client' ? 'bg-secondary text-foreground' :
                                    msg.sender === 'ai' ? 'bg-primary/10 border border-primary/20 text-foreground' :
                                    'bg-success/10 border border-success/20 text-foreground'
                                  }`}>
                                    {msg.senderName && !msg.isHandoff && (
                                      <p className="text-[9px] text-muted-foreground mb-0.5 font-medium">{msg.senderName}</p>
                                    )}
                                    {msg.isHandoff && <p className="text-[9px] text-warning mb-0.5 font-medium">⚡ Sistema</p>}
                                    <p className="whitespace-pre-line">{msg.content}</p>
                                    <p className="text-[8px] text-muted-foreground mt-1 text-right">
                                      {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Input */}
                            <div className="flex items-center gap-2 pt-3 border-t border-border mt-3">
                              <input
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                                placeholder="Enviar mensagem..."
                                className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-xs font-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                              />
                              <button onClick={sendChatMessage} className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                                <Send className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="flex-1 flex items-center justify-center text-center">
                            <div>
                              <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                              <p className="text-sm text-muted-foreground font-body">Sem conversa registrada</p>
                              <button onClick={() => toast.success('Conversa iniciada!')} className="mt-3 px-4 py-2 bg-primary text-primary-foreground text-xs rounded-lg font-body font-medium">
                                Iniciar Conversa
                              </button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {detailTab === 'historico' && (
                      <motion.div key="historico" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                        <h4 className="text-xs text-muted-foreground uppercase tracking-wider font-body font-semibold flex items-center gap-1.5"><CreditCard className="w-3 h-3" /> Histórico de Compras (Protheus ERP)</h4>
                        {selectedClient.purchaseHistory.length > 0 ? (
                          <div className="space-y-2">
                            {selectedClient.purchaseHistory.map(p => (
                              <div key={p.id} className="glass-card p-3 rounded-lg flex items-center justify-between">
                                <div>
                                  <p className="text-xs font-body font-medium text-foreground">{p.product}</p>
                                  <p className="text-[10px] text-muted-foreground font-body">{new Date(p.date).toLocaleDateString('pt-BR')} • {p.invoice}</p>
                                </div>
                                <p className="text-sm font-display font-bold text-success">R$ {p.value.toLocaleString()}</p>
                              </div>
                            ))}
                            <div className="border-t border-border pt-3 flex justify-between items-center">
                              <span className="text-xs text-muted-foreground font-body">Total</span>
                              <span className="text-sm font-display font-bold text-foreground">
                                R$ {selectedClient.purchaseHistory.reduce((s, p) => s + p.value, 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <CreditCard className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground font-body">Sem compras registradas</p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CRMKanban;
