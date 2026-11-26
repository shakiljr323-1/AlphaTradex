import React, { useMemo, useRef, useState } from 'react';
import {
  Film,
  Layers,
  Link2,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import { DEFAULT_PLATFORM_CONFIG } from '../constants/defaults';
import {
  GuideLanguage,
  HowItWorksConfig,
  HowItWorksStepConfig,
  MotionSceneBeat,
  MotionVideoCardConfig,
  MotionVisualPreset,
  PlatformConfig,
} from '../types/platform';
import { MotionVideoPlayer } from './MotionVideoPlayer';

interface AdminHowItWorksPanelProps {
  draftConfig: PlatformConfig;
  setDraftConfig: React.Dispatch<React.SetStateAction<PlatformConfig>>;
  onSaveConfig: (nextConfig?: PlatformConfig) => Promise<void>;
  busy: boolean;
  onNotify: (type: 'ok' | 'err', text: string) => void;
}

const LANGS: { id: GuideLanguage; label: string }[] = [
  { id: 'en', label: 'English (EN)' },
  { id: 'hi', label: 'हिन्दी (HI)' },
  { id: 'es', label: 'Español (ES)' },
];

const VISUAL_PRESETS: { id: MotionVisualPreset; label: string }[] = [
  { id: 'overview', label: 'Platform 3-Step Flow' },
  { id: 'signup', label: 'Sign Up & KYC' },
  { id: 'package', label: 'Packages & 200-Day Rules' },
  { id: 'dashboard', label: 'Dashboard & Ledger' },
];

export const AdminHowItWorksPanel: React.FC<AdminHowItWorksPanelProps> = ({
  draftConfig,
  setDraftConfig,
  onSaveConfig,
  busy,
  onNotify,
}) => {
  const hiw: HowItWorksConfig =
    draftConfig.howItWorksConfig || DEFAULT_PLATFORM_CONFIG.howItWorksConfig!;

  const [editLang, setEditLang] = useState<GuideLanguage>('en');
  const [studioVideoId, setStudioVideoId] = useState<string>(
    () => hiw.videos[0]?.id || 'video_how_it_works'
  );
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [generatingAi, setGeneratingAi] = useState<boolean>(false);
  const [localVideoPreviews, setLocalVideoPreviews] = useState<Record<string, string>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const activeStudioVideo = useMemo(
    () => hiw.videos.find((v) => v.id === studioVideoId) || hiw.videos[0],
    [hiw.videos, studioVideoId]
  );

  const patchHiw = (patch: Partial<HowItWorksConfig>) => {
    setDraftConfig((prev) => {
      const current = prev.howItWorksConfig || DEFAULT_PLATFORM_CONFIG.howItWorksConfig!;
      return {
        ...prev,
        howItWorksConfig: {
          ...current,
          ...patch,
        },
      };
    });
  };

  const patchStep = (stepId: string, patch: Partial<HowItWorksStepConfig>) => {
    patchHiw({
      steps: hiw.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
    });
  };

  const patchVideo = (vidId: string, patch: Partial<MotionVideoCardConfig>) => {
    patchHiw({
      videos: hiw.videos.map((v) => (v.id === vidId ? { ...v, ...patch } : v)),
    });
  };

  const handleLocalVideoUpload = (vidId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      onNotify('err', 'Please choose a valid MP4 or WebM video file.');
      e.target.value = '';
      return;
    }
    const prevUrl = localVideoPreviews[vidId];
    if (prevUrl) URL.revokeObjectURL(prevUrl);
    const blobUrl = URL.createObjectURL(file);
    setLocalVideoPreviews((prev) => ({ ...prev, [vidId]: blobUrl }));
    onNotify(
      'ok',
      `Loaded "${file.name}" for immediate preview. For permanent multi-device streaming, paste a hosted HTTPS MP4/YouTube/Vimeo URL in the Custom Video URL field and click Publish.`
    );
    e.target.value = '';
  };

  const handleGenerateAiMotion = async () => {
    if (!activeStudioVideo) return;
    setGeneratingAi(true);
    try {
      const res = await fetch('/api/ai-motion-guide/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt:
            aiPrompt.trim() ||
            `Create a clear, compliant 4-scene tutorial motion reel for "${activeStudioVideo.title.en}" with factual step highlights and demo visuals.`,
          videoTitle: activeStudioVideo.title.en,
          existingScript: activeStudioVideo.script,
          visualPreset: activeStudioVideo.visualPreset,
          companyName: draftConfig.companyName || 'AlphaTradex',
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        script?: string;
        caption?: { en: string; hi: string; es: string };
        scenes?: MotionSceneBeat[];
        aiUpdatedAtIso?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || `AI Motion Studio returned HTTP ${res.status}`);
      }
      if (!Array.isArray(data.scenes) || data.scenes.length === 0) {
        throw new Error('AI Motion Studio did not return any storyboard scenes.');
      }

      patchVideo(activeStudioVideo.id, {
        script: data.script || activeStudioVideo.script,
        caption: data.caption || activeStudioVideo.caption,
        scenes: data.scenes,
        isDemoVisual: true,
        aiUpdatedAtIso: data.aiUpdatedAtIso || new Date().toISOString(),
      });
      onNotify(
        'ok',
        `AI Motion Video Studio refreshed "${activeStudioVideo.title.en}" with ${data.scenes.length} animated scenes & 3-language captions. Preview live below and click Publish Settings.`
      );
    } catch (err) {
      onNotify(
        'err',
        err instanceof Error ? err.message : 'Failed to generate AI motion storyboard.'
      );
    } finally {
      setGeneratingAi(false);
    }
  };

  return (
    <section className="space-y-6">
      {/* Top Bar: Global Controls & Publish */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Film className="w-5 h-5 text-orange-500" />
            <div>
              <h2 className="font-display font-bold text-slate-900 text-base">
                How It Works &amp; Motion Video Guide Controls
              </h2>
              <p className="text-xs text-slate-500">
                Manage onboarding steps, multi-language copy, custom video links, and AI Motion
                Video Studio storyboards.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => void onSaveConfig(draftConfig)}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold inline-flex items-center gap-1.5 transition"
          >
            <Save className="w-4 h-4 text-amber-400" />
            {busy ? 'Publishing...' : 'Publish Guide Settings'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
            <span className="text-xs font-semibold text-slate-800">Enable Video Guide Module</span>
            <input
              type="checkbox"
              checked={hiw.enabled}
              onChange={(e) => patchHiw({ enabled: e.target.checked })}
              className="accent-orange-500 w-4 h-4"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
            <span className="text-xs font-semibold text-slate-800">Show on Landing Page</span>
            <input
              type="checkbox"
              checked={hiw.showOnHomepage}
              onChange={(e) => patchHiw({ showOnHomepage: e.target.checked })}
              className="accent-orange-500 w-4 h-4"
            />
          </label>

          <div className="flex items-center justify-between gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50">
            <span className="text-xs font-semibold text-slate-800">Default Language</span>
            <select
              value={
                hiw.defaultLanguage === 'hi' || hiw.defaultLanguage === 'es'
                  ? hiw.defaultLanguage
                  : 'en'
              }
              onChange={(e) => patchHiw({ defaultLanguage: e.target.value as GuideLanguage })}
              className="px-2 py-1 rounded border border-slate-300 bg-white text-xs text-slate-800"
            >
              {LANGS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">
            Compliance &amp; Demo Visual Disclaimer (displayed below every motion video)
          </label>
          <input
            type="text"
            value={hiw.disclaimerText}
            onChange={(e) => patchHiw({ disclaimerText: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900"
          />
        </div>
      </div>

      {/* AI Motion Video Studio (Admin Prompt-to-Motion Storyboard & WebM Exporter) */}
      {activeStudioVideo && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <Wand2 className="w-5 h-5 text-orange-500" />
              <div>
                <h3 className="font-display font-bold text-slate-900 text-base">
                  AI Motion Video Studio
                </h3>
                <p className="text-xs text-slate-500">
                  Generate or refresh compliant 4-scene animated tutorial reels &amp; 3-language
                  captions from prompts or step scripts, and export as WebM.
                </p>
              </div>
            </div>

            <select
              value={activeStudioVideo.id}
              onChange={(e) => setStudioVideoId(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800"
            >
              {hiw.videos.map((v, idx) => (
                <option key={v.id} value={v.id}>
                  Reel 0{idx + 1}: {v.title.en}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Prompt & Script Studio Controls */}
            <div className="lg:col-span-5 space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  AI Motion Prompt (Describe Visual Focus or Promo Angle)
                </label>
                <textarea
                  rows={3}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. Highlight fast registration, Starter $100 to Elite $1,000 tiers, Mon–Fri 200 profit days, and transparent withdrawal tracking without profit guarantees."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  Current Tutorial Script ({activeStudioVideo.title.en})
                </label>
                <textarea
                  rows={4}
                  value={activeStudioVideo.script}
                  onChange={(e) => patchVideo(activeStudioVideo.id, { script: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Motion Visual Preset</label>
                <select
                  value={activeStudioVideo.visualPreset}
                  onChange={(e) =>
                    patchVideo(activeStudioVideo.id, {
                      visualPreset: e.target.value as MotionVisualPreset,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800"
                >
                  {VISUAL_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                disabled={generatingAi}
                onClick={() => void handleGenerateAiMotion()}
                className="w-full py-2.5 px-4 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-60 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-2 transition"
              >
                <RefreshCw className={`w-4 h-4 ${generatingAi ? 'animate-spin' : ''}`} />
                {generatingAi
                  ? 'Generating 4-Scene Motion Storyboard...'
                  : 'Generate / Refresh Motion Reel with AI'}
              </button>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Uses server-side Gemini AI to compose compliance-safe scenes &amp; subtitles in
                English, हिन्दी, and Español. Demo visuals are clearly labeled with no
                guaranteed profit claims.
              </p>
            </div>

            {/* Live Admin Motion Preview & WebM Export */}
            <div className="lg:col-span-7">
              <MotionVideoPlayer
                video={activeStudioVideo}
                language={editLang}
                companyName={draftConfig.companyName || 'AlphaTradex'}
                disclaimerText={hiw.disclaimerText}
                packages={draftConfig.packages || []}
                localPreviewBlobUrl={localVideoPreviews[activeStudioVideo.id] || ''}
                allowExportWebm
                compact
              />
            </div>
          </div>
        </div>
      )}

      {/* Language Editing Tab Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-5 py-3.5">
        <div className="text-xs font-semibold text-slate-700">
          Editing Language for Step &amp; Video Copy:
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {LANGS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setEditLang(l.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                editLang === l.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Onboarding Steps Editor */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Layers className="w-5 h-5 text-orange-500" />
          <div>
            <h3 className="font-display font-bold text-slate-900 text-base">
              3-Step Onboarding Cards ({hiw.steps.filter((s) => s.enabled).length} visible)
            </h3>
            <p className="text-xs text-slate-500">
              Toggle step visibility and edit titles, descriptions, and highlight points.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {hiw.steps.map((step) => (
            <div
              key={step.id}
              className={`p-4 rounded-xl border space-y-3 ${
                step.enabled ? 'border-slate-200 bg-slate-50/70' : 'border-slate-200 bg-slate-100 opacity-75'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={step.enabled}
                    onChange={(e) => patchStep(step.id, { enabled: e.target.checked })}
                    className="accent-orange-500 w-4 h-4"
                  />
                  <span className="font-bold text-sm text-slate-900">
                    Step {step.stepNumber}: {step.title[editLang] || step.title.en}
                  </span>
                </label>
                <span className="font-mono text-[11px] text-slate-500 uppercase">
                  Lang: {editLang}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">
                    Step Title ({editLang.toUpperCase()})
                  </label>
                  <input
                    type="text"
                    value={step.title[editLang] || ''}
                    onChange={(e) =>
                      patchStep(step.id, {
                        title: { ...step.title, [editLang]: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">CTA Button Label</label>
                  <input
                    type="text"
                    value={step.ctaLabel}
                    onChange={(e) => patchStep(step.id, { ctaLabel: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">
                  Step Description ({editLang.toUpperCase()})
                </label>
                <textarea
                  rows={2}
                  value={step.description[editLang] || ''}
                  onChange={(e) =>
                    patchStep(step.id, {
                      description: { ...step.description, [editLang]: e.target.value },
                    })
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Motion Video Cards & Custom Video Attachment Editor */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Link2 className="w-5 h-5 text-orange-500" />
          <div>
            <h3 className="font-display font-bold text-slate-900 text-base">
              Motion Video Cards &amp; Custom Reels ({hiw.videos.filter((v) => v.enabled).length}{' '}
              visible)
            </h3>
            <p className="text-xs text-slate-500">
              Toggle video cards, edit captions &amp; scripts, or attach custom MP4 / WebM /
              YouTube / Vimeo URLs.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {hiw.videos.map((vid, idx) => (
            <div
              key={vid.id}
              className={`p-4 rounded-xl border space-y-3 ${
                vid.enabled ? 'border-slate-200 bg-slate-50/70' : 'border-slate-200 bg-slate-100 opacity-75'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vid.enabled}
                    onChange={(e) => patchVideo(vid.id, { enabled: e.target.checked })}
                    className="accent-orange-500 w-4 h-4"
                  />
                  <span className="font-bold text-sm text-slate-900">
                    Reel 0{idx + 1}: {vid.title[editLang] || vid.title.en}
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={vid.isDemoVisual}
                      onChange={(e) => patchVideo(vid.id, { isDemoVisual: e.target.checked })}
                      className="accent-orange-500"
                    />
                    Label as Demo Visual
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">
                    Video Card Title ({editLang.toUpperCase()})
                  </label>
                  <input
                    type="text"
                    value={vid.title[editLang] || ''}
                    onChange={(e) =>
                      patchVideo(vid.id, { title: { ...vid.title, [editLang]: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">
                    Subtitle ({editLang.toUpperCase()})
                  </label>
                  <input
                    type="text"
                    value={vid.subtitle[editLang] || ''}
                    onChange={(e) =>
                      patchVideo(vid.id, {
                        subtitle: { ...vid.subtitle, [editLang]: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">
                  Video Caption / Subtitles ({editLang.toUpperCase()})
                </label>
                <input
                  type="text"
                  value={vid.caption[editLang] || ''}
                  onChange={(e) =>
                    patchVideo(vid.id, {
                      caption: { ...vid.caption, [editLang]: e.target.value },
                    })
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-8 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">
                    Custom Video URL (Optional — MP4, WebM, YouTube, or Vimeo; leave blank for
                    built-in 60fps Motion Reel)
                  </label>
                  <input
                    type="url"
                    value={vid.customVideoUrl || ''}
                    onChange={(e) => patchVideo(vid.id, { customVideoUrl: e.target.value })}
                    placeholder="https://... (MP4 / WebM / YouTube / Vimeo)"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-900"
                  />
                </div>

                <div className="md:col-span-4 flex items-center gap-2">
                  <input
                    ref={(el) => {
                      fileRefs.current[vid.id] = el;
                    }}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={(e) => handleLocalVideoUpload(vid.id, e)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileRefs.current[vid.id]?.click()}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition"
                  >
                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                    Preview Local File
                  </button>
                  {(vid.customVideoUrl || localVideoPreviews[vid.id]) && (
                    <button
                      type="button"
                      onClick={() => {
                        patchVideo(vid.id, { customVideoUrl: '' });
                        if (localVideoPreviews[vid.id]) {
                          URL.revokeObjectURL(localVideoPreviews[vid.id]);
                          setLocalVideoPreviews((prev) => {
                            const copy = { ...prev };
                            delete copy[vid.id];
                            return copy;
                          });
                        }
                      }}
                      title="Revert to built-in motion reel"
                      className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
