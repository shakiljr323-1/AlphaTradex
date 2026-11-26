import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  FileCheck,
  Globe,
  Info,
  Loader2,
  QrCode,
  RefreshCw,
  ScanLine,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { DEFAULT_GLOBAL_KYC_SETTINGS } from '../constants/defaults';
import {
  GLOBAL_KYC_COUNTRIES,
  GlobalKycCountry,
  getGlobalKycCountry,
  isoToFlagEmoji,
  validateKycDocumentNumber,
} from '../constants/globalKycCountries';
import { usePlatform } from '../context/PlatformContext';
import {
  decodeDocumentBarcodeFromVideo,
  FreeDocumentScanResult,
  parseDocumentQrPayload,
  scanDocumentFreeAutoFill,
} from '../lib/freeDocumentScanner';
import {
  extractKycDocumentOcr,
  KycOcrExtractedFields,
  KycOcrExtractResponse,
} from '../lib/kycApi';
import { IdType } from '../types/platform';
import { compressImageToDataUrl, formatTimestamp } from '../utils/investmentMath';

const REGIONS = [
  'All',
  'Asia',
  'Europe',
  'North America',
  'South America',
  'Middle East',
  'Africa',
  'Oceania',
] as const;

export const GlobalKycVerificationView: React.FC = () => {
  const { userProfile, authUser, platformConfig, submitKycUpdate } = usePlatform();

  const kycSettings = platformConfig.kycSettings || DEFAULT_GLOBAL_KYC_SETTINGS;
  const disabledSet = useMemo(
    () => new Set((kycSettings.disabledCountryCodes || []).map((c) => c.toUpperCase())),
    [kycSettings.disabledCountryCodes]
  );

  // Country & Document Type state
  const initialCountryCode =
    userProfile?.kycCountryCode || userProfile?.countryCode || 'BD';
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>(initialCountryCode);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [regionFilter, setRegionFilter] = useState<(typeof REGIONS)[number]>('All');

  const [idType, setIdType] = useState<IdType>(
    userProfile?.idType && ['NID', 'Passport', 'Driving License'].includes(userProfile.idType)
      ? (userProfile.idType as IdType)
      : 'NID'
  );

  // Evidence photos
  const [frontPhoto, setFrontPhoto] = useState<string>(userProfile?.idPhotoData || '');
  const [backPhoto, setBackPhoto] = useState<string>(userProfile?.idBackPhotoData || '');
  const [selfiePhoto, setSelfiePhoto] = useState<string>(userProfile?.portraitPhotoData || '');

  // Extracted / Editable KYC fields
  const [fullName, setFullName] = useState<string>(
    userProfile?.fullName || authUser?.displayName || ''
  );
  const [idNumber, setIdNumber] = useState<string>(userProfile?.idNumber || '');
  const [dateOfBirth, setDateOfBirth] = useState<string>(userProfile?.kycDateOfBirth || '');
  const [nationality, setNationality] = useState<string>(userProfile?.kycNationality || '');
  const [issueDate, setIssueDate] = useState<string>(userProfile?.kycIssueDate || '');
  const [expiryDate, setExpiryDate] = useState<string>(userProfile?.kycExpiryDate || '');
  const [address, setAddress] = useState<string>(userProfile?.kycAddress || '');

  // Free Local QR / PDF417 / MRZ / OCR state
  const [freeScanLoading, setFreeScanLoading] = useState(false);
  const [freeScanProgress, setFreeScanProgress] = useState('');
  const [freeScanResult, setFreeScanResult] = useState<FreeDocumentScanResult | null>(null);

  // Built-in AI Vision OCR state
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<KycOcrExtractResponse | null>(null);
  const [ocrError, setOcrError] = useState('');

  // Live Selfie Camera modal state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Live QR / PDF417 Document Camera Scanner modal state
  const [qrCamOpen, setQrCamOpen] = useState(false);
  const [qrCamError, setQrCamError] = useState('');
  const qrVideoRef = useRef<HTMLVideoElement | null>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);
  const qrPollRef = useRef<number | null>(null);

  // File input refs
  const frontInputRef = useRef<HTMLInputElement | null>(null);
  const backInputRef = useRef<HTMLInputElement | null>(null);
  const selfieInputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const selectedCountry: GlobalKycCountry = useMemo(
    () => getGlobalKycCountry(selectedCountryCode),
    [selectedCountryCode]
  );

  const activeDocRule = selectedCountry.documentRules[idType];
  const requiresBackSide =
    idType !== 'Passport' &&
    (kycSettings.requireBackSideForCards || activeDocRule.requiresBackImage);
  const isCountryRestricted = disabledSet.has(selectedCountry.code);

  const idFormatValidation = useMemo(
    () => validateKycDocumentNumber(selectedCountry, idType, idNumber),
    [selectedCountry, idType, idNumber]
  );

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    return GLOBAL_KYC_COUNTRIES.filter((c) => {
      if (regionFilter !== 'All' && c.region !== regionFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.nationality.toLowerCase().includes(q)
      );
    });
  }, [countrySearch, regionFilter]);

  useEffect(() => {
    if (!nationality && selectedCountry.nationality) {
      setNationality(selectedCountry.nationality);
    }
  }, [nationality, selectedCountry.nationality]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCountryDropdownOpen(false);
      }
    };
    if (countryDropdownOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [countryDropdownOpen]);

  // Camera cleanup helpers
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  const stopQrScanner = () => {
    if (qrPollRef.current !== null) {
      window.clearInterval(qrPollRef.current);
      qrPollRef.current = null;
    }
    if (qrStreamRef.current) {
      qrStreamRef.current.getTracks().forEach((t) => t.stop());
      qrStreamRef.current = null;
    }
    setQrCamOpen(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (qrPollRef.current !== null) window.clearInterval(qrPollRef.current);
      if (qrStreamRef.current) qrStreamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const applyExtractedFields = (fields: Partial<KycOcrExtractedFields>, overwrite = true) => {
    if (fields.fullName && (overwrite || !fullName.trim())) setFullName(fields.fullName);
    if (fields.documentNumber && (overwrite || !idNumber.trim())) setIdNumber(fields.documentNumber);
    if (fields.dateOfBirth && (overwrite || !dateOfBirth.trim())) setDateOfBirth(fields.dateOfBirth);
    if (fields.nationality && (overwrite || !nationality.trim())) setNationality(fields.nationality);
    if (fields.issueDate && (overwrite || !issueDate.trim())) setIssueDate(fields.issueDate);
    if (fields.expiryDate && (overwrite || !expiryDate.trim())) setExpiryDate(fields.expiryDate);
    if (fields.address && (overwrite || !address.trim())) setAddress(fields.address);
  };

  /**
   * 100% FREE automatic document QR / PDF417 / MRZ / Local OCR scan whenever Front or Back ID is uploaded or updated.
   * Scans the original high-resolution image BEFORE compression for maximum QR & PDF417 barcode accuracy!
   */
  const runFreeLocalScan = async (imageSrc: string, sideLabel: 'Front' | 'Back') => {
    setOcrError('');
    setFreeScanLoading(true);
    setFreeScanProgress(`Auto-scanning ${sideLabel} ID for QR / PDF417 barcode (Free)...`);
    try {
      const scan = await scanDocumentFreeAutoFill({
        imageSrc,
        countryHint: selectedCountry,
        runLocalOcrFallback: true,
        onProgress: (txt) => setFreeScanProgress(txt),
      });
      setFreeScanResult(scan);
      if (scan.detectedFieldsCount > 0) {
        const isQrOrMrz =
          scan.method === 'QR_CODE' ||
          scan.method === 'PDF_417' ||
          scan.method === 'AZTEC' ||
          scan.method === 'DATA_MATRIX' ||
          scan.method === 'ICAO_MRZ';
        applyExtractedFields(scan.extracted, isQrOrMrz);
        setFeedback({
          type: 'ok',
          text: `${sideLabel} ID scanned automatically ($0 Free): ${scan.notes}`,
        });
      }
    } catch (err) {
      setOcrError(
        err instanceof Error
          ? err.message
          : 'Free local scanner could not read this photo. Try a sharper photo or edit fields manually.'
      );
    } finally {
      setFreeScanLoading(false);
      setFreeScanProgress('');
    }
  };

  const openLiveQrScanner = async () => {
    setQrCamError('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setQrCamError('Live camera unavailable in this browser. Upload your Front or Back ID photo to auto-scan its QR/barcode.');
      return;
    }
    try {
      setQrCamOpen(true);
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      qrStreamRef.current = stream;
      if (qrVideoRef.current) {
        qrVideoRef.current.srcObject = stream;
        await qrVideoRef.current.play();
      }

      let decodingFrame = false;
      qrPollRef.current = window.setInterval(async () => {
        if (decodingFrame || !qrVideoRef.current) return;
        decodingFrame = true;
        try {
          const hit = await decodeDocumentBarcodeFromVideo(qrVideoRef.current);
          if (hit) {
            const parsed = parseDocumentQrPayload(hit.text, selectedCountry);
            const count = Object.values(parsed.extracted).filter(
              (v) => typeof v === 'string' && v.trim().length > 0
            ).length;
            const scanRes: FreeDocumentScanResult = {
              extracted: parsed.extracted,
              detectedFieldsCount: count,
              method: hit.format.includes('PDF') ? 'PDF_417' : 'QR_CODE',
              barcodeFormat: hit.format,
              rawQrSnippet: hit.text.slice(0, 140),
              confidence: count >= 2 ? 97 : 85,
              notes: `Live-scanned ${parsed.formatLabel} (${hit.format}) via camera at $0 cost and auto-filled ${count} field${count === 1 ? '' : 's'}.`,
              providerLabel: `Free Live Camera QR/Barcode Scanner (${hit.format})`,
            };
            setFreeScanResult(scanRes);
            applyExtractedFields(parsed.extracted, true);
            setFeedback({
              type: 'ok',
              text: scanRes.notes,
            });
            stopQrScanner();
          }
        } catch {
          // Ignore single-frame decode misses
        } finally {
          decodingFrame = false;
        }
      }, 380);
    } catch {
      stopQrScanner();
      setQrCamError(
        'Camera permission denied. Upload your Front or Back document image instead — it will automatically scan the QR/PDF417 code!'
      );
    }
  };

  const openLiveCamera = async () => {
    setCameraError('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Live camera is unavailable in this browser. Use the Upload Selfie button instead.');
      return;
    }
    try {
      setCameraOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      stopCamera();
      setCameraError(
        'Camera permission denied or unavailable. You can still upload a clear live selfie photo below.'
      );
    }
  };

  const captureCameraSelfie = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    const maxDim = 480;
    const ratio = Math.min(maxDim / video.videoWidth, maxDim / video.videoHeight, 1);
    canvas.width = Math.max(1, Math.round(video.videoWidth * ratio));
    canvas.height = Math.max(1, Math.round(video.videoHeight * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
    setSelfiePhoto(dataUrl);
    stopCamera();
    setFeedback({
      type: 'ok',
      text: 'Live selfie captured and attached to your KYC dossier.',
    });
  };

  const handleDocumentUploadAndAutoScan = async (
    file: File,
    setter: (dataUrl: string) => void,
    sideLabel: 'Front' | 'Back' | 'Selfie'
  ) => {
    setOcrError('');
    setFeedback(null);

    // Keep high-res object URL for crisp QR/PDF417 barcode scanning BEFORE compressing for Firestore
    const highResUrl = sideLabel !== 'Selfie' ? URL.createObjectURL(file) : '';
    try {
      const compressed = await compressImageToDataUrl(file, 480, 0.62);
      const finalImg =
        compressed.length > 250_000 ? await compressImageToDataUrl(file, 380, 0.52) : compressed;
      setter(finalImg);

      // Automatically scan QR / PDF417 / MRZ / Free Local OCR immediately when Front or Back ID is uploaded/updated
      if (sideLabel === 'Front' || sideLabel === 'Back') {
        await runFreeLocalScan(highResUrl || finalImg, sideLabel);
      }
    } catch {
      setFeedback({
        type: 'err',
        text: `Failed to process ${sideLabel} photo. Please upload a valid JPG, PNG, or WebP image.`,
      });
    } finally {
      if (highResUrl) URL.revokeObjectURL(highResUrl);
    }
  };

  const runOptionalAiOcr = async (idOnly = false) => {
    setOcrError('');
    setOcrLoading(true);
    try {
      const res = await extractKycDocumentOcr({
        countryCode: selectedCountry.code,
        countryName: selectedCountry.name,
        nationalityHint: selectedCountry.nationality,
        idType,
        idNumber: idNumber.trim(),
        currentFullName: fullName.trim(),
        frontImageDataUrl: idOnly ? undefined : frontPhoto || undefined,
        backImageDataUrl: idOnly ? undefined : backPhoto || undefined,
        selfieDataUrl: idOnly ? undefined : selfiePhoto || undefined,
      });

      setOcrResult(res);
      applyExtractedFields(res.extracted, true);
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : 'Unable to extract document details.');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (isCountryRestricted) {
      setFeedback({
        type: 'err',
        text: `KYC submissions from ${selectedCountry.name} are currently restricted by platform policy.`,
      });
      return;
    }
    if (!fullName.trim()) {
      setFeedback({ type: 'err', text: 'Full legal name matching your ID document is required.' });
      return;
    }
    if (!idNumber.trim()) {
      setFeedback({ type: 'err', text: 'Document ID / Passport / License number is required.' });
      return;
    }
    if (!frontPhoto) {
      setFeedback({ type: 'err', text: 'Please upload the Front Side photo of your government ID.' });
      return;
    }
    if (requiresBackSide && !backPhoto) {
      setFeedback({
        type: 'err',
        text: `Please upload the Back Side photo of your ${activeDocRule.localLabel}.`,
      });
      return;
    }
    if (kycSettings.requireLiveSelfie && !selfiePhoto) {
      setFeedback({
        type: 'err',
        text: 'Please capture a live selfie or upload a clear portrait photo for liveness verification.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const verificationMethod = freeScanResult
        ? `${freeScanResult.providerLabel} + Compliance Review`
        : ocrResult?.verificationSource === 'FREE_GEMINI_OCR'
        ? 'Free AI Vision OCR + Compliance Review'
        : ocrResult?.verificationSource === 'FORMAT_SMART_PARSE'
        ? 'Smart Format Parse + Manual Review'
        : 'Manual Document Upload + Compliance Review';

      const confidenceScore = Math.max(freeScanResult?.confidence ?? 0, ocrResult?.confidence ?? 0);

      await submitKycUpdate({
        fullName: fullName.trim(),
        idType,
        idNumber: idNumber.trim(),
        idPhotoData: frontPhoto,
        idBackPhotoData: backPhoto,
        portraitPhotoData: selfiePhoto,
        kycCountryCode: selectedCountry.code,
        kycCountryName: selectedCountry.name,
        kycDateOfBirth: dateOfBirth.trim(),
        kycNationality: nationality.trim() || selectedCountry.nationality,
        kycIssueDate: issueDate.trim(),
        kycExpiryDate: expiryDate.trim(),
        kycAddress: address.trim(),
        kycVerificationMethod: verificationMethod.slice(0, 80),
        kycApiVerificationStatus: freeScanResult || ocrResult ? 'ocr_preview_only' : 'manual_review',
        kycOcrConfidence: confidenceScore,
        kycLivenessPassed: Boolean(ocrResult?.livenessCheckPassed || selfiePhoto),
      });

      setFeedback({
        type: 'ok',
        text: 'Global KYC dossier submitted successfully. Status is now Pending Review by our compliance team.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to submit KYC verification.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!userProfile) return null;

  const statusMeta = (() => {
    switch (userProfile.kycStatus) {
      case 'approved':
        return {
          label: 'Verified',
          tone: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          Icon: CheckCircle2,
          desc: 'Your global identity verification is approved. All platform trading, deposit, reward claim, and withdrawal limits are unlocked.',
        };
      case 'pending':
        return {
          label: 'Pending Review',
          tone: 'border-amber-500/35 bg-amber-500/10 text-amber-200',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          Icon: Clock,
          desc: 'Your identity documents and auto-scanned KYC dossier are queued for Super Admin compliance inspection.',
        };
      case 'rejected':
        return {
          label: userProfile.kycResubmissionRequested ? 'Re-submission Requested' : 'Rejected',
          tone: 'border-rose-500/35 bg-rose-500/10 text-rose-200',
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          Icon: XCircle,
          desc:
            userProfile.kycRejectionReason ||
            'Your previous KYC submission could not be verified. Review the feedback and re-submit clear document photos.',
        };
      default:
        return {
          label: 'Unverified',
          tone: 'border-slate-700 bg-slate-900/80 text-slate-200',
          badge: 'bg-slate-800 text-slate-300 border-slate-700',
          Icon: ShieldAlert,
          desc: 'Upload your National ID, Passport, or Driving License — our 100% Free built-in QR, PDF417 barcode & MRZ scanner auto-fills your document details instantly.',
        };
    }
  })();

  const policyRequirements = [
    { label: 'Deposits', required: kycSettings.requireKycForDeposits },
    { label: 'Package Activation', required: kycSettings.requireKycForPackages },
    { label: 'Reward Claims', required: kycSettings.requireKycForClaims },
    { label: 'Withdrawals', required: kycSettings.requireKycForWithdrawals },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header & Real-Time Status Card */}
      <div className={`rounded-2xl border p-6 ${statusMeta.tone}`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-slate-950/60 border border-white/10 flex items-center justify-center shrink-0">
              <statusMeta.Icon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl font-semibold text-white tracking-tight">
                  Global KYC Verification Center
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-semibold ${statusMeta.badge}`}
                >
                  {statusMeta.label}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                  <QrCode className="h-3 w-3" />
                  100% Free Auto QR &amp; OCR
                </span>
              </div>
              <p className="mt-1.5 text-sm text-slate-300 max-w-2xl leading-relaxed">
                {statusMeta.desc}
              </p>
              {userProfile.kycStatus === 'rejected' && userProfile.kycRejectionReason && (
                <div className="mt-3 inline-flex items-start gap-2 rounded-lg border border-rose-400/40 bg-rose-950/60 px-3 py-2 text-xs text-rose-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                  <div>
                    <span className="font-semibold text-rose-300">Compliance Feedback: </span>
                    {userProfile.kycRejectionReason}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-start lg:items-end gap-1.5 text-xs text-slate-400 shrink-0 tabular-nums">
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <Globe className="h-3.5 w-3.5 text-emerald-400" />
              <span>195+ Countries Supported</span>
            </div>
            {userProfile.kycSubmittedAtMs ? (
              <span>Last submitted: {formatTimestamp(null, userProfile.kycSubmittedAtMs)}</span>
            ) : (
              <span>Engine: Free QR / PDF417 / MRZ + Local OCR ($0)</span>
            )}
            {userProfile.kycReviewedAtMs ? (
              <span>Reviewed: {formatTimestamp(null, userProfile.kycReviewedAtMs)}</span>
            ) : null}
          </div>
        </div>

        {/* Active Platform Policy Strip */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <span className="font-semibold uppercase tracking-wider text-slate-400">
            Platform KYC Policy:
          </span>
          {policyRequirements.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  item.required
                    ? userProfile.kycStatus === 'approved'
                      ? 'bg-emerald-400'
                      : 'bg-amber-400'
                    : 'bg-slate-600'
                }`}
              />
              <span className="text-slate-300">{item.label}:</span>
              <span
                className={
                  item.required
                    ? userProfile.kycStatus === 'approved'
                      ? 'text-emerald-300 font-semibold'
                      : 'text-amber-300 font-semibold'
                    : 'text-slate-400'
                }
              >
                {item.required
                  ? userProfile.kycStatus === 'approved'
                    ? 'Unlocked'
                    : 'KYC Required'
                  : 'Optional'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
            feedback.type === 'ok'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {feedback.type === 'ok' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Verification Form */}
      <form onSubmit={handleSubmitKyc} className="space-y-6">
        {/* STEP 1: Country & Document Type */}
        <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-white/10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Step 1 of 3
              </p>
              <h3 className="text-base font-semibold text-white mt-0.5">
                Issuing Country &amp; Document Type
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              Supports BD Smart NID PDF417, Aadhaar QR, AAMVA DL &amp; Global Passport MRZ
            </span>
          </div>

          <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Searchable Worldwide Country Dropdown */}
            <div className="lg:col-span-5 relative" ref={dropdownRef}>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Issuing Country / Jurisdiction
              </label>
              <button
                type="button"
                onClick={() => setCountryDropdownOpen((prev) => !prev)}
                className="w-full flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-slate-950/90 px-4 py-3 text-left text-sm text-white hover:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-colors"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="text-xl leading-none" aria-hidden="true">
                    {isoToFlagEmoji(selectedCountry.code)}
                  </span>
                  <span className="truncate">
                    <span className="font-medium text-white">{selectedCountry.name}</span>
                    <span className="ml-2 text-xs text-slate-400">({selectedCountry.code})</span>
                  </span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${
                    countryDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isCountryRestricted && (
                <p className="mt-2 text-xs text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Verification for {selectedCountry.name} is currently disabled by administrator.
                </p>
              )}

              {countryDropdownOpen && (
                <div className="absolute z-30 mt-2 w-full rounded-xl border border-white/15 bg-[#0b1120] shadow-2xl overflow-hidden">
                  <div className="p-3 border-b border-white/10 space-y-2.5">
                    <div className="relative">
                      <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        placeholder="Search any country or ISO code..."
                        autoFocus
                        className="w-full rounded-lg border border-white/10 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {REGIONS.map((reg) => (
                        <button
                          key={reg}
                          type="button"
                          onClick={() => setRegionFilter(reg)}
                          className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                            regionFilter === reg
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-transparent'
                          }`}
                        >
                          {reg}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-white/5">
                    {filteredCountries.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No countries matched &ldquo;{countrySearch}&rdquo;
                      </div>
                    ) : (
                      filteredCountries.map((country) => {
                        const blocked = disabledSet.has(country.code);
                        const isSelected = country.code === selectedCountry.code;
                        return (
                          <button
                            key={country.code}
                            type="button"
                            onClick={() => {
                              setSelectedCountryCode(country.code);
                              setNationality(country.nationality);
                              setCountryDropdownOpen(false);
                              setCountrySearch('');
                            }}
                            className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs transition-colors ${
                              isSelected
                                ? 'bg-emerald-500/15 text-emerald-200'
                                : 'hover:bg-white/5 text-slate-200'
                            }`}
                          >
                            <span className="flex items-center gap-2.5 min-w-0">
                              <span className="text-base leading-none">
                                {isoToFlagEmoji(country.code)}
                              </span>
                              <span className="truncate font-medium">{country.name}</span>
                              <span className="text-slate-500">({country.code})</span>
                            </span>
                            {blocked ? (
                              <span className="text-[10px] font-semibold uppercase text-rose-400 shrink-0">
                                Restricted
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 shrink-0">
                                {country.region}
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic Document Type Selector */}
            <div className="lg:col-span-7">
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Select Government-Issued Document
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(['NID', 'Passport', 'Driving License'] as IdType[]).map((type) => {
                  const rule = selectedCountry.documentRules[type];
                  const active = idType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setIdType(type)}
                      className={`rounded-xl border p-3.5 text-left transition-all ${
                        active
                          ? 'border-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-400/30'
                          : 'border-white/10 bg-slate-950/70 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <CreditCard
                          className={`h-4 w-4 ${active ? 'text-emerald-400' : 'text-slate-400'}`}
                        />
                        <span className="text-[10px] uppercase tracking-wide text-slate-400">
                          {type === 'Passport' ? 'MRZ + Photo' : 'Front + Back QR'}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-white">{type}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-1">
                        {rule.localLabel}
                      </p>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2.5 text-xs text-slate-400">
                <span className="text-slate-300 font-medium">{activeDocRule.localLabel}:</span>{' '}
                {activeDocRule.formatHint} (
                <span className="font-mono text-emerald-300">{activeDocRule.placeholder}</span>)
              </p>
            </div>
          </div>
        </div>

        {/* STEP 2: Document Upload (Auto-Scans QR/PDF417/MRZ) + Live QR Camera + Selfie */}
        <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-4 border-b border-white/10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Step 2 of 3 · Zero-Cost Auto QR &amp; Barcode Fill
              </p>
              <h3 className="text-base font-semibold text-white mt-0.5">
                Upload Document (Auto-Scans QR / PDF417) &amp; Live Selfie
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void openLiveQrScanner()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3.5 py-2 text-xs font-semibold text-slate-950 transition-colors"
              >
                <QrCode className="h-3.5 w-3.5" />
                Live Scan ID QR / Barcode
              </button>

              {kycSettings.allowFreeAiOcr && (
                <button
                  type="button"
                  disabled={ocrLoading || freeScanLoading || (!frontPhoto && !backPhoto)}
                  onClick={() => void runOptionalAiOcr(false)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 disabled:opacity-45 px-3 py-2 text-xs font-semibold text-sky-300 transition-colors"
                >
                  {ocrLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {ocrLoading ? 'Enhancing...' : 'AI Vision Boost (Free)'}
                </button>
              )}
            </div>
          </div>

          {/* Live Free Scan Progress Indicator */}
          {freeScanLoading && (
            <div className="mt-4 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200 flex items-center gap-2.5">
              <Loader2 className="h-4 w-4 text-emerald-400 animate-spin shrink-0" />
              <span>{freeScanProgress || 'Scanning document QR / PDF417 / MRZ locally...'}</span>
            </div>
          )}

          {qrCamError && (
            <div className="mt-4 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{qrCamError}</span>
            </div>
          )}

          {/* Document Number Row */}
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
            <div className="lg:col-span-8">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {activeDocRule.localLabel} Number
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder={activeDocRule.placeholder}
                  maxLength={64}
                  className="flex-1 rounded-xl border border-white/15 bg-slate-950 px-4 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                />
                <button
                  type="button"
                  disabled={ocrLoading || !idNumber.trim()}
                  onClick={() => void runOptionalAiOcr(true)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-40 px-4 py-2.5 text-xs font-semibold text-slate-200 transition-colors shrink-0"
                >
                  <ScanLine className="h-3.5 w-3.5" />
                  Smart Parse ID
                </button>
              </div>
              {idNumber.trim() && (
                <p
                  className={`mt-1.5 text-xs flex items-center gap-1.5 ${
                    idFormatValidation.valid ? 'text-emerald-400' : 'text-amber-300'
                  }`}
                >
                  {idFormatValidation.valid ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      {idFormatValidation.message}
                    </>
                  ) : (
                    <>
                      <Info className="h-3.5 w-3.5 shrink-0" />
                      {idFormatValidation.message}
                    </>
                  )}
                </p>
              )}
            </div>
            <div className="lg:col-span-4 rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-3.5 py-2.5 text-xs text-slate-300">
              <p className="font-semibold text-emerald-300 flex items-center gap-1.5">
                <QrCode className="h-3.5 w-3.5" />
                Instant Document Auto-Fill ($0)
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400 leading-relaxed">
                Upload Front or Back ID (with QR / PDF417 barcode) — your Name, DOB, ID Number &amp;
                Address fill automatically in your browser.
              </p>
            </div>
          </div>

          {/* 3-Column Photo Capture Grid */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Front ID */}
            <div className="rounded-xl border border-white/10 bg-slate-950/80 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span className="text-xs font-semibold text-white">1. Document Front Side</span>
                  <span className="text-[10px] font-semibold uppercase text-emerald-400">
                    Auto-Scans
                  </span>
                </div>
                {frontPhoto ? (
                  <div className="relative rounded-lg overflow-hidden border border-white/10 bg-slate-900 aspect-[16/10]">
                    <img
                      src={frontPhoto}
                      alt="Front side of ID document"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFrontPhoto('')}
                      className="absolute top-2 right-2 rounded-md bg-slate-950/85 p-1 text-slate-300 hover:text-white"
                      aria-label="Remove front ID photo"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => frontInputRef.current?.click()}
                    className="w-full aspect-[16/10] rounded-lg border border-dashed border-white/20 hover:border-emerald-400/60 bg-slate-900/50 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-emerald-300 transition-colors"
                  >
                    <Upload className="h-5 w-5" />
                    <span className="text-xs font-medium">Upload Front ID</span>
                    <span className="text-[10px] text-slate-500">Auto-reads QR, MRZ &amp; Text</span>
                  </button>
                )}
              </div>
              <input
                ref={frontInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void handleDocumentUploadAndAutoScan(file, setFrontPhoto, 'Front');
                  }
                  e.target.value = '';
                }}
              />
              {frontPhoto && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => frontInputRef.current?.click()}
                    className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 py-1.5 text-xs font-medium text-slate-200 transition-colors"
                  >
                    Update Photo
                  </button>
                  <button
                    type="button"
                    disabled={freeScanLoading}
                    onClick={() => void runFreeLocalScan(frontPhoto, 'Front')}
                    className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/20 py-1.5 text-xs font-semibold text-emerald-300 transition-colors"
                  >
                    Re-Scan QR
                  </button>
                </div>
              )}
            </div>

            {/* Back ID (Primary QR / PDF417 Side for BD Smart NID & Driving Licenses) */}
            <div className="rounded-xl border border-white/10 bg-slate-950/80 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span className="text-xs font-semibold text-white">
                    2. Document Back (QR / PDF417)
                  </span>
                  <span
                    className={`text-[10px] font-semibold uppercase ${
                      requiresBackSide ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  >
                    {requiresBackSide ? 'Auto-Scans' : 'Optional'}
                  </span>
                </div>
                {backPhoto ? (
                  <div className="relative rounded-lg overflow-hidden border border-white/10 bg-slate-900 aspect-[16/10]">
                    <img
                      src={backPhoto}
                      alt="Back side of ID document"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setBackPhoto('')}
                      className="absolute top-2 right-2 rounded-md bg-slate-950/85 p-1 text-slate-300 hover:text-white"
                      aria-label="Remove back ID photo"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => backInputRef.current?.click()}
                    className="w-full aspect-[16/10] rounded-lg border border-dashed border-emerald-500/30 hover:border-emerald-400 bg-slate-900/50 flex flex-col items-center justify-center gap-2 text-slate-300 hover:text-emerald-300 transition-colors"
                  >
                    <QrCode className="h-5 w-5 text-emerald-400" />
                    <span className="text-xs font-medium">Upload Back Side (QR/Barcode)</span>
                    <span className="text-[10px] text-slate-500">
                      Instant PDF417 / QR Auto-Fill
                    </span>
                  </button>
                )}
              </div>
              <input
                ref={backInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void handleDocumentUploadAndAutoScan(file, setBackPhoto, 'Back');
                  }
                  e.target.value = '';
                }}
              />
              {backPhoto && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => backInputRef.current?.click()}
                    className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 py-1.5 text-xs font-medium text-slate-200 transition-colors"
                  >
                    Update Photo
                  </button>
                  <button
                    type="button"
                    disabled={freeScanLoading}
                    onClick={() => void runFreeLocalScan(backPhoto, 'Back')}
                    className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/20 py-1.5 text-xs font-semibold text-emerald-300 transition-colors"
                  >
                    Re-Scan QR
                  </button>
                </div>
              )}
            </div>

            {/* Live Selfie / Liveness Check */}
            <div className="rounded-xl border border-white/10 bg-slate-950/80 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span className="text-xs font-semibold text-white">
                    3. Live Selfie / Liveness
                  </span>
                  <span
                    className={`text-[10px] font-semibold uppercase ${
                      kycSettings.requireLiveSelfie ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  >
                    {kycSettings.requireLiveSelfie ? 'Required' : 'Optional'}
                  </span>
                </div>
                {selfiePhoto ? (
                  <div className="relative rounded-lg overflow-hidden border border-white/10 bg-slate-900 aspect-[16/10]">
                    <img
                      src={selfiePhoto}
                      alt="Live selfie verification"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setSelfiePhoto('')}
                      className="absolute top-2 right-2 rounded-md bg-slate-950/85 p-1 text-slate-300 hover:text-white"
                      aria-label="Remove selfie photo"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="w-full aspect-[16/10] rounded-lg border border-dashed border-white/20 bg-slate-900/50 flex flex-col items-center justify-center gap-2 p-3 text-center">
                    <UserCheck className="h-5 w-5 text-slate-400" />
                    <span className="text-xs text-slate-300 font-medium">
                      Face Liveness Verification
                    </span>
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => void openLiveCamera()}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/30"
                      >
                        <Camera className="h-3 w-3" />
                        Live Camera
                      </button>
                      <button
                        type="button"
                        onClick={() => selfieInputRef.current?.click()}
                        className="inline-flex items-center gap-1 rounded-md bg-white/5 border border-white/15 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-white/10"
                      >
                        <Upload className="h-3 w-3" />
                        Upload
                      </button>
                    </div>
                  </div>
                )}
                {cameraError && (
                  <p className="mt-2 text-[11px] text-amber-300 leading-snug">{cameraError}</p>
                )}
              </div>
              <input
                ref={selfieInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="user"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void handleDocumentUploadAndAutoScan(file, setSelfiePhoto, 'Selfie');
                  }
                  e.target.value = '';
                }}
              />
              {selfiePhoto && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void openLiveCamera()}
                    className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 py-1.5 text-xs font-medium text-slate-200"
                  >
                    Retake Live
                  </button>
                  <button
                    type="button"
                    onClick={() => selfieInputRef.current?.click()}
                    className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 py-1.5 text-xs font-medium text-slate-200"
                  >
                    Upload New
                  </button>
                </div>
              )}
            </div>
          </div>

          {ocrError && (
            <div className="mt-4 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{ocrError} You can still complete or edit any field below manually.</span>
            </div>
          )}
        </div>

        {/* STEP 3: Auto-Filled Structured Details Preview Card */}
        <div className="rounded-2xl border border-white/10 bg-[#0d1424] p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-white/10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Step 3 of 3
              </p>
              <h3 className="text-base font-semibold text-white mt-0.5">
                Auto-Filled Document Details Preview
              </h3>
            </div>

            {/* Clear Status Distinction: Free Local QR/OCR Preview vs Compliance Review */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-medium ${
                  freeScanResult
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : ocrResult
                    ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
                    : 'border-slate-700 bg-slate-900 text-slate-300'
                }`}
              >
                <QrCode className="h-3.5 w-3.5" />
                {freeScanResult
                  ? `Free Local Auto-Fill (${freeScanResult.method.replace(/_/g, ' ')})`
                  : ocrResult
                  ? 'Free AI OCR Preview'
                  : 'Ready for Auto QR / OCR'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 font-medium text-amber-300">
                <Shield className="h-3.5 w-3.5" />
                Admin Verification Review
              </span>
            </div>
          </div>

          {/* Free QR / PDF417 / Local OCR Diagnostics */}
          {(freeScanResult || ocrResult) && (
            <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-950/15 p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs tabular-nums">
                <span className="text-slate-300">
                  Engine:{' '}
                  <strong className="text-white font-semibold">
                    {freeScanResult ? freeScanResult.providerLabel : ocrResult?.providerUsed}
                  </strong>
                </span>
                <span className="text-slate-300">
                  Match Confidence:{' '}
                  <strong
                    className={
                      (freeScanResult?.confidence ?? ocrResult?.confidence ?? 0) >= 75
                        ? 'text-emerald-400'
                        : 'text-amber-300'
                    }
                  >
                    {freeScanResult ? freeScanResult.confidence : ocrResult?.confidence}%
                  </strong>
                </span>
                {freeScanResult?.barcodeFormat && (
                  <span className="text-slate-300">
                    Decoded Barcode:{' '}
                    <strong className="text-emerald-300 font-mono">
                      {freeScanResult.barcodeFormat}
                    </strong>
                  </span>
                )}
                <span className="text-emerald-300 font-semibold">Cost: $0 (Free)</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {freeScanResult ? freeScanResult.notes : ocrResult?.extractionNotes}
              </p>
              <p className="text-[11px] text-slate-400">
                Preview Mode: Auto-extracted QR/barcode/OCR fields are pre-filled for convenience.
                Review every field for accuracy before submitting for Super Admin compliance
                approval.
              </p>
            </div>
          )}

          {/* Editable Structured Fields */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Full Legal Name *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={120}
                placeholder="Exact name printed on ID"
                className="w-full rounded-xl border border-white/15 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Date of Birth
              </label>
              <input
                type="text"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                maxLength={32}
                placeholder="YYYY-MM-DD"
                className="w-full rounded-xl border border-white/15 bg-slate-950 px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Verified Document Number *
              </label>
              <input
                type="text"
                required
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                maxLength={64}
                placeholder={activeDocRule.placeholder}
                className="w-full rounded-xl border border-white/15 bg-slate-950 px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Nationality
              </label>
              <input
                type="text"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                maxLength={80}
                placeholder={selectedCountry.nationality}
                className="w-full rounded-xl border border-white/15 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Issue Date
              </label>
              <input
                type="text"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                maxLength={32}
                placeholder="YYYY-MM-DD"
                className="w-full rounded-xl border border-white/15 bg-slate-950 px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Expiry Date
              </label>
              <input
                type="text"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                maxLength={32}
                placeholder="YYYY-MM-DD or Permanent"
                className="w-full rounded-xl border border-white/15 bg-slate-950 px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Residential Address (as shown on document or current residence)
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                maxLength={260}
                placeholder="Street, City, State/Division, Postal Code, Country"
                className="w-full rounded-xl border border-white/15 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-2 text-xs text-slate-400 max-w-xl">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                QR, PDF417 barcode, and local OCR parsing runs directly inside your browser with
                zero third-party data sharing.
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting || isCountryRestricted}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 px-6 py-3 text-sm font-semibold text-slate-950 transition-colors shrink-0"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileCheck className="h-4 w-4" />
              )}
              {submitting
                ? 'Submitting KYC Dossier...'
                : userProfile.kycStatus === 'approved'
                ? 'Update Verified KYC Details'
                : userProfile.kycStatus === 'pending'
                ? 'Update Pending Submission'
                : 'Submit KYC Verification'}
            </button>
          </div>
        </div>
      </form>

      {/* Live Document QR / PDF417 Camera Scanner Modal */}
      {qrCamOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#0d1424] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-emerald-400" />
                <h4 className="text-sm font-semibold text-white">
                  Live ID QR &amp; PDF417 Barcode Scanner (Free)
                </h4>
              </div>
              <button
                type="button"
                onClick={stopQrScanner}
                className="text-slate-400 hover:text-white"
                aria-label="Close QR scanner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3] border border-white/10">
                <video
                  ref={qrVideoRef}
                  playsInline
                  muted
                  autoPlay
                  className="h-full w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-44 w-72 rounded-xl border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(2,6,23,0.45)]" />
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-300 text-center">
                Hold the QR code or PDF417 barcode on the back of your NID, Passport, or Driving
                License inside the frame. Fields will auto-fill automatically!
              </p>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={stopQrScanner}
                  className="rounded-lg border border-white/15 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/5"
                >
                  Close Scanner
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Selfie Camera Capture Modal */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0d1424] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-emerald-400" />
                <h4 className="text-sm font-semibold text-white">Live Selfie Liveness Capture</h4>
              </div>
              <button
                type="button"
                onClick={stopCamera}
                className="text-slate-400 hover:text-white"
                aria-label="Close camera"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3] border border-white/10">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="h-full w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-44 w-36 rounded-full border-2 border-emerald-400/70" />
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-400 text-center">
                Center your face inside the oval in bright lighting, then capture.
              </p>
              <div className="mt-4 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="rounded-lg border border-white/15 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={captureCameraSelfie}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-xs font-semibold text-slate-950"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Capture Live Selfie
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
