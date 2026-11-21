import { DepositWallets, PaymentMethodConfig, PlatformConfig } from '../types/platform';

export const SUPER_ADMIN_EMAIL = 'shakiljr323@gmail.com';

export const DEFAULT_DEPOSIT_WALLETS: DepositWallets = {
  usdtTrc20: 'TXvanguard8TRC20VaultSettlementAddress9921',
  usdtErc20: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  sol: 'VTV7xK9mN3pQr2sT8vW4yZ1aB6cD5eF9gH2jK4mN8pQ',
};

export function buildDefaultPaymentMethods(wallets: DepositWallets = DEFAULT_DEPOSIT_WALLETS): PaymentMethodConfig[] {
  return [
    {
      id: 'USDT_TRC20',
      name: 'USDT (TRC20)',
      category: 'crypto',
      receivingAccount: wallets.usdtTrc20,
      instructions: 'Send USDT via Tron (TRC20) network and submit your confirmed TxID hash.',
      minDepositUsd: 10,
      minWithdrawalUsd: 10,
      allowDeposit: true,
      allowWithdrawal: true,
      enabled: true,
    },
    {
      id: 'USDT_ERC20',
      name: 'USDT (ERC20)',
      category: 'crypto',
      receivingAccount: wallets.usdtErc20,
      instructions: 'Send USDT via Ethereum (ERC20) network and submit your transaction hash.',
      minDepositUsd: 20,
      minWithdrawalUsd: 20,
      allowDeposit: true,
      allowWithdrawal: true,
      enabled: true,
    },
    {
      id: 'SOL',
      name: 'Solana (SOL)',
      category: 'crypto',
      receivingAccount: wallets.sol,
      instructions: 'Send SOL or USDC-SOL on Solana Mainnet and paste your Tx signature.',
      minDepositUsd: 10,
      minWithdrawalUsd: 10,
      allowDeposit: true,
      allowWithdrawal: true,
      enabled: true,
    },
  ];
}

export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  companyName: 'Alphatradex',
  companyTagline: 'Institutional Multi-Asset Crypto Vault, AI Quantitative Execution & Solana Launchpad',
  companyDescription:
    'Alphatradex combines disciplined Monday-to-Friday algorithmic liquidity strategies with transparent on-chain settlement across USDT (TRC20/ERC20) and Solana, multi-tier referral desks, and native Pump.fun ecosystem allocations.',
  companyGoal:
    'Deliver structured 200 profit-day quantitative vaults with verifiable custody, strict weekday execution cycles, instant profit liquidity, and institutional-grade risk controls.',
  riskDisclosure:
    'Risk & KYC Disclosure: Daily AI yield figures are quantitative performance targets, not guaranteed returns. Digital asset strategies carry market volatility. Full identity verification (KYC) is mandatory for vault compliance, and principal capital locks follow package rules.',
  trustpilotScore: 4.5,
  trustpilotReviews: 1842,
  nortonScore: 4.8,
  isoScore: 5.0,
  certikScore: 4.9,
  minWithdrawalUsd: 10,
  eliteCapitalLockDays: 70,
  totalProfitDays: 200,
  globalPaused: false,
  packages: [
    {
      id: 'starter',
      name: 'Starter',
      capital: 100,
      dailyPercent: 1.0,
      aiMode: 'AI Conservative Scalping',
      profitDays: 200,
      capitalLockDays: 200,
      description: 'Low-volatility mean-reversion engine targeting steady weekday liquidity capture.'
    },
    {
      id: 'growth',
      name: 'Growth',
      capital: 300,
      dailyPercent: 1.5,
      aiMode: 'AI Trend & Momentum',
      profitDays: 200,
      capitalLockDays: 200,
      description: 'Directional momentum models across BTC, ETH, and SOL perpetual pairs.'
    },
    {
      id: 'pro',
      name: 'Pro',
      capital: 500,
      dailyPercent: 2.3,
      aiMode: 'AI Multi-Pair Grid',
      profitDays: 200,
      capitalLockDays: 200,
      description: 'High-frequency multi-pair grid execution with automated spread rebalancing.'
    },
    {
      id: 'elite',
      name: 'Elite',
      capital: 1000,
      dailyPercent: 3.0,
      aiMode: 'AI Institutional Execution',
      profitDays: 200,
      capitalLockDays: 70,
      description: 'Flagship institutional desk with 70 calendar-day principal withdrawal eligibility.'
    }
  ],
  mlmRates: {
    level1: 8,
    level2: 4,
    level3: 2
  },
  depositWallets: DEFAULT_DEPOSIT_WALLETS,
  paymentMethods: buildDefaultPaymentMethods(DEFAULT_DEPOSIT_WALLETS),
  pumpFunToken: {
    name: 'Alphatradex',
    ticker: 'ATX',
    mintAddress: 'ATX9xPumpFunSolanaOfficialMint7741alphatradex88',
    pumpFunUrl: 'https://pump.fun',
    priceUsd: 0.0042,
    marketCapUsd: 420000,
    change24hPercent: 18.4,
    description: 'Official Alphatradex ecosystem meme asset deployed on Pump.fun with direct vault & SOL allocation.'
  },
  dashboardAnnouncement: {
    enabled: true,
    tone: 'info',
    title: 'Important Platform Announcement',
    message:
      'Live Forex Market Charts are now active in your Vault! Direct Forex Buy/Sell execution is scheduled for our upcoming release. Ensure your KYC and saved payment methods are up to date for instant profit withdrawals.',
    updatedBy: 'Administration',
  },
};


