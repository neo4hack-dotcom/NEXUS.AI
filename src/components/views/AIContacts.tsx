/**
 * AIContacts (#8) — AI contributor directory & org chart.
 *
 * Reference every person who contributes to AI topics in the organisation:
 * developers, data scientists, business experts, PMs, researchers…
 *
 * Features:
 *  - Directory list with filters by family / role / pole / team / status
 *  - Org chart view (SVG-based tree built from managerId edges)
 *  - Create / edit / delete contacts (admin only for create/edit/delete)
 *  - Family management (colour-coded groups)
 *  - Click a card in the chart to focus and see details
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  ContactRound, Plus, Pencil, Trash2, X, Save, Search, Filter,
  Mail, Phone, MapPin, Briefcase, Users as UsersIcon, Share2,
  ChevronDown, ChevronUp, ExternalLink, Star, List, Network,
  Layers,
} from 'lucide-react';
import { AppState, User, AIContact, AIContactFamily, AIContactRole } from '../../types';
import { generateId } from '../../services/storage';
import { useEditingLock } from '../../hooks/useEditingLock';

interface Props {
  state: AppState;
  currentUser: User;
  update: (m: (s: AppState) => AppState) => void;
}

/* ─────────────────────────────────────────────────────────────────────────
   Constants
   ───────────────────────────────────────────────────────────────────────── */

const ROLE_META: Record<AIContactRole, { label: string; color: string }> = {
  leader:        { label: 'Leader',         color: 'text-brand' },
  expert:        { label: 'Expert',         color: 'text-violet-600 dark:text-violet-400' },
  developer:     { label: 'Developer',      color: 'text-sky-600 dark:text-sky-400' },
  data_scientist:{ label: 'Data Scientist', color: 'text-emerald-600 dark:text-emerald-400' },
  pm:            { label: 'PM',             color: 'text-amber-600 dark:text-amber-400' },
  business:      { label: 'Business',       color: 'text-neutral-600 dark:text-neutral-300' },
  researcher:    { label: 'Researcher',     color: 'text-fuchsia-600 dark:text-fuchsia-400' },
  other:         { label: 'Other',          color: 'text-neutral-500' },
};

const PALETTE = ['#FF3E00','#3B82F6','#10B981','#F59E0B','#8B5CF6','#EF4444','#06B6D4','#EC4899'];

const initials = (c: AIContact) =>
  `${c.firstName.charAt(0)}${c.lastName.charAt(0)}`.toUpperCase();

const fullName = (c: AIContact) => `${c.firstName} ${c.lastName}`;

const blankContact = (currentUserId: string): AIContact => ({
  id: generateId(),
  firstName: '', lastName: '', functionTitle: '',
  role: 'expert', isActive: true, skills: [],
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
});

/* ─────────────────────────────────────────────────────────────────────────
   Avatar chip
   ───────────────────────────────────────────────────────────────────────── */
const Avatar: React.FC<{ contact: AIContact; size?: number }> = ({ contact, size = 10 }) => (
  <div
    className={`w-${size} h-${size} flex items-center justify-center text-[11px] font-black text-white uppercase shrink-0`}
    style={{
      backgroundColor: contact.avatarColor || '#FF3E00',
      width: `${size * 4}px`, height: `${size * 4}px`,
      fontSize: size <= 8 ? '9px' : size <= 10 ? '11px' : '14px',
    }}
  >
    {initials(contact)}
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────
   Contact card
   ───────────────────────────────────────────────────────────────────────── */
const ContactCard: React.FC<{
  contact: AIContact;
  family?: AIContactFamily;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}> = ({ contact, family, onClick, onEdit, onDelete }) => {
  const roleMeta = ROLE_META[contact.role];
  return (
    <button
      onClick={onClick}
      className="surface border p-4 flex flex-col gap-3 text-left hover:border-brand transition-colors group w-full"
    >
      <div className="flex items-start gap-3">
        <Avatar contact={contact} size={10} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            {!contact.isActive && (
              <span className="text-[8px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 bg-neutral-200 text-neutral-500 dark:bg-ink-600 dark:text-neutral-400">Inactive</span>
            )}
            {family && (
              <span className="text-[8px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 text-white"
                style={{ backgroundColor: family.color }}>{family.name}</span>
            )}
          </div>
          <p className="text-[13px] font-bold leading-tight">{fullName(contact)}</p>
          <p className="text-[10px] text-muted truncate">{contact.functionTitle}</p>
        </div>
      </div>

      <div className="space-y-1">
        <span className={`text-[9px] font-bold uppercase tracking-[0.12em] ${roleMeta.color}`}>{roleMeta.label}</span>
        {(contact.pole || contact.team) && (
          <p className="text-[10px] text-muted truncate">{[contact.pole, contact.team].filter(Boolean).join(' · ')}</p>
        )}
        {contact.location && (
          <p className="text-[10px] text-muted flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />{contact.location}</p>
        )}
        {contact.email && (
          <p className="text-[10px] text-muted flex items-center gap-1 truncate"><Mail className="w-2.5 h-2.5 shrink-0" />{contact.email}</p>
        )}
      </div>

      {contact.skills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {contact.skills.slice(0, 4).map((s) => (
            <span key={s} className="text-[8px] font-mono uppercase tracking-[0.1em] border border-neutral-300 dark:border-ink-600 px-1.5 py-0.5 text-muted">{s}</span>
          ))}
          {contact.skills.length > 4 && <span className="text-[8px] text-muted">+{contact.skills.length - 4}</span>}
        </div>
      )}

      {(onEdit || onDelete) && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          {onEdit && (
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="w-6 h-6 flex items-center justify-center text-muted hover:text-brand">
              <Pencil className="w-3 h-3" />
            </button>
          )}
          {onDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="w-6 h-6 flex items-center justify-center text-muted hover:text-red-500">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </button>
  );
};

/* ─────────────────────────────────────────────────────────────────────────
   Org Chart (pure SVG/DOM — no external lib)
   ───────────────────────────────────────────────────────────────────────── */
interface OrgNode {
  contact: AIContact;
  children: OrgNode[];
  x: number; y: number; w: number;
}

const NODE_W = 160, NODE_H = 64, X_GAP = 20, Y_GAP = 50;

const layoutTree = (node: OrgNode, x: number, y: number, familyMap: Map<string, AIContactFamily>): number => {
  if (node.children.length === 0) {
    node.x = x; node.y = y; node.w = NODE_W;
    return NODE_W;
  }
  let totalW = 0;
  const widths: number[] = node.children.map((child) => {
    const w = layoutTree(child, x + totalW, y + NODE_H + Y_GAP, familyMap);
    totalW += w + X_GAP;
    return w;
  });
  totalW -= X_GAP;
  node.w = totalW;
  node.x = x + (totalW - NODE_W) / 2;
  node.y = y;
  return Math.max(totalW, NODE_W);
};

const OrgChart: React.FC<{
  contacts: AIContact[];
  families: AIContactFamily[];
  onSelect: (c: AIContact) => void;
  selected: string | null;
}> = ({ contacts, families, onSelect, selected }) => {
  const familyMap = useMemo(() => new Map(families.map((f) => [f.id, f])), [families]);

  const tree = useMemo<OrgNode | null>(() => {
    if (contacts.length === 0) return null;
    const byId = new Map(contacts.map((c) => [c.id, c]));
    const nodeMap = new Map<string, OrgNode>();
    contacts.forEach((c) => nodeMap.set(c.id, { contact: c, children: [], x: 0, y: 0, w: NODE_W }));
    // Roots = no manager, or manager not in list
    const roots: OrgNode[] = [];
    contacts.forEach((c) => {
      const node = nodeMap.get(c.id)!;
      if (c.managerId && nodeMap.has(c.managerId)) {
        nodeMap.get(c.managerId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    // Wrap multiple roots in a virtual root
    if (roots.length === 1) {
      layoutTree(roots[0], 0, 0, familyMap);
      return roots[0];
    }
    const virtualRoot: OrgNode = { contact: contacts[0], children: roots, x: 0, y: 0, w: 0 };
    layoutTree(virtualRoot, 0, 0, familyMap);
    return virtualRoot.children.length > 0 ? virtualRoot : null;
  }, [contacts, familyMap]);

  if (!tree) return <div className="p-16 text-center text-sm text-muted">No contacts to display.</div>;

  // Collect all nodes flat for SVG rendering
  const allNodes: OrgNode[] = [];
  const allEdges: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const collect = (n: OrgNode) => {
    allNodes.push(n);
    n.children.forEach((ch) => {
      allEdges.push({
        x1: n.x + NODE_W / 2, y1: n.y + NODE_H,
        x2: ch.x + NODE_W / 2, y2: ch.y,
      });
      collect(ch);
    });
  };
  collect(tree);

  const totalW = Math.max(...allNodes.map((n) => n.x + NODE_W)) + 40;
  const totalH = Math.max(...allNodes.map((n) => n.y + NODE_H)) + 40;

  return (
    <div className="overflow-auto">
      <svg width={totalW + 40} height={totalH + 40} style={{ display: 'block' }}>
        <g transform="translate(20,20)">
          {/* Edges */}
          {allEdges.map((e, i) => (
            <path key={i} d={`M${e.x1},${e.y1} C${e.x1},${(e.y1 + e.y2) / 2} ${e.x2},${(e.y1 + e.y2) / 2} ${e.x2},${e.y2}`}
              fill="none" stroke="currentColor" strokeWidth="1" className="text-neutral-300 dark:text-ink-500" />
          ))}
          {/* Nodes */}
          {allNodes.map((n) => {
            const fam = n.contact.familyId ? familyMap.get(n.contact.familyId) : undefined;
            const color = fam?.color || n.contact.avatarColor || '#FF3E00';
            const isSel = selected === n.contact.id;
            return (
              <g key={n.contact.id} transform={`translate(${n.x},${n.y})`}
                onClick={() => onSelect(n.contact)} style={{ cursor: 'pointer' }}>
                <rect width={NODE_W} height={NODE_H} rx="0" fill="white"
                  stroke={isSel ? '#FF3E00' : '#e5e7eb'} strokeWidth={isSel ? 2 : 1}
                  className="dark:fill-ink-800 dark:stroke-ink-500" />
                <rect width="4" height={NODE_H} fill={color} />
                <rect y="0" width={NODE_W} height="3" fill={color} />
                <text x="16" y="22" fontSize="10" fontWeight="700" fill={isSel ? '#FF3E00' : '#111'}
                  className="dark:fill-white" style={{ fontFamily: 'system-ui' }}>
                  {(n.contact.firstName + ' ' + n.contact.lastName).slice(0, 18)}
                </text>
                <text x="16" y="36" fontSize="8" fill="#888" style={{ fontFamily: 'system-ui' }}>
                  {n.contact.functionTitle.slice(0, 22)}
                </text>
                <text x="16" y="50" fontSize="8" fill={color} fontWeight="700" style={{ fontFamily: 'system-ui', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {ROLE_META[n.contact.role].label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────
   Contact detail panel
   ───────────────────────────────────────────────────────────────────────── */
const ContactDetail: React.FC<{
  contact: AIContact;
  family?: AIContactFamily;
  manager?: AIContact;
  onClose: () => void;
  onEdit?: () => void;
}> = ({ contact, family, manager, onClose, onEdit }) => {
  const roleMeta = ROLE_META[contact.role];
  return (
    <div className="w-80 shrink-0 surface border flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-ink-600 bg-neutral-50 dark:bg-ink-800">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em]">Profile</span>
        <div className="flex items-center gap-1">
          {onEdit && (
            <button onClick={onEdit} className="w-6 h-6 flex items-center justify-center text-muted hover:text-brand">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center text-muted hover:text-neutral-900 dark:hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="overflow-y-auto p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Avatar contact={contact} size={14} />
          <div>
            <p className="text-[15px] font-black">{fullName(contact)}</p>
            <p className="text-[10px] text-muted">{contact.functionTitle}</p>
            {!contact.isActive && <span className="text-[8px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 bg-neutral-200 text-neutral-500 dark:bg-ink-600 dark:text-neutral-400">Inactive</span>}
          </div>
        </div>

        {family && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 shrink-0" style={{ backgroundColor: family.color }} />
            <span className="text-[10px] font-bold uppercase tracking-[0.12em]">{family.name}</span>
          </div>
        )}

        <div className="space-y-2 text-[11px]">
          <div className="flex items-center gap-2">
            <span className={`font-bold uppercase tracking-[0.1em] text-[9px] ${roleMeta.color}`}>{roleMeta.label}</span>
          </div>
          {contact.uid && <p className="font-mono text-muted">{contact.uid}</p>}
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-brand hover:underline truncate">
              <Mail className="w-3 h-3 shrink-0" />{contact.email}
            </a>
          )}
          {contact.phone && <p className="flex items-center gap-1.5 text-muted"><Phone className="w-3 h-3" />{contact.phone}</p>}
          {contact.location && <p className="flex items-center gap-1.5 text-muted"><MapPin className="w-3 h-3" />{contact.location}</p>}
          {contact.pole && <p className="flex items-center gap-1.5 text-muted"><Layers className="w-3 h-3" />Pole: {contact.pole}</p>}
          {contact.team && <p className="flex items-center gap-1.5 text-muted"><Briefcase className="w-3 h-3" />Team: {contact.team}</p>}
          {manager && <p className="flex items-center gap-1.5 text-muted"><UsersIcon className="w-3 h-3" />Reports to: {fullName(manager)}</p>}
          {contact.linkedinUrl && (
            <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-brand hover:underline">
              <ExternalLink className="w-3 h-3" />LinkedIn
            </a>
          )}
        </div>

        {contact.bio && (
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted mb-1">About</p>
            <p className="text-[11px] leading-relaxed">{contact.bio}</p>
          </div>
        )}

        {contact.skills.length > 0 && (
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted mb-1.5">Skills</p>
            <div className="flex flex-wrap gap-1">
              {contact.skills.map((s) => (
                <span key={s} className="text-[9px] font-mono uppercase tracking-[0.1em] border border-neutral-300 dark:border-ink-600 px-1.5 py-0.5 text-muted">{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────
   Contact Editor modal
   ───────────────────────────────────────────────────────────────────────── */
const ContactEditor: React.FC<{
  contact: AIContact;
  isNew: boolean;
  state: AppState;
  onSave: (c: AIContact) => void;
  onClose: () => void;
}> = ({ contact, isNew, state, onSave, onClose }) => {
  const [form, setForm] = useState<AIContact>(contact);
  const [newSkill, setNewSkill] = useState('');
  const set = <K extends keyof AIContact>(k: K, v: AIContact[K]) => setForm((p) => ({ ...p, [k]: v }));
  useEditingLock(true);

  const inputCls = 'w-full h-9 px-3 text-[11px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand transition-colors';
  const valid = form.firstName.trim() && form.lastName.trim() && form.functionTitle.trim();

  const addSkill = () => {
    const s = newSkill.trim();
    if (!s || form.skills.includes(s)) return;
    set('skills', [...form.skills, s]);
    setNewSkill('');
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-6 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-ink-900 border border-neutral-200 dark:border-ink-700 shadow-2xl mb-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-ink-700 bg-neutral-50 dark:bg-ink-800 sticky top-0 z-10">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] flex items-center gap-2">
            <ContactRound className="w-4 h-4 text-brand" />{isNew ? 'New AI Contact' : 'Edit Contact'}
          </span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-muted hover:text-neutral-900 dark:hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Identity */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted border-b border-neutral-200 dark:border-ink-700 pb-1.5 mb-3">Identity</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300 mb-1">First name *</label><input className={inputCls} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} autoFocus /></div>
              <div><label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300 mb-1">Last name *</label><input className={inputCls} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} /></div>
              <div><label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300 mb-1">UID</label><input className={inputCls} value={form.uid ?? ''} onChange={(e) => set('uid', e.target.value)} placeholder="login handle" /></div>
              <div><label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300 mb-1">Function / Title *</label><input className={inputCls} value={form.functionTitle} onChange={(e) => set('functionTitle', e.target.value)} /></div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300 mb-1">AI Role</label>
                <select className={inputCls} value={form.role} onChange={(e) => set('role', e.target.value as AIContactRole)}>
                  {(Object.entries(ROLE_META) as [AIContactRole, { label: string }][]).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300 mb-1">Manager</label>
                <select className={inputCls} value={form.managerId ?? ''} onChange={(e) => set('managerId', e.target.value || undefined)}>
                  <option value="">— None —</option>
                  {state.aiContacts.filter((c) => c.id !== form.id).map((c) => <option key={c.id} value={c.id}>{fullName(c)}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted border-b border-neutral-200 dark:border-ink-700 pb-1.5 mb-3">Contact</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300 mb-1">Email</label><input type="email" className={inputCls} value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} /></div>
              <div><label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300 mb-1">Phone</label><input className={inputCls} value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></div>
              <div><label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300 mb-1">Location</label><input className={inputCls} value={form.location ?? ''} onChange={(e) => set('location', e.target.value)} placeholder="City / Site" /></div>
              <div><label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300 mb-1">LinkedIn</label><input className={inputCls} value={form.linkedinUrl ?? ''} onChange={(e) => set('linkedinUrl', e.target.value)} placeholder="https://…" /></div>
            </div>
          </div>

          {/* Organisation */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted border-b border-neutral-200 dark:border-ink-700 pb-1.5 mb-3">Organisation</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300 mb-1">Team</label><input className={inputCls} value={form.team ?? ''} onChange={(e) => set('team', e.target.value)} /></div>
              <div><label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300 mb-1">Pole / BU</label><input className={inputCls} value={form.pole ?? ''} onChange={(e) => set('pole', e.target.value)} /></div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300 mb-1">Family</label>
                <select className={inputCls} value={form.familyId ?? ''} onChange={(e) => set('familyId', e.target.value || undefined)}>
                  <option value="">— None —</option>
                  {state.aiContactFamilies.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300 mb-1">Avatar colour</label>
                <div className="flex gap-1.5 flex-wrap">
                  {PALETTE.map((col) => (
                    <button key={col} type="button" onClick={() => set('avatarColor', col)}
                      className={`w-7 h-7 transition-transform hover:scale-110 ${form.avatarColor === col ? 'ring-2 ring-offset-1 ring-neutral-900 dark:ring-white' : ''}`}
                      style={{ backgroundColor: col }} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bio + Skills */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted border-b border-neutral-200 dark:border-ink-700 pb-1.5 mb-3">Expertise</p>
            <div className="space-y-3">
              <div><label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300 mb-1">Bio</label>
                <textarea rows={2} className="w-full px-3 py-2 text-[11px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand resize-none" value={form.bio ?? ''} onChange={(e) => set('bio', e.target.value)} placeholder="Short summary of expertise…" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300 mb-1">Skills</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {form.skills.map((s) => (
                    <span key={s} className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono uppercase border border-neutral-300 dark:border-ink-600">
                      {s}<button type="button" onClick={() => set('skills', form.skills.filter((x) => x !== s))} className="hover:text-red-500"><X className="w-2.5 h-2.5" /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newSkill} onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                    placeholder="Add skill and press Enter" className={inputCls} />
                  <button type="button" onClick={addSkill} className="px-3 h-9 text-[10px] font-bold uppercase border border-neutral-300 dark:border-ink-600 hover:border-brand hover:text-brand">Add</button>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="w-4 h-4 accent-brand" />
                <span className="text-[10px] font-bold uppercase tracking-[0.14em]">Active contributor</span>
              </label>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 px-6 py-4 border-t border-neutral-200 dark:border-ink-700 bg-white dark:bg-ink-900">
          <button onClick={onClose} className="px-4 h-9 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-600 hover:border-neutral-400">Cancel</button>
          <button onClick={() => valid && onSave(form)} disabled={!valid}
            className="flex items-center gap-2 px-4 h-9 text-[10px] font-bold uppercase tracking-[0.14em] bg-brand text-white hover:bg-brand/90 disabled:opacity-40">
            <Save className="w-3.5 h-3.5" />{isNew ? 'Create' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────
   Main view
   ───────────────────────────────────────────────────────────────────────── */

type ViewMode = 'list' | 'chart';

export const AIContacts: React.FC<Props> = ({ state, currentUser, update }) => {
  const contacts = state.aiContacts ?? [];
  const families = state.aiContactFamilies ?? [];

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<AIContactRole | 'all'>('all');
  const [familyFilter, setFamilyFilter] = useState('');
  const [poleFilter, setPoleFilter] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [view, setView] = useState<ViewMode>('list');
  const [editing, setEditing] = useState<AIContact | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [selected, setSelected] = useState<AIContact | null>(null);
  useEditingLock(editing !== null);

  const canAdmin = currentUser.role === 'admin';

  const poles = useMemo(() => Array.from(new Set(contacts.map((c) => c.pole).filter(Boolean))), [contacts]);
  const familyMap = useMemo(() => new Map(families.map((f) => [f.id, f])), [families]);
  const contactMap = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return contacts.filter((c) => {
      if (activeOnly && !c.isActive) return false;
      if (roleFilter !== 'all' && c.role !== roleFilter) return false;
      if (familyFilter && c.familyId !== familyFilter) return false;
      if (poleFilter && c.pole !== poleFilter) return false;
      if (q) {
        return fullName(c).toLowerCase().includes(q) ||
          (c.email ?? '').toLowerCase().includes(q) ||
          (c.functionTitle ?? '').toLowerCase().includes(q) ||
          (c.team ?? '').toLowerCase().includes(q) ||
          (c.pole ?? '').toLowerCase().includes(q) ||
          c.skills.some((s) => s.toLowerCase().includes(q));
      }
      return true;
    });
  }, [contacts, search, roleFilter, familyFilter, poleFilter, activeOnly]);

  const save = useCallback((c: AIContact) => {
    const saved = { ...c, updatedAt: new Date().toISOString() };
    update((s) => ({
      ...s,
      aiContacts: isNew
        ? [...(s.aiContacts ?? []), saved]
        : (s.aiContacts ?? []).map((x) => (x.id === saved.id ? saved : x)),
    }));
    setEditing(null);
  }, [isNew, update]);

  const remove = useCallback((id: string) => {
    if (!window.confirm('Delete this contact?')) return;
    update((s) => ({ ...s, aiContacts: (s.aiContacts ?? []).filter((c) => c.id !== id) }));
    if (selected?.id === id) setSelected(null);
  }, [update, selected]);

  const kpis = useMemo(() => ({
    total: contacts.length,
    active: contacts.filter((c) => c.isActive).length,
    poles: new Set(contacts.map((c) => c.pole).filter(Boolean)).size,
    families: families.length,
  }), [contacts, families]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="label-xs">AI Organisation</p>
          <h1 className="display-xl flex items-center gap-3"><ContactRound className="w-7 h-7 text-brand" /> AI Contacts</h1>
          <p className="text-sm text-muted mt-1">Directory of AI contributors across the organisation.</p>
        </div>
        {canAdmin && (
          <button onClick={() => { setEditing(blankContact(currentUser.id)); setIsNew(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-[11px] font-bold uppercase tracking-[0.16em] hover:bg-brand/90">
            <Plus className="w-4 h-4" /> Add contact
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: kpis.total },
          { label: 'Active', value: kpis.active, accent: 'text-emerald-600' },
          { label: 'Poles', value: kpis.poles },
          { label: 'Families', value: kpis.families, accent: 'text-brand' },
        ].map((k) => (
          <div key={k.label} className="surface border p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted mb-1">{k.label}</p>
            <p className={`text-2xl font-black tracking-tight ${k.accent || ''}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters + view toggle */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, skill, team…"
              className="w-full h-9 pl-9 pr-3 text-[11px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand" />
          </div>
          <div className="flex items-center gap-1 border border-neutral-300 dark:border-ink-600">
            {(['list', 'chart'] as ViewMode[]).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`flex items-center gap-1.5 px-3 h-9 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
                  view === v ? 'bg-brand text-white' : 'text-neutral-500 hover:text-brand'}`}>
                {v === 'list' ? <><List className="w-3.5 h-3.5" />List</> : <><Network className="w-3.5 h-3.5" />Org chart</>}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-muted" />
          {(['all', ...Object.keys(ROLE_META)] as (AIContactRole | 'all')[]).map((r) => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] border transition-colors ${
                roleFilter === r ? 'bg-brand text-white border-brand' : 'border-neutral-300 dark:border-ink-600 text-neutral-500 hover:border-brand hover:text-brand'}`}>
              {r === 'all' ? 'All roles' : ROLE_META[r].label}
            </button>
          ))}
          {families.length > 0 && (
            <select value={familyFilter} onChange={(e) => setFamilyFilter(e.target.value)}
              className="h-8 px-2 text-[10px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand">
              <option value="">All families</option>
              {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
          {poles.length > 0 && (
            <select value={poleFilter} onChange={(e) => setPoleFilter(e.target.value)}
              className="h-8 px-2 text-[10px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand">
              <option value="">All poles</option>
              {poles.map((p) => <option key={p} value={p!}>{p}</option>)}
            </select>
          )}
          <button onClick={() => setActiveOnly((v) => !v)}
            className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] border transition-colors ${
              activeOnly ? 'bg-brand text-white border-brand' : 'border-neutral-300 dark:border-ink-600 text-neutral-500 hover:border-brand hover:text-brand'}`}>
            Active only
          </button>
        </div>
      </div>

      {/* Content */}
      {view === 'list' ? (
        <div className="flex gap-4">
          <div className={`flex-1 min-w-0 ${contacts.length === 0 ? '' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3'}`}>
            {filtered.length === 0 ? (
              <div className="surface border border-dashed p-16 text-center">
                <ContactRound className="w-10 h-10 mx-auto mb-4 opacity-20" />
                <p className="text-sm text-muted">{contacts.length === 0 ? 'No AI contacts yet. Add the first one.' : 'No contacts match the filters.'}</p>
              </div>
            ) : (
              filtered.map((c) => (
                <ContactCard
                  key={c.id} contact={c}
                  family={c.familyId ? familyMap.get(c.familyId) : undefined}
                  onClick={() => setSelected(c)}
                  onEdit={canAdmin ? () => { setEditing({ ...c }); setIsNew(false); } : undefined}
                  onDelete={canAdmin ? () => remove(c.id) : undefined}
                />
              ))
            )}
          </div>
          {selected && (
            <ContactDetail
              contact={selected}
              family={selected.familyId ? familyMap.get(selected.familyId) : undefined}
              manager={selected.managerId ? contactMap.get(selected.managerId) : undefined}
              onClose={() => setSelected(null)}
              onEdit={canAdmin ? () => { setEditing({ ...selected }); setIsNew(false); setSelected(null); } : undefined}
            />
          )}
        </div>
      ) : (
        <div className="flex gap-4">
          <div className="flex-1 surface border overflow-auto">
            <OrgChart
              contacts={filtered}
              families={families}
              onSelect={(c) => setSelected((prev) => prev?.id === c.id ? null : c)}
              selected={selected?.id ?? null}
            />
          </div>
          {selected && (
            <ContactDetail
              contact={selected}
              family={selected.familyId ? familyMap.get(selected.familyId) : undefined}
              manager={selected.managerId ? contactMap.get(selected.managerId) : undefined}
              onClose={() => setSelected(null)}
              onEdit={canAdmin ? () => { setEditing({ ...selected }); setIsNew(false); setSelected(null); } : undefined}
            />
          )}
        </div>
      )}

      {editing && (
        <ContactEditor
          contact={editing} isNew={isNew} state={state}
          onSave={save} onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};
