import React, { useState, useMemo } from 'react';
import {
  Search, BookOpen, LayoutDashboard, Target, Users, Cpu, GitBranch,
  Zap, Network, Mail, ClipboardList, Settings, Sparkles, Bot,
  Command, Keyboard, ChevronRight, X, AlertTriangle, Calendar,
  FileText, Shield, Star, TrendingUp, CalendarClock, Clipboard,
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
      <div>
        <H2>What is DOINg.AI?</H2>
        <P>
          <strong>DOINg.AI</strong> is an AI-powered Project Operations Platform designed for managing AI initiative portfolios, cross-functional teams, and innovation programs.
          It centralises project tracking, team collaboration, technology governance, and AI-augmented reporting in one place.
        </P>
        <P>
          Built for Chief AI Officers, Program Managers, and their teams, DOINg.AI bridges the gap between execution and executive visibility.
        </P>

        <H3>Core modules at a glance</H3>
        <div className="grid grid-cols-2 gap-2 my-3">
          {[
            { icon: <LayoutDashboard className="w-3.5 h-3.5" />, label: 'Dashboard', desc: 'Live portfolio KPIs & alerts' },
            { icon: <Target className="w-3.5 h-3.5" />, label: 'Projects', desc: 'Full project & task lifecycle' },
            { icon: <Network className="w-3.5 h-3.5" />, label: 'Working Groups', desc: 'Session-chained meetings' },
            { icon: <Users className="w-3.5 h-3.5" />, label: 'Contributors', desc: 'Team roster & workload' },
            { icon: <Cpu className="w-3.5 h-3.5" />, label: 'Technologies', desc: 'Tech radar & governance' },
            { icon: <Zap className="w-3.5 h-3.5" />, label: 'Hackathons', desc: 'Innovation event management' },
            { icon: <Mail className="w-3.5 h-3.5" />, label: 'Communications', desc: 'Emails & newsletters' },
            { icon: <Bot className="w-3.5 h-3.5" />, label: 'AI Features', desc: 'Assistant, AI PRJ, ⌘K' },
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-2 p-2 border border-neutral-200 dark:border-ink-700 bg-white dark:bg-ink-800">
              <span className="text-brand">{m.icon}</span>
              <div>
                <p className="text-[10px] font-bold uppercase">{m.label}</p>
                <p className="text-[9px] text-muted">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <H3>Role-based access</H3>
        <div className="space-y-1.5 my-2">
          {[
            { role: 'Admin', desc: 'Full access: all projects, all users, settings, templates, AI features, exports.' },
            { role: 'Manager', desc: 'Sees projects they manage or are a member of, plus their team. Can use AI PRJ.' },
            { role: 'Contributor', desc: 'Sees projects they are assigned to. Can submit check-ins and manage their tasks.' },
            { role: 'Viewer', desc: 'Read-only access to non-archived projects.' },
          ].map((r) => (
            <div key={r.role} className="flex items-start gap-3 text-[11px]">
              <Tag>{r.role}</Tag>
              <span className="text-neutral-600 dark:text-neutral-400">{r.desc}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: <LayoutDashboard className="w-4 h-4" />,
    content: (
      <div>
        <H2>Dashboard</H2>
        <P>The Dashboard is your live operational command centre. It aggregates data from all modules into a single, scannable view.</P>

        <H3>Today's Focus widget</H3>
        <P>Appears automatically when there is something requiring your attention:</P>
        <ul className="ml-2">
          <Li><strong>Tasks due soon</strong> — your assigned tasks due in the next 48 hours, colour-coded (red = overdue).</Li>
          <Li><strong>Milestones (next 7 days)</strong> — any project milestone falling within a week.</Li>
          <Li><strong>Team attention</strong> — team members whose latest check-in mood was red.</Li>
        </ul>

        <H3>Team Pulse</H3>
        <P>A stacked bar chart of weekly team moods over the last 4 weeks. Green / Amber / Red bars show the distribution at a glance. The header summarises the current state with emoji counters.</P>

        <H3>KPI tiles</H3>
        <P>Four tiles: Active Projects, Contributors, Tasks in Flight, and Completion Rate.</P>

        <H3>Recent Projects</H3>
        <P>The 6 most recent projects with their RAG health badge and progress bar. Click any row to open the project modal.</P>

        <H3>Milestones & Stack Snapshot</H3>
        <P>Right column shows the next 5 milestones and a technology category breakdown.</P>

        <Tip>Click "AI Insight" (bottom-left) or use the AI Executive Insight button in the sidebar to generate an executive portfolio summary from your LLM.</Tip>
      </div>
    ),
  },

  {
    id: 'projects',
    title: 'Projects',
    icon: <Target className="w-4 h-4" />,
    content: (
      <div>
        <H2>Projects</H2>
        <P>The Projects module is the core of DOINg.AI. Each project has a full lifecycle from Planning to Done, with tasks, milestones, team, audit trail, and AI tools.</P>

        <H3>Creating a project</H3>
        <ul className="ml-2">
          <Li><strong>New</strong> — blank project assigned to you as owner.</Li>
          <Li><strong>From template</strong> — picks a pre-built task/milestone structure (admin creates templates via "Save as template" in any project modal).</Li>
          <Li><strong>AI PRJ</strong> — paste raw text (email, brief, notes) → LLM extracts name, description, context, deadline, and tasks. Review and edit before saving.</Li>
        </ul>

        <H3>RAG health chip</H3>
        <P>Every card shows an auto-computed health indicator:</P>
        <ul className="ml-2">
          <Li><Tag color="bg-emerald-100 text-emerald-700">On Track</Tag> — on schedule, no significant blockers.</Li>
          <Li><Tag color="bg-amber-100 text-amber-700">At Risk</Tag> — deadline &lt;14 days, slipped, or any blocked task.</Li>
          <Li><Tag color="bg-red-100 text-red-700">Off Track</Tag> — overdue or &gt;40% of tasks blocked.</Li>
        </ul>

        <H3>Project modal tabs</H3>
        <ul className="ml-2">
          <Li><strong>Overview</strong> — status, dates, budget, manager, members, context, milestones, technologies, repos, tags. AI Brief generation button.</Li>
          <Li><strong>Kanban</strong> — drag-and-drop task board: To Do / In Progress / Paused / Blocked / Done.</Li>
          <Li><strong>Notes</strong> — free-form scratchpad saved with the project (decisions, links, meeting takeaways).</Li>
          <Li><strong>Audit</strong> — full change history with timestamp and author.</Li>
        </ul>

        <H3>Export PDF</H3>
        <P>Opens a beautiful infographic PDF (portrait/landscape, fullscreen, print) with KPI tiles, task donut, milestone roadmap, team roster, and optional AI synthesis.</P>

        <Tip>The <strong>Context</strong> field in Overview is ideal for pasting stakeholder emails, business constraints, or background links. It feeds the AI Brief and the DOINg Assistant's answers.</Tip>

        <H3>Templates (Admin)</H3>
        <P>Open any project → modal footer → "Save as template". The template stores the task structure, milestones, and tags. Any user with the "From template" button can then start a pre-configured project.</P>
      </div>
    ),
  },

  {
    id: 'workinggroups',
    title: 'Working Groups',
    icon: <Network className="w-4 h-4" />,
    content: (
      <div>
        <H2>Working Groups</H2>
        <P>Working Groups support regular multi-session collaboration. Sessions are chained: open action items automatically carry over from previous sessions.</P>

        <H3>Creating a working group</H3>
        <P>Click <strong>New Working Group</strong>. Fill in name, objective, status, owner, members and tags. Members can be leads, contributors, or observers.</P>

        <H3>Tasks board (Kanban)</H3>
        <P>A lightweight Kanban for the group's tasks: To Do → Doing → Review → Done. Drag to move, click to edit (priority, assignee, due date, labels, checklist).</P>

        <H3>Sessions (Meetings tab)</H3>
        <P>Sessions are the heart of the Working Group module. Each session records:</P>
        <ul className="ml-2">
          <Li><strong>Date + Title</strong></Li>
          <Li><strong>Attendees</strong> — multi-select from WG members</Li>
          <Li><strong>Agenda + Notes</strong></Li>
          <Li><strong>Key Decisions</strong> — bullet list</Li>
          <Li><strong>Action Items</strong> — per-item owner, due date, and status (todo / ongoing / blocked / done)</Li>
        </ul>

        <H3>Session chaining (carry-over)</H3>
        <P>When you click <strong>New Session</strong>, all open action items from every previous session (status ≠ done) are automatically pre-populated in the amber "Carried-over open actions" section. You can mark them done, update status, or remove them. New actions for this session go in the section below.</P>

        <Tip>Click the status icon (circle/play/pause/check) on any action item to cycle through todo → ongoing → blocked → done.</Tip>

        <H3>Overview tab</H3>
        <P>Shows task progress stats, member list with roles, tags, and a <strong>Sessions Timeline</strong> — a vertical chronological view of all sessions with open/closed action counts per session.</P>
      </div>
    ),
  },

  {
    id: 'contributors',
    title: 'Contributors',
    icon: <Users className="w-4 h-4" />,
    content: (
      <div>
        <H2>Contributors</H2>
        <P>The Contributors view is your team directory. It supports team grouping, squad sub-teams, and workload monitoring.</P>

        <H3>Team / Squad toggle</H3>
        <P>Use the <strong>Group by Team / Squad</strong> toggle in the header to switch between grouping by main team or by squad sub-team. Members without a squad fall into "— No Squad —".</P>

        <H3>Workload badge</H3>
        <P>Each contributor card shows a coloured chip with the number of active projects they are assigned to:</P>
        <ul className="ml-2">
          <Li><Tag color="bg-emerald-100 text-emerald-700">0–2 proj</Tag> — comfortable load</Li>
          <Li><Tag color="bg-amber-100 text-amber-700">3–4 proj</Tag> — watch for overload</Li>
          <Li><Tag color="bg-red-100 text-red-700">5+ proj</Tag> — overloaded</Li>
        </ul>

        <H3>User fields</H3>
        <ul className="ml-2">
          <Li><strong>User ID (uid)</strong> — login handle, must be unique</Li>
          <Li><strong>Role</strong> — admin / manager / contributor / viewer</Li>
          <Li><strong>Team / Squad</strong> — organisational grouping</Li>
          <Li><strong>Function title</strong> — job title shown on cards</Li>
          <Li><strong>Technical Architect</strong> — flagged in Technologies</Li>
          <Li><strong>Expectations</strong> — brief note shown on the card</Li>
          <Li><strong>Avatar colour</strong> — hex colour for the initials avatar</Li>
        </ul>

        <Note>Only admins can create, edit or delete contributors. Managers see the full list but cannot modify it.</Note>
      </div>
    ),
  },

  {
    id: 'technologies',
    title: 'Technologies',
    icon: <Cpu className="w-4 h-4" />,
    content: (
      <div>
        <H2>Technologies</H2>
        <P>A curated registry of technologies used across your AI portfolio — your tech radar.</P>

        <H3>Fields</H3>
        <ul className="ml-2">
          <Li><strong>Category</strong> — framework / library / database / tool / language / service</Li>
          <Li><strong>Layer</strong> — frontend / backend / data / ml-ai / infrastructure / devops / …</Li>
          <Li><strong>Maturity status</strong> — evaluating / adopted / deprecated / hold</Li>
          <Li><strong>Technical Architect</strong> — the person responsible for this technology</Li>
          <Li><strong>License / URL / Version</strong> — governance metadata</Li>
          <Li><strong>Internal Owner</strong> — team or person owning it internally</Li>
        </ul>

        <Tip>Link technologies to projects via the project Overview tab → "Technologies" field. This populates the Stack Snapshot on the Dashboard.</Tip>
      </div>
    ),
  },

  {
    id: 'hackathons',
    title: 'Hackathons',
    icon: <Zap className="w-4 h-4" />,
    content: (
      <div>
        <H2>Hackathons</H2>
        <P>Manage innovation sprints end-to-end: from kick-off to post-event synthesis.</P>

        <H3>Lifecycle</H3>
        <ul className="ml-2">
          <Li><Tag>Upcoming</Tag> — preparation phase, add participants and documents</Li>
          <Li><Tag>Active</Tag> — event in progress, use the chat for live updates</Li>
          <Li><Tag>Completed</Tag> — results filled in, AI synthesis available</Li>
          <Li><Tag color="bg-neutral-100 text-neutral-500">Archived</Tag> — closed, read-only</Li>
        </ul>

        <H3>Participants</H3>
        <P>Add participants with role (dev / sme / expert / pm / designer / other), email, team, and expertise. Export the participant list as a CSV.</P>

        <H3>Documents</H3>
        <P>Attach briefs, guides, results, presentations, and resources. Rich text content with export to PDF.</P>

        <H3>AI Synthesis</H3>
        <P>Click <strong>AI Synthesis</strong> to generate a post-hackathon report covering: mission accomplished, deliverables, technical highlights, lessons learned, and next steps. The synthesis can be exported to PDF.</P>

        <H3>Candidate Kit PDF</H3>
        <P>Generates a participant briefing document: objective, challenge, schedule, and team list.</P>

        <H3>Live chat</H3>
        <P>An internal message thread for real-time coordination during the event.</P>
      </div>
    ),
  },

  {
    id: 'communications',
    title: 'Communications',
    icon: <Mail className="w-4 h-4" />,
    content: (
      <div>
        <H2>Communications</H2>
        <P>Draft and manage team communications: weekly status emails, newsletters, ExCo updates, and info notes.</P>

        <H3>Communication types</H3>
        <ul className="ml-2">
          <Li><strong>Weekly</strong> — recurring team status update</Li>
          <Li><strong>Newsletter</strong> — broad-audience announcement</Li>
          <Li><strong>ExCo</strong> — executive committee briefing (formal tone)</Li>
          <Li><strong>Info</strong> — ad-hoc informational note</Li>
        </ul>

        <H3>Templates</H3>
        <P>Create reusable email templates per type. When drafting a new communication, pick a template to pre-fill subject and body.</P>

        <H3>Mailing lists</H3>
        <P>Manage distribution lists under the <strong>Lists</strong> tab. A communication can target one or more lists.</P>

        <H3>AI generation</H3>
        <P>The AI Writer button generates a draft from linked project data, using the appropriate prompt (weekly, newsletter, ExCo, or info) via your configured LLM.</P>

        <H3>PDF preview</H3>
        <P>Preview any communication as a formatted PDF before sending. Print directly or export as a file.</P>

        <Tip>Link a communication to specific projects — this gives the AI Writer richer context and helps you track which projects were mentioned.</Tip>
      </div>
    ),
  },

  {
    id: 'checkin',
    title: 'Weekly Check-in',
    icon: <ClipboardList className="w-4 h-4" />,
    content: (
      <div>
        <H2>Weekly Check-in</H2>
        <P>A structured weekly pulse for each team member. Encourages transparency and surfaces blockers early.</P>

        <H3>Fields</H3>
        <ul className="ml-2">
          <Li><strong>Week of</strong> — ISO Monday date (auto-set to current week)</Li>
          <Li><strong>Accomplishments</strong> — what was completed this week</Li>
          <Li><strong>Blockers</strong> — obstacles that need attention</Li>
          <Li><strong>Next Steps</strong> — planned work for next week</Li>
          <Li><strong>Mood</strong> — <Tag color="bg-emerald-100 text-emerald-700">Green</Tag> / <Tag color="bg-amber-100 text-amber-700">Amber</Tag> / <Tag color="bg-red-100 text-red-700">Red</Tag> (team energy signal)</Li>
        </ul>

        <H3>History</H3>
        <P>All previous check-ins are listed in chronological order. Each entry shows the mood badge and full content.</P>

        <H3>AI Consolidation</H3>
        <P>Managers and admins see an <strong>AI Consolidation</strong> button that synthesises all team check-ins for the selected week into a single executive report, grouped by project.</P>

        <Note>The mood signal feeds the <strong>Today's Focus</strong> dashboard widget and the <strong>Team Pulse</strong> chart. Submitting weekly keeps the health indicators accurate.</Note>
      </div>
    ),
  },

  {
    id: 'timeline',
    title: 'Timeline & Risk',
    icon: <Calendar className="w-4 h-4" />,
    content: (
      <div>
        <H2>Timeline</H2>
        <P>A portfolio-level Gantt-style timeline showing all project deadlines and milestones on a horizontal axis.</P>
        <ul className="ml-2">
          <Li>Projects displayed as horizontal bars spanning start → deadline</Li>
          <Li>Milestones shown as diamond markers</Li>
          <Li>Overdue items highlighted in red</Li>
          <Li>Click a project row to open its detail modal</Li>
        </ul>

        <H2>Risk Heatmap</H2>
        <P>A RAG (Red/Amber/Green) matrix view of all projects, available to admins. Each cell represents a risk dimension:</P>
        <ul className="ml-2">
          <Li><strong>Schedule</strong> — deadline proximity and slippage</Li>
          <Li><strong>Tasks</strong> — blocked and overdue task ratio</Li>
          <Li><strong>Team</strong> — morale signals from check-ins</Li>
          <Li><strong>Scope</strong> — manually set by admin</Li>
        </ul>
        <P>Click any cell to edit the risk level and add a comment. The heatmap is exportable.</P>
      </div>
    ),
  },

  {
    id: 'ai',
    title: 'AI Features',
    icon: <Bot className="w-4 h-4" />,
    content: (
      <div>
        <H2>AI Features</H2>
        <P>DOINg.AI integrates AI at multiple levels. All AI calls go through your locally configured LLM (Ollama, OpenAI-compatible, or n8n webhook).</P>

        <H3>DOINg Assistant (chat)</H3>
        <P>Click <strong>DOINg Assistant</strong> in the top-right header. A slide-in panel opens with:</P>
        <ul className="ml-2">
          <Li>Multi-turn conversation with full portfolio context</Li>
          <Li>Context is automatically scoped to your access level (you only see what you're allowed to)</Li>
          <Li>Suggested questions to get started quickly</Li>
          <Li>Beautiful markdown rendering: tables, code blocks, headers, lists</Li>
          <Li>Per-message copy button</Li>
          <Li>Clear conversation button</Li>
        </ul>

        <H3>AI PRJ — Project extraction</H3>
        <P>In Projects → <strong>AI PRJ</strong> button (visible to managers & admins):</P>
        <ul className="ml-2">
          <Li>Paste any text (email, brief, Confluence page, notes)</Li>
          <Li>The LLM extracts: project name, description, context, deadline, and a tasks list</Li>
          <Li>Review and edit every field before saving</Li>
          <Li>Creates the full project in one click</Li>
        </ul>

        <H3>AI Insight (portfolio)</H3>
        <P>Sidebar → <strong>AI Executive Insight</strong>. Generates an executive summary of the full portfolio: highlights, risks, strategic recommendations.</P>

        <H3>AI Brief (per project)</H3>
        <P>Project modal → Overview tab → <strong>Generate Brief</strong>. Creates a structured project brief: context, status, deliverables, risks, next milestones.</P>

        <H3>AI Synthesis (hackathons)</H3>
        <P>Hackathon detail → <strong>AI Synthesis</strong>. Generates a post-event synthesis report.</P>

        <H3>AI Communication Writer</H3>
        <P>Communications → New / Edit → <strong>AI Writer</strong>. Drafts weekly emails, newsletters, ExCo updates, or info notes from linked project data.</P>

        <H3>⌘K Command Palette</H3>
        <P>Press <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-neutral-100 dark:bg-ink-700 border rounded">⌘K</kbd> (or <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-neutral-100 dark:bg-ink-700 border rounded">Ctrl K</kbd>) to open the command palette:</P>
        <ul className="ml-2">
          <Li>Search projects, tasks, contributors, technologies, working groups, hackathons</Li>
          <Li>Navigate to any section instantly</Li>
          <Li>Keyboard-driven: ↑↓ navigate, ↵ open, ESC close</Li>
        </ul>

        <H3>LLM Configuration</H3>
        <P>Admin Settings → LLM tab. Configure provider, base URL, API key, model name, and system prompt. Use "Test Connection" to verify before using AI features.</P>

        <Note>All AI responses are generated locally or via your own endpoint. No data leaves your environment unless you configure a remote API.</Note>
      </div>
    ),
  },

  {
    id: 'settings',
    title: 'Admin & Settings',
    icon: <Settings className="w-4 h-4" />,
    adminOnly: true,
    content: (
      <div>
        <H2>Admin & Settings</H2>
        <P>Accessible only to users with the <Tag>Admin</Tag> role. Configure the entire DOINg.AI instance.</P>

        <H3>LLM Configuration</H3>
        <ul className="ml-2">
          <Li><strong>Provider</strong> — Ollama (local), OpenAI-compatible, or n8n webhook</Li>
          <Li><strong>Base URL</strong> — e.g. <code className="font-mono text-[10px]">http://localhost:11434</code> for Ollama</Li>
          <Li><strong>Model</strong> — e.g. <code className="font-mono text-[10px]">llama3</code>, <code className="font-mono text-[10px]">mistral</code>, <code className="font-mono text-[10px]">gpt-4o</code></Li>
          <Li><strong>System Prompt</strong> — customise the AI persona and tone</Li>
          <Li><strong>Test Connection</strong> — verify the LLM is reachable and list available models</Li>
        </ul>

        <H3>User Management</H3>
        <P>Create, edit and delete users. Set role, team, squad, function title, avatar colour, and password.</P>

        <H3>Export Backup</H3>
        <P>Downloads the entire DOINg.AI dataset as a timestamped JSON file (<code className="font-mono text-[10px]">doing-ai-backup-YYYY-MM-DD.json</code>). Includes all projects, users, technologies, communications, hackathons, working groups, and templates. Theme is preserved; session state is excluded.</P>

        <H3>Import Backup</H3>
        <P>Restore a previous backup file. <strong>Warning:</strong> this replaces all current data. There is no undo.</P>

        <H3>Reset cache</H3>
        <P>Wipes browser localStorage. Server data is preserved and reloaded on next boot. Useful if the app behaves unexpectedly.</P>

        <Tip>Export a backup before any major operation (bulk user changes, imports, or app upgrades).</Tip>
      </div>
    ),
  },

  {
    id: 'shortcuts',
    title: 'Keyboard Shortcuts',
    icon: <Keyboard className="w-4 h-4" />,
    content: (
      <div>
        <H2>Keyboard Shortcuts</H2>

        <H3>Global</H3>
        <div className="my-2 bg-white dark:bg-ink-800 border border-neutral-200 dark:border-ink-700 px-4">
          <KbShortcut keys={['⌘', 'K']} desc="Open command palette / global search" />
          <KbShortcut keys={['Esc']} desc="Close any open modal or panel" />
        </div>

        <H3>Command Palette</H3>
        <div className="my-2 bg-white dark:bg-ink-800 border border-neutral-200 dark:border-ink-700 px-4">
          <KbShortcut keys={['↑', '↓']} desc="Navigate results" />
          <KbShortcut keys={['↵']} desc="Open selected result" />
          <KbShortcut keys={['Esc']} desc="Close palette" />
        </div>

        <H3>Project modal</H3>
        <div className="my-2 bg-white dark:bg-ink-800 border border-neutral-200 dark:border-ink-700 px-4">
          <KbShortcut keys={['Esc']} desc="Close modal without saving" />
        </div>

        <H3>DOINg Assistant chat</H3>
        <div className="my-2 bg-white dark:bg-ink-800 border border-neutral-200 dark:border-ink-700 px-4">
          <KbShortcut keys={['↵']} desc="Send message" />
          <KbShortcut keys={['Shift', '↵']} desc="New line in message" />
          <KbShortcut keys={['Esc']} desc="Close assistant panel" />
        </div>

        <H3>Session editor (Working Groups)</H3>
        <div className="my-2 bg-white dark:bg-ink-800 border border-neutral-200 dark:border-ink-700 px-4">
          <KbShortcut keys={['↵']} desc="Add decision / action item (in input field)" />
        </div>
      </div>
    ),
  },

  {
    id: 'repos',
    title: 'Repositories',
    icon: <GitBranch className="w-4 h-4" />,
    content: (
      <div>
        <H2>Code Repositories</H2>
        <P>Track all code repositories associated with your AI portfolio.</P>

        <H3>Fields</H3>
        <ul className="ml-2">
          <Li><strong>Provider</strong> — GitHub, GitLab, Bitbucket, Azure DevOps, or other</Li>
          <Li><strong>URL</strong> — direct link to the repository</Li>
          <Li><strong>Visibility</strong> — public / private / internal</Li>
          <Li><strong>Language</strong> — primary programming language</Li>
          <Li><strong>Linked Projects</strong> — associate with one or more projects</Li>
        </ul>

        <H3>Bitbucket import</H3>
        <P>Use the <strong>Import from Bitbucket</strong> button to bulk-import repositories from a Bitbucket workspace using your credentials.</P>

        <Tip>Link repositories to projects in the project Overview tab → "Repos" field. Linked repos appear in the project PDF export.</Tip>
      </div>
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
