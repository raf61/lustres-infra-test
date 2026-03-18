import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getConversationsByUnit, getSellersByUnit, STAGE_LABELS, STAGE_COLORS, clients as allClients, inboxes, sellers as allSellers } from '@/data/mockData';
import type { UnitFilter } from '@/components/Layout';
import type { Conversation } from '@/data/mockData';
import { Bot, User, Search, ArrowRightLeft, Phone, Mail, MapPin, FileText, ShoppingBag } from 'lucide-react';

const ChatCenter = () => {
  const { unitFilter } = useOutletContext<{ unitFilter: UnitFilter }>();
  const convs = getConversationsByUnit(unitFilter);
  const unitSellers = getSellersByUnit(unitFilter);
  const [selected, setSelected] = useState<Conversation | null>(convs[0] || null);
  const [filterType, setFilterType] = useState<'all' | 'ai' | 'human'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sellerFilter, setSellerFilter] = useState('all');
  const [inboxFilter, setInboxFilter] = useState('all');

  const filteredConvs = useMemo(() => {
    return convs.filter(c => {
      if (filterType === 'ai' && !c.isAIActive) return false;
      if (filterType === 'human' && c.isAIActive) return false;
      if (searchTerm && !c.clientName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (sellerFilter !== 'all' && c.sellerId !== sellerFilter && c.handoffSellerId !== sellerFilter) return false;
      if (inboxFilter !== 'all' && c.inbox !== inboxFilter) return false;
      return true;
    });
  }, [convs, filterType, searchTerm, sellerFilter, inboxFilter]);

  const selectedClient = selected ? allClients.find(cl => cl.id === selected.clientId) : null;

  // Get initials for avatar
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  // Get seller for a conversation
  const getConvSeller = (conv: Conversation) => {
    const sid = conv.sellerId || conv.handoffSellerId;
    return sid ? allSellers.find(s => s.id === sid) : null;
  };

  return (
    <div className="flex h-full">
      {/* Lead List */}
      <div className="w-80 border-r border-border flex flex-col shrink-0">
        <div className="p-4 border-b border-border space-y-3">
          <h2 className="font-display text-lg font-bold text-foreground">Central de Chat</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar conversa..."
              className="w-full bg-secondary border border-border rounded-lg pl-9 pr-3 py-2 text-sm font-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div className="flex gap-1">
            {(['all', 'ai', 'human'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={`flex-1 text-xs py-1.5 rounded font-body transition-colors ${filterType === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-surface-hover'}`}
              >
                {f === 'all' ? 'Todas' : f === 'ai' ? '🤖 IA' : '👤 Humano'}
              </button>
            ))}
          </div>
          {/* Seller & Inbox filters */}
          <div className="grid grid-cols-2 gap-2">
            <select value={sellerFilter} onChange={e => setSellerFilter(e.target.value)}
              className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-[11px] font-body text-foreground focus:outline-none">
              <option value="all">Todos vendedores</option>
              {unitSellers.map(s => <option key={s.id} value={s.id}>{s.name.split(' ')[0]}</option>)}
            </select>
            <select value={inboxFilter} onChange={e => setInboxFilter(e.target.value)}
              className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-[11px] font-body text-foreground focus:outline-none">
              <option value="all">Todos inboxes</option>
              {inboxes.map(ib => <option key={ib.id} value={ib.label}>{ib.label.split('—')[1]?.trim() || ib.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex-1 overflow-auto scrollbar-thin">
          {filteredConvs.map(conv => {
            const seller = getConvSeller(conv);
            return (
              <button
                key={conv.id}
                onClick={() => setSelected(conv)}
                className={`w-full text-left p-3 border-b border-border/50 hover:bg-surface-hover transition-colors ${selected?.id === conv.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {/* Avatar with initials */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    conv.isAIActive ? 'bg-warning/20 text-warning' : 'bg-primary/20 text-primary'
                  }`}>
                    {conv.isAIActive ? <Bot className="w-4 h-4" /> : getInitials(conv.clientName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-body font-medium text-foreground truncate">{conv.clientName}</span>
                      {conv.unread && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] px-1 py-0.5 rounded ${STAGE_COLORS[conv.stage]} text-foreground font-medium`}>
                        {STAGE_LABELS[conv.stage]}
                      </span>
                      {seller && (
                        <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                          <div className="w-3 h-3 rounded-full bg-success/20 flex items-center justify-center text-[6px] font-bold text-success">
                            {seller.avatar}
                          </div>
                          {seller.name.split(' ')[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 truncate font-body pl-10">
                  {(conv.messages[conv.messages.length - 1]?.content || '').substring(0, 50)}...
                </p>
              </button>
            );
          })}
          {filteredConvs.length === 0 && (
            <p className="text-center text-muted-foreground font-body text-xs py-8">Nenhuma conversa encontrada</p>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selected ? (
          <>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                  selected.isAIActive ? 'bg-warning/20 text-warning' : 'bg-primary/20 text-primary'
                }`}>
                  {getInitials(selected.clientName)}
                </div>
                <div>
                  <h3 className="font-display font-semibold text-foreground">{selected.clientName}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-body">
                    <span>{selected.clientPhone}</span>
                    <span>•</span>
                    <span className="text-[10px] text-muted-foreground">{selected.inbox}</span>
                    <span>•</span>
                    <span className={`px-1.5 py-0.5 rounded ${STAGE_COLORS[selected.stage]} text-foreground text-[10px] font-medium`}>{STAGE_LABELS[selected.stage]}</span>
                    {selected.isAIActive && (
                      <span className="flex items-center gap-1 text-warning">
                        <Bot className="w-3 h-3" /> IA Ativa
                      </span>
                    )}
                    {selected.wasHandedOff && selected.sellerName && (
                      <span className="flex items-center gap-1 text-success">
                        <User className="w-3 h-3" /> {selected.sellerName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-2 scrollbar-thin">
              {selected.messages.map(msg => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={msg.isHandoff ? 'flex justify-center' : `flex ${msg.sender === 'client' ? 'justify-start' : 'justify-end'}`}
                >
                  {msg.isHandoff ? (
                    <div className="bg-warning/10 border border-warning/30 rounded-lg px-4 py-2 max-w-md">
                      <div className="flex items-center gap-2 text-warning text-xs font-body font-medium">
                        <ArrowRightLeft className="w-4 h-4" />
                        Handoff para Vendedor
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 font-body whitespace-pre-line">{msg.content}</p>
                    </div>
                  ) : (
                    <div className={`max-w-[65%] rounded-lg px-3.5 py-2 ${
                      msg.sender === 'client'
                        ? 'bg-secondary text-foreground'
                        : msg.sender === 'ai'
                          ? 'bg-primary/15 text-foreground border border-primary/20'
                          : 'bg-success/15 text-foreground border border-success/20'
                    }`}>
                      {msg.sender !== 'client' && (
                        <div className="flex items-center gap-1 mb-1">
                          {msg.sender === 'ai' ? <Bot className="w-3 h-3 text-primary" /> : <User className="w-3 h-3 text-success" />}
                          <span className="text-[10px] font-medium font-body text-muted-foreground">
                            {msg.sender === 'ai' ? 'Assistente IA' : msg.senderName}
                          </span>
                        </div>
                      )}
                      <p className="text-sm font-body whitespace-pre-line">{msg.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 font-body text-right">
                        {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            <div className="p-3 border-t border-border">
              <div className="flex gap-2">
                <input
                  placeholder="Modo visualização — conversa mockada"
                  disabled
                  className="flex-1 bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm font-body text-muted-foreground"
                />
                <button disabled className="px-4 py-2.5 bg-primary/50 text-primary-foreground rounded-lg text-sm font-body">Enviar</button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground font-body">
            Selecione uma conversa
          </div>
        )}
      </div>

      {/* CRM Sidebar */}
      {selected && selectedClient && (
        <div className="w-72 border-l border-border overflow-auto scrollbar-thin shrink-0">
          <div className="p-4 border-b border-border">
            <h3 className="font-display text-sm font-semibold text-foreground mb-1">Dados do Cliente</h3>
            <p className="text-[10px] text-muted-foreground font-body">Protheus ERP • {selectedClient.erpCode}</p>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-body">
                <Phone className="w-3 h-3 text-muted-foreground" />
                <span className="text-foreground">{selectedClient.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-body">
                <Mail className="w-3 h-3 text-muted-foreground" />
                <span className="text-foreground truncate">{selectedClient.email}</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-body">
                <MapPin className="w-3 h-3 text-muted-foreground" />
                <span className="text-foreground">{selectedClient.city}</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-body">
                <FileText className="w-3 h-3 text-muted-foreground" />
                <span className="text-foreground">{selectedClient.cpf}</span>
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <h4 className="text-xs text-muted-foreground font-body uppercase tracking-wider mb-2">Estágio</h4>
              <span className={`text-xs px-2 py-1 rounded ${STAGE_COLORS[selectedClient.stage]} text-foreground font-medium`}>
                {STAGE_LABELS[selectedClient.stage]}
              </span>
            </div>

            <div className="border-t border-border pt-3">
              <h4 className="text-xs text-muted-foreground font-body uppercase tracking-wider mb-2">Fonte</h4>
              <span className="text-xs text-foreground font-body">{selectedClient.source}</span>
            </div>

            <div className="border-t border-border pt-3">
              <h4 className="text-xs text-muted-foreground font-body uppercase tracking-wider mb-2">Notas</h4>
              <p className="text-xs text-foreground font-body">{selectedClient.notes}</p>
            </div>

            {selectedClient.purchaseHistory.length > 0 && (
              <div className="border-t border-border pt-3">
                <h4 className="text-xs text-muted-foreground font-body uppercase tracking-wider mb-2 flex items-center gap-1">
                  <ShoppingBag className="w-3 h-3" /> Histórico
                </h4>
                <div className="space-y-2">
                  {selectedClient.purchaseHistory.map(p => (
                    <div key={p.id} className="bg-secondary rounded p-2">
                      <p className="text-xs font-body text-foreground font-medium">{p.product}</p>
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                        <span>R$ {p.value.toLocaleString()}</span>
                        <span>{p.invoice}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatCenter;
