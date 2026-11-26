import React, { useRef, useState } from 'react';
import {
  BarChart3,
  Download,
  Image as ImageIcon,
  Layers,
  Plus,
  Save,
  Share2,
  Trash2,
  Upload,
} from 'lucide-react';
import { DEFAULT_PLATFORM_CONFIG } from '../constants/defaults';
import {
  MarketingCardStats,
  MarketingCardTemplateConfig,
  MarketingCardThemeId,
  MarketingCardsConfig,
  PlatformConfig,
} from '../types/platform';
import { MARKETING_CARD_THEMES } from '../utils/marketingCardRenderer';

interface AdminMarketingCardsPanelProps {
  draftConfig: PlatformConfig;
  setDraftConfig: React.Dispatch<React.SetStateAction<PlatformConfig>>;
  marketingCardStats: MarketingCardStats;
  onSaveConfig: (nextConfig?: PlatformConfig) => Promise<void>;
  busy: boolean;
  onNotify: (type: 'ok' | 'err', text: string) => void;
}

const THEME_OPTIONS: MarketingCardThemeId[] = [
  'navy_gold',
  'emerald_green',
  'cyber_cyan',
  'royal_purple',
];

/**
 * Resize uploaded PNG overlay while preserving full alpha transparency
 * so Firestore config/platform stays comfortably under 1MB.
 */
function compressTransparentPng(file: File, maxDim = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        let dataUrl = canvas.toDataURL('image/png');
        // If still large (> 210KB), scale down slightly further to preserve transparency safely
        if (dataUrl.length > 210_000) {
          const smallerScale = Math.min(1, 640 / Math.max(img.width, img.height));
          canvas.width = Math.max(1, Math.round(img.width * smallerScale));
          canvas.height = Math.max(1, Math.round(img.height * smallerScale));
          const ctx2 = canvas.getContext('2d');
          if (ctx2) {
            ctx2.clearRect(0, 0, canvas.width, canvas.height);
            ctx2.drawImage(img, 0, 0, canvas.width, canvas.height);
            dataUrl = canvas.toDataURL('image/png');
          }
        }
        if (dataUrl.length > 215_000) {
          reject(
            new Error(
              'PNG overlay is too complex/large after resizing. Please use a lighter transparent PNG frame (under 200 KB).'
            )
          );
          return;
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Could not decode PNG file.'));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

export const AdminMarketingCardsPanel: React.FC<AdminMarketingCardsPanelProps> = ({
  draftConfig,
  setDraftConfig,
  marketingCardStats,
  onSaveConfig,
  busy,
  onNotify,
}) => {
  const mc: MarketingCardsConfig =
    draftConfig.marketingCardsConfig || DEFAULT_PLATFORM_CONFIG.marketingCardsConfig!;

  const [newName, setNewName] = useState('');
  const [newHeadline, setNewHeadline] = useState('Official AlphaTradex Partner');
  const [newSubheadline, setNewSubheadline] = useState(
    'Multi-asset AI trading, Gold & Crypto vault access.'
  );
  const [newBadge, setNewBadge] = useState('CUSTOM FRAME');
  const [newCta, setNewCta] = useState('Scan QR or Join With Code');
  const [newTheme, setNewTheme] = useState<MarketingCardThemeId>('navy_gold');
  const [newOverlayData, setNewOverlayData] = useState('');
  const [photoXPct, setPhotoXPct] = useState(50);
  const [photoYPct, setPhotoYPct] = useState(36);
  const [photoSizePct, setPhotoSizePct] = useState(28);
  const [textXPct, setTextXPct] = useState(50);
  const [textYPct, setTextYPct] = useState(66);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const patchMc = (patch: Partial<MarketingCardsConfig>) => {
    setDraftConfig((prev) => {
      const current = prev.marketingCardsConfig || DEFAULT_PLATFORM_CONFIG.marketingCardsConfig!;
      return {
        ...prev,
        marketingCardsConfig: {
          ...current,
          ...patch,
        },
      };
    });
  };

  const patchTemplate = (tplId: string, patch: Partial<MarketingCardTemplateConfig>) => {
    const nextTemplates = mc.templates.map((t) => (t.id === tplId ? { ...t, ...patch } : t));
    patchMc({ templates: nextTemplates });
  };

  const removeCustomTemplate = (tplId: string) => {
    patchMc({ templates: mc.templates.filter((t) => t.id !== tplId) });
    onNotify('ok', 'Custom template removed from draft. Click Publish Settings to save.');
  };

  const handleOverlayFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'image/png') {
      onNotify('err', 'Please upload a transparent PNG overlay frame (.png).');
      e.target.value = '';
      return;
    }
    try {
      const compressed = await compressTransparentPng(file);
      setNewOverlayData(compressed);
      onNotify('ok', 'Transparent PNG frame loaded. Adjust photo & text slot coordinates below.');
    } catch (err) {
      onNotify('err', err instanceof Error ? err.message : 'Failed to process PNG frame.');
    }
    e.target.value = '';
  };

  const handleAddCustomTemplate = () => {
    if (!newName.trim()) {
      onNotify('err', 'Please enter a name for the custom card template.');
      return;
    }
    if (!newOverlayData) {
      onNotify('err', 'Please upload a PNG overlay frame image first.');
      return;
    }
    if (mc.templates.length >= 16) {
      onNotify('err', 'Maximum of 16 templates reached. Delete an unused custom template first.');
      return;
    }

    const customTpl: MarketingCardTemplateConfig = {
      id: `custom_${Date.now()}`,
      name: newName.trim().slice(0, 60),
      category: 'custom',
      enabled: true,
      headline: newHeadline.trim().slice(0, 80) || mc.defaultHeadline,
      subheadline: newSubheadline.trim().slice(0, 140) || mc.defaultTagline,
      badgeText: newBadge.trim().slice(0, 36) || 'CUSTOM FRAME',
      ctaText: newCta.trim().slice(0, 60) || 'Join via Official Referral',
      defaultTheme: newTheme,
      isCustom: true,
      overlayImageData: newOverlayData,
      photoSlot: {
        xPct: photoXPct,
        yPct: photoYPct,
        sizePct: photoSizePct,
      },
      textSlot: {
        xPct: textXPct,
        yPct: textYPct,
      },
    };

    patchMc({ templates: [...mc.templates, customTpl] });
    setNewName('');
    setNewOverlayData('');
    onNotify('ok', 'Custom PNG overlay template added to draft. Click Publish Settings to go live.');
  };

  const enabledCount = mc.templates.filter((t) => t.enabled).length;

  return (
    <section className="space-y-6">
      {/* Top Analytics Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Cards Generated
            </div>
            <div className="font-mono font-bold text-2xl text-slate-900 mt-1 tabular-nums">
              {(marketingCardStats.totalGenerated || 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">PNG & JPG high-res exports</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
            <Download className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Cards Shared
            </div>
            <div className="font-mono font-bold text-2xl text-slate-900 mt-1 tabular-nums">
              {(marketingCardStats.totalShared || 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Web Share, WhatsApp, Telegram, FB & X
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
            <Share2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Card Templates
            </div>
            <div className="font-mono font-bold text-2xl text-slate-900 mt-1 tabular-nums">
              {enabledCount} / {mc.templates.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Studio Status: {mc.enabled ? 'Live for Clients' : 'Paused'}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center">
            <BarChart3 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Global Controls & Compliance Defaults */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <ImageIcon className="w-5 h-5 text-orange-500" />
            <div>
              <h2 className="font-display font-bold text-slate-900 text-base">
                Global Marketing Card Controls & Disclaimer
              </h2>
              <p className="text-xs text-slate-500">
                Toggle client access to Promo Studio, control visible card elements, and manage
                compliance copy.
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
            {busy ? 'Publishing...' : 'Publish Settings'}
          </button>
        </div>

        {/* Master Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { key: 'enabled', label: 'Enable Promo Studio' },
            { key: 'allowQrCode', label: 'Allow QR Code' },
            { key: 'allowReferralCode', label: 'Allow Referral Code' },
            { key: 'allowRankBadge', label: 'Allow Rank Badges' },
            { key: 'allowPackageBadge', label: 'Allow Package Tier' },
          ].map((item) => {
            const checked = Boolean(mc[item.key as keyof MarketingCardsConfig]);
            return (
              <label
                key={item.key}
                className="flex items-center justify-between gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer"
              >
                <span className="text-xs font-semibold text-slate-800">{item.label}</span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => patchMc({ [item.key]: e.target.checked })}
                  className="accent-orange-500 w-4 h-4"
                />
              </label>
            );
          })}
        </div>

        {/* Default Copy & Risk Disclaimer */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Default Promotional Headline
            </label>
            <input
              type="text"
              value={mc.defaultHeadline}
              onChange={(e) => patchMc({ defaultHeadline: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Default Tagline
            </label>
            <input
              type="text"
              value={mc.defaultTagline}
              onChange={(e) => patchMc({ defaultTagline: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">
            Mandatory Card Footer Disclaimer (Compliance Notice)
          </label>
          <input
            type="text"
            value={mc.disclaimerText}
            onChange={(e) => patchMc({ disclaimerText: e.target.value })}
            placeholder="Trading & digital assets involve risk. Join via official referral."
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900"
          />
          <p className="text-[11px] text-slate-500">
            Printed on the footer of every exported PNG/JPG card. Never add guaranteed return or
            fabricated profit claims.
          </p>
        </div>
      </div>

      {/* Built-In & Custom Templates Manager */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-orange-500" />
            <div>
              <h3 className="font-display font-bold text-slate-900 text-base">
                Card Templates ({mc.templates.length})
              </h3>
              <p className="text-xs text-slate-500">
                Enable/disable templates or customize their headlines, CTAs, and default themes.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {mc.templates.map((tpl) => (
            <div
              key={tpl.id}
              className={`p-4 rounded-xl border space-y-3 ${
                tpl.enabled
                  ? 'border-slate-200 bg-slate-50/60'
                  : 'border-slate-200 bg-slate-100/80 opacity-75'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tpl.enabled}
                      onChange={(e) => patchTemplate(tpl.id, { enabled: e.target.checked })}
                      className="accent-orange-500 w-4 h-4"
                    />
                    <span className="font-bold text-sm text-slate-900">{tpl.name}</span>
                  </label>
                  <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                    {tpl.isCustom ? 'Custom PNG' : tpl.category}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={tpl.defaultTheme}
                    onChange={(e) =>
                      patchTemplate(tpl.id, {
                        defaultTheme: e.target.value as MarketingCardThemeId,
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800"
                  >
                    {THEME_OPTIONS.map((tid) => (
                      <option key={tid} value={tid}>
                        {MARKETING_CARD_THEMES[tid].label}
                      </option>
                    ))}
                  </select>

                  {tpl.isCustom && (
                    <button
                      type="button"
                      onClick={() => removeCustomTemplate(tpl.id)}
                      className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 transition"
                      title="Delete custom template"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Template Name</label>
                  <input
                    type="text"
                    value={tpl.name}
                    onChange={(e) => patchTemplate(tpl.id, { name: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Card Headline</label>
                  <input
                    type="text"
                    value={tpl.headline}
                    onChange={(e) => patchTemplate(tpl.id, { headline: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">
                    Top Badge Label
                  </label>
                  <input
                    type="text"
                    value={tpl.badgeText}
                    onChange={(e) => patchTemplate(tpl.id, { badgeText: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">CTA Prompt</label>
                  <input
                    type="text"
                    value={tpl.ctaText}
                    onChange={(e) => patchTemplate(tpl.id, { ctaText: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">
                  Default Subheadline / Tagline
                </label>
                <input
                  type="text"
                  value={tpl.subheadline}
                  onChange={(e) => patchTemplate(tpl.id, { subheadline: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
                />
              </div>

              {tpl.isCustom && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-slate-200/80">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-600">Photo X (%)</label>
                    <input
                      type="number"
                      min={10}
                      max={90}
                      value={tpl.photoSlot?.xPct ?? 50}
                      onChange={(e) =>
                        patchTemplate(tpl.id, {
                          photoSlot: {
                            xPct: Number(e.target.value) || 50,
                            yPct: tpl.photoSlot?.yPct ?? 36,
                            sizePct: tpl.photoSlot?.sizePct ?? 28,
                          },
                        })
                      }
                      className="w-full px-2 py-1 rounded border border-slate-300 bg-white text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-600">Photo Y (%)</label>
                    <input
                      type="number"
                      min={10}
                      max={90}
                      value={tpl.photoSlot?.yPct ?? 36}
                      onChange={(e) =>
                        patchTemplate(tpl.id, {
                          photoSlot: {
                            xPct: tpl.photoSlot?.xPct ?? 50,
                            yPct: Number(e.target.value) || 36,
                            sizePct: tpl.photoSlot?.sizePct ?? 28,
                          },
                        })
                      }
                      className="w-full px-2 py-1 rounded border border-slate-300 bg-white text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-600">
                      Photo Size (%)
                    </label>
                    <input
                      type="number"
                      min={12}
                      max={55}
                      value={tpl.photoSlot?.sizePct ?? 28}
                      onChange={(e) =>
                        patchTemplate(tpl.id, {
                          photoSlot: {
                            xPct: tpl.photoSlot?.xPct ?? 50,
                            yPct: tpl.photoSlot?.yPct ?? 36,
                            sizePct: Number(e.target.value) || 28,
                          },
                        })
                      }
                      className="w-full px-2 py-1 rounded border border-slate-300 bg-white text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-600">Text X (%)</label>
                    <input
                      type="number"
                      min={10}
                      max={90}
                      value={tpl.textSlot?.xPct ?? 50}
                      onChange={(e) =>
                        patchTemplate(tpl.id, {
                          textSlot: {
                            xPct: Number(e.target.value) || 50,
                            yPct: tpl.textSlot?.yPct ?? 66,
                          },
                        })
                      }
                      className="w-full px-2 py-1 rounded border border-slate-300 bg-white text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-600">Text Y (%)</label>
                    <input
                      type="number"
                      min={15}
                      max={90}
                      value={tpl.textSlot?.yPct ?? 66}
                      onChange={(e) =>
                        patchTemplate(tpl.id, {
                          textSlot: {
                            xPct: tpl.textSlot?.xPct ?? 50,
                            yPct: Number(e.target.value) || 66,
                          },
                        })
                      }
                      className="w-full px-2 py-1 rounded border border-slate-300 bg-white text-xs font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add Custom PNG Overlay Template Builder */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <Plus className="w-5 h-5 text-orange-500" />
          <div>
            <h3 className="font-display font-bold text-slate-900 text-base">
              Upload Custom PNG Overlay Frame Template
            </h3>
            <p className="text-xs text-slate-500">
              Upload a transparent PNG frame and configure exact Photo Slot & Text Slot coordinates
              for clients.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Form */}
          <div className="lg:col-span-7 space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png"
              onChange={(e) => void handleOverlayFileChange(e)}
              className="hidden"
            />

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 transition"
              >
                <Upload className="w-4 h-4" />
                Upload Transparent PNG Frame
              </button>
              {newOverlayData && (
                <span className="text-xs text-emerald-700 font-semibold">
                  PNG ready ({Math.round(newOverlayData.length / 1024)} KB)
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Template Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Eid / Holiday Promo Frame"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Default Color Theme</label>
                <select
                  value={newTheme}
                  onChange={(e) => setNewTheme(e.target.value as MarketingCardThemeId)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white"
                >
                  {THEME_OPTIONS.map((tid) => (
                    <option key={tid} value={tid}>
                      {MARKETING_CARD_THEMES[tid].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Headline</label>
                <input
                  type="text"
                  value={newHeadline}
                  onChange={(e) => setNewHeadline(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Badge Text</label>
                <input
                  type="text"
                  value={newBadge}
                  onChange={(e) => setNewBadge(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Subheadline</label>
                <input
                  type="text"
                  value={newSubheadline}
                  onChange={(e) => setNewSubheadline(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">CTA Text</label>
                <input
                  type="text"
                  value={newCta}
                  onChange={(e) => setNewCta(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900"
                />
              </div>
            </div>

            {/* Coordinate Sliders */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <div className="flex justify-between text-[11px] text-slate-600 font-semibold">
                  <span>Photo X</span>
                  <span className="font-mono">{photoXPct}%</span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={85}
                  value={photoXPct}
                  onChange={(e) => setPhotoXPct(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-600 font-semibold">
                  <span>Photo Y</span>
                  <span className="font-mono">{photoYPct}%</span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={85}
                  value={photoYPct}
                  onChange={(e) => setPhotoYPct(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-600 font-semibold">
                  <span>Photo Size</span>
                  <span className="font-mono">{photoSizePct}%</span>
                </div>
                <input
                  type="range"
                  min={14}
                  max={50}
                  value={photoSizePct}
                  onChange={(e) => setPhotoSizePct(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-600 font-semibold">
                  <span>Text X</span>
                  <span className="font-mono">{textXPct}%</span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={85}
                  value={textXPct}
                  onChange={(e) => setTextXPct(Number(e.target.value))}
                  className="w-full accent-sky-600"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-600 font-semibold">
                  <span>Text Y</span>
                  <span className="font-mono">{textYPct}%</span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={88}
                  value={textYPct}
                  onChange={(e) => setTextYPct(Number(e.target.value))}
                  className="w-full accent-sky-600"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddCustomTemplate}
              className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              Add Custom Template to Draft
            </button>
          </div>

          {/* Right Placement Visualizer */}
          <div className="lg:col-span-5 space-y-2">
            <div className="text-xs font-semibold text-slate-700">
              Coordinate Guide Preview (1:1 Frame)
            </div>
            <div className="relative aspect-square w-full max-w-[300px] rounded-xl overflow-hidden bg-[#081022] border border-slate-300">
              {/* Photo slot marker */}
              <div
                className="absolute rounded-full border-2 border-dashed border-amber-400 bg-amber-400/20 flex items-center justify-center text-[10px] font-mono text-amber-200 font-bold"
                style={{
                  left: `${photoXPct}%`,
                  top: `${photoYPct}%`,
                  width: `${photoSizePct}%`,
                  height: `${photoSizePct}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                PHOTO
              </div>

              {/* Uploaded PNG overlay */}
              {newOverlayData && (
                <img
                  src={newOverlayData}
                  alt="Custom overlay preview"
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                />
              )}

              {/* Text slot marker */}
              <div
                className="absolute px-2.5 py-1 rounded border border-sky-400 bg-sky-500/30 text-[10px] font-mono text-white font-bold whitespace-nowrap"
                style={{
                  left: `${textXPct}%`,
                  top: `${textYPct}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                MEMBER NAME & REF ID
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Remember to click <strong>Publish Settings</strong> after adding or editing templates.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
