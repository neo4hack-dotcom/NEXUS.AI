import React from 'react';
import {
  LayoutDashboard,
  Target,
  Users,
  Mail,
  Cpu,
  Settings as SettingsIcon,
  GitBranch,
  Calendar,
  AlertTriangle,
  ClipboardList,
  Sun,
  Moon,
  LogOut,
  Bell,
  Sparkles,
  Zap,
  Network,
  BookOpen,
  CheckSquare,
  Plug,
  Bot,
  KeyRound,
  DatabaseZap,
  Lightbulb,
} from 'lucide-react';
import { User, Theme, Role } from '../types';
import { canAccessGroup, TAB_GROUP } from '../services/permissions';

export type TabId =
  | 'dashboard'
  | 'projects'
  | 'timeline'
  | 'risk'
  | 'contributors'
  | 'checkin'
  | 'communications'
  | 'tech'
  | 'repos'
  | 'hackathons'
  | 'workinggroups'
  | 'settings'
  | 'guide'
  | 'todos'
  | 'mcp'
  | 'agents'
  | 'datafeeds'
  | 'wishes';

interface Props {
  activeTab: TabId;
  setActiveTab: (t: TabId) => void;
  currentUser: User | null;
  theme: Theme;
  toggleTheme: () => void;
  onLogout: () => void;
  onOpenAiInsight: () => void;
  onOpenNotifications: () => void;
  onChangePassword: () => void;
  notificationCount: number;
  isOnline: boolean;
  syncFlash: boolean;
}

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/* Nav groups are organised to mirror the functional groups used by the
 * permission matrix (see src/services/permissions.ts).
 *
 *  G1 — Project Management : projects, timeline, risk, communications
 *  G2 — Catalogs           : tech (public), repos, hackathons, MCP, agents
 *  G4 — Collaboration      : working groups, weekly check-in
 *  Admin (G3)              : contributors, settings (admin-only)
 *  Public                  : dashboard, todos, guide
 */
const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Dashboard',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Project Management',
    items: [
      { id: 'projects',       label: 'Projects',       icon: Target },
      { id: 'timeline',       label: 'Timeline',       icon: Calendar },
      { id: 'risk',           label: 'Risk Heatmap',   icon: AlertTriangle },
      { id: 'communications', label: 'Communications', icon: Mail },
    ],
  },
  {
    label: 'Catalogs',
    items: [
      { id: 'tech',       label: 'Technologies',     icon: Cpu },
      { id: 'repos',      label: 'Code Repositories', icon: GitBranch },
      { id: 'hackathons', label: 'Hackathons',       icon: Zap },
      { id: 'mcp',        label: 'MCP Hub',          icon: Plug },
      { id: 'agents',     label: 'AI Agents',        icon: Bot },
    ],
  },
  {
    label: 'Collaboration',
    items: [
      { id: 'workinggroups', label: 'Working Groups',   icon: Network },
      { id: 'checkin',       label: 'Weekly Check-in',  icon: ClipboardList },
    ],
  },
  {
    label: 'Tools',
    items: [
      { id: 'todos',  label: 'Smart ToDo', icon: CheckSquare },
      { id: 'wishes', label: 'Wish List',  icon: Lightbulb },
    ],
  },
  {
    label: 'Knowledge',
    items: [
      { id: 'guide', label: 'User Guide', icon: BookOpen },
    ],
  },
  {
    label: 'Data Platform',
    items: [
      { id: 'datafeeds', label: 'Data Feeds', icon: DatabaseZap },
    ],
  },
  {
    label: 'Admin',
    items: [
      { id: 'contributors', label: 'Contributors',    icon: Users },
      { id: 'settings',     label: 'Admin Settings',  icon: SettingsIcon },
    ],
  },
];

export const Sidebar: React.FC<Props> = ({
  activeTab,
  setActiveTab,
  currentUser,
  theme,
  toggleTheme,
  onLogout,
  onOpenAiInsight,
  onOpenNotifications,
  onChangePassword,
  notificationCount,
  isOnline,
  syncFlash,
}) => {
  const role: Role = currentUser?.role ?? 'viewer';

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 flex flex-col border-r border-neutral-200 dark:border-ink-700 bg-white dark:bg-ink-900">
      <div className="px-6 pt-8 pb-6 border-b border-neutral-200 dark:border-ink-700">
        <h1 className="display-lg mb-3">
          DOINg<span className="text-brand">.AI</span>
        </h1>
        {/* Server sync indicator — DOINg-style live badge */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-4 h-4">
            {isOnline ? (
              <>
                <span className={`absolute inline-flex h-3 w-3 rounded-full opacity-60 ${syncFlash ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500 animate-ping'}`} />
                <span className={`relative inline-flex h-2 w-2 rounded-full ${syncFlash ? 'bg-emerald-400' : 'bg-emerald-500'}`} />
              </>
            ) : (
              <span className="relative inline-flex h-2 w-2 rounded-full bg-neutral-400" />
            )}
          </div>
          <span className={`text-[9px] font-mono uppercase tracking-[0.2em] transition-all duration-300 ${
            syncFlash ? 'text-emerald-500 font-bold' : isOnline ? 'text-muted' : 'text-neutral-400'
          }`}>
            {syncFlash ? 'synced ✓' : isOnline ? 'server live' : 'offline'}
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.map((group) => {
          // Hide an item if the role cannot access its functional group.
          const visibleItems = group.items.filter((item) =>
            canAccessGroup(role, TAB_GROUP[item.id] || 'public', currentUser?.isIT)
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label} className="mb-2">
              <div className="px-3 pt-3 pb-1">
                <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-neutral-400 dark:text-ink-500">
                  {group.label}
                </span>
              </div>
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`group w-full flex items-center gap-3 px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-all ${
                      active
                        ? 'bg-brand text-white'
                        : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:text-white dark:hover:bg-ink-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          );
        })}

      </nav>

      <div className="border-t border-neutral-200 dark:border-ink-700 px-3 py-3 space-y-1">
        <button
          onClick={onOpenAiInsight}
          className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-brand border border-brand/40 hover:bg-brand hover:text-white transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          AI Executive Insight
        </button>

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onOpenNotifications}
            title="Notifications"
            className="relative flex-1 flex items-center justify-center gap-2 h-9 border border-neutral-300 dark:border-ink-500 hover:border-brand hover:text-brand transition-colors text-[10px] font-bold uppercase tracking-[0.14em]"
          >
            <Bell className="w-4 h-4" />
            Alerts
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-1">
                {notificationCount}
              </span>
            )}
          </button>
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            className="w-9 h-9 flex items-center justify-center border border-neutral-300 dark:border-ink-500 hover:border-brand hover:text-brand transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="p-3 border-t border-neutral-200 dark:border-ink-700 bg-neutral-50 dark:bg-ink-800">
        {currentUser ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand text-white flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
              {currentUser.firstName.charAt(0)}
              {currentUser.lastName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] truncate">
                {currentUser.firstName} {currentUser.lastName}
              </p>
              <p className="text-[9px] uppercase tracking-[0.16em] text-brand font-mono truncate">
                {currentUser.role} • {currentUser.team}
              </p>
            </div>
            {/* Change password — available to every role */}
            <button
              onClick={onChangePassword}
              title="Change password"
              className="w-8 h-8 flex items-center justify-center text-muted hover:text-brand transition-colors"
            >
              <KeyRound className="w-4 h-4" />
            </button>
            <button
              onClick={onLogout}
              title="Logout"
              className="w-8 h-8 flex items-center justify-center text-muted hover:text-red-500 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <p className="text-[10px] text-muted">Not signed in</p>
        )}
      </div>
    </aside>
  );
};
