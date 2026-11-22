import React, { useEffect, useId, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { Bot, Coins, Globe, ShieldCheck, Target, Users } from 'lucide-react';
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
  md: 'w-9 h-9',
  lg: 'w-12 h-12',
};

/**
 * Isometric 3D metallic crest SVG (zero WebGL context overhead for navbars, sidebars, badges).
 */
export const AlphatradexCrestMark: React.FC<{
  sizeClass?: string;
  companyName?: string;
  className?: string;
}> = ({ sizeClass = 'w-9 h-9', companyName = 'Alphatradex', className = '' }) => {
  const uid = useId().replace(/:/g, '');
  const goldGrad = `atx-gold-${uid}`;
  const goldDarkGrad = `atx-gold-dark-${uid}`;
  const obsidianGrad = `atx-obs-${uid}`;
  const rimGrad = `atx-rim-${uid}`;
  const glowId = `atx-glow-${uid}`;

  return (
    <span
      className={`relative inline-flex items-center justify-center shrink-0 select-none group ${sizeClass} ${className}`}
      aria-hidden="true"
      title={companyName}
    >
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_6px_14px_rgba(245,158,11,0.38)] transition-transform duration-300 group-hover:scale-105"
      >
        <defs>
          <linearGradient id={obsidianGrad} x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="48%" stopColor="#0B111E" />
            <stop offset="100%" stopColor="#04070F" />
          </linearGradient>
          <linearGradient id={rimGrad} x1="10" y1="4" x2="54" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="35%" stopColor="#F59E0B" />
            <stop offset="72%" stopColor="#EA580C" />
            <stop offset="100%" stopColor="#78350F" />
          </linearGradient>
          <linearGradient id={goldGrad} x1="20" y1="14" x2="46" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="38%" stopColor="#FBBF24" />
            <stop offset="78%" stopColor="#F97316" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <linearGradient id={goldDarkGrad} x1="32" y1="18" x2="48" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#7C2D12" />
          </linearGradient>
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Extruded 3D bottom shadow bevel */}
        <path
          d="M32 5.5L55 18.8V45.2L32 58.5L9 45.2V18.8L32 5.5Z"
          fill="#020617"
          transform="translate(0, 2.2)"
          opacity="0.7"
        />

        {/* Chamfered outer metallic gold bezel */}
        <path
          d="M32 4L55.5 17.5V44.5L32 58L8.5 44.5V17.5L32 4Z"
          fill={`url(#${rimGrad})`}
        />

        {/* Inner recessed obsidian prism face */}
        <path
          d="M32 7.2L52.6 19.1V42.9L32 54.8L11.4 42.9V19.1L32 7.2Z"
          fill={`url(#${obsidianGrad})`}
        />

        {/* Upper-left specular glass facet */}
        <path
          d="M32 7.2L52.6 19.1L32 31L11.4 19.1L32 7.2Z"
          fill="#FFFFFF"
          opacity="0.06"
        />

        {/* Orbital gyro ring accent */}
        <ellipse
          cx="32"
          cy="31"
          rx="23.5"
          ry="8.2"
          transform="rotate(-24 32 31)"
          stroke={`url(#${goldGrad})`}
          strokeWidth="1.45"
          strokeOpacity="0.72"
        />

        {/* 3D Extruded "A" Shadow Depth Layer */}
        <path
          d="M32 15.5L44.2 44.5H38.6L35.9 37.8H28.1L25.4 44.5H19.8L32 15.5ZM32 23.8L29.6 32.6H34.4L32 23.8Z"
          fill={`url(#${goldDarkGrad})`}
          transform="translate(1.4, 1.8)"
          opacity="0.9"
        />

        {/* 3D Primary 24K Gold "A" Crest */}
        <path
          d="M32 15.5L44.2 44.5H38.6L35.9 37.8H28.1L25.4 44.5H19.8L32 15.5ZM32 23.8L29.6 32.6H34.4L32 23.8Z"
          fill={`url(#${goldGrad})`}
          filter={`url(#${glowId})`}
        />

        {/* Machined apex diamond node */}
        <polygon points="32,10.5 34.4,13 32,15.5 29.6,13" fill="#FEF08A" />
      </svg>
    </span>
  );
};

/**
 * Interactive WebGL 3D Alphatradex Emblem for Home Hero showcase.
 */
const HeroLogoWebGLStage: React.FC<{ companyName: string }> = ({ companyName }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

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

    const width = Math.max(container.clientWidth, 240);
    const height = Math.max(container.clientHeight, 240);

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
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
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 60);
    camera.position.set(0, 0.15, 6.4);
    camera.lookAt(0, 0, 0);

    // Mandatory studio environment reflection
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    // Warm/cool studio 3-point lighting + RectAreaLight on hardware GPUs
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1c1917, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffe4b5, 2.8);
    keyLight.position.set(4.5, 5.5, 6);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.5);
    rimLight.position.set(-5, -2.5, -4);
    scene.add(rimLight);

    const coreAmberLight = new THREE.PointLight(0xf59e0b, 3.8, 9, 1.8);
    coreAmberLight.position.set(0.3, 0.3, 2.2);
    scene.add(coreAmberLight);

    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const softbox = new THREE.RectAreaLight(0xfbbf24, 4.0, 3.6, 1.4);
      softbox.position.set(-2.4, 2.8, 3.4);
      softbox.lookAt(0, 0, 0);
      scene.add(softbox);
    }

    // PBR Materials
    const goldMat = new THREE.MeshPhysicalMaterial({
      color: 0xf59e0b,
      metalness: 0.94,
      roughness: 0.16,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
      anisotropy: 0.65,
      emissive: 0x451a03,
      emissiveIntensity: 0.25,
    });

    const brightGoldMat = new THREE.MeshPhysicalMaterial({
      color: 0xfde047,
      metalness: 0.96,
      roughness: 0.12,
      clearcoat: 1.0,
      emissive: 0x92400e,
      emissiveIntensity: 0.35,
    });

    const obsidianMat = new THREE.MeshPhysicalMaterial({
      color: 0x0b1222,
      metalness: 0.72,
      roughness: 0.24,
      clearcoat: 0.9,
      clearcoatRoughness: 0.15,
    });

    const titaniumMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.88,
      roughness: 0.28,
    });

    const energyRingMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf97316,
      emissiveIntensity: 1.8,
      roughness: 0.2,
      metalness: 0.4,
    });

    const emblemGroup = new THREE.Group();
    scene.add(emblemGroup);

    // 1. Hexagonal Vault Backplate with center cutout or stepped base
    const hexOuter = new THREE.Shape();
    const hexRadius = 1.58;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const x = Math.cos(a) * hexRadius;
      const y = Math.sin(a) * hexRadius;
      if (i === 0) hexOuter.moveTo(x, y);
      else hexOuter.lineTo(x, y);
    }
    hexOuter.closePath();

    const hexBackGeo = new THREE.ExtrudeGeometry(hexOuter, {
      depth: 0.22,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.07,
      bevelSegments: 4,
    });
    hexBackGeo.center();
    const hexBackMesh = new THREE.Mesh(hexBackGeo, obsidianMat);
    hexBackMesh.position.z = -0.14;
    emblemGroup.add(hexBackMesh);

    // 2. Machined Gold Hexagonal Frame Bezel
    const frameShape = new THREE.Shape();
    const outerR = 1.72;
    const innerR = 1.54;
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
      depth: 0.26,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 3,
    });
    frameGeo.center();
    const frameMesh = new THREE.Mesh(frameGeo, goldMat);
    frameMesh.position.z = -0.02;
    emblemGroup.add(frameMesh);

    // 3. Primary 3D Sculpted "A" Core (ExtrudeGeometry + triangular inner aperture)
    const letterShape = new THREE.Shape();
    letterShape.moveTo(0, 1.05);
    letterShape.lineTo(0.84, -0.92);
    letterShape.lineTo(0.45, -0.92);
    letterShape.lineTo(0.24, -0.4);
    letterShape.lineTo(-0.24, -0.4);
    letterShape.lineTo(-0.45, -0.92);
    letterShape.lineTo(-0.84, -0.92);
    letterShape.closePath();

    const letterAperture = new THREE.Path();
    letterAperture.moveTo(0, 0.36);
    letterAperture.lineTo(-0.16, -0.08);
    letterAperture.lineTo(0.16, -0.08);
    letterAperture.closePath();
    letterShape.holes.push(letterAperture);

    const letterGeo = new THREE.ExtrudeGeometry(letterShape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.055,
      bevelSegments: 4,
    });
    letterGeo.center();
    const letterMesh = new THREE.Mesh(letterGeo, brightGoldMat);
    letterMesh.position.set(0, 0.03, 0.24);
    emblemGroup.add(letterMesh);

    // 4. Precision Titanium Cross-Stabilizer Bar & Apex Diamond
    const barGeo = new THREE.BoxGeometry(0.95, 0.13, 0.42);
    const barMesh = new THREE.Mesh(barGeo, titaniumMat);
    barMesh.position.set(0, -0.18, 0.22);
    emblemGroup.add(barMesh);

    const apexGeo = new THREE.OctahedronGeometry(0.16, 0);
    const apexMesh = new THREE.Mesh(apexGeo, brightGoldMat);
    apexMesh.position.set(0, 1.24, 0.24);
    emblemGroup.add(apexMesh);

    // 5. Six Corner Locking Rivets on the Hexagonal Frame
    const rivetGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.38, 16);
    const rivetInst = new THREE.InstancedMesh(rivetGeo, titaniumMat, 6);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      dummy.position.set(Math.cos(a) * 1.63, Math.sin(a) * 1.63, 0.02);
      dummy.rotation.set(Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      rivetInst.setMatrixAt(i, dummy.matrix);
    }
    rivetInst.computeBoundingSphere();
    emblemGroup.add(rivetInst);

    // 6. Twin Counter-Rotating Orbital Gyroscope Rings
    const ring1Geo = new THREE.TorusGeometry(2.12, 0.028, 16, 110);
    const ring1 = new THREE.Mesh(ring1Geo, goldMat);
    ring1.rotation.set(Math.PI * 0.36, 0.28, 0.1);
    scene.add(ring1);

    const ring2Geo = new THREE.TorusGeometry(2.38, 0.016, 12, 110);
    const ring2 = new THREE.Mesh(ring2Geo, energyRingMat);
    ring2.rotation.set(-Math.PI * 0.32, -0.35, 0.25);
    scene.add(ring2);

    // 7. Ambient Golden Micro-Particles
    const pCount = 48;
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      const r = 1.9 + Math.random() * 1.3;
      const theta = Math.random() * Math.PI * 2;
      pPos[i * 3] = Math.cos(theta) * r;
      pPos[i * 3 + 1] = (Math.random() - 0.5) * 3.0;
      pPos[i * 3 + 2] = Math.sin(theta) * r - 0.4;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xfde047,
      size: 0.05,
      transparent: true,
      opacity: 0.8,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let pointerX = 0;
    let pointerY = 0;
    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointerX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    const onMouseLeave = () => {
      pointerX = 0;
      pointerY = 0;
    };
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseleave', onMouseLeave);

    const handleResize = () => {
      if (!container) return;
      const w = Math.max(container.clientWidth, 200);
      const h = Math.max(container.clientHeight, 200);
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

      if (!prefersReducedMotion) {
        const targetY = Math.sin(elapsed * 0.7) * 0.28 + pointerX * 0.38;
        const targetX = Math.cos(elapsed * 0.55) * 0.12 - pointerY * 0.26;
        emblemGroup.rotation.y += (targetY - emblemGroup.rotation.y) * Math.min(1, delta * 4.2);
        emblemGroup.rotation.x += (targetX - emblemGroup.rotation.x) * Math.min(1, delta * 4.2);
        emblemGroup.position.y = Math.sin(elapsed * 1.35) * 0.08;

        apexMesh.rotation.y += delta * 1.4;
        ring1.rotation.z += delta * 0.55;
        ring1.rotation.y += delta * 0.22;
        ring2.rotation.z -= delta * 0.45;
        ring2.rotation.x += delta * 0.18;
        particles.rotation.y += delta * 0.14;
      } else {
        emblemGroup.rotation.set(0.1, -0.25, 0);
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
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseleave', onMouseLeave);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
          else m.material?.dispose();
        }
      });
      pGeo.dispose();
      pMat.dispose();
      envTarget.dispose();
      renderer.dispose();
    };
  }, []);

  if (webglFailed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
        <AlphatradexCrestMark sizeClass="w-28 h-28" companyName={companyName} />
        <span className="font-mono text-[11px] text-amber-300 tracking-wider uppercase">
          {companyName}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      className="w-full h-full cursor-grab active:cursor-grabbing"
      aria-label={`${companyName} 3D Platform Emblem`}
    />
  );
};

export const AlphatradexLogo3D: React.FC<AlphatradexLogo3DProps> = ({
  variant = 'mark',
  size = 'md',
  companyName = 'Alphatradex',
  companyGoal = 'Deliver structured 200 profit-day AI trading vaults, daily coin mining & free tap rewards, real-time Forex intelligence, and instant multi-tier referral payouts.',
  tokenTicker = 'ATX',
  onSelectFeature,
  className = '',
}) => {
  if (variant === 'hero') {
    const ecosystemFeatures: {
      id: NavSection;
      title: string;
      detail: string;
      Icon: React.ComponentType<{ className?: string }>;
      accent: string;
    }[] = [
      {
        id: 'ai-trading',
        title: 'AI Quant Trading',
        detail: 'Mon–Fri 200-day automated yield vaults',
        Icon: Bot,
        accent: 'text-orange-400',
      },
      {
        id: 'pump-fun',
        title: `${tokenTicker} Mining & Tap`,
        detail: 'Paid ASIC daily yield + free tap mining',
        Icon: Coins,
        accent: 'text-amber-400',
      },
      {
        id: 'forex',
        title: 'Live Forex Desk',
        detail: 'Real-time FX charts & upcoming execution',
        Icon: Globe,
        accent: 'text-sky-400',
      },
      {
        id: 'mentor-referral',
        title: 'Referrals & Instant Vault',
        detail: 'L1–L3 commissions, P2P & crypto payouts',
        Icon: Users,
        accent: 'text-emerald-400',
      },
    ];

    return (
      <div
        className={`relative w-full rounded-2xl border border-amber-500/25 bg-[#070B16]/95 overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.65)] flex flex-col ${className}`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 26%, rgba(245, 158, 11, 0.20) 0%, rgba(249, 115, 22, 0.06) 38%, rgba(7, 11, 22, 0.96) 76%)',
          }}
        />

        {/* Visual Header */}
        <div className="relative z-10 px-4 py-2.5 border-b border-slate-800/80 flex items-center justify-between gap-2 text-xs">
          <span className="font-display font-bold text-white tracking-tight truncate">
            {companyName} Unified Ecosystem
          </span>
          <span className="font-mono text-[11px] text-amber-300/90 whitespace-nowrap shrink-0">
            AI · Mining · Forex · Vault
          </span>
        </div>

        {/* Interactive 3D Stage */}
        <div className="relative z-10 w-full h-[200px] sm:h-[225px]">
          <HeroLogoWebGLStage companyName={companyName} />
        </div>

        {/* Company Features & Site Goal Inside Visual */}
        <div className="relative z-10 p-4 border-t border-slate-800/80 bg-[#080D1A]/90 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ecosystemFeatures.map(({ id, title, detail, Icon, accent }) => (
              <button
                key={id}
                type="button"
                onClick={() => onSelectFeature?.(id)}
                className="p-2.5 rounded-xl bg-slate-900/85 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/45 text-left flex items-start gap-2.5 transition-colors group"
              >
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${accent}`} />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white group-hover:text-amber-300 transition-colors truncate">
                    {title}
                  </div>
                  <div className="text-[11px] text-slate-400 leading-snug">{detail}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-slate-900/75 border border-slate-800/90 space-y-1">
            <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-amber-300">
              <span className="inline-flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Our Platform Goal</span>
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-400 font-mono font-medium">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>KYC &amp; On-Chain Custody</span>
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
            Multi-Asset Desk
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
