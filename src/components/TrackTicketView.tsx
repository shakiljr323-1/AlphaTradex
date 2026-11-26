import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileSearch,
  Headphones,
  Loader2,
  MailCheck,
  PlusCircle,
  Search,
  Ticket,
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { SupportTicket, SupportTicketStatus } from '../types/platform';

type TrackFilter = 'all' | 'pending' | 'in_progress' | 'resolved';

function mapStatusBucket(status: SupportTicketStatus): 'pending' | 'in_progress' | 'resolved' {
  if (status === 'in_progress') return 'in_progress';
  if (status === 'resolved' || status === 'closed') return 'resolved';
  return 'pending';
}

function getStatusDisplay(status: SupportTicketStatus): {
  label: string;
  stepIndex: number;
  textClass: string;
  barClass: string;
} {
  if (status === 'resolved' || status === 'closed') {
    return {
      label: status === 'closed' ? 'Resolved (Closed)' : 'Resolved',
      stepIndex: 2,
      textClass: 'text-emerald-400',
      barClass: 'bg-emerald-500',
    };
  }
  if (status === 'in_progress') {
    return {
      label: 'In Progress',
      stepIndex: 1,
      textClass: 'text-sky-400',
      barClass: 'bg-sky-500',
    };
  }
  return {
    label: 'Pending',
    stepIndex: 0,
    textClass: 'text-amber-400',
    barClass: 'bg-amber-500',
  };
}

function formatDateTime(val: unknown): string {
  const secs = (val as { seconds?: number } | undefined)?.seconds;
  if (typeof secs === 'number') {
    return new Date(secs * 1000).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return 'Just now';
}

const CATEGORY_LABELS: Record<SupportTicket['category'], string> = {
  deposit: 'Deposit Issue',
  withdrawal: 'Withdrawal / Payout',
  kyc: 'KYC & Verification',
  trading: 'AI Trading Package',
  forex: 'Forex & Copy Trade',
  p2p: 'P2P Transfer',
  account: 'Account & Security',
  other: 'General Support',
};

interface TrackTicketViewProps {
  initialTicketId?: string;
  onOpenSupportDesk: () => void;
}

export const TrackTicketView: React.FC<TrackTicketViewProps> = ({
  initialTicketId = '',
  onOpenSupportDesk,
}) => {
  const { supportTickets } = usePlatform();

  const [filter, setFilter] = useState<TrackFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string>(initialTicketId);
  const [copiedTicketNo, setCopiedTicketNo] = useState<string>('');

  useEffect(() => {
    if (initialTicketId) {
      setSelectedTicketId(initialTicketId);
      setFilter('all');
      setSearchQuery('');
    }
  }, [initialTicketId]);

  const counts = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let resolved = 0;
    for (const t of supportTickets) {
      const bucket = mapStatusBucket(t.status);
      if (bucket === 'pending') pending += 1;
      else if (bucket === 'in_progress') inProgress += 1;
      else resolved += 1;
    }
    return {
      all: supportTickets.length,
      pending,
      in_progress: inProgress,
      resolved,
    };
  }, [supportTickets]);

  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return supportTickets.filter((t) => {
      const matchesFilter = filter === 'all' || mapStatusBucket(t.status) === filter;
      if (!matchesFilter) return false;
      if (!q) return true;
      return (
        t.ticketNumber.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.referenceId || '').toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [supportTickets, filter, searchQuery]);

  const activeTicket =
    filteredTickets.find((t) => t.id === selectedTicketId) || filteredTickets[0] || null;

  const handleCopyTicketNumber = async (ticketNumber: string) => {
    try {
      await navigator.clipboard.writeText(ticketNumber);
      setCopiedTicketNo(ticketNumber);
      setTimeout(() => setCopiedTicketNo(''), 1800);
    } catch {
      // Clipboard blocked in iframe fallback ignored cleanly
    }
  };

  return (
    <section className="space-y-6">
      {/* Header & Primary Action */}
      <div className="bg-[#0B111E]/85 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <FileSearch className="w-5 h-5 text-amber-400" />
            <h2 className="font-display font-bold text-white text-xl">Track Support Tickets</h2>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            Monitor the live progress of every complaint and support ticket you have submitted—from initial submission through agent review to final resolution.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenSupportDesk}
          className="px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 transition-colors shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          Submit New Complaint
        </button>
      </div>

      {/* Status Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0B111E]/80 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Total Submitted</div>
          <div className="font-mono font-bold text-2xl text-white tabular-nums mt-1">
            {counts.all}
          </div>
        </div>
        <div className="bg-[#0B111E]/80 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Pending Review</div>
          <div className="font-mono font-bold text-2xl text-amber-400 tabular-nums mt-1">
            {counts.pending}
          </div>
        </div>
        <div className="bg-[#0B111E]/80 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">In Progress</div>
          <div className="font-mono font-bold text-2xl text-sky-400 tabular-nums mt-1">
            {counts.in_progress}
          </div>
        </div>
        <div className="bg-[#0B111E]/80 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Resolved</div>
          <div className="font-mono font-bold text-2xl text-emerald-400 tabular-nums mt-1">
            {counts.resolved}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#0B111E]/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Track by Ticket # (e.g. TKT-...), subject, TxID, or category..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-700 bg-slate-900/90 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800">
          {(
            [
              { id: 'all', label: 'All', count: counts.all },
              { id: 'pending', label: 'Pending', count: counts.pending },
              { id: 'in_progress', label: 'In Progress', count: counts.in_progress },
              { id: 'resolved', label: 'Resolved', count: counts.resolved },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                filter === item.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {item.label}{' '}
              <span className="font-mono tabular-nums opacity-80">({item.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Empty State or Split Tracking Desk */}
      {supportTickets.length === 0 ? (
        <div className="bg-[#0B111E]/80 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
          <Ticket className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="font-display font-bold text-white text-base">
            No Support Tickets Submitted Yet
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Whenever you file a complaint or support ticket, it will appear here with real-time tracking stages and official responses from our desk.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={onOpenSupportDesk}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Headphones className="w-3.5 h-3.5" />
              Open Live Support &amp; File Ticket
            </button>
          </div>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="bg-[#0B111E]/80 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
          No tickets match your current search or status filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Ticket Queue List */}
          <div className="lg:col-span-5 bg-[#0B111E]/85 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800/80">
            {filteredTickets.map((tkt) => {
              const info = getStatusDisplay(tkt.status);
              const isSelected = activeTicket?.id === tkt.id;
              return (
                <button
                  key={tkt.id}
                  type="button"
                  onClick={() => setSelectedTicketId(tkt.id)}
                  className={`w-full p-4 text-left transition-colors space-y-1.5 ${
                    isSelected ? 'bg-slate-800/80' : 'hover:bg-slate-900/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-amber-400">
                      {tkt.ticketNumber}
                    </span>
                    <span className={`font-mono text-[11px] font-bold ${info.textClass}`}>
                      {info.label}
                    </span>
                  </div>
                  <div className="font-semibold text-sm text-white truncate">{tkt.subject}</div>
                  <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-2">
                    <span>{CATEGORY_LABELS[tkt.category]}</span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">Priority: {tkt.priority}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{formatDateTime(tkt.createdAt)}</span>
                  </div>
                  {/* Mini Progress Indicator */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1.5">
                    {[0, 1, 2].map((step) => (
                      <div
                        key={step}
                        className={`h-1 rounded-full ${
                          step <= info.stepIndex ? info.barClass : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Detailed Resolution Tracker */}
          {activeTicket && (() => {
            const info = getStatusDisplay(activeTicket.status);
            const steps = [
              {
                title: 'Pending',
                subtitle: 'Ticket received & queued for review',
                Icon: Clock,
              },
              {
                title: 'In Progress',
                subtitle: 'Compliance / support specialist investigating',
                Icon: Loader2,
              },
              {
                title: 'Resolved',
                subtitle: 'Final resolution posted to your account',
                Icon: CheckCircle2,
              },
            ];

            return (
              <div className="lg:col-span-7 bg-[#0B111E]/90 border border-slate-700/80 rounded-2xl p-6 space-y-6 shadow-xl">
                {/* Ticket Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-amber-400">
                        {activeTicket.ticketNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyTicketNumber(activeTicket.ticketNumber)}
                        className="text-slate-400 hover:text-white inline-flex items-center gap-1 text-[11px]"
                        title="Copy Ticket Number"
                      >
                        {copiedTicketNo === activeTicket.ticketNumber ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span className={`font-semibold ${info.textClass}`}>{info.label}</span>
                    </div>
                    <h3 className="font-display font-bold text-white text-lg">
                      {activeTicket.subject}
                    </h3>
                    <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>{CATEGORY_LABELS[activeTicket.category]}</span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">Priority: {activeTicket.priority}</span>
                      {activeTicket.referenceId && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-slate-200">
                            Ref: {activeTicket.referenceId}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-[11px] font-mono text-slate-400 space-y-0.5 shrink-0">
                    <div>Submitted: {formatDateTime(activeTicket.createdAt)}</div>
                    <div>Updated: {formatDateTime(activeTicket.updatedAt)}</div>
                  </div>
                </div>

                {/* 3-Stage Resolution Timeline */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-slate-300">Resolution Progress</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {steps.map((step, idx) => {
                      const reached = idx <= info.stepIndex;
                      const isCurrent = idx === info.stepIndex;
                      const StepIcon = step.Icon;
                      return (
                        <div
                          key={step.title}
                          className={`p-3.5 rounded-xl border transition-colors ${
                            reached
                              ? isCurrent
                                ? 'border-amber-400/60 bg-amber-500/10'
                                : 'border-emerald-500/40 bg-emerald-500/5'
                              : 'border-slate-800 bg-slate-900/50 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-2 text-xs font-bold text-white">
                            <StepIcon
                              className={`w-4 h-4 shrink-0 ${
                                idx < info.stepIndex
                                  ? 'text-emerald-400'
                                  : isCurrent
                                  ? info.textClass
                                  : 'text-slate-500'
                              }`}
                            />
                            <span>
                              {idx + 1}. {step.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                            {step.subtitle}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Submitted Complaint Details */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-300">Your Submitted Complaint</div>
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {activeTicket.description}
                  </div>
                </div>

                {/* Automated Receipt Confirmation Record */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-slate-300 inline-flex items-center gap-1.5">
                      <MailCheck className="w-3.5 h-3.5 text-amber-400" />
                      <span>Automated Receipt Confirmation</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      Confirmed to: {activeTicket.userEmail}
                      {activeTicket.estimatedResponseTime
                        ? ` · SLA: ${activeTicket.estimatedResponseTime}`
                        : ''}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/25 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {activeTicket.autoAckMessage ||
                      `Ticket ${activeTicket.ticketNumber} has been logged under ${activeTicket.userEmail}. Our support desk reviews cases in order of priority and posts updates directly to this tracker.`}
                  </div>
                </div>

                {/* Official Support Desk Response */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-300">
                    Official Support Desk Response
                  </div>
                  {activeTicket.adminReply ? (
                    <div className="p-4 rounded-xl bg-emerald-950/35 border border-emerald-500/35 text-xs text-emerald-100 leading-relaxed space-y-2">
                      <p className="whitespace-pre-wrap">{activeTicket.adminReply}</p>
                      {activeTicket.resolvedBy && (
                        <div className="text-[11px] font-mono text-emerald-300/80 pt-1 border-t border-emerald-500/20">
                          Handled by Support Desk · Updated {formatDateTime(activeTicket.updatedAt)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
                      {info.stepIndex === 1
                        ? 'Your ticket is currently In Progress. A support specialist is reviewing your details and will post an official response here shortly.'
                        : 'Your ticket is in the Pending queue. Need faster help? Follow up in Live Chat with your Ticket #.'}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[11px] text-slate-400">
                    Need to share additional details or TxID proof?
                  </span>
                  <button
                    type="button"
                    onClick={onOpenSupportDesk}
                    className="px-3.5 py-2 rounded-lg border border-slate-700 hover:border-amber-400 text-slate-200 hover:text-amber-300 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Headphones className="w-3.5 h-3.5" />
                    Follow Up in Live Chat
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </section>
  );
};
