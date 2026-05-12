import React, { useMemo, useState } from 'react';
import { Briefcase, Mail, Plus, Trash2, X } from 'lucide-react';
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
  const canEdit = currentUser.role === 'admin' || currentUser.role === 'manager';

  const byTeam = useMemo(() => {
    const out: Record<string, User[]> = {};
    state.users.forEach((u) => {
      if (!out[u.team]) out[u.team] = [];
      out[u.team].push(u);
    });
    return out;
  }, [state.users]);

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
            {state.users.length} contributors across {Object.keys(byTeam).length} teams.
          </p>
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
            {members.map((u) => (
              <button
                key={u.id}
                onClick={() => canEdit && setEdit(u)}
                className="surface border text-left p-5 hover:border-brand transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-12 h-12 flex items-center justify-center text-white font-bold uppercase"
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
                  <Badge tone="muted">{u.role}</Badge>
                </div>
                <div className="mt-3 space-y-1.5 text-xs text-muted">
                  <p className="flex items-center gap-2">
                    <Mail className="w-3 h-3" />
                    {u.email}
                  </p>
                  <p className="flex items-center gap-2">
                    <Briefcase className="w-3 h-3" />
                    UID: <span className="font-mono">{u.uid}</span>
                  </p>
                </div>
                {u.expectations && (
                  <p className="mt-3 pt-3 border-t border-neutral-200 dark:border-ink-600 text-xs italic text-muted line-clamp-2">
                    “{u.expectations}”
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}

      {edit && (
        <ContributorEditor
          user={edit}
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

const ContributorEditor: React.FC<{
  user: User;
  onClose: () => void;
  onSave: (u: User) => void;
  onDelete?: () => void;
}> = ({ user, onClose, onSave, onDelete }) => {
  const [d, setD] = useState<User>(user);
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="surface border w-full max-w-2xl animate-slide-up">
        <div className="p-5 border-b border-neutral-200 dark:border-ink-600 flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-tight">Edit contributor</h2>
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
          <Field label="Job title">
            <Input
              value={d.functionTitle}
              onChange={(e) => setD({ ...d, functionTitle: e.target.value })}
            />
          </Field>
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
