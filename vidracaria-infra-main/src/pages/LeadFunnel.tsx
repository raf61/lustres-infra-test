import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getFunnelData, getConversationsByUnit, getClientsByUnit, STAGE_LABELS, STAGE_COLORS } from '@/data/mockData';
import type { UnitFilter } from '@/components/Layout';
import type { Conversation } from '@/data/mockData';
import { Bot, User, ArrowRight, Filter, Eye, ArrowRightLeft } from 'lucide-react';

const LeadFunnel = () => {
  const { unitFilter } = useOutletContext<{ unitFilter: UnitFilter }>();
  const funnel = getFunnelData(unitFilter);
  const convs = getConversationsByUnit(unitFilter);
  const clients = getClientsByUnit(unitFilter);
  const [viewMode, setViewMode] = useState<'funnel' | 'ai-pipeline'>('funnel');
  const [selectedStageConvs, setSelectedStageConvs] = useState<Conversation[] | null>(null);
  const [selectedStageLabel, setSelectedStageLabel] = useState('');

  // AI Pipeline data
  const aiActive = convs.filter(c => c.isAIActive);
  const aiHandedOff = convs.filter(c => c.wasHandedOff && !c.isAIActive);
  const aiToClose = convs.filter(c => c.wasHandedOff && c.stage === 'fechado');
  const aiToLost = convs.filter(c => c.wasHandedOff && c.stage === 'perdido');

  const totalFunnel = funnel.reduce((s, f) => s + f.count, 0);

  const viewStageConvs = (stageConvs: Conversation[], label: string) => {
    setSelectedStageConvs(stageConvs);
    setSelectedStageLabel(label);
  };

  // Follow-up metrics
  const followUpMetrics = {
    total: convs.length,
    withFollowUp: Math.floor(convs.length * 0.65),
    followUpConversion: 27.3,
    avgFollowUps: 2.4,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Funil de Leads & Atendimento IA</h1>
          <p className="text-sm text-muted-foreground font-body">Visão de funil, pipeline IA e métricas de follow-up</p>
        </div>
        <div className="flex gap-1">
          {(['funnel', 'ai-pipeline'] as const).map(v => (
            <button key={v} onClick={() => setViewMode(v)}
              className={`text-xs px-3 py-1.5 rounded-lg font-body transition-colors ${viewMode === v ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-surface-hover'}`}>
              {v === 'funnel' ? 'Funil de Vendas' : 'Pipeline IA'}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'funnel' ? (
        <div className="grid grid-cols-3 gap-6">
          {/* Visual Funnel */}
          <div className="col-span-2 glass-card p-6 rounded-lg">
            <h3 className="font-display text-sm font-semibold text-foreground mb-6">Funil de Conversão</h3>
            <div className="space-y-2">
              {funnel.map((s, i) => {
                const pct = totalFunnel > 0 ? (s.count / totalFunnel * 100) : 0;
                const widthPct = totalFunnel > 0 ? Math.max(20, 100 - i * 12) : 20;
                const stageConvs = convs.filter(c => c.stage === s.stage);
                return (
                  <motion.div
                    key={s.stage}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="relative cursor-pointer group"
                    onClick={() => viewStageConvs(stageConvs, s.label)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-24 text-right">
                        <p className="text-xs font-body text-muted-foreground">{s.label}</p>
                      </div>
                      <div className="flex-1 relative" style={{ maxWidth: `${widthPct}%` }}>
                        <div className={`h-12 ${['bg-blue-500/80', 'bg-warning/80', 'bg-cyan-500/80', 'bg-purple-500/80', 'bg-yellow-500/80', 'bg-success/80', 'bg-destructive/80'][i]} rounded-lg flex items-center justify-between px-4 group-hover:brightness-110 transition-all`}>
                          <span className="text-sm font-display font-bold text-foreground">{s.count}</span>
                          <span className="text-xs font-body text-foreground/80">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      {i < funnel.length - 1 && (
                        <div className="text-[10px] text-muted-foreground font-body">
                          {funnel[i + 1] && s.count > 0 ? `${((funnel[i + 1].count / s.count) * 100).toFixed(0)}%` : '—'} →
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Follow-up Metrics */}
          <div className="space-y-4">
            <div className="glass-card p-5 rounded-lg">
              <h3 className="font-display text-sm font-semibold text-foreground mb-4">Métricas de Follow-up</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground font-body">Leads com Follow-up</span>
                  <span className="text-sm font-display font-bold text-foreground">{followUpMetrics.withFollowUp}/{followUpMetrics.total}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground font-body">Conversão Follow-up</span>
                  <span className="text-sm font-display font-bold text-success">{followUpMetrics.followUpConversion}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground font-body">Média Follow-ups/Lead</span>
                  <span className="text-sm font-display font-bold text-warning">{followUpMetrics.avgFollowUps}</span>
                </div>
              </div>
            </div>

            <div className="glass-card p-5 rounded-lg">
              <h3 className="font-display text-sm font-semibold text-foreground mb-4">Resumo Geral</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground font-body">Total Leads</span>
                  <span className="text-sm font-bold font-display text-foreground">{totalFunnel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground font-body">Fechados</span>
                  <span className="text-sm font-bold font-display text-success">{funnel.find(f => f.stage === 'fechado')?.count || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground font-body">Perdidos</span>
                  <span className="text-sm font-bold font-display text-destructive">{funnel.find(f => f.stage === 'perdido')?.count || 0}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="text-xs text-muted-foreground font-body">Taxa Conversão Geral</span>
                  <span className="text-sm font-bold font-display text-primary">
                    {totalFunnel > 0 ? ((funnel.find(f => f.stage === 'fechado')?.count || 0) / totalFunnel * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* AI Pipeline View */
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'IA Ativa', count: aiActive.length, icon: Bot, color: 'text-warning', bgColor: 'bg-warning/10', convs: aiActive },
              { label: 'Handoff → Vendedor', count: aiHandedOff.length, icon: ArrowRightLeft, color: 'text-primary', bgColor: 'bg-primary/10', convs: aiHandedOff },
              { label: 'IA → Fechado', count: aiToClose.length, icon: User, color: 'text-success', bgColor: 'bg-success/10', convs: aiToClose },
              { label: 'IA → Perdido', count: aiToLost.length, icon: User, color: 'text-destructive', bgColor: 'bg-destructive/10', convs: aiToLost },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => viewStageConvs(item.convs, item.label)}
                className={`glass-card p-5 rounded-lg cursor-pointer hover:border-primary/50 transition-all`}
              >
                <div className={`w-10 h-10 rounded-lg ${item.bgColor} flex items-center justify-center mb-3`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <p className="text-2xl font-display font-bold text-foreground">{item.count}</p>
                <p className="text-xs text-muted-foreground font-body mt-1">{item.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Pipeline Flow */}
          <div className="glass-card p-6 rounded-lg">
            <h3 className="font-display text-sm font-semibold text-foreground mb-4">Fluxo de Atendimento IA</h3>
            <div className="flex items-center justify-center gap-4">
              <div className="text-center p-4 bg-warning/10 rounded-lg border border-warning/30 min-w-[140px]">
                <Bot className="w-8 h-8 text-warning mx-auto mb-2" />
                <p className="font-display font-bold text-xl text-foreground">{aiActive.length}</p>
                <p className="text-xs text-muted-foreground font-body">Em conversa com IA</p>
              </div>
              <ArrowRight className="w-6 h-6 text-muted-foreground" />
              <div className="text-center p-4 bg-primary/10 rounded-lg border border-primary/30 min-w-[140px]">
                <ArrowRightLeft className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="font-display font-bold text-xl text-foreground">{aiHandedOff.length}</p>
                <p className="text-xs text-muted-foreground font-body">Handoff realizado</p>
              </div>
              <ArrowRight className="w-6 h-6 text-muted-foreground" />
              <div className="flex flex-col gap-2">
                <div className="text-center p-3 bg-success/10 rounded-lg border border-success/30 min-w-[140px]">
                  <p className="font-display font-bold text-lg text-success">{aiToClose.length}</p>
                  <p className="text-[10px] text-muted-foreground font-body">Fechados</p>
                </div>
                <div className="text-center p-3 bg-destructive/10 rounded-lg border border-destructive/30 min-w-[140px]">
                  <p className="font-display font-bold text-lg text-destructive">{aiToLost.length}</p>
                  <p className="text-[10px] text-muted-foreground font-body">Perdidos</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stage Conversations Modal */}
      {selectedStageConvs && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-8">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-card border border-border rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold text-foreground">{selectedStageLabel}</h3>
                <p className="text-xs text-muted-foreground font-body">{selectedStageConvs.length} conversas</p>
              </div>
              <button onClick={() => setSelectedStageConvs(null)} className="text-muted-foreground hover:text-foreground p-1">✕</button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-2">
              {selectedStageConvs.length > 0 ? selectedStageConvs.map(conv => (
                <div key={conv.id} className="p-3 bg-secondary rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${conv.isAIActive ? 'bg-warning' : 'bg-success'}`} />
                    <div>
                      <p className="text-sm font-body font-medium text-foreground">{conv.clientName}</p>
                      <p className="text-[10px] text-muted-foreground font-body">{conv.clientPhone} • {STAGE_LABELS[conv.stage]}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-body">
                    {conv.isAIActive ? <><Bot className="w-3 h-3 text-warning" /> IA Ativa</> : <><User className="w-3 h-3 text-success" /> {conv.sellerName}</>}
                  </div>
                </div>
              )) : (
                <p className="text-center text-muted-foreground font-body py-8">Nenhuma conversa nesta etapa</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default LeadFunnel;
