import React, { useMemo, useState } from 'react';
import { Briefcase, Mail, Plus, Trash2, X, Users, LayoutGrid } from 'lucide-react';
import { AppState, User, Role } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input, Textarea, Select } from '../ui/Input';
import { generateId } from '../../services/storage';

interface Props {
  state: AppState;
  currentUser: User;
  update: (m: (s: AppState) => AppState) => void;
}

const newUser = (): User => ({
  id: generateId(),
  uid: 'newuser',
  password: 'changeme',
  firstName: 'New',
  lastName: 'User',
  email: 'new@nexus.ai',
  team: 'Unassigned',
  functionTitle: 'Contributor',
  role: 'contributor',
  expectations: '',
  avatarColor: '#FF3E00',
  createdAt: new Date().toISOString(),
});

export const Contributors: React.FC<Props> = ({ state, currentUser, update }) => {
  const [edit, setEdit] = useState<User | null>(null);
  const [profileView, setProfileView] = useState<User | null>(null);
  const [groupBy, setGroupBy] = useState<'team' | 'squad'>('team');
  const canEdit = currentUser.role === 'admin' || currentUser.role === 'manager';
  const isAdmin = currentUser.role === 'admin';

  const byTeam = useMemo(() => {
    const out: Record<string, User[]> = {};
    state.users.forEach((u) => {
      const key = groupBy === 'squad'
        ? (u.squadTeam?.trim() || '— No Squad —')
        : (u.team?.trim() || '— No Team —');
      if (!out[key]) out[key] = [];
      out[key].push(u);
    });
    return out;
  }, [state.users, groupBy]);

  const upsert = (u: User) =>
    update((s) => ({
      ...s,
      users: s.users.some((x) => x.id === u.id)
        ? s.users.map((x) => (x.id === u.id ? u : x))
        : [...s.users, u],
    }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="label-xs">People</p>
          <h1 className="display-xl">Contributors</h1>
          <p className="text-sm text-muted mt-2">
            {state.users.length} contributors across {Object.keys(byTeam).length} {groupBy === 'squad' ? 'squads' : 'teams'}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-neutral-300 dark:border-ink-500 overflow-hidden">
            <button
              onClick={() => setGroupBy('team')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${groupBy === 'team' ? 'bg-brand text-white' : 'text-muted hover:text-neutral-900 dark:hover:text-white'}`}
            >
              <LayoutGrid className="w-3 h-3" /> Team
            </button>
            <button
              onClick={() => setGroupBy('squad')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors border-l border-neutral-300 dark:border-ink-500 ${groupBy === 'squad' ? 'bg-brand text-white border-brand' : 'text-muted hover:text-neutral-900 dark:hover:text-white'}`}
            >
              <Users className="w-3 h-3" /> Squad
            </button>
          </div>
          {canEdit && (
            <Button
              onClick={() => {
                const u = newUser();
                upsert(u);
                setEdit(u);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add contributor
            </Button>
          )}
        </div>
      </div>

      {Object.entries(byTeam).map(([team, members]) => (
        <div key={team} className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-black uppercase tracking-tight">{team}</h2>
            <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted">
              {members.length} member{members.length !== 1 ? 's' : ''}
            </span>
            <div className="flex-1 h-px bg-neutral-200 dark:bg-ink-600" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {members.map((u) => {
              const activeProjects = state.projects.filter(
                (p) => !p.isArchived && p.status !== 'Done' && p.members.some((m) => m.userId === u.id)
              ).length;
              const wlTone = activeProjects >= 5 ? 'red' : activeProjects >= 3 ? 'amber' : 'green';
              const wlStyle = wlTone === 'red' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : wlTone === 'amber' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
              return (
              <button
                key={u.id}
                onClick={() => setProfileView(u)}
                className="surface border text-left p-5 hover:border-brand transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-12 h-12 flex items-center justify-center text-white font-bold uppercase shrink-0"
                    style={{ backgroundColor: u.avatarColor || '#FF3E00' }}
                  >
                    {u.firstName.charAt(0)}
                    {u.lastName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold uppercase tracking-tight truncate">
                      {u.firstName} {u.lastName}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-brand truncate">
                      {u.functionTitle}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge tone="muted">{u.role}</Badge>
                    <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] ${wlStyle}`} title="Active projects">
                      {activeProjects} proj
                    </span>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5 text-xs text-muted">
                  <p className="flex items-center gap-2">
                    <Mail className="w-3 h-3" />
                    {u.email}
                  </p>
                  <p className="flex items-center gap-2">
                    <Briefcase className="w-3 h-3" />
                    {u.team}
                  </p>
                  {u.squadTeam && (
                    <p className="flex items-center gap-2">
                      <Users className="w-3 h-3" />
                      Squad: <span className="font-bold text-brand">{u.squadTeam}</span>
                    </p>
                  )}
                </div>
                {u.expectations && (
                  <p className="mt-3 pt-3 border-t border-neutral-200 dark:border-ink-600 text-xs italic text-muted line-clamp-2">
                    “{u.expectations}”
                  </p>
                )}
              </button>
              );
            })}
          </div>
        </div>
      ))}

      {profileView && (
        <ProfileViewModal
          user={profileView}
          state={state}
          currentUser={currentUser}
          onClose={() => setProfileView(null)}
          onEdit={canEdit ? () => { setEdit(profileView); setProfileView(null); } : undefined}
        />
      )}

      {edit && (
        <AccessEditor
          user={edit}
          isAdmin={isAdmin}
          onClose={() => setEdit(null)}
          onSave={(u) => {
            upsert(u);
            setEdit(null);
          }}
          onDelete={
            currentUser.role === 'admin' && edit.id !== currentUser.id
              ? () => {
                  update((s) => ({ ...s, users: s.users.filter((x) => x.id !== edit.id) }));
                  setEdit(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
};

/* === Profile View Modal (read-only, all users) === */

const ProfileViewModal: React.FC<{
  user: User;
  state: AppState;
  currentUser: User;
  onClose: () => void;
  onEdit?: () => void;
}> = ({ user, state, currentUser, onClose, onEdit }) => {
  const activeProjects = state.projects.filter(
    (p) => !p.isArchived && p.status !== 'Done' && p.members.some((m) => m.userId === user.id)
  );
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="surface border w-full max-w-lg animate-slide-up">
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-tight">Contributor Profile</h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:text-brand">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* Avatar row */}
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 flex items-center justify-center text-white font-bold uppercase text-lg shrink-0"
              style={{ backgroundColor: user.avatarColor || '#FF3E00' }}
            >
              {user.firstName.charAt(0)}{user.lastName.charAt(0)}
            </div>
            <div>
              <p className="text-lg font-black uppercase tracking-tight">{user.firstName} {user.lastName}</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-brand font-mono">{user.functionTitle}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] bg-neutral-100 dark:bg-ink-700 text-muted">{user.role}</span>
                {user.team && <span className="text-[10px] text-muted">{user.team}</span>}
                {user.squadTeam && <span className="text-[10px] text-brand font-bold">{user.squadTeam}</span>}
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2 text-sm border-t border-neutral-200 dark:border-ink-600 pt-4">
            <div className="flex items-center gap-2 text-xs">
              <Mail className="w-3.5 h-3.5 text-muted shrink-0" />
              <span className="text-muted">{user.email}</span>
            </div>
            {user.expectations && (
              <div className="pt-2">
                <p className="label-xs mb-1">Expectations / Goals</p>
                <p className="text-xs text-muted italic leading-relaxed">"{user.expectations}"</p>
              </div>
            )}
          </div>

          {/* Active projects */}
          <div className="border-t border-neutral-200 dark:border-ink-600 pt-3">
            <p className="label-xs mb-2">Active Projects ({activeProjects.length})</p>
            {activeProjects.length === 0 ? (
              <p className="text-xs text-muted">No active projects.</p>
            ) : (
              <div className="space-y-1">
                {activeProjects.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs border border-neutral-200 dark:border-ink-600 px-2 py-1">
                    <span className="font-medium truncate">{p.name}</span>
                    <span className="text-muted ml-2 shrink-0">{p.status}</span>
                  </div>
                ))}
                {activeProjects.length > 5 && (
                  <p className="text-[10px] text-muted">+{activeProjects.length - 5} more…</p>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {onEdit && (
            <Button onClick={onEdit}>
              Edit Profile
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

/* === Access Editor (admin/manager only — full edit with uid/password) === */

const AccessEditor: React.FC<{
  user: User;
  isAdmin: boolean;
  onClose: () => void;
  onSave: (u: User) => void;
  onDelete?: () => void;
}> = ({ user, isAdmin, onClose, onSave, onDelete }) => {
  const [d, setD] = useState<User>(user);
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="surface border w-full max-w-2xl animate-slide-up">
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-tight">Edit Contributor</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center hover:text-brand"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="First name">
            <Input value={d.firstName} onChange={(e) => setD({ ...d, firstName: e.target.value })} />
          </Field>
          <Field label="Last name">
            <Input value={d.lastName} onChange={(e) => setD({ ...d, lastName: e.target.value })} />
          </Field>
          {isAdmin && (
            <>
              <Field label="User ID">
                <Input value={d.uid} onChange={(e) => setD({ ...d, uid: e.target.value })} />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  value={d.password}
                  onChange={(e) => setD({ ...d, password: e.target.value })}
                />
              </Field>
            </>
          )}
          <Field label="Email">
            <Input
              type="email"
              value={d.email}
              onChange={(e) => setD({ ...d, email: e.target.value })}
            />
          </Field>
          <Field label="Team">
            <Input value={d.team} onChange={(e) => setD({ ...d, team: e.target.value })} />
          </Field>
          <Field label="Squad team">
            <Input
              value={d.squadTeam || ''}
              onChange={(e) => setD({ ...d, squadTeam: e.target.value })}
              placeholder="e.g. Platform Squad, Data Squad…"
            />
          </Field>
          <Field label="Job title">
            <Input
              value={d.functionTitle}
              onChange={(e) => setD({ ...d, functionTitle: e.target.value })}
            />
          </Field>
          {isAdmin && (
            <Field label="App role">
              <Select
                value={d.role}
                onChange={(e) => setD({ ...d, role: e.target.value as Role })}
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="contributor">Contributor</option>
                <option value="viewer">Viewer</option>
              </Select>
            </Field>
          )}
          <div className="md:col-span-2">
            <Field label="Expectations / goals">
              <Textarea
                value={d.expectations || ''}
                onChange={(e) => setD({ ...d, expectations: e.target.value })}
              />
            </Field>
          </div>
        </div>
        <div className="p-4 border-t border-neutral-200 dark:border-ink-600 flex items-center justify-between">
          {onDelete ? (
            <Button variant="danger" onClick={onDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Remove
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => onSave(d)}>Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="label-xs">{label}</label>
    {children}
  </div>
);
