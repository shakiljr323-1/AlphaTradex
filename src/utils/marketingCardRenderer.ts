import QRCode from 'qrcode';
import {
  InvestmentPackage,
  MarketingCardAspectRatio,
  MarketingCardPhotoFrame,
  MarketingCardTemplateConfig,
  MarketingCardThemeId,
} from '../types/platform';

export interface ThemePalette {
  id: MarketingCardThemeId;
  label: string;
  bgStart: string;
  bgMid: string;
  bgEnd: string;
  accent: string;
  accentBright: string;
  accentSoft: string;
  surface: string;
  border: string;
  textPrimary: string;
  textMuted: string;
}

export const MARKETING_CARD_THEMES: Record<MarketingCardThemeId, ThemePalette> = {
  navy_gold: {
    id: 'navy_gold',
    label: 'Dark Navy Gold',
    bgStart: '#050914',
    bgMid: '#0B1426',
    bgEnd: '#111C33',
    accent: '#F59E0B',
    accentBright: '#FCD34D',
    accentSoft: 'rgba(245, 158, 11, 0.16)',
    surface: 'rgba(13, 21, 38, 0.86)',
    border: 'rgba(245, 158, 11, 0.38)',
    textPrimary: '#FFFFFF',
    textMuted: '#94A3B8',
  },
  emerald_green: {
    id: 'emerald_green',
    label: 'Emerald Green',
    bgStart: '#03120E',
    bgMid: '#07221B',
    bgEnd: '#0B2F25',
    accent: '#10B981',
    accentBright: '#34D399',
    accentSoft: 'rgba(16, 185, 129, 0.16)',
    surface: 'rgba(7, 29, 23, 0.86)',
    border: 'rgba(16, 185, 129, 0.4)',
    textPrimary: '#FFFFFF',
    textMuted: '#99C7B7',
  },
  cyber_cyan: {
    id: 'cyber_cyan',
    label: 'Cyber Cyan',
    bgStart: '#040C18',
    bgMid: '#071B33',
    bgEnd: '#0C2847',
    accent: '#06B6D4',
    accentBright: '#38BDF8',
    accentSoft: 'rgba(6, 182, 212, 0.16)',
    surface: 'rgba(8, 24, 46, 0.86)',
    border: 'rgba(56, 189, 248, 0.38)',
    textPrimary: '#FFFFFF',
    textMuted: '#94B8D4',
  },
  royal_purple: {
    id: 'royal_purple',
    label: 'Royal Purple',
    bgStart: '#0D071A',
    bgMid: '#180E33',
    bgEnd: '#25144B',
    accent: '#A855F7',
    accentBright: '#E879F9',
    accentSoft: 'rgba(168, 85, 247, 0.18)',
    surface: 'rgba(22, 13, 46, 0.86)',
    border: 'rgba(192, 132, 252, 0.4)',
    textPrimary: '#FFFFFF',
    textMuted: '#B7A7D6',
  },
};

export const ASPECT_RATIO_SPECS: Record<
  MarketingCardAspectRatio,
  { width: number; height: number; label: string; platforms: string }
> = {
  '1:1': {
    width: 1080,
    height: 1080,
    label: 'Square (1:1)',
    platforms: 'Facebook · Instagram · Telegram · WhatsApp',
  },
  '9:16': {
    width: 1080,
    height: 1920,
    label: 'Story / Status (9:16)',
    platforms: 'WhatsApp Status · IG/FB Stories · TikTok',
  },
  '16:9': {
    width: 1200,
    height: 630,
    label: 'Landscape Banner (16:9)',
    platforms: 'X (Twitter) · LinkedIn · YouTube',
  },
};

export interface RenderMarketingCardOptions {
  canvas: HTMLCanvasElement;
  aspectRatio: MarketingCardAspectRatio;
  themeId: MarketingCardThemeId;
  template: MarketingCardTemplateConfig;
  companyName: string;
  coinName: string;
  displayName: string;
  rankTitle: string;
  tagline: string;
  referralCode: string;
  referralLink: string;
  disclaimerText: string;
  selectedPackageName: string;
  packages: InvestmentPackage[];
  photoImage: HTMLImageElement | null;
  overlayImage: HTMLImageElement | null;
  photoFrame: MarketingCardPhotoFrame;
  photoZoom: number; // 1.0 to 3.0
  photoOffsetX: number; // -100 to 100
  photoOffsetY: number; // -100 to 100
  showQrCode: boolean;
  showReferralCode: boolean;
  showRankBadge: boolean;
  showPackageBadge: boolean;
}

const qrImageCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

async function getQrImage(url: string): Promise<HTMLImageElement | null> {
  if (!url) return null;
  const cached = qrImageCache.get(url);
  if (cached) return cached;
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 340,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#09101E',
        light: '#FFFFFF',
      },
    });
    const img = await loadImage(dataUrl);
    qrImageCache.set(url, img);
    return img;
  } catch {
    return null;
  }
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
      if (lines.length >= maxLines - 1) break;
    }
  }
  lines.push(current);

  // Truncate last line neatly if needed
  if (lines.length > maxLines) {
    lines.length = maxLines;
  }
  const lastIdx = lines.length - 1;
  while (
    lastIdx >= 0 &&
    ctx.measureText(lines[lastIdx]).width > maxWidth &&
    lines[lastIdx].length > 4
  ) {
    lines[lastIdx] = `${lines[lastIdx].slice(0, -2)}…`;
  }
  return lines;
}

function drawBrandEmblem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  palette: ThemePalette
) {
  ctx.save();
  // Outer hexagon
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const grad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  grad.addColorStop(0, palette.accentBright);
  grad.addColorStop(1, palette.accent);
  ctx.fillStyle = grad;
  ctx.fill();

  // Inner dark hexagon
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const px = cx + Math.cos(angle) * (radius * 0.76);
    const py = cy + Math.sin(angle) * (radius * 0.76);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = palette.bgStart;
  ctx.fill();

  // Stylized geometric "A" trading chevron
  ctx.strokeStyle = palette.accentBright;
  ctx.lineWidth = Math.max(2.5, radius * 0.13);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - radius * 0.34, cy + radius * 0.28);
  ctx.lineTo(cx, cy - radius * 0.34);
  ctx.lineTo(cx + radius * 0.34, cy + radius * 0.28);
  ctx.moveTo(cx - radius * 0.18, cy + radius * 0.06);
  ctx.lineTo(cx + radius * 0.18, cy + radius * 0.06);
  ctx.stroke();
  ctx.restore();
}

function drawBackgroundArtwork(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  palette: ThemePalette
) {
  // Base diagonal gradient
  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0, palette.bgStart);
  bgGrad.addColorStop(0.55, palette.bgMid);
  bgGrad.addColorStop(1, palette.bgEnd);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle ambient glow top-right and bottom-left
  const glow1 = ctx.createRadialGradient(w * 0.85, h * 0.12, 10, w * 0.85, h * 0.12, w * 0.55);
  glow1.addColorStop(0, palette.accentSoft);
  glow1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, w, h);

  const glow2 = ctx.createRadialGradient(w * 0.12, h * 0.88, 10, w * 0.12, h * 0.88, w * 0.45);
  glow2.addColorStop(0, palette.accentSoft);
  glow2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, w, h);

  // Architectural hairline grid
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.lineWidth = 1;
  const gridStep = Math.round(Math.min(w, h) / 14);
  for (let gx = gridStep; gx < w; gx += gridStep) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, h);
    ctx.stroke();
  }
  for (let gy = gridStep; gy < h; gy += gridStep) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
    ctx.stroke();
  }

  // Stylized market trend line + candlesticks watermark
  ctx.strokeStyle = palette.border;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  const points = [0.78, 0.72, 0.75, 0.65, 0.68, 0.55, 0.59, 0.46, 0.49, 0.36, 0.31];
  points.forEach((pyRatio, i) => {
    const px = (w / (points.length - 1)) * i;
    const py = h * pyRatio;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  // Outer institutional frame border
  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 2;
  drawRoundedRectPath(ctx, 24, 24, w - 48, h - 48, 24);
  ctx.stroke();

  // Top thin accent highlight bar
  ctx.globalAlpha = 1;
  const topBarGrad = ctx.createLinearGradient(w * 0.2, 24, w * 0.8, 24);
  topBarGrad.addColorStop(0, 'rgba(0,0,0,0)');
  topBarGrad.addColorStop(0.5, palette.accentBright);
  topBarGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = topBarGrad;
  ctx.fillRect(w * 0.2, 23, w * 0.6, 4);
  ctx.restore();
}

function drawUserPhotoSlot(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  frame: MarketingCardPhotoFrame,
  photoImage: HTMLImageElement | null,
  displayName: string,
  zoom: number,
  offsetX: number,
  offsetY: number,
  palette: ThemePalette
) {
  const half = size / 2;
  const x = cx - half;
  const y = cy - half;
  const cornerRadius = frame === 'circle' ? half : frame === 'rounded' ? Math.round(size * 0.14) : 8;

  ctx.save();
  // Outer glow ring
  ctx.shadowColor = palette.accent;
  ctx.shadowBlur = 24;
  ctx.strokeStyle = palette.accentBright;
  ctx.lineWidth = Math.max(4, size * 0.025);
  if (frame === 'circle') {
    ctx.beginPath();
    ctx.arc(cx, cy, half + 6, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    drawRoundedRectPath(ctx, x - 6, y - 6, size + 12, size + 12, cornerRadius + 4);
    ctx.stroke();
  }
  ctx.restore();

  // Clip photo shape
  ctx.save();
  if (frame === 'circle') {
    ctx.beginPath();
    ctx.arc(cx, cy, half, 0, Math.PI * 2);
    ctx.closePath();
  } else {
    drawRoundedRectPath(ctx, x, y, size, size, cornerRadius);
  }
  ctx.clip();

  if (photoImage && photoImage.naturalWidth > 0 && photoImage.naturalHeight > 0) {
    const iw = photoImage.naturalWidth;
    const ih = photoImage.naturalHeight;
    // Cover-fit then multiply by zoom (zero distortion)
    const baseScale = Math.max(size / iw, size / ih);
    const finalScale = baseScale * Math.max(1, Math.min(3, zoom));
    const drawW = iw * finalScale;
    const drawH = ih * finalScale;
    const maxShiftX = Math.max(0, (drawW - size) / 2);
    const maxShiftY = Math.max(0, (drawH - size) / 2);
    const shiftX = (Math.max(-100, Math.min(100, offsetX)) / 100) * Math.max(maxShiftX, size * 0.28);
    const shiftY = (Math.max(-100, Math.min(100, offsetY)) / 100) * Math.max(maxShiftY, size * 0.28);
    const drawX = cx - drawW / 2 + shiftX;
    const drawY = cy - drawH / 2 + shiftY;
    ctx.drawImage(photoImage, drawX, drawY, drawW, drawH);
  } else {
    // Clean monogram fallback
    const phGrad = ctx.createLinearGradient(x, y, x + size, y + size);
    phGrad.addColorStop(0, palette.bgMid);
    phGrad.addColorStop(1, palette.bgStart);
    ctx.fillStyle = phGrad;
    ctx.fillRect(x, y, size, size);

    const initials = (displayName || 'AT')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || '')
      .join('') || 'AT';
    ctx.fillStyle = palette.accentBright;
    ctx.font = `700 ${Math.round(size * 0.34)}px "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, cx, cy);
  }
  ctx.restore();
}

function drawTemplateHighlightsBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  template: MarketingCardTemplateConfig,
  packages: InvestmentPackage[],
  selectedPackageName: string,
  coinName: string,
  palette: ThemePalette
) {
  let chips: Array<{ title: string; subtitle: string; highlight?: boolean }> = [];

  if (template.category === 'package') {
    const activePkgs =
      packages.length > 0
        ? packages.slice(0, 4)
        : [
            { id: 's', name: 'Starter', capital: 100, dailyPercent: 1.0 } as InvestmentPackage,
            { id: 'g', name: 'Growth', capital: 300, dailyPercent: 1.3 } as InvestmentPackage,
            { id: 'p', name: 'Pro', capital: 500, dailyPercent: 1.6 } as InvestmentPackage,
            { id: 'e', name: 'Elite', capital: 1000, dailyPercent: 2.0 } as InvestmentPackage,
          ];
    chips = activePkgs.map((p) => ({
      title: `$${p.capital.toLocaleString()}`,
      subtitle: p.name.replace(/\s*Tier$/i, ''),
      highlight: p.name === selectedPackageName,
    }));
  } else if (template.category === 'trading') {
    chips = [
      { title: 'BTC / ETH', subtitle: 'Crypto Spot', highlight: true },
      { title: 'XAU / USD', subtitle: 'Gold Desk' },
      { title: 'MON – FRI', subtitle: 'AI Execution' },
      { title: 'LIVE FX', subtitle: 'WebTerminal' },
    ];
  } else if (template.category === 'launchpad') {
    chips = [
      { title: coinName.slice(0, 11), subtitle: 'Ecosystem Coin', highlight: true },
      { title: 'SOLANA', subtitle: 'Liquidity Pool' },
      { title: 'MINING', subtitle: 'Tap & Stake' },
      { title: 'REWARDS', subtitle: 'Airdrop Hub' },
    ];
  } else {
    return;
  }

  const gap = 14;
  const itemW = (w - gap * (chips.length - 1)) / chips.length;

  chips.forEach((chip, i) => {
    const bx = x + i * (itemW + gap);
    ctx.save();
    drawRoundedRectPath(ctx, bx, y, itemW, h, 14);
    ctx.fillStyle = chip.highlight ? palette.accentSoft : palette.surface;
    ctx.fill();
    ctx.strokeStyle = chip.highlight ? palette.accentBright : palette.border;
    ctx.lineWidth = chip.highlight ? 2 : 1;
    ctx.stroke();

    ctx.fillStyle = chip.highlight ? palette.accentBright : '#FFFFFF';
    ctx.font = `700 ${Math.round(h * 0.34)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(chip.title, bx + itemW / 2, y + h * 0.38);

    ctx.fillStyle = palette.textMuted;
    ctx.font = `600 ${Math.round(h * 0.21)}px "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.fillText(chip.subtitle, bx + itemW / 2, y + h * 0.72);
    ctx.restore();
  });
}

export async function renderMarketingCardCanvas(
  opts: RenderMarketingCardOptions
): Promise<void> {
  const { canvas, aspectRatio, themeId, template } = opts;
  const spec = ASPECT_RATIO_SPECS[aspectRatio];
  const palette = MARKETING_CARD_THEMES[themeId] || MARKETING_CARD_THEMES.navy_gold;

  if (canvas.width !== spec.width || canvas.height !== spec.height) {
    canvas.width = spec.width;
    canvas.height = spec.height;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = spec.width;
  const H = spec.height;
  ctx.clearRect(0, 0, W, H);

  const qrImg = opts.showQrCode ? await getQrImage(opts.referralLink) : null;

  // 1. Base institutional fintech artwork
  drawBackgroundArtwork(ctx, W, H, palette);

  // 2. If custom Super Admin PNG overlay template is active
  if (template.isCustom && opts.overlayImage && opts.overlayImage.naturalWidth > 0) {
    const pSlot = template.photoSlot || { xPct: 50, yPct: 38, sizePct: 28 };
    const tSlot = template.textSlot || { xPct: 50, yPct: 68 };
    const photoSize = Math.round(Math.min(W, H) * (pSlot.sizePct / 100));
    const px = Math.round(W * (pSlot.xPct / 100));
    const py = Math.round(H * (pSlot.yPct / 100));

    // Photo underneath transparent frame cut-out
    drawUserPhotoSlot(
      ctx,
      px,
      py,
      photoSize,
      opts.photoFrame,
      opts.photoImage,
      opts.displayName,
      opts.photoZoom,
      opts.photoOffsetX,
      opts.photoOffsetY,
      palette
    );

    // Draw custom PNG overlay full bleed
    ctx.drawImage(opts.overlayImage, 0, 0, W, H);

    // Draw user details at Admin-configured textSlot
    const tx = Math.round(W * (tSlot.xPct / 100));
    const ty = Math.round(H * (tSlot.yPct / 100));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 ${Math.round(W * 0.044)}px "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.fillText(opts.displayName || 'AlphaTradex Member', tx, ty);

    if (opts.showRankBadge && opts.rankTitle) {
      ctx.fillStyle = palette.accentBright;
      ctx.font = `600 ${Math.round(W * 0.024)}px "Plus Jakarta Sans", system-ui, sans-serif`;
      ctx.fillText(opts.rankTitle, tx, ty + Math.round(H * 0.045));
    }

    if (opts.showReferralCode && opts.referralCode) {
      ctx.fillStyle = '#E2E8F0';
      ctx.font = `700 ${Math.round(W * 0.022)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.fillText(`REFERRAL ID: ${opts.referralCode}`, tx, ty + Math.round(H * 0.088));
    }

    if (qrImg) {
      const qrSize = Math.round(Math.min(W, H) * 0.14);
      const qx = W - qrSize - 56;
      const qy = H - qrSize - 76;
      drawRoundedRectPath(ctx, qx - 8, qy - 8, qrSize + 16, qrSize + 16, 14);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.drawImage(qrImg, qx, qy, qrSize, qrSize);
    }

    // Footer disclaimer
    ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
    ctx.font = `500 ${Math.round(Math.min(W, H) * 0.017)}px "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(opts.disclaimerText, W / 2, H - 40);
    return;
  }

  // 3. Built-in Layout Geometry tailored per Aspect Ratio
  const displayHeadline = template.headline
    .replace(/AlphaTradex/gi, opts.companyName)
    .replace(/\{coinName\}/gi, opts.coinName);

  if (aspectRatio === '16:9') {
    // LANDSCAPE BANNER (1200 x 630)
    const pad = 54;

    // Header Row: Brand Left + Template Kicker Right
    drawBrandEmblem(ctx, pad + 24, pad + 20, 24, palette);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 28px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(opts.companyName, pad + 60, pad + 20);

    // Kicker label right
    ctx.textAlign = 'right';
    ctx.fillStyle = palette.accentBright;
    ctx.font = '700 16px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(template.badgeText.toUpperCase(), W - pad, pad + 20);

    // Left Column: Photo + Identity
    const photoSize = 216;
    const photoCx = pad + photoSize / 2 + 12;
    const photoCy = 266;
    drawUserPhotoSlot(
      ctx,
      photoCx,
      photoCy,
      photoSize,
      opts.photoFrame,
      opts.photoImage,
      opts.displayName,
      opts.photoZoom,
      opts.photoOffsetX,
      opts.photoOffsetY,
      palette
    );

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 26px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(opts.displayName.slice(0, 22), photoCx, 412);

    if (opts.showRankBadge && opts.rankTitle) {
      ctx.fillStyle = palette.accentBright;
      ctx.font = '600 17px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(opts.rankTitle.slice(0, 28), photoCx, 444);
    }

    if (opts.showPackageBadge && opts.selectedPackageName) {
      ctx.fillStyle = palette.textMuted;
      ctx.font = '600 14px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(`TIER · ${opts.selectedPackageName.toUpperCase()}`, photoCx, 474);
    }

    // Center-Right Column: Headline + Tagline + Highlights + Referral/QR Strip
    const rightX = 345;
    const rightW = W - rightX - pad;

    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 40px "Plus Jakarta Sans", system-ui, sans-serif';
    const hLines = wrapLines(ctx, displayHeadline, rightW, 2);
    hLines.forEach((line, idx) => {
      ctx.fillText(line, rightX, 146 + idx * 48);
    });

    const subY = 146 + hLines.length * 48 + 14;
    ctx.fillStyle = palette.textMuted;
    ctx.font = '500 20px "Plus Jakarta Sans", system-ui, sans-serif';
    const subLines = wrapLines(ctx, opts.tagline || template.subheadline, rightW, 2);
    subLines.forEach((line, idx) => {
      ctx.fillText(line, rightX, subY + idx * 28);
    });

    const hasHighlights =
      template.category === 'package' ||
      template.category === 'trading' ||
      template.category === 'launchpad';
    if (hasHighlights) {
      drawTemplateHighlightsBar(
        ctx,
        rightX,
        subY + subLines.length * 28 + 18,
        rightW,
        74,
        template,
        opts.packages,
        opts.selectedPackageName,
        opts.coinName,
        palette
      );
    }

    // Bottom Right Referral & QR Bar
    const footerBoxY = 408;
    const footerBoxH = 132;
    drawRoundedRectPath(ctx, rightX, footerBoxY, rightW, footerBoxH, 16);
    ctx.fillStyle = palette.surface;
    ctx.fill();
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const qrBoxSize = 104;
    const textAreaW = qrImg ? rightW - qrBoxSize - 42 : rightW - 36;

    ctx.textAlign = 'left';
    ctx.fillStyle = palette.accentBright;
    ctx.font = '700 14px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(template.ctaText.toUpperCase(), rightX + 22, footerBoxY + 32);

    if (opts.showReferralCode) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 32px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(opts.referralCode, rightX + 22, footerBoxY + 72);
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 22px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(opts.companyName, rightX + 22, footerBoxY + 72);
    }

    ctx.fillStyle = palette.textMuted;
    ctx.font = '500 14px ui-monospace, SFMono-Regular, Menlo, monospace';
    const shortLink = opts.referralLink.replace(/^https?:\/\//, '');
    const linkLine = wrapLines(ctx, shortLink, textAreaW, 1)[0] || shortLink;
    ctx.fillText(linkLine, rightX + 22, footerBoxY + 106);

    if (qrImg) {
      const qx = rightX + rightW - qrBoxSize - 14;
      const qy = footerBoxY + (footerBoxH - qrBoxSize) / 2;
      drawRoundedRectPath(ctx, qx - 5, qy - 5, qrBoxSize + 10, qrBoxSize + 10, 10);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.drawImage(qrImg, qx, qy, qrBoxSize, qrBoxSize);
    }

    // Disclaimer Footer
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
    ctx.font = '500 14px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(opts.disclaimerText, W / 2, H - 42);
    return;
  }

  if (aspectRatio === '9:16') {
    // STORY / STATUS (1080 x 1920)
    const pad = 74;

    // Top Brand Header
    drawBrandEmblem(ctx, W / 2 - 140, 118, 34, palette);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 44px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(opts.companyName, W / 2 - 90, 118);

    // Kicker Line
    ctx.textAlign = 'center';
    ctx.fillStyle = palette.accentBright;
    ctx.font = '700 22px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(template.badgeText.toUpperCase(), W / 2, 206);

    // Headline
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 62px "Plus Jakarta Sans", system-ui, sans-serif';
    const hLines = wrapLines(ctx, displayHeadline, W - pad * 2, 2);
    hLines.forEach((line, idx) => {
      ctx.fillText(line, W / 2, 286 + idx * 74);
    });

    // Subheadline / Tagline
    const subY = 286 + hLines.length * 74 + 26;
    ctx.fillStyle = palette.textMuted;
    ctx.font = '500 28px "Plus Jakarta Sans", system-ui, sans-serif';
    const subLines = wrapLines(ctx, opts.tagline || template.subheadline, W - pad * 2, 3);
    subLines.forEach((line, idx) => {
      ctx.fillText(line, W / 2, subY + idx * 40);
    });

    // Large Centered User Photo
    const photoSize = 370;
    const photoCy = 745;
    drawUserPhotoSlot(
      ctx,
      W / 2,
      photoCy,
      photoSize,
      opts.photoFrame,
      opts.photoImage,
      opts.displayName,
      opts.photoZoom,
      opts.photoOffsetX,
      opts.photoOffsetY,
      palette
    );

    // Name, Rank & Package Badge
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 50px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(opts.displayName.slice(0, 26), W / 2, 1005);

    if (opts.showRankBadge && opts.rankTitle) {
      ctx.fillStyle = palette.accentBright;
      ctx.font = '700 28px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(opts.rankTitle.slice(0, 34), W / 2, 1062);
    }

    if (opts.showPackageBadge && opts.selectedPackageName) {
      ctx.fillStyle = palette.textMuted;
      ctx.font = '600 22px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(`PACKAGE FOCUS · ${opts.selectedPackageName.toUpperCase()}`, W / 2, 1112);
    }

    // Template Highlights Strip (if package/trading/launchpad)
    const hasHighlights =
      template.category === 'package' ||
      template.category === 'trading' ||
      template.category === 'launchpad';
    if (hasHighlights) {
      drawTemplateHighlightsBar(
        ctx,
        pad,
        1170,
        W - pad * 2,
        122,
        template,
        opts.packages,
        opts.selectedPackageName,
        opts.coinName,
        palette
      );
    }

    // Referral & QR Panel at Lower Third
    const boxY = hasHighlights ? 1340 : 1240;
    const boxH = 380;
    drawRoundedRectPath(ctx, pad, boxY, W - pad * 2, boxH, 24);
    ctx.fillStyle = palette.surface;
    ctx.fill();
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (qrImg) {
      const qrSize = 230;
      const qx = W - pad - qrSize - 44;
      const qy = boxY + (boxH - qrSize) / 2;
      drawRoundedRectPath(ctx, qx - 14, qy - 14, qrSize + 28, qrSize + 28, 18);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.drawImage(qrImg, qx, qy, qrSize, qrSize);

      ctx.textAlign = 'left';
      const lx = pad + 44;
      const maxLeftW = qx - lx - 36;
      ctx.fillStyle = palette.accentBright;
      ctx.font = '700 22px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(template.ctaText.toUpperCase(), lx, boxY + 86);

      if (opts.showReferralCode) {
        ctx.fillStyle = palette.textMuted;
        ctx.font = '600 20px "Plus Jakarta Sans", system-ui, sans-serif';
        ctx.fillText('OFFICIAL REFERRAL ID', lx, boxY + 148);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 50px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillText(opts.referralCode, lx, boxY + 210);
      }

      ctx.fillStyle = palette.textMuted;
      ctx.font = '500 20px ui-monospace, SFMono-Regular, Menlo, monospace';
      const shortLink = opts.referralLink.replace(/^https?:\/\//, '');
      const lLines = wrapLines(ctx, shortLink, maxLeftW, 2);
      lLines.forEach((line, idx) => {
        ctx.fillText(line, lx, boxY + 286 + idx * 28);
      });
    } else {
      ctx.textAlign = 'center';
      ctx.fillStyle = palette.accentBright;
      ctx.font = '700 26px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(template.ctaText.toUpperCase(), W / 2, boxY + 95);
      if (opts.showReferralCode) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 62px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillText(opts.referralCode, W / 2, boxY + 195);
      }
      ctx.fillStyle = palette.textMuted;
      ctx.font = '500 22px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(opts.referralLink.replace(/^https?:\/\//, '').slice(0, 48), W / 2, boxY + 295);
    }

    // Compliant Disclaimer Footer
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.82)';
    ctx.font = '500 21px "Plus Jakarta Sans", system-ui, sans-serif';
    const discLines = wrapLines(ctx, opts.disclaimerText, W - pad * 2, 2);
    discLines.forEach((line, idx) => {
      ctx.fillText(line, W / 2, H - 105 + idx * 30);
    });
    return;
  }

  // SQUARE (1:1 — 1080 x 1080)
  const pad = 64;

  // Top Header: Brand Left + Template Kicker Right
  drawBrandEmblem(ctx, pad + 26, 86, 26, palette);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 32px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(opts.companyName, pad + 66, 86);

  ctx.textAlign = 'right';
  ctx.fillStyle = palette.accentBright;
  ctx.font = '700 18px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(template.badgeText.toUpperCase(), W - pad, 86);

  // Subtle horizontal divider under top header
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, 130);
  ctx.lineTo(W - pad, 130);
  ctx.stroke();

  // Hero Split: Photo Left + Headline & User Identity Right
  const isReferralFocus = template.category === 'referral';
  const photoSize = isReferralFocus ? 250 : 284;
  const photoCx = pad + photoSize / 2 + 12;
  const photoCy = 320;

  drawUserPhotoSlot(
    ctx,
    photoCx,
    photoCy,
    photoSize,
    opts.photoFrame,
    opts.photoImage,
    opts.displayName,
    opts.photoZoom,
    opts.photoOffsetX,
    opts.photoOffsetY,
    palette
  );

  const textX = pad + photoSize + 52;
  const textW = W - textX - pad;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 44px "Plus Jakarta Sans", system-ui, sans-serif';
  const sqHeadlines = wrapLines(ctx, displayHeadline, textW, 2);
  sqHeadlines.forEach((line, idx) => {
    ctx.fillText(line, textX, 210 + idx * 54);
  });

  const sqSubY = 210 + sqHeadlines.length * 54 + 18;
  ctx.fillStyle = palette.textMuted;
  ctx.font = '500 22px "Plus Jakarta Sans", system-ui, sans-serif';
  const sqSubLines = wrapLines(ctx, opts.tagline || template.subheadline, textW, 3);
  sqSubLines.forEach((line, idx) => {
    ctx.fillText(line, textX, sqSubY + idx * 32);
  });

  // Member Name & Rank Block directly below tagline
  const nameY = Math.max(412, sqSubY + sqSubLines.length * 32 + 32);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 34px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(opts.displayName.slice(0, 26), textX, nameY);

  if (opts.showRankBadge && opts.rankTitle) {
    ctx.fillStyle = palette.accentBright;
    ctx.font = '700 21px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(opts.rankTitle.slice(0, 34), textX, nameY + 38);
  }

  if (opts.showPackageBadge && opts.selectedPackageName) {
    ctx.fillStyle = palette.textMuted;
    ctx.font = '600 16px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(
      `SELECTED TIER · ${opts.selectedPackageName.toUpperCase()}`,
      textX,
      nameY + (opts.showRankBadge && opts.rankTitle ? 70 : 38)
    );
  }

  // Middle Highlights Strip (for Package / Trading / Launchpad templates)
  const hasHighlights =
    template.category === 'package' ||
    template.category === 'trading' ||
    template.category === 'launchpad';
  if (hasHighlights) {
    drawTemplateHighlightsBar(
      ctx,
      pad,
      540,
      W - pad * 2,
      104,
      template,
      opts.packages,
      opts.selectedPackageName,
      opts.coinName,
      palette
    );
  }

  // Bottom Referral Code & Scannable QR Card
  const bottomBoxY = hasHighlights ? 684 : 584;
  const bottomBoxH = hasHighlights ? 268 : 340;
  drawRoundedRectPath(ctx, pad, bottomBoxY, W - pad * 2, bottomBoxH, 22);
  ctx.fillStyle = palette.surface;
  ctx.fill();
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  const qrSize = hasHighlights ? 196 : 236;
  const innerPad = 36;
  const maxLeftTextW = qrImg ? W - pad * 2 - qrSize - innerPad * 3 : W - pad * 2 - innerPad * 2;

  ctx.textAlign = 'left';
  ctx.fillStyle = palette.accentBright;
  ctx.font = '700 18px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(template.ctaText.toUpperCase(), pad + innerPad, bottomBoxY + 56);

  if (opts.showReferralCode) {
    ctx.fillStyle = palette.textMuted;
    ctx.font = '600 17px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('PERSONAL REFERRAL CODE', pad + innerPad, bottomBoxY + 104);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 ${isReferralFocus ? 56 : 48}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillText(opts.referralCode, pad + innerPad, bottomBoxY + 158);
  } else {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 36px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(opts.companyName, pad + innerPad, bottomBoxY + 132);
  }

  ctx.fillStyle = palette.textMuted;
  ctx.font = '500 17px ui-monospace, SFMono-Regular, Menlo, monospace';
  const cleanUrl = opts.referralLink.replace(/^https?:\/\//, '');
  const urlLines = wrapLines(ctx, cleanUrl, maxLeftTextW, 2);
  urlLines.forEach((line, idx) => {
    ctx.fillText(line, pad + innerPad, bottomBoxY + bottomBoxH - 64 + idx * 24);
  });

  if (qrImg) {
    const qx = W - pad - qrSize - innerPad;
    const qy = bottomBoxY + (bottomBoxH - qrSize) / 2;
    drawRoundedRectPath(ctx, qx - 12, qy - 12, qrSize + 24, qrSize + 24, 16);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.drawImage(qrImg, qx, qy, qrSize, qrSize);
  }

  // Compliant Risk Disclaimer Footer
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
  ctx.font = '500 16px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(opts.disclaimerText, W / 2, H - 52);
}
