import { useEffect } from 'react';
import { setEditingLock } from '../services/storage';

/**
 * Engages the global editing lock while `active` is true.
 *
 * While the lock is held, background SSE/poll refreshes are suppressed in
 * App.tsx so they can't replace the whole app state mid-edit — which would
 * reset an open editor (e.g. a Working Group meeting session being typed) and
 * lose unsaved keystrokes. The lock is reference-counted, so multiple open
 * editors are handled correctly, and it is always released on unmount.
 *
 * Usage:
 *   useEditingLock(isModalOpen);
 */
export const useEditingLock = (active: boolean): void => {
  useEffect(() => {
    if (!active) return;
    setEditingLock(true);
    return () => setEditingLock(false);
  }, [active]);
};
