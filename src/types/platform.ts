export type CryptoNetwork = string;
export type PaymentMethodCategory = 'crypto' | 'exchange' | 'mobile_banking' | 'bank';
export type AnnouncementTone = 'info' | 'warning' | 'urgent' | 'success';
export type IdType = 'NID' | 'Passport' | 'Driving License';
export type KycStatus = 'unsubmitted' | 'pending' | 'approved' | 'rejected';

export interface DashboardAnnouncement {
  enabled: boolean;
  tone: AnnouncementTone;
  title: string;
  message: string;
  updatedBy?: string;
}

export interface PaymentMethodConfig {
  id: string;
  name: string;
  category: PaymentMethodCategory;
  receivingAccount: string;
  instructions: string;
  minDepositUsd: number;
  minWithdrawalUsd: number;
  allowDeposit: boolean;
  allowWithdrawal: boolean;
  enabled: boolean;
}

export interface UserPaymentMethod {
  id: string;
  uid: string;
  label: string;
  methodId: string;
  methodName: string;
  accountAddress: string;
  accountHolder: string;
  isDefault: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface InvestmentPackage {
  id: string;
  name: string;
  capital: number;
  dailyPercent: number;
  aiMode: string;
  profitDays: number;
  capitalLockDays: number;
  description: string;
}

export interface MlmRates {
  level1: number;
  level2: number;
  level3: number;
}

export interface DepositWallets {
  usdtTrc20: string;
  usdtErc20: string;
  sol: string;
}

export interface PumpFunTokenConfig {
  name: string;
  ticker: string;
  mintAddress: string;
  pumpFunUrl: string;
  priceUsd: number;
  marketCapUsd: number;
  change24hPercent: number;
  description: string;
}

export interface PlatformConfig {
  companyName: string;
  companyTagline: string;
  companyDescription: string;
  companyGoal: string;
  riskDisclosure: string;
  trustpilotScore: number;
  trustpilotReviews: number;
  nortonScore: number;
  isoScore: number;
  certikScore: number;
  minWithdrawalUsd: number;
  eliteCapitalLockDays: number;
  totalProfitDays: number;
  globalPaused: boolean;
  packages: InvestmentPackage[];
  mlmRates: MlmRates;
  depositWallets: DepositWallets;
  paymentMethods: PaymentMethodConfig[];
  pumpFunToken: PumpFunTokenConfig;
  dashboardAnnouncement: DashboardAnnouncement;
  updatedAt?: unknown;
}

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  handle: string;
  role: 'user' | 'admin';
  referredByUid: string;
  referredByHandle: string;
  uplineChain: string[];
  kycStatus: KycStatus;
  idType: IdType | '';
  idNumber: string;
  idPhotoData: string;
  portraitPhotoData: string;
  usdBalance: number;
  profitBalance: number;
  totalInvested: number;
  totalWithdrawn: number;
  isMentor: boolean;
  mentorGiftedCapital: number;
  mentorRequiredVolume: number;
  mentorBroughtVolume: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Investment {
  id: string;
  uid: string;
  packageNumber: number;
  packageId: string;
  packageName: string;
  capital: number;
  dailyPercent: number;
  aiMode: string;
  totalProfitDays: number;
  capitalLockDays: number;
  isMentorGifted: boolean;
  claimedProfit: number;
  status: 'active' | 'completed' | 'capital_requested' | 'capital_withdrawn';
  startedAtMs: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CryptoDeposit {
  id: string;
  uid: string;
  userEmail: string;
  userName: string;
  network: CryptoNetwork;
  walletAddress: string;
  amountUsd: number;
  txId: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Withdrawal {
  id: string;
  uid: string;
  userEmail: string;
  userName: string;
  type: 'instant_profit' | 'manual_capital';
  source: 'package_profit' | 'mlm_commission' | 'mentor_profit' | 'elite_capital';
  investmentId: string;
  packageNumber: number;
  investmentDate: string;
  principalCapital: number;
  totalProfitGenerated: number;
  amountUsd: number;
  network: CryptoNetwork;
  destinationAddress: string;
  status: 'completed' | 'pending' | 'approved' | 'rejected';
  adminNote: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface P2PTransfer {
  id: string;
  senderUid: string;
  senderHandle: string;
  senderName: string;
  receiverUid: string;
  receiverHandle: string;
  receiverName: string;
  amountUsd: number;
  note: string;
  createdAt?: unknown;
}

export interface MlmCommission {
  id: string;
  beneficiaryUid: string;
  fromUid: string;
  fromName: string;
  level: number;
  investmentAmount: number;
  ratePercent: number;
  commissionUsd: number;
  createdAt?: unknown;
}

export interface MemeCoinInvestment {
  id: string;
  uid: string;
  userName: string;
  tokenTicker: string;
  mintAddress: string;
  paymentMethod: 'USD_VAULT' | 'SOL_WALLET';
  amountUsd: number;
  tokenQuantity: number;
  entryPriceUsd: number;
  txSignature: string;
  createdAt?: unknown;
}

export interface ReferralLinkRecord {
  id: string;
  referrerUid: string;
  refereeUid: string;
  refereeHandle: string;
  refereeName: string;
  level: number;
  totalInvestedUsd: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type NavSection =
  | 'home'
  | 'plans'
  | 'ai-trading'
  | 'forex'
  | 'pump-fun'
  | 'mentor-referral';
