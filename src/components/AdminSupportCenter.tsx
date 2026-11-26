import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Headphones,
  MailCheck,
  MessageSquare,
  RefreshCw,
  Save,
  Send,
  Ticket,
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { DEFAULT_SUPPORT_AUTO_RESPONDER } from '../constants/defaults';
import { usePlatform } from '../context/PlatformContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  clearGoogleChatToken,
  connectGoogleChatAccount,
  getGoogleChatAccessToken,
  GOOGLE_CHAT_CONFIG_URL,
  GoogleChatApiError,
  GoogleChatMessage,
  GoogleChatSpace,
  initGoogleChatAuth,
  listGoogleChatMessages,
  listGoogleChatSpaces,
  postGoogleChatMessage,
} from '../lib/googleChat';
import {
  SupportAutoResponderConfig,
  SupportChatMessage,
  SupportChatThread,
  SupportTicket,
  SupportTicketStatus,
} from '../types/platform';

const ADMIN_QUICK_REPLIES = [
  'Hello! Thank you for contacting Alphatradex Support. How can I assist you today?',
  'Your crypto deposit has been verified and credited to your Deposit Wallet.',
  'Your KYC identity and phone verification have been approved.',
  'Your withdrawal payout has been processed. Please check the TXID note in your wallet history.',
  'Could you please share your TxID or Package # so we can verify this right away?',
  'This issue has been resolved. Please let us know if you need any further assistance.',
];

function formatTs(val: unknown): string {
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

interface AdminSupportCenterProps {
  chatThreads: SupportChatThread[];
  tickets: SupportTicket[];
  onNotify: (type: 'ok' | 'err', text: string) => void;
}

export const AdminSupportCenter: React.FC<AdminSupportCenterProps> = ({
  chatThreads,
  tickets,
  onNotify,
}) => {
  const {
    platformConfig,
    updatePlatformConfig,
    sendAdminSupportReply,
    markAdminChatRead,
    setSupportChatStatus,
    updateSupportTicket,
  } = usePlatform();

  const [subTab, setSubTab] = useState<'chats' | 'tickets' | 'auto-responder' | 'google-chat'>('chats');
  const [selectedUid, setSelectedUid] = useState<string>('');
  const [threadMessages, setThreadMessages] = useState<SupportChatMessage[]>([]);
  const [replyDraft, setReplyDraft] = useState('');
  const [busy, setBusy] = useState(false);

  // Automated Ticket Response config draft
  const [autoDraft, setAutoDraft] = useState<SupportAutoResponderConfig>(() => ({
    ...DEFAULT_SUPPORT_AUTO_RESPONDER,
    ...(platformConfig.supportAutoResponder || {}),
  }));
  const [savingAuto, setSavingAuto] = useState(false);

  useEffect(() => {
    setAutoDraft({
      ...DEFAULT_SUPPORT_AUTO_RESPONDER,
      ...(platformConfig.supportAutoResponder || {}),
    });
  }, [platformConfig.supportAutoResponder]);

  // Tickets state
  const [ticketFilter, setTicketFilter] = useState<'open' | 'in_progress' | 'resolved' | 'closed' | 'all'>('open');
  const [ticketReplyDrafts, setTicketReplyDrafts] = useState<Record<string, string>>({});
  const [ticketStatusDrafts, setTicketStatusDrafts] = useState<Record<string, SupportTicketStatus>>({});

  // Google Chat Workspace Integration state (token strictly in memory)
  const [gchatToken, setGchatToken] = useState<string | null>(() => getGoogleChatAccessToken());
  const [gchatAccountEmail, setGchatAccountEmail] = useState<string>('');
  const [gchatConnecting, setGchatConnecting] = useState(false);
  const [gchatLoading, setGchatLoading] = useState(false);
  const [gchatError, setGchatError] = useState<{
    message: string;
    isAppNotConfigured?: boolean;
    isWorkspaceRequired?: boolean;
  } | null>(null);
  const [gchatSpaces, setGchatSpaces] = useState<GoogleChatSpace[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<string>('');
  const [gchatMessages, setGchatMessages] = useState<GoogleChatMessage[]>([]);
  const [gchatDraft, setGchatDraft] = useState('');

  // Mandatory explicit confirmation modal before any Google Chat write/post
  const [pendingGoogleChatSend, setPendingGoogleChatSend] = useState<{
    spaceName: string;
    spaceLabel: string;
    text: string;
  } | null>(null);

  const msgEndRef = useRef<HTMLDivElement | null>(null);

  // Sync in-memory Google Chat auth state
  useEffect(() => {
    const unsub = initGoogleChatAuth(
      (user, token) => {
        setGchatToken(token);
        setGchatAccountEmail(user.email || '');
      },
      () => {
        setGchatToken(null);
        setGchatAccountEmail('');
        setGchatSpaces([]);
        setGchatMessages([]);
      }
    );
    return () => unsub();
  }, []);

  // Auto-select first chat thread if none selected
  useEffect(() => {
    if (!selectedUid && chatThreads.length > 0) {
      setSelectedUid(chatThreads[0].uid);
    }
  }, [chatThreads, selectedUid]);

  const activeThread = chatThreads.find((t) => t.uid === selectedUid) || null;

  // Listen to messages for the currently selected client thread
  useEffect(() => {
    if (!selectedUid) {
      setThreadMessages([]);
      return;
    }
    const q = query(
      collection(db, 'supportChats', selectedUid, 'messages'),
      where('uid', '==', selectedUid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SupportChatMessage, 'id'>),
        }));
        list.sort(
          (a, b) =>
            ((a.createdAt as { seconds?: number })?.seconds || 0) -
            ((b.createdAt as { seconds?: number })?.seconds || 0)
        );
        setThreadMessages(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `supportChats/${selectedUid}/messages`)
    );
    return () => unsub();
  }, [selectedUid]);

  useEffect(() => {
    if (subTab === 'chats' && activeThread && activeThread.unreadByAdmin > 0) {
      markAdminChatRead(activeThread.uid).catch(() => {
        // ignore concurrent update
      });
    }
  }, [subTab, activeThread, markAdminChatRead]);

  useEffect(() => {
    if (subTab === 'chats') {
      msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [subTab, threadMessages.length]);

  const loadGoogleSpaces = async (token: string) => {
    setGchatLoading(true);
    setGchatError(null);
    try {
      const spaces = await listGoogleChatSpaces(token);
      setGchatSpaces(spaces);
      if (spaces.length > 0) {
        const nextSpace = selectedSpace && spaces.some((s) => s.name === selectedSpace)
          ? selectedSpace
          : spaces[0].name;
        setSelectedSpace(nextSpace);
        const msgs = await listGoogleChatMessages(token, nextSpace);
        setGchatMessages(msgs);
      } else {
        setGchatMessages([]);
      }
    } catch (err) {
      if (err instanceof GoogleChatApiError) {
        setGchatError({
          message: err.message,
          isAppNotConfigured: err.isAppNotConfigured,
          isWorkspaceRequired: err.isWorkspaceRequired,
        });
      } else {
        setGchatError({
          message: err instanceof Error ? err.message : 'Failed to load Google Chat spaces.',
        });
      }
    } finally {
      setGchatLoading(false);
    }
  };

  const handleConnectGoogleChat = async () => {
    setGchatConnecting(true);
    setGchatError(null);
    try {
      const { user, accessToken } = await connectGoogleChatAccount();
      setGchatToken(accessToken);
      setGchatAccountEmail(user.email || '');
      await loadGoogleSpaces(accessToken);
    } catch (err) {
      setGchatError({
        message: err instanceof Error ? err.message : 'Google Chat sign-in cancelled or failed.',
      });
    } finally {
      setGchatConnecting(false);
    }
  };

  const handleSelectGoogleSpace = async (spaceName: string) => {
    setSelectedSpace(spaceName);
    if (!gchatToken) return;
    setGchatLoading(true);
    setGchatError(null);
    try {
      const msgs = await listGoogleChatMessages(gchatToken, spaceName);
      setGchatMessages(msgs);
    } catch (err) {
      if (err instanceof GoogleChatApiError) {
        setGchatError({
          message: err.message,
          isAppNotConfigured: err.isAppNotConfigured,
          isWorkspaceRequired: err.isWorkspaceRequired,
        });
      } else {
        setGchatError({
          message: err instanceof Error ? err.message : 'Unable to fetch messages for this space.',
        });
      }
    } finally {
      setGchatLoading(false);
    }
  };

  const requestGoogleChatPost = (text: string) => {
    if (!gchatToken || !selectedSpace) {
      setSubTab('google-chat');
      onNotify('err', 'Connect Google Chat and select a Space first to forward messages.');
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;
    const spaceObj = gchatSpaces.find((s) => s.name === selectedSpace);
    setPendingGoogleChatSend({
      spaceName: selectedSpace,
      spaceLabel: spaceObj?.displayName || selectedSpace,
      text: trimmed,
    });
  };

  const confirmGoogleChatPost = async () => {
    if (!pendingGoogleChatSend || !gchatToken) return;
    setBusy(true);
    setGchatError(null);
    try {
      await postGoogleChatMessage(
        gchatToken,
        pendingGoogleChatSend.spaceName,
        pendingGoogleChatSend.text
      );
      setPendingGoogleChatSend(null);
      setGchatDraft('');
      onNotify('ok', `Message sent to Google Chat space "${pendingGoogleChatSend.spaceLabel}".`);
      const msgs = await listGoogleChatMessages(gchatToken, pendingGoogleChatSend.spaceName);
      setGchatMessages(msgs);
    } catch (err) {
      if (err instanceof GoogleChatApiError) {
        setGchatError({
          message: err.message,
          isAppNotConfigured: err.isAppNotConfigured,
          isWorkspaceRequired: err.isWorkspaceRequired,
        });
      }
      onNotify('err', err instanceof Error ? err.message : 'Failed to post message to Google Chat.');
      setPendingGoogleChatSend(null);
    } finally {
      setBusy(false);
    }
  };

  const totalUnreadChats = chatThreads.reduce((s, t) => s + Number(t.unreadByAdmin || 0), 0);
  const openTicketsCount = tickets.filter(
    (t) => t.status === 'open' || t.status === 'in_progress'
  ).length;
  const filteredTickets = tickets.filter((t) =>
    ticketFilter === 'all' ? true : t.status === ticketFilter
  );

  return (
    <section className="space-y-5">
      {/* Sub-Navigation Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
            <Headphones className="w-4 h-4 text-orange-600" />
            Live Support Chat, Complaint Tickets &amp; Google Chat Bridge
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Respond to vault clients in real time, resolve complaint tickets, or escalate cases to a Google Workspace Chat space.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100">
          <button
            type="button"
            onClick={() => setSubTab('chats')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
              subTab === 'chats'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Live Chat Inbox ({chatThreads.length})</span>
            {totalUnreadChats > 0 && (
              <span className="font-mono text-[10px] font-bold text-orange-600">
                · {totalUnreadChats} unread
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('tickets')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
              subTab === 'tickets'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>Complaint Tickets ({openTicketsCount} open)</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('auto-responder')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
              subTab === 'auto-responder'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MailCheck className="w-3.5 h-3.5" />
            <span>Auto-Responder</span>
            <span
              className={`font-mono text-[10px] font-bold ${
                autoDraft.enabled ? 'text-emerald-600' : 'text-slate-400'
              }`}
            >
              · {autoDraft.enabled ? 'ON' : 'OFF'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('google-chat')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
              subTab === 'google-chat'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Google Chat Sync</span>
            {gchatToken && <span className="text-emerald-600 font-bold">· Connected</span>}
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: LIVE CHAT INBOX */}
      {subTab === 'chats' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Threads List */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col max-h-[620px]">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-700">
              Client Conversations ({chatThreads.length})
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {chatThreads.length === 0 ? (
                <p className="p-6 text-xs text-slate-500 text-center">
                  No client live chat conversations yet.
                </p>
              ) : (
                chatThreads.map((thread) => {
                  const active = thread.uid === selectedUid;
                  return (
                    <button
                      key={thread.uid}
                      type="button"
                      onClick={() => setSelectedUid(thread.uid)}
                      className={`w-full p-3.5 text-left transition-colors space-y-1 ${
                        active ? 'bg-orange-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-xs text-slate-900 truncate">
                          {thread.userName}{' '}
                          <span className="font-mono text-slate-500">({thread.userHandle})</span>
                        </span>
                        {thread.unreadByAdmin > 0 ? (
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-600 text-white shrink-0">
                            {thread.unreadByAdmin}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {thread.status}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {thread.lastSender === 'admin' ? 'You: ' : ''}
                        {thread.lastMessage}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {formatTs(thread.updatedAt)}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Conversation Pane */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col h-[620px]">
            {!activeThread ? (
              <div className="flex-1 flex items-center justify-center p-8 text-xs text-slate-500">
                Select a client conversation on the left to view messages and reply.
              </div>
            ) : (
              <>
                <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-display font-bold text-slate-900 text-sm">
                      {activeThread.userName}{' '}
                      <span className="font-mono text-xs text-orange-600">
                        ({activeThread.userHandle})
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {activeThread.userEmail} · Status: {activeThread.status}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        requestGoogleChatPost(
                          `[Alphatradex Live Chat Summary]\nClient: ${activeThread.userName} (${activeThread.userHandle} / ${activeThread.userEmail})\nStatus: ${activeThread.status}\nLatest Message: ${activeThread.lastMessage}`
                        )
                      }
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
                    >
                      Forward to Google Chat
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const nextStatus =
                            activeThread.status === 'resolved' ? 'open' : 'resolved';
                          await setSupportChatStatus(activeThread.uid, nextStatus);
                          onNotify('ok', `Chat marked as ${nextStatus}.`);
                        } catch (err) {
                          onNotify('err', err instanceof Error ? err.message : 'Status update failed.');
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg font-semibold ${
                        activeThread.status === 'resolved'
                          ? 'bg-slate-900 text-white hover:bg-slate-800'
                          : 'bg-emerald-600 text-white hover:bg-emerald-500'
                      }`}
                    >
                      {activeThread.status === 'resolved' ? 'Reopen Chat' : 'Mark Resolved'}
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                  {threadMessages.map((msg) => {
                    const isAdmin = msg.senderRole === 'admin';
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                      >
                        <div className="text-[11px] text-slate-500 mb-1 px-1 flex items-center gap-2">
                          <span className="font-semibold text-slate-700">
                            {isAdmin ? 'Support Desk (You)' : msg.senderName}
                          </span>
                          {msg.topicTag && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-orange-600 font-medium">{msg.topicTag}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-[10px]">{formatTs(msg.createdAt)}</span>
                        </div>
                        <div
                          className={`max-w-[82%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap break-words ${
                            isAdmin
                              ? 'bg-slate-900 text-white'
                              : 'bg-white border border-slate-200 text-slate-800'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={msgEndRef} />
                </div>

                {/* Admin Quick Reply Suggestions + Composer */}
                <div className="p-3.5 border-t border-slate-200 bg-white space-y-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {ADMIN_QUICK_REPLIES.map((qr, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setReplyDraft(qr)}
                        className="px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:border-orange-400 text-[11px] text-slate-700 truncate max-w-[240px]"
                        title={qr}
                      >
                        {qr}
                      </button>
                    ))}
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!replyDraft.trim() || !activeThread) return;
                      setBusy(true);
                      try {
                        await sendAdminSupportReply(
                          {
                            uid: activeThread.uid,
                            fullName: activeThread.userName,
                            email: activeThread.userEmail,
                            handle: activeThread.userHandle,
                          },
                          replyDraft
                        );
                        setReplyDraft('');
                      } catch (err) {
                        onNotify('err', err instanceof Error ? err.message : 'Failed to send reply.');
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="flex items-end gap-2"
                  >
                    <textarea
                      rows={2}
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      placeholder="Write a live reply to this client..."
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs resize-none focus:outline-none focus:border-orange-500"
                    />
                    <button
                      type="submit"
                      disabled={busy || !replyDraft.trim()}
                      className="px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send Reply
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: COMPLAINT TICKETS DESK */}
      {subTab === 'tickets' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display font-bold text-slate-900 text-base">
              Client Complaint Tickets ({filteredTickets.length})
            </h3>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {(['open', 'in_progress', 'resolved', 'closed', 'all'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setTicketFilter(st)}
                  className={`px-3 py-1.5 rounded-lg font-semibold capitalize border ${
                    ticketFilter === st
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {st.replace('_', ' ')} (
                  {st === 'all' ? tickets.length : tickets.filter((t) => t.status === st).length})
                </button>
              ))}
            </div>
          </div>

          {filteredTickets.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">
              No complaint tickets match the selected status filter.
            </p>
          ) : (
            <div className="space-y-4">
              {filteredTickets.map((tkt) => {
                const draftStatus = ticketStatusDrafts[tkt.id] ?? tkt.status;
                const draftReply = ticketReplyDrafts[tkt.id] ?? (tkt.adminReply || '');
                return (
                  <div
                    key={tkt.id}
                    className="p-4 rounded-xl border border-slate-200 space-y-3 text-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-semibold text-slate-900 text-sm">
                          <span className="font-mono text-orange-600 mr-2">{tkt.ticketNumber}</span>
                          {tkt.subject}
                        </div>
                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2">
                          <span className="font-semibold text-slate-700">
                            {tkt.userName} ({tkt.userHandle})
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{tkt.userEmail}</span>
                          <span aria-hidden="true">·</span>
                          <span className="capitalize">{tkt.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className="capitalize font-semibold text-slate-700">
                            Priority: {tkt.priority}
                          </span>
                          {tkt.referenceId && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono text-slate-700">Ref: {tkt.referenceId}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{formatTs(tkt.createdAt)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          requestGoogleChatPost(
                            `[Complaint Ticket ${tkt.ticketNumber} · ${tkt.priority.toUpperCase()}]\nClient: ${tkt.userName} (${tkt.userHandle})\nCategory: ${tkt.category}${tkt.referenceId ? `\nRef: ${tkt.referenceId}` : ''}\nSubject: ${tkt.subject}\nDetails: ${tkt.description}`
                          )
                        }
                        className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold shrink-0"
                      >
                        Escalate to Google Chat
                      </button>
                    </div>

                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                      {tkt.description}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-start pt-1">
                      <div className="md:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Ticket Status
                        </label>
                        <select
                          value={draftStatus}
                          onChange={(e) =>
                            setTicketStatusDrafts((prev) => ({
                              ...prev,
                              [tkt.id]: e.target.value as SupportTicketStatus,
                            }))
                          }
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-semibold"
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>
                      <div className="md:col-span-7">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Official Admin Resolution / Reply
                        </label>
                        <input
                          type="text"
                          value={draftReply}
                          onChange={(e) =>
                            setTicketReplyDrafts((prev) => ({ ...prev, [tkt.id]: e.target.value }))
                          }
                          placeholder="Write official response visible to client on this ticket..."
                          className="w-full px-3 py-2 rounded-lg border border-slate-200"
                        />
                      </div>
                      <div className="md:col-span-2 md:pt-5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await updateSupportTicket(tkt.id, {
                                status: draftStatus,
                                adminReply: draftReply,
                              });
                              onNotify('ok', `Updated ticket ${tkt.ticketNumber} (${draftStatus}).`);
                            } catch (err) {
                              onNotify(
                                'err',
                                err instanceof Error ? err.message : 'Ticket update failed.'
                              );
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold inline-flex items-center justify-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Update
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: AUTOMATED TICKET RESPONSE SYSTEM */}
      {subTab === 'auto-responder' && (() => {
        const previewVars = (tpl: string) =>
          tpl
            .replace(/\{\{ticketNumber\}\}/g, 'TKT-849201')
            .replace(/\{\{userName\}\}/g, 'Alex Carter')
            .replace(/\{\{subject\}\}/g, 'Deposit not credited to Deposit Wallet')
            .replace(/\{\{category\}\}/g, 'DEPOSIT')
            .replace(/\{\{priority\}\}/g, 'HIGH')
            .replace(/\{\{referenceId\}\}/g, 'TX9984210')
            .replace(/\{\{referenceLine\}\}/g, ' · Ref: TX9984210')
            .replace(/\{\{sla\}\}/g, autoDraft.slaHigh || 'Within 6 hours')
            .replace(/\{\{companyName\}\}/g, platformConfig.companyName || 'Alphatradex');

        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-5 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
                    <MailCheck className="w-4 h-4 text-orange-600" />
                    Automated Ticket Confirmation System
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Immediately dispatches a persistent confirmation receipt &amp; notification with the generated Ticket ID when a client submits a complaint.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={savingAuto}
                  onClick={async () => {
                    setSavingAuto(true);
                    try {
                      await updatePlatformConfig({
                        ...platformConfig,
                        supportAutoResponder: autoDraft,
                      });
                      onNotify('ok', 'Automated ticket response settings saved.');
                    } catch (err) {
                      onNotify(
                        'err',
                        err instanceof Error ? err.message : 'Failed to save auto-responder config.'
                      );
                    } finally {
                      setSavingAuto(false);
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold inline-flex items-center gap-1.5 shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingAuto ? 'Saving...' : 'Save Settings'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoDraft.enabled}
                    onChange={(e) =>
                      setAutoDraft((prev) => ({ ...prev, enabled: e.target.checked }))
                    }
                    className="mt-0.5 rounded border-slate-300"
                  />
                  <div>
                    <div className="font-semibold text-slate-900">Instant Receipt Confirmation</div>
                    <div className="text-[11px] text-slate-500">
                      Send confirmation receipt &amp; Ticket ID immediately after submission.
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoDraft.notifyOnStatusChange}
                    onChange={(e) =>
                      setAutoDraft((prev) => ({
                        ...prev,
                        notifyOnStatusChange: e.target.checked,
                      }))
                    }
                    className="mt-0.5 rounded border-slate-300"
                  />
                  <div>
                    <div className="font-semibold text-slate-900">Status Update Notifications</div>
                    <div className="text-[11px] text-slate-500">
                      Notify client whenever ticket moves to In Progress or Resolved.
                    </div>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sender Name</label>
                  <input
                    type="text"
                    maxLength={120}
                    value={autoDraft.senderName}
                    onChange={(e) =>
                      setAutoDraft((prev) => ({ ...prev, senderName: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Confirmation Subject Template
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={autoDraft.subjectTemplate}
                    onChange={(e) =>
                      setAutoDraft((prev) => ({ ...prev, subjectTemplate: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <label className="font-semibold text-slate-700">
                    Automated Confirmation Body Template
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Tokens: {'{{ticketNumber}} {{userName}} {{category}} {{priority}} {{sla}} {{companyName}}'}
                  </span>
                </div>
                <textarea
                  rows={7}
                  maxLength={2000}
                  value={autoDraft.bodyTemplate}
                  onChange={(e) =>
                    setAutoDraft((prev) => ({ ...prev, bodyTemplate: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-[11px] leading-relaxed"
                />
              </div>

              <div className="space-y-2">
                <div className="font-semibold text-slate-700">Priority Response Time SLAs</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Urgent</label>
                    <input
                      type="text"
                      maxLength={80}
                      value={autoDraft.slaUrgent}
                      onChange={(e) =>
                        setAutoDraft((prev) => ({ ...prev, slaUrgent: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">High</label>
                    <input
                      type="text"
                      maxLength={80}
                      value={autoDraft.slaHigh}
                      onChange={(e) =>
                        setAutoDraft((prev) => ({ ...prev, slaHigh: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Medium</label>
                    <input
                      type="text"
                      maxLength={80}
                      value={autoDraft.slaMedium}
                      onChange={(e) =>
                        setAutoDraft((prev) => ({ ...prev, slaMedium: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Low</label>
                    <input
                      type="text"
                      maxLength={80}
                      value={autoDraft.slaLow}
                      onChange={(e) =>
                        setAutoDraft((prev) => ({ ...prev, slaLow: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Live Confirmation Preview */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4 text-xs">
              <div className="font-display font-bold text-slate-900 text-sm">
                Live Client Confirmation Preview
              </div>
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="space-y-1 font-mono text-[11px] text-slate-600 border-b border-slate-200 pb-3">
                  <div>
                    <span className="text-slate-400">From:</span>{' '}
                    <span className="font-semibold text-slate-800">{autoDraft.senderName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">To:</span> alex.carter@example.com
                  </div>
                  <div>
                    <span className="text-slate-400">Subject:</span>{' '}
                    <span className="font-semibold text-slate-900">
                      {previewVars(autoDraft.subjectTemplate)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Ticket ID:</span>{' '}
                    <span className="font-bold text-orange-600">TKT-849201</span>
                  </div>
                </div>
                <div className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {previewVars(autoDraft.bodyTemplate)}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* SUB-TAB 4: GOOGLE CHAT WORKSPACE INTEGRATION */}
      {subTab === 'google-chat' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <h3 className="font-display font-bold text-slate-900 text-base">
                Google Chat Workspace Support Sync
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Connect your Business or Enterprise Google Workspace account to browse Google Chat Spaces, monitor support room messages, and forward client complaints directly to your team. Consumer @gmail.com accounts are not supported by the Google Chat API, and the Google Chat app must be configured once in Google Cloud Console.
              </p>
            </div>

            {!gchatToken ? (
              <button
                type="button"
                disabled={gchatConnecting}
                onClick={handleConnectGoogleChat}
                className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold shadow-sm transition-colors shrink-0"
              >
                <svg
                  className="w-4 h-4 shrink-0"
                  viewBox="0 0 48 48"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                <span>{gchatConnecting ? 'Connecting...' : 'Sign in with Google'}</span>
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono text-slate-600">{gchatAccountEmail || 'Connected'}</span>
                <button
                  type="button"
                  disabled={gchatLoading}
                  onClick={() => loadGoogleSpaces(gchatToken)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh Spaces
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearGoogleChatToken();
                    setGchatToken(null);
                    setGchatSpaces([]);
                    setGchatMessages([]);
                    setSelectedSpace('');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 font-semibold"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>

          {gchatError && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2">
              <div className="flex items-start gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{gchatError.message}</span>
              </div>
              {gchatError.isAppNotConfigured && (
                <p className="text-amber-900">
                  One-time setup required: Open the{' '}
                  <a
                    href={GOOGLE_CHAT_CONFIG_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline inline-flex items-center gap-1"
                  >
                    Google Chat API Configuration page <ExternalLink className="w-3 h-3" />
                  </a>
                  , fill in App name, Avatar URL, and Description, save, then click Refresh Spaces.
                </p>
              )}
              {gchatError.isWorkspaceRequired && (
                <p className="text-amber-900">
                  Google Chat API user access requires a Google Workspace Business or Enterprise account (consumer @gmail.com accounts are not supported). Built-in Live Support Chat and Complaint Tickets continue working for all users automatically.
                </p>
              )}
            </div>
          )}

          {gchatToken && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-4 border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                  Google Chat Spaces ({gchatSpaces.length})
                </div>
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {gchatSpaces.length === 0 ? (
                    <p className="p-4 text-xs text-slate-500">
                      {gchatLoading ? 'Loading spaces...' : 'No spaces found.'}
                    </p>
                  ) : (
                    gchatSpaces.map((sp) => (
                      <button
                        key={sp.name}
                        type="button"
                        onClick={() => handleSelectGoogleSpace(sp.name)}
                        className={`w-full px-3.5 py-2.5 text-left text-xs transition-colors ${
                          selectedSpace === sp.name
                            ? 'bg-orange-50 font-semibold text-slate-900'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="truncate">{sp.displayName || sp.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {sp.spaceType || sp.type || 'SPACE'}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="lg:col-span-8 border border-slate-200 rounded-xl flex flex-col h-96 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                  Recent Space Messages
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2.5 text-xs">
                  {gchatMessages.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">
                      {gchatLoading ? 'Loading messages...' : 'No messages loaded in this space.'}
                    </p>
                  ) : (
                    gchatMessages.map((m) => (
                      <div key={m.name} className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                          <span className="font-semibold text-slate-800">
                            {m.sender?.displayName || m.sender?.name || 'Member'}
                          </span>
                          <span className="font-mono text-[10px]">
                            {m.createTime ? new Date(m.createTime).toLocaleString() : ''}
                          </span>
                        </div>
                        <div className="text-slate-800 whitespace-pre-wrap">{m.text || '(attachment)'}</div>
                      </div>
                    ))
                  )}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    requestGoogleChatPost(gchatDraft);
                  }}
                  className="p-3 border-t border-slate-200 bg-white flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={gchatDraft}
                    onChange={(e) => setGchatDraft(e.target.value)}
                    placeholder="Write a message to post to the selected Google Chat space..."
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={!selectedSpace || !gchatDraft.trim()}
                    className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send to Space
                  </button>
                </form>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
            <span>Google Chat App Configuration Console:</span>
            <a
              href={GOOGLE_CHAT_CONFIG_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-600 hover:underline font-mono inline-flex items-center gap-1"
            >
              Open Google Cloud Chat API Configuration <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* Mandatory Explicit Confirmation Dialog before posting to Google Chat */}
      {pendingGoogleChatSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-[#0B111E] px-5 py-4 text-white font-display font-bold text-sm">
              Confirm Sending Message to Google Chat
            </div>
            <div className="p-5 space-y-4 text-xs text-slate-700">
              <p>
                You are about to post a message on your behalf to the Google Chat Space{' '}
                <strong className="text-slate-900">{pendingGoogleChatSend.spaceLabel}</strong>:
              </p>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-800 whitespace-pre-wrap max-h-48 overflow-y-auto">
                {pendingGoogleChatSend.text}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPendingGoogleChatSend(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={confirmGoogleChatPost}
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold"
                >
                  {busy ? 'Sending...' : 'Confirm & Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
