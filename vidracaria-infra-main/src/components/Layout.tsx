import { useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { units } from '@/data/mockData';
import {
  LayoutDashboard, MessageSquare, Users, Database, Filter, Megaphone,
  ChevronDown, LogOut, Bot, Kanban, Brain
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/chat', label: 'Central de Chat', icon: MessageSquare },
  { to: '/sellers', label: 'Vendedores', icon: Users },
  { to: '/kanban', label: 'CRM Kanban', icon: Kanban },
  { to: '/funnel', label: 'Funil de Leads', icon: Filter },
  { to: '/ai-analytics', label: 'Análise da IA', icon: Brain },
  { to: '/database', label: 'Base de Clientes', icon: Database },
  { to: '/campaigns', label: 'Campanhas', icon: Megaphone },
];

export type UnitFilter = 'all' | 'unit-1' | 'unit-2';

const Layout = () => {
  const [unitFilter, setUnitFilter] = useState<UnitFilter>('all');
  const [unitOpen, setUnitOpen] = useState(false);
  const navigate = useNavigate();

  const unitLabel = unitFilter === 'all' ? 'Visão Global' : units.find(u => u.id === unitFilter)?.name || '';

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-sm text-sidebar-foreground">Casa Mansur</h1>
              <p className="text-[10px] text-muted-foreground">AI Infrastructure</p>
            </div>
          </div>
        </div>

        <div className="p-3 border-b border-sidebar-border">
          <div className="relative">
            <button
              onClick={() => setUnitOpen(!unitOpen)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-sidebar-accent text-sidebar-accent-foreground text-sm font-body hover:bg-surface-hover transition-colors"
            >
              <span className="truncate">{unitLabel}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${unitOpen ? 'rotate-180' : ''}`} />
            </button>
            {unitOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                {[{ id: 'all' as const, label: 'Visão Global' }, ...units.map(u => ({ id: u.id as UnitFilter, label: u.name }))].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => { setUnitFilter(opt.id); setUnitOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm font-body hover:bg-surface-hover transition-colors ${unitFilter === opt.id ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-body transition-all duration-150 ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-body text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto scrollbar-thin">
        <Outlet context={{ unitFilter, setUnitFilter }} />
      </main>
    </div>
  );
};

export default Layout;
export type { UnitFilter as UnitFilterType };
