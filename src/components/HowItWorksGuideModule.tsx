import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Film,
  Globe,
  Play,
  Sliders,
} from 'lucide-react';
import { DEFAULT_PLATFORM_CONFIG } from '../constants/defaults';
import {
  GuideLanguage,
  MotionVisualPreset,
  NavSection,
  PlatformConfig,
} from '../types/platform';
import { MotionVideoPlayer } from './MotionVideoPlayer';

interface HowItWorksGuideModuleProps {
  platformConfig: PlatformConfig;
  mode: 'homepage' | 'page' | 'dashboard';
  isSignedIn?: boolean;
  onSelectSection?: (s: NavSection) => void;
  onOpenAuth?: (mode: 'signin' | 'signup') => void;
  onOpenDashboard?: (targetNav?: 'dashboard' | 'forex-market' | 'pump-fun') => void;
  onDashboardNavigate?: (target: 'deposit' | 'activate-trading' | 'referral-network' | 'dashboard') => void;
}

const LANGUAGE_OPTIONS: { id: GuideLanguage; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिन्दी' },
  { id: 'es', label: 'Español' },
];

const GUIDED_MOTION_PRESETS: { id: MotionVisualPreset | 'auto'; label: string }[] = [
  { id: 'auto', label: 'Auto Match Step' },
  { id: 'overview', label: 'Platform Flow' },
  { id: 'signup', label: 'Sign Up & KYC' },
  { id: 'package', label: 'Packages & 200-Day Rules' },
  { id: 'dashboard', label: 'Dashboard & Ledger' },
];

export const HowItWorksGuideModule: React.FC<HowItWorksGuideModuleProps> = ({
  platformConfig,
  mode,
  isSignedIn = false,
  onSelectSection,
  onOpenAuth,
  onOpenDashboard,
  onDashboardNavigate,
}) => {
  const guideConfig = useMemo(
    () => platformConfig.howItWorksConfig || DEFAULT_PLATFORM_CONFIG.howItWorksConfig!,
    [platformConfig.howItWorksConfig]
  );

  const visibleSteps = useMemo(
    () => (guideConfig.steps || []).filter((s) => s.enabled !== false),
    [guideConfig.steps]
  );

  const visibleVideos = useMemo(
    () => (guideConfig.videos || []).filter((v) => v.enabled !== false),
    [guideConfig.videos]
  );

  const safeDefaultLang: GuideLanguage =
    guideConfig.defaultLanguage === 'hi' || guideConfig.defaultLanguage === 'es'
      ? guideConfig.defaultLanguage
      : 'en';
  const [language, setLanguage] = useState<GuideLanguage>(safeDefaultLang);
  const [selectedStepIdx, setSelectedStepIdx] = useState<number>(0);
  const [selectedVideoId, setSelectedVideoId] = useState<string>(
    () => visibleVideos[0]?.id || 'video_how_it_works'
  );
  const [presetMode, setPresetMode] = useState<MotionVisualPreset | 'auto'>('auto');

  if (!guideConfig.enabled) {
    if (mode === 'homepage') return null;
    return (
      <section className="bg-[#0B111E]/85 border border-slate-700/70 rounded-2xl p-8 text-center space-y-2">
        <h2 className="font-display font-bold text-white text-lg">
          How It Works &amp; Video Guide Paused
        </h2>
        <p className="text-sm text-slate-400">
          This guide is temporarily unavailable while administration updates tutorial assets.
        </p>
      </section>
    );
  }

  if (mode === 'homepage' && !guideConfig.showOnHomepage) {
    return null;
  }

  const activeVideo =
    visibleVideos.find((v) => v.id === selectedVideoId) || visibleVideos[0] || null;

  const handleStepAction = (target: 'auth' | 'plans' | 'dashboard') => {
    if (mode === 'dashboard' && onDashboardNavigate) {
      if (target === 'auth') onDashboardNavigate('dashboard');
      else if (target === 'plans') onDashboardNavigate('activate-trading');
      else onDashboardNavigate('referral-network');
      return;
    }

    if (target === 'auth') {
      if (isSignedIn && onOpenDashboard) onOpenDashboard('dashboard');
      else if (onOpenAuth) onOpenAuth('signup');
    } else if (target === 'plans') {
      if (onSelectSection) onSelectSection('plans');
    } else {
      if (isSignedIn && onOpenDashboard) onOpenDashboard('dashboard');
      else if (onOpenAuth) onOpenAuth('signin');
    }
  };

  return (
    <section
      id="how-it-works"
      className="space-y-6"
    >
      {/* Header Row with Multi-Language Selector */}
      <div className="bg-[#0B111E]/85 border border-slate-700/70 rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
            <Film className="w-4 h-4" />
            <span>STEP-BY-STEP ONBOARDING · MOTION VIDEO GUIDE</span>
          </div>
          <h2 className="font-display font-extrabold text-white text-2xl sm:text-3xl tracking-tight text-balance">
            How {platformConfig.companyName || 'AlphaTradex'} Works
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Follow three clear steps from verified registration to structured Mon–Fri packages and
            real-time dashboard transparency — complete with interactive motion walkthroughs.
          </p>
        </div>

        {/* Multi-Language Guide Switcher */}
        <div className="flex flex-col items-start lg:items-end gap-2 shrink-0">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            <span>Guide Language</span>
          </div>
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-700/80">
            {LANGUAGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLanguage(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  language === opt.id
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 1. Interactive 3-Step Visual Onboarding Flow */}
      {visibleSteps.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          {visibleSteps.map((step, idx) => {
            const isSelected = idx === selectedStepIdx;
            const titleText = step.title[language] || step.title.en;
            const descText = step.description[language] || step.description.en;
            const matchingVideo = visibleVideos[idx] || visibleVideos[0];

            return (
              <div
                key={step.id}
                onClick={() => {
                  setSelectedStepIdx(idx);
                  if (matchingVideo) {
                    setSelectedVideoId(matchingVideo.id);
                    setPresetMode('auto');
                  }
                }}
                className={`rounded-2xl p-5 border flex flex-col justify-between gap-4 cursor-pointer transition ${
                  isSelected
                    ? 'bg-[#101A30]/95 border-amber-400/70'
                    : 'bg-[#0B111E]/82 border-slate-700/70 hover:border-slate-500'
                }`}
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-xs text-amber-400 tabular-nums">
                      0{step.stepNumber}. STEP {step.stepNumber}
                    </span>
                    {matchingVideo && (
                      <span className="text-[11px] font-mono text-slate-400">
                        Motion Guide Ready
                      </span>
                    )}
                  </div>

                  <h3 className="font-display font-bold text-white text-lg leading-snug">
                    {titleText}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{descText}</p>

                  {step.highlights && step.highlights.length > 0 && (
                    <ul className="space-y-1.5 pt-1 border-t border-slate-800/90">
                      {step.highlights.map((hl, hIdx) => (
                        <li
                          key={hIdx}
                          className="flex items-start gap-2 text-xs text-slate-300 leading-snug"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{hl}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStepAction(step.ctaTarget);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition whitespace-nowrap"
                  >
                    <span>
                      {mode === 'dashboard' && step.ctaTarget === 'auth'
                        ? 'Open Vault'
                        : step.ctaLabel}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  {matchingVideo && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStepIdx(idx);
                        setSelectedVideoId(matchingVideo.id);
                        setPresetMode('auto');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-semibold text-slate-200 inline-flex items-center gap-1 transition whitespace-nowrap"
                    >
                      <Play className="w-3 h-3 text-amber-400" />
                      Watch Reel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. Interactive Motion Video Showcase & Guided Motion Presets */}
      {visibleVideos.length > 0 && activeVideo && (
        <div className="bg-[#0B111E]/85 border border-slate-700/70 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-bold text-white text-lg">
                Interactive Motion Video Showcase
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Select a tutorial reel below or switch guided visual presets with synced subtitles.
              </p>
            </div>

            {/* Guided Motion Preset Selector (optional visual mode switcher for users) */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 mr-1">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                Motion Preset:
              </span>
              {GUIDED_MOTION_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setPresetMode(preset.id)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold whitespace-nowrap transition ${
                    presetMode === preset.id
                      ? 'bg-amber-500/15 border-amber-400/70 text-amber-300'
                      : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* Featured Motion Player (8 cols) */}
            <div className="xl:col-span-8 space-y-3">
              <MotionVideoPlayer
                video={activeVideo}
                language={language}
                companyName={platformConfig.companyName || 'AlphaTradex'}
                disclaimerText={guideConfig.disclaimerText}
                packages={platformConfig.packages || []}
                presetOverride={presetMode === 'auto' ? null : presetMode}
                allowExportWebm={mode !== 'homepage'}
              />

              {/* Active Video Caption & Script Summary */}
              <div className="p-4 rounded-xl bg-slate-900/75 border border-slate-800 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-display font-bold text-white text-sm">
                    {activeVideo.title[language] || activeVideo.title.en}
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400">
                    {activeVideo.customVideoUrl
                      ? 'Custom Attached Video'
                      : '60fps Interactive Motion Reel'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {activeVideo.caption[language] || activeVideo.caption.en}
                </p>
              </div>
            </div>

            {/* Playlist / Video Card Selector (4 cols) */}
            <div className="xl:col-span-4 space-y-3">
              <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                Tutorial Reels ({visibleVideos.length})
              </div>

              {visibleVideos.map((vid, idx) => {
                const isActive = vid.id === activeVideo.id;
                return (
                  <button
                    key={vid.id}
                    type="button"
                    onClick={() => {
                      setSelectedVideoId(vid.id);
                      setSelectedStepIdx(Math.min(idx, Math.max(0, visibleSteps.length - 1)));
                      setPresetMode('auto');
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition space-y-2 ${
                      isActive
                        ? 'bg-amber-500/12 border-amber-400/70 text-white'
                        : 'bg-slate-900/80 border-slate-700/70 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-amber-400 font-bold">
                        REEL 0{idx + 1} · {vid.scenes?.length || 4} SCENES
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <Play className="w-3 h-3 text-amber-400" />
                        {isActive ? 'Playing' : 'Play'}
                      </span>
                    </div>
                    <div className="font-display font-bold text-sm text-white">
                      {vid.title[language] || vid.title.en}
                    </div>
                    <p className="text-xs text-slate-400 leading-snug line-clamp-2">
                      {vid.subtitle[language] || vid.subtitle.en}
                    </p>
                  </button>
                );
              })}

              {mode === 'homepage' && onSelectSection && (
                <button
                  type="button"
                  onClick={() => onSelectSection('how-it-works')}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-white inline-flex items-center justify-center gap-1.5 transition"
                >
                  <span>Open Full Interactive Guide</span>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
