import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Image as ImageIcon,
  Layers,
  Palette,
  RefreshCw,
  Share2,
  Sliders,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { DEFAULT_PLATFORM_CONFIG } from '../constants/defaults';
import { usePlatform } from '../context/PlatformContext';
import {
  MarketingCardAspectRatio,
  MarketingCardPhotoFrame,
  MarketingCardThemeId,
  PlatformConfig,
  UserProfile,
} from '../types/platform';
import {
  ASPECT_RATIO_SPECS,
  MARKETING_CARD_THEMES,
  renderMarketingCardCanvas,
} from '../utils/marketingCardRenderer';

interface MarketingCardStudioProps {
  userProfile: UserProfile;
  platformConfig: PlatformConfig;
  referralLink: string;
}

const ASPECT_RATIOS: MarketingCardAspectRatio[] = ['1:1', '9:16', '16:9'];
const THEME_IDS: MarketingCardThemeId[] = [
  'navy_gold',
  'emerald_green',
  'cyber_cyan',
  'royal_purple',
];
const FRAME_SHAPES: { id: MarketingCardPhotoFrame; label: string }[] = [
  { id: 'circle', label: 'Circle' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'square', label: 'Square' },
];

function loadHtmlImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export const MarketingCardStudio: React.FC<MarketingCardStudioProps> = ({
  userProfile,
  platformConfig,
  referralLink,
}) => {
  const { trackMarketingCardEvent } = usePlatform();

  const studioConfig = useMemo(
    () => platformConfig.marketingCardsConfig || DEFAULT_PLATFORM_CONFIG.marketingCardsConfig!,
    [platformConfig.marketingCardsConfig]
  );

  const enabledTemplates = useMemo(
    () =>
      (studioConfig.templates || []).filter((tpl) => {
        if (!tpl.enabled) return false;
        return true;
      }),
    [studioConfig.templates]
  );

  // Strict Mentor Isolation: only expose Mentor Partner designation when userProfile.isMentor === true
  const rankPresets = useMemo(() => {
    const base = [
      'AlphaTradex Investor',
      'Team Leader',
      'Crypto & Gold Trader',
      'Verified Member',
    ];
    if (userProfile.isMentor) {
      base.push('Mentor Partner');
    }
    return base;
  }, [userProfile.isMentor]);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    () => enabledTemplates[0]?.id || 'official_member'
  );
  const [aspectRatio, setAspectRatio] = useState<MarketingCardAspectRatio>('1:1');
  const [themeId, setThemeId] = useState<MarketingCardThemeId>(
    () => enabledTemplates[0]?.defaultTheme || 'navy_gold'
  );

  const [displayName, setDisplayName] = useState<string>(
    userProfile.fullName || userProfile.handle || 'AlphaTradex Member'
  );
  const [rankTitle, setRankTitle] = useState<string>(
    userProfile.isMentor ? 'Mentor Partner' : 'AlphaTradex Investor'
  );
  const [tagline, setTagline] = useState<string>(
    enabledTemplates[0]?.subheadline || studioConfig.defaultTagline
  );
  const [selectedPackageName, setSelectedPackageName] = useState<string>(
    () => platformConfig.packages[0]?.name || 'Starter'
  );

  // Photo & crop controls
  const initialAvatar = userProfile.avatarData || userProfile.portraitPhotoData || '';
  const [photoDataUrl, setPhotoDataUrl] = useState<string>(initialAvatar);
  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null);
  const [overlayImg, setOverlayImg] = useState<HTMLImageElement | null>(null);
  const [photoFrame, setPhotoFrame] = useState<MarketingCardPhotoFrame>('circle');
  const [photoZoom, setPhotoZoom] = useState<number>(1.0);
  const [photoOffsetX, setPhotoOffsetX] = useState<number>(0);
  const [photoOffsetY, setPhotoOffsetY] = useState<number>(0);

  // Optional element toggles (each also gated by Super Admin master settings)
  const [showQrCode, setShowQrCode] = useState<boolean>(true);
  const [showReferralCode, setShowReferralCode] = useState<boolean>(true);
  const [showRankBadge, setShowRankBadge] = useState<boolean>(true);
  const [showPackageBadge, setShowPackageBadge] = useState<boolean>(true);

  const [customCaption, setCustomCaption] = useState<string>('');
  const [captionDirty, setCaptionDirty] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [exporting, setExporting] = useState<'png' | 'jpg' | 'share' | null>(null);
  const [copiedCaption, setCopiedCaption] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const renderSeqRef = useRef<number>(0);

  const activeTemplate = useMemo(() => {
    const found = enabledTemplates.find((t) => t.id === selectedTemplateId);
    return found || enabledTemplates[0] || DEFAULT_PLATFORM_CONFIG.marketingCardsConfig!.templates[0];
  }, [enabledTemplates, selectedTemplateId]);

  const showToast = useCallback((type: 'ok' | 'err', text: string) => {
    setToast({ type, text });
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 3600);
  }, []);

  // Keep selected template valid if admin disables current template
  useEffect(() => {
    if (enabledTemplates.length > 0 && !enabledTemplates.some((t) => t.id === selectedTemplateId)) {
      const next = enabledTemplates[0];
      setSelectedTemplateId(next.id);
      setThemeId(next.defaultTheme || 'navy_gold');
      setTagline(next.subheadline || studioConfig.defaultTagline);
    }
  }, [enabledTemplates, selectedTemplateId, studioConfig.defaultTagline]);

  // Decode user photo into HTMLImageElement
  useEffect(() => {
    let active = true;
    loadHtmlImage(photoDataUrl).then((img) => {
      if (active) setPhotoImg(img);
    });
    return () => {
      active = false;
    };
  }, [photoDataUrl]);

  // Decode custom PNG overlay if active template is custom
  useEffect(() => {
    let active = true;
    const src = activeTemplate?.isCustom ? activeTemplate.overlayImageData || '' : '';
    loadHtmlImage(src).then((img) => {
      if (active) setOverlayImg(img);
    });
    return () => {
      active = false;
    };
  }, [activeTemplate]);

  // Default referral caption kept in sync unless user manually edits
  const generatedCaption = useMemo(() => {
    const company = platformConfig.companyName || 'AlphaTradex';
    const headline = (activeTemplate?.headline || studioConfig.defaultHeadline).replace(
      /AlphaTradex/gi,
      company
    );
    const refPart =
      studioConfig.allowReferralCode && showReferralCode
        ? `Referral Code: ${userProfile.handle}\n`
        : '';
    return `${headline}\n${tagline || studioConfig.defaultTagline}\n\n${refPart}Join with my official ${company} link:\n${referralLink}\n\n${studioConfig.disclaimerText}`;
  }, [
    activeTemplate,
    platformConfig.companyName,
    referralLink,
    showReferralCode,
    studioConfig.allowReferralCode,
    studioConfig.defaultHeadline,
    studioConfig.defaultTagline,
    studioConfig.disclaimerText,
    tagline,
    userProfile.handle,
  ]);

  useEffect(() => {
    if (!captionDirty) {
      setCustomCaption(generatedCaption);
    }
  }, [generatedCaption, captionDirty]);

  // Effective visibility flags combining user toggle + Super Admin master permission
  const effectiveShowQr = Boolean(studioConfig.allowQrCode && showQrCode);
  const effectiveShowRefCode = Boolean(studioConfig.allowReferralCode && showReferralCode);
  const effectiveShowRank = Boolean(studioConfig.allowRankBadge && showRankBadge);
  const effectiveShowPkg = Boolean(studioConfig.allowPackageBadge && showPackageBadge);

  // Live HTML5 Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeTemplate) return;
    const seq = ++renderSeqRef.current;

    // Sanitize rank for non-mentor users
    const safeRank =
      !userProfile.isMentor && /mentor/i.test(rankTitle)
        ? 'AlphaTradex Investor'
        : rankTitle;

    void renderMarketingCardCanvas({
      canvas,
      aspectRatio,
      themeId,
      template: activeTemplate,
      companyName: platformConfig.companyName || 'AlphaTradex',
      coinName: platformConfig.pumpFunToken?.name || 'ALPHATRADEX',
      displayName: displayName.trim() || userProfile.fullName || 'AlphaTradex Member',
      rankTitle: safeRank.trim(),
      tagline: tagline.trim() || activeTemplate.subheadline || studioConfig.defaultTagline,
      referralCode: userProfile.handle || 'ALPHA',
      referralLink,
      disclaimerText:
        studioConfig.disclaimerText ||
        'Trading & digital assets involve risk. Join via official referral.',
      selectedPackageName,
      packages: platformConfig.packages || [],
      photoImage: photoImg,
      overlayImage: overlayImg,
      photoFrame,
      photoZoom,
      photoOffsetX,
      photoOffsetY,
      showQrCode: effectiveShowQr,
      showReferralCode: effectiveShowRefCode,
      showRankBadge: effectiveShowRank,
      showPackageBadge: effectiveShowPkg,
    }).catch(() => {
      if (seq === renderSeqRef.current) {
        // Ignore transient image decode error
      }
    });
  }, [
    activeTemplate,
    aspectRatio,
    displayName,
    effectiveShowPkg,
    effectiveShowQr,
    effectiveShowRank,
    effectiveShowRefCode,
    overlayImg,
    photoFrame,
    photoImg,
    photoOffsetX,
    photoOffsetY,
    photoZoom,
    platformConfig.companyName,
    platformConfig.packages,
    platformConfig.pumpFunToken?.name,
    rankTitle,
    referralLink,
    selectedPackageName,
    studioConfig.defaultTagline,
    studioConfig.disclaimerText,
    tagline,
    themeId,
    userProfile.fullName,
    userProfile.handle,
    userProfile.isMentor,
  ]);

  const handleSelectTemplate = (tplId: string) => {
    const tpl = enabledTemplates.find((t) => t.id === tplId);
    if (!tpl) return;
    setSelectedTemplateId(tpl.id);
    setThemeId(tpl.defaultTheme || 'navy_gold');
    setTagline(tpl.subheadline || studioConfig.defaultTagline);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('err', 'Please upload a JPG, PNG, or WebP photo.');
      e.target.value = '';
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      showToast('err', 'Photo must be 12 MB or smaller.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoDataUrl(reader.result);
        setPhotoZoom(1.0);
        setPhotoOffsetX(0);
        setPhotoOffsetY(0);
        showToast('ok', 'Photo loaded. Adjust zoom and position to fit the frame.');
      }
    };
    reader.onerror = () => showToast('err', 'Could not read image file.');
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const resetCrop = () => {
    setPhotoZoom(1.0);
    setPhotoOffsetX(0);
    setPhotoOffsetY(0);
  };

  const exportCanvasBlob = (mimeType: 'image/png' | 'image/jpeg'): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        resolve(null);
        return;
      }
      canvas.toBlob((blob) => resolve(blob), mimeType, mimeType === 'image/jpeg' ? 0.94 : 1.0);
    });
  };

  const handleDownload = async (format: 'png' | 'jpg') => {
    setExporting(format);
    try {
      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
      const blob = await exportCanvasBlob(mimeType);
      if (!blob) {
        showToast('err', 'Canvas preview is not ready yet. Please try again.');
        return;
      }
      const slug = (activeTemplate?.id || 'card').replace(/[^a-z0-9_-]/gi, '-');
      const ratioTag = aspectRatio.replace(':', 'x');
      const filename = `alphatradex-${slug}-${ratioTag}-${userProfile.handle || 'member'}.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      void trackMarketingCardEvent('generated');
      showToast('ok', `High-resolution ${format.toUpperCase()} card downloaded.`);
    } finally {
      setExporting(null);
    }
  };

  const handleCopyCaption = async () => {
    const text = customCaption.trim() || generatedCaption;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCaption(true);
      showToast('ok', 'Referral caption & link copied to clipboard.');
      window.setTimeout(() => setCopiedCaption(false), 2400);
    } catch {
      showToast('err', 'Clipboard access blocked. Please select and copy manually.');
    }
  };

  const handleNativeShare = async () => {
    setExporting('share');
    try {
      const blob = await exportCanvasBlob('image/png');
      const shareText = customCaption.trim() || generatedCaption;
      const company = platformConfig.companyName || 'AlphaTradex';

      if (blob && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        const file = new File([blob], `alphatradex-promo-card.png`, { type: 'image/png' });
        const canShareFile =
          typeof navigator.canShare === 'function' ? navigator.canShare({ files: [file] }) : false;

        if (canShareFile) {
          await navigator.share({
            files: [file],
            title: `${company} — ${activeTemplate?.name || 'Promo Card'}`,
            text: shareText,
          });
          void trackMarketingCardEvent('shared');
          showToast('ok', 'Promo card shared successfully.');
          return;
        }
      }

      // Graceful fallback on desktop browsers without File Web Share API:
      // Copy referral caption and download crisp PNG so user can attach immediately
      try {
        await navigator.clipboard.writeText(shareText);
      } catch {
        // Ignore clipboard denial
      }
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alphatradex-promo-${aspectRatio.replace(':', 'x')}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
      void trackMarketingCardEvent('shared');
      showToast('ok', 'PNG saved & referral caption copied — ready to upload to your social app.');
    } catch (err) {
      // User canceling native share sheet is not an error
      if ((err as { name?: string })?.name !== 'AbortError') {
        showToast('err', 'Could not open native share sheet. Try Download PNG instead.');
      }
    } finally {
      setExporting(null);
    }
  };

  const handleSocialClick = (platformName: string) => {
    void trackMarketingCardEvent('shared');
    showToast('ok', `Opened ${platformName} share with your referral link.`);
  };

  const encodedCaption = encodeURIComponent(customCaption.trim() || generatedCaption);
  const encodedUrl = encodeURIComponent(referralLink);
  const whatsappHref = `https://wa.me/?text=${encodedCaption}`;
  const telegramHref = `https://t.me/share/url?url=${encodedUrl}&text=${encodedCaption}`;
  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedCaption}`;
  const twitterHref = `https://twitter.com/intent/tweet?text=${encodedCaption}`;

  if (!studioConfig.enabled) {
    return (
      <section className="bg-[#0B111E]/85 border border-slate-700/70 rounded-2xl p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center mx-auto">
          <ImageIcon className="w-6 h-6" />
        </div>
        <h2 className="font-display font-bold text-white text-lg">
          Promo Card Studio Temporarily Unavailable
        </h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Marketing card generation is currently paused by platform administration. Your referral
          link remains active on the Referral Dashboard.
        </p>
      </section>
    );
  }

  const activeSpec = ASPECT_RATIO_SPECS[aspectRatio];

  return (
    <section className="space-y-6">
      {/* Studio Header */}
      <div className="bg-[#0B111E]/85 border border-slate-700/70 rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-400 flex items-center justify-center shrink-0">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-white text-xl leading-tight">
              Promo Studio — Marketing Photo Card Generator
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Create crisp, export-ready branded social cards with your photo, personal referral
              code, and scannable QR code.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-slate-300 font-mono">
            REF ID: <span className="text-amber-400 font-bold">{userProfile.handle}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-slate-300 font-mono tabular-nums">
            {activeSpec.width} × {activeSpec.height}px
          </div>
        </div>
      </div>

      {/* Inline Toast Feedback */}
      {toast && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 ${
            toast.type === 'ok'
              ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/35 text-rose-300'
          }`}
        >
          <span>{toast.text}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Two-Column Editor + Sticky Live Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Controls (7 cols) */}
        <div className="xl:col-span-6 space-y-5">
          {/* 1. Template Selector */}
          <div className="bg-[#0B111E]/85 border border-slate-700/70 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <h3 className="font-display font-bold text-white text-sm">
                  1. Select Card Template
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                {enabledTemplates.length} templates
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {enabledTemplates.map((tpl) => {
                const isSelected = tpl.id === activeTemplate?.id;
                const swatch = MARKETING_CARD_THEMES[tpl.defaultTheme]?.accent || '#F59E0B';
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tpl.id)}
                    className={`text-left p-3 rounded-xl border transition ${
                      isSelected
                        ? 'bg-amber-500/12 border-amber-400/70 text-white'
                        : 'bg-slate-900/75 border-slate-700/70 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs truncate">{tpl.name}</span>
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: swatch }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                      {tpl.headline}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Platform Format / Aspect Ratio */}
          <div className="bg-[#0B111E]/85 border border-slate-700/70 rounded-2xl p-5 space-y-3.5">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              <h3 className="font-display font-bold text-white text-sm">
                2. Social Format & Aspect Ratio
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {ASPECT_RATIOS.map((ratio) => {
                const spec = ASPECT_RATIO_SPECS[ratio];
                const selected = aspectRatio === ratio;
                return (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setAspectRatio(ratio)}
                    className={`p-3 rounded-xl border text-left transition ${
                      selected
                        ? 'bg-amber-500/12 border-amber-400/70 text-white'
                        : 'bg-slate-900/75 border-slate-700/70 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs">{spec.label}</span>
                    </div>
                    <div className="font-mono text-[11px] text-amber-400 mt-1 tabular-nums">
                      {spec.width} × {spec.height}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                      {spec.platforms}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Photo Upload & Crop Controls */}
          <div className="bg-[#0B111E]/85 border border-slate-700/70 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-amber-400" />
                <h3 className="font-display font-bold text-white text-sm">
                  3. Your Photo & Frame Crop
                </h3>
              </div>
              <button
                type="button"
                onClick={resetCrop}
                className="text-[11px] text-slate-400 hover:text-white inline-flex items-center gap-1 transition"
              >
                <RefreshCw className="w-3 h-3" />
                Reset Crop
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoUpload}
              className="hidden"
            />

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 transition"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Photo (JPG/PNG/WebP)
              </button>

              {initialAvatar && photoDataUrl !== initialAvatar && (
                <button
                  type="button"
                  onClick={() => {
                    setPhotoDataUrl(initialAvatar);
                    resetCrop();
                  }}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs transition"
                >
                  Use Profile Avatar
                </button>
              )}

              {photoDataUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setPhotoDataUrl('');
                    resetCrop();
                  }}
                  className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/40 text-slate-300 hover:text-rose-300 text-xs font-semibold inline-flex items-center gap-1 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              )}
            </div>

            {/* Frame shape selector */}
            <div className="space-y-1.5">
              <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Photo Frame Shape
              </label>
              <div className="grid grid-cols-3 gap-2">
                {FRAME_SHAPES.map((shape) => (
                  <button
                    key={shape.id}
                    type="button"
                    onClick={() => setPhotoFrame(shape.id)}
                    className={`py-2 rounded-lg border text-xs font-semibold transition ${
                      photoFrame === shape.id
                        ? 'bg-amber-500/15 border-amber-400/70 text-amber-300'
                        : 'bg-slate-900/75 border-slate-700/70 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {shape.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Zoom & Pan Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Zoom</span>
                  <span className="font-mono text-slate-200 tabular-nums">
                    {photoZoom.toFixed(2)}×
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={photoZoom}
                  onChange={(e) => setPhotoZoom(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Horizontal Pan</span>
                  <span className="font-mono text-slate-200 tabular-nums">{photoOffsetX}%</span>
                </div>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={2}
                  value={photoOffsetX}
                  onChange={(e) => setPhotoOffsetX(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Vertical Pan</span>
                  <span className="font-mono text-slate-200 tabular-nums">{photoOffsetY}%</span>
                </div>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={2}
                  value={photoOffsetY}
                  onChange={(e) => setPhotoOffsetY(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>
            </div>
          </div>

          {/* 4. Personal Details & Branding */}
          <div className="bg-[#0B111E]/85 border border-slate-700/70 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-amber-400" />
              <h3 className="font-display font-bold text-white text-sm">
                4. Identity, Theme & Card Elements
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  Display Name
                </label>
                <input
                  type="text"
                  maxLength={36}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  Rank / Designation
                </label>
                <input
                  type="text"
                  maxLength={38}
                  value={rankTitle}
                  onChange={(e) => setRankTitle(e.target.value)}
                  placeholder="AlphaTradex Investor"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Quick Designation Presets */}
            <div className="flex flex-wrap gap-1.5">
              {rankPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setRankTitle(preset)}
                  className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition ${
                    rankTitle === preset
                      ? 'bg-amber-500/15 border-amber-400/70 text-amber-300'
                      : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  Custom Tagline
                </label>
                <input
                  type="text"
                  maxLength={96}
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Enter a short promotional tagline"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  Highlighted Package Tier
                </label>
                <select
                  value={selectedPackageName}
                  onChange={(e) => setSelectedPackageName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-400"
                >
                  {(platformConfig.packages || []).map((pkg) => (
                    <option key={pkg.id} value={pkg.name}>
                      {pkg.name} (${pkg.capital.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Color Themes */}
            <div className="space-y-1.5">
              <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Color Theme
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {THEME_IDS.map((id) => {
                  const palette = MARKETING_CARD_THEMES[id];
                  const active = themeId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setThemeId(id)}
                      className={`px-2.5 py-2 rounded-lg border text-xs font-semibold flex items-center gap-2 transition ${
                        active
                          ? 'bg-slate-800 border-amber-400 text-white'
                          : 'bg-slate-900/75 border-slate-700/70 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0 border border-white/25"
                        style={{ backgroundColor: palette.accent }}
                      />
                      <span className="truncate">{palette.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Element Toggles */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {studioConfig.allowQrCode && (
                <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900/75 border border-slate-700/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showQrCode}
                    onChange={(e) => setShowQrCode(e.target.checked)}
                    className="rounded accent-amber-400"
                  />
                  <span className="text-xs text-slate-200 font-medium">Scannable QR Code</span>
                </label>
              )}

              {studioConfig.allowReferralCode && (
                <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900/75 border border-slate-700/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showReferralCode}
                    onChange={(e) => setShowReferralCode(e.target.checked)}
                    className="rounded accent-amber-400"
                  />
                  <span className="text-xs text-slate-200 font-medium">Personal Referral Code</span>
                </label>
              )}

              {studioConfig.allowRankBadge && (
                <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900/75 border border-slate-700/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showRankBadge}
                    onChange={(e) => setShowRankBadge(e.target.checked)}
                    className="rounded accent-amber-400"
                  />
                  <span className="text-xs text-slate-200 font-medium">Rank / Designation</span>
                </label>
              )}

              {studioConfig.allowPackageBadge && (
                <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900/75 border border-slate-700/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPackageBadge}
                    onChange={(e) => setShowPackageBadge(e.target.checked)}
                    className="rounded accent-amber-400"
                  />
                  <span className="text-xs text-slate-200 font-medium">Package Tier Label</span>
                </label>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Canvas Preview + Download + Social Share (6 cols) */}
        <div className="xl:col-span-6 xl:sticky xl:top-20 space-y-5">
          {/* Live Preview Stage */}
          <div className="bg-[#0B111E]/90 border border-slate-700/70 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-display font-bold text-white text-sm">
                  Live High-Resolution Preview
                </h3>
                <p className="text-[11px] text-slate-400">
                  {activeTemplate?.name} · {activeSpec.label} ({activeSpec.width}×{activeSpec.height})
                </p>
              </div>
              <span className="text-[11px] font-mono text-emerald-400">READY TO EXPORT</span>
            </div>

            <div className="rounded-xl bg-[#050811] border border-slate-800 p-3 sm:p-4 flex items-center justify-center overflow-hidden">
              <canvas
                ref={canvasRef}
                className={`rounded-lg shadow-2xl border border-slate-700/50 ${
                  aspectRatio === '9:16'
                    ? 'max-h-[540px] w-auto max-w-full'
                    : 'w-full h-auto max-w-[540px]'
                }`}
              />
            </div>

            {/* Download Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={exporting !== null}
                onClick={() => void handleDownload('png')}
                className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-2 transition"
              >
                <Download className="w-4 h-4" />
                {exporting === 'png' ? 'Rendering PNG...' : 'Download PNG (HD)'}
              </button>

              <button
                type="button"
                disabled={exporting !== null}
                onClick={() => void handleDownload('jpg')}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-60 border border-slate-600 text-white font-bold text-xs inline-flex items-center justify-center gap-2 transition"
              >
                <Download className="w-4 h-4 text-amber-400" />
                {exporting === 'jpg' ? 'Rendering JPG...' : 'Download JPG (HD)'}
              </button>
            </div>
          </div>

          {/* Direct Social Share & Customizable Referral Caption */}
          <div className="bg-[#0B111E]/90 border border-slate-700/70 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-amber-400" />
                <h3 className="font-display font-bold text-white text-sm">
                  One-Click Social Share & Referral Caption
                </h3>
              </div>
              {captionDirty && (
                <button
                  type="button"
                  onClick={() => {
                    setCaptionDirty(false);
                    setCustomCaption(generatedCaption);
                  }}
                  className="text-[11px] text-amber-400 hover:text-amber-300"
                >
                  Reset Caption
                </button>
              )}
            </div>

            <textarea
              rows={4}
              value={customCaption}
              onChange={(e) => {
                setCaptionDirty(true);
                setCustomCaption(e.target.value);
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 font-mono leading-relaxed focus:outline-none focus:border-amber-400"
            />

            {/* Primary Native Web Share + Copy Caption */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={exporting !== null}
                onClick={() => void handleNativeShare()}
                className="py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-2 transition"
              >
                <Share2 className="w-4 h-4" />
                {exporting === 'share' ? 'Preparing Share...' : 'Share Image (Mobile / Device)'}
              </button>

              <button
                type="button"
                onClick={() => void handleCopyCaption()}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 font-semibold text-xs inline-flex items-center justify-center gap-2 transition"
              >
                {copiedCaption ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-300" />
                )}
                {copiedCaption ? 'Caption & Link Copied' : 'Copy Referral Caption & Link'}
              </button>
            </div>

            {/* Direct Social Platform Share Links */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleSocialClick('WhatsApp')}
                className="py-2 px-3 rounded-lg bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/40 text-[#4ADE80] font-semibold text-xs text-center transition"
              >
                WhatsApp
              </a>
              <a
                href={telegramHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleSocialClick('Telegram')}
                className="py-2 px-3 rounded-lg bg-[#229ED9]/15 hover:bg-[#229ED9]/25 border border-[#229ED9]/40 text-[#38BDF8] font-semibold text-xs text-center transition"
              >
                Telegram
              </a>
              <a
                href={facebookHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleSocialClick('Facebook')}
                className="py-2 px-3 rounded-lg bg-[#1877F2]/15 hover:bg-[#1877F2]/25 border border-[#1877F2]/40 text-[#60A5FA] font-semibold text-xs text-center transition"
              >
                Facebook
              </a>
              <a
                href={twitterHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleSocialClick('X (Twitter)')}
                className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 font-semibold text-xs text-center transition"
              >
                X (Twitter)
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
