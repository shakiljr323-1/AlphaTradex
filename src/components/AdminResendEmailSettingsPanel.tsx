import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Bot,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  Megaphone,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Server,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  AdminEmailConfigStatus,
  AdminTelegramConfigStatus,
  EmailAutomationToggles,
  EmailProviderMode,
  SecurityAuditLog,
  UserProfile,
} from '../types/platform';
import { formatTimestamp } from '../utils/investmentMath';

interface AdminResendEmailSettingsPanelProps {
  authUserEmail: string;
  getIdToken: () => Promise<string>;
  allUsers?: UserProfile[];
  auditLogs: SecurityAuditLog[];
  onNotify: (type: 'ok' | 'err', text: string) => void;
}

type SubTab = 'credentials' | 'automation' | 'broadcast' | 'telegram';

const SMTP_PRESETS = [
  { id: 'hostinger', label: 'Hostinger Mail', host: 'smtp.hostinger.com', port: 465, secure: true },
  { id: 'zoho', label: 'Zoho Mail', host: 'smtp.zoho.com', port: 465, secure: true },
  { id: 'gmail', label: 'Gmail App Pass', host: 'smtp.gmail.com', port: 465, secure: true },
  { id: 'cpanel', label: 'cPanel / Domain', host: 'mail.yourdomain.com', port: 465, secure: true },
  { id: 'outlook', label: 'Outlook / 365', host: 'smtp.office365.com', port: 587, secure: false },
];

export const AdminResendEmailSettingsPanel: React.FC<AdminResendEmailSettingsPanelProps> = ({
  authUserEmail,
  getIdToken,
  allUsers = [],
  auditLogs,
  onNotify,
}) => {
  const [subTab, setSubTab] = useState<SubTab>('credentials');

  // Email & SMTP Config State
  const [config, setConfig] = useState<AdminEmailConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [providerMode, setProviderMode] = useState<EmailProviderMode>('auto');

  // Company Email (SMTP + Pass Key) Form State
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('465');
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [smtpUser, setSmtpUser] = useState('');
  const [newSmtpPass, setNewSmtpPass] = useState('');
  const [showNewSmtpPass, setShowNewSmtpPass] = useState(false);
  const [smtpFromName, setSmtpFromName] = useState('AlphaTradex');
  const [smtpFromEmail, setSmtpFromEmail] = useState('');

  // Resend API Form State
  const [newApiKey, setNewApiKey] = useState('');
  const [showNewKey, setShowNewKey] = useState(false);
  const [fromEmailInput, setFromEmailInput] = useState('');

  // Automation Event Toggles
  const [automation, setAutomation] = useState<EmailAutomationToggles>({
    welcomeEmailEnabled: true,
    depositConfirmedEmailEnabled: true,
    withdrawalStatusEmailEnabled: true,
    kycStatusEmailEnabled: true,
    loginAlertEmailEnabled: true,
  });

  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  // Test Email State
  const [testRecipient, setTestRecipient] = useState(authUserEmail || '');
  const [testProvider, setTestProvider] = useState<'auto' | 'smtp' | 'resend'>('auto');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    messageId?: string;
    providerUsed?: string;
    fromEmail?: string;
  } | null>(null);

  // Bulk Email Broadcast State
  const [broadcastSegment, setBroadcastSegment] = useState<
    'all' | 'investors' | 'kyc_approved' | 'kyc_pending' | 'mentors' | 'custom'
  >('all');
  const [customEmailsRaw, setCustomEmailsRaw] = useState('');
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastBody, setBroadcastBody] = useState(
    'Hello {{name}},\n\nWe have an important platform update from the AlphaTradex Desk.'
  );
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{
    ok: boolean;
    message: string;
    sentCount?: number;
    failedCount?: number;
  } | null>(null);

  // Telegram Admin Bot State
  const [tgConfig, setTgConfig] = useState<AdminTelegramConfigStatus | null>(null);
  const [tgEnabled, setTgEnabled] = useState(true);
  const [newTgToken, setNewTgToken] = useState('');
  const [showNewTgToken, setShowNewTgToken] = useState(false);
  const [tgChatId, setTgChatId] = useState('');
  const [showTgChatId, setShowTgChatId] = useState(false);
  const [tgAlertDeposits, setTgAlertDeposits] = useState(true);
  const [tgDepositThreshold, setTgDepositThreshold] = useState('100');
  const [tgAlertKyc, setTgAlertKyc] = useState(true);
  const [tgAlertWithdrawals, setTgAlertWithdrawals] = useState(true);
  const [savingTg, setSavingTg] = useState(false);
  const [testingTg, setTestingTg] = useState(false);
  const [tgFeedback, setTgFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const maskShortValue = (raw: string): string => {
    const clean = String(raw || '').trim();
    if (!clean) return 'Not Configured';
    if (clean.length <= 4) return '••••';
    return `••••••${clean.slice(-4)}`;
  };

  useEffect(() => {
    if (authUserEmail && !testRecipient) {
      setTestRecipient(authUserEmail);
    }
  }, [authUserEmail, testRecipient]);

  const applyEmailConfigState = (st: AdminEmailConfigStatus) => {
    setConfig(st);
    setProviderMode(st.providerMode || 'auto');
    setSmtpHost(st.smtpHost || '');
    setSmtpPort(String(st.smtpPort || 465));
    setSmtpSecure(st.smtpSecure ?? true);
    setSmtpUser(st.smtpUser || '');
    setSmtpFromName(st.smtpFromName || 'AlphaTradex');
    setSmtpFromEmail(st.smtpFromEmail || '');
    setFromEmailInput(st.databaseFromEmail || '');
    if (st.automation) setAutomation(st.automation);
  };

  const applyTelegramConfigState = (st: AdminTelegramConfigStatus) => {
    setTgConfig(st);
    setTgEnabled(st.botTokenConfigured ? st.enabled : true);
    setTgChatId(st.adminChatId || '');
    setTgAlertDeposits(st.alertOnDeposits);
    setTgDepositThreshold(String(st.largeDepositThresholdUsd ?? 100));
    setTgAlertKyc(st.alertOnKyc);
    setTgAlertWithdrawals(st.alertOnWithdrawals);
  };

  const fetchAllConfigs = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setLoadError(null);
      try {
        const token = await getIdToken();
        const [emailRes, tgRes] = await Promise.all([
          fetch('/api/admin/email-config', {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('/api/admin/telegram-config', {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const emailData = (await emailRes.json().catch(() => ({}))) as Partial<AdminEmailConfigStatus> & {
          error?: string;
        };
        if (!emailRes.ok) {
          throw new Error(emailData.error || `Failed to load email settings (HTTP ${emailRes.status}).`);
        }
        applyEmailConfigState(emailData as AdminEmailConfigStatus);

        const tgData = (await tgRes.json().catch(() => ({}))) as Partial<AdminTelegramConfigStatus> & {
          error?: string;
        };
        if (tgRes.ok && tgData.ok) {
          applyTelegramConfigState(tgData as AdminTelegramConfigStatus);
        }
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : 'Unable to load Email & Telegram configuration.'
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [getIdToken]
  );

  useEffect(() => {
    void fetchAllConfigs(false);
  }, [fetchAllConfigs]);

  const broadcastRecipients = useMemo(() => {
    if (broadcastSegment === 'custom') {
      return customEmailsRaw
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter((s) => s.includes('@'))
        .map((email) => ({ email, name: 'Valued Client' }));
    }
    const filtered = allUsers.filter((u) => {
      if (!u.email) return false;
      if (broadcastSegment === 'investors') return Number(u.totalInvested || 0) > 0;
      if (broadcastSegment === 'kyc_approved') return u.kycStatus === 'approved';
      if (broadcastSegment === 'kyc_pending') return u.kycStatus !== 'approved';
      if (broadcastSegment === 'mentors') return u.isMentor === true;
      return true;
    });
    return filtered.map((u) => ({ email: u.email, name: u.fullName || u.handle || 'Investor' }));
  }, [allUsers, broadcastSegment, customEmailsRaw]);

  const relevantAuditLogs = useMemo(
    () =>
      auditLogs
        .filter(
          (l) =>
            l.eventType === 'EMAIL_API_CONFIG_UPDATED' ||
            l.eventType === 'EMAIL_API_TEST_SENT' ||
            l.eventType === 'TELEGRAM_CONFIG_UPDATED' ||
            l.eventType === 'TELEGRAM_TEST_SENT' ||
            l.eventType === 'BULK_EMAIL_BROADCAST_SENT'
        )
        .slice(0, 25),
    [auditLogs]
  );

  const handleSaveEmailConfig = async (overrides?: {
    clearDatabaseApiKey?: boolean;
    clearDatabaseFromEmail?: boolean;
    clearDatabaseSmtpPass?: boolean;
  }) => {
    setSaveFeedback(null);
    setSaving(true);
    try {
      const token = await getIdToken();
      const payload: Record<string, unknown> = {
        providerMode,
        resendFromEmail: fromEmailInput.trim(),
        smtpHost: smtpHost.trim(),
        smtpPort: Number(smtpPort) || 465,
        smtpSecure,
        smtpUser: smtpUser.trim(),
        smtpFromName: smtpFromName.trim() || 'AlphaTradex',
        smtpFromEmail: smtpFromEmail.trim(),
        automation,
        ...overrides,
      };
      if (newApiKey.trim()) payload.resendApiKey = newApiKey.trim();
      if (newSmtpPass.trim()) payload.smtpPass = newSmtpPass.trim();

      const res = await fetch('/api/admin/email-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<AdminEmailConfigStatus> & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || `Failed to save email settings (HTTP ${res.status}).`);
      }

      applyEmailConfigState(data as AdminEmailConfigStatus);
      // Immediately clear unsaved secrets from browser state
      setNewApiKey('');
      setShowNewKey(false);
      setNewSmtpPass('');
      setShowNewSmtpPass(false);

      const okMsg =
        data.message ||
        'Company Email (SMTP), Resend API & automation settings saved live without redeploying.';
      setSaveFeedback({ type: 'ok', text: okMsg });
      onNotify('ok', okMsg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to save Email & SMTP settings.';
      setSaveFeedback({ type: 'err', text: msg });
      onNotify('err', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    setTestResult(null);
    setSendingTest(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/admin/email-config/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          toEmail: testRecipient.trim() || authUserEmail,
          forceProvider: testProvider === 'auto' ? undefined : testProvider,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        messageId?: string;
        providerUsed?: string;
        fromEmail?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        const errMsg = data.error || `Test email failed (HTTP ${res.status}).`;
        setTestResult({ ok: false, message: errMsg, providerUsed: data.providerUsed });
        onNotify('err', errMsg);
        return;
      }
      const okMsg = data.message || 'Test email delivered!';
      setTestResult({
        ok: true,
        message: okMsg,
        messageId: data.messageId,
        providerUsed: data.providerUsed,
        fromEmail: data.fromEmail,
      });
      onNotify('ok', okMsg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send test email.';
      setTestResult({ ok: false, message: msg });
      onNotify('err', msg);
    } finally {
      setSendingTest(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcastResult(null);
    if (broadcastRecipients.length === 0) {
      setBroadcastResult({ ok: false, message: 'No recipients in selected audience segment.' });
      return;
    }
    setSendingBroadcast(true);
    try {
      const token = await getIdToken();
      const segmentNames: Record<typeof broadcastSegment, string> = {
        all: 'All Platform Clients',
        investors: 'Active Investors',
        kyc_approved: 'KYC Verified Clients',
        kyc_pending: 'Pending / Unverified KYC Clients',
        mentors: 'Active Mentors',
        custom: 'Custom Recipient List',
      };
      const res = await fetch('/api/admin/email/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          segmentLabel: segmentNames[broadcastSegment],
          subject: broadcastSubject.trim(),
          message: broadcastBody.trim(),
          recipients: broadcastRecipients,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        sentCount?: number;
        failedCount?: number;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Broadcast failed.');
      }
      const msg = data.message || 'Broadcast completed.';
      setBroadcastResult({
        ok: Boolean(data.ok),
        message: msg,
        sentCount: data.sentCount,
        failedCount: data.failedCount,
      });
      onNotify(data.ok ? 'ok' : 'err', msg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Broadcast request failed.';
      setBroadcastResult({ ok: false, message: msg });
      onNotify('err', msg);
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleSaveTelegram = async (clearToken = false) => {
    setTgFeedback(null);
    setSavingTg(true);
    try {
      const token = await getIdToken();
      const payload: Record<string, unknown> = {
        enabled: tgEnabled,
        adminChatId: tgChatId.trim(),
        alertOnDeposits: tgAlertDeposits,
        largeDepositThresholdUsd: Math.max(0, Number(tgDepositThreshold) || 0),
        alertOnKyc: tgAlertKyc,
        alertOnWithdrawals: tgAlertWithdrawals,
        clearDatabaseBotToken: clearToken,
      };
      if (newTgToken.trim()) payload.botToken = newTgToken.trim();

      const res = await fetch('/api/admin/telegram-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<AdminTelegramConfigStatus> & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Unable to save Telegram Bot configuration.');
      }
      applyTelegramConfigState(data as AdminTelegramConfigStatus);
      setNewTgToken('');
      setShowNewTgToken(false);
      const okMsg = data.message || 'Telegram Admin Bot settings saved.';
      setTgFeedback({ type: 'ok', text: okMsg });
      onNotify('ok', okMsg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save Telegram settings.';
      setTgFeedback({ type: 'err', text: msg });
      onNotify('err', msg);
    } finally {
      setSavingTg(false);
    }
  };

  const handleTestTelegram = async () => {
    setTgFeedback(null);
    setTestingTg(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/admin/telegram-config/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Telegram test alert failed.');
      }
      const okMsg = data.message || 'Telegram test alert sent!';
      setTgFeedback({ type: 'ok', text: okMsg });
      onNotify('ok', okMsg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to send Telegram test alert.';
      setTgFeedback({ type: 'err', text: msg });
      onNotify('err', msg);
    } finally {
      setTestingTg(false);
    }
  };

  return (
    <section className="space-y-6">
      {/* Top Hero Banner */}
      <div className="bg-gradient-to-r from-[#0B111E] via-[#101C33] to-[#0D2136] text-white rounded-2xl p-6 border border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[11px] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              Database-Primary Secret Vault &bull; Masked UI &bull; Zero-Redeploy Updates
            </div>
            <h2 className="font-display font-bold text-xl tracking-tight flex items-center gap-2">
              <Mail className="w-5 h-5 text-emerald-400" />
              Integration &amp; Notifications
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Manually configure your primary SMTP email settings (<code className="text-emerald-300">SMTP_HOST</code>,{' '}
              <code className="text-emerald-300">SMTP_PORT</code>, <code className="text-emerald-300">SMTP_SECURE</code>,{' '}
              <code className="text-emerald-300">SMTP_USER</code>, <code className="text-emerald-300">SMTP_PASS</code>,{' '}
              <code className="text-emerald-300">SMTP_FROM_EMAIL</code>) and Telegram Bot alerts (
              <code className="text-sky-300">TELEGRAM_BOT_TOKEN</code>, <code className="text-sky-300">TELEGRAM_ADMIN_CHAT_ID</code>).
              Values are saved securely to Firestore, masked in the UI, and used as the primary configuration for all system emails and bot alerts.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void fetchAllConfigs(false)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Sub-Navigation Pills */}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
          {[
            { id: 'credentials' as const, label: 'SMTP & Telegram Credentials', Icon: Server },
            { id: 'automation' as const, label: 'Auto-Email Alerts', Icon: Bell },
            { id: 'broadcast' as const, label: 'Bulk Email Campaign', Icon: Megaphone },
            { id: 'telegram' as const, label: 'Telegram Setup Guide', Icon: Bot },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubTab(id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                subTab === id
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {loadError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 flex items-start gap-3 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <div>
            <div className="font-bold">Could not load settings</div>
            <p className="mt-0.5 text-rose-700">{loadError}</p>
          </div>
        </div>
      )}

      {/* Live Engine Summary Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 uppercase">
            <span>Active Email Engine</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                config?.activeProvider && config.activeProvider !== 'none'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {config?.activeProvider === 'smtp'
                ? 'COMPANY SMTP LIVE'
                : config?.activeProvider === 'resend'
                ? 'RESEND API LIVE'
                : 'NOT CONFIGURED'}
            </span>
          </div>
          <div className="font-mono text-xs font-bold text-slate-900 mt-2 truncate">
            {config?.activeProvider === 'smtp'
              ? config.smtpUser || 'SMTP Active'
              : config?.activeProvider === 'resend'
              ? config.apiKeyMasked
              : 'Add Company Mail or Resend Key below'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Mode: <strong className="uppercase">{config?.providerMode || 'auto'}</strong>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 uppercase">
            <span>Company Mail (SMTP)</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                config?.smtpConfigured
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {config?.smtpConfigured ? 'CONFIGURED' : 'READY TO ADD'}
            </span>
          </div>
          <div className="font-mono text-xs font-bold text-slate-900 mt-2 truncate">
            {config?.smtpPassConfigured
              ? `${config.smtpUser || 'SMTP'} (${config.smtpPassMasked})`
              : 'Pass Key Not Set'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            Host: {config?.smtpHost || 'Not set yet'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 uppercase">
            <span>Telegram Admin Bot</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                tgConfig?.enabled && tgConfig?.botTokenConfigured
                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {tgConfig?.enabled && tgConfig?.botTokenConfigured ? 'ALERTS ON' : 'STANDBY'}
            </span>
          </div>
          <div className="font-mono text-xs font-bold text-slate-900 mt-2 truncate">
            {tgConfig?.botTokenConfigured ? tgConfig.botTokenMasked : 'Bot Token Not Set'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Chat ID: <span className="font-mono">{maskShortValue(tgConfig?.adminChatId || '')}</span>{' '}
            &bull; Source: <strong className="uppercase">{tgConfig?.activeTokenSource || 'none'}</strong>
          </div>
        </div>
      </div>

      {/* SUB-TAB 1: COMPANY MAIL (SMTP + PASS KEY) & RESEND CREDENTIALS */}
      {subTab === 'credentials' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            {/* Delivery Provider Mode */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display font-bold text-slate-900 text-sm">
                    Email Delivery Priority Mode
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Choose whether to send via your own Company Email + Pass Key (SMTP), Resend API,
                    or Auto (automatically uses whichever you configure).
                  </p>
                </div>
                <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                  {(
                    [
                      { id: 'auto', label: 'Auto' },
                      { id: 'smtp', label: 'Company SMTP' },
                      { id: 'resend', label: 'Resend API' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setProviderMode(m.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        providerMode === m.id
                          ? 'bg-[#0B111E] text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Company Email + Pass Key (SMTP) Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
                    <Server className="w-4 h-4 text-emerald-600" />
                    Company Email &amp; Pass Key (SMTP)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Whenever you purchase your custom company domain email (or use Gmail/Zoho App
                    Password), enter your email &amp; pass key here — activates immediately with zero
                    code changes.
                  </p>
                </div>
                {config?.hasDatabaseSmtpPass && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleSaveEmailConfig({ clearDatabaseSmtpPass: true })}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:text-amber-800"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Clear Saved Pass Key
                  </button>
                )}
              </div>

              {/* Quick Mail Provider Presets */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-600">Quick SMTP Presets:</div>
                <div className="flex flex-wrap gap-1.5">
                  {SMTP_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSmtpHost(p.host);
                        setSmtpPort(String(p.port));
                        setSmtpSecure(p.secure);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 text-[11px] font-semibold text-slate-700 transition"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                <div className="sm:col-span-6">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    SMTP Mail Server Host <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded ml-1">SMTP_HOST</span>
                  </label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.hostinger.com or smtp.gmail.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 px-3 py-2.5 text-xs font-mono text-slate-900 outline-none"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Port <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded ml-1">SMTP_PORT</span>
                  </label>
                  <input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => {
                      setSmtpPort(e.target.value);
                      if (e.target.value === '465') setSmtpSecure(true);
                      if (e.target.value === '587') setSmtpSecure(false);
                    }}
                    placeholder="465 or 587"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 px-3 py-2.5 text-xs font-mono text-slate-900 outline-none"
                  />
                </div>
                <div className="sm:col-span-3 flex items-end">
                  <label className="w-full flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smtpSecure}
                      onChange={(e) => setSmtpSecure(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600"
                    />
                    <span className="truncate">SMTP_SECURE (SSL)</span>
                  </label>
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    SMTP Username / Email <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded ml-1">SMTP_USER</span>
                  </label>
                  <input
                    type="email"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="support@alphatradex.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 px-3 py-2.5 text-xs font-mono text-slate-900 outline-none"
                  />
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    SMTP Password / Pass Key <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded ml-1">SMTP_PASS</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewSmtpPass ? 'text' : 'password'}
                      value={newSmtpPass}
                      onChange={(e) => setNewSmtpPass(e.target.value)}
                      autoComplete="new-password"
                      placeholder={
                        config?.smtpPassConfigured
                          ? `Saved & Masked (${config.smtpPassMasked}) — enter new to replace`
                          : 'Enter SMTP password or App Pass Key'
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 px-3 py-2.5 pr-9 text-xs font-mono text-slate-900 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewSmtpPass((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showNewSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Sender Display Name
                  </label>
                  <input
                    type="text"
                    value={smtpFromName}
                    onChange={(e) => setSmtpFromName(e.target.value)}
                    placeholder="AlphaTradex Security"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 px-3 py-2.5 text-xs text-slate-900 outline-none"
                  />
                </div>

                <div className="sm:col-span-7">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    From Email Address <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded ml-1">SMTP_FROM_EMAIL</span>
                  </label>
                  <input
                    type="text"
                    value={smtpFromEmail}
                    onChange={(e) => setSmtpFromEmail(e.target.value)}
                    placeholder="AlphaTradex <no-reply@alphatradex.com>"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 px-3 py-2.5 text-xs font-mono text-slate-900 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Primary Telegram Admin Bot Card (All Requested Keys Together) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
                    <Bot className="w-4 h-4 text-sky-600" />
                    Telegram Admin Bot Alerts (Primary Database Config)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Saved in Firestore <code className="font-mono">/adminSecrets/telegramConfig</code>, masked in the UI, and used as the primary configuration for all real-time deposit, withdrawal, and KYC bot alerts.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tgEnabled}
                      onChange={(e) => setTgEnabled(e.target.checked)}
                      className="rounded border-slate-300 text-sky-600 w-4 h-4"
                    />
                    Alerts Enabled
                  </label>
                  {tgConfig?.hasDatabaseBotToken && (
                    <button
                      type="button"
                      disabled={savingTg}
                      onClick={() => void handleSaveTelegram(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:text-amber-800"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Clear Token
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                <div className="sm:col-span-6">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Bot Token <span className="font-mono text-[10px] text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded ml-1">TELEGRAM_BOT_TOKEN</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewTgToken ? 'text' : 'password'}
                      value={newTgToken}
                      onChange={(e) => setNewTgToken(e.target.value)}
                      autoComplete="new-password"
                      placeholder={
                        tgConfig?.botTokenConfigured
                          ? `Saved & Masked (${tgConfig.botTokenMasked}) — enter new to replace`
                          : '123456789:ABCdefGHIjklMNOpqrSTUvwxYZ'
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-500 px-3 py-2.5 pr-9 text-xs font-mono text-slate-900 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewTgToken((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showNewTgToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Admin Chat ID <span className="font-mono text-[10px] text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded ml-1">TELEGRAM_ADMIN_CHAT_ID</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showTgChatId ? 'text' : 'password'}
                      value={tgChatId}
                      onChange={(e) => setTgChatId(e.target.value)}
                      placeholder={
                        tgConfig?.adminChatId
                          ? `Saved & Masked (${maskShortValue(tgConfig.adminChatId)})`
                          : 'e.g. 6123456789 or -1001234567890'
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-500 px-3 py-2.5 pr-9 text-xs font-mono text-slate-900 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTgChatId((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      title={showTgChatId ? 'Hide Chat ID' : 'Reveal Chat ID'}
                    >
                      {showTgChatId ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Large Deposit Alert Threshold (USD)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={tgDepositThreshold}
                    onChange={(e) => setTgDepositThreshold(e.target.value)}
                    placeholder="100"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-500 px-3 py-2 text-xs font-mono text-slate-900 outline-none"
                  />
                </div>

                <div className="sm:col-span-8 flex flex-wrap items-end gap-2">
                  <label className="flex-1 min-w-[95px] flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tgAlertDeposits}
                      onChange={(e) => setTgAlertDeposits(e.target.checked)}
                      className="rounded border-slate-300 text-sky-600"
                    />
                    Deposits
                  </label>
                  <label className="flex-1 min-w-[110px] flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tgAlertWithdrawals}
                      onChange={(e) => setTgAlertWithdrawals(e.target.checked)}
                      className="rounded border-slate-300 text-sky-600"
                    />
                    Withdrawals
                  </label>
                  <label className="flex-1 min-w-[95px] flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tgAlertKyc}
                      onChange={(e) => setTgAlertKyc(e.target.checked)}
                      className="rounded border-slate-300 text-sky-600"
                    />
                    KYC Alerts
                  </label>
                </div>
              </div>

              {tgFeedback && (
                <div
                  className={`rounded-xl px-4 py-3 text-xs border flex items-start gap-2 ${
                    tgFeedback.type === 'ok'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  {tgFeedback.type === 'ok' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span>{tgFeedback.text}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={testingTg || !tgConfig?.botTokenConfigured}
                  onClick={() => void handleTestTelegram()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B111E] hover:bg-slate-800 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {testingTg ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 text-sky-400" />
                  )}
                  Send Test Telegram Alert
                </button>
                <button
                  type="button"
                  disabled={savingTg || loading}
                  onClick={() => void handleSaveTelegram(false)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
                >
                  {savingTg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {savingTg ? 'Saving Telegram...' : 'Save Telegram Bot Settings'}
                </button>
              </div>
            </div>

            {/* Resend API Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-sky-600" />
                    Resend API Key (Optional Alternative / Fallback)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Use Resend API directly or keep it as a backup alongside your Company Email SMTP.
                  </p>
                </div>
                {config?.hasDatabaseApiKey && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleSaveEmailConfig({ clearDatabaseApiKey: true })}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:text-amber-800"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Clear Resend Key
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    RESEND_API_KEY
                  </label>
                  <div className="relative">
                    <input
                      type={showNewKey ? 'text' : 'password'}
                      value={newApiKey}
                      onChange={(e) => setNewApiKey(e.target.value)}
                      autoComplete="new-password"
                      placeholder={
                        config?.apiKeyConfigured
                          ? `Hidden (${config.apiKeyMasked}) — enter new to replace`
                          : 're_xxxxxxxxxxxxxxxxxxxxxxxxx'
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-500 px-3 py-2.5 pr-9 text-xs font-mono text-slate-900 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewKey((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showNewKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    RESEND_FROM_EMAIL
                  </label>
                  <input
                    type="text"
                    value={fromEmailInput}
                    onChange={(e) => setFromEmailInput(e.target.value)}
                    placeholder={
                      config?.envFromEmail || 'AlphaTradex Security <onboarding@resend.dev>'
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-500 px-3 py-2.5 text-xs font-mono text-slate-900 outline-none"
                  />
                </div>
              </div>
            </div>

            {saveFeedback && (
              <div
                className={`rounded-xl px-4 py-3 text-xs flex items-start gap-2.5 border ${
                  saveFeedback.type === 'ok'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {saveFeedback.type === 'ok' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{saveFeedback.text}</span>
              </div>
            )}

            <div className="flex items-center justify-end">
              <button
                type="button"
                disabled={saving || loading}
                onClick={() => void handleSaveEmailConfig()}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving Securely...' : 'Save Company Mail & Email API Settings'}
              </button>
            </div>
          </div>

          {/* Right Column: Live Test Email */}
          <div className="lg:col-span-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4 sticky top-6">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
                  <Send className="w-4 h-4 text-sky-600" />
                  Send Live Test Email
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Verify your saved Company SMTP Pass Key or Resend API key anytime.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Recipient Email
                  </label>
                  <input
                    type="email"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    placeholder={authUserEmail || 'admin@yourdomain.com'}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-900 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Test Engine
                  </label>
                  <select
                    value={testProvider}
                    onChange={(e) => setTestProvider(e.target.value as 'auto' | 'smtp' | 'resend')}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none"
                  >
                    <option value="auto">Active Default ({config?.activeProvider?.toUpperCase() || 'AUTO'})</option>
                    <option value="smtp">Force Test Company SMTP</option>
                    <option value="resend">Force Test Resend API</option>
                  </select>
                </div>

                <button
                  type="button"
                  disabled={sendingTest || loading}
                  onClick={() => void handleSendTestEmail()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B111E] hover:bg-slate-800 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {sendingTest ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 text-emerald-400" />
                  )}
                  {sendingTest ? 'Sending Test...' : 'Send Test Email'}
                </button>

                {testResult && (
                  <div
                    className={`rounded-xl p-3.5 border text-xs space-y-1 ${
                      testResult.ok
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      {testResult.ok ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      {testResult.ok ? 'Delivered Successfully' : 'Delivery Failed'}
                    </div>
                    <p className="text-[11px]">{testResult.message}</p>
                    {testResult.providerUsed && (
                      <div className="font-mono text-[10px] opacity-80">
                        Engine: {testResult.providerUsed.toUpperCase()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: AUTOMATED LIFECYCLE EMAIL TOGGLES */}
      {subTab === 'automation' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-600" />
                Automated Lifecycle &amp; Security Email Alerts
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically sends branded HTML receipts &amp; alerts using your active Company
                Email (SMTP) or Resend API whenever key account events occur.
              </p>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveEmailConfig()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              Save Automation Rules
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {[
              {
                key: 'welcomeEmailEnabled' as const,
                title: 'Welcome Email on New Account',
                desc: 'Sends a branded onboarding email immediately after a new investor verifies & creates their account.',
              },
              {
                key: 'depositConfirmedEmailEnabled' as const,
                title: 'Deposit Confirmed Receipt Email',
                desc: 'Sends an instant USD receipt with TX Hash when Web3 Auto-Deposit verifies or Admin approves a manual deposit.',
              },
              {
                key: 'withdrawalStatusEmailEnabled' as const,
                title: 'Withdrawal Status Email (Pending / Paid / Refunded)',
                desc: 'Emails the client when a withdrawal is queued, approved with payout TX Hash, or rejected & refunded.',
              },
              {
                key: 'kycStatusEmailEnabled' as const,
                title: 'KYC Approved / Rejected Alert Email',
                desc: 'Notifies clients immediately when Super Admin approves, rejects, or requests KYC resubmission.',
              },
              {
                key: 'loginAlertEmailEnabled' as const,
                title: 'New Device / Suspicious Login Alert Email',
                desc: 'Alerts the user via email whenever their account signs in from an unrecognized browser or device.',
              },
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={automation[item.key]}
                  onChange={(e) =>
                    setAutomation((prev) => ({ ...prev, [item.key]: e.target.checked }))
                  }
                  className="mt-1 rounded border-slate-300 text-emerald-600 w-4 h-4"
                />
                <div>
                  <div className="font-bold text-xs text-slate-900">{item.title}</div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: BULK EMAIL / BROADCAST CAMPAIGN */}
      {subTab === 'broadcast' && (
        <form
          onSubmit={handleSendBroadcast}
          className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-amber-600" />
                Bulk Email &amp; Client Broadcast Campaign
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Send one-click announcements to all users or specific segments using your active
                Company SMTP or Resend engine.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-emerald-300 text-xs font-mono font-bold">
              <Users className="w-3.5 h-3.5" />
              {broadcastRecipients.length} Recipients Ready
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { id: 'all' as const, label: 'All Clients' },
              { id: 'investors' as const, label: 'Active Investors' },
              { id: 'kyc_approved' as const, label: 'KYC Verified' },
              { id: 'kyc_pending' as const, label: 'Pending KYC' },
              { id: 'mentors' as const, label: 'Mentors Only' },
              { id: 'custom' as const, label: 'Custom Emails' },
            ].map((seg) => (
              <button
                key={seg.id}
                type="button"
                onClick={() => setBroadcastSegment(seg.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                  broadcastSegment === seg.id
                    ? 'bg-[#0B111E] text-white border-[#0B111E]'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {seg.label}
              </button>
            ))}
          </div>

          {broadcastSegment === 'custom' && (
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Custom Email List (comma or line separated)
              </label>
              <textarea
                rows={3}
                value={customEmailsRaw}
                onChange={(e) => setCustomEmailsRaw(e.target.value)}
                placeholder="client1@example.com, client2@example.com"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-mono text-slate-900 outline-none"
              />
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Campaign Email Subject
              </label>
              <input
                type="text"
                required
                value={broadcastSubject}
                onChange={(e) => setBroadcastSubject(e.target.value)}
                placeholder="e.g. Important Update: New Web3 Instant Deposit & AI Package Rewards"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 px-3.5 py-2.5 text-xs text-slate-900 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Announcement Body (use <code className="font-mono text-emerald-700">{'{{name}}'}</code> for client name)
              </label>
              <textarea
                rows={6}
                required
                value={broadcastBody}
                onChange={(e) => setBroadcastBody(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 px-3.5 py-2.5 text-xs text-slate-900 outline-none"
              />
            </div>
          </div>

          {broadcastResult && (
            <div
              className={`rounded-xl p-4 border text-xs flex items-start gap-2.5 ${
                broadcastResult.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {broadcastResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-bold">{broadcastResult.message}</div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <span className="text-[11px] text-slate-500">
              Max 150 recipients per campaign batch &bull; Logged in Security Audit Trail
            </span>
            <button
              type="submit"
              disabled={sendingBroadcast || broadcastRecipients.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition disabled:opacity-50"
            >
              {sendingBroadcast ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {sendingBroadcast
                ? 'Sending Campaign...'
                : `Send Broadcast to ${broadcastRecipients.length} Recipient(s)`}
            </button>
          </div>
        </form>
      )}

      {/* SUB-TAB 4: TELEGRAM ADMIN BOT ALERTS */}
      {subTab === 'telegram' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
                  <Bot className="w-4 h-4 text-sky-600" />
                  Telegram Admin Bot Instant Alerts
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Receive real-time Telegram alerts on your phone whenever a large deposit, KYC
                  submission, or withdrawal request arrives.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tgEnabled}
                  onChange={(e) => setTgEnabled(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600 w-4 h-4"
                />
                Enable Alerts
              </label>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-800">
                    Telegram Bot Token (from @BotFather)
                  </label>
                  {tgConfig?.hasDatabaseBotToken && (
                    <button
                      type="button"
                      disabled={savingTg}
                      onClick={() => void handleSaveTelegram(true)}
                      className="text-[11px] font-semibold text-amber-700 hover:text-amber-800"
                    >
                      Clear Saved Token
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showNewTgToken ? 'text' : 'password'}
                    value={newTgToken}
                    onChange={(e) => setNewTgToken(e.target.value)}
                    autoComplete="new-password"
                    placeholder={
                      tgConfig?.botTokenConfigured
                        ? `Hidden (${tgConfig.botTokenMasked}) — enter new token to replace`
                        : '123456789:ABCdefGHIjklMNOpqrSTUvwxYZ'
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-500 px-3.5 py-2.5 pr-9 text-xs font-mono text-slate-900 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewTgToken((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showNewTgToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    TELEGRAM_ADMIN_CHAT_ID
                  </label>
                  <div className="relative">
                    <input
                      type={showTgChatId ? 'text' : 'password'}
                      value={tgChatId}
                      onChange={(e) => setTgChatId(e.target.value)}
                      placeholder={
                        tgConfig?.adminChatId
                          ? `Saved & Masked (${maskShortValue(tgConfig.adminChatId)})`
                          : 'e.g. 6123456789 or -1001234567890'
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-500 px-3.5 py-2.5 pr-9 text-xs font-mono text-slate-900 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTgChatId((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showTgChatId ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Large Deposit Alert Threshold (USD)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={tgDepositThreshold}
                    onChange={(e) => setTgDepositThreshold(e.target.value)}
                    placeholder="100"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-500 px-3.5 py-2.5 text-xs font-mono text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tgAlertDeposits}
                    onChange={(e) => setTgAlertDeposits(e.target.checked)}
                    className="rounded border-slate-300 text-sky-600"
                  />
                  Deposits
                </label>
                <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tgAlertWithdrawals}
                    onChange={(e) => setTgAlertWithdrawals(e.target.checked)}
                    className="rounded border-slate-300 text-sky-600"
                  />
                  Withdrawals
                </label>
                <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tgAlertKyc}
                    onChange={(e) => setTgAlertKyc(e.target.checked)}
                    className="rounded border-slate-300 text-sky-600"
                  />
                  KYC Submissions
                </label>
              </div>

              {tgFeedback && (
                <div
                  className={`rounded-xl px-4 py-3 text-xs border flex items-start gap-2 ${
                    tgFeedback.type === 'ok'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  {tgFeedback.type === 'ok' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span>{tgFeedback.text}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={savingTg}
                  onClick={() => void handleSaveTelegram(false)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {savingTg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Telegram Settings
                </button>
                <button
                  type="button"
                  disabled={testingTg || !tgConfig?.botTokenConfigured}
                  onClick={() => void handleTestTelegram()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B111E] hover:bg-slate-800 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {testingTg ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 text-sky-400" />
                  )}
                  Send Test Telegram Alert
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-slate-900 text-slate-200 rounded-2xl p-6 border border-slate-800 space-y-4">
            <div className="inline-flex items-center gap-1.5 text-sky-400 text-xs font-bold uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              3-Step Telegram Setup
            </div>
            <ol className="list-decimal list-inside space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <li>
                Open Telegram and message <strong className="text-white">@BotFather</strong> &rarr;
                send <code className="text-emerald-300">/newbot</code> and copy the HTTP API Token.
              </li>
              <li>
                Open your new bot and tap <strong className="text-white">Start</strong> so it is
                allowed to message you.
              </li>
              <li>
                Message <strong className="text-white">@userinfobot</strong> to copy your numeric{' '}
                <strong className="text-white">Chat ID</strong>, paste both here, click Save, and
                send a Test Alert.
              </li>
            </ol>
            <div className="rounded-xl bg-white/5 border border-white/10 p-3.5 text-[11px] text-slate-400">
              Your Bot Token is stored exclusively in the Super-Admin-only secret vault, masked in
              the UI, and never exposed to regular clients.
            </div>
          </div>
        </div>
      )}

      {/* Sanitized Audit Trail */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display font-bold text-slate-900 text-sm">
              Email, Broadcast &amp; Telegram Security Audit Trail
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Immutable record of credential rotations, broadcasts, and test alerts. Raw pass keys
              and tokens are never written to logs.
            </p>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
            {relevantAuditLogs.length} Recent Events
          </span>
        </div>

        {relevantAuditLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No email, broadcast, or Telegram audit events recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Event</th>
                  <th className="px-5 py-3">Super Admin</th>
                  <th className="px-5 py-3">Sanitized Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {relevantAuditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {formatTimestamp(log.createdAt)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        {log.eventType}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                      {log.actorEmail}
                    </td>
                    <td className="px-5 py-3 text-slate-600 max-w-xl">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
