import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileSearch,
  FileWarning,
  Headphones,
  MailCheck,
  MessageSquare,
  Send,
  Ticket,
  X,
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import {
  SupportTicketCategory,
  SupportTicketPriority,
  TicketConfirmationReceipt,
} from '../types/platform';

interface QuickChatSuggestion {
  id: string;
  label: string;
  topicTag: string;
  message: string;
}

const CHAT_SUGGESTIONS: QuickChatSuggestion[] = [
  {
    id: 'deposit_pending',
    label: 'Deposit Not Credited',
    topicTag: 'Deposit',
    message:
      'Hello Support, I submitted a deposit and it is still pending. Please verify my TxID and credit my Deposit Wallet.',
  },
  {
    id: 'withdraw_delay',
    label: 'Withdrawal Status / TXID',
    topicTag: 'Withdrawal',
    message:
      'Hello Support, please check the status and payout TXID for my withdrawal request.',
  },
  {
    id: 'kyc_review',
    label: 'KYC & Phone Approval',
    topicTag: 'KYC',
    message:
      'Hello Support, I have submitted my KYC documents and phone number. Please review and approve my verification.',
  },
  {
    id: 'ai_profit',
    label: 'AI Package / Weekday Profit',
    topicTag: 'AI Trading',
    message:
      'Hello Support, I have a question about my active AI Trading package and daily weekday profit credit.',
  },
  {
    id: 'forex_help',
    label: 'Forex / Copy Trade Help',
    topicTag: 'Forex',
    message:
      'Hello Support, I need assistance with my Forex WebTerminal trade or Copy Trade subscription.',
  },
  {
    id: 'p2p_issue',
    label: 'P2P Transfer Issue',
    topicTag: 'P2P Transfer',
    message:
      'Hello Support, I need help checking a P2P USD wallet transfer between accounts.',
  },
  {
    id: 'account_security',
    label: 'Account / Security Help',
    topicTag: 'Account',
    message:
      'Hello Support, I need help updating my profile email, phone number, or account security settings.',
  },
];

interface TicketPreset {
  id: string;
  label: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  subject: string;
  description: string;
}

const TICKET_PRESETS: TicketPreset[] = [
  {
    id: 't_dep',
    label: 'Missing Deposit',
    category: 'deposit',
    priority: 'high',
    subject: 'Deposit not credited to Deposit Wallet',
    description:
      'I sent my crypto deposit using the official wallet address, but the USD balance has not been credited yet. Amount sent: $___ | Network: ___ | Time: ___.',
  },
  {
    id: 't_wd',
    label: 'Withdrawal Delay',
    category: 'withdrawal',
    priority: 'high',
    subject: 'Withdrawal payout pending or delayed',
    description:
      'My profit or capital withdrawal request is taking longer than expected. Requested amount: $___ | Receiving wallet/account: ___. Please check and update TXID.',
  },
  {
    id: 't_kyc',
    label: 'KYC / Phone Verification',
    category: 'kyc',
    priority: 'medium',
    subject: 'KYC document or phone verification review needed',
    description:
      'I uploaded my ID and portrait photos for KYC verification. Please review my submission and let me know if any additional document is required.',
  },
  {
    id: 't_profit',
    label: 'Wrong Profit / Package Issue',
    category: 'trading',
    priority: 'high',
    subject: 'AI Trading package profit or claim discrepancy',
    description:
      'I noticed an issue with my AI Trading package profit calculation or claim button. Package #: ___ | Expected amount: $___.',
  },
  {
    id: 't_forex',
    label: 'Forex / Copy Trade Dispute',
    category: 'forex',
    priority: 'medium',
    subject: 'Forex WebTerminal or Copy Trade issue',
    description:
      'I am reporting an issue with my Forex order execution or Copy Trade allocation. Symbol / Trader: ___ | Details: ___.',
  },
  {
    id: 't_p2p',
    label: 'P2P Transfer Dispute',
    category: 'p2p',
    priority: 'high',
    subject: 'P2P USD transfer verification request',
    description:
      'I sent or expected a P2P USD transfer and need verification. Counterparty Handle/Email: ___ | Amount: $___.',
  },
];

function formatSupportTime(val: unknown): string {
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

interface ClientSupportDeskProps {
  mode: 'full' | 'floating';
  onNotify?: (type: 'ok' | 'err', text: string) => void;
  onOpenTrackTicket?: (ticketId?: string) => void;
  onTicketConfirmed?: (receipt: TicketConfirmationReceipt) => void;
}

export const ClientSupportDesk: React.FC<ClientSupportDeskProps> = ({
  mode,
  onNotify,
  onOpenTrackTicket,
  onTicketConfirmed,
}) => {
  const {
    userProfile,
    platformConfig,
    supportChatThread,
    supportChatMessages,
    supportTickets,
    sendClientSupportMessage,
    markClientChatRead,
    createSupportTicket,
  } = usePlatform();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'tickets'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [localBanner, setLocalBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [latestReceipt, setLatestReceipt] = useState<TicketConfirmationReceipt | null>(null);
  const [copiedReceiptKey, setCopiedReceiptKey] = useState<string>('');

  // Complaint ticket form state
  const [category, setCategory] = useState<SupportTicketCategory>('deposit');
  const [priority, setPriority] = useState<SupportTicketPriority>('medium');
  const [subject, setSubject] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [description, setDescription] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = Number(supportChatThread?.unreadByClient || 0);
  const openTicketsCount = supportTickets.filter(
    (t) => t.status === 'open' || t.status === 'in_progress'
  ).length;

  const isVisible = mode === 'full' || drawerOpen;

  useEffect(() => {
    if (isVisible && activeTab === 'chat' && unreadCount > 0) {
      markClientChatRead().catch(() => {
        // Handled cleanly if thread updates concurrently
      });
    }
  }, [isVisible, activeTab, unreadCount, markClientChatRead]);

  useEffect(() => {
    if (isVisible && activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isVisible, activeTab, supportChatMessages.length]);

  const report = (type: 'ok' | 'err', text: string) => {
    setLocalBanner({ type, text });
    if (onNotify) onNotify(type, text);
  };

  const handleSendChat = async (textOverride?: string, tagOverride?: string) => {
    const finalMsg = (textOverride ?? chatInput).trim();
    const finalTag = (tagOverride ?? selectedTopic).trim();
    if (!finalMsg) return;
    setSendingChat(true);
    setLocalBanner(null);
    try {
      await sendClientSupportMessage(finalMsg, finalTag);
      if (!textOverride) {
        setChatInput('');
        setSelectedTopic('');
      }
    } catch (err) {
      report('err', err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setSendingChat(false);
    }
  };

  const handleCopyReceiptField = async (key: string, val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedReceiptKey(key);
      setTimeout(() => setCopiedReceiptKey(''), 1800);
    } catch {
      // Clipboard blocked in iframe fallback ignored cleanly
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingTicket(true);
    setLocalBanner(null);
    try {
      const receipt = await createSupportTicket({
        category,
        priority,
        subject,
        description,
        referenceId,
      });
      setSubject('');
      setDescription('');
      setReferenceId('');
      setLatestReceipt(receipt);
      if (onTicketConfirmed) onTicketConfirmed(receipt);
      report(
        'ok',
        `Automated confirmation dispatched for Ticket ${receipt.ticketNumber} (${receipt.recipientEmail}).`
      );
    } catch (err) {
      report('err', err instanceof Error ? err.message : 'Failed to submit complaint ticket.');
    } finally {
      setSubmittingTicket(false);
    }
  };

  const applyTicketPreset = (preset: TicketPreset) => {
    setCategory(preset.category);
    setPriority(preset.priority);
    setSubject(preset.subject);
    setDescription(preset.description);
    setLocalBanner(null);
  };

  const supportLinks = platformConfig.supportLinks;

  const deskBody = (
    <div className="flex flex-col h-full min-h-0">
      {/* Header & Mode Switcher */}
      <div className="px-4 py-3.5 border-b border-slate-800 bg-[#0A101D] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-400/35 flex items-center justify-center shrink-0">
            <Headphones className="w-4 h-4 text-amber-400" />
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-white text-sm truncate">
              Client Live Support &amp; Complaint Desk
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              Direct 24/7 vault desk · Account {userProfile?.handle || ''}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                activeTab === 'chat'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Live Chat</span>
              {unreadCount > 0 && (
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-950/80 text-amber-300">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tickets')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                activeTab === 'tickets'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>Complaint Ticket</span>
              {openTicketsCount > 0 && (
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-950/80 text-amber-300">
                  {openTicketsCount}
                </span>
              )}
            </button>
          </div>

          {mode === 'floating' && (
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
              aria-label="Close live support"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {localBanner && (
        <div
          className={`px-4 py-2.5 text-xs border-b flex items-center justify-between gap-2 shrink-0 ${
            localBanner.type === 'ok'
              ? 'bg-emerald-950/70 border-emerald-500/30 text-emerald-200'
              : 'bg-red-950/70 border-red-500/30 text-red-200'
          }`}
        >
          <span>{localBanner.text}</span>
          <button
            type="button"
            onClick={() => setLocalBanner(null)}
            className="text-[11px] font-semibold underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: LIVE CHAT */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Quick-Click Suggestions Bar */}
          <div className="px-4 py-3 border-b border-slate-800/90 bg-slate-950/70 space-y-2 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-amber-300">
                Quick Tap Suggestions — Click to fill or send right away:
              </span>
              {selectedTopic && (
                <button
                  type="button"
                  onClick={() => setSelectedTopic('')}
                  className="text-[11px] text-slate-400 hover:text-white underline"
                >
                  Clear topic ({selectedTopic})
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CHAT_SUGGESTIONS.map((item) => {
                const isPicked = selectedTopic === item.topicTag;
                return (
                  <div
                    key={item.id}
                    className={`inline-flex items-center rounded-lg border text-[11px] overflow-hidden transition-colors ${
                      isPicked
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                        : 'border-slate-700/80 bg-slate-900/90 text-slate-200 hover:border-amber-500/60'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTopic(item.topicTag);
                        setChatInput(item.message);
                      }}
                      className="px-2.5 py-1.5 font-medium text-left hover:text-white"
                      title="Fill message box to customize before sending"
                    >
                      {item.label}
                    </button>
                    <button
                      type="button"
                      disabled={sendingChat}
                      onClick={() => handleSendChat(item.message, item.topicTag)}
                      className="px-2 py-1.5 border-l border-slate-700/70 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 disabled:opacity-50"
                      title={`Send "${item.label}" immediately`}
                      aria-label={`Send ${item.label} immediately`}
                    >
                      <Send className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Messages Stream */}
          <div
            className={`flex-1 overflow-y-auto p-4 space-y-3 bg-[#070B14] ${
              mode === 'full' ? 'min-h-[340px] max-h-[480px]' : 'min-h-[220px]'
            }`}
          >
            {supportChatMessages.length === 0 ? (
              <div className="py-10 px-4 text-center space-y-2">
                <p className="text-sm font-semibold text-white">
                  Welcome to {platformConfig.companyName} Live Support
                </p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Tap any suggestion above to describe your question instantly, or type your message below. Our support desk replies in real time.
                </p>
              </div>
            ) : (
              supportChatMessages.map((msg) => {
                const isClient = msg.senderRole === 'client';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isClient ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-1 px-1">
                      <span className="font-semibold text-slate-300">
                        {isClient ? 'You' : msg.senderName || 'Support Desk'}
                      </span>
                      {msg.topicTag && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-400">{msg.topicTag}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-[10px]">
                        {formatSupportTime(msg.createdAt)}
                      </span>
                    </div>
                    <div
                      className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap break-words ${
                        isClient
                          ? 'bg-amber-500 text-slate-950 font-medium'
                          : 'bg-slate-800/95 border border-slate-700 text-slate-100'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChat();
            }}
            className="p-3 border-t border-slate-800 bg-[#0B111E] space-y-2 shrink-0"
          >
            <div className="flex items-end gap-2">
              <textarea
                rows={2}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
                placeholder="Type your message or tap a suggestion above..."
                className="flex-1 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/90 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-amber-500 resize-none"
              />
              <button
                type="submit"
                disabled={sendingChat || !chatInput.trim()}
                className="px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                {sendingChat ? 'Sending...' : 'Send'}
              </button>
            </div>
            {(supportLinks?.telegramUrl || supportLinks?.whatsappUrl || supportLinks?.supportEmail) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 pt-1">
                <span>Direct channels:</span>
                {supportLinks?.telegramUrl && (
                  <a
                    href={supportLinks.telegramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-400 hover:underline inline-flex items-center gap-1"
                  >
                    Telegram <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {supportLinks?.whatsappUrl && (
                  <a
                    href={supportLinks.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:underline inline-flex items-center gap-1"
                  >
                    WhatsApp <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {supportLinks?.supportEmail && (
                  <a
                    href={`mailto:${supportLinks.supportEmail}`}
                    className="text-slate-300 hover:underline"
                  >
                    {supportLinks.supportEmail}
                  </a>
                )}
              </div>
            )}
          </form>
        </div>
      )}

      {/* TAB 2: COMPLAINT TICKETS */}
      {activeTab === 'tickets' && (
        <div
          className={`flex-1 overflow-y-auto p-4 bg-[#070B14] ${
            mode === 'full' ? 'grid grid-cols-1 lg:grid-cols-12 gap-6' : 'space-y-5'
          }`}
        >
          {/* New Complaint Ticket Form */}
          <div className={mode === 'full' ? 'lg:col-span-6 space-y-4' : 'space-y-4'}>
            {/* Instant Automated Confirmation Receipt Card */}
            {latestReceipt && (
              <div className="p-4 rounded-xl border border-emerald-500/45 bg-emerald-950/30 space-y-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <MailCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-display font-bold text-emerald-200 text-sm">
                        Automated Confirmation Sent
                      </div>
                      <div className="text-[11px] text-emerald-300/80">
                        Receipt logged to your Notification Inbox &amp; linked to {latestReceipt.recipientEmail}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLatestReceipt(null)}
                    className="p-1 rounded text-emerald-300/70 hover:text-white"
                    aria-label="Dismiss confirmation receipt"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-3 rounded-lg bg-[#0B111E]/90 border border-emerald-500/25 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">Ticket ID:</span>
                      <span className="font-mono font-bold text-amber-400 text-sm">
                        {latestReceipt.ticketNumber}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyReceiptField('tkt_id', latestReceipt.ticketNumber)
                      }
                      className="px-2 py-1 rounded border border-slate-700 text-[11px] text-slate-200 hover:border-amber-400 inline-flex items-center gap-1"
                    >
                      {copiedReceiptKey === 'tkt_id' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied ID</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy ID</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-mono text-slate-400 pt-1">
                    <div className="truncate">From: {latestReceipt.senderName}</div>
                    <div className="truncate">To: {latestReceipt.recipientEmail}</div>
                    <div className="sm:col-span-2 truncate text-slate-300">
                      Subject: {latestReceipt.emailSubject}
                    </div>
                    <div className="sm:col-span-2 text-emerald-300">
                      Estimated Response SLA: {latestReceipt.estimatedResponseTime}
                    </div>
                  </div>

                  <p className="text-slate-200 leading-relaxed whitespace-pre-wrap pt-2 border-t border-slate-800/80">
                    {latestReceipt.message}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyReceiptField(
                        'full_receipt',
                        `From: ${latestReceipt.senderName}\nTo: ${latestReceipt.recipientEmail}\nSubject: ${latestReceipt.emailSubject}\nTicket ID: ${latestReceipt.ticketNumber}\nSLA: ${latestReceipt.estimatedResponseTime}\n\n${latestReceipt.message}`
                      )
                    }
                    className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/90 hover:border-amber-400 text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1.5"
                  >
                    {copiedReceiptKey === 'full_receipt' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Receipt Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Confirmation Receipt</span>
                      </>
                    )}
                  </button>

                  {onOpenTrackTicket && (
                    <button
                      type="button"
                      onClick={() => {
                        setDrawerOpen(false);
                        onOpenTrackTicket(latestReceipt.ticketId);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold inline-flex items-center gap-1.5"
                    >
                      <FileSearch className="w-3.5 h-3.5" />
                      Track This Ticket →
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-white font-display font-bold text-sm">
                <FileWarning className="w-4 h-4 text-amber-400" />
                <span>Submit a Formal Complaint Ticket</span>
              </div>
              <p className="text-xs text-slate-400">
                Choose a quick complaint template below to auto-fill your details, or write your own report. An automated confirmation receipt with your Ticket ID is sent immediately upon submission.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {TICKET_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyTicketPreset(preset)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:border-amber-400 hover:text-amber-300 text-slate-200 text-[11px] font-medium transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <form
              onSubmit={handleCreateTicket}
              className="p-4 rounded-xl border border-slate-800 bg-[#0B111E] space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Issue Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as SupportTicketCategory)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-white"
                  >
                    <option value="deposit">Deposit Issue</option>
                    <option value="withdrawal">Withdrawal / Payout</option>
                    <option value="kyc">KYC &amp; Phone Verification</option>
                    <option value="trading">AI Trading Package</option>
                    <option value="forex">Forex &amp; Copy Trade</option>
                    <option value="p2p">P2P Transfer</option>
                    <option value="account">Account &amp; Security</option>
                    <option value="other">Other Complaint</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Priority Level</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as SupportTicketPriority)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={140}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Short summary of your complaint"
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-white placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Reference ID (Optional — TxID, Package #, Order ID)
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                  placeholder="e.g. TX9984... or Package #1"
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-white font-mono placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Complaint Details
                </label>
                <textarea
                  rows={4}
                  required
                  minLength={5}
                  maxLength={2500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain the issue clearly with amount, date, and wallet details..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-white placeholder:text-slate-500 resize-y"
                />
              </div>

              <button
                type="submit"
                disabled={submittingTicket}
                className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                {submittingTicket ? 'Submitting Ticket...' : 'Submit Complaint Ticket'}
              </button>
            </form>
          </div>

          {/* Client Submitted Tickets History */}
          <div className={mode === 'full' ? 'lg:col-span-6 space-y-3' : 'space-y-3'}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display font-bold text-white text-sm">
                My Submitted Tickets ({supportTickets.length})
              </h3>
              {onOpenTrackTicket && (
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    onOpenTrackTicket();
                  }}
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 underline underline-offset-2"
                >
                  Open Track Ticket View →
                </button>
              )}
            </div>
            {supportTickets.length === 0 ? (
              <div className="p-6 rounded-xl border border-slate-800 bg-[#0B111E] text-center text-xs text-slate-400">
                You have not filed any complaint tickets yet.
              </div>
            ) : (
              <div className="space-y-3">
                {supportTickets.map((tkt) => (
                  <div
                    key={tkt.id}
                    className="p-4 rounded-xl border border-slate-800 bg-[#0B111E] space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold text-white">
                        <span className="font-mono text-amber-400 mr-2">{tkt.ticketNumber}</span>
                        {tkt.subject}
                      </div>
                      <span
                        className={`font-mono text-[11px] font-bold ${
                          tkt.status === 'resolved' || tkt.status === 'closed'
                            ? 'text-emerald-400'
                            : tkt.status === 'in_progress'
                            ? 'text-sky-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {tkt.status === 'open'
                          ? 'Pending'
                          : tkt.status === 'in_progress'
                          ? 'In Progress'
                          : 'Resolved'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="capitalize">{tkt.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">Priority: {tkt.priority}</span>
                      {tkt.referenceId && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-slate-300">Ref: {tkt.referenceId}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{formatSupportTime(tkt.createdAt)}</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {tkt.description}
                    </p>
                    {tkt.adminReply && (
                      <div className="mt-2 pt-2 border-t border-slate-800 space-y-1">
                        <div className="text-[11px] font-semibold text-emerald-400">
                          Official Support Desk Response:
                        </div>
                        <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">
                          {tkt.adminReply}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (mode === 'full') {
    return (
      <section className="bg-[#0B111E]/90 backdrop-blur-md border border-slate-700/70 rounded-2xl overflow-hidden shadow-xl">
        {deskBody}
      </section>
    );
  }

  return (
    <>
      {/* Floating Support Launcher */}
      {!drawerOpen && (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="fixed bottom-5 right-5 z-40 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-xs shadow-2xl border border-amber-300/60 inline-flex items-center gap-2 transition-transform hover:-translate-y-0.5"
        >
          <Headphones className="w-4 h-4" />
          <span>Live Support &amp; Tickets</span>
          {unreadCount > 0 && (
            <span className="font-mono text-[11px] font-extrabold px-1.5 py-0.5 rounded bg-slate-950 text-amber-400">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Floating Support Drawer */}
      {drawerOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] sm:w-[440px] h-[600px] max-h-[82vh] bg-[#0B111E] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          {deskBody}
        </div>
      )}
    </>
  );
};
