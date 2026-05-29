import React, { useCallback, useEffect, useMemo, useState, Suspense, lazy } from 'react';
import { AppState, User, AppNotification, Theme } from './types';
import {
  loadState,
  saveState,
  fetchFromServer,
  subscribeToStoreUpdates,
  startPolling,
  stopPolling,
  generateId,
  getFilteredState,
  hasPendingSave,
  flushPendingSave,
  startSSE,
  stopSSE,
  isEditingLocked,
} from './services/storage';
import { canAccessGroup, TAB_GROUP } from './services/permissions';
import { Sidebar, TabId } from './components/Sidebar';
import { Login } from './components/Login';
import { NotificationCenter } from './components/NotificationCenter';
import { AiInsightModal } from './components/AiInsightModal';
const Dashboard = lazy(() => import('./components/views/Dashboard').then(m => ({ default: m.Dashboard })));
const Projects = lazy(() => import('./components/views/Projects').then(m => ({ default: m.Projects })));
const Timeline = lazy(() => import('./components/views/Timeline').then(m => ({ default: m.Timeline })));
const RiskHeatmap = lazy(() => import('./components/views/RiskHeatmap').then(m => ({ default: m.RiskHeatmap })));
const Contributors = lazy(() => import('./components/views/Contributors').then(m => ({ default: m.Contributors })));
const WeeklyCheckIn = lazy(() => import('./components/views/WeeklyCheckIn').then(m => ({ default: m.WeeklyCheckIn })));
const Communications = lazy(() => import('./components/views/Communications').then(m => ({ default: m.Communications })));
const Technologies = lazy(() => import('./components/views/Technologies').then(m => ({ default: m.Technologies })));
const Repositories = lazy(() => import('./components/views/Repositories').then(m => ({ default: m.Repositories })));
const Settings = lazy(() => import('./components/views/Settings').then(m => ({ default: m.Settings })));
const HackathonsView = lazy(() => import('./components/views/Hackathon').then(m => ({ default: m.HackathonsView })));
const WorkingGroupsView = lazy(() => import('./components/views/WorkingGroups').then(m => ({ default: m.WorkingGroupsView })));
import { NexusAssistant } from './components/NexusAssistant';
import { CommandPalette } from './components/CommandPalette';
const UserGuide = lazy(() => import('./components/views/UserGuide').then(m => ({ default: m.UserGuide })));
import { OnboardingModal } from './components/OnboardingModal';
const SmartTodoView = lazy(() => import('./components/views/SmartTodo').then(m => ({ default: m.SmartTodoView })));
const McpHubView = lazy(() => import('./components/views/McpHub').then(m => ({ default: m.McpHubView })));
const Agents = lazy(() => import('./components/views/Agents').then(m => ({ default: m.Agents })));
import { ChangePasswordModal } from './components/ChangePasswordModal';
const DataFeedsView = lazy(() => import('./components/views/DataFeeds').then(m => ({ default: m.DataFeedsView })));
const WishList = lazy(() => import('./components/views/WishList').then(m => ({ default: m.WishList })));
const PendingProjects = lazy(() => import('./components/views/PendingProjects').then(m => ({ default: m.PendingProjects })));
import { runSync, computeNextSyncAt, shouldRunSyncNow } from './services/sharepointService';

const applyThemeDom = (theme: Theme) => {
  if (theme === 'dark') document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
};

const computeNotifications = (state: AppState): AppNotification[] => {
  const me = state.users.find((u) => u.id === state.currentUserId);
  if (!me) return [];
  const out: AppNotification[] = [];
  const now = Date.now();
  const tenDaysMs = 10 * 24 * 3600 * 1000;
  const eightDaysMs = 8 * 24 * 3600 * 1000;

  // Stale projects (no audit in 10 days) for projects user follows
  state.projects.forEach((p) => {
    if (p.isArchived || p.status === 'Done') return;
    const isMine =
      me.role === 'admin' ||
      p.managerId === me.id ||
      p.members.some((m) => m.userId === me.id);
    if (!isMine) return;
    const last = p.auditLog?.[p.auditLog.length - 1];
    const lastTs = last ? new Date(last.date).getTime() : new Date(p.updatedAt).getTime();
    if (now - lastTs > tenDaysMs) {
      out.push({
        id: `stale_${p.id}`,
        type: 'stale_project',
        message: `Project "${p.name}" hasn't been updated in 10+ days.`,
        details: last ? `Last activity: ${last.action} by ${last.userName}` : 'No activity yet.',
        relatedId: p.id,
        targetUserId: me.id,
        createdAt: new Date().toISOString(),
        seenBy: [],
      });
    }
    // Task slipping
    (p.tasks || []).forEach((t) => {
      if (t.status === 'Done') return;
      if (t.assigneeId !== me.id && me.role !== 'admin') return;
      const eta = t.currentEta || t.originalEta;
      if (!eta) return;
      const etaTs = new Date(eta).getTime();
      if (etaTs < now) {
        const daysLate = Math.floor((now - etaTs) / 86400000);
        out.push({
          id: `slip_${t.id}`,
          type: 'task_slipping',
          message: `Task "${t.title}" is ${daysLate} day${daysLate > 1 ? 's' : ''} late.`,
          details: `Project: ${p.name} • Status: ${t.status}`,
          relatedId: p.id,
          createdAt: new Date().toISOString(),
          seenBy: [],
        });
      }
    });
  });

  // Weekly report overdue
  const myReports = state.weeklyCheckIns.filter((c) => c.userId === me.id);
  if (myReports.length === 0) {
    out.push({
      id: `report_overdue_${me.id}`,
      type: 'report_overdue',
      message: 'You have not submitted a weekly check-in yet.',
      details: 'Share your status to keep the team aligned.',
      createdAt: new Date().toISOString(),
      seenBy: [],
    });
  } else {
    const last = [...myReports].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];
    if (now - new Date(last.updatedAt).getTime() > eightDaysMs) {
      out.push({
        id: `report_overdue_${me.id}`,
        type: 'report_overdue',
        message: 'Your last weekly check-in is over 8 days old.',
        details: 'Update your status.',
        createdAt: new Date().toISOString(),
        seenBy: [],
      });
    }
  }

  return out;
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [isOnline, setIsOnline] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [aiInsightOpen, setAiInsightOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [syncFlash, setSyncFlash] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [seenNotifIds, setSeenNotifIds] = useState<Set<string>>(new Set());
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [changePwdOpen, setChangePwdOpen] = useState(false);

  // Initial load
  useEffect(() => {
    const local = loadState();
    setAppState(local);
    applyThemeDom(local.theme);

    (async () => {
      const server = await fetchFromServer();
      if (server) {
        // Prefer server but keep session locally
        const merged: AppState = {
          ...server,
          currentUserId: local.currentUserId,
          theme: local.theme,
        };
        setAppState(merged);
        setIsOnline(true);
      } else {
        setIsOnline(false);
      }
    })();

    // Cross-tab sync
    const unsub = subscribeToStoreUpdates(() => {
      const next = loadState();
      setAppState(next);
      applyThemeDom(next.theme);
    });

    // Conflict resolution: a 409 means another writer beat us to the punch.
    // CRITICAL: do NOT blindly overwrite local state with server state — that
    // would silently destroy whatever the user just typed. Instead, preserve
    // local state and notify; the next save attempt will re-try with the new
    // base version. If we have NO pending local changes, accept the server data
    // (we are simply out of date).
    const onConflict = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.serverData) return;
      // Server now auto-merges, so this legacy path is rare. Never overwrite
      // while we still have unflushed local changes or an editor is open.
      if (hasPendingSave() || isEditingLocked()) {
        console.warn('[DOInG] Sync conflict — local changes preserved; will retry on next save.');
        return;
      }
      setAppState((curr): AppState => ({
        ...detail.serverData,
        currentUserId: curr?.currentUserId ?? null,
        theme: curr?.theme ?? 'dark',
      }));
    };
    window.addEventListener('nexus_conflict', onConflict);

    // The server merged our write with a concurrent one. The payload it returns
    // already contains OUR change plus the other writer's — adopt it so both
    // survive. Safe even mid-edit: it is a superset of what we just sent.
    const onMerged = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.serverData) return;
      setAppState((curr): AppState => ({
        ...detail.serverData,
        currentUserId: curr?.currentUserId ?? null,
        theme: curr?.theme ?? 'dark',
      }));
    };
    window.addEventListener('nexus_merged', onMerged);

    // Real-time collaboration.
    // Primary channel: SSE (Server-Sent Events) — the backend pushes a
    // 'data_updated' event the instant any client writes. Latency <100ms.
    // Safety net: polling every 30s — covers the case where SSE proxies drop
    // the connection silently and the EventSource auto-reconnect hasn't kicked in.
    // CRITICAL (both channels): skip refresh if we have unflushed local changes —
    // otherwise we'd overwrite local state with a stale server snapshot, silently
    // losing whatever the user just created (the classic family-disappears bug).
    const refreshFromServer = async (origin: string) => {
      // Never clobber unflushed local work or an actively-open editor.
      if (hasPendingSave() || isEditingLocked()) {
        // Local changes haven't reached the server yet, or an editor is open.
        // The saveState debounce will flush; the next event/poll will reconcile.
        return;
      }
      const serverState = await fetchFromServer();
      if (serverState) {
        setAppState((curr) =>
          curr
            ? { ...serverState, currentUserId: curr.currentUserId, theme: curr.theme }
            : curr
        );
        setIsOnline(true);
        setSyncFlash(true);
        setTimeout(() => setSyncFlash(false), 2500);
        if (origin === 'sse') console.debug('[DOInG] State refreshed via SSE push');
      }
    };

    startSSE(() => { void refreshFromServer('sse'); });
    startPolling(() => { void refreshFromServer('poll'); }, 30000);

    return () => {
      unsub();
      stopPolling();
      stopSSE();
      window.removeEventListener('nexus_conflict', onConflict);
      window.removeEventListener('nexus_merged', onMerged);
    };
  }, []);

  // Persist whenever appState changes (after initial load)
  useEffect(() => {
    if (!appState) return;
    saveState(appState);
  }, [appState]);

  // ⌘K / Ctrl+K → command palette
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen((v) => !v); }
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, []);

  const update = useCallback((mutator: (s: AppState) => AppState) => {
    setAppState((curr) => (curr ? mutator(curr) : curr));
  }, []);

  // Save project template (must be after update declaration)
  useEffect(() => {
    const fn = (e: Event) => {
      const p = (e as CustomEvent).detail?.project;
      if (!p) return;
      update((s) => {
        const exists = (s.projectTemplates || []).find((t) => t.name === p.name);
        const tpl = {
          id: exists?.id ?? generateId(),
          name: p.name,
          description: p.description,
          tasks: (p.tasks || []).map(({ id: _id, assigneeId: _a, ...rest }: any) => rest),
          milestones: (p.milestones || []).map(({ id: _id, done: _d, ...rest }: any) => rest),
          tags: p.tags || [],
          createdAt: exists?.createdAt ?? new Date().toISOString(),
        };
        return {
          ...s,
          projectTemplates: exists
            ? (s.projectTemplates || []).map((t) => (t.id === tpl.id ? tpl : t))
            : [...(s.projectTemplates || []), tpl],
        };
      });
    };
    window.addEventListener('doing_save_template', fn);
    return () => window.removeEventListener('doing_save_template', fn);
  }, [update]);

  // ──────────────────────────────────────────────────────────────────────
  // SharePoint sync scheduler — fires on whichever admin's tab is open.
  // Tick every 60 s, check shouldRunSyncNow(), and trigger runSync if due.
  // Idempotent across multiple tabs: we update nextSyncAt the moment a sync
  // starts, so a second tab will see it's no longer due before firing.
  // ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!appState) return;
    const me = appState.users.find((u) => u.id === appState.currentUserId);
    if (!me || me.role !== 'admin') return;          // only admin tabs run the scheduler

    const tick = async () => {
      const cfg = appState.sharePointConfig;
      if (!shouldRunSyncNow(cfg)) return;

      // Mark "next" forward immediately so concurrent tabs skip this run.
      const provisionalNext = computeNextSyncAt(cfg, Date.now() + 60_000);
      update((s) => ({
        ...s,
        sharePointConfig: { ...s.sharePointConfig, nextSyncAt: provisionalNext },
      }));

      try {
        const result = await runSync(appState, appState.llmConfig);
        update((s) => ({
          ...s,
          sharePointConfig: {
            ...s.sharePointConfig,
            lastSyncAt: new Date().toISOString(),
            lastSyncStatus: result.errors.length > 0 ? 'partial' : 'success',
            lastSyncFetchedCount: result.fetched,
            lastSyncNewCount: result.added,
            lastSyncMessage: `Scheduled run: ${result.added} new of ${result.fetched} fetched`,
            nextSyncAt: computeNextSyncAt(s.sharePointConfig),
          },
          pendingProjects: [...(s.pendingProjects ?? []), ...result.newPending],
        }));
        console.info('[DOInG] SharePoint scheduled sync:', result);
      } catch (e: any) {
        console.warn('[DOInG] SharePoint scheduled sync failed:', e.message);
        update((s) => ({
          ...s,
          sharePointConfig: {
            ...s.sharePointConfig,
            lastSyncAt: new Date().toISOString(),
            lastSyncStatus: 'error',
            lastSyncMessage: `Scheduled run failed: ${e.message}`,
            nextSyncAt: computeNextSyncAt(s.sharePointConfig),
          },
        }));
      }
    };

    // Kick once shortly after mount in case we're already past nextSyncAt,
    // then check every minute.
    const initial = setTimeout(() => { void tick(); }, 5_000);
    const interval = setInterval(() => { void tick(); }, 60_000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  // We intentionally don't include appState in deps — re-creating the interval
  // every state change would be wasteful. The tick reads fresh state from
  // appState via closure; for live config edits the next tick (max 60s away)
  // will pick them up.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState?.currentUserId, appState?.users.find((u) => u.id === appState?.currentUserId)?.role]);

  const toggleTheme = useCallback(() => {
    update((s) => {
      const next: Theme = s.theme === 'dark' ? 'light' : 'dark';
      applyThemeDom(next);
      return { ...s, theme: next };
    });
  }, [update]);

  const onLogin = useCallback(
    (u: User) => {
      update((s) => ({ ...s, currentUserId: u.id }));
    },
    [update]
  );

  const onLogout = useCallback(() => {
    update((s) => ({ ...s, currentUserId: null }));
    setActiveTab('dashboard');
  }, [update]);

  const currentUser = useMemo(
    () => appState?.users.find((u) => u.id === appState.currentUserId) ?? null,
    [appState]
  );

  // Route guard: if the active tab belongs to a group the current role cannot
  // access (e.g. a former admin logs in as contributor and `settings` is still
  // stored as the active tab), redirect to dashboard. Centralises enforcement
  // — the sidebar already hides the items, but a stale state would still render.
  useEffect(() => {
    if (!currentUser) return;
    const group = TAB_GROUP[activeTab] || 'public';
    if (!canAccessGroup(currentUser.role, group, currentUser.isIT)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, currentUser]);

  // Show onboarding popup on first login per user
  useEffect(() => {
    if (!currentUser) return;
    const key = `doing_ai_onboarded_${currentUser.id}`;
    if (!localStorage.getItem(key)) {
      setOnboardingOpen(true);
    }
  }, [currentUser?.id]);

  const filteredState = useMemo(() => (appState ? getFilteredState(appState) : null), [appState]);

  const notifications = useMemo(() => (appState ? computeNotifications(appState) : []), [appState]);
  const unreadCount = useMemo(
    () => notifications.filter((n) => !seenNotifIds.has(n.id)).length,
    [notifications, seenNotifIds]
  );
  const markAllRead = useCallback(() => {
    setSeenNotifIds(new Set(notifications.map((n) => n.id)));
  }, [notifications]);

  // renderView MUST be defined before any conditional returns to satisfy Rules of Hooks.
  // Null-guard inside keeps it safe when appState / filteredState aren't ready yet.
  const activeView = useMemo(() => {
    if (!filteredState || !currentUser || !appState) return null;
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard state={filteredState} currentUser={currentUser} setActiveTab={setActiveTab} onOpenAi={() => setAiInsightOpen(true)} />;
      case 'projects':
        return <Projects state={filteredState} currentUser={currentUser} update={update} />;
      case 'timeline':
        return <Timeline state={filteredState} />;
      case 'risk':
        return <RiskHeatmap state={filteredState} update={update} currentUser={currentUser} />;
      case 'contributors':
        return <Contributors state={filteredState} currentUser={currentUser} update={update} />;
      case 'checkin':
        return <WeeklyCheckIn state={appState} currentUser={currentUser} update={update} />;
      case 'communications':
        return <Communications state={filteredState} currentUser={currentUser} update={update} />;
      case 'tech':
        return <Technologies state={filteredState} currentUser={currentUser} update={update} />;
      case 'repos':
        return <Repositories state={filteredState} currentUser={currentUser} update={update} />;
      case 'hackathons':
        return <HackathonsView state={filteredState} currentUser={currentUser} update={update} />;
      case 'workinggroups':
        return <WorkingGroupsView state={filteredState} currentUser={currentUser} update={update} />;
      case 'settings':
        return currentUser.role === 'admin' ? (
          <Settings state={appState} update={update} />
        ) : (
          <div className="p-10 text-center text-muted">Admin only.</div>
        );
      case 'todos':
        return <SmartTodoView state={appState} currentUser={currentUser} update={update} />;
      case 'guide':
        return <UserGuide currentUser={currentUser} />;
      case 'mcp':
        return <McpHubView state={appState} currentUser={currentUser} update={update} />;
      case 'agents':
        return <Agents state={appState} currentUser={currentUser} update={update} />;
      case 'datafeeds':
        return <DataFeedsView state={appState} currentUser={currentUser} update={update} />;
      case 'wishes':
        return <WishList state={appState} currentUser={currentUser} update={update} />;
      case 'pending':
        return (currentUser.role === 'admin' || currentUser.role === 'manager') ? (
          <PendingProjects state={appState} currentUser={currentUser} update={update} />
        ) : (
          <div className="p-10 text-center text-muted">Admin or manager only.</div>
        );
      default:
        return null;
    }
  // setActiveTab and setAiInsightOpen are stable React dispatchers — no need in deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filteredState, appState, currentUser, update]);

  if (!appState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Loading DOINg.AI…</p>
      </div>
    );
  }

  if (!currentUser || !filteredState) {
    return (
      <Login
        users={appState.users}
        onLogin={onLogin}
        onPasswordChange={(userId, newPasswordHash, newPasswordSalt) => {
          // Persist the new credentials and clear the must-change flag.
          // The legacy plaintext field is wiped at the same time so the
          // hash becomes the single source of truth going forward.
          update((s) => ({
            ...s,
            users: s.users.map((u) =>
              u.id === userId
                ? { ...u, passwordHash: newPasswordHash, passwordSalt: newPasswordSalt, password: undefined, mustChangePassword: false }
                : u
            ),
          }));
        }}
        theme={appState.theme}
        toggleTheme={toggleTheme}
      />
    );
  }

  return (
    <div className="min-h-screen flex bg-neutral-50 dark:bg-ink-950 transition-colors">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        theme={appState.theme}
        toggleTheme={toggleTheme}
        onLogout={onLogout}
        onOpenAiInsight={() => setAiInsightOpen(true)}
        onOpenNotifications={() => setNotifOpen(true)}
        onChangePassword={() => setChangePwdOpen(true)}
        notificationCount={unreadCount}
        isOnline={isOnline}
        syncFlash={syncFlash}
      />

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 px-8 flex items-center justify-between border-b border-neutral-200 dark:border-ink-700 bg-white dark:bg-ink-900 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.18em] border border-neutral-300 dark:border-ink-500 text-muted">
              {currentUser.role === 'admin' ? 'admin view' : `${currentUser.role} view`}
            </span>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em]">
              DOINg Workspace
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 text-[10px] text-muted border border-neutral-200 dark:border-ink-600 hover:border-brand hover:text-brand transition-colors"
              title="Command palette (⌘K)"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <span>Search</span>
              <span className="font-mono text-[9px] border border-neutral-300 dark:border-ink-500 px-1 rounded">⌘K</span>
            </button>
            <button
              onClick={() => setAssistantOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] border border-brand/40 text-brand hover:bg-brand hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
              DOINg Assistant
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <Suspense fallback={<ViewLoader />}>{activeView}</Suspense>
        </div>
      </main>

      <NotificationCenter
        open={notifOpen}
        onClose={() => { setNotifOpen(false); markAllRead(); }}
        notifications={notifications}
        onDismiss={() => {}}
        onMarkAllRead={markAllRead}
      />
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        state={filteredState!}
        setActiveTab={(t) => { setActiveTab(t); }}
        onOpenProject={(id) => setPendingProjectId(id)}
      />
      <AiInsightModal
        open={aiInsightOpen}
        onClose={() => setAiInsightOpen(false)}
        state={appState}
      />
      <NexusAssistant
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        state={filteredState}
        llmConfig={appState.llmConfig}
      />
      {onboardingOpen && currentUser && (
        <OnboardingModal
          currentUser={currentUser}
          onClose={() => {
            localStorage.setItem(`doing_ai_onboarded_${currentUser.id}`, '1');
            setOnboardingOpen(false);
          }}
        />
      )}

      {/* Self-service password change — available to every role */}
      {currentUser && (
        <ChangePasswordModal
          open={changePwdOpen}
          currentUser={currentUser}
          onChanged={(newHash, newSalt) => {
            update((s) => ({
              ...s,
              users: s.users.map((u) =>
                u.id === currentUser.id
                  ? {
                      ...u,
                      passwordHash: newHash,
                      passwordSalt: newSalt,
                      // Wipe legacy plaintext — hash is now the single source of truth
                      password: undefined,
                      // Clear any pending forced-change flag set by an admin
                      mustChangePassword: false,
                    }
                  : u
              ),
            }));
          }}
          onClose={() => setChangePwdOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
