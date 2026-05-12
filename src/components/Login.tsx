import React, { useState } from 'react';
import { Shield, ArrowRight, Sun, Moon, Eye, EyeOff } from 'lucide-react';
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
  const [uid, setUid] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
            DOINg<span className="text-brand">.AI</span>
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
              placeholder="Enter your user ID"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="label-xs">Password</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-11"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-brand transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
          <Button type="submit" size="lg" className="w-full">
            Sign in
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </form>
      </div>
    </div>
  );
};
