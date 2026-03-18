"use client";

import { useState, useEffect } from "react";
import {
    Users,
    MessageSquare,
    CheckCircle,
    RefreshCcw,
    BarChart3,
    ArrowLeft,
    Handshake,
    SearchX,
    Target,
    ArrowUpRight,
    Megaphone,
    UserCheck,
    Calendar,
    VolumeX,
    Eye,
    EyeOff,
    Zap,
    TrendingUp,
    Bot,
    Repeat,
    ChevronRight,
    ChevronDown,
    Folder,
    CalendarDays,
    LayoutGrid,
    Info,
    ListFilter,
    X
} from "lucide-react";
import Link from "next/link";
import { ClienteDetailDialog } from "@/components/leads/cliente-detail-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface BroadcastListItem {
    id: string;
    flowName: string;
    createdAt: string;
    status: string;
    recipientCount: number;
}

interface ConversionItem {
    id: number;
    clientId: number;
    clientName: string;
    vendedorName: string;
}

interface DetailData {
    broadcast: {
        id: string;
        flowName: string;
        createdAt: string;
        status: string;
        templateName?: string | null;
    };
    location?: {
        states: Array<{ uf: string; count: number; percentage: number }>;
    };
    funnel: {
        sent: number; delivered: number; read: number; responses: number;
        deliveryRate: number; readRate: number; responseRate: number;
    };
    aiActions: {
        updateSyndic: number; updateMaintenance: number; handoffs: number;
        resolved: number; returnResearch: number; totalActions: number; aiSuccessRate: number;
    };
    followUp: {
        totalFollowedUp: number; followupFixed: number; followupIaJudge: number;
        respondedAfterFollowup: number; followupEfficacy: number;
        initialImpacted: number; initialRecovered: number; initialEfficacy: number;
    };
    analysis: {
        silentContacts: number; silentRate: number;
        readButNoResponse: number; readButNoResponseRate: number;
        errors?: Record<string, number>;
        uniqueClients?: number;
        conversionOS: ConversionItem[];
        conversionOrcamentos: ConversionItem[];
        conversionPedidos: ConversionItem[];
    };
    filters?: {
        states: string[];
        subset: string | null;
    };
}

export default function IAMetricsPage() {
    const [list, setList] = useState<BroadcastListItem[]>([]);
    const [detail, setDetail] = useState<DetailData | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
    const [activeSessionsCount, setActiveSessionsCount] = useState<number>(0);
    const [listLoading, setListLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [showErrors, setShowErrors] = useState(false);
    const [useFallback, setUseFallback] = useState(false);

    const [viewingConvList, setViewingConvList] = useState<{ title: string; items: ConversionItem[] } | null>(null);
    const [selectedClientId, setSelectedClientId] = useState<number | null>(null);

    const [selectedStates, setSelectedStates] = useState<string[]>([]);
    const [selectedSubset, setSelectedSubset] = useState<string | null>(null);

    const toggleFolder = (folderKey: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(folderKey)) next.delete(folderKey);
            else next.add(folderKey);
            return next;
        });
    };

    const toggleFolderCheck = (items: BroadcastListItem[], e: React.MouseEvent) => {
        e.stopPropagation();
        const allIds = items.map(i => i.id);
        const allChecked = allIds.every(id => checkedIds.has(id));

        setCheckedIds(prev => {
            const next = new Set(prev);
            if (allChecked) {
                allIds.forEach(id => next.delete(id));
            } else {
                allIds.forEach(id => next.add(id));
            }
            return next;
        });
    };

    const grouped = list.reduce((acc, item) => {
        const date = new Date(item.createdAt);
        const monthYear = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        const day = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

        const monthLabel = monthYear.charAt(0).toUpperCase() + monthYear.slice(1);

        if (!acc[monthLabel]) acc[monthLabel] = {};
        if (!acc[monthLabel][day]) acc[monthLabel][day] = [];
        acc[monthLabel][day].push(item);
        return acc;
    }, {} as Record<string, Record<string, BroadcastListItem[]>>);

    const fetchList = async () => {
        setListLoading(true);
        try {
            const res = await fetch("/api/ai-agent/metrics");
            const json = await res.json();
            setList(json.items || []);
            if (typeof json.activeSessionsCount === 'number') {
                setActiveSessionsCount(json.activeSessionsCount);
            }
        } catch (err) {
            console.error("Erro ao carregar lista", err);
        } finally {
            setListLoading(false);
        }
    };

    const fetchDetail = async (id: string) => {
        setDetailLoading(true);
        try {
            const params = new URLSearchParams({
                broadcastId: id,
                useFallback: String(useFallback)
            });
            if (selectedStates.length > 0) params.append('states', selectedStates.join(','));
            if (selectedSubset) params.append('subset', selectedSubset);

            const res = await fetch(`/api/ai-agent/metrics?${params.toString()}`);
            const json = await res.json();
            if (json.funnel) setDetail(json);
        } catch (err) {
            console.error("Erro ao carregar detalhes", err);
        } finally {
            setDetailLoading(false);
        }
    };

    const fetchMulti = async (ids: string[]) => {
        setDetailLoading(true);
        setSelectedId('__multi__');
        setDetail(null);
        try {
            const params = new URLSearchParams({
                broadcastIds: ids.join(','),
                useFallback: String(useFallback)
            });
            if (selectedStates.length > 0) params.append('states', selectedStates.join(','));
            if (selectedSubset) params.append('subset', selectedSubset);

            const res = await fetch(`/api/ai-agent/metrics?${params.toString()}`);
            const json = await res.json();
            if (json.funnel) setDetail(json);
        } catch (err) {
            console.error("Erro ao carregar multi", err);
        } finally {
            setDetailLoading(false);
        }
    };

    const toggleCheck = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setCheckedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleSelect = (id: string) => {
        if (selectedId === id) {
            setSelectedId(null);
            setDetail(null);
            setSelectedStates([]);
            setSelectedSubset(null);
        } else {
            setSelectedId(id);
            // reset filters when changing broadcast?
            setSelectedStates([]);
            setSelectedSubset(null);
            fetchDetail(id);
        }
    };

    useEffect(() => { fetchList(); }, []);

    useEffect(() => {
        if (!selectedId) return;
        if (selectedId === '__multi__') {
            fetchMulti(Array.from(checkedIds));
        } else {
            fetchDetail(selectedId);
        }
    }, [useFallback, selectedStates, selectedSubset]);

    const d = detail;
    const f = d?.funnel;
    const ai = d?.aiActions;
    const fup = d?.followUp;
    const an = d?.analysis;

    if (listLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#09090b]">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#09090b] text-white p-6 font-sans">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-2 text-zinc-400 mb-2">
                        <Link href="/dashboard/relatorios" className="hover:text-white transition-colors flex items-center gap-1">
                            <ArrowLeft size={16} /> Relatórios
                        </Link>
                        <span>/</span>
                        <span className="text-zinc-500">Agente de I.A.</span>
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent">
                        Performance do Agente I.A.
                    </h1>
                </div>
                <button
                    onClick={() => { fetchList(); setSelectedId(null); setDetail(null); }}
                    disabled={listLoading}
                    className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-4 py-2 rounded-lg transition-all"
                >
                    <RefreshCcw size={18} className={listLoading ? "animate-spin" : ""} />
                    {listLoading ? "Atualizando..." : "Sincronizar"}
                </button>
            </div>

            {/* Global Active Sessions Counter */}
            <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 bg-gradient-to-br from-blue-600/20 to-indigo-600/5 border border-blue-500/20 rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Zap size={48} className="text-blue-400" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-xs text-blue-300/70 mb-1 font-semibold uppercase tracking-wider">Atendimento em Tempo Real</p>
                        <h2 className="text-4xl font-bold text-white mb-2 flex items-baseline gap-2">
                            {activeSessionsCount}
                            <span className="text-sm font-medium text-blue-400/80">sessões ativas</span>
                        </h2>
                        <div className="flex items-center gap-2">
                            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            <p className="text-[10px] text-zinc-500 font-medium">Agente I.A. operando agora</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Instrução se nenhum selecionado */}
            {!selectedId && (
                <div className="mb-8 bg-[#121214] border border-white/5 rounded-2xl p-8 text-center">
                    <Megaphone size={40} className="text-zinc-700 mx-auto mb-4" />
                    <p className="text-zinc-500 text-sm">Selecione um disparo abaixo para ver as métricas detalhadas.</p>
                </div>
            )}

            {/* Detail Panel */}
            {selectedId && (
                <div className="mb-10 relative">
                    {detailLoading && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
                            <RefreshCcw className="animate-spin text-blue-500" size={32} />
                        </div>
                    )}

                    {d && f && ai && fup && an && (
                        <div className="space-y-6">
                            {/* Campaign Header */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-zinc-900/40 border border-white/5 rounded-xl">
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-500/10 p-2.5 rounded-lg border border-blue-500/20">
                                        <Target size={20} className="text-blue-500" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <strong className="text-lg text-white leading-none">{d.broadcast.flowName}</strong>
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${d.broadcast.status === 'MULTI' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                                }`}>
                                                {d.broadcast.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-zinc-500">
                                            <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(d.broadcast.createdAt).toLocaleDateString('pt-BR')}</span>
                                            {d.broadcast.templateName && (
                                                <span className="flex items-center gap-1 bg-zinc-800/50 px-2 py-0.5 rounded border border-zinc-700/50 text-zinc-400">
                                                    <Zap size={10} className="text-amber-500" /> {d.broadcast.templateName}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6 self-end md:self-center">
                                    <div className="flex flex-col items-end">
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={useFallback}
                                                onChange={(e) => setUseFallback(e.target.checked)}
                                                className="rounded border-zinc-700 bg-zinc-900 text-blue-500 focus:ring-blue-500/20 w-3 h-3"
                                            />
                                            <span className="text-[10px] text-zinc-500 group-hover:text-zinc-400 transition-colors uppercase font-bold tracking-tighter">
                                                Vínculo por Contato (Legado)
                                            </span>
                                        </label>
                                        {useFallback && (
                                            <span className="text-[9px] text-amber-500/70 font-medium">⚠️ Mapeamento via vínculo atual</span>
                                        )}
                                    </div>
                                    <button onClick={() => { setSelectedId(null); setDetail(null); }} className="text-xs font-bold text-zinc-500 hover:text-white transition-colors border border-zinc-800 px-3 py-1.5 rounded-lg">
                                        Fechar Relatório
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                {/* Funnel & Actions (Main Column) */}
                                <div className="xl:col-span-2 space-y-6">
                                    {/* Active Filters Bar */}
                                    {(selectedStates.length > 0 || selectedSubset) && (
                                        <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 px-4 py-3 rounded-xl animate-in fade-in slide-in-from-left-2">
                                            <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
                                                <ListFilter size={14} /> Filtros Ativos:
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedSubset && (
                                                    <span className="flex items-center gap-1.5 bg-blue-500 text-white px-2 py-0.5 rounded-full text-[10px] font-black uppercase shadow-lg shadow-blue-500/20">
                                                        Resultado: {selectedSubset}
                                                        <button onClick={() => setSelectedSubset(null)} className="hover:text-red-200"><X size={10} strokeWidth={4} /></button>
                                                    </span>
                                                )}
                                                {selectedStates.map(st => (
                                                    <span key={st} className="flex items-center gap-1.5 bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border border-white/10">
                                                        Estado: {st}
                                                        <button onClick={() => setSelectedStates(prev => prev.filter(s => s !== st))} className="hover:text-red-400"><X size={10} strokeWidth={4} /></button>
                                                    </span>
                                                ))}
                                            </div>
                                            <button
                                                onClick={() => { setSelectedStates([]); setSelectedSubset(null); }}
                                                className="ml-auto text-[10px] font-black text-zinc-500 hover:text-white uppercase underline underline-offset-4 decoration-zinc-700"
                                            >
                                                Limpar tudo
                                            </button>
                                        </div>
                                    )}

                                    {/* Metrics Group 1 */}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                        <MetricCard
                                            size="small"
                                            title="Pessoas Alcançadas"
                                            value={f.sent}
                                            icon={<Users className="text-blue-500" />}
                                        />
                                        <MetricCard
                                            size="small"
                                            title="Entregues"
                                            value={f.delivered}
                                            subtitle={`${f.deliveryRate}%`}
                                            icon={<CheckCircle className="text-blue-400" />}
                                            className={`cursor-pointer transition-all ${selectedSubset === 'delivered' ? 'ring-2 ring-blue-500 bg-blue-500/10' : 'hover:bg-zinc-900 border-white/5'}`}
                                            onClick={() => setSelectedSubset(prev => prev === 'delivered' ? null : 'delivered')}
                                        />
                                        <MetricCard
                                            size="small"
                                            title="Lidos"
                                            value={f.read}
                                            subtitle={`${f.readRate}%`}
                                            icon={<Eye className="text-emerald-400" />}
                                            className={`cursor-pointer transition-all ${selectedSubset === 'read' ? 'ring-2 ring-blue-500 bg-blue-500/10' : 'hover:bg-zinc-900 border-white/5'}`}
                                            onClick={() => setSelectedSubset(prev => prev === 'read' ? null : 'read')}
                                        />
                                        <MetricCard
                                            size="small"
                                            title="Engajados"
                                            value={f.responses}
                                            subtitle={`${f.responseRate}%`}
                                            icon={<MessageSquare className="text-emerald-500" />}
                                            highlight={selectedSubset !== 'responses'}
                                            className={`cursor-pointer transition-all ${selectedSubset === 'responses' ? 'ring-2 ring-blue-500 bg-blue-500/10 border-blue-500/30' : 'hover:bg-emerald-500/10 border-emerald-500/30'}`}
                                            onClick={() => setSelectedSubset(prev => prev === 'responses' ? null : 'responses')}
                                        />
                                    </div>

                                    {/* Detailed Sections Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-[#121214] border border-white/5 rounded-2xl p-4 space-y-4">
                                            <div className="flex justify-between items-center">
                                                <SectionTitle icon={<Bot size={16} />} title="Resolução I.A." subtitle={`${ai.aiSuccessRate}%`} />
                                                <div className="text-[10px] font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded uppercase">{ai.resolved} Resolvidas</div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <MetricCard size="small" title="Síndicos" value={ai.updateSyndic} icon={<UserCheck className="text-indigo-400" />} className="bg-zinc-900/50" />
                                                <MetricCard size="small" title="Handoff" value={ai.handoffs} icon={<Handshake className="text-indigo-400" />} className="bg-zinc-900/50" />
                                                <MetricCard size="small" title="Manut." value={ai.updateMaintenance} icon={<Calendar size={14} className="text-indigo-400" />} className="bg-zinc-900/50" />
                                                <MetricCard size="small" title="Pesq." value={ai.returnResearch} icon={<SearchX size={14} className="text-orange-500" />} className="bg-zinc-900/50" />
                                            </div>
                                        </div>

                                        <div className="bg-[#121214] border border-white/5 rounded-2xl p-4 space-y-4">
                                            <SectionTitle icon={<Repeat size={16} />} title="Recuperação (Follow-up)" />

                                            {/* Initial Follow-up */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center pr-1">
                                                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Follow-up Inicial (Recuperação de Silent)</span>
                                                    <span className="text-[10px] font-bold text-blue-400">{fup.initialEfficacy}% Eficácia</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <MetricCard
                                                        size="small"
                                                        title="Impactados"
                                                        value={fup.initialImpacted}
                                                        icon={<Users className="text-cyan-400" />}
                                                        className={`cursor-pointer transition-all ${selectedSubset === 'followed_up' ? 'ring-2 ring-blue-500 bg-blue-500/10' : 'bg-zinc-900/50 hover:bg-zinc-900'}`}
                                                        onClick={() => setSelectedSubset(prev => prev === 'followed_up' ? null : 'followed_up')}
                                                    />
                                                    <MetricCard size="small" title="Recuperados" value={fup.initialRecovered} icon={<MessageSquare className="text-emerald-400" />} highlight className="bg-emerald-500/5" />
                                                </div>
                                            </div>

                                            {/* General Follow-up */}
                                            <div className="space-y-2 pt-2 border-t border-white/5">
                                                <div className="flex justify-between items-center pr-1">
                                                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Follow-up Geral (Total)</span>
                                                    <span className="text-[10px] font-bold text-zinc-500">{fup.followupEfficacy}% Total</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-zinc-400 opacity-60">
                                                    <MetricCard
                                                        size="small"
                                                        title="Impactados"
                                                        value={fup.totalFollowedUp}
                                                        icon={<Repeat className="text-zinc-500" />}
                                                        className="bg-zinc-900/30"
                                                    />
                                                    <MetricCard size="small" title="Recuperados" value={fup.respondedAfterFollowup} icon={<MessageSquare className="text-zinc-500" />} className="bg-zinc-900/30" />
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 p-2 bg-blue-500/5 rounded-lg border border-blue-500/10">
                                                <TrendingUp className="text-emerald-500" size={14} />
                                                <span className="text-[10px] text-zinc-400 font-medium whitespace-normal leading-tight">
                                                    O follow-up inicial recuperou <strong className="text-white">{fup.initialRecovered}</strong> pessoas que haviam ignorado o disparo, gerando um aumento de <strong className="text-white">+{(fup.initialRecovered / Math.max(1, f.responses - fup.initialRecovered) * 100).toFixed(1)}%</strong> no engajamento original.
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Conversion Section */}
                                    <div className="bg-[#121214] border border-white/5 rounded-2xl p-4 space-y-4">
                                        <SectionTitle icon={<ArrowUpRight size={16} />} title="Conversão & Impacto Comercial" />
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            <MetricCard size="small" title="Clientes Únicos" value={an.uniqueClients || 0} icon={<Users size={14} className="text-blue-400" />} className="bg-zinc-900/50" />

                                            <MetricCard
                                                size="small"
                                                title="Os Geradas"
                                                value={an.conversionOS?.length || 0}
                                                icon={<Calendar size={14} className="text-indigo-400" />}
                                                className="bg-zinc-900/50 cursor-pointer hover:border-indigo-500/30 transition-all hover:bg-zinc-900"
                                                onClick={() => setViewingConvList({ title: "Ordens de Serviço Geradas", items: an.conversionOS })}
                                            />

                                            <MetricCard
                                                size="small"
                                                title="Orçamentos"
                                                value={an.conversionOrcamentos?.length || 0}
                                                icon={<ArrowUpRight size={14} className="text-amber-400" />}
                                                className="bg-zinc-900/50 cursor-pointer hover:border-amber-500/30 transition-all hover:bg-zinc-900"
                                                onClick={() => setViewingConvList({ title: "Orçamentos Gerados", items: an.conversionOrcamentos })}
                                            />

                                            <MetricCard
                                                size="small"
                                                title="Pedidos"
                                                value={an.conversionPedidos?.length || 0}
                                                icon={<Zap size={14} className="text-emerald-400" />}
                                                highlight
                                                className="bg-emerald-500/5 cursor-pointer hover:border-emerald-500 transition-all"
                                                onClick={() => setViewingConvList({ title: "Pedidos Fechados", items: an.conversionPedidos })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Sidebar Column (Location & Attention) */}
                                <div className="space-y-6">
                                    {/* Location Distribution */}
                                    {d.location && d.location.states.length > 0 && (
                                        <div className="bg-[#121214] border border-white/5 rounded-2xl p-4 space-y-4">
                                            <SectionTitle icon={<Target size={16} />} title="Distribuição Geográfica" />
                                            <div className="space-y-3">
                                                {d.location.states.slice(0, 5).map((state) => (
                                                    <div
                                                        key={state.uf}
                                                        className={`space-y-1 cursor-pointer p-1.5 rounded-lg transition-all ${selectedStates.includes(state.uf) ? 'bg-blue-500/10 ring-1 ring-blue-500/30' : 'hover:bg-white/5'}`}
                                                        onClick={() => {
                                                            setSelectedStates(prev =>
                                                                prev.includes(state.uf) ? prev.filter(s => s !== state.uf) : [...prev, state.uf]
                                                            );
                                                        }}
                                                    >
                                                        <div className="flex justify-between text-[11px] font-bold">
                                                            <span className={selectedStates.includes(state.uf) ? 'text-blue-400' : 'text-zinc-300'}>{state.uf || 'N/I'}</span>
                                                            <span className="text-zinc-500">{state.count} ({state.percentage}%)</span>
                                                        </div>
                                                        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full transition-all duration-1000 ${selectedStates.includes(state.uf) ? 'bg-blue-400' : 'bg-blue-600/60'}`}
                                                                style={{ width: `${state.percentage}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                                {d.location.states.length > 5 && (
                                                    <p className="text-[10px] text-zinc-600 text-center italic pt-2">
                                                        + {d.location.states.length - 5} estados com menor volume
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Attention / Errors */}
                                    <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-4 space-y-4">
                                        <SectionTitle icon={<EyeOff size={16} />} title="Pontos de Atenção" />
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center p-2 rounded-lg bg-zinc-900/50 border border-white/5">
                                                <span className="text-[11px] text-zinc-400 font-medium">Não Responderam</span>
                                                <span className="text-xs font-black text-amber-500">{an.silentContacts} ({an.silentRate}%)</span>
                                            </div>
                                            <div className="flex justify-between items-center p-2 rounded-lg bg-zinc-900/50 border border-white/5">
                                                <span className="text-[11px] text-zinc-400 font-medium">Ignoraram (Lido)</span>
                                                <span className="text-xs font-black text-red-400">{an.readButNoResponse} ({an.readButNoResponseRate}%)</span>
                                            </div>

                                            <button
                                                onClick={() => setShowErrors(!showErrors)}
                                                className={`w-full mt-4 flex items-center justify-between p-3 rounded-xl border transition-all ${showErrors
                                                    ? 'bg-red-600 border-red-400 text-white shadow-lg shadow-red-500/20'
                                                    : 'bg-red-900/20 border-red-900/40 text-red-400 hover:bg-red-900/40'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <VolumeX size={16} />
                                                    <span className="text-xs font-bold uppercase tracking-tight">Erros Técnicos</span>
                                                </div>
                                                <span className="text-sm font-black">{Object.values(an.errors || {}).reduce((a, b) => a + b, 0)}</span>
                                            </button>
                                        </div>

                                        {showErrors && an.errors && Object.keys(an.errors).length > 0 && (
                                            <div className="mt-2 space-y-1 animate-in slide-in-from-top-2 duration-200">
                                                {Object.entries(an.errors).map(([errMsg, count]) => (
                                                    <div key={errMsg} className="flex justify-between items-start gap-3 p-2 rounded-lg bg-red-950/20 border border-red-500/10">
                                                        <span className="text-[9px] text-red-200/60 font-mono break-all leading-relaxed flex-1">{errMsg}</span>
                                                        <span className="text-[10px] font-black text-red-400 shrink-0">{count}x</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {!d && !detailLoading && (
                        <div className="bg-[#121214] border border-white/5 rounded-2xl p-10 text-center text-zinc-500 text-sm">
                            Erro ao carregar métricas deste disparo.
                        </div>
                    )}
                </div>
            )}

            {/* List Dialog for Conversions */}
            <Dialog open={!!viewingConvList} onOpenChange={(open) => !open && setViewingConvList(null)}>
                <DialogContent className="max-w-2xl bg-[#09090b] border-white/10 text-white p-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <ListFilter className="text-blue-500" size={20} />
                            {viewingConvList?.title}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto px-6 pb-8">
                        {viewingConvList?.items && viewingConvList.items.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-white/5 hover:bg-transparent">
                                        <TableHead className="text-zinc-500 font-bold uppercase text-[10px]">Cód.</TableHead>
                                        <TableHead className="text-zinc-500 font-bold uppercase text-[10px]">Condomínio (Cliente)</TableHead>
                                        <TableHead className="text-zinc-500 font-bold uppercase text-[10px]">Vendedor</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {viewingConvList.items.map((item) => (
                                        <TableRow key={item.id} className="border-white/5 hover:bg-white/[0.02]">
                                            <TableCell className="font-mono text-[11px] text-zinc-500">#{item.id}</TableCell>
                                            <TableCell>
                                                <button
                                                    onClick={() => setSelectedClientId(item.clientId)}
                                                    className="text-sm font-semibold text-blue-400 hover:text-blue-300 hover:underline text-left transition-colors"
                                                >
                                                    {item.clientName}
                                                </button>
                                            </TableCell>
                                            <TableCell className="text-sm text-zinc-400">
                                                <div className="flex items-center gap-2">
                                                    <UserCheck size={12} className="text-zinc-600" />
                                                    {item.vendedorName}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="py-20 text-center space-y-3">
                                <Info size={40} className="mx-auto text-zinc-700" />
                                <p className="text-zinc-500 text-sm">Nenhum item encontrado nesta categoria.</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Client Detail Dialog Integration */}
            {selectedClientId && (
                <ClienteDetailDialog
                    clienteId={selectedClientId}
                    open={!!selectedClientId}
                    onClose={() => setSelectedClientId(null)}
                />
            )}

            {/* Broadcasts Folders */}
            <div className="bg-[#121214] border border-white/5 rounded-2xl overflow-hidden shadow-2xl mb-12">
                <div className="p-6 border-b border-white/5 bg-zinc-900/50 flex justify-between items-center">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Megaphone size={20} className="text-zinc-500" />
                        Histórico de Disparos
                    </h3>
                    <div className="flex items-center gap-3">
                        {checkedIds.size >= 2 && (
                            <button
                                onClick={() => fetchMulti([...checkedIds])}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                            >
                                <BarChart3 size={14} />
                                Analisar {checkedIds.size} disparos juntos
                            </button>
                        )}
                        {checkedIds.size > 0 && (
                            <button
                                onClick={() => setCheckedIds(new Set())}
                                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                                Limpar seleção
                            </button>
                        )}
                        <span className="text-xs text-zinc-600">{list.length} lotes</span>
                    </div>
                </div>

                <div className="divide-y divide-white/5">
                    {list.length === 0 && (
                        <div className="p-10 text-center text-zinc-500 text-sm">
                            Nenhum disparo encontrado.
                        </div>
                    )}

                    {Object.entries(grouped).map(([monthLabel, days]) => {
                        const monthItems = Object.values(days).flat();
                        const isMonthChecked = monthItems.every(i => checkedIds.has(i.id));
                        const monthKey = `m-${monthLabel}`;
                        const isMonthExpanded = expandedFolders.has(monthKey);

                        return (
                            <div key={monthLabel} className="bg-white/[0.01]">
                                <div
                                    className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.04] cursor-pointer group transition-colors"
                                    onClick={() => toggleFolder(monthKey)}
                                >
                                    <div
                                        onClick={(e) => toggleFolderCheck(monthItems, e)}
                                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isMonthChecked ? 'bg-blue-600 border-blue-600' : 'border-zinc-700 hover:border-zinc-500'
                                            }`}
                                    >
                                        {isMonthChecked && (
                                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                    <Folder className="text-blue-500/60" size={18} />
                                    <span className="text-sm font-bold flex-1 text-zinc-300">{monthLabel}</span>
                                    <div className="flex items-center gap-4">
                                        <span className="text-[10px] text-zinc-600 font-medium uppercase tracking-widest">{monthItems.length} disparos</span>
                                        {isMonthExpanded ? <ChevronDown size={16} className="text-zinc-600" /> : <ChevronRight size={16} className="text-zinc-600" />}
                                    </div>
                                </div>

                                {isMonthExpanded && (
                                    <div className="bg-black/20 divide-y divide-white/[0.03]">
                                        {Object.entries(days).map(([dayLabel, items]) => {
                                            const isDayChecked = items.every(i => checkedIds.has(i.id));
                                            const dayKey = `d-${monthLabel}-${dayLabel}`;
                                            const isDayExpanded = expandedFolders.has(dayKey);

                                            return (
                                                <div key={dayLabel}>
                                                    <div
                                                        className="flex items-center gap-4 pl-12 pr-6 py-3 hover:bg-white/[0.03] cursor-pointer group transition-colors"
                                                        onClick={() => toggleFolder(dayKey)}
                                                    >
                                                        <div
                                                            onClick={(e) => toggleFolderCheck(items, e)}
                                                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isDayChecked ? 'bg-blue-600 border-blue-600' : 'border-zinc-700 hover:border-zinc-500'
                                                                }`}
                                                        >
                                                            {isDayChecked && (
                                                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                        <CalendarDays className="text-zinc-500" size={16} />
                                                        <span className="text-xs font-semibold flex-1 text-zinc-400">Dia {dayLabel.split('/')[0]}</span>
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-[10px] text-zinc-700 font-mono italic">{items.length} itens</span>
                                                            {isDayExpanded ? <ChevronDown size={14} className="text-zinc-700" /> : <ChevronRight size={14} className="text-zinc-700" />}
                                                        </div>
                                                    </div>

                                                    {isDayExpanded && (
                                                        <div className="bg-black/10">
                                                            {items.map((item) => (
                                                                <div
                                                                    key={item.id}
                                                                    onClick={() => handleSelect(item.id)}
                                                                    className={`flex items-center gap-4 pl-20 pr-6 py-3 cursor-pointer transition-all hover:bg-blue-500/5 group border-l-2 ${selectedId === item.id ? 'bg-blue-500/10 border-blue-500 shadow-[inset_4px_0_0_0_#3b82f6]' : 'border-transparent'
                                                                        }`}
                                                                >
                                                                    <div
                                                                        onClick={(e) => toggleCheck(item.id, e)}
                                                                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${checkedIds.has(item.id) ? 'bg-blue-500/60 border-blue-500/60' : 'border-zinc-800 group-hover:border-zinc-600'
                                                                            }`}
                                                                    >
                                                                        {checkedIds.has(item.id) && (
                                                                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                            </svg>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`text-sm font-medium transition-colors ${selectedId === item.id ? 'text-blue-400' : 'text-zinc-400'}`}>
                                                                                {item.flowName}
                                                                            </span>
                                                                            <span className={`px-1.5 py-0.5 rounded-[4px] text-[8px] font-bold uppercase ${item.status === 'COMPLETED' || item.status === 'SENT' ? 'bg-emerald-500/10 text-emerald-500/80 border border-emerald-500/20' :
                                                                                item.status === 'QUEUED' || item.status === 'PROCESSING' ? 'bg-blue-500/10 text-blue-400/80 border border-blue-500/20' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                                                                                }`}>
                                                                                {item.status}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center gap-3 mt-0.5">
                                                                            <span className="text-[10px] text-zinc-600 font-mono">{item.id}</span>
                                                                            <span className="text-[10px] text-zinc-700">•</span>
                                                                            <span className="text-[10px] text-zinc-600">{new Date(item.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                                            <span className="text-[10px] text-zinc-700">•</span>
                                                                            <span className="text-[10px] text-zinc-500 font-semibold">{item.recipientCount} contatos</span>
                                                                        </div>
                                                                    </div>
                                                                    <ArrowUpRight size={14} className={`transition-opacity ${selectedId === item.id ? 'text-blue-500 opacity-100' : 'text-zinc-800 opacity-0 group-hover:opacity-100'}`} />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
    return (
        <div className="flex items-center gap-2 mb-3">
            <div className="text-blue-400">{icon}</div>
            <h3 className="text-sm font-semibold text-zinc-300">{title}</h3>
            {subtitle && <span className="text-[10px] text-zinc-500 ml-2">({subtitle})</span>}
        </div>
    );
}

function MetricCard({ title, value, subtitle, icon, size = "normal", highlight, onClick, className }: {
    title: string; value: number | string; subtitle?: string; icon: React.ReactNode;
    size?: "normal" | "small"; highlight?: boolean; onClick?: () => void; className?: string;
}) {
    // Detect if subtitle is a percentage to give it even more weight
    const isPerc = subtitle?.includes('%');

    return (
        <div
            onClick={onClick}
            className={`${className || `bg-[#121214] border ${highlight ? 'border-emerald-500/30' : 'border-white/5'} rounded-lg`} ${size === 'small' ? 'p-2.5' : 'p-3.5'} shadow relative overflow-hidden group transition-all`}>
            <div className="absolute top-1.5 right-1.5 opacity-[0.07] group-hover:opacity-[0.14] transition-opacity [&_svg]:w-5 [&_svg]:h-5">{icon}</div>
            <p className="text-[10px] text-zinc-500 font-medium leading-tight mb-0.5 pr-5 truncate">{title}</p>
            <div className="flex items-baseline gap-1.5">
                <h2 className={`${size === 'small' ? 'text-xl' : 'text-2xl'} font-bold leading-none`}>{value}</h2>
                {subtitle && (
                    <span className={`text-[11px] font-black leading-none ${isPerc ? (highlight ? 'text-emerald-400' : 'text-blue-400') : 'text-zinc-500'}`}>
                        {subtitle}
                    </span>
                )}
            </div>
        </div>
    );
}

function ProgressBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
        <div>
            <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-zinc-400 font-medium">{label}</span>
                <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold text-white">{value}</span>
                    <span className="text-[11px] font-black text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-md">
                        {pct.toFixed(1)}%
                    </span>
                </div>
            </div>
            <div className="h-1.5 w-full bg-zinc-800/50 rounded-full overflow-hidden">
                <div className={`h-full ${color} transition-all duration-1000 ease-out rounded-full`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}
