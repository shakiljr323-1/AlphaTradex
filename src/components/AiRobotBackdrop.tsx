import React, { useEffect, useRef } from 'react';

interface Candle {
  open: number;
  close: number;
  high: number;
  low: number;
  signal?: 'BUY' | 'SELL' | null;
}

interface PulsePacket {
  t: number;
  speed: number;
  targetIdx: number;
  color: string;
}

/**
 * Full-screen institutional AI Trading Robot live execution backdrop.
 * Renders continuous candlestick streams, EMA ribbons, neural orderflow vectors,
 * and a geometric cybernetic AI Trading Robot HUD actively routing trades.
 */
export const AiRobotBackdrop: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    // Initialize realistic OHLC candles spanning full viewport
    const candleCount = 78;
    const candles: Candle[] = [];
    let lastClose = 0.52;
    for (let i = 0; i < candleCount; i++) {
      const drift = (Math.sin(i * 0.31) * 0.035) + (Math.random() - 0.48) * 0.055;
      const open = lastClose;
      const close = Math.max(0.22, Math.min(0.84, open + drift));
      const high = Math.min(0.9, Math.max(open, close) + Math.random() * 0.04);
      const low = Math.max(0.16, Math.min(open, close) - Math.random() * 0.04);
      const signal =
        i % 13 === 4 ? 'BUY' : i % 17 === 9 ? 'SELL' : null;
      candles.push({ open, close, high, low, signal });
      lastClose = close;
    }

    const packets: PulsePacket[] = Array.from({ length: 14 }, (_, idx) => ({
      t: Math.random(),
      speed: 0.0045 + Math.random() * 0.004,
      targetIdx: Math.floor(((idx + 1) / 15) * (candleCount - 4)),
      color: idx % 2 === 0 ? '#F97316' : '#10B981',
    }));

    let scrollOffset = 0;
    let tickCounter = 0;
    let animId = 0;

    const drawRobotCore = (time: number, cx: number, cy: number, scale: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);

      const breathe = Math.sin(time * 0.0018) * 3;
      const scanX = Math.sin(time * 0.0026) * 36;

      // Outer orbital targeting rings behind AI Robot
      ctx.save();
      ctx.rotate(time * 0.00025);
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.20)';
      ctx.lineWidth = 1.25;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      ctx.arc(0, -10, 178, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.rotate(-time * 0.00035);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 12]);
      ctx.beginPath();
      ctx.arc(0, -10, 218, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Subtle holographic aura behind torso
      const coreGlow = ctx.createRadialGradient(0, 0, 10, 0, 0, 210);
      coreGlow.addColorStop(0, 'rgba(249, 115, 22, 0.17)');
      coreGlow.addColorStop(0.45, 'rgba(56, 189, 248, 0.08)');
      coreGlow.addColorStop(1, 'rgba(5, 9, 20, 0)');
      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(0, 0, 210, 0, Math.PI * 2);
      ctx.fill();

      // Torso armor chassis
      ctx.save();
      ctx.translate(0, breathe);

      // Shoulders & cybernetic chest frame
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.36)';
      ctx.fillStyle = 'rgba(11, 17, 30, 0.72)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-76, -16);
      ctx.lineTo(-104, 14);
      ctx.lineTo(-82, 92);
      ctx.lineTo(-42, 122);
      ctx.lineTo(42, 122);
      ctx.lineTo(82, 92);
      ctx.lineTo(104, 14);
      ctx.lineTo(76, -16);
      ctx.lineTo(34, -26);
      ctx.lineTo(-34, -26);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner shoulder armor lines
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.42)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-64, -2);
      ctx.lineTo(-30, 28);
      ctx.lineTo(30, 28);
      ctx.lineTo(64, -2);
      ctx.stroke();

      // Neural Chest Reactor Core (pulsing orange/emerald)
      const pulseR = 22 + Math.sin(time * 0.004) * 3;
      const reactorGrad = ctx.createRadialGradient(0, 56, 2, 0, 56, pulseR * 1.8);
      reactorGrad.addColorStop(0, 'rgba(249, 115, 22, 0.95)');
      reactorGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.32)');
      reactorGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
      ctx.fillStyle = reactorGrad;
      ctx.beginPath();
      ctx.arc(0, 56, pulseR * 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(249, 115, 22, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 56, 18, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 56, 10, 0, Math.PI * 2);
      ctx.stroke();

      // Left & Right Articulated Trading Arms extending to holographic execution terminals
      const drawArm = (dir: -1 | 1) => {
        const elbowX = dir * 136;
        const elbowY = 48 + Math.sin(time * 0.0022 + dir) * 5;
        const handX = dir * 188;
        const handY = 14 + Math.cos(time * 0.0028 + dir) * 6;

        ctx.strokeStyle = 'rgba(148, 163, 184, 0.38)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(dir * 92, 14);
        ctx.lineTo(elbowX, elbowY);
        ctx.lineTo(handX, handY);
        ctx.stroke();

        // Joint nodes
        ctx.fillStyle = '#0B111E';
        ctx.strokeStyle = dir === -1 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(249, 115, 22, 0.8)';
        ctx.lineWidth = 1.8;
        [
          [elbowX, elbowY, 7],
          [handX, handY, 9],
        ].forEach(([jx, jy, jr]) => {
          ctx.beginPath();
          ctx.arc(jx, jy, jr, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });

        // Holographic mini execution console above each robotic hand
        const cardX = handX - 42;
        const cardY = handY - 64;
        ctx.fillStyle = 'rgba(11, 17, 30, 0.78)';
        ctx.strokeStyle = dir === -1 ? 'rgba(16, 185, 129, 0.45)' : 'rgba(249, 115, 22, 0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, 84, 42, 6);
        ctx.fill();
        ctx.stroke();

        ctx.font = '600 9px "JetBrains Mono", monospace';
        ctx.fillStyle = dir === -1 ? '#34D399' : '#FB923C';
        ctx.fillText(dir === -1 ? 'AI LONG +2.3%' : 'EXEC SOL/USDT', cardX + 7, cardY + 16);

        // Mini sparkline inside hand console
        ctx.strokeStyle = dir === -1 ? '#10B981' : '#F97316';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let s = 0; s <= 6; s++) {
          const sx = cardX + 8 + s * 11;
          const sy = cardY + 31 - Math.sin(time * 0.004 + s * 0.9 + dir) * 6;
          if (s === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      };

      drawArm(-1);
      drawArm(1);

      // Neck piston struts
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-16, -26);
      ctx.lineTo(-12, -46);
      ctx.moveTo(16, -26);
      ctx.lineTo(12, -46);
      ctx.stroke();

      // Cybernetic Head & Visor
      ctx.fillStyle = 'rgba(13, 21, 38, 0.85)';
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.48)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-40, -118);
      ctx.lineTo(40, -118);
      ctx.lineTo(54, -92);
      ctx.lineTo(44, -46);
      ctx.lineTo(-44, -46);
      ctx.lineTo(-54, -92);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Side neural antennas
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-54, -92);
      ctx.lineTo(-64, -96);
      ctx.lineTo(-64, -124);
      ctx.moveTo(54, -92);
      ctx.lineTo(64, -96);
      ctx.lineTo(64, -124);
      ctx.stroke();

      // Glowing Optical Visor Band
      ctx.fillStyle = 'rgba(6, 12, 24, 0.95)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(-40, -98, 80, 22, 6);
      ctx.fill();
      ctx.stroke();

      // Dual Cybernetic Optic Eyes + Sweeping Laser Scanner
      const opticGrad = ctx.createRadialGradient(scanX, -87, 1, scanX, -87, 24);
      opticGrad.addColorStop(0, 'rgba(249, 115, 22, 0.95)');
      opticGrad.addColorStop(0.45, 'rgba(56, 189, 248, 0.55)');
      opticGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = opticGrad;
      ctx.beginPath();
      ctx.arc(scanX, -87, 24, 0, Math.PI * 2);
      ctx.fill();

      // Crisp Left & Right Optical Nodes
      [-18, 18].forEach((ex) => {
        ctx.fillStyle = '#FB923C';
        ctx.beginPath();
        ctx.roundRect(ex - 8, -90, 16, 6, 3);
        ctx.fill();
      });

      ctx.restore();
      ctx.restore();
    };

    const drawFrame = (time: number) => {
      ctx.clearRect(0, 0, width, height);

      // 1. Deep Obsidian Institutional Base
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#050812');
      bgGrad.addColorStop(0.55, '#081021');
      bgGrad.addColorStop(1, '#04070F');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Subtle Quantitative Terminal Grid
      const gridSize = 48;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.045)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // 3. Scroll & Spawn Live Candles
      if (!prefersReducedMotion) {
        scrollOffset += 0.55;
        tickCounter += 1;
        if (scrollOffset >= width / (candleCount - 6)) {
          scrollOffset = 0;
          const prev = candles[candles.length - 1];
          const open = prev.close;
          const wave = Math.sin(tickCounter * 0.04) * 0.025;
          const close = Math.max(0.22, Math.min(0.84, open + wave + (Math.random() - 0.48) * 0.055));
          const high = Math.min(0.9, Math.max(open, close) + Math.random() * 0.038);
          const low = Math.max(0.16, Math.min(open, close) - Math.random() * 0.038);
          const signal =
            Math.random() > 0.9 ? (close >= open ? 'BUY' : 'SELL') : null;
          candles.shift();
          candles.push({ open, close, high, low, signal });
        }
      }

      // Chart Band across lower 58% of full screen
      const chartTop = height * 0.34;
      const chartHeight = height * 0.58;
      const stepX = width / (candleCount - 8);
      const candleWidth = Math.max(5, Math.min(11, stepX * 0.52));

      const toY = (val: number) => chartTop + chartHeight * (1 - val);

      // 4. AI Robot Centerpiece Position
      const robotCx = width * 0.5;
      const robotCy = height * 0.44;
      const robotScale = Math.max(0.75, Math.min(1.22, Math.min(width, height) / 760));

      // 5. Draw Neural Execution Vectors connecting AI Robot Core -> Active Candles
      packets.forEach((pkt) => {
        if (!prefersReducedMotion) {
          pkt.t += pkt.speed;
          if (pkt.t >= 1) {
            pkt.t = 0;
            pkt.targetIdx = 4 + Math.floor(Math.random() * (candleCount - 10));
          }
        }
        const c = candles[pkt.targetIdx];
        if (!c) return;
        const tx = pkt.targetIdx * stepX - scrollOffset;
        const ty = toY(c.close);

        ctx.strokeStyle =
          pkt.color === '#F97316' ? 'rgba(249, 115, 22, 0.09)' : 'rgba(16, 185, 129, 0.09)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(robotCx, robotCy + 42 * robotScale);
        ctx.quadraticCurveTo(
          (robotCx + tx) * 0.5,
          robotCy - 35,
          tx,
          ty
        );
        ctx.stroke();

        // Traveling glowing order packet
        const u = pkt.t;
        const inv = 1 - u;
        const ctrlX = (robotCx + tx) * 0.5;
        const ctrlY = robotCy - 35;
        const px = inv * inv * robotCx + 2 * inv * u * ctrlX + u * u * tx;
        const py = inv * inv * (robotCy + 42 * robotScale) + 2 * inv * u * ctrlY + u * u * ty;

        ctx.fillStyle = pkt.color;
        ctx.beginPath();
        ctx.arc(px, py, 2.3, 0, Math.PI * 2);
        ctx.fill();
      });

      // 6. Draw Candlestick Stream
      candles.forEach((c, idx) => {
        const x = idx * stepX - scrollOffset;
        if (x < -20 || x > width + 20) return;

        const isBull = c.close >= c.open;
        const yHigh = toY(c.high);
        const yLow = toY(c.low);
        const yOpen = toY(c.open);
        const yClose = toY(c.close);
        const bodyTop = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(3, Math.abs(yClose - yOpen));

        ctx.strokeStyle = isBull ? 'rgba(16, 185, 129, 0.42)' : 'rgba(249, 115, 22, 0.38)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(x, yHigh);
        ctx.lineTo(x, yLow);
        ctx.stroke();

        ctx.fillStyle = isBull ? 'rgba(16, 185, 129, 0.28)' : 'rgba(249, 115, 22, 0.26)';
        ctx.strokeStyle = isBull ? 'rgba(52, 211, 153, 0.55)' : 'rgba(251, 146, 60, 0.5)';
        ctx.lineWidth = 1;
        ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
        ctx.strokeRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);

        if (c.signal) {
          ctx.fillStyle = c.signal === 'BUY' ? 'rgba(16, 185, 129, 0.85)' : 'rgba(249, 115, 22, 0.85)';
          ctx.beginPath();
          ctx.arc(x, c.signal === 'BUY' ? yLow + 10 : yHigh - 10, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // 7. Smooth Algorithmic EMA Trendline Ribbon
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      candles.forEach((c, idx) => {
        const x = idx * stepX - scrollOffset;
        const y = toY(c.close * 0.92 + 0.04);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      ctx.strokeStyle = 'rgba(249, 115, 22, 0.42)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      candles.forEach((c, idx) => {
        const x = idx * stepX - scrollOffset;
        const y = toY(c.open * 0.88 + 0.08);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // 8. Geometric AI Trading Robot HUD
      drawRobotCore(time, robotCx, robotCy, robotScale);

      if (!prefersReducedMotion) {
        animId = requestAnimationFrame(drawFrame);
      }
    };

    animId = requestAnimationFrame(drawFrame);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#050812]"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Subtle corner HUD telemetry labels so AI robot trading context is unmistakable */}
      <div className="hidden lg:flex items-center justify-between absolute bottom-4 left-6 right-6 text-[10px] font-mono tracking-widest uppercase text-slate-500/70 select-none">
        <span>ALPHATRADEX NEURAL BOT v4.2 · LIVE EXECUTION ENGINE</span>
        <span>MON–FRI ALGORITHMIC ROUTING · USDT / SOL SETTLEMENT</span>
      </div>
    </div>
  );
};
