import React, { useEffect, useId, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { ArrowUpRight, Bot, Coins, Globe, ShieldCheck, Target, Users } from 'lucide-react';
import { NavSection } from '../types/platform';

export interface AlphatradexLogo3DProps {
  variant?: 'mark' | 'badge' | 'hero';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  companyName?: string;
  companyGoal?: string;
  tokenTicker?: string;
  onSelectFeature?: (section: NavSection) => void;
  className?: string;
}

const SIZE_MAP: Record<NonNullable<AlphatradexLogo3DProps['size']>, string> = {
  xs: 'w-7 h-7',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

const _targetQuat = new THREE.Quaternion();
const _targetEuler = new THREE.Euler();

function createPrecisionDialTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;

    const bg = ctx.createRadialGradient(cx, cy, 24, cx, cy, 250);
    bg.addColorStop(0, '#131d33');
    bg.addColorStop(0.6, '#09101f');
    bg.addColorStop(1, '#04070e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    // Subtle polar quantitative grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
    ctx.lineWidth = 1.2;
    [84, 132, 182, 224].forEach((r) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // 60 precision market clock ticks
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
      const isMajor = i % 5 === 0;
      const rIn = isMajor ? 198 : 210;
      const rOut = 222;
      ctx.strokeStyle = isMajor ? 'rgba(251, 191, 36, 0.85)' : 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = isMajor ? 2.5 : 1.2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn);
      ctx.lineTo(cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut);
      ctx.stroke();
    }

    // Subtle directional crosshairs
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 170, cy);
    ctx.lineTo(cx + 170, cy);
    ctx.moveTo(cx, cy - 170);
    ctx.lineTo(cx, cy + 170);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size / 2;
    const grad = ctx.createRadialGradient(cx, cx, 8, cx, cx, cx);
    grad.addColorStop(0, 'rgba(245, 158, 11, 0.34)');
    grad.addColorStop(0.42, 'rgba(16, 185, 129, 0.14)');
    grad.addColorStop(0.75, 'rgba(2, 6, 23, 0.25)');
    grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Isometric 3D metallic crest SVG (zero WebGL context overhead for navbars, sidebars, badges).
 * Visualizes: Hexagonal Crypto Vault + Ascending Trading Candlesticks + Breakout Vector + AI Node + Orbital Ring.
 */
export const AlphatradexCrestMark: React.FC<{
  sizeClass?: string;
  companyName?: string;
  className?: string;
}> = ({ sizeClass = 'w-10 h-10', companyName = 'Alphatradex', className = '' }) => {
  const uid = useId().replace(/:/g, '');
  const goldGrad = `atx-gold-${uid}`;
  const goldDarkGrad = `atx-gold-dark-${uid}`;
  const obsidianGrad = `atx-obs-${uid}`;
  const rimGrad = `atx-rim-${uid}`;
  const emeraldGrad = `atx-em-${uid}`;
  const cyberGrad = `atx-cy-${uid}`;
  const glowId = `atx-glow-${uid}`;

  return (
    <span
      className={`relative inline-flex items-center justify-center shrink-0 select-none group ${sizeClass} ${className}`}
      aria-hidden="true"
      title={`${companyName} — AI Trading · Forex · Token Mining · Vault`}
    >
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_6px_16px_rgba(245,158,11,0.42)] transition-transform duration-300 group-hover:scale-105"
      >
        <defs>
          <linearGradient id={obsidianGrad} x1="10" y1="6" x2="54" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="45%" stopColor="#0B1222" />
            <stop offset="100%" stopColor="#030712" />
          </linearGradient>
          <linearGradient id={rimGrad} x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="32%" stopColor="#F59E0B" />
            <stop offset="72%" stopColor="#EA580C" />
            <stop offset="100%" stopColor="#78350F" />
          </linearGradient>
          <linearGradient id={goldGrad} x1="16" y1="12" x2="48" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FEF9C3" />
            <stop offset="35%" stopColor="#FBBF24" />
            <stop offset="78%" stopColor="#F97316" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <linearGradient id={goldDarkGrad} x1="28" y1="16" x2="48" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#7C2D12" />
          </linearGradient>
          <linearGradient id={emeraldGrad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6EE7B7" />
            <stop offset="55%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <linearGradient id={cyberGrad} x1="22" y1="8" x2="48" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7DD3FC" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
          <filter id={glowId} x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="1.25" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Extruded 3D bottom shadow bevel */}
        <path
          d="M32 5.5L55 18.8V45.2L32 58.5L9 45.2V18.8L32 5.5Z"
          fill="#020617"
          transform="translate(0, 2.4)"
          opacity="0.78"
        />

        {/* Chamfered outer 24K metallic gold vault shield */}
        <path
          d="M32 4L55.5 17.5V44.5L32 58L8.5 44.5V17.5L32 4Z"
          fill={`url(#${rimGrad})`}
        />

        {/* Inner recessed obsidian prism vault chamber */}
        <path
          d="M32 7.2L52.6 19.1V42.9L32 54.8L11.4 42.9V19.1L32 7.2Z"
          fill={`url(#${obsidianGrad})`}
        />

        {/* Upper-left glass prism specular reflection */}
        <path
          d="M32 7.2L52.6 19.1L32 30.8L11.4 19.1L32 7.2Z"
          fill="#FFFFFF"
          opacity="0.065"
        />

        {/* Subtle inner precision vault ring */}
        <circle
          cx="32"
          cy="31"
          r="17.2"
          stroke="#F59E0B"
          strokeOpacity="0.22"
          strokeWidth="1"
          strokeDasharray="2.5 3.2"
        />

        {/* 3 Ascending Trading Candlesticks (Forex & Quant Growth Signal) */}
        <g>
          {/* Candle 1 (left, emerald) */}
          <line x1="24.5" y1="32" x2="24.5" y2="43.5" stroke="#34D399" strokeWidth="1.2" strokeLinecap="round" />
          <rect x="22.6" y="34.8" width="3.8" height="6.2" rx="0.9" fill={`url(#${emeraldGrad})`} />

          {/* Candle 2 (center, emerald) */}
          <line x1="32" y1="25" x2="32" y2="41.5" stroke="#6EE7B7" strokeWidth="1.3" strokeLinecap="round" />
          <rect x="30" y="28.2" width="4" height="9.4" rx="0.9" fill={`url(#${emeraldGrad})`} />

          {/* Candle 3 (right, breakout gold/emerald) */}
          <line x1="39.5" y1="19.5" x2="39.5" y2="38" stroke="#FDE047" strokeWidth="1.3" strokeLinecap="round" />
          <rect x="37.5" y="22.2" width="4" height="10.8" rx="0.9" fill={`url(#${goldGrad})`} />
        </g>

        {/* 3D Extruded "A" Vault Arch Shadow Depth */}
        <path
          d="M32 14.2L45.2 45.2H39.4L36.5 38.2H27.5L24.6 45.2H18.8L32 14.2ZM32 22.8L29.1 32.6H34.9L32 22.8Z"
          fill={`url(#${goldDarkGrad})`}
          transform="translate(1.3, 1.8)"
          opacity="0.92"
        />

        {/* Primary 24K Brushed Gold "A" Vault Arch */}
        <path
          d="M32 14.2L45.2 45.2H39.4L36.5 38.2H27.5L24.6 45.2H18.8L32 14.2ZM32 22.8L29.1 32.6H34.9L32 22.8Z"
          fill={`url(#${goldGrad})`}
          filter={`url(#${glowId})`}
        />

        {/* Upward Breakout Market Vector Arrow cutting across */}
        <path
          d="M17.5 37.8L28.5 29.8L34.2 32.6L46.8 18.4"
          stroke="#38BDF8"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M42.2 18.2L47.3 17.8L46.5 22.9"
          stroke="#7DD3FC"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Orbital gyro ring accent (Token + Global Ecosystem) */}
        <ellipse
          cx="32"
          cy="31"
          rx="24.2"
          ry="8.4"
          transform="rotate(-24 32 31)"
          stroke={`url(#${goldGrad})`}
          strokeWidth="1.4"
          strokeOpacity="0.72"
        />

        {/* AI Neural Core Apex Gem */}
        <polygon
          points="32,8.8 35.2,12 32,15.2 28.8,12"
          fill={`url(#${cyberGrad})`}
          stroke="#E0F2FE"
          strokeWidth="0.6"
        />
      </svg>
    </span>
  );
};

/**
 * Interactive WebGL 3D Alphatradex Emblem for Home Hero showcase.
 * Composite 10-part kinetic sculpture:
 * - Precision machined chronograph dial + beveled obsidian hex vault
 * - Brushed 24K gold hexagonal bezel + 6 titanium locking bolts (InstancedMesh)
 * - Sculpted 3D "A" Vault Arch + 3 glowing emerald/gold ascending trading candlesticks
 * - Extruded golden upward breakout trajectory arrow + Sapphire AI Neural apex core
 * - Twin counter-rotating orbital gyroscopes with 4 domain satellites (ATX Coin, AI Core, Forex Globe, Vault Prism)
 * - Soft radial studio contact shadow + drag/hover damped kinematics
 */
const HeroLogoWebGLStage: React.FC<{
  companyName: string;
  focusedDomain: NavSection | null;
}> = ({ companyName, focusedDomain }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const focusedDomainRef = useRef<NavSection | null>(focusedDomain);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    focusedDomainRef.current = focusedDomain;
  }, [focusedDomain]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param) || '');
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    const width = Math.max(container.clientWidth, 260);
    const height = Math.max(container.clientHeight, 240);

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglFailed(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 60);
    camera.position.set(0, 0.16, 7.35);
    camera.lookAt(0, -0.02, 0);

    // Studio reflection environment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    // 3-point + studio softbox lighting
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1c1917, 0.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffe4b5, 2.7);
    keyLight.position.set(4.5, 5.5, 6);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.8);
    rimLight.position.set(-5.2, -2.0, -4.5);
    scene.add(rimLight);

    const coreAmberLight = new THREE.PointLight(0xf59e0b, 3.6, 10, 1.7);
    coreAmberLight.position.set(0.3, 0.25, 2.35);
    scene.add(coreAmberLight);

    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const softbox = new THREE.RectAreaLight(0xfde68a, 4.2, 3.8, 1.4);
      softbox.position.set(-2.5, 3.0, 3.6);
      softbox.lookAt(0, 0, 0);
      scene.add(softbox);
    }

    // Procedural Textures (dial & contact shadow)
    const dialTex = createPrecisionDialTexture();
    dialTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const shadowTex = createContactShadowTexture();

    // PBR Materials with >= 0.25 roughness separation between adjacent parts
    const goldMat = new THREE.MeshPhysicalMaterial({
      color: 0xf59e0b,
      metalness: 0.94,
      roughness: 0.16,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
      anisotropy: 0.72,
      emissive: 0x451a03,
      emissiveIntensity: 0.24,
    });

    const brightGoldMat = new THREE.MeshPhysicalMaterial({
      color: 0xfde047,
      metalness: 0.96,
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      anisotropy: 0.8,
      emissive: 0x92400e,
      emissiveIntensity: 0.34,
    });

    const obsidianMat = new THREE.MeshPhysicalMaterial({
      color: 0x0a1120,
      metalness: 0.45,
      roughness: 0.44,
      clearcoat: 0.75,
      clearcoatRoughness: 0.18,
    });

    const titaniumMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.86,
      roughness: 0.38,
    });

    const emeraldCandleMat = new THREE.MeshPhysicalMaterial({
      color: 0x10b981,
      metalness: 0.15,
      roughness: 0.12,
      clearcoat: 1.0,
      emissive: 0x10b981,
      emissiveIntensity: 1.25,
    });

    const cyberCoreMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      metalness: 0.35,
      roughness: 0.1,
      clearcoat: 1.0,
      emissive: 0x0284c7,
      emissiveIntensity: 1.15,
    });

    const dialFaceMat = new THREE.MeshStandardMaterial({
      map: dialTex,
      roughness: 0.35,
      metalness: 0.45,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    const glassBezelMat = new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      metalness: 0.0,
      roughness: 0.06,
      clearcoat: 1.0,
      ior: 1.54,
      thickness: 0.35,
      transmission: isSoftwareGl ? 0 : 0.82,
      transparent: true,
      opacity: isSoftwareGl ? 0.16 : 1,
      depthWrite: false,
    });

    const energyRingMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf97316,
      emissiveIntensity: 1.5,
      roughness: 0.25,
      metalness: 0.5,
    });

    const emblemGroup = new THREE.Group();
    scene.add(emblemGroup);

    // 1. Hexagonal Obsidian Vault Backplate
    const hexOuter = new THREE.Shape();
    const hexRadius = 1.6;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const x = Math.cos(a) * hexRadius;
      const y = Math.sin(a) * hexRadius;
      if (i === 0) hexOuter.moveTo(x, y);
      else hexOuter.lineTo(x, y);
    }
    hexOuter.closePath();

    const hexBackGeo = new THREE.ExtrudeGeometry(hexOuter, {
      depth: 0.24,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.07,
      bevelSegments: 4,
    });
    hexBackGeo.center();
    const hexBackMesh = new THREE.Mesh(hexBackGeo, obsidianMat);
    hexBackMesh.position.z = -0.18;
    emblemGroup.add(hexBackMesh);

    // 2. Machined Precision Chronograph Market Dial Disc
    const dialGeo = new THREE.CircleGeometry(1.26, 64);
    const dialMesh = new THREE.Mesh(dialGeo, dialFaceMat);
    dialMesh.position.z = 0.025;
    emblemGroup.add(dialMesh);

    // 3. Machined Gold Hexagonal Outer Frame Bezel
    const frameShape = new THREE.Shape();
    const outerR = 1.74;
    const innerR = 1.55;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const x = Math.cos(a) * outerR;
      const y = Math.sin(a) * outerR;
      if (i === 0) frameShape.moveTo(x, y);
      else frameShape.lineTo(x, y);
    }
    frameShape.closePath();

    const frameHole = new THREE.Path();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const x = Math.cos(a) * innerR;
      const y = Math.sin(a) * innerR;
      if (i === 0) frameHole.moveTo(x, y);
      else frameHole.lineTo(x, y);
    }
    frameHole.closePath();
    frameShape.holes.push(frameHole);

    const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
      depth: 0.28,
      bevelEnabled: true,
      bevelThickness: 0.055,
      bevelSize: 0.05,
      bevelSegments: 3,
    });
    frameGeo.center();
    const frameMesh = new THREE.Mesh(frameGeo, goldMat);
    frameMesh.position.z = -0.02;
    emblemGroup.add(frameMesh);

    // 4. Sculpted 3D "A" Vault Monogram
    const letterShape = new THREE.Shape();
    letterShape.moveTo(0, 1.06);
    letterShape.lineTo(0.86, -0.92);
    letterShape.lineTo(0.47, -0.92);
    letterShape.lineTo(0.26, -0.38);
    letterShape.lineTo(-0.26, -0.38);
    letterShape.lineTo(-0.47, -0.92);
    letterShape.lineTo(-0.86, -0.92);
    letterShape.closePath();

    const letterAperture = new THREE.Path();
    letterAperture.moveTo(0, 0.36);
    letterAperture.lineTo(-0.18, -0.1);
    letterAperture.lineTo(0.18, -0.1);
    letterAperture.closePath();
    letterShape.holes.push(letterAperture);

    const letterGeo = new THREE.ExtrudeGeometry(letterShape, {
      depth: 0.26,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.045,
      bevelSegments: 4,
    });
    letterGeo.center();
    const letterMesh = new THREE.Mesh(letterGeo, brightGoldMat);
    letterMesh.position.set(0, 0.02, 0.2);
    emblemGroup.add(letterMesh);

    // 5. Three Ascending 3D Trading Candlestick Pillars (inside & stepping upward)
    const candleGroup = new THREE.Group();
    candleGroup.position.set(0, -0.06, 0.4);
    const candleSpecs = [
      { x: -0.4, y: -0.26, h: 0.36, wickH: 0.62, mat: emeraldCandleMat },
      { x: 0.0, y: -0.06, h: 0.54, wickH: 0.86, mat: emeraldCandleMat },
      { x: 0.4, y: 0.16, h: 0.68, wickH: 1.0, mat: brightGoldMat },
    ];
    candleSpecs.forEach((spec) => {
      const bodyGeo = new THREE.BoxGeometry(0.145, spec.h, 0.14);
      const bodyMesh = new THREE.Mesh(bodyGeo, spec.mat);
      bodyMesh.position.set(spec.x, spec.y, 0.02);
      candleGroup.add(bodyMesh);

      const wickGeo = new THREE.CylinderGeometry(0.018, 0.018, spec.wickH, 10);
      const wickMesh = new THREE.Mesh(wickGeo, titaniumMat);
      wickMesh.position.set(spec.x, spec.y, 0.02);
      candleGroup.add(wickMesh);
    });
    emblemGroup.add(candleGroup);

    // 6. Ascending Breakout Trajectory Vector Arrow
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(-0.66, -0.44);
    arrowShape.lineTo(-0.59, -0.5);
    arrowShape.lineTo(-0.02, -0.1);
    arrowShape.lineTo(0.22, -0.22);
    arrowShape.lineTo(0.69, 0.44);
    arrowShape.lineTo(0.5, 0.49);
    arrowShape.lineTo(0.84, 0.72);
    arrowShape.lineTo(0.79, 0.31);
    arrowShape.lineTo(0.65, 0.38);
    arrowShape.lineTo(0.24, -0.3);
    arrowShape.lineTo(-0.01, -0.19);
    arrowShape.closePath();

    const arrowGeo = new THREE.ExtrudeGeometry(arrowShape, {
      depth: 0.075,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.018,
      bevelSegments: 2,
    });
    const arrowMesh = new THREE.Mesh(arrowGeo, cyberCoreMat);
    arrowMesh.position.set(0, 0.02, 0.49);
    emblemGroup.add(arrowMesh);

    // 7. Sapphire Neural AI Core Diamond Apex + Halo
    const apexGeo = new THREE.OctahedronGeometry(0.18, 0);
    const apexMesh = new THREE.Mesh(apexGeo, cyberCoreMat);
    apexMesh.position.set(0, 1.28, 0.24);
    emblemGroup.add(apexMesh);

    const apexRingGeo = new THREE.TorusGeometry(0.26, 0.02, 10, 40);
    const apexRing = new THREE.Mesh(apexRingGeo, brightGoldMat);
    apexRing.position.set(0, 1.28, 0.24);
    apexRing.rotation.x = Math.PI * 0.4;
    emblemGroup.add(apexRing);

    // 8. Six Corner Titanium Locking Rivets (InstancedMesh)
    const rivetGeo = new THREE.CylinderGeometry(0.068, 0.068, 0.38, 16);
    const rivetInst = new THREE.InstancedMesh(rivetGeo, titaniumMat, 6);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      dummy.position.set(Math.cos(a) * 1.64, Math.sin(a) * 1.64, 0.02);
      dummy.rotation.set(Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      rivetInst.setMatrixAt(i, dummy.matrix);
    }
    rivetInst.computeBoundingSphere();
    emblemGroup.add(rivetInst);

    // 9. Protective Optical Glass Rim Ring
    const glassRingGeo = new THREE.TorusGeometry(1.32, 0.04, 16, 72);
    const glassRing = new THREE.Mesh(glassRingGeo, glassBezelMat);
    glassRing.position.z = 0.28;
    glassRing.renderOrder = 3;
    emblemGroup.add(glassRing);

    // 10. Twin Counter-Rotating Orbital Rings + 4 Ecosystem Satellites
    const orbitGroup1 = new THREE.Group();
    orbitGroup1.rotation.set(Math.PI * 0.34, 0.26, 0.12);
    scene.add(orbitGroup1);

    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.14, 0.026, 16, 110), goldMat);
    orbitGroup1.add(ring1);

    // Satellite A: ATX Minted Gold Coin
    const coinGroup = new THREE.Group();
    coinGroup.position.set(2.14, 0, 0);
    const coinBody = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.055, 24), brightGoldMat);
    coinBody.rotation.x = Math.PI / 2;
    coinGroup.add(coinBody);
    const coinRim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 10, 24), goldMat);
    coinGroup.add(coinRim);
    orbitGroup1.add(coinGroup);

    // Satellite B: AI Neural Quantum Node (opposite side of orbit 1)
    const aiNode = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), cyberCoreMat);
    aiNode.position.set(-2.14, 0, 0);
    orbitGroup1.add(aiNode);

    const orbitGroup2 = new THREE.Group();
    orbitGroup2.rotation.set(-Math.PI * 0.3, -0.32, 0.24);
    scene.add(orbitGroup2);

    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.42, 0.017, 12, 110), energyRingMat);
    orbitGroup2.add(ring2);

    // Satellite C: Global Forex Meridian Sphere
    const fxGlobeGroup = new THREE.Group();
    fxGlobeGroup.position.set(0, 2.42, 0);
    fxGlobeGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.125, 20, 16), emeraldCandleMat));
    const fxMeridian = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.014, 8, 28), brightGoldMat);
    fxMeridian.rotation.x = Math.PI * 0.35;
    fxGlobeGroup.add(fxMeridian);
    orbitGroup2.add(fxGlobeGroup);

    // Satellite D: Vault Gem Prism
    const vaultGem = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), brightGoldMat);
    vaultGem.position.set(0, -2.42, 0);
    vaultGem.rotation.set(0.6, 0.7, 0.3);
    orbitGroup2.add(vaultGem);

    // Ambient Golden Micro-Particles
    const pCount = 56;
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      const r = 1.9 + Math.random() * 1.4;
      const theta = Math.random() * Math.PI * 2;
      pPos[i * 3] = Math.cos(theta) * r;
      pPos[i * 3 + 1] = (Math.random() - 0.5) * 3.1;
      pPos[i * 3 + 2] = Math.sin(theta) * r - 0.4;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xfde047,
      size: 0.048,
      transparent: true,
      opacity: 0.78,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // Studio Contact Shadow Grounding Disc
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 1.8),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.75,
      })
    );
    shadowPlane.position.set(0, -1.92, -0.2);
    shadowPlane.rotation.x = -Math.PI / 2;
    scene.add(shadowPlane);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Pointer hover + drag interaction
    let pointerX = 0;
    let pointerY = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragOffsetY = 0;
    let dragOffsetX = 0;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointerX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      if (isDragging) {
        dragOffsetY += (e.clientX - dragStartX) * 0.009;
        dragOffsetX = Math.max(-0.55, Math.min(0.55, dragOffsetX + (e.clientY - dragStartY) * 0.006));
        dragStartX = e.clientX;
        dragStartY = e.clientY;
      }
    };
    const onPointerUp = () => {
      isDragging = false;
    };
    const onPointerLeave = () => {
      isDragging = false;
      pointerX = 0;
      pointerY = 0;
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointerleave', onPointerLeave);

    const handleResize = () => {
      if (!container) return;
      const w = Math.max(container.clientWidth, 220);
      const h = Math.max(container.clientHeight, 220);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(container);

    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      if (disposed) return;
      try {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        if (!sync) {
          frameId = window.setTimeout(cb, 80);
          return;
        }
        const poll = () => {
          if (disposed) {
            gl.deleteSync(sync);
            return;
          }
          const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } catch {
        frameId = window.setTimeout(cb, 80);
      }
    }

    const tick = () => {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const domain = focusedDomainRef.current;

      if (!prefersReducedMotion) {
        if (!isDragging) {
          dragOffsetY = THREE.MathUtils.damp(dragOffsetY, 0, 2.4, delta);
          dragOffsetX = THREE.MathUtils.damp(dragOffsetX, 0, 2.4, delta);
        }

        const focusBiasY =
          domain === 'ai-trading'
            ? -0.25
            : domain === 'pump-fun'
            ? 0.28
            : domain === 'forex'
            ? -0.12
            : domain === 'mentor-referral'
            ? 0.15
            : 0;
        const focusBiasX = domain === 'forex' ? -0.14 : domain === 'pump-fun' ? 0.1 : 0;

        const targetY = Math.sin(elapsed * 0.72) * 0.26 + pointerX * 0.42 + dragOffsetY + focusBiasY;
        const targetX = Math.cos(elapsed * 0.56) * 0.1 - pointerY * 0.28 + dragOffsetX + focusBiasX;
        _targetEuler.set(targetX, targetY, 0, 'XYZ');
        _targetQuat.setFromEuler(_targetEuler);
        emblemGroup.quaternion.slerp(_targetQuat, 1 - Math.exp(-5.0 * delta));
        emblemGroup.position.y = Math.sin(elapsed * 1.4) * 0.075;

        // Subtle candlestick elevation pulse
        candleGroup.position.y = -0.08 + Math.sin(elapsed * 2.2) * 0.018;

        apexMesh.rotation.y += delta * 1.65;
        apexRing.rotation.y -= delta * 1.1;

        const orbitSpeed = domain ? 1.55 : 1.0;
        orbitGroup1.rotation.z += delta * 0.48 * orbitSpeed;
        orbitGroup1.rotation.y += delta * 0.16 * orbitSpeed;
        coinGroup.rotation.y += delta * 2.2;
        aiNode.rotation.x += delta * 1.8;

        orbitGroup2.rotation.z -= delta * 0.38 * orbitSpeed;
        orbitGroup2.rotation.x += delta * 0.14 * orbitSpeed;
        fxGlobeGroup.rotation.y += delta * 1.5;
        vaultGem.rotation.y += delta * 1.4;

        particles.rotation.y += delta * 0.12;
      } else {
        emblemGroup.rotation.set(0.08, -0.22, 0);
      }

      renderer.render(scene, camera);
      if (prefersReducedMotion) return;
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
          else m.material?.dispose();
        }
      });
      dialTex.dispose();
      shadowTex.dispose();
      pGeo.dispose();
      pMat.dispose();
      envTarget.dispose();
      renderer.dispose();
    };
  }, []);

  if (webglFailed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
        <AlphatradexCrestMark sizeClass="w-32 h-32" companyName={companyName} />
        <span className="font-mono text-[11px] text-amber-300 tracking-wider uppercase">
          {companyName}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
      aria-label={`${companyName} Interactive 3D Ecosystem Emblem`}
    />
  );
};

export const AlphatradexLogo3D: React.FC<AlphatradexLogo3DProps> = ({
  variant = 'mark',
  size = 'md',
  companyName = 'Alphatradex',
  companyGoal = 'Automated Mon–Fri AI trading vaults, daily coin mining & tap rewards, real-time Forex market access, and multi-tier crypto payouts.',
  tokenTicker = 'ATX',
  onSelectFeature,
  className = '',
}) => {
  const [focusedDomain, setFocusedDomain] = useState<NavSection | null>(null);

  if (variant === 'hero') {
    const ecosystemFeatures: {
      id: NavSection;
      title: string;
      detail: string;
      Icon: React.ComponentType<{ className?: string }>;
      accent: string;
      ringHover: string;
    }[] = [
      {
        id: 'ai-trading',
        title: 'AI Quant Trading',
        detail: 'Mon–Fri 200-day algorithmic yield vaults',
        Icon: Bot,
        accent: 'text-orange-400',
        ringHover: 'hover:border-orange-500/60',
      },
      {
        id: 'forex',
        title: 'Live Forex Market',
        detail: 'Real-time FX charts & copy trade terminal',
        Icon: Globe,
        accent: 'text-emerald-400',
        ringHover: 'hover:border-emerald-500/60',
      },
      {
        id: 'pump-fun',
        title: `${tokenTicker} Token Mining`,
        detail: '3D ASIC hash rigs + daily free tap yield',
        Icon: Coins,
        accent: 'text-amber-400',
        ringHover: 'hover:border-amber-400/60',
      },
      {
        id: 'mentor-referral',
        title: 'Crypto Vault & MLM',
        detail: 'USDT / SOL payouts, P2P & L1–L3 rewards',
        Icon: Users,
        accent: 'text-sky-400',
        ringHover: 'hover:border-sky-400/60',
      },
    ];

    return (
      <div
        className={`relative w-full rounded-2xl border border-amber-500/30 bg-[#070B16] overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,0.72)] flex flex-col ${className}`}
      >
        {/* Studio radial rim light aura behind 3D sculpture */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 30%, rgba(245, 158, 11, 0.22) 0%, rgba(16, 185, 129, 0.08) 32%, rgba(56, 189, 248, 0.04) 50%, rgba(7, 11, 22, 0.98) 78%)',
          }}
        />

        {/* Visual Header Strip (clean typographic separator, zero pill clutter) */}
        <div className="relative z-10 px-4 py-3 border-b border-slate-800/80 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlphatradexCrestMark sizeClass="w-7 h-7" companyName={companyName} />
            <div className="min-w-0">
              <div className="font-display font-bold text-white tracking-tight truncate">
                {companyName} Visual Ecosystem
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                Drag 3D emblem · Hover a pillar to inspect
              </div>
            </div>
          </div>
          <span className="font-mono text-[11px] text-amber-300/90 whitespace-nowrap shrink-0">
            AI · Forex · Mining · Vault
          </span>
        </div>

        {/* Unobstructed Interactive 3D WebGL Sculpture Viewport */}
        <div className="relative z-10 w-full h-[235px] sm:h-[270px]">
          <HeroLogoWebGLStage companyName={companyName} focusedDomain={focusedDomain} />
        </div>

        {/* 4 Core Platform Pillars (Hover focuses 3D orbits; Click navigates directly) */}
        <div className="relative z-10 p-4 border-t border-slate-800/80 bg-[#080D1A] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ecosystemFeatures.map(({ id, title, detail, Icon, accent, ringHover }) => (
              <button
                key={id}
                type="button"
                onMouseEnter={() => setFocusedDomain(id)}
                onMouseLeave={() => setFocusedDomain(null)}
                onFocus={() => setFocusedDomain(id)}
                onBlur={() => setFocusedDomain(null)}
                onClick={() => onSelectFeature?.(id)}
                className={`p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/95 border border-slate-800 ${ringHover} text-left flex items-start justify-between gap-2 transition-colors group`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${accent}`} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white group-hover:text-amber-300 transition-colors truncate">
                      {title}
                    </div>
                    <div className="text-[11px] text-slate-400 leading-snug">{detail}</div>
                  </div>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-300 shrink-0 mt-0.5 transition-colors" />
              </button>
            ))}
          </div>

          <div className="pt-2.5 border-t border-slate-800/80 space-y-1">
            <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-amber-300">
              <span className="inline-flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Platform Mission</span>
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-400 font-mono font-medium">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>KYC &amp; Crypto Custody</span>
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{companyGoal}</p>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-2.5 ${className}`}>
        <AlphatradexCrestMark sizeClass={SIZE_MAP[size]} companyName={companyName} />
        <div className="min-w-0 leading-tight">
          <div className="font-display font-extrabold text-sm tracking-tight text-white truncate">
            {companyName}
          </div>
          <div className="text-[10px] font-mono text-amber-400/90 tracking-wider uppercase truncate">
            AI · Forex · Mining Vault
          </div>
        </div>
      </div>
    );
  }

  return (
    <AlphatradexCrestMark
      sizeClass={SIZE_MAP[size]}
      companyName={companyName}
      className={className}
    />
  );
};
