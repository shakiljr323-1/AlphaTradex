import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Pause,
  Play,
  RotateCcw,
  Subtitles,
} from 'lucide-react';
import {
  GuideLanguage,
  InvestmentPackage,
  MotionAccentColor,
  MotionSceneBeat,
  MotionVideoCardConfig,
  MotionVisualPreset,
} from '../types/platform';

interface MotionVideoPlayerProps {
  video: MotionVideoCardConfig;
  language: GuideLanguage;
  companyName: string;
  disclaimerText: string;
  packages: InvestmentPackage[];
  presetOverride?: MotionVisualPreset | null;
  localPreviewBlobUrl?: string;
  allowExportWebm?: boolean;
  compact?: boolean;
}

const ACCENT_PALETTES: Record<
  MotionAccentColor,
  { main: string; bright: string; soft: string; glow: string }
> = {
  amber: {
    main: '#F59E0B',
    bright: '#FCD34D',
    soft: 'rgba(245, 158, 11, 0.18)',
    glow: 'rgba(245, 158, 11, 0.28)',
  },
  emerald: {
    main: '#10B981',
    bright: '#34D399',
    soft: 'rgba(16, 185, 129, 0.18)',
    glow: 'rgba(16, 185, 129, 0.28)',
  },
  sky: {
    main: '#0EA5E9',
    bright: '#38BDF8',
    soft: 'rgba(14, 165, 233, 0.18)',
    glow: 'rgba(56, 189, 248, 0.28)',
  },
  violet: {
    main: '#8B5CF6',
    bright: '#C4B5FD',
    soft: 'rgba(139, 92, 246, 0.18)',
    glow: 'rgba(167, 139, 250, 0.26)',
  },
};

function easeOutCubic(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - clamped, 3);
}

function drawRoundedRect(
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

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = `${line} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = words[i];
      if (lines.length >= maxLines - 1) break;
    }
  }
  lines.push(line);
  return lines.slice(0, maxLines);
}

function getEmbedUrl(rawUrl: string): { kind: 'iframe' | 'video'; src: string } | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('blob:')) {
    return { kind: 'video', src: trimmed };
  }
  if (!/^https?:\/\//i.test(trimmed)) return null;

  // YouTube standard / short URLs
  const ytMatch = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/i
  );
  if (ytMatch?.[1]) {
    return {
      kind: 'iframe',
      src: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0&modestbranding=1`,
    };
  }

  // Vimeo URLs
  const vimeoMatch = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeoMatch?.[1]) {
    return {
      kind: 'iframe',
      src: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
    };
  }

  return { kind: 'video', src: trimmed };
}

function drawMotionSceneFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  scene: MotionSceneBeat,
  sceneIndex: number,
  totalScenes: number,
  localProgress: number, // 0..1 within current scene
  elapsedGlobalSec: number,
  companyName: string,
  subtitleText: string,
  showCaptions: boolean,
  packages: InvestmentPackage[],
  presetOverride?: MotionVisualPreset | null
) {
  const accent = ACCENT_PALETTES[scene.accent] || ACCENT_PALETTES.amber;
  const visualType = presetOverride || scene.visualType || 'overview';
  const enter = easeOutCubic(Math.min(1, localProgress / 0.24));

  // 1. Deep institutional obsidian-navy canvas backdrop
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#040814');
  bgGrad.addColorStop(0.55, '#091224');
  bgGrad.addColorStop(1, '#0F1B33');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle architectural dot/line grid drifting slowly
  ctx.save();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
  ctx.lineWidth = 1;
  const gridStep = 64;
  const driftX = (elapsedGlobalSec * 14) % gridStep;
  for (let x = -gridStep + driftX; x < W + gridStep; x += gridStep) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += gridStep) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Ambient soft radial spotlight behind visual stage
  const spotGrad = ctx.createRadialGradient(W * 0.72, H * 0.44, 24, W * 0.72, H * 0.44, 420);
  spotGrad.addColorStop(0, accent.glow);
  spotGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = spotGrad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // 2. Top Brand & Chapter Strip
  const padX = 56;
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(companyName.toUpperCase(), padX, 46);

  ctx.fillStyle = accent.bright;
  ctx.font = '700 14px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(`·  ${scene.title.toUpperCase()}`, padX + ctx.measureText(companyName.toUpperCase()).width + 26, 46);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
  ctx.font = '600 13px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(
    `ILLUSTRATIVE DEMO · SCENE ${sceneIndex + 1} / ${totalScenes}`,
    W - padX,
    46
  );

  // Thin top rule
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, 76);
  ctx.lineTo(W - padX, 76);
  ctx.stroke();
  ctx.restore();

  // 3. Left Column: Kinetic Headline, Metric Highlight & Step Progress
  const leftX = padX;
  const leftW = 540;
  const slideOffset = (1 - enter) * 28;

  ctx.save();
  ctx.globalAlpha = enter;

  // Accent bar indicator
  ctx.fillStyle = accent.main;
  drawRoundedRect(ctx, leftX, 128 + slideOffset, 52, 5, 3);
  ctx.fill();

  // Kinetic Main Headline
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 46px "Plus Jakarta Sans", system-ui, sans-serif';
  const headlineLines = wrapCanvasText(ctx, scene.headline, leftW, 3);
  headlineLines.forEach((ln, idx) => {
    ctx.fillText(ln, leftX, 152 + slideOffset + idx * 56);
  });

  const afterHeadlineY = 152 + slideOffset + headlineLines.length * 56 + 20;

  // Scene sub-copy
  ctx.fillStyle = '#CBD5E1';
  ctx.font = '500 20px "Plus Jakarta Sans", system-ui, sans-serif';
  const bodyLines = wrapCanvasText(ctx, scene.caption, leftW, 3);
  bodyLines.forEach((ln, idx) => {
    ctx.fillText(ln, leftX, afterHeadlineY + idx * 30);
  });

  // Metric Callout Block
  const metricY = Math.max(396, afterHeadlineY + bodyLines.length * 30 + 28);
  drawRoundedRect(ctx, leftX, metricY, 340, 86, 14);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.fill();
  ctx.strokeStyle = accent.main;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = accent.bright;
  ctx.font = '700 12px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(scene.metricLabel.toUpperCase(), leftX + 20, metricY + 18);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 28px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(scene.metricValue, leftX + 20, metricY + 42);
  ctx.restore();

  // 4. Right Column: Animated Domain Motion Graphic Stage
  const stageX = 640;
  const stageY = 112;
  const stageW = W - stageX - padX;
  const stageH = 440;

  ctx.save();
  drawRoundedRect(ctx, stageX, stageY, stageW, stageH, 20);
  ctx.fillStyle = 'rgba(9, 15, 30, 0.86)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (visualType === 'signup') {
    // Animated Account Setup & Verification Card
    const fields = [
      { label: 'FULL NAME & EMAIL', val: 'Verified Account Identity', doneAt: 0.18 },
      { label: 'REFERRAL CODE (OPTIONAL)', val: 'ALPHA-TEAM-REF · Bound', doneAt: 0.42 },
      { label: 'PROFILE & GLOBAL KYC', val: 'Verified & Active', doneAt: 0.68 },
      { label: 'VAULT DASHBOARD', val: 'Instant Access Ready', doneAt: 0.86 },
    ];

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 18px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Account Onboarding Flow', stageX + 30, stageY + 42);

    fields.forEach((f, idx) => {
      const fy = stageY + 84 + idx * 82;
      const reached = localProgress >= f.doneAt;
      const itemAlpha = easeOutCubic(Math.min(1, (localProgress + 0.12 - idx * 0.14) / 0.25));

      ctx.save();
      ctx.globalAlpha = Math.max(0.25, itemAlpha);
      drawRoundedRect(ctx, stageX + 28, fy, stageW - 56, 66, 12);
      ctx.fillStyle = reached ? accent.soft : 'rgba(15, 23, 42, 0.8)';
      ctx.fill();
      ctx.strokeStyle = reached ? accent.main : 'rgba(71, 85, 105, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Check circle
      const cx = stageX + 58;
      const cy = fy + 33;
      ctx.beginPath();
      ctx.arc(cx, cy, 13, 0, Math.PI * 2);
      ctx.fillStyle = reached ? accent.main : 'rgba(51, 65, 85, 0.9)';
      ctx.fill();

      ctx.fillStyle = reached ? '#040814' : '#94A3B8';
      ctx.font = '800 13px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(reached ? '✓' : `${idx + 1}`, cx, cy + 1);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#94A3B8';
      ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(f.label, stageX + 86, fy + 22);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '600 16px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(f.val, stageX + 86, fy + 45);
      ctx.restore();
    });
  } else if (visualType === 'package') {
    // Animated 4-Tier Package Grid + 200-Day Mon–Fri Calendar Bar
    const tiers = (packages.length >= 4
      ? packages.slice(0, 4).map((p) => ({ name: p.name, cap: `$${p.capital.toLocaleString()}` }))
      : [
          { name: 'Starter', cap: '$100' },
          { name: 'Growth', cap: '$300' },
          { name: 'Pro', cap: '$500' },
          { name: 'Elite', cap: '$1,000' },
        ]);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 18px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('Structured Investment Tiers', stageX + 28, stageY + 40);

    const activeTierIdx = Math.floor((localProgress * 4) % 4);
    const cardW = (stageW - 72) / 2;
    const cardH = 92;

    tiers.forEach((tier, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const bx = stageX + 28 + col * (cardW + 16);
      const by = stageY + 74 + row * (cardH + 14);
      const isActive = idx === activeTierIdx;

      drawRoundedRect(ctx, bx, by, cardW, cardH, 14);
      ctx.fillStyle = isActive ? accent.soft : 'rgba(15, 23, 42, 0.85)';
      ctx.fill();
      ctx.strokeStyle = isActive ? accent.bright : 'rgba(71, 85, 105, 0.5)';
      ctx.lineWidth = isActive ? 2 : 1;
      ctx.stroke();

      ctx.fillStyle = isActive ? accent.bright : '#94A3B8';
      ctx.font = '700 12px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(`TIER 0${idx + 1}`, bx + 18, by + 26);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 22px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(tier.name, bx + 18, by + 58);

      ctx.textAlign = 'right';
      ctx.fillStyle = isActive ? accent.bright : '#E2E8F0';
      ctx.font = '800 22px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(tier.cap, bx + cardW - 18, by + 58);
      ctx.textAlign = 'left';
    });

    // Mon-Fri Active / Sat-Sun Off Strip
    const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    const stripY = stageY + 296;
    const dayW = (stageW - 56 - 6 * 8) / 7;
    ctx.fillStyle = '#94A3B8';
    ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText('200 PROFIT-DAY SCHEDULE · MON–FRI ACTIVE · SAT–SUN OFF', stageX + 28, stripY - 12);

    days.forEach((d, idx) => {
      const dx = stageX + 28 + idx * (dayW + 8);
      const isOff = idx >= 5;
      const pulse = !isOff && Math.floor(localProgress * 10) % 5 === idx;
      drawRoundedRect(ctx, dx, stripY + 6, dayW, 46, 8);
      ctx.fillStyle = isOff
        ? 'rgba(30, 41, 59, 0.55)'
        : pulse
        ? accent.main
        : 'rgba(16, 185, 129, 0.16)';
      ctx.fill();
      ctx.strokeStyle = isOff ? 'rgba(71, 85, 105, 0.4)' : 'rgba(52, 211, 153, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = pulse ? '#040814' : isOff ? '#64748B' : '#FFFFFF';
      ctx.font = '700 12px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(d, dx + dayW / 2, stripY + 24);
      ctx.font = '600 9px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(isOff ? 'OFF' : 'ON', dx + dayW / 2, stripY + 41);
    });

    // Elite 70-day Capital Release Bar
    const barY = stageY + 372;
    drawRoundedRect(ctx, stageX + 28, barY, stageW - 56, 44, 10);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.stroke();

    const fillW = Math.max(24, (stageW - 64) * Math.min(1, 0.35 + localProgress * 0.65));
    drawRoundedRect(ctx, stageX + 32, barY + 4, fillW, 36, 8);
    ctx.fillStyle = 'rgba(14, 165, 233, 0.22)';
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#E0F2FE';
    ctx.font = '700 12px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText('ELITE CAPITAL ELIGIBILITY: 70 CALENDAR DAYS', stageX + 44, barY + 22);
  } else if (visualType === 'dashboard') {
    // Animated Portfolio Telemetry + Ledger Lines
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 18px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('Live Dashboard & Ledger Transparency', stageX + 28, stageY + 40);

    // Animated smooth area line chart
    const chartX = stageX + 28;
    const chartY = stageY + 76;
    const chartW = stageW - 56;
    const chartH = 162;

    drawRoundedRect(ctx, chartX, chartY, chartW, chartH, 12);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
    ctx.stroke();

    const pts = [0.68, 0.6, 0.64, 0.5, 0.45, 0.52, 0.38, 0.3, 0.34, 0.22, 0.18];
    const visiblePts = Math.max(2, Math.floor(pts.length * (0.25 + localProgress * 0.75)));

    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < visiblePts; i++) {
      const px = chartX + 18 + (i / (pts.length - 1)) * (chartW - 36);
      const wobble = Math.sin(elapsedGlobalSec * 2 + i) * 3;
      const py = chartY + 22 + pts[i] * (chartH - 44) + wobble;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = accent.bright;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Area fill under curve
    const lastIdx = visiblePts - 1;
    const lastX = chartX + 18 + (lastIdx / (pts.length - 1)) * (chartW - 36);
    ctx.lineTo(lastX, chartY + chartH - 12);
    ctx.lineTo(chartX + 18, chartY + chartH - 12);
    ctx.closePath();
    const areaGrad = ctx.createLinearGradient(0, chartY, 0, chartY + chartH);
    areaGrad.addColorStop(0, accent.soft);
    areaGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = areaGrad;
    ctx.fill();
    ctx.restore();

    // Transparent ledger rows
    const rows = [
      { label: 'AI Package Schedule', tag: 'Mon–Fri Tracking', status: 'Active' },
      { label: 'Market Sentiment & Forex Desk', tag: 'Real-Time Feeds', status: 'Synced' },
      { label: 'Referral & Withdrawal Audit', tag: 'Timestamped Ledger', status: 'Verified' },
    ];
    rows.forEach((r, idx) => {
      const ry = stageY + 258 + idx * 54;
      drawRoundedRect(ctx, chartX, ry, chartW, 44, 10);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '600 14px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(r.label, chartX + 16, ry + 22);

      ctx.textAlign = 'right';
      ctx.fillStyle = accent.bright;
      ctx.font = '700 12px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(`${r.tag} · ${r.status}`, chartX + chartW - 16, ry + 22);
    });
  } else {
    // Overview: 3-Node Connected Flow Diagram with Animated Energy Pulse
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 18px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('3-Step Platform Architecture', stageX + 28, stageY + 40);

    const nodes = [
      { step: '01', title: 'Sign Up & Verify', sub: 'Account + Optional Referral Code' },
      { step: '02', title: 'Fund & Select Package', sub: 'Starter $100 → Elite $1,000 · 200 Days' },
      { step: '03', title: 'Track & Manage Live', sub: 'AI Tools · Referrals · Wallet Ledger' },
    ];

    // Vertical connecting rail
    const railX = stageX + 66;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(railX, stageY + 120);
    ctx.lineTo(railX, stageY + 356);
    ctx.stroke();

    // Animated progress beam along rail
    const beamH = (356 - 120) * localProgress;
    ctx.strokeStyle = accent.main;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(railX, stageY + 120);
    ctx.lineTo(railX, stageY + 120 + beamH);
    ctx.stroke();

    nodes.forEach((n, idx) => {
      const ny = stageY + 86 + idx * 116;
      const isLit = localProgress >= idx * 0.3;

      drawRoundedRect(ctx, stageX + 102, ny, stageW - 130, 84, 14);
      ctx.fillStyle = isLit ? accent.soft : 'rgba(15, 23, 42, 0.85)';
      ctx.fill();
      ctx.strokeStyle = isLit ? accent.main : 'rgba(71, 85, 105, 0.5)';
      ctx.lineWidth = isLit ? 2 : 1;
      ctx.stroke();

      // Node circle
      ctx.beginPath();
      ctx.arc(railX, ny + 42, 22, 0, Math.PI * 2);
      ctx.fillStyle = isLit ? accent.main : '#1E293B';
      ctx.fill();
      ctx.fillStyle = isLit ? '#040814' : '#94A3B8';
      ctx.font = '800 15px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(n.step, railX, ny + 43);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 18px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(n.title, stageX + 122, ny + 32);

      ctx.fillStyle = '#CBD5E1';
      ctx.font = '500 14px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(n.sub, stageX + 122, ny + 58);
    });
  }
  ctx.restore();

  // 5. Subtitle / Closed Captions Scrim Bar (Bottom)
  if (showCaptions && subtitleText) {
    const capH = 74;
    const capY = H - capH - 42;
    drawRoundedRect(ctx, padX, capY, W - padX * 2, capH, 12);
    ctx.fillStyle = 'rgba(3, 7, 18, 0.88)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '600 19px "Plus Jakarta Sans", system-ui, sans-serif';
    const subLines = wrapCanvasText(ctx, subtitleText, W - padX * 2 - 48, 2);
    if (subLines.length === 1) {
      ctx.fillText(subLines[0], W / 2, capY + capH / 2);
    } else {
      ctx.fillText(subLines[0], W / 2, capY + capH / 2 - 13);
      ctx.fillText(subLines[1], W / 2, capY + capH / 2 + 13);
    }
  }

  // 6. Bottom Scene Progress Segments & Compliance Footer
  const barY = H - 22;
  const segGap = 8;
  const totalBarW = W - padX * 2;
  const segW = (totalBarW - segGap * (totalScenes - 1)) / Math.max(1, totalScenes);

  for (let i = 0; i < totalScenes; i++) {
    const sx = padX + i * (segW + segGap);
    drawRoundedRect(ctx, sx, barY, segW, 5, 3);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.fill();

    const fillRatio = i < sceneIndex ? 1 : i === sceneIndex ? localProgress : 0;
    if (fillRatio > 0) {
      drawRoundedRect(ctx, sx, barY, Math.max(6, segW * fillRatio), 5, 3);
      ctx.fillStyle = accent.main;
      ctx.fill();
    }
  }
}

export const MotionVideoPlayer: React.FC<MotionVideoPlayerProps> = ({
  video,
  language,
  companyName,
  disclaimerText,
  packages,
  presetOverride = null,
  localPreviewBlobUrl = '',
  allowExportWebm = false,
  compact = false,
}) => {
  const scenes = useMemo(() => {
    if (Array.isArray(video.scenes) && video.scenes.length > 0) return video.scenes;
    return [
      {
        title: '01 · Overview',
        headline: video.title[language] || video.title.en,
        caption: video.caption[language] || video.caption.en,
        metricLabel: 'GUIDE',
        metricValue: 'Step Walkthrough',
        durationSec: 5,
        accent: 'amber' as MotionAccentColor,
        visualType: video.visualPreset || 'overview',
      },
    ];
  }, [video, language]);

  const totalDurationSec = useMemo(
    () => scenes.reduce((sum, s) => sum + Math.max(2, s.durationSec || 4.5), 0),
    [scenes]
  );

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [showCaptions, setShowCaptions] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(1);
  const [recording, setRecording] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const elapsedRef = useRef<number>(0);
  const lastTsRef = useRef<number | null>(null);

  const customMedia = useMemo(() => {
    const candidate = localPreviewBlobUrl || video.customVideoUrl || '';
    return getEmbedUrl(candidate);
  }, [localPreviewBlobUrl, video.customVideoUrl]);

  // Respect prefers-reduced-motion on initial load
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setIsPlaying(false);
    }
  }, []);

  // Reset timeline cleanly when switching videos
  useEffect(() => {
    elapsedRef.current = 0;
    setElapsedSec(0);
    lastTsRef.current = null;
  }, [video.id, presetOverride]);

  const getSceneStateAt = useCallback(
    (sec: number) => {
      let acc = 0;
      for (let i = 0; i < scenes.length; i++) {
        const dur = Math.max(2, scenes[i].durationSec || 4.5);
        if (sec < acc + dur || i === scenes.length - 1) {
          const localProgress = Math.max(0, Math.min(1, (sec - acc) / dur));
          return { sceneIndex: i, scene: scenes[i], localProgress };
        }
        acc += dur;
      }
      return { sceneIndex: 0, scene: scenes[0], localProgress: 0 };
    },
    [scenes]
  );

  const { sceneIndex: activeSceneIdx, scene: activeScene } = getSceneStateAt(elapsedSec);

  // Resolve caption subtitle: show localized video caption on scene 0 or non-EN languages, else scene caption
  const resolveSubtitle = useCallback(
    (sc: MotionSceneBeat, idx: number): string => {
      if (language !== 'en' && idx === 0 && video.caption[language]) {
        return video.caption[language];
      }
      if (language !== 'en' && video.caption[language]) {
        return `${sc.title}: ${video.caption[language]}`;
      }
      return sc.caption || video.caption[language] || video.caption.en;
    },
    [language, video.caption]
  );

  // 60fps Canvas Render Loop (only when using built-in motion canvas)
  useEffect(() => {
    if (customMedia) return;
    let rafId = 0;

    const tick = (now: number) => {
      if (isPlaying) {
        if (lastTsRef.current === null) lastTsRef.current = now;
        const deltaSec = Math.min(0.1, (now - lastTsRef.current) / 1000) * speed;
        lastTsRef.current = now;
        let next = elapsedRef.current + deltaSec;
        if (next >= totalDurationSec) next = next % totalDurationSec;
        elapsedRef.current = next;
        setElapsedSec(next);
      } else {
        lastTsRef.current = null;
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const { sceneIndex, scene, localProgress } = getSceneStateAt(elapsedRef.current);
          drawMotionSceneFrame(
            ctx,
            canvas.width,
            canvas.height,
            scene,
            sceneIndex,
            scenes.length,
            localProgress,
            elapsedRef.current,
            companyName,
            resolveSubtitle(scene, sceneIndex),
            showCaptions,
            packages,
            presetOverride
          );
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [
    companyName,
    customMedia,
    getSceneStateAt,
    isPlaying,
    packages,
    presetOverride,
    resolveSubtitle,
    scenes.length,
    showCaptions,
    speed,
    totalDurationSec,
  ]);

  const jumpToScene = (targetIdx: number) => {
    const safeIdx = Math.max(0, Math.min(scenes.length - 1, targetIdx));
    let acc = 0;
    for (let i = 0; i < safeIdx; i++) {
      acc += Math.max(2, scenes[i].durationSec || 4.5);
    }
    elapsedRef.current = acc;
    setElapsedSec(acc);
  };

  const handleScrub = (valSec: number) => {
    const clamped = Math.max(0, Math.min(totalDurationSec - 0.01, valSec));
    elapsedRef.current = clamped;
    setElapsedSec(clamped);
  };

  const handleExportWebm = () => {
    const canvas = canvasRef.current;
    if (!canvas || typeof MediaRecorder === 'undefined' || !canvas.captureStream) {
      setExportNotice('WebM recording is not supported in this browser.');
      return;
    }
    try {
      setExportNotice('');
      setRecording(true);
      elapsedRef.current = 0;
      setElapsedSec(0);
      setIsPlaying(true);

      const stream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${video.id || 'alphatradex-guide'}-motion.webm`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setRecording(false);
        setExportNotice('Motion video exported (.webm).');
      };

      recorder.start();
      const recordMs = Math.min(20_000, Math.round((totalDurationSec / speed) * 1000));
      window.setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop();
      }, recordMs);
    } catch {
      setRecording(false);
      setExportNotice('Could not start WebM export.');
    }
  };

  return (
    <div className="rounded-2xl bg-[#070D19] border border-slate-700/75 overflow-hidden shadow-2xl">
      {/* Player Stage (16:9) */}
      <div className="relative aspect-video w-full bg-[#040814]">
        {customMedia ? (
          customMedia.kind === 'iframe' ? (
            <iframe
              src={customMedia.src}
              title={video.title[language] || video.title.en}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              src={customMedia.src}
              controls
              playsInline
              className="w-full h-full object-contain bg-black"
            />
          )
        ) : (
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            className="w-full h-full block"
          />
        )}
      </div>

      {/* Controls Bar (for built-in Motion Canvas) */}
      {!customMedia && (
        <div className={`px-4 ${compact ? 'py-3' : 'py-3.5'} bg-[#0A1120] border-t border-slate-800 space-y-3`}>
          {/* Timeline Scrubber */}
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-slate-400 tabular-nums w-10">
              0:{Math.floor(elapsedSec).toString().padStart(2, '0')}
            </span>
            <input
              type="range"
              min={0}
              max={totalDurationSec}
              step={0.05}
              value={elapsedSec}
              onChange={(e) => handleScrub(Number(e.target.value))}
              aria-label="Motion video timeline"
              className="flex-1 accent-amber-400 cursor-pointer"
            />
            <span className="font-mono text-[11px] text-slate-400 tabular-nums w-10 text-right">
              0:{Math.round(totalDurationSec).toString().padStart(2, '0')}
            </span>
          </div>

          {/* Playback Buttons & Scene Stepper */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsPlaying((p) => !p)}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 transition"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {isPlaying ? 'Pause' : 'Play'}
              </button>

              <button
                type="button"
                onClick={() => jumpToScene(activeSceneIdx - 1)}
                disabled={activeSceneIdx === 0}
                aria-label="Previous scene"
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-700 text-slate-200 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => jumpToScene(activeSceneIdx + 1)}
                disabled={activeSceneIdx >= scenes.length - 1}
                aria-label="Next scene"
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-700 text-slate-200 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  elapsedRef.current = 0;
                  setElapsedSec(0);
                  setIsPlaying(true);
                }}
                aria-label="Restart motion video"
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                {activeScene?.title}
              </span>

              <button
                type="button"
                onClick={() => setShowCaptions((c) => !c)}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 transition ${
                  showCaptions
                    ? 'bg-slate-800 border-amber-400/60 text-amber-300'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Subtitles className="w-3.5 h-3.5" />
                CC {showCaptions ? 'On' : 'Off'}
              </button>

              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                aria-label="Playback speed"
                className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200"
              >
                <option value={0.8}>0.8×</option>
                <option value={1}>1.0×</option>
                <option value={1.25}>1.25×</option>
              </select>

              {allowExportWebm && (
                <button
                  type="button"
                  disabled={recording}
                  onClick={handleExportWebm}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/45 text-emerald-300 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  {recording ? 'Recording WebM...' : 'Export WebM'}
                </button>
              )}
            </div>
          </div>

          {exportNotice && (
            <div className="text-[11px] text-emerald-300 font-medium">{exportNotice}</div>
          )}
        </div>
      )}

      {/* Compliance & Illustrative Demo Label Footer */}
      <div className="px-4 py-2.5 bg-[#060A14] border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11px] text-slate-400">
        <span>
          <strong className="text-slate-200">
            {video.isDemoVisual ? 'Demo / Preview Motion Guide:' : 'Official Tutorial:'}
          </strong>{' '}
          {disclaimerText}
        </span>
        {video.aiUpdatedAtIso && (
          <span className="font-mono text-[10px] text-slate-500 shrink-0">
            Storyboard synced {new Date(video.aiUpdatedAtIso).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
};
