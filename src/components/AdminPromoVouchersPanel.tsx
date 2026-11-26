import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Copy,
  Gift,
  Loader2,
  Percent,
  Plus,
  Tag,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from 'lucide-react';
import { PromoCode, PromoCodeType, PromoRedemption } from '../types/platform';
import { formatTimestamp } from '../utils/investmentMath';

interface AdminPromoVouchersPanelProps {
  promoCodes: PromoCode[];
  promoRedemptions: PromoRedemption[];
  onCreatePromoCode: (params: {
    code: string;
    title: string;
    description: string;
    type: PromoCodeType;
    discountPercent: number;
    bonusUsd: number;
    minAmountUsd: number;
    maxTotalUses: number;
    maxUsesPerUser: number;
    expiresAtMs: number;
    active: boolean;
  }) => Promise<void>;
  onUpdatePromoCode: (
    codeId: string,
    patch: Partial<
      Pick<
        PromoCode,
        | 'title'
        | 'description'
        | 'type'
        | 'discountPercent'
        | 'bonusUsd'
        | 'minAmountUsd'
        | 'maxTotalUses'
        | 'maxUsesPerUser'
        | 'expiresAtMs'
        | 'active'
      >
    >
  ) => Promise<void>;
  onDeletePromoCode: (codeId: string) => Promise<void>;
  onNotify: (type: 'ok' | 'err', text: string) => void;
}

const PROMO_TYPE_META: Record<
  PromoCodeType,
  { label: string; badge: string; summary: string }
> = {
  withdrawal_fee_waiver: {
    label: '0% Withdrawal Fee Waiver',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    summary: '100% withdrawal fee waiver during payout request',
  },
  withdrawal_fee_discount: {
    label: 'Withdrawal Fee % Discount',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    summary: 'Partial percentage discount off withdrawal fee',
  },
  deposit_bonus_usd: {
    label: 'Deposit Bonus Credit (USD)',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    summary: 'Credits USD bonus to Deposit Wallet (requires min approved deposits)',
  },
  milestone_bonus_usd: {
    label: 'Milestone Bonus Credit (USD)',
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
    summary: 'Credits USD bonus to Income Wallet (requires min total invested)',
  },
};

export const AdminPromoVouchersPanel: React.FC<AdminPromoVouchersPanelProps> = ({
  promoCodes,
  promoRedemptions,
  onCreatePromoCode,
  onUpdatePromoCode,
  onDeletePromoCode,
  onNotify,
}) => {
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<PromoCodeType>('withdrawal_fee_waiver');
  const [discountPercent, setDiscountPercent] = useState('100');
  const [bonusUsd, setBonusUsd] = useState('25');
  const [minAmountUsd, setMinAmountUsd] = useState('50');
  const [maxTotalUses, setMaxTotalUses] = useState('100');
  const [maxUsesPerUser, setMaxUsesPerUser] = useState('1');
  const [expiryDate, setExpiryDate] = useState('');
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');

  const stats = useMemo(() => {
    const now = Date.now();
    const activeCount = promoCodes.filter(
      (p) => p.active && (p.expiresAtMs === 0 || p.expiresAtMs > now) && p.currentUses < p.maxTotalUses
    ).length;
    const totalFeeSaved = promoRedemptions.reduce((s, r) => s + (Number(r.feeSavedUsd) || 0), 0);
    const totalBonuses = promoRedemptions.reduce((s, r) => s + (Number(r.bonusCreditedUsd) || 0), 0);
    return {
      totalCodes: promoCodes.length,
      activeCount,
      totalRedemptions: promoRedemptions.length,
      totalFeeSaved,
      totalBonuses,
    };
  }, [promoCodes, promoRedemptions]);

  const applyQuickTemplate = (preset: 'zero_fee' | 'half_fee' | 'deposit_25' | 'vip_100') => {
    const in30Days = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    setExpiryDate(in30Days);
    if (preset === 'zero_fee') {
      setCode('ZEROFEE30');
      setTitle('0% Withdrawal Fee Pass');
      setDescription('Waives 100% of platform withdrawal fees on one payout.');
      setType('withdrawal_fee_waiver');
      setDiscountPercent('100');
      setBonusUsd('0');
      setMinAmountUsd('25');
      setMaxTotalUses('250');
      setMaxUsesPerUser('1');
    } else if (preset === 'half_fee') {
      setCode('SAVE50FEE');
      setTitle('50% Withdrawal Fee Discount');
      setDescription('Cuts withdrawal platform fees in half for active investors.');
      setType('withdrawal_fee_discount');
      setDiscountPercent('50');
      setBonusUsd('0');
      setMinAmountUsd('50');
      setMaxTotalUses('500');
      setMaxUsesPerUser('2');
    } else if (preset === 'deposit_25') {
      setCode('FUND500GET25');
      setTitle('$25 Deposit Milestone Voucher');
      setDescription('Instant $25 Deposit Wallet bonus for investors with $500+ approved deposits.');
      setType('deposit_bonus_usd');
      setDiscountPercent('0');
      setBonusUsd('25');
      setMinAmountUsd('500');
      setMaxTotalUses('100');
      setMaxUsesPerUser('1');
    } else {
      setCode('VIP100REWARD');
      setTitle('$100 VIP Milestone Reward');
      setDescription('Rewards investors reaching $2,500+ in active AI packages with $100 credit.');
      setType('milestone_bonus_usd');
      setDiscountPercent('0');
      setBonusUsd('100');
      setMinAmountUsd('2500');
      setMaxTotalUses('50');
      setMaxUsesPerUser('1');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '');
    if (cleanCode.length < 3) {
      onNotify('err', 'Code must contain at least 3 letters or numbers.');
      return;
    }
    const expiresAtMs = expiryDate
      ? new Date(`${expiryDate}T23:59:59`).getTime()
      : 0;
    if (expiryDate && (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now())) {
      onNotify('err', 'Expiry date must be in the future (or leave blank for no expiry).');
      return;
    }

    setSubmitting(true);
    try {
      await onCreatePromoCode({
        code: cleanCode,
        title: title.trim() || cleanCode,
        description: description.trim(),
        type,
        discountPercent: type === 'withdrawal_fee_waiver' ? 100 : Number(discountPercent) || 0,
        bonusUsd:
          type === 'deposit_bonus_usd' || type === 'milestone_bonus_usd'
            ? Number(bonusUsd) || 0
            : 0,
        minAmountUsd: Math.max(0, Number(minAmountUsd) || 0),
        maxTotalUses: Math.max(1, Math.floor(Number(maxTotalUses) || 100)),
        maxUsesPerUser: Math.max(1, Math.floor(Number(maxUsesPerUser) || 1)),
        expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : 0,
        active,
      });
      setCode('');
      setTitle('');
      setDescription('');
      onNotify('ok', `Promo voucher "${cleanCode}" created and live.`);
    } catch (err) {
      onNotify('err', (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = (c: string) => {
    navigator.clipboard?.writeText(c).catch(() => {});
    setCopiedCode(c);
    window.setTimeout(() => setCopiedCode(''), 1500);
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Active Promo Codes
          </div>
          <div className="text-2xl font-mono font-extrabold text-slate-900 mt-1">
            {stats.activeCount}{' '}
            <span className="text-xs font-normal text-slate-400">/ {stats.totalCodes}</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Redemptions
          </div>
          <div className="text-2xl font-mono font-extrabold text-indigo-600 mt-1">
            {stats.totalRedemptions}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Withdrawal Fees Waived
          </div>
          <div className="text-2xl font-mono font-extrabold text-emerald-600 mt-1">
            ${stats.totalFeeSaved.toFixed(2)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Bonus Vouchers Credited
          </div>
          <div className="text-2xl font-mono font-extrabold text-amber-600 mt-1">
            ${stats.totalBonuses.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Create Promo Code Form */}
      <form
        onSubmit={handleCreate}
        className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Tag className="w-4 h-4 text-orange-500" />
              Create Promo &amp; Fee-Waiver Voucher Code
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Server-validated codes with expiry timestamps, global claim caps, and per-user usage
              limits.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => applyQuickTemplate('zero_fee')}
              className="px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-100"
            >
              Preset: 0% Fee Waiver
            </button>
            <button
              type="button"
              onClick={() => applyQuickTemplate('half_fee')}
              className="px-2.5 py-1.5 rounded-lg border border-sky-200 bg-sky-50 text-sky-700 text-[11px] font-semibold hover:bg-sky-100"
            >
              Preset: 50% Fee Off
            </button>
            <button
              type="button"
              onClick={() => applyQuickTemplate('deposit_25')}
              className="px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-[11px] font-semibold hover:bg-amber-100"
            >
              Preset: $25 Deposit Bonus
            </button>
            <button
              type="button"
              onClick={() => applyQuickTemplate('vip_100')}
              className="px-2.5 py-1.5 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 text-[11px] font-semibold hover:bg-violet-100"
            >
              Preset: $100 VIP Milestone
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Voucher Code (A-Z, 0-9, -, _)
            </label>
            <input
              type="text"
              required
              maxLength={24}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
              placeholder="e.g. ZEROFEE30"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 font-mono font-bold text-sm uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Campaign Title
            </label>
            <input
              type="text"
              required
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Zero Fee Weekend Promo"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Voucher Type
            </label>
            <select
              value={type}
              onChange={(e) => {
                const next = e.target.value as PromoCodeType;
                setType(next);
                if (next === 'withdrawal_fee_waiver') setDiscountPercent('100');
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 text-sm bg-white"
            >
              {(Object.keys(PROMO_TYPE_META) as PromoCodeType[]).map((k) => (
                <option key={k} value={k}>
                  {PROMO_TYPE_META[k].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {type === 'withdrawal_fee_discount' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fee Discount (%)
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 font-mono text-sm"
              />
            </div>
          )}

          {(type === 'deposit_bonus_usd' || type === 'milestone_bonus_usd') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bonus Credit (USD)
              </label>
              <input
                type="number"
                min={1}
                max={10000}
                step="0.01"
                value={bonusUsd}
                onChange={(e) => setBonusUsd(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 font-mono text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {type === 'deposit_bonus_usd'
                ? 'Min Approved Deposits ($)'
                : type === 'milestone_bonus_usd'
                ? 'Min Total Invested ($)'
                : 'Min Withdrawal ($)'}
            </label>
            <input
              type="number"
              min={0}
              max={1000000}
              value={minAmountUsd}
              onChange={(e) => setMinAmountUsd(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Max Global Uses
            </label>
            <input
              type="number"
              min={1}
              max={1000000}
              value={maxTotalUses}
              onChange={(e) => setMaxTotalUses(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Max Uses Per User
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={maxUsesPerUser}
              onChange={(e) => setMaxUsesPerUser(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Expiry Date (Optional)
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <input
              type="text"
              maxLength={240}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description shown to investors when applying this code..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 text-xs"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 accent-orange-500"
            />
            Active immediately
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Voucher Code
          </button>
        </div>
      </form>

      {/* Existing Promo Codes Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">
            Manage Promo &amp; Fee-Waiver Codes ({promoCodes.length})
          </h3>
        </div>
        {promoCodes.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No promo codes created yet. Use one of the presets above to launch your first campaign.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Type &amp; Benefit</th>
                  <th className="px-4 py-3">Min Req</th>
                  <th className="px-4 py-3">Usage / Cap</th>
                  <th className="px-4 py-3">Expiry</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {promoCodes.map((p) => {
                  const expired = p.expiresAtMs > 0 && Date.now() > p.expiresAtMs;
                  const exhausted = p.currentUses >= p.maxTotalUses;
                  const meta = PROMO_TYPE_META[p.type];
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-extrabold text-slate-900">{p.code}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(p.code)}
                            title="Copy code"
                            className="p-1 rounded hover:bg-slate-200 text-slate-500"
                          >
                            {copiedCode === p.code ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-500">{p.title}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold ${meta.badge}`}
                        >
                          {p.type.includes('fee') ? (
                            <Percent className="w-3 h-3" />
                          ) : (
                            <Gift className="w-3 h-3" />
                          )}
                          {p.type === 'withdrawal_fee_waiver'
                            ? '0% Fee (100% Off)'
                            : p.type === 'withdrawal_fee_discount'
                            ? `${p.discountPercent}% Fee Off`
                            : `+$${p.bonusUsd.toFixed(2)} Bonus`}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">
                        ${Number(p.minAmountUsd || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">
                        {p.currentUses} / {p.maxTotalUses}
                        <span className="text-[10px] text-slate-400 block">
                          {p.maxUsesPerUser}/user max
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {p.expiresAtMs > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {new Date(p.expiresAtMs).toISOString().slice(0, 10)}
                          </span>
                        ) : (
                          'Never'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {expired ? (
                          <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                            Expired
                          </span>
                        ) : exhausted ? (
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                            Max Reached
                          </span>
                        ) : p.active ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold">
                            Paused
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            title={p.active ? 'Pause code' : 'Activate code'}
                            onClick={() =>
                              void onUpdatePromoCode(p.code, { active: !p.active }).then(() =>
                                onNotify(
                                  'ok',
                                  `Code ${p.code} ${!p.active ? 'activated' : 'paused'}.`
                                )
                              )
                            }
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700"
                          >
                            {p.active ? (
                              <ToggleRight className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <ToggleLeft className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                          <button
                            type="button"
                            title="Delete code"
                            onClick={() =>
                              void onDeletePromoCode(p.code).then(() =>
                                onNotify('ok', `Deleted promo code ${p.code}.`)
                              )
                            }
                            className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Live Redemption Audit Log */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">
            Recent Voucher Redemptions ({promoRedemptions.length})
          </h3>
        </div>
        {promoRedemptions.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No redemptions recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">User Email</th>
                  <th className="px-4 py-2.5">Code</th>
                  <th className="px-4 py-2.5">Applied To</th>
                  <th className="px-4 py-2.5">Fee Saved</th>
                  <th className="px-4 py-2.5">Bonus Credited</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {promoRedemptions.slice(0, 50).map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5 font-mono text-slate-500">
                      {formatTimestamp(r.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{r.userEmail}</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-orange-600">{r.code}</td>
                    <td className="px-4 py-2.5 text-slate-600 capitalize">
                      {r.appliedTo.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold text-emerald-600">
                      ${Number(r.feeSavedUsd || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold text-amber-600">
                      ${Number(r.bonusCreditedUsd || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
