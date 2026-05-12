import React, { useState } from 'react';
import { X, LayoutDashboard, Target, Users, Zap, Network, BookOpen, ArrowRight, Check } from 'lucide-react';
import { User } from '../types';

interface Props {
  currentUser: User;
  onClose: () => void;
}

interface Step {
  id: string;
  title: string;
  subtitle?: string;
  content: React.ReactNode;
}

const ROLE_CAPS: Record<string, string[]> = {
  admin: [
    'Full access to all modules and data',
    'Manage contributors, roles, and permissions',
    'Configure LLM integrations and app settings',
    'View executive AI insights across all projects',
    'Export and backup workspace data',
  ],
  manager: [
    'Create and manage projects, tasks & milestones',
    'Invite contributors and assign work',
    'Use AI project bot for structured extraction',
    'Run weekly check-ins and track team mood',
    'Access risk heatmap and timeline views',
  ],
  contributor: [
    'View and update assigned project tasks',
    'Submit weekly check-ins and mood reports',
    'Participate in working group sessions',
    'Browse technologies and repositories',
    'Use DOINg Assistant for AI-powered queries',
  ],
  viewer: [
    'Read-only access to projects and timelines',
    'Browse the technology radar and repositories',
    'View contributor profiles and team structure',
    'Access the DOINg Assistant for questions',
  ],
};

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: 'Smart Dashboard',
    desc: 'Real-time overview with today\'s focus, team pulse mood chart, and project health at a glance.',
  },
  {
    icon: Target,
    title: 'Projects & RAG',
    desc: 'Track tasks, milestones, and dependencies with automated Red/Amber/Green health scoring.',
  },
  {
    icon: Zap,
    title: 'AI Features',
    desc: 'AI Project Bot extracts structure from free text. Executive insights summarise your portfolio instantly.',
  },
  {
    icon: Network,
    title: 'Working Groups',
    desc: 'Session-chaining carries open action items forward automatically — nothing slips through.',
  },
  {
    icon: Users,
    title: 'Contributors',
    desc: 'People directory with team/squad views and live workload indicator per contributor.',
  },
  {
    icon: BookOpen,
    title: 'User Guide',
    desc: 'Built-in searchable guide with keyboard shortcuts, tips, and role-based feature docs.',
  },
];

export const OnboardingModal: React.FC<Props> = ({ currentUser, onClose }) => {
  const [step, setStep] = useState(0);
  const caps = ROLE_CAPS[currentUser.role] ?? ROLE_CAPS.contributor;

  const steps: Step[] = [
    {
      id: 'welcome',
      title: `Welcome, ${currentUser.firstName}!`,
      subtitle: 'DOINg.AI — your team intelligence workspace',
      content: (
        <div className="space-y-6">
          <p className="text-sm text-muted leading-relaxed">
            DOINg.AI helps distributed teams track projects, surface risks, run working-group sessions, and get
            AI-powered insights — all in one place.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="flex gap-3 p-3 border border-neutral-200 dark:border-ink-600 bg-neutral-50 dark:bg-ink-800">
                  <div className="w-8 h-8 bg-brand/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-brand" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em]">{f.title}</p>
                    <p className="text-[10px] text-muted mt-0.5 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ),
    },
    {
      id: 'role',
      title: 'Your capabilities',
      subtitle: `Logged in as ${currentUser.role}`,
      content: (
        <div className="space-y-5">
          <div className="flex items-center gap-3 p-4 bg-brand/5 border border-brand/20">
            <div className="w-12 h-12 bg-brand text-white flex items-center justify-center font-bold text-sm uppercase shrink-0">
              {currentUser.firstName.charAt(0)}{currentUser.lastName.charAt(0)}
            </div>
            <div>
              <p className="font-bold uppercase tracking-tight text-sm">{currentUser.firstName} {currentUser.lastName}</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-brand font-mono">{currentUser.role} · {currentUser.team}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="label-xs">What you can do</p>
            {caps.map((c) => (
              <div key={c} className="flex items-start gap-2.5">
                <div className="w-4 h-4 bg-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-sm text-neutral-700 dark:text-neutral-300">{c}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'tips',
      title: 'Quick tips',
      subtitle: 'Get productive in seconds',
      content: (
        <div className="space-y-4">
          {[
            {
              keys: ['⌘K', 'Ctrl+K'],
              label: 'Command Palette',
              desc: 'Jump to any project, contributor, technology, or nav page instantly.',
            },
            {
              keys: ['?'],
              label: 'DOINg Assistant',
              desc: 'Click "DOINg Assistant" in the top bar to ask anything about your workspace.',
            },
            {
              keys: ['AI PRJ'],
              label: 'AI Project Bot',
              desc: 'Paste free-form text and let the AI extract a structured project with tasks.',
            },
            {
              keys: ['Guide'],
              label: 'User Guide',
              desc: 'Find the User Guide menu item for in-depth docs on every feature.',
            },
          ].map((tip) => (
            <div key={tip.label} className="flex gap-3 items-start p-3 border border-neutral-200 dark:border-ink-600">
              <div className="flex gap-1 shrink-0 mt-0.5">
                {tip.keys.map((k) => (
                  <span key={k} className="px-1.5 py-0.5 text-[9px] font-mono bg-neutral-100 dark:bg-ink-700 border border-neutral-300 dark:border-ink-500 rounded">
                    {k}
                  </span>
                ))}
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em]">{tip.label}</p>
                <p className="text-[10px] text-muted mt-0.5">{tip.desc}</p>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'ready',
      title: "You're all set!",
      subtitle: 'DOINg.AI is ready for your team',
      content: (
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 bg-brand flex items-center justify-center mx-auto">
            <Check className="w-8 h-8 text-white" />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted leading-relaxed">
              Your workspace is live. Head to the{' '}
              <strong className="text-neutral-900 dark:text-white">Dashboard</strong> for an overview, or jump
              straight into <strong className="text-neutral-900 dark:text-white">Projects</strong> to start
              tracking work.
            </p>
            <p className="text-sm text-muted">
              Need help? Open the <strong className="text-neutral-900 dark:text-white">User Guide</strong> from
              the sidebar at any time.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand/5 border border-brand/20 text-[10px] uppercase tracking-[0.16em] text-brand font-bold">
            <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
            Workspace active
          </div>
        </div>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="surface border w-full max-w-2xl animate-slide-up">
        {/* Header */}
        <div className="p-6 border-b border-neutral-200 dark:border-ink-600 flex items-start justify-between gap-4">
          <div>
            <p className="label-xs mb-1">
              Step {step + 1} of {steps.length}
            </p>
            <h2 className="text-xl font-black uppercase tracking-tight">{current.title}</h2>
            {current.subtitle && (
              <p className="text-xs text-muted mt-1 uppercase tracking-[0.14em]">{current.subtitle}</p>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-muted hover:text-brand shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-neutral-200 dark:bg-ink-700">
          <div
            className="h-full bg-brand transition-all duration-500"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">{current.content}</div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex items-center justify-between">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === step ? 'bg-brand w-5' : 'bg-neutral-300 dark:bg-ink-500'}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-500 text-muted hover:text-neutral-900 dark:hover:text-white transition-colors"
              >
                Back
              </button>
            )}
            {isLast ? (
              <button
                onClick={onClose}
                className="px-6 py-2 text-[10px] font-bold uppercase tracking-[0.14em] bg-brand text-white hover:bg-brand/90 transition-colors flex items-center gap-2"
              >
                <Check className="w-3.5 h-3.5" />
                Get started
              </button>
            ) : (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="px-6 py-2 text-[10px] font-bold uppercase tracking-[0.14em] bg-brand text-white hover:bg-brand/90 transition-colors flex items-center gap-2"
              >
                Next
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
