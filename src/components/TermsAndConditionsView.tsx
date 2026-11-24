import React from 'react';
import { ArrowLeft, ExternalLink, FileText, Mail, ShieldAlert, ShieldCheck } from 'lucide-react';

interface TermsAndConditionsViewProps {
  onBack: () => void;
  backLabel?: string;
}

export const TermsAndConditionsView: React.FC<TermsAndConditionsViewProps> = ({
  onBack,
  backLabel = 'Back to Home Overview',
}) => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white bg-[#0B111E]/85 border border-slate-700/80 px-3.5 py-2 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {backLabel}
        </button>
        <span className="text-xs font-mono text-slate-400">
          Last Updated: November 24, 2026 | Domain: alphatradex.pro
        </span>
      </div>

      <article className="bg-[#0B111E]/88 backdrop-blur-md border border-slate-700/75 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 text-slate-300">
        <header className="pb-5 border-b border-slate-800 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-orange-500/15 border border-orange-500/35 text-orange-300 text-xs font-mono font-semibold">
            <FileText className="w-3.5 h-3.5" />
            LEGAL AGREEMENT &amp; RISK DISCLOSURE
          </div>
          <h1 className="font-display font-extrabold text-white text-2xl sm:text-3xl tracking-tight">
            Terms and Conditions — AlphaTradeX.pro
          </h1>
          <p className="text-xs font-mono text-slate-400">
            Last Updated: November 24, 2026 | Domain: alphatradex.pro
          </p>
        </header>

        <div className="space-y-4 text-sm leading-relaxed text-slate-300">
          <p>
            These Terms and Conditions (&quot;Terms&quot;) govern your access to and use of{' '}
            <strong className="text-white">AlphaTradeX.pro</strong> (&quot;AlphaTradeX&quot;,
            &quot;Company&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;), including
            our website (
            <a
              href="https://alphatradex.pro"
              target="_blank"
              rel="noreferrer"
              className="text-orange-400 hover:underline inline-flex items-center gap-1 font-mono text-xs"
            >
              https://alphatradex.pro
              <ExternalLink className="w-3 h-3" />
            </a>
            ), account/KYC portal, investment packages, Forex market features, AI Trading tools,
            Copy Trading modules, Crypto Token Mining and Company Own Token Mining features,
            referral/MLM mechanics, and cryptocurrency transaction services (collectively, the
            &quot;Services&quot;).
          </p>
          <p className="font-medium text-slate-200">
            By registering an account, completing KYC verification, depositing funds, or using any
            part of AlphaTradeX.pro, you confirm that you have read, understood, and agreed to be
            bound by these Terms.
          </p>
        </div>

        <section className="space-y-2.5 pt-2 border-t border-slate-800/80">
          <h2 className="font-display font-bold text-white text-lg">
            1. Eligibility &amp; Account Registration (KYC)
          </h2>
          <p className="text-sm leading-relaxed">
            You must be of legal age in your jurisdiction and legally capable of entering into
            binding agreements to use AlphaTradeX.pro.
          </p>
          <p className="text-sm leading-relaxed">
            You agree to provide accurate, complete, and current registration and Know Your Customer
            (KYC) information (including valid government-issued ID and portrait verification where
            required) and to keep your login credentials secure.
          </p>
          <p className="text-sm leading-relaxed">
            You are solely responsible for all activities conducted under your account.
          </p>
        </section>

        <section className="space-y-2.5 pt-4 border-t border-slate-800/80">
          <div className="p-4 rounded-xl bg-amber-950/45 border border-amber-500/40 space-y-2">
            <h2 className="font-display font-bold text-amber-200 text-lg flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
              2. High-Risk Warning &amp; No Guarantee of Profit
            </h2>
            <p className="text-sm leading-relaxed text-amber-100/90">
              Trading in the Forex market, using AI Trading systems or Copy Trading features,
              transacting in cryptocurrencies (such as USDT or SOL), and participating in Crypto
              Token Mining or Company Own Token Mining involve substantial financial, market,
              liquidity, technical, and volatility risks, including the potential loss of part or
              all of your invested capital.
            </p>
            <p className="text-sm leading-relaxed text-amber-100/90">
              Any daily targets, projected returns, historical performance figures, AI signals,
              copy-trading statistics, mining estimates, or countdown/schedule displays on
              AlphaTradeX.pro are illustrative targets or projections only and do not constitute
              guaranteed returns, financial advice, or investment promises.
            </p>
            <p className="text-sm leading-relaxed text-amber-100/90">
              Market conditions, liquidity shifts, slippage, network congestion, and asset price
              drops can cause losses at any time.
            </p>
          </div>
        </section>

        <section className="space-y-2.5 pt-4 border-t border-slate-800/80">
          <h2 className="font-display font-bold text-white text-lg">
            3. User Assumption of Risk &amp; Waiver of Claims for Losses
          </h2>
          <p className="text-sm leading-relaxed">
            By choosing to invest, trade, copy trade, mine tokens, or allocate funds on
            AlphaTradeX.pro, you explicitly acknowledge and agree that you do so voluntarily and at
            your sole financial risk.
          </p>
          <p className="text-sm leading-relaxed">
            You accept full responsibility for your investment and participation decisions and agree
            that AlphaTradeX.pro, its founders, officers, employees, affiliates, mentors, and
            service providers shall not be liable for any trading losses, investment losses, missed
            targets, market volatility, token price depreciation, mining output variations, or
            opportunity costs incurred by you.
          </p>
          <p className="text-sm leading-relaxed">
            To the maximum extent permitted by applicable law, you agree not to bring legal claims,
            lawsuits, chargebacks, or regulatory/civil actions against AlphaTradeX.pro or its
            operators arising out of normal market fluctuations, trading/investment losses, or risk
            events inherent to digital assets and financial markets, provided there is no proven
            intentional fraud or willful misconduct on the part of the Company.
          </p>
        </section>

        <section className="space-y-3 pt-4 border-t border-slate-800/80">
          <h2 className="font-display font-bold text-white text-lg">
            4. Platform Rules: Packages, Schedules, Withdrawals, Transfers &amp; Referrals
          </h2>
          <div className="space-y-2.5 text-sm leading-relaxed">
            <p>
              <strong className="text-white">Investment Plans &amp; Schedules:</strong> Package
              terms, target percentages, profit-accrual schedules (such as designated weekday
              earning days vs. weekend off-days), and capital lock/unlock rules (including any
              time-based capital withdrawal eligibility rules) apply strictly as configured on the
              Platform and may be updated or paused during maintenance, risk events, or policy
              updates.
            </p>
            <p>
              <strong className="text-white">Withdrawals &amp; P2P Transfers:</strong> Withdrawal
              requests are subject to minimum withdrawal thresholds, available eligible balances,
              security/KYC checks, and applicable processing rules (including instant processing for
              eligible profit withdrawals where enabled and manual review/approval for capital or
              restricted requests). User-to-user (P2P) transfers are final once executed; users must
              verify recipient details carefully before confirming any transfer.
            </p>
            <p>
              <strong className="text-white">MLM Referrals &amp; Mentor Accounts:</strong> Referral
              commissions and any administrative/mentor account allocations or volume unlock
              conditions (such as required referred investment volume multiples) are governed by the
              rules displayed in your dashboard and may be adjusted or revoked in cases of abuse,
              fake accounts, or policy violations.
            </p>
          </div>
        </section>

        <section className="space-y-2.5 pt-4 border-t border-slate-800/80">
          <h2 className="font-display font-bold text-white text-lg">
            5. Crypto-Only Transactions, Mining &amp; Third-Party Platforms
          </h2>
          <p className="text-sm leading-relaxed">
            All supported deposits and withdrawals are conducted via designated cryptocurrency
            networks/wallets. Sending funds to the wrong network, wrong wallet address, or without
            required details may result in permanent loss of funds for which the Company is not
            responsible.
          </p>
          <p className="text-sm leading-relaxed">
            Crypto Token Mining, upcoming mining bots, Company Own Token Mining, and external Web3
            integrations/launchpads (such as third-party wallets, block explorers, or token launch
            platforms) may be subject to technical delays, smart-contract/network risks, feature
            updates, or availability changes.
          </p>
          <p className="text-sm leading-relaxed">
            We do not control external blockchain networks or third-party platforms and are not
            responsible for outages, hacks, forks, or failures originating outside our direct
            systems.
          </p>
        </section>

        <section className="space-y-2.5 pt-4 border-t border-slate-800/80">
          <h2 className="font-display font-bold text-white text-lg">
            6. Limitation of Liability
          </h2>
          <p className="text-sm leading-relaxed">
            To the fullest extent permitted by law, AlphaTradeX.pro and its affiliates shall not be
            liable for any indirect, incidental, special, consequential, or punitive damages,
            including loss of profits, loss of anticipated gains, loss of data, business
            interruption, or loss of digital assets arising from your use of or inability to use the
            Services.
          </p>
          <p className="text-sm leading-relaxed">
            Without limiting the foregoing, in any event where liability is established by a
            competent authority or court and not excluded by law, the aggregate liability of
            AlphaTradeX.pro to you shall not exceed the net platform fees (if any) directly paid by
            you to the Company during the three (3) months immediately preceding the event giving
            rise to the claim.
          </p>
        </section>

        <section className="space-y-2.5 pt-4 border-t border-slate-800/80">
          <h2 className="font-display font-bold text-white text-lg">
            7. Prohibited Conduct, Suspension &amp; Termination
          </h2>
          <p className="text-sm leading-relaxed">
            You must not use AlphaTradeX.pro for money laundering, terrorist financing, fraud,
            market manipulation, bot/script abuse, unauthorized access attempts, or any unlawful
            activity.
          </p>
          <p className="text-sm leading-relaxed">
            We reserve the right to suspend, restrict, freeze, or terminate accounts, withhold
            disputed/irregular balances pending investigation, or block access if we reasonably
            suspect fraud, KYC/AML violations, abuse of referral/mentor rules, or breach of these
            Terms.
          </p>
        </section>

        <section className="space-y-2.5 pt-4 border-t border-slate-800/80">
          <h2 className="font-display font-bold text-white text-lg">
            8. Amendments, Severability &amp; Governing Terms
          </h2>
          <p className="text-sm leading-relaxed">
            AlphaTradeX.pro may modify or update these Terms at any time by posting the revised
            version on alphatradex.pro. Continued use of the Platform after changes take effect
            constitutes acceptance of the updated Terms.
          </p>
          <p className="text-sm leading-relaxed">
            If any provision of these Terms is found unenforceable under applicable law, the
            remaining provisions shall remain in full force and effect.
          </p>
        </section>

        <section
          id="privacy-policy-notice"
          className="space-y-2.5 pt-4 border-t border-slate-800/80"
        >
          <h2 className="font-display font-bold text-white text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Privacy &amp; KYC Data Protection Policy Summary
          </h2>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-300">
            AlphaTradeX.pro collects and stores registration details, KYC identity verification
            documents, transaction references, and ledger records strictly for account security,
            AML/KYC compliance, payout verification, and platform operations. Your personal and KYC
            data is safeguarded under encrypted access controls and is never sold to third parties.
          </p>
        </section>

        <footer className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <div className="space-y-1">
            <div className="font-semibold text-white">Contact &amp; Legal Inquiries</div>
            <div>
              For questions regarding these Terms, please contact{' '}
              <a
                href="mailto:support@alphatradex.pro"
                className="text-orange-400 hover:underline font-mono inline-flex items-center gap-1"
              >
                <Mail className="w-3 h-3" />
                support@alphatradex.pro
              </a>{' '}
              or AlphaTradeX.pro Legal / Registered Compliance Office.
            </div>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold transition-colors shrink-0"
          >
            {backLabel}
          </button>
        </footer>
      </article>
    </div>
  );
};

interface TermsAgreementCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  onOpenTerms: () => void;
  variant?: 'light' | 'dark';
  required?: boolean;
  id?: string;
}

export const TermsAgreementCheckbox: React.FC<TermsAgreementCheckboxProps> = ({
  checked,
  onChange,
  onOpenTerms,
  variant = 'dark',
  required = true,
  id = 'terms-agreement-checkbox',
}) => {
  const isLight = variant === 'light';
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs leading-relaxed cursor-pointer select-none transition-colors ${
        isLight
          ? checked
            ? 'bg-emerald-50/70 border-emerald-300 text-slate-800'
            : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-orange-300'
          : checked
          ? 'bg-emerald-950/35 border-emerald-500/45 text-slate-200'
          : 'bg-slate-900/75 border-slate-700/80 text-slate-300 hover:border-orange-500/60'
      }`}
    >
      <input
        id={id}
        type="checkbox"
        required={required}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-400 text-orange-600 focus:ring-orange-500 shrink-0 cursor-pointer accent-orange-500"
      />
      <span>
        I have read and agreed to the{' '}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenTerms();
          }}
          className={`font-semibold underline underline-offset-2 ${
            isLight
              ? 'text-orange-600 hover:text-orange-700'
              : 'text-orange-400 hover:text-orange-300'
          }`}
        >
          Terms &amp; Conditions and Privacy Policy
        </button>
        , and understand that trading, crypto, and mining carry risk of loss.
      </span>
    </label>
  );
};
