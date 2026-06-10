import React, { useEffect, useState } from 'react';
import { Shield, ArrowRight, Sun, Moon, Eye, EyeOff, KeyRound, Loader2, Check, LogIn as SsoIcon, AlertTriangle } from 'lucide-react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { User, Theme } from '../types';
import { hashPassword, verifyPassword } from '../services/crypto';

interface Props {
  users: User[];
  onLogin: (user: User) => void;
  /** Called when a user changes their password (forced or otherwise). Parent
   *  is expected to persist the new hash/salt and clear mustChangePassword. */
  onPasswordChange: (userId: string, newPasswordHash: string, newPasswordSalt: string) => void;
  theme: Theme;
  toggleTheme: () => void;
}

/* ── SSO public config (non-secret, fetched from /api/sso/config) ──────── */
interface SSOPublicCfg { enabled: boolean; provider: string }
const PROVIDER_LABELS: Record<string, string> = {
  azure_ad: 'Azure AD', okta: 'Okta', keycloak: 'Keycloak',
  google: 'Google Workspace', generic_oidc: 'SSO',
};

/**
 * Login flow:
 *  1. On mount, check /api/sso/config and if SSO is enabled expose the SSO
 *     button.  Also handle the ?sso_uid=…&sso_sig=… redirect from the backend
 *     callback by verifying the HMAC server-side and logging the user in.
 *  2. Regular uid/password flow: verify PBKDF2 hash, migrate legacy, enforce
 *     mustChangePassword.
 */
export const Login: React.FC<Props> = ({ users, onLogin, onPasswordChange, theme, toggleTheme }) => {
  const [uid, setUid] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [forcedUser, setForcedUser] = useState<User | null>(null);
  const [sso, setSso] = useState<SSOPublicCfg | null>(null);
  const [ssoLoading, setSsoLoading] = useState(true);

  // ── Fetch SSO config + handle SSO callback ────────────────────────────
  useEffect(() => {
    // Handle SSO callback: ?sso_uid=…&sso_sig=… (set by backend after OIDC)
    const params = new URLSearchParams(window.location.search);
    const ssoUid = params.get('sso_uid');
    const ssoSig = params.get('sso_sig');
    const ssoErr = params.get('sso_error');

    if (ssoErr) {
      setError(`SSO error: ${decodeURIComponent(ssoErr)}`);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (ssoUid && ssoSig) {
      // Verify with backend then log in — the backend holds the HMAC key
      (async () => {
        try {
          const res = await fetch('/api/sso/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: ssoUid, sig: ssoSig }),
          });
          const data = await res.json();
          if (data.ok) {
            const u = users.find((x) => x.id === ssoUid);
            if (u) {
              window.history.replaceState({}, '', window.location.pathname);
              onLogin(u);
              return;
            }
            // User was just provisioned — we may need a page reload to pick it up
            // from the server state. Trigger a refresh via a custom event.
            window.history.replaceState({}, '', window.location.pathname);
            window.dispatchEvent(new CustomEvent('doing_sso_login', { detail: { userId: ssoUid } }));
          } else {
            setError('SSO session verification failed. Please try again.');
            window.history.replaceState({}, '', window.location.pathname);
          }
        } catch {
          setError('SSO verification request failed.');
        }
      })();
    }

    // Fetch SSO public config
    fetch('/api/sso/config')
      .then((r) => r.json())
      .then((d: SSOPublicCfg) => setSso(d))
      .catch(() => setSso({ enabled: false, provider: 'generic_oidc' }))
      .finally(() => setSsoLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const u = users.find((x) => x.uid.toLowerCase() === uid.trim().toLowerCase());
      if (!u) {
        setError('Invalid credentials.');
        return;
      }
      // Verify: hash first, plaintext fallback for legacy users.
      let ok = false;
      if (u.passwordHash && u.passwordSalt) {
        ok = await verifyPassword(password, u.passwordHash, u.passwordSalt);
      } else if (u.password !== undefined) {
        ok = u.password === password;
      }
      if (!ok) {
        setError('Invalid credentials.');
        return;
      }
      // Forced-change path: don't log in yet — open the change modal.
      if (u.mustChangePassword) {
        setForcedUser(u);
        return;
      }
      // Opportunistic migration: if user was still on legacy plaintext, hash it now.
      if (!u.passwordHash && u.password) {
        const { hash, salt } = await hashPassword(password);
        onPasswordChange(u.id, hash, salt);
      }
      onLogin(u);
    } catch (err) {
      console.error('[Login] error', err);
      setError('Sign-in failed. See console.');
    } finally {
      setSubmitting(false);
    }
  };

  if (forcedUser) {
    return (
      <ForcePasswordChangeModal
        user={forcedUser}
        onCancel={() => {
          // Cancelling abandons the sign-in entirely.
          setForcedUser(null);
          setPassword('');
        }}
        onChanged={async (newPlain) => {
          const { hash, salt } = await hashPassword(newPlain);
          onPasswordChange(forcedUser.id, hash, salt);
          // We sign the user in with the up-to-date object (with new creds applied).
          onLogin({ ...forcedUser, passwordHash: hash, passwordSalt: salt, password: undefined, mustChangePassword: false });
        }}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    );
  }

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
              disabled={submitting}
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
                disabled={submitting}
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
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-red-600 dark:text-red-400 text-[11px]">{error}</p>
            </div>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Signing in…</>
            ) : (
              <>Sign in <ArrowRight className="w-4 h-4 ml-2" /></>
            )}
          </Button>

          {/* SSO separator + button */}
          {!ssoLoading && sso?.enabled && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-neutral-200 dark:bg-ink-600" />
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted">or</span>
                <div className="flex-1 h-px bg-neutral-200 dark:bg-ink-600" />
              </div>
              <a
                href="/api/sso/login"
                className="flex items-center justify-center gap-2 w-full h-10 border border-brand/40 text-brand text-[11px] font-bold uppercase tracking-[0.14em] hover:bg-brand hover:text-white transition-colors"
              >
                <SsoIcon className="w-4 h-4" />
                Sign in with {PROVIDER_LABELS[sso.provider] ?? 'SSO'}
              </a>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────
   Forced password change — blocks app entry until user picks a new one.
   ──────────────────────────────────────────────────────────────────── */

interface ForcedProps {
  user: User;
  onChanged: (newPlain: string) => Promise<void>;
  onCancel: () => void;
  theme: Theme;
  toggleTheme: () => void;
}

const ForcePasswordChangeModal: React.FC<ForcedProps> = ({ user, onChanged, onCancel, theme, toggleTheme }) => {
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Light validation rules. Could be tightened later (length, complexity…)
  const validate = (): string | null => {
    if (newPw.length < 8) return 'Password must be at least 8 characters.';
    if (newPw !== confirm) return 'Passwords do not match.';
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) { setError(v); return; }
    setSubmitting(true);
    setError('');
    try {
      await onChanged(newPw);
    } catch (err) {
      console.error('[Login] forced-change error', err);
      setError('Could not update password. Try again.');
    } finally {
      setSubmitting(false);
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
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 bg-brand/10 border border-brand/30 flex items-center justify-center text-brand mb-4">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="display-lg">Change your password</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted mt-3 font-mono">
            Required by your administrator
          </p>
          <p className="text-xs text-muted mt-3">
            Signing in as <span className="font-mono text-brand">{user.uid}</span>. Pick a new password to continue.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="surface border p-8 space-y-5 shadow-xl shadow-black/20"
        >
          <div className="space-y-2">
            <label className="label-xs">New password</label>
            <div className="relative">
              <Input
                autoFocus
                type={show ? 'text' : 'password'}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="At least 8 characters"
                className="pr-11"
                required
                disabled={submitting}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-brand transition-colors"
                tabIndex={-1}
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="label-xs">Confirm password</label>
            <Input
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat the new password"
              required
              disabled={submitting}
            />
          </div>
          {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
          <div className="flex justify-between gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !newPw || !confirm}>
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Updating…</>
              ) : (
                <><Check className="w-4 h-4 mr-2" /> Set new password</>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
