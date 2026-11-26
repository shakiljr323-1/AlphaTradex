import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  HelpCircle,
  Search,
  X,
} from 'lucide-react';
import { NavSection, PlatformConfig } from '../types/platform';

type FaqCategory =
  | 'all'
  | 'vault_deposits'
  | 'ai_packages'
  | 'payouts'
  | 'security_kyc';

interface FaqItem {
  id: string;
  category: Exclude<FaqCategory, 'all'>;
  categoryLabel: string;
  question: string;
  answer: string;
  highlights: string[];
  actionLabel?: string;
  actionType?: 'plans' | 'auth' | 'dashboard' | 'terms';
}

interface HomepageFaqAccordionProps {
  platformConfig: PlatformConfig;
  isSignedIn: boolean;
  onSelectSection: (section: NavSection) => void;
  onOpenAuth: (mode: 'signin' | 'signup') => void;
  onOpenDashboard?: (targetNav?: 'dashboard' | 'forex-market' | 'pump-fun') => void;
}

export const HomepageFaqAccordion: React.FC<HomepageFaqAccordionProps> = ({
  platformConfig,
  isSignedIn,
  onSelectSection,
  onOpenAuth,
  onOpenDashboard,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<FaqCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openIds, setOpenIds] = useState<string[]>(['deposit-funding']);
  const [helpfulVotes, setHelpfulVotes] = useState<Record<string, 'yes' | 'need_help'>>({});

  const faqItems = useMemo<FaqItem[]>(() => {
    const enabledDepositMethods = (platformConfig.paymentMethods || []).filter(
      (m) => m.enabled && m.allowDeposit
    );
    const enabledWithdrawMethods = (platformConfig.paymentMethods || []).filter(
      (m) => m.enabled && m.allowWithdrawal
    );
    const depositChannelNames =
      enabledDepositMethods.length > 0
        ? enabledDepositMethods.map((m) => m.name).join(', ')
        : 'USDT (TRC20), USDT (ERC20), and SOL';
    const withdrawChannelNames =
      enabledWithdrawMethods.length > 0
        ? enabledWithdrawMethods.map((m) => m.name).join(', ')
        : 'USDT (TRC20), USDT (ERC20), and SOL';

    const minDepositAcross =
      enabledDepositMethods.length > 0
        ? Math.min(...enabledDepositMethods.map((m) => Number(m.minDepositUsd || 10)))
        : 10;
    const minWithdrawUsd = Number(platformConfig.minWithdrawalUsd || 10);

    const packages = platformConfig.packages || [];
    const sortedPkgs = [...packages].sort((a, b) => a.capital - b.capital);
    const lowestPkg = sortedPkgs[0];
    const highestPkg = sortedPkgs[sortedPkgs.length - 1];
    const totalProfitDays = Number(platformConfig.totalProfitDays || 200);
    const lockDays = Number(platformConfig.eliteCapitalLockDays || 200);

    const packageSummaryText =
      sortedPkgs.length > 0
        ? sortedPkgs
            .map(
              (p) =>
                `${p.name} ($${p.capital.toLocaleString()} at ${p.dailyPercent}%/weekday)`
            )
            .join(' · ')
        : 'Structured AI tiers ranging from Starter to Institutional allocations.';

    const kyc = platformConfig.kycSettings;
    const kycReqList: string[] = [];
    if (kyc?.enabled) {
      if (kyc.requireKycForDeposits) kycReqList.push('vault deposits');
      if (kyc.requireKycForPackages) kycReqList.push('package activation');
      if (kyc.requireKycForClaims) kycReqList.push('profit claims');
      if (kyc.requireKycForWithdrawals) kycReqList.push('withdrawals');
    }
    const kycPolicySummary =
      kyc?.enabled && kycReqList.length > 0
        ? `Identity verification is currently enforced before ${kycReqList.join(', ')}.`
        : 'You can explore your vault right away and complete optional KYC verification anytime under Account & Security to keep your account pre-cleared for higher limits.';

    const mlm = platformConfig.mlmRates || { level1: 5, level2: 2, level3: 1 };

    return [
      {
        id: 'deposit-funding',
        category: 'vault_deposits',
        categoryLabel: 'Vault Deposits',
        question: 'How do I fund my Deposit Wallet and which payment channels are supported?',
        answer: `Open the Deposit Funds screen in your Vault Dashboard, choose an active channel (${depositChannelNames}), transfer your desired USD amount (starting from $${minDepositAcross.toFixed(
          2
        )} minimum depending on the selected channel), and submit your transaction hash (TXID) or payment reference. Once verified, the USD balance credits directly to your Deposit Wallet so you can activate any AI Trading Package.`,
        highlights: [
          `Supported deposit channels: ${depositChannelNames}`,
          `Minimum vault deposit starts at $${minDepositAcross.toFixed(2)} USD`,
          'Track every deposit live in Deposit Wallet Report (Pending / Approved / Rejected)',
        ],
        actionLabel: isSignedIn ? 'Open Vault Dashboard' : 'Create Account to Deposit',
        actionType: isSignedIn ? 'dashboard' : 'auth',
      },
      {
        id: 'deposit-txid-timing',
        category: 'vault_deposits',
        categoryLabel: 'Vault Deposits',
        question: 'How long does deposit confirmation take and why must I submit the exact TXID?',
        answer:
          'Every deposit submission enters our automated verification queue and is matched against on-chain or gateway settlement records using your unique Transaction ID (TXID). Submitting the exact TXID without extra spaces prevents verification delays and avoids duplicate support tickets. You can monitor real-time approval status and any settlement notes directly inside your Deposit Wallet Report.',
        highlights: [
          'Double-check network match (e.g., TRC20 vs. ERC20) before sending funds',
          'Each TXID can only be submitted once to prevent duplicate entries',
          'Status updates from Pending to Approved automatically in your ledger',
        ],
      },
      {
        id: 'income-to-deposit-reinvest',
        category: 'vault_deposits',
        categoryLabel: 'Vault Deposits',
        question: 'Can I compound my earned Income Wallet profits to activate new packages?',
        answer:
          'Yes. Earned trading yields and referral commissions accumulate inside your Income Wallet. Inside the Activate Trading screen, you can fund new AI packages directly from your Deposit Wallet, directly from your Income Wallet, or using a Combined balance—or transfer funds instantly from Income Wallet to Deposit Wallet with zero internal transfer fee.',
        highlights: [
          'Instant internal Income Wallet → Deposit Wallet conversion',
          'Combined funding lets you top up a package using both wallets in one click',
          'Zero internal fee when compounding profits into new AI tiers',
        ],
        actionLabel: 'Explore AI Packages',
        actionType: 'plans',
      },
      {
        id: 'ai-packages-overview',
        category: 'ai_packages',
        categoryLabel: 'AI Trading Packages',
        question: 'How do AI Trading Packages work and what package tiers are available?',
        answer: `${platformConfig.companyName} allocates your selected package capital into automated algorithmic strategies executing across crypto and FX liquidity pools. Currently ${
          sortedPkgs.length
        } active tier${sortedPkgs.length === 1 ? '' : 's'} are available${
          lowestPkg && highestPkg
            ? `, starting from $${lowestPkg.capital.toLocaleString()} (${lowestPkg.dailyPercent}%/weekday) up to $${highestPkg.capital.toLocaleString()} (${highestPkg.dailyPercent}%/weekday)`
            : ''
        }. Each package runs for a structured ${totalProfitDays} weekday trading-day profit cycle.`,
        highlights: [
          packageSummaryText,
          `Full ${totalProfitDays} weekday trading-day earning cycle per package`,
          'Multiple packages can run concurrently inside a single Vault account',
        ],
        actionLabel: 'Compare All Investment Plans',
        actionType: 'plans',
      },
      {
        id: 'weekday-vs-weekend',
        category: 'ai_packages',
        categoryLabel: 'AI Trading Packages',
        question: 'Why do package profits accrue Monday through Friday and rest on weekends?',
        answer: `Institutional FX and algorithmic liquidity desks operate on a disciplined Monday–Friday execution calendar to avoid thin weekend order books and abnormal slippage. Saturday and Sunday are scheduled market rest days—no trading days are lost from your ${totalProfitDays}-day package cycle, and profit accrual automatically resumes every Monday.`,
        highlights: [
          'Profits accrue strictly on weekdays (Monday – Friday)',
          `Weekend rest days do not consume any of your ${totalProfitDays} profit days`,
          'Live day progress (e.g., Day 14 / 200) is tracked on every package row',
        ],
      },
      {
        id: 'claiming-daily-profit',
        category: 'ai_packages',
        categoryLabel: 'AI Trading Packages',
        question: 'How and when do I claim my accrued AI trading profits?',
        answer:
          'Whenever your active packages have unclaimed weekday profit, open My Packages in your dashboard and click Claim Profit on any active tier. The claimed USD amount transfers immediately into your Income Wallet, where it becomes available for withdrawal requests, compounding into new packages, or live Forex/Copy Trade execution.',
        highlights: [
          'One-click claiming straight into your Income Wallet on active weekdays',
          'Unclaimed weekday yields continue accumulating safely until claimed',
          'Every claim is permanently logged in your Transaction History',
        ],
      },
      {
        id: 'capital-lock-unlock',
        category: 'ai_packages',
        categoryLabel: 'AI Trading Packages',
        question: 'How does the principal Capital Lock period and Capital Unlock withdrawal work?',
        answer: `Principal capital allocated to an AI Trading Package stays deployed in institutional liquidity pools for its lock period (typically ${lockDays} calendar days, shown clearly on each package card and countdown timer). Once the lock period completes, the Request Capital button unlocks automatically in Capital Withdraw so you can submit a principal settlement request with a full itemized breakdown.`,
        highlights: [
          `Standard principal lock schedule: ${lockDays} calendar days`,
          'Live countdown shows exact days remaining and unlock date per package',
          'Full principal + generated profit breakdown attached to every capital request',
        ],
        actionLabel: 'Read Terms & Compliance',
        actionType: 'terms',
      },
      {
        id: 'withdrawal-process-status',
        category: 'payouts',
        categoryLabel: 'Payouts & Withdrawals',
        question: 'How do I request a payout and track Pending vs. Processed withdrawals?',
        answer: `Open Withdrawal Management under Wallets in your dashboard, choose your payout source (Trading Profits or Referral Commissions), select an enabled payout channel (${withdrawChannelNames}), and enter any amount from $${minWithdrawUsd.toFixed(
          2
        )} USD upward. Every submission enters the live Pending Review queue—once settled, it updates to Processed with your settlement TXID/note; if a request is ever declined, the full USD amount refunds automatically back to your Income Wallet.`,
        highlights: [
          `Minimum payout request: $${minWithdrawUsd.toFixed(2)} USD`,
          'Filter and search Pending, Processed, and Rejected payouts in real time',
          'Save frequently used wallet addresses inside Payment Methods for one-click fill',
        ],
      },
      {
        id: 'referral-commissions-faq',
        category: 'payouts',
        categoryLabel: 'Payouts & Withdrawals',
        question: 'How are Referral Commissions calculated and credited?',
        answer: `Share your unique Referral ID or registration link from the Referral Dashboard. Whenever a referred member activates an AI Trading Package, multi-tier commissions credit automatically to your Income Wallet: Level 1 Direct earns ${mlm.level1}%, Level 2 earns ${mlm.level2}%, and Level 3 earns ${mlm.level3}%.`,
        highlights: [
          `3-Tier Structure: Level 1 (${mlm.level1}%) · Level 2 (${mlm.level2}%) · Level 3 (${mlm.level3}%)`,
          'Credited automatically on package activation with full downline tracking',
          'Withdrawable via Withdrawal Management or reusable for new packages',
        ],
      },
      {
        id: 'kyc-verification-faq',
        category: 'security_kyc',
        categoryLabel: 'Security & KYC',
        question: 'Is KYC identity verification required, and how quickly is it reviewed?',
        answer: `${kycPolicySummary} Our Global KYC Verification module supports all countries worldwide using NID, Passport, or Driving License with built-in QR/MRZ and OCR auto-fill so you can submit verified details in under two minutes and track real-time approval badges (Pending Review, Verified, or Re-submission notes) from your dashboard.`,
        highlights: [
          'Supports National ID (NID), Passport, and Driving License worldwide',
          'Built-in free document QR/MRZ & OCR scanner auto-fills verified fields',
          'Live KYC status updates directly inside Account & Security',
        ],
        actionLabel: isSignedIn ? 'Open Vault Dashboard' : 'Register & Verify Account',
        actionType: isSignedIn ? 'dashboard' : 'auth',
      },
    ];
  }, [platformConfig, isSignedIn]);

  const categories: { id: FaqCategory; label: string }[] = [
    { id: 'all', label: 'All Topics' },
    { id: 'vault_deposits', label: 'Vault Deposits' },
    { id: 'ai_packages', label: 'AI Trading Packages' },
    { id: 'payouts', label: 'Payouts & Withdrawals' },
    { id: 'security_kyc', label: 'Security & KYC' },
  ];

  const filteredFaqs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return faqItems.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q) ||
        item.highlights.some((h) => h.toLowerCase().includes(q))
      );
    });
  }, [faqItems, selectedCategory, searchQuery]);

  const toggleItem = (id: string) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const allVisibleOpen =
    filteredFaqs.length > 0 && filteredFaqs.every((item) => openIds.includes(item.id));

  const toggleExpandAll = () => {
    if (allVisibleOpen) {
      setOpenIds([]);
    } else {
      setOpenIds(filteredFaqs.map((item) => item.id));
    }
  };

  const handleActionClick = (actionType?: FaqItem['actionType']) => {
    if (!actionType) return;
    if (actionType === 'plans') {
      onSelectSection('plans');
    } else if (actionType === 'terms') {
      onSelectSection('terms');
    } else if (actionType === 'dashboard' && onOpenDashboard) {
      onOpenDashboard('dashboard');
    } else {
      onOpenAuth('signup');
    }
  };

  return (
    <section
      aria-labelledby="homepage-faq-heading"
      className="bg-[#0B111E]/82 backdrop-blur-md border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6"
    >
      {/* Header & Search */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
            <HelpCircle className="w-4 h-4 shrink-0" />
            <span>Self-Service Knowledge Center</span>
          </div>
          <h2
            id="homepage-faq-heading"
            className="font-display font-bold text-white text-xl sm:text-2xl tracking-tight text-balance"
          >
            Frequently Asked Questions on Vault Deposits &amp; AI Packages
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Live answers synchronized with current {platformConfig.companyName} deposit channels,
            package yields, weekday earning schedules, and payout policies.
          </p>
        </div>

        {/* Instant Search Input */}
        <div className="w-full lg:w-80 space-y-2 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search TXID, USDT, weekend, lock, KYC..."
              aria-label="Search frequently asked questions"
              className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-700/90 bg-slate-900/90 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear FAQ search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category Filter Tabs & Expand/Collapse Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="FAQ topic categories"
          className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-900/90 border border-slate-800 text-xs"
        >
          {categories.map((cat) => {
            const count =
              cat.id === 'all'
                ? faqItems.length
                : faqItems.filter((f) => f.category === cat.id).length;
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={toggleExpandAll}
          disabled={filteredFaqs.length === 0}
          className="text-xs font-medium text-slate-300 hover:text-amber-300 transition-colors whitespace-nowrap self-start sm:self-auto disabled:opacity-40"
        >
          {allVisibleOpen ? 'Collapse All Answers' : 'Expand All Answers'}
        </button>
      </div>

      {/* Accordion List */}
      {filteredFaqs.length === 0 ? (
        <div className="py-10 text-center space-y-3 border-t border-slate-800/80">
          <p className="text-sm font-medium text-white">
            No matching questions found for &ldquo;{searchQuery}&rdquo;
          </p>
          <p className="text-xs text-slate-400">
            Try searching a broader term like deposit, package, profit, or withdrawal.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition-colors"
          >
            Reset FAQ Filters
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/80 border-t border-b border-slate-800/80">
          {filteredFaqs.map((item, idx) => {
            const isOpen = openIds.includes(item.id);
            const vote = helpfulVotes[item.id];
            const indexLabel = String(idx + 1).padStart(2, '0');
            const panelId = `faq-panel-${item.id}`;
            const buttonId = `faq-trigger-${item.id}`;

            return (
              <div key={item.id} className="transition-colors">
                <button
                  id={buttonId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggleItem(item.id)}
                  className="w-full py-4 sm:py-5 text-left flex items-start justify-between gap-4 group focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-lg"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <span className="font-mono text-xs text-amber-400/90 tabular-nums pt-0.5 shrink-0">
                      {indexLabel}.
                    </span>
                    <div className="min-w-0 space-y-1">
                      <div className="text-xs text-slate-400">
                        {item.categoryLabel}
                      </div>
                      <h3
                        className={`font-display font-semibold text-sm sm:text-base transition-colors ${
                          isOpen
                            ? 'text-amber-300'
                            : 'text-white group-hover:text-amber-200'
                        }`}
                      >
                        {item.question}
                      </h3>
                    </div>
                  </div>

                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 mt-1 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-amber-400' : 'group-hover:text-white'
                    }`}
                  />
                </button>

                {isOpen && (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className="pl-9 sm:pl-10 pr-2 pb-5 space-y-4"
                  >
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-4xl">
                      {item.answer}
                    </p>

                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {item.highlights.map((point) => (
                        <li key={point} className="flex items-start gap-2">
                          <span className="text-amber-400 font-mono select-none">–</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-slate-800/60">
                      <div className="flex flex-wrap items-center gap-3 text-slate-400">
                        {vote === 'yes' ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Glad this answered your question.</span>
                          </span>
                        ) : vote === 'need_help' ? (
                          <span className="text-amber-300">
                            Need account-specific help?{' '}
                            {isSignedIn && onOpenDashboard ? (
                              <button
                                type="button"
                                onClick={() => onOpenDashboard('dashboard')}
                                className="underline font-semibold hover:text-white"
                              >
                                Open Live Support inside your Vault Dashboard
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onOpenAuth('signin')}
                                className="underline font-semibold hover:text-white"
                              >
                                Sign in to open a tracked Support Ticket
                              </button>
                            )}
                            .
                          </span>
                        ) : (
                          <>
                            <span>Did this answer your question?</span>
                            <button
                              type="button"
                              onClick={() =>
                                setHelpfulVotes((prev) => ({ ...prev, [item.id]: 'yes' }))
                              }
                              className="text-slate-200 hover:text-emerald-400 font-medium underline underline-offset-4 transition-colors"
                            >
                              Yes, resolved
                            </button>
                            <span aria-hidden="true">·</span>
                            <button
                              type="button"
                              onClick={() =>
                                setHelpfulVotes((prev) => ({ ...prev, [item.id]: 'need_help' }))
                              }
                              className="text-slate-400 hover:text-amber-300 font-medium underline underline-offset-4 transition-colors"
                            >
                              Still need help
                            </button>
                          </>
                        )}
                      </div>

                      {item.actionLabel && item.actionType && (
                        <button
                          type="button"
                          onClick={() => handleActionClick(item.actionType)}
                          className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-semibold whitespace-nowrap transition-colors"
                        >
                          <span>{item.actionLabel}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Quiet Bottom Action Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs">
        <p className="text-slate-400">
          Still have an account-specific question about a transaction ID or payout?{' '}
          {platformConfig.supportLinks?.supportEmail && (
            <>
              Reach our desk at{' '}
              <a
                href={`mailto:${platformConfig.supportLinks.supportEmail}`}
                className="text-amber-300 hover:text-amber-200 font-medium underline underline-offset-4"
              >
                {platformConfig.supportLinks.supportEmail}
              </a>{' '}
              or open a tracked ticket inside your dashboard.
            </>
          )}
        </p>
        <button
          type="button"
          onClick={() =>
            isSignedIn && onOpenDashboard ? onOpenDashboard('dashboard') : onOpenAuth('signup')
          }
          className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-auto transition-colors"
        >
          <span>{isSignedIn ? 'Open Vault Dashboard' : 'Get Started Free'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </section>
  );
};
