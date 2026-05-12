import React, { useState } from 'react';
import { Shield, ArrowRight, Sun, Moon } from 'lucide-react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { User, Theme } from '../types';

interface Props {
  users: User[];
  onLogin: (user: User) => void;
  theme: Theme;
  toggleTheme: () => void;
}

export const Login: React.FC<Props> = ({ users, onLogin, theme, toggleTheme }) => {
  const [uid, setUid] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = users.find(
      (x) => x.uid.toLowerCase() === uid.trim().toLowerCase() && x.password === password
    );
    if (u) {
      setError('');
      onLogin(u);
    } else {
      setError('Invalid credentials.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 grid-bg">
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center border border-neutral-300 dark:border-ink-500 hover:border-brand hover:text-brand transition-colors"
        title="Toggle theme"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 bg-brand/10 border border-brand/30 flex items-center justify-center text-brand mb-4">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="display-lg">
            NEXUS<span className="text-brand">.AI</span>
          </h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted mt-3 font-mono">
            AI Project Operations Platform
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="surface border p-8 space-y-5 shadow-xl shadow-black/20"
        >
          <div className="space-y-2">
            <label className="label-xs">User ID</label>
            <Input
              autoFocus
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              placeholder="admin"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="label-xs">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
          <Button type="submit" size="lg" className="w-full">
            Sign in
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <p className="text-[10px] text-muted text-center font-mono uppercase tracking-[0.14em]">
            Default admin: <span className="text-brand">admin</span> / MM@2026
          </p>
        </form>
      </div>
    </div>
  );
};
