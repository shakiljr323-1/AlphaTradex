import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  FileCheck,
  Mail,
  Phone,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  XCircle,
} from 'lucide-react';
import type { ConfirmationResult } from 'firebase/auth';
import {
  COUNTRY_PHONE_OPTIONS,
  getCountryByCode,
  normalizeRemainingPhoneDigits,
  validateCountryPhoneNumber,
} from '../constants/countries';
import { confirmFirebasePhoneOtp, sendFirebasePhoneOtp } from '../lib/firebase';
import { IdType, UserProfile } from '../types/platform';
import { compressImageToDataUrl, formatTimestamp } from '../utils/investmentMath';

interface ProfileManagementViewProps {
  userProfile: UserProfile;
  authEmail: string;
  usesPasswordProvider: boolean;
  onUpdateProfileAvatar: (avatarData: string, fullName?: string) => Promise<void>;
  onUpdateUserPhone: (params: {
    countryCode: string;
    countryName: string;
    phoneDialPrefix: string;
    phoneNumber: string;
    phoneVerified: boolean;
  }) => Promise<void>;
  onUpdateAccountEmail: (
    newEmail: string,
    currentPassword?: string
  ) => Promise<{ status: 'updated' | 'verification_sent'; email: string }>;
  onSubmitKyc: (params: {
    fullName: string;
    idType: IdType;
    idNumber: string;
    idPhotoData: string;
    portraitPhotoData: string;
  }) => Promise<void>;
  onOpenKycVerification?: () => void;
  onNotify: (type: 'ok' | 'err', text: string) => void;
}

export const ProfileManagementView: React.FC<ProfileManagementViewProps> = ({
  userProfile,
  authEmail,
  usesPasswordProvider,
  onUpdateProfileAvatar,
  onUpdateUserPhone,
  onUpdateAccountEmail,
  onSubmitKyc,
  onOpenKycVerification,
  onNotify,
}) => {
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const kycIdInputRef = useRef<HTMLInputElement | null>(null);
  const kycPortraitInputRef = useRef<HTMLInputElement | null>(null);
  const phoneRecaptchaRef = useRef<HTMLDivElement | null>(null);
  const phoneConfirmRef = useRef<ConfirmationResult | null>(null);

  const [displayName, setDisplayName] = useState(userProfile.fullName);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [pendingEmailNotice, setPendingEmailNotice] = useState<string | null>(null);

  const [phoneCountryCode, setPhoneCountryCode] = useState(userProfile.countryCode || 'BD');
  const initialCountry = getCountryByCode(userProfile.countryCode || 'BD');
  const [phoneDigits, setPhoneDigits] = useState(() => {
    if (userProfile.phoneNumber && userProfile.phoneNumber.startsWith(initialCountry.dialPrefix)) {
      return userProfile.phoneNumber.slice(initialCountry.dialPrefix.length);
    }
    return '';
  });
  const [phoneOtpStep, setPhoneOtpStep] = useState<'idle' | 'sent' | 'verified'>(
    userProfile.phoneVerified ? 'verified' : 'idle'
  );
  const [phoneOtpCode, setPhoneOtpCode] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);

  const [kycName, setKycName] = useState(userProfile.fullName);
  const [kycIdType, setKycIdType] = useState<IdType>(
    (userProfile.idType as IdType) || 'NID'
  );
  const [kycIdNumber, setKycIdNumber] = useState(userProfile.idNumber || '');
  const [kycIdPhoto, setKycIdPhoto] = useState('');
  const [kycPortrait, setKycPortrait] = useState('');
  const [kycBusy, setKycBusy] = useState(false);

  useEffect(() => {
    setDisplayName(userProfile.fullName);
    setKycName(userProfile.fullName);
  }, [userProfile.fullName]);

  useEffect(() => {
    const code = userProfile.countryCode || 'BD';
    const c = getCountryByCode(code);
    setPhoneCountryCode(code);
    if (userProfile.phoneNumber && userProfile.phoneNumber.startsWith(c.dialPrefix)) {
      setPhoneDigits(userProfile.phoneNumber.slice(c.dialPrefix.length));
    }
    setPhoneOtpStep(userProfile.phoneVerified ? 'verified' : 'idle');
  }, [userProfile.countryCode, userProfile.phoneNumber, userProfile.phoneVerified]);

  const activePhoneCountry = getCountryByCode(phoneCountryCode);
  const phoneCheck = validateCountryPhoneNumber(activePhoneCountry, phoneDigits);

  const initials = (userProfile.fullName || userProfile.handle || 'VC')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarBusy(true);
    try {
      const compressed = await compressImageToDataUrl(file, 320, 0.78);
      if (compressed.length > 295000) {
        throw new Error('Selected image is too large even after compression. Choose a smaller photo.');
      }
      await onUpdateProfileAvatar(compressed);
      onNotify('ok', 'Custom profile avatar updated.');
    } catch (err) {
      onNotify('err', err instanceof Error ? err.message : 'Failed to upload avatar.');
    } finally {
      setAvatarBusy(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarBusy(true);
    try {
      await onUpdateProfileAvatar('');
      onNotify('ok', 'Custom profile avatar removed.');
    } catch (err) {
      onNotify('err', err instanceof Error ? err.message : 'Failed to remove avatar.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleSaveDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = displayName.trim();
    if (!clean) {
      onNotify('err', 'Display name cannot be empty.');
      return;
    }
    setAvatarBusy(true);
    try {
      await onUpdateProfileAvatar(userProfile.avatarData || '', clean);
      onNotify('ok', 'Profile display name saved.');
    } catch (err) {
      onNotify('err', err instanceof Error ? err.message : 'Failed to save display name.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleEmailUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPendingEmailNotice(null);
    setEmailBusy(true);
    try {
      const res = await onUpdateAccountEmail(newEmail, currentPassword || undefined);
      setNewEmail('');
      setCurrentPassword('');
      if (res.status === 'verification_sent') {
        const msg = `Verification link sent to ${res.email}. Click the link in your new inbox to complete updating your account email.`;
        setPendingEmailNotice(msg);
        onNotify('ok', msg);
      } else {
        onNotify('ok', `Account email updated to ${res.email}.`);
      }
    } catch (err) {
      onNotify('err', err instanceof Error ? err.message : 'Failed to update account email.');
    } finally {
      setEmailBusy(false);
    }
  };

  const kycBadge = (() => {
    if (userProfile.kycStatus === 'approved') {
      return {
        label: 'KYC APPROVED',
        cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35',
        Icon: CheckCircle2,
      };
    }
    if (userProfile.kycStatus === 'pending') {
      return {
        label: 'KYC PENDING REVIEW',
        cls: 'bg-amber-500/20 text-amber-300 border-amber-500/35',
        Icon: Clock,
      };
    }
    if (userProfile.kycStatus === 'rejected') {
      return {
        label: 'KYC REJECTED',
        cls: 'bg-red-500/20 text-red-300 border-red-500/35',
        Icon: XCircle,
      };
    }
    return {
      label: 'KYC UNSUBMITTED',
      cls: 'bg-slate-800 text-slate-300 border-slate-700',
      Icon: AlertTriangle,
    };
  })();
  const KycIcon = kycBadge.Icon;

  return (
    <section aria-labelledby="profile-management-heading" className="space-y-6">
      {/* Header & Custom Avatar Management */}
      <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/35 text-orange-400 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="profile-management-heading"
                className="font-display font-bold text-white text-lg sm:text-xl"
              >
                Profile Management
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Customize your profile avatar, review your KYC verification status, and manage your account email address.
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold ${kycBadge.cls}`}
          >
            <KycIcon className="w-3.5 h-3.5" />
            {kycBadge.label}
          </span>
        </div>

        {/* Avatar Upload + Profile Identity Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center pt-2 border-t border-slate-800/80">
          <div className="lg:col-span-5 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-orange-500/50 bg-slate-900 flex items-center justify-center shadow-lg">
                {userProfile.avatarData ? (
                  <img
                    src={userProfile.avatarData}
                    alt={`${userProfile.fullName} avatar`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-display font-extrabold text-2xl text-orange-400">
                    {initials}
                  </span>
                )}
              </div>
              <button
                type="button"
                disabled={avatarBusy}
                onClick={() => avatarInputRef.current?.click()}
                title="Upload custom avatar"
                className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-orange-600 hover:bg-orange-500 text-white border-2 border-[#0B111E] flex items-center justify-center shadow-md transition-colors"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleAvatarUpload}
                className="hidden"
                aria-label="Upload custom profile avatar"
              />
            </div>

            <div className="space-y-2 text-center sm:text-left">
              <div className="font-display font-bold text-white text-base">
                {userProfile.fullName}
              </div>
              <div className="text-xs font-mono text-orange-400">
                ID: {userProfile.handle}
              </div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                <button
                  type="button"
                  disabled={avatarBusy}
                  onClick={() => avatarInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{avatarBusy ? 'Uploading...' : 'Upload Avatar'}</span>
                </button>
                {userProfile.avatarData && (
                  <button
                    type="button"
                    disabled={avatarBusy}
                    onClick={handleRemoveAvatar}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                PNG, JPG, or WEBP. Automatically compressed for your Vault profile.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSaveDisplayName}
            className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-12 gap-3 bg-slate-900/65 border border-slate-700/70 rounded-xl p-4 items-end"
          >
            <div className="sm:col-span-8 space-y-1">
              <label className="block text-xs font-semibold text-slate-300">
                Profile Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-950/90 text-white text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="sm:col-span-4">
              <button
                type="submit"
                disabled={avatarBusy || displayName.trim() === userProfile.fullName}
                className="w-full py-2 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-600 text-white text-xs font-semibold transition-colors"
              >
                Save Name
              </button>
            </div>
            <div className="sm:col-span-12 flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
              <span>
                Email: <strong className="text-slate-200">{authEmail || userProfile.email}</strong>
              </span>
              <span>
                Member Since:{' '}
                <strong className="font-mono text-slate-200">
                  {formatTimestamp(userProfile.createdAt)}
                </strong>
              </span>
              <span>
                Role: <strong className="uppercase text-sky-300">{userProfile.role}</strong>
              </span>
            </div>
          </form>
        </div>
      </div>

      {/* Two-Column Grid: KYC Status & Account Email Update */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* KYC Verification Status Card */}
        <div className="lg:col-span-6 bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="font-display font-bold text-white text-base">
                KYC Verification Status
              </h3>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-md border text-[11px] font-semibold ${kycBadge.cls}`}
            >
              {userProfile.kycStatus.toUpperCase()}
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {userProfile.kycStatus === 'approved'
              ? 'Your government-issued ID and portrait verification have been approved by compliance. Full deposit, package, withdrawal, and trading features are enabled.'
              : userProfile.kycStatus === 'pending'
              ? 'Your KYC documents are currently under review by Super Admin compliance. No further action is required while verification completes.'
              : userProfile.kycStatus === 'rejected'
              ? userProfile.kycRejectionReason ||
                'Your previous KYC submission was declined. Please upload clear, valid identification documents to resubmit.'
              : 'Complete your Know Your Customer (KYC) verification to ensure uninterrupted withdrawals and compliance clearance.'}
          </p>

          {onOpenKycVerification && (
            <button
              type="button"
              onClick={onOpenKycVerification}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              Open Global KYC Verification Center (All Countries + Free AI OCR)
            </button>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-900/75 border border-slate-700/70">
              <div className="text-slate-400">Document Type</div>
              <div className="font-semibold text-white mt-0.5">
                {userProfile.idType || 'Not Submitted'}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/75 border border-slate-700/70">
              <div className="text-slate-400">ID / Document Number</div>
              <div className="font-mono font-semibold text-white mt-0.5 truncate">
                {userProfile.idNumber || '—'}
              </div>
            </div>
          </div>

          {(userProfile.idPhotoData || userProfile.portraitPhotoData) && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-2.5 rounded-xl bg-slate-900/75 border border-slate-700/70 space-y-1.5">
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                  ID Document on File
                </div>
                {userProfile.idPhotoData && (
                  <img
                    src={userProfile.idPhotoData}
                    alt="Uploaded ID Document"
                    className="w-full h-24 object-cover rounded-lg border border-slate-800"
                  />
                )}
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/75 border border-slate-700/70 space-y-1.5">
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Portrait on File
                </div>
                {userProfile.portraitPhotoData && (
                  <img
                    src={userProfile.portraitPhotoData}
                    alt="Uploaded Portrait"
                    className="w-full h-24 object-cover rounded-lg border border-slate-800"
                  />
                )}
              </div>
            </div>
          )}

          {(userProfile.kycStatus === 'unsubmitted' ||
            userProfile.kycStatus === 'rejected') && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!kycName.trim() || !kycIdNumber.trim() || !kycIdPhoto || !kycPortrait) {
                  onNotify(
                    'err',
                    'Please provide your legal name, ID number, and both KYC photos.'
                  );
                  return;
                }
                setKycBusy(true);
                try {
                  await onSubmitKyc({
                    fullName: kycName,
                    idType: kycIdType,
                    idNumber: kycIdNumber,
                    idPhotoData: kycIdPhoto,
                    portraitPhotoData: kycPortrait,
                  });
                  onNotify('ok', 'KYC documents submitted for Super Admin review.');
                } catch (err) {
                  onNotify('err', err instanceof Error ? err.message : 'KYC submission failed.');
                } finally {
                  setKycBusy(false);
                }
              }}
              className="pt-3 border-t border-slate-800 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Full Legal Name
                  </label>
                  <input
                    type="text"
                    required
                    value={kycName}
                    onChange={(e) => setKycName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/90 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    ID Type
                  </label>
                  <select
                    value={kycIdType}
                    onChange={(e) => setKycIdType(e.target.value as IdType)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/90 text-white text-xs"
                  >
                    <option value="NID">National ID (NID)</option>
                    <option value="Passport">Passport</option>
                    <option value="Driving License">Driving License</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  ID Number
                </label>
                <input
                  type="text"
                  required
                  value={kycIdNumber}
                  onChange={(e) => setKycIdNumber(e.target.value)}
                  placeholder="Enter ID / Passport number"
                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/90 text-white font-mono text-xs"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <input
                    ref={kycIdInputRef}
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        setKycIdPhoto(await compressImageToDataUrl(file));
                      } catch (err) {
                        onNotify('err', (err as Error).message);
                      }
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => kycIdInputRef.current?.click()}
                    className={`w-full py-2 px-3 rounded-lg border border-dashed text-xs font-medium inline-flex items-center justify-center gap-1.5 ${
                      kycIdPhoto
                        ? 'border-emerald-500/60 bg-emerald-950/50 text-emerald-300'
                        : 'border-slate-600 text-slate-300 hover:bg-slate-800/70'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {kycIdPhoto ? 'ID Photo Ready' : 'Upload ID Photo'}
                  </button>
                </div>
                <div>
                  <input
                    ref={kycPortraitInputRef}
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        setKycPortrait(await compressImageToDataUrl(file));
                      } catch (err) {
                        onNotify('err', (err as Error).message);
                      }
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => kycPortraitInputRef.current?.click()}
                    className={`w-full py-2 px-3 rounded-lg border border-dashed text-xs font-medium inline-flex items-center justify-center gap-1.5 ${
                      kycPortrait
                        ? 'border-emerald-500/60 bg-emerald-950/50 text-emerald-300'
                        : 'border-slate-600 text-slate-300 hover:bg-slate-800/70'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {kycPortrait ? 'Portrait Ready' : 'Upload Portrait'}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={kycBusy}
                className="w-full py-2.5 px-4 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-semibold"
              >
                {kycBusy ? 'Submitting KYC...' : 'Submit KYC Verification'}
              </button>
            </form>
          )}
        </div>

        {/* Update Account Email Address Card */}
        <div className="lg:col-span-6 bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-sky-400" />
                <h3 className="font-display font-bold text-white text-base">
                  Account Email Address
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
                Verified
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/75 border border-slate-700/70 space-y-1">
              <div className="text-[11px] text-slate-400">Current Primary Email</div>
              <div className="font-mono font-semibold text-sm text-white break-all">
                {authEmail || userProfile.email}
              </div>
            </div>

            {pendingEmailNotice && (
              <div className="p-3.5 rounded-xl bg-sky-950/65 border border-sky-500/40 text-xs text-sky-200 leading-relaxed">
                {pendingEmailNotice}
              </div>
            )}

            <form onSubmit={handleEmailUpdate} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  New Account Email Address
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="new.email@domain.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900/90 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {usesPasswordProvider && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Current Password (Required for Email Change Security)
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current account password"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900/90 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={emailBusy || !newEmail.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold transition-colors"
              >
                {emailBusy ? 'Updating Email...' : 'Update Account Email'}
              </button>
            </form>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed pt-3 border-t border-slate-800/80">
            Updating your email synchronizes both your login credentials and your Vault P2P directory lookup. If email verification is required by security policy, a confirmation link will be delivered to your new inbox.
          </p>
        </div>
      </div>

      {/* Country & Phone Number Verification Card */}
      <div className="bg-[#0B111E]/78 backdrop-blur-md border border-slate-700/70 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-orange-400" />
            <div>
              <h3 className="font-display font-bold text-white text-base">
                Country &amp; Phone Verification
              </h3>
              <p className="text-xs text-slate-400">
                Registered country dial prefix and SMS phone verification status.
              </p>
            </div>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-md border text-[11px] font-semibold ${
              userProfile.phoneVerified
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/35'
            }`}
          >
            {userProfile.phoneVerified ? 'PHONE VERIFIED' : 'VERIFICATION PENDING'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4 space-y-1">
            <label className="block text-xs font-semibold text-slate-300">
              Country &amp; First Digit Prefix
            </label>
            <select
              value={phoneCountryCode}
              onChange={(e) => {
                setPhoneCountryCode(e.target.value);
                setPhoneDigits('');
                setPhoneOtpStep('idle');
                setPhoneOtpCode('');
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-900/90 text-white text-xs sm:text-sm"
            >
              {COUNTRY_PHONE_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name} ({c.dialPrefix})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-5 space-y-1">
            <label className="block text-xs font-semibold text-slate-300">
              Phone Number ({activePhoneCountry.dialPrefix}…)
            </label>
            <div className="flex items-stretch rounded-xl border border-slate-700 bg-slate-900/90 overflow-hidden">
              <span className="px-3 bg-slate-800 border-r border-slate-700 font-mono font-bold text-xs sm:text-sm text-orange-300 flex items-center gap-1 shrink-0">
                <span>{activePhoneCountry.flag}</span>
                <span>{activePhoneCountry.dialPrefix}</span>
              </span>
              <input
                type="tel"
                inputMode="numeric"
                value={phoneDigits}
                onChange={(e) => {
                  setPhoneDigits(normalizeRemainingPhoneDigits(activePhoneCountry, e.target.value));
                  setPhoneOtpStep('idle');
                }}
                placeholder={activePhoneCountry.placeholder}
                className="w-full px-3 py-2.5 bg-transparent font-mono text-sm text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="md:col-span-3 flex gap-2">
            <button
              type="button"
              disabled={phoneBusy || !phoneCheck.valid}
              onClick={async () => {
                if (!phoneCheck.valid) {
                  onNotify('err', phoneCheck.error || 'Enter a valid phone number.');
                  return;
                }
                if (!phoneRecaptchaRef.current) return;
                setPhoneBusy(true);
                try {
                  const { confirmation } = await sendFirebasePhoneOtp(
                    phoneCheck.fullNumber,
                    phoneRecaptchaRef.current
                  );
                  phoneConfirmRef.current = confirmation;
                  setPhoneOtpStep('sent');
                  setPhoneOtpCode('');
                  onNotify('ok', `SMS verification OTP sent to ${phoneCheck.fullNumber}.`);
                } catch (err) {
                  const code = (err as { code?: string })?.code || '';
                  if (
                    code === 'auth/operation-not-allowed' ||
                    code === 'auth/billing-not-enabled' ||
                    code === 'auth/unauthorized-domain' ||
                    code === 'auth/captcha-check-failed' ||
                    code === 'auth/internal-error'
                  ) {
                    await onUpdateUserPhone({
                      countryCode: activePhoneCountry.code,
                      countryName: activePhoneCountry.name,
                      phoneDialPrefix: activePhoneCountry.dialPrefix,
                      phoneNumber: phoneCheck.fullNumber,
                      phoneVerified: false,
                    });
                    onNotify(
                      'ok',
                      `Phone number ${phoneCheck.fullNumber} saved and queued for Compliance verification.`
                    );
                  } else {
                    onNotify('err', err instanceof Error ? err.message : 'Failed to send SMS OTP.');
                  }
                } finally {
                  setPhoneBusy(false);
                }
              }}
              className="flex-1 py-2.5 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-semibold"
            >
              {phoneBusy ? 'Sending...' : 'Verify SMS'}
            </button>
            <button
              type="button"
              disabled={phoneBusy || !phoneCheck.valid}
              onClick={async () => {
                if (!phoneCheck.valid) return;
                setPhoneBusy(true);
                try {
                  await onUpdateUserPhone({
                    countryCode: activePhoneCountry.code,
                    countryName: activePhoneCountry.name,
                    phoneDialPrefix: activePhoneCountry.dialPrefix,
                    phoneNumber: phoneCheck.fullNumber,
                    phoneVerified:
                      userProfile.phoneVerified === true &&
                      userProfile.phoneNumber === phoneCheck.fullNumber,
                  });
                  onNotify('ok', `Phone number ${phoneCheck.fullNumber} saved to profile.`);
                } catch (err) {
                  onNotify('err', err instanceof Error ? err.message : 'Failed to save phone number.');
                } finally {
                  setPhoneBusy(false);
                }
              }}
              className="py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-slate-200 text-xs font-semibold"
            >
              Save
            </button>
          </div>
        </div>

        {phoneOtpStep === 'sent' && (
          <div className="p-3 rounded-xl bg-slate-900/90 border border-orange-500/40 flex flex-wrap items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={phoneOtpCode}
              onChange={(e) => setPhoneOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter 6-digit SMS OTP"
              className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 font-mono text-sm text-white"
            />
            <button
              type="button"
              disabled={phoneBusy || phoneOtpCode.length < 4}
              onClick={async () => {
                if (!phoneConfirmRef.current || !phoneCheck.valid) return;
                setPhoneBusy(true);
                try {
                  const ok = await confirmFirebasePhoneOtp(
                    phoneConfirmRef.current,
                    phoneOtpCode,
                    phoneCheck.fullNumber
                  );
                  if (!ok) {
                    onNotify('err', 'OTP verification failed.');
                    return;
                  }
                  await onUpdateUserPhone({
                    countryCode: activePhoneCountry.code,
                    countryName: activePhoneCountry.name,
                    phoneDialPrefix: activePhoneCountry.dialPrefix,
                    phoneNumber: phoneCheck.fullNumber,
                    phoneVerified: true,
                  });
                  setPhoneOtpStep('verified');
                  onNotify('ok', `Phone number ${phoneCheck.fullNumber} verified and saved!`);
                } catch (err) {
                  onNotify('err', err instanceof Error ? err.message : 'OTP confirmation failed.');
                } finally {
                  setPhoneBusy(false);
                }
              }}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold"
            >
              Confirm OTP
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>
            Saved on File:{' '}
            <strong className="font-mono text-slate-200">
              {userProfile.countryName
                ? `${userProfile.countryName} · ${userProfile.phoneNumber || '—'}`
                : userProfile.phoneNumber || 'Not set yet'}
            </strong>
          </span>
          <span className="font-mono text-slate-400">Preview: {phoneCheck.fullNumber}</span>
        </div>

        <div ref={phoneRecaptchaRef} />
      </div>
    </section>
  );
};
