import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
} from './services/storage';
import { Sidebar, TabId } from './components/Sidebar';
import { Login } from './components/Login';
import { NotificationCenter } from './components/NotificationCenter';
import { AiInsightModal } from './components/AiInsightModal';
import { Dashboard } from './components/views/Dashboard';
import { Projects } from './components/views/Projects';
import { Timeline } from './components/views/Timeline';
import { RiskHeatmap } from './components/views/RiskHeatmap';
import { Contributors } from './components/views/Contributors';
import { WeeklyCheckIn } from './components/views/WeeklyCheckIn';
import { Communications } from './components/views/Communications';
import { Technologies } from './components/views/Technologies';
import { Repositories } from './components/views/Repositories';
import { Settings } from './components/views/Settings';
import { HackathonsView } from './components/views/Hackathon';

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
  const [syncFlash, setSyncFlash] = useState(false);

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

    // Conflict resolution: prefer server data
    const onConflict = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.serverData) {
        const merged = { ...detail.serverData, currentUserId: local.currentUserId, theme: local.theme };
        setAppState(merged);
        saveState({ ...merged, lastUpdated: detail.serverData.lastUpdated || 0 });
      }
    };
    window.addEventListener('nexus_conflict', onConflict);

    // Real-time collaboration: poll server for remote changes every 5 s
    startPolling(async () => {
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
      }
    });

    return () => {
      unsub();
      stopPolling();
      window.removeEventListener('nexus_conflict', onConflict);
    };
  }, []);

  // Persist whenever appState changes (after initial load)
  useEffect(() => {
    if (!appState) return;
    saveState(appState);
  }, [appState]);

  const update = useCallback((mutator: (s: AppState) => AppState) => {
    setAppState((curr) => (curr ? mutator(curr) : curr));
  }, []);

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

  const filteredState = useMemo(() => (appState ? getFilteredState(appState) : null), [appState]);

  const notifications = useMemo(() => (appState ? computeNotifications(appState) : []), [appState]);

  if (!appState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Loading NEXUS.AI…</p>
      </div>
    );
  }

  if (!currentUser || !filteredState) {
    return (
      <Login
        users={appState.users}
        onLogin={onLogin}
        theme={appState.theme}
        toggleTheme={toggleTheme}
      />
    );
  }

  const renderView = useMemo(() => () => {
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
      case 'settings':
        return currentUser.role === 'admin' ? (
          <Settings state={appState} update={update} />
        ) : (
          <div className="p-10 text-center text-muted">Admin only.</div>
        );
      default:
        return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filteredState, appState, currentUser, update]);

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
        notificationCount={notifications.length}
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
              NEXUS Workspace
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-muted">
              {isOnline ? '● online' : '○ offline'}
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">{renderView()}</div>
      </main>

      <NotificationCenter
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        onDismiss={() => {/* notifications are derived */}}
        onMarkAllRead={() => {/* derived */}}
      />
      <AiInsightModal
        open={aiInsightOpen}
        onClose={() => setAiInsightOpen(false)}
        state={appState}
      />
    </div>
  );
};

export default App;
