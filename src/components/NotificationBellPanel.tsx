import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Copy,
  FileSearch,
  MailCheck,
  X,
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { UserNotification } from '../types/platform';

function formatNotificationTime(val: unknown): string {
  const secs = (val as { seconds?: number } | undefined)?.seconds;
  if (typeof secs === 'number') {
    return new Date(secs * 1000).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return 'Just now';
}

interface NotificationBellPanelProps {
  onOpenTrackTicket: (ticketId?: string) => void;
}

export const NotificationBellPanel: React.FC<NotificationBellPanelProps> = ({
  onOpenTrackTicket,
}) => {
  const { userNotifications, markNotificationRead, markAllNotificationsRead } = usePlatform();

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [expandedId, setExpandedId] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string>('');
  const [busyAll, setBusyAll] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = userNotifications.filter((n) => !n.read).length;
  const visibleItems =
    filter === 'unread' ? userNotifications.filter((n) => !n.read) : userNotifications;

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const handleCopyText = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(key);
      setTimeout(() => setCopiedId(''), 1800);
    } catch {
      // Clipboard blocked in iframe fallback ignored cleanly
    }
  };

  const buildReceiptText = (n: UserNotification) =>
    [
      `From: ${n.senderName}`,
      `To: ${n.recipientEmail}`,
      `Subject: ${n.emailSubject}`,
      `Ticket ID: ${n.ticketNumber}`,
      `Estimated Response: ${n.estimatedResponseTime}`,
      `Timestamp: ${formatNotificationTime(n.createdAt)}`,
      '',
      n.message,
    ].join('\n');

  const handleOpenTicket = async (n: UserNotification) => {
    if (!n.read) {
      await markNotificationRead(n.id).catch(() => {});
    }
    setOpen(false);
    onOpenTrackTicket(n.ticketId);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-700 bg-slate-900/90 text-slate-200 hover:border-amber-400/70 hover:text-amber-300 transition-colors"
        aria-label={`Notifications (${unreadCount} unread)`}
        title="Automated Ticket Confirmations & Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-md bg-amber-500 text-slate-950 font-mono text-[10px] font-extrabold tabular-nums flex items-center justify-center border border-slate-950">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute right-3 sm:right-0 top-16 sm:top-11 z-50 w-[calc(100vw-1.5rem)] sm:w-[420px] max-h-[78vh] bg-[#0B111E] border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-slate-800 bg-[#0A101D] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <MailCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <div className="font-display font-bold text-white text-sm truncate">
                  Notifications &amp; Confirmations
                </div>
                <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                  {unreadCount} unread · {userNotifications.length} total
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {unreadCount > 0 && (
                <button
                  type="button"
                  disabled={busyAll}
                  onClick={async () => {
                    setBusyAll(true);
                    try {
                      await markAllNotificationsRead();
                    } finally {
                      setBusyAll(false);
                    }
                  }}
                  className="px-2 py-1 rounded-md border border-slate-700 text-[11px] font-semibold text-slate-300 hover:text-white hover:border-amber-400/60 inline-flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" />
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
                aria-label="Close notifications"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between gap-2 shrink-0 text-xs">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  filter === 'all'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({userNotifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('unread')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  filter === 'unread'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenTrackTicket();
              }}
              className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 underline underline-offset-2"
            >
              Track Tickets →
            </button>
          </div>

          {/* Notification Stream */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80 bg-[#070B14]">
            {visibleItems.length === 0 ? (
              <div className="p-8 text-center space-y-1.5">
                <p className="text-xs font-semibold text-slate-300">
                  {filter === 'unread' ? 'All caught up' : 'No notifications yet'}
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Automated ticket confirmation receipts and status update notices appear here immediately after you submit a support complaint.
                </p>
              </div>
            ) : (
              visibleItems.map((n) => {
                const isExpanded = expandedId === n.id;
                return (
                  <div
                    key={n.id}
                    className={`p-4 space-y-2.5 text-xs transition-colors ${
                      n.read ? 'bg-transparent' : 'bg-amber-500/[0.06]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          {!n.read && (
                            <span
                              className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
                              aria-label="Unread"
                            />
                          )}
                          <span className="font-mono font-bold text-amber-400">
                            {n.ticketNumber}
                          </span>
                          <span className="text-slate-600" aria-hidden="true">·</span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {formatNotificationTime(n.createdAt)}
                          </span>
                        </div>
                        <div className="font-semibold text-white leading-snug">{n.title}</div>
                        <div className="text-[11px] text-slate-400 truncate">
                          Receipt to: <span className="text-slate-300">{n.recipientEmail}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyText(`id_${n.id}`, n.ticketNumber)}
                        className="px-2 py-1 rounded border border-slate-700 text-[10px] font-mono text-slate-300 hover:border-amber-400 hover:text-amber-300 inline-flex items-center gap-1 shrink-0"
                        title="Copy Ticket ID"
                      >
                        {copiedId === `id_${n.id}` ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>ID</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-300 leading-relaxed">
                      {isExpanded ? (
                        <div className="p-3 rounded-lg bg-[#0B111E] border border-slate-800 space-y-2">
                          <div className="space-y-0.5 text-[10px] font-mono text-slate-400 border-b border-slate-800 pb-2">
                            <div>From: {n.senderName}</div>
                            <div>To: {n.recipientEmail}</div>
                            <div>Subject: {n.emailSubject}</div>
                            <div>Estimated SLA: {n.estimatedResponseTime}</div>
                          </div>
                          <p className="whitespace-pre-wrap text-slate-200 leading-relaxed">
                            {n.message}
                          </p>
                          <div className="pt-1 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => handleCopyText(`rec_${n.id}`, buildReceiptText(n))}
                              className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
                            >
                              {copiedId === `rec_${n.id}` ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400">Receipt Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy Confirmation Receipt</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="line-clamp-2 text-slate-300">{n.emailSubject}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={async () => {
                            const next = isExpanded ? '' : n.id;
                            setExpandedId(next);
                            if (!isExpanded && !n.read) {
                              await markNotificationRead(n.id).catch(() => {});
                            }
                          }}
                          className="text-[11px] font-semibold text-slate-300 hover:text-white inline-flex items-center gap-1"
                        >
                          {isExpanded ? (
                            <>
                              Hide Receipt <ChevronUp className="w-3 h-3" />
                            </>
                          ) : (
                            <>
                              View Receipt <ChevronDown className="w-3 h-3" />
                            </>
                          )}
                        </button>
                        {!n.read && (
                          <button
                            type="button"
                            onClick={() => markNotificationRead(n.id).catch(() => {})}
                            className="text-[11px] text-slate-400 hover:text-emerald-300"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenTicket(n)}
                        className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
                      >
                        <FileSearch className="w-3 h-3" />
                        Track Ticket →
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
