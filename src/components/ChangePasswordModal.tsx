/**
 * ChangePasswordModal — self-service password change, available to every role.
 *
 * Flow:
 *  1. User opens the modal from the sidebar user-section (key icon).
 *  2. Fills in current password → new password → confirm new password.
 *  3. On submit: current password is verified with PBKDF2, new one is hashed.
 *  4. onChanged(newHash, newSalt) is called → App.tsx persists the update.
 *
 * Security notes:
 *  - Current password is required to prevent session-hijacking attacks.
 *  - New password must be ≥ 8 chars.
 *  - Uses the same crypto.ts primitives as the admin-forced reset flow.
 */

import React, { useState } from 'react';
import { X, KeyRound, Eye, EyeOff, ShieldCheck, AlertTriangle } from 'lucide-react';
import { User } from '../types';
import { verifyPassword, hashPassword } from '../services/crypto';

interface Props {
  open: boolean;
  currentUser: User;
  onChanged: (newPasswordHash: string, newPasswordSalt: string) => void;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<Props> = ({
  open,
  currentUser,
  onChanged,
  onClose,
}) => {
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleClose = () => {
    setCurrentPwd('');
    setNewPwd('');
    setConfirmPwd('');
    setError(null);
    setSuccess(false);
    setLoading(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // --- client-side validation ---
    if (newPwd.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setError('New passwords do not match.');
      return;
    }
    if (newPwd === currentPwd) {
      setError('New password must be different from the current one.');
      return;
    }

    setLoading(true);

    try {
      // --- verify current password ---
      let verified = false;

      if (currentUser.passwordHash && currentUser.passwordSalt) {
        // Modern PBKDF2 path
        verified = await verifyPassword(currentPwd, currentUser.passwordHash, currentUser.passwordSalt);
      } else if (currentUser.password) {
        // Legacy plaintext fallback (migrated accounts)
        verified = currentPwd === currentUser.password;
      } else {
        // No password stored at all — this shouldn't happen in practice.
        // Fail safely: require re-login.
        setError('No password on record. Please contact an admin to reset your account.');
        setLoading(false);
        return;
      }

      if (!verified) {
        setError('Current password is incorrect.');
        setLoading(false);
        return;
      }

      // --- hash the new password ---
      const { hash, salt } = await hashPassword(newPwd);

      // --- hand off to the caller ---
      onChanged(hash, salt);
      setSuccess(true);
      setLoading(false);

      // Auto-close after brief success display
      setTimeout(handleClose, 1800);
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  // Strength indicator: 0–4 based on length + complexity heuristics
  const strengthScore = (() => {
    if (newPwd.length === 0) return 0;
    let s = 0;
    if (newPwd.length >= 8) s++;
    if (newPwd.length >= 12) s++;
    if (/[A-Z]/.test(newPwd) && /[a-z]/.test(newPwd)) s++;
    if (/[^A-Za-z0-9]/.test(newPwd) || /[0-9]/.test(newPwd)) s++;
    return s;
  })();

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strengthScore];
  const strengthColor = ['', 'bg-red-500', 'bg-yellow-500', 'bg-sky-500', 'bg-emerald-500'][strengthScore];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-ink-900 border border-neutral-200 dark:border-ink-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-ink-700 bg-neutral-50 dark:bg-ink-800">
          <div className="flex items-center gap-3">
            <KeyRound className="w-4 h-4 text-brand" />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em]">
              Change Password
            </span>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center text-muted hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* User context chip */}
          <div className="flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-ink-800 border border-neutral-200 dark:border-ink-600">
            <div className="w-6 h-6 bg-brand text-white flex items-center justify-center text-[9px] font-bold uppercase shrink-0">
              {currentUser.firstName.charAt(0)}{currentUser.lastName.charAt(0)}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] truncate">
              {currentUser.firstName} {currentUser.lastName}
            </span>
            <span className="ml-auto text-[9px] font-mono text-brand uppercase tracking-[0.16em]">
              {currentUser.role}
            </span>
          </div>

          {/* Current password */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                required
                autoFocus
                autoComplete="current-password"
                placeholder="Enter your current password"
                className="w-full h-9 px-3 pr-9 text-[11px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 text-muted hover:text-neutral-700 dark:hover:text-white transition-colors"
              >
                {showCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-neutral-200 dark:border-ink-700" />

          {/* New password */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                className="w-full h-9 px-3 pr-9 text-[11px] border border-neutral-300 dark:border-ink-600 bg-white dark:bg-ink-800 focus:outline-none focus:border-brand transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 text-muted hover:text-neutral-700 dark:hover:text-white transition-colors"
              >
                {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Strength bar */}
            {newPwd.length > 0 && (
              <div className="mt-1.5 space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        i <= strengthScore ? strengthColor : 'bg-neutral-200 dark:bg-ink-600'
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-[9px] font-mono uppercase tracking-[0.14em] ${
                  strengthScore <= 1 ? 'text-red-500' :
                  strengthScore === 2 ? 'text-yellow-500' :
                  strengthScore === 3 ? 'text-sky-500' :
                  'text-emerald-500'
                }`}>
                  {strengthLabel}
                </p>
              </div>
            )}
          </div>

          {/* Confirm new password */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 dark:text-ink-300">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Repeat new password"
                className={`w-full h-9 px-3 pr-9 text-[11px] border bg-white dark:bg-ink-800 focus:outline-none transition-colors ${
                  confirmPwd && confirmPwd !== newPwd
                    ? 'border-red-400 focus:border-red-400'
                    : confirmPwd && confirmPwd === newPwd
                    ? 'border-emerald-400 focus:border-emerald-400'
                    : 'border-neutral-300 dark:border-ink-600 focus:border-brand'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 text-muted hover:text-neutral-700 dark:hover:text-white transition-colors"
              >
                {showConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {confirmPwd && confirmPwd !== newPwd && (
              <p className="text-[9px] text-red-500 font-mono">Passwords do not match</p>
            )}
          </div>

          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Success banner */}
          {success && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-[0.14em]">
                Password updated successfully!
              </p>
            </div>
          )}

          {/* Actions */}
          {!success && (
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 h-9 text-[10px] font-bold uppercase tracking-[0.14em] border border-neutral-300 dark:border-ink-600 text-neutral-600 dark:text-ink-300 hover:border-neutral-400 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !currentPwd || newPwd.length < 8 || newPwd !== confirmPwd}
                className="flex-1 h-9 text-[10px] font-bold uppercase tracking-[0.14em] bg-brand text-white hover:bg-brand/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
