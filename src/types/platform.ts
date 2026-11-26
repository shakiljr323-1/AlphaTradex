export type CryptoNetwork = string;
export type PaymentMethodCategory = 'crypto' | 'exchange' | 'mobile_banking' | 'bank';
export type AnnouncementTone = 'info' | 'warning' | 'urgent' | 'success';
export type IdType = 'NID' | 'Passport' | 'Driving License';
export type KycStatus = 'unsubmitted' | 'pending' | 'approved' | 'rejected';
export type KycProviderId =
  | 'free_qr_mrz_ocr'
  | 'free_ai_ocr'
  | 'didit_free'
  | 'sumsub'
  | 'veriff'
  | 'shufti_pro'
  | 'custom_webhook';
export type KycApiVerificationStatus =
  | 'ocr_preview_only'
  | 'live_api_pending'
  | 'live_api_verified'
  | 'manual_review';

export interface GlobalKycSettings {
  enabled: boolean;
  requireKycForDeposits: boolean;
  requireKycForPackages: boolean;
  requireKycForClaims: boolean;
  requireKycForWithdrawals: boolean;
  allowFreeAiOcr: boolean;
  requireBackSideForCards: boolean;
  requireLiveSelfie: boolean;
  activeProvider: KycProviderId;
  disabledCountryCodes: string[];
}

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
  withdrawAddress?: string;
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

export interface MentorConfig {
  enabled: boolean;
  mentorCommissionPercent: number;
  volumeMultiplier: number;
  defaultGiftCapital: number;
  defaultDailyPercent: number;
}

export type BannerAdPlacement = 'coin_page' | 'all_pages';
export type BannerAdTheme = 'gold' | 'emerald' | 'sky' | 'crimson';

export interface BannerAdConfig {
  id: string;
  enabled: boolean;
  title: string;
  subtitle: string;
  badgeText: string;
  ctaText: string;
  ctaUrl: string;
  imageUrl: string;
  placement: BannerAdPlacement;
  theme: BannerAdTheme;
}

export interface CoinMiningPlan {
  id: string;
  name: string;
  minUsd: number;
  maxUsd: number;
  dailyInterestPercent: number;
  durationDays: number;
  hashRateLabel: string;
  coinBonusPerUsd: number;
  enabled: boolean;
}

export interface CoinMiningSettings {
  paidMiningEnabled: boolean;
  tapToMineEnabled: boolean;
  tapRewardCoins: number;
  tapUsdPerCoin: number;
  maxEnergy: number;
  energyCostPerTap: number;
  energyRegenPerSec: number;
  dailyTapLimitCoins: number;
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

export type ForexAccountTierId = 'standard' | 'pro' | 'raw_spread';

export interface ForexAccountTierConfig {
  id: ForexAccountTierId;
  name: string;
  tagline: string;
  commissionPerLot: number;
  spreadMultiplier: number;
  minDepositUsd: number;
  maxLeverage: number;
  executionType: string;
  enabled: boolean;
}

export interface CopyTraderProfile {
  id: string;
  name: string;
  handle: string;
  strategy: string;
  pairs: string;
  riskLevel: 'Low' | 'Moderate' | 'Dynamic';
  monthlyRoiPercent: number;
  winRatePercent: number;
  maxDrawdownPercent: number;
  profitFactor: number;
  performanceFeePercent: number;
  dailyTargetPercent: number;
  minCopyUsd: number;
  recommendedTierId: ForexAccountTierId;
  followersCount: number;
  enabled: boolean;
}

export interface ForexPlatformConfig {
  tradingEnabled: boolean;
  copyTradingEnabled: boolean;
  accountTiers: ForexAccountTierConfig[];
  copyTraders: CopyTraderProfile[];
}

export interface AdminModuleControls {
  aiTradingEnabled: boolean;
  forexMarketEnabled: boolean;
  coinMiningEnabled: boolean;
  p2pEnabled: boolean;
  requireSignupForTradingModules: boolean;
}

export interface SupportLinksConfig {
  telegramUrl: string;
  whatsappUrl: string;
  supportEmail: string;
}

export interface SupportAutoResponderConfig {
  enabled: boolean;
  notifyOnStatusChange: boolean;
  senderName: string;
  subjectTemplate: string;
  bodyTemplate: string;
  slaUrgent: string;
  slaHigh: string;
  slaMedium: string;
  slaLow: string;
}

export interface AdminActionLog {
  id: string;
  adminUid: string;
  adminEmail: string;
  action: string;
  targetUid: string;
  targetLabel: string;
  details: string;
  amountUsd: number;
  createdAt?: unknown;
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
  withdrawalsPaused?: boolean;
  signupsPaused?: boolean;
  p2pPaused?: boolean;
  moduleControls?: AdminModuleControls;
  supportLinks?: SupportLinksConfig;
  packages: InvestmentPackage[];
  mlmRates: MlmRates;
  mentorConfig: MentorConfig;
  depositWallets: DepositWallets;
  paymentMethods: PaymentMethodConfig[];
  pumpFunToken: PumpFunTokenConfig;
  dashboardAnnouncement: DashboardAnnouncement;
  bannerAds: BannerAdConfig[];
  coinMiningSettings: CoinMiningSettings;
  coinMiningPlans: CoinMiningPlan[];
  forexConfig?: ForexPlatformConfig;
  supportAutoResponder?: SupportAutoResponderConfig;
  kycSettings?: GlobalKycSettings;
  marketingCardsConfig?: MarketingCardsConfig;
  howItWorksConfig?: HowItWorksConfig;
  updatedAt?: unknown;
}

export type MarketingCardThemeId =
  | 'navy_gold'
  | 'emerald_green'
  | 'cyber_cyan'
  | 'royal_purple';

export type MarketingCardAspectRatio = '1:1' | '9:16' | '16:9';

export type MarketingCardPhotoFrame = 'circle' | 'rounded' | 'square';

export type MarketingCardCategory =
  | 'member'
  | 'package'
  | 'trading'
  | 'referral'
  | 'milestone'
  | 'launchpad'
  | 'custom';

export interface MarketingCardTemplateConfig {
  id: string;
  name: string;
  category: MarketingCardCategory;
  enabled: boolean;
  headline: string;
  subheadline: string;
  badgeText: string;
  ctaText: string;
  defaultTheme: MarketingCardThemeId;
  isCustom?: boolean;
  overlayImageData?: string;
  photoSlot?: {
    xPct: number;
    yPct: number;
    sizePct: number;
  };
  textSlot?: {
    xPct: number;
    yPct: number;
  };
}

export interface MarketingCardsConfig {
  enabled: boolean;
  allowQrCode: boolean;
  allowReferralCode: boolean;
  allowRankBadge: boolean;
  allowPackageBadge: boolean;
  defaultHeadline: string;
  defaultTagline: string;
  disclaimerText: string;
  templates: MarketingCardTemplateConfig[];
}

export interface MarketingCardStats {
  totalGenerated: number;
  totalShared: number;
  updatedAt?: unknown;
}

export type GuideLanguage = 'en' | 'bn' | 'hi' | 'es';
export type MotionVisualPreset = 'overview' | 'signup' | 'package' | 'dashboard';
export type MotionAccentColor = 'amber' | 'emerald' | 'sky' | 'violet';

export interface GuideLocalizedText {
  en: string;
  bn: string;
  hi: string;
  es: string;
}

export interface MotionSceneBeat {
  title: string;
  headline: string;
  caption: string;
  metricLabel: string;
  metricValue: string;
  durationSec: number;
  accent: MotionAccentColor;
  visualType: MotionVisualPreset;
}

export interface HowItWorksStepConfig {
  id: string;
  stepNumber: number;
  enabled: boolean;
  title: GuideLocalizedText;
  description: GuideLocalizedText;
  highlights: string[];
  ctaLabel: string;
  ctaTarget: 'auth' | 'plans' | 'dashboard';
}

export interface MotionVideoCardConfig {
  id: string;
  stepNumber: number;
  enabled: boolean;
  title: GuideLocalizedText;
  subtitle: GuideLocalizedText;
  caption: GuideLocalizedText;
  script: string;
  visualPreset: MotionVisualPreset;
  customVideoUrl?: string;
  isDemoVisual: boolean;
  scenes: MotionSceneBeat[];
  aiUpdatedAtIso?: string;
}

export interface HowItWorksConfig {
  enabled: boolean;
  showOnHomepage: boolean;
  defaultLanguage: GuideLanguage;
  disclaimerText: string;
  steps: HowItWorksStepConfig[];
  videos: MotionVideoCardConfig[];
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
  idBackPhotoData?: string;
  portraitPhotoData: string;
  avatarData?: string;
  kycCountryCode?: string;
  kycCountryName?: string;
  kycDateOfBirth?: string;
  kycNationality?: string;
  kycIssueDate?: string;
  kycExpiryDate?: string;
  kycAddress?: string;
  kycRejectionReason?: string;
  kycResubmissionRequested?: boolean;
  kycVerificationMethod?: KycProviderId | 'manual_upload';
  kycApiVerificationStatus?: KycApiVerificationStatus;
  kycOcrConfidence?: 'HIGH' | 'MEDIUM' | 'LOW' | '';
  kycLivenessPassed?: boolean;
  kycSubmittedAtMs?: number;
  kycReviewedAtMs?: number;
  kycReviewedBy?: string;
  countryCode?: string;
  countryName?: string;
  phoneDialPrefix?: string;
  phoneNumber?: string;
  phoneVerified?: boolean;
  suspended?: boolean;
  suspensionReason?: string;
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

export interface WalletTransfer {
  id: string;
  uid: string;
  userName: string;
  direction: 'income_to_deposit';
  fromWallet: 'Income Wallet';
  toWallet: 'Deposit Wallet';
  amountUsd: number;
  note: string;
  status: 'approved';
  createdAt?: unknown;
}

export interface MlmCommission {
  id: string;
  beneficiaryUid: string;
  fromUid: string;
  fromName: string;
  level: number;
  commissionType?: 'referral' | 'mentor';
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

export interface CoinMiningStake {
  id: string;
  uid: string;
  userName: string;
  planId: string;
  planName: string;
  principalUsd: number;
  dailyInterestPercent: number;
  durationDays: number;
  coinBonusPerUsd: number;
  claimedUsd: number;
  claimedCoins: number;
  startedAtMs: number;
  lastClaimAtMs: number;
  status: 'active' | 'completed';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CoinTapAccount {
  uid: string;
  totalTappedCoins: number;
  unclaimedTapCoins: number;
  dailyTappedCoins: number;
  lastTapDayKey: string;
  totalClaimedUsdFromTap: number;
  totalClaimedCoins: number;
  energy: number;
  lastEnergySyncMs: number;
  updatedAt?: unknown;
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

export interface ReferralStats {
  handle: string;
  clicks: number;
  lastClickedAt?: unknown;
  updatedAt?: unknown;
}

export interface ForexTrade {
  id: string;
  uid: string;
  userName: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  accountTierId: ForexAccountTierId;
  accountTierName: string;
  lots: number;
  leverage: number;
  entryPrice: number;
  closePrice: number;
  slPrice: number;
  tpPrice: number;
  marginUsd: number;
  commissionUsd: number;
  realizedPnlUsd: number;
  status: 'open' | 'closed';
  openedAtMs: number;
  closedAtMs: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CopyTradeSubscription {
  id: string;
  uid: string;
  userName: string;
  traderId: string;
  traderName: string;
  traderHandle: string;
  accountTierId: ForexAccountTierId;
  allocatedUsd: number;
  riskMultiplier: number;
  stopLossPercent: number;
  performanceFeePercent: number;
  dailyTargetPercent: number;
  claimedProfitUsd: number;
  startedAtMs: number;
  lastSyncedAtMs: number;
  status: 'active' | 'stopped';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type PackageFundingSource = 'deposit_wallet' | 'income_wallet' | 'combined';

export type SupportTicketCategory =
  | 'deposit'
  | 'withdrawal'
  | 'kyc'
  | 'trading'
  | 'forex'
  | 'p2p'
  | 'account'
  | 'other';

export type SupportTicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportChatThread {
  uid: string;
  userName: string;
  userEmail: string;
  userHandle: string;
  status: 'open' | 'resolved';
  lastMessage: string;
  lastSender: 'client' | 'admin';
  unreadByAdmin: number;
  unreadByClient: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SupportChatMessage {
  id: string;
  uid: string;
  senderUid: string;
  senderRole: 'client' | 'admin';
  senderName: string;
  text: string;
  topicTag: string;
  createdAt?: unknown;
}

export interface SupportTicket {
  id: string;
  uid: string;
  userName: string;
  userEmail: string;
  userHandle: string;
  ticketNumber: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  subject: string;
  description: string;
  referenceId: string;
  status: SupportTicketStatus;
  adminReply: string;
  resolvedBy: string;
  autoAckMessage?: string;
  estimatedResponseTime?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type UserNotificationType =
  | 'ticket_received'
  | 'ticket_status_update'
  | 'support_reply';

export interface UserNotification {
  id: string;
  uid: string;
  type: UserNotificationType;
  ticketId: string;
  ticketNumber: string;
  recipientEmail: string;
  senderName: string;
  title: string;
  emailSubject: string;
  message: string;
  category: string;
  priority: string;
  estimatedResponseTime: string;
  read: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TicketConfirmationReceipt {
  ticketId: string;
  ticketNumber: string;
  notificationId: string;
  recipientEmail: string;
  senderName: string;
  emailSubject: string;
  message: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  subject: string;
  referenceId: string;
  estimatedResponseTime: string;
  sentAtIso: string;
}

export type NavSection =
  | 'home'
  | 'how-it-works'
  | 'plans'
  | 'forex-news'
  | 'ai-trading'
  | 'forex'
  | 'pump-fun'
  | 'mentor-referral'
  | 'terms'
  | 'auth';
