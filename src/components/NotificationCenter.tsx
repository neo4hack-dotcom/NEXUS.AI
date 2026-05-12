import React from 'react';
import { X, AlertTriangle, CheckCircle2, Clock, Inbox } from 'lucide-react';
import { AppNotification } from '../types';
import { Button } from './ui/Button';

interface Props {
  open: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onDismiss: (id: string) => void;
  onMarkAllRead: () => void;
}

const iconFor = (type: AppNotification['type']) => {
  switch (type) {
    case 'stale_project':
      return <Clock className="w-4 h-4 text-amber-500" />;
    case 'task_slipping':
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    case 'report_overdue':
      return <Inbox className="w-4 h-4 text-amber-500" />;
    case 'milestone_reached':
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    default:
      return <Inbox className="w-4 h-4 text-muted" />;
  }
};

export const NotificationCenter: React.FC<Props> = ({
  open,
  onClose,
  notifications,
  onDismiss,
  onMarkAllRead,
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[440px] max-w-full h-full surface border-l overflow-y-auto animate-slide-up">
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 surface border-b">
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight">Notifications</h2>
            <p className="text-[10px] text-muted uppercase tracking-[0.16em]">
              {notifications.length} alert{notifications.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <Button variant="outline" size="sm" onClick={onMarkAllRead}>
                Mark all read
              </Button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center hover:text-brand transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-3 space-y-2">
          {notifications.length === 0 && (
            <div className="text-center py-16 text-muted">
              <Inbox className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-xs uppercase tracking-[0.16em]">All clear.</p>
            </div>
          )}
          {notifications.map((n) => (
            <div
              key={n.id}
              className="p-4 surface-flat border flex items-start gap-3"
            >
              <div className="mt-0.5">{iconFor(n.type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold leading-tight">{n.message}</p>
                {n.details && (
                  <p className="text-xs text-muted mt-1 leading-snug">{n.details}</p>
                )}
                <p className="text-[9px] uppercase tracking-[0.18em] text-muted mt-2 font-mono">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => onDismiss(n.id)}
                className="text-muted hover:text-red-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
