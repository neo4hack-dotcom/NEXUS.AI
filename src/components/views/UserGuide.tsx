import React, { useState, useMemo } from 'react';
import {
  Search, BookOpen, LayoutDashboard, Target, Users, Cpu, GitBranch,
  Zap, Network, Mail, ClipboardList, Settings, Sparkles, Bot,
  Keyboard, ChevronRight, X, Calendar,
  Shield, Gauge, DatabaseZap, Lightbulb, ContactRound, Layers, Plug,
  KanbanSquare, Share2, Bell, FileBarChart,
} from 'lucide-react';
import { User } from '../../types';

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  adminOnly?: boolean;
}

const Tag: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = 'bg-brand/10 text-brand' }) => (
  <span className={`inline-flex items-center px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${color}`}>{children}</span>
);

const Tip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/40 p-3 my-3">
    <span className="text-amber-500 mt-0.5 shrink-0">💡</span>
    <p className="text-[11px] text-amber-800 dark:text-amber-300">{children}</p>
  </div>
);

const Note: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-700/40 p-3 my-3">
    <span className="text-blue-500 mt-0.5 shrink-0">ℹ️</span>
    <p className="text-[11px] text-blue-800 dark:text-blue-300">{children}</p>
  </div>
);

const KbShortcut: React.FC<{ keys: string[]; desc: string }> = ({ keys, desc }) => (
  <div className="flex items-center justify-between py-2 border-b border-neutral-100 dark:border-ink-700 last:border-0">
    <span className="text-[11px]">{desc}</span>
    <div className="flex items-center gap-1">
      {keys.map((k, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-muted text-[10px]">+</span>}
          <kbd className="px-2 py-0.5 text-[9px] font-mono font-bold bg-neutral-100 dark:bg-ink-700 border border-neutral-300 dark:border-ink-500 rounded">{k}</kbd>
        </React.Fragment>
      ))}
    </div>
  </div>
);

const H2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-[13px] font-black uppercase tracking-[0.08em] mt-6 mb-3 pb-2 border-b-2 border-brand/30 text-neutral-900 dark:text-white">{children}</h2>
);

const H3: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] mt-4 mb-2 text-neutral-700 dark:text-neutral-300">{children}</h3>
);

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[12px] leading-relaxed text-neutral-700 dark:text-neutral-300 mb-2">{children}</p>
);

const Li: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <li className="flex items-start gap-2 text-[12px] text-neutral-700 dark:text-neutral-300 mb-1">
    <span className="text-brand mt-1 shrink-0">▸</span>
    <span>{children}</span>
  </li>
);

const SECTIONS: Section[] = [
  {
    id: 'overview',
    title: 'Overview',
    icon: <BookOpen className="w-4 h-4" />,
    content: (
      <>
        <H2>Welcome to DOINg.AI</H2>
        <P>DOINg.AI is a local-first AI Project Operations platform. It runs entirely on your machine — a React front-end backed by a Python FastAPI server, with data stored in <code>db.json</code> and mirrored to your browser. No cloud, no third-party telemetry.</P>
        <P>It is your single pane of glass to run an AI initiative portfolio: projects, the assets they rely on (MCP servers, agents, data feeds), the people behind them, and AI-assisted reporting that can replace most of your reporting tools.</P>
        <H3>Roles</H3>
        <ul>
          <Li><Tag>Admin</Tag> Full access — every menu, all data, settings, the Manager View cockpit, and all AI features.</Li>
          <Li><Tag color="bg-blue-100 text-blue-700">Manager</Tag> Sees the whole portfolio, pending imports and reports; manages projects & catalogs.</Li>
          <Li><Tag color="bg-emerald-100 text-emerald-700">Contributor</Tag> Works on the projects they own or belong to.</Li>
          <Li><Tag color="bg-neutral-200 text-neutral-700">Viewer</Tag> Read-only on what they can see.</Li>
        </ul>
        <Note>Some menus (Data Feeds, Pending imports, Manager View, Settings) are restricted by role and the IT flag — they only appear if you have access.</Note>
        <Tip>Press <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-neutral-100 dark:bg-ink-700 border rounded">⌘K</kbd> (or Ctrl+K) anywhere to jump to any menu or project.</Tip>
      </>
    ),
  },
  {
    id: 'assistant',
    title: 'DOINg Assistant',
    icon: <Sparkles className="w-4 h-4" />,
    content: (
      <>
        <H2>DOINg Assistant — your AI cockpit</H2>
        <P>The floating button (bottom-right, always visible) opens the assistant, the cornerstone of the app. It works in two modes and remembers your last 3 requests (per user), so you can reopen anything you generated.</P>
        <H3>Chat mode</H3>
        <P>Ask anything about your portfolio in natural language. The assistant sees projects, people, MCP servers, agents, data feeds, wishes and contacts, and answers with markdown, tables and inline charts. Use it for ad-hoc analyses and to connect things that aren't natively linked.</P>
        <H3>Canvas mode — intelligent reports</H3>
        <P>Describe a report or deck ("board deck on MCP adoption with charts and risks") and the local LLM builds a complete, branded HTML document — KPIs, SVG charts and infographics from your real data.</P>
        <ul>
          <Li>Preview renders in-app; click <strong>Edit text</strong> to amend any text directly in the document.</Li>
          <Li>Export to <strong>PDF</strong>, copy the HTML, download it, or open it in a tab to send for communication.</Li>
          <Li>Toggle <strong>full screen</strong> / reduce with the maximize button.</Li>
        </ul>
        <Tip>Use the History (clock) icon to reopen any of your last three chats or canvases, including the generated output.</Tip>
      </>
    ),
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: <LayoutDashboard className="w-4 h-4" />,
    content: (
      <>
        <H2>Dashboard</H2>
        <P>Your landing page: headline counts, project health, recent activity and quick links into the app. It adapts to your role — you only see what you're allowed to.</P>
      </>
    ),
  },
  {
    id: 'manager',
    title: 'Manager View',
    icon: <Gauge className="w-4 h-4" />,
    adminOnly: true,
    content: (
      <>
        <H2>Manager View — executive cockpit</H2>
        <P>An admin-only steering cockpit, right after the Dashboard.</P>
        <ul>
          <Li>Headline KPIs (active / off-track / at-risk projects, big bets, agents in prod, MCP servers, data feeds, open wishes, working groups, team) — each deep-links to its menu.</Li>
          <Li><strong>Attention required</strong>: off-track, at-risk, blocked tasks and stale projects.</Li>
          <Li><strong>Key projects</strong> focus list and a live <strong>activity stream</strong> of updates and creations.</Li>
          <Li><strong>Pilotage</strong> buttons: one tap generates a detailed local-LLM analysis (executive briefing, risk deep-dive, delivery momentum, workload, ROI) you can print to PDF.</Li>
        </ul>
      </>
    ),
  },
  {
    id: 'projects',
    title: 'Projects',
    icon: <Target className="w-4 h-4" />,
    content: (
      <>
        <H2>Projects</H2>
        <P>The heart of the platform. Click a card to edit a project; use <strong>Show details</strong> for a clean read-only popup.</P>
        <H3>Creating projects</H3>
        <ul>
          <Li><strong>New</strong> — a blank project, or start <strong>From template</strong>.</Li>
          <Li><strong>Tools ▾</strong> menu — <Tag>AI PRJ</Tag> generate a structured project from pasted notes, <Tag>Import XLSX</Tag> bulk-import from a spreadsheet, <Tag>Booklet</Tag> export a print-ready PDF.</Li>
        </ul>
        <H3>Inside a project</H3>
        <ul>
          <Li><strong>Overview</strong> — status, dev workflow & innovation stage, owner, dates, FTE gain, confidentiality, <strong>Big Bet</strong> flag, members (incl. external people).</Li>
          <Li><strong>Linked assets</strong> — select the MCP servers, agents and data feeds the project needs, plus its <strong>dependencies</strong> (blocked-by projects).</Li>
          <Li><strong>Kanban</strong> — task board with status, priority and weight.</Li>
          <Li><strong>Telemetry</strong> — track runtime metrics, typed in or pulled live from an API endpoint.</Li>
          <Li><strong>ROI</strong> — a dynamic, parametric ROI / impact model; "Suggest with AI" proposes one from the context.</Li>
          <Li><strong>AI Quick synthesis</strong> — a one-click committee brief; <strong>Presentations</strong>, <strong>Notes</strong> and an <strong>Audit</strong> trail.</Li>
        </ul>
        <H3>Duplicates</H3>
        <P>Creating via AI PRJ or importing via XLSX automatically flags likely duplicates. Use <strong>Find duplicates</strong> any time to scan the whole portfolio — the local LLM finds semantic duplicates (renamed / re-imported), and a smart <strong>merge</strong> folds them together without losing information.</P>
        <Tip>Group projects into <strong>Families</strong> and switch between list, card density and the Portfolio view.</Tip>
      </>
    ),
  },
  {
    id: 'board',
    title: 'Task Board',
    icon: <KanbanSquare className="w-4 h-4" />,
    content: (
      <>
        <H2>Task Board</H2>
        <P>Every task across the portfolio on one Kanban. Filter to a single project (a clear banner shows which one is displayed), search, or show only your tasks. Drag cards to update status — changes persist back to the owning project.</P>
      </>
    ),
  },
  {
    id: 'timeline',
    title: 'Timeline',
    icon: <Calendar className="w-4 h-4" />,
    content: (
      <>
        <H2>Timeline</H2>
        <P>A Gantt-style view of projects and milestones over time, including dependency relationships, to spot overlaps and bottlenecks.</P>
      </>
    ),
  },
  {
    id: 'workinggroups',
    title: 'Working Groups',
    icon: <Network className="w-4 h-4" />,
    content: (
      <>
        <H2>Working Groups</H2>
        <P>Run continuous work streams as a timeline of <strong>sessions</strong>. Pick a group on the left; its sessions appear as a timeline on the right.</P>
        <ul>
          <Li>Each session has four tabs: <strong>Notes</strong>, <strong>Decisions</strong>, <strong>Actions</strong> (status, priority, assignee incl. external people, category, due date) and a <strong>Checklist</strong> (with an urgent flag).</Li>
          <Li><strong>Smart carry-over</strong>: a new session automatically clones unfinished actions and checklist items from the previous one.</Li>
          <Li>AI <strong>Full report</strong> / <strong>Last session</strong> analyses, rendered as rich markdown with Print/PDF.</Li>
        </ul>
      </>
    ),
  },
  {
    id: 'wishes',
    title: 'Wish List',
    icon: <Lightbulb className="w-4 h-4" />,
    content: (
      <>
        <H2>Wish List</H2>
        <P>A collective backlog of needs — link a wish to a project, MCP, agent or data feed, set a category, priority, sponsor and dates.</P>
        <P>Each wish is validated individually by an admin: <strong>Accept</strong> or <strong>Decline</strong>. Declining captures a reason and <strong>notifies the requester</strong> via the alerts bell.</P>
      </>
    ),
  },
  {
    id: 'datafeeds',
    title: 'Data Feeds',
    icon: <DatabaseZap className="w-4 h-4" />,
    adminOnly: true,
    content: (
      <>
        <H2>Data Feeds</H2>
        <P>Registry of data pipelines from source systems to silver copies / data warehouses (admin + IT-flagged users).</P>
        <ul>
          <Li>Track platform, data type, frequency, source → destination, status, prod date, JIRA ref, cost (MD), ETA, PM, developer and a presentation link.</Li>
          <Li>Link the <strong>MCP servers</strong> that consume each feed.</Li>
          <Li>Double-click a feed for a read-only preview.</Li>
          <Li><strong>AI Booklet</strong>: choose which feeds to include, generate a local-LLM executive narrative, preview it (no forced print), then Print / Copy / Open-to-Send.</Li>
        </ul>
      </>
    ),
  },
  {
    id: 'catalogs',
    title: 'Catalogs',
    icon: <Cpu className="w-4 h-4" />,
    content: (
      <>
        <H2>Catalogs</H2>
        <H3><Cpu className="w-3 h-3 inline mr-1" /> Technologies</H3>
        <P>The tech inventory — category, layer, maturity, architect — open to everyone, editable by managers/admins.</P>
        <H3><GitBranch className="w-3 h-3 inline mr-1" /> Repositories</H3>
        <P>Code repositories with provider and visibility, linkable to projects.</P>
        <H3><Plug className="w-3 h-3 inline mr-1" /> MCP Hub</H3>
        <P>Catalog and manage Model Context Protocol servers — families, tools, deploy status, scope, owning team, use cases and best practices.</P>
        <H3><Bot className="w-3 h-3 inline mr-1" /> AI Agents</H3>
        <P>Track AI agents through their lifecycle — stack, framework, tools, the MCP servers they use, releases, evaluations and metrics (cost, invocations, success rate).</P>
        <H3><Zap className="w-3 h-3 inline mr-1" /> Hackathons</H3>
        <P>Run hackathons with candidate kits, participant rosters, documents and a message board.</P>
      </>
    ),
  },
  {
    id: 'aicontacts',
    title: 'AI Contacts',
    icon: <ContactRound className="w-4 h-4" />,
    content: (
      <>
        <H2>AI Contacts</H2>
        <P>A directory of the people in your AI organisation — name, email, location, function, team and pole. Organise them by family and view the org chart.</P>
      </>
    ),
  },
  {
    id: 'collaboration',
    title: 'Collaboration',
    icon: <Users className="w-4 h-4" />,
    content: (
      <>
        <H2>Collaboration</H2>
        <H3><Mail className="w-3 h-3 inline mr-1" /> Communications</H3>
        <P>Draft AI-generated weekly / newsletter / Exco updates, manage email templates and mailing lists, and export Outlook-ready <code>.eml</code> files.</P>
        <H3><ClipboardList className="w-3 h-3 inline mr-1" /> Weekly Check-in</H3>
        <P>Lightweight status pulses (mood, accomplishments, blockers). Admins can consolidate the team's check-ins with AI.</P>
        <H3><Users className="w-3 h-3 inline mr-1" /> Contributors</H3>
        <P>The internal team directory used across projects (admin-managed).</P>
      </>
    ),
  },
  {
    id: 'insights',
    title: 'Insights',
    icon: <Share2 className="w-4 h-4" />,
    content: (
      <>
        <H2>Insights</H2>
        <H3><Share2 className="w-3 h-3 inline mr-1" /> Knowledge Graph</H3>
        <P>A relationship map reusing the links inside each object: project ↔ MCP / agent / data feed / technology / repository / family, project → project dependencies, and data feed ↔ MCP. Drag to pan, scroll to zoom, click a node to focus, and export a readable A4 PDF.</P>
        <H3><FileBarChart className="w-3 h-3 inline mr-1" /> Reports</H3>
        <P>Generate an executive weekly/monthly portfolio digest with the local LLM, rendered as beautiful markdown (headings, tables) with a one-click Print / PDF. <Tag>Admin / Manager</Tag></P>
        <H3><Calendar className="w-3 h-3 inline mr-1" /> Activity & Capacity</H3>
        <P>A cross-entity activity feed and a team capacity view.</P>
      </>
    ),
  },
  {
    id: 'alerts',
    title: 'Alerts',
    icon: <Bell className="w-4 h-4" />,
    content: (
      <>
        <H2>Alerts</H2>
        <P>The bell shows alerts that concern <strong>you</strong> — stale projects you own, your slipping tasks, declined wishes, overdue check-ins. Admins see <strong>everyone's</strong> alerts with owner context.</P>
        <P>Dismiss an alert individually (the ✕ on the card) or all at once with <strong>Dismiss all</strong>. Dismissals are remembered per user and survive refresh, so the count only reflects what's still outstanding.</P>
      </>
    ),
  },
  {
    id: 'tools',
    title: 'Smart ToDo',
    icon: <ClipboardList className="w-4 h-4" />,
    content: (
      <>
        <H2>Smart ToDo</H2>
        <P>A personal task manager with an Eisenhower matrix, energy levels and planning periods. Private to you, with ICS export to your calendar.</P>
      </>
    ),
  },
  {
    id: 'ai',
    title: 'AI Features',
    icon: <Bot className="w-4 h-4" />,
    content: (
      <>
        <H2>AI features across the app</H2>
        <P>Everything AI runs through your configured <strong>local LLM</strong> (Ollama / OpenAI-compatible / webhook). Nothing leaves your environment unless you point it at a remote endpoint.</P>
        <ul>
          <Li>DOINg Assistant — chat + the intelligent Canvas report studio.</Li>
          <Li>AI PRJ — turn pasted notes into a structured project; XLSX bulk import with AI extraction.</Li>
          <Li>Project AI Quick synthesis & "Suggest ROI model".</Li>
          <Li>Working Group reports, Data Feeds booklet, portfolio Reports, Manager View deep-dives.</Li>
          <Li>Intelligent duplicate detection & merge.</Li>
        </ul>
        <Note>Configure and test the LLM in Admin → Settings before using AI features.</Note>
      </>
    ),
  },
  {
    id: 'admin',
    title: 'Admin & Settings',
    icon: <Settings className="w-4 h-4" />,
    adminOnly: true,
    content: (
      <>
        <H2>Admin & Settings</H2>
        <ul>
          <Li><strong>LLM</strong> — provider, base URL, API key, model and system prompt, with a Test Connection button.</Li>
          <Li><strong>SSO</strong> — configurable enterprise OIDC / OAuth2 (Azure AD, Okta, Keycloak, Google).</Li>
          <Li><strong>SharePoint import</strong> — pull projects from an on-prem SharePoint with a daily delta and admin review of pending imports.</Li>
          <Li><strong>Users</strong> — manage accounts, roles, the IT flag, and force a password reset.</Li>
          <Li><strong>Webhooks</strong> — outbound Slack/Teams notifications on key transitions.</Li>
          <Li><strong>Backup</strong> — export / import the full dataset as JSON.</Li>
        </ul>
        <H3><Shield className="w-3 h-3 inline mr-1" /> Security</H3>
        <P>Passwords are hashed with PBKDF2-SHA256. Any user can change their own password from the options menu.</P>
      </>
    ),
  },
  {
    id: 'shortcuts',
    title: 'Keyboard Shortcuts',
    icon: <Keyboard className="w-4 h-4" />,
    content: (
      <>
        <H2>Keyboard shortcuts</H2>
        <div className="mt-2">
          <KbShortcut keys={['⌘', 'K']} desc="Open the command palette (jump to any menu or project)" />
          <KbShortcut keys={['Esc']} desc="Close the open modal / panel" />
          <KbShortcut keys={['Enter']} desc="Send (in the assistant chat)" />
          <KbShortcut keys={['⌘', 'Enter']} desc="Generate (in the Canvas brief)" />
        </div>
      </>
    ),
  },
];

interface Props {
  currentUser: User;
}

export const UserGuide: React.FC<Props> = ({ currentUser }) => {
  const [activeId, setActiveId] = useState('overview');
  const [q, setQ] = useState('');

  const visibleSections = useMemo(
    () => SECTIONS.filter((s) => !s.adminOnly || currentUser.role === 'admin'),
    [currentUser.role]
  );

  const filteredSections = useMemo(() => {
    if (!q.trim()) return visibleSections;
    const lq = q.toLowerCase();
    return visibleSections.filter((s) =>
      s.title.toLowerCase().includes(lq) ||
      String(s.content).toLowerCase().includes(lq)
    );
  }, [q, visibleSections]);

  const active = visibleSections.find((s) => s.id === activeId) ?? visibleSections[0];

  return (
    <div className="max-w-7xl mx-auto animate-fade-in h-full">
      <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between mb-6">
        <div>
          <p className="label-xs">Documentation</p>
          <h1 className="display-xl">User Guide</h1>
          <p className="text-sm text-muted mt-2">Complete reference for DOINg.AI — {currentUser.role} level.</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); if (e.target.value && filteredSections.length > 0) setActiveId(filteredSections[0].id); }}
            placeholder="Search guide…"
            className="w-full pl-9 pr-4 py-2 text-[12px] border border-neutral-200 dark:border-ink-600 bg-white dark:bg-ink-800 outline-none focus:border-brand transition-colors"
          />
          {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-brand"><X className="w-3.5 h-3.5" /></button>}
        </div>
      </div>

      <div className="flex gap-6 min-h-[70vh]">
        {/* Sidebar nav */}
        <aside className="w-52 shrink-0">
          <nav className="space-y-0.5 sticky top-0">
            {filteredSections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-all text-left ${
                  activeId === s.id
                    ? 'bg-brand text-white'
                    : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:text-white dark:hover:bg-ink-700'
                }`}
              >
                {s.icon}
                <span>{s.title}</span>
                {activeId === s.id && <ChevronRight className="w-3 h-3 ml-auto" />}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 bg-white dark:bg-ink-900 border border-neutral-200 dark:border-ink-700 p-6 overflow-y-auto">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-100 dark:border-ink-800">
            <span className="text-brand">{active.icon}</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">{active.title}</span>
          </div>
          {active.content}
        </main>
      </div>
    </div>
  );
};
