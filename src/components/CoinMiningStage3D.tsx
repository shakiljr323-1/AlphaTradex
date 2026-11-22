import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Bot, Cpu, Flame, Pickaxe, Server, ShieldCheck, Usb, Zap } from 'lucide-react';

interface CoinMiningStage3DProps {
  tokenName: string;
  tokenTicker: string;
  priceUsd: number;
  change24hPercent: number;
  compact?: boolean;
  onPrimaryAction?: () => void;
  primaryActionLabel?: string;
}

type SubsystemKey = 'core' | 'bitbooster' | 'coinbooster' | 'miner' | 'farms' | 'bot';

const SUBSYSTEM_DETAILS: Record<
  SubsystemKey,
  { title: string; badge: string; summary: string }
> = {
  core: {
    title: 'Dual-Turbine Quantum ASIC Core',
    badge: 'Mining Active',
    summary: 'Continuous 24/7 liquid-cooled hashing cluster validating real-time block telemetry.',
  },
  bitbooster: {
    title: 'BitBooster Hash Key',
    badge: '+2.4x Sync',
    summary: 'Hardware cryptographic accelerator boosting token allocation throughput.',
  },
  coinbooster: {
    title: 'Coin Liquidity Booster',
    badge: 'On-Chain Pool',
    summary: 'Golden reserve stabilizer maintaining continuous Pump.fun Solana pool depth.',
  },
  miner: {
    title: 'Miner Extraction Engine',
    badge: 'Block Active',
    summary: 'Automated hash-rate allocation engine running around the clock without downtime.',
  },
  farms: {
    title: 'Global Mining Farms',
    badge: 'Multi-Rack Array',
    summary: 'Distributed server clusters providing uninterrupted compute capacity.',
  },
  bot: {
    title: 'Crypto Mining Bot',
    badge: 'UPCOMING',
    summary: 'Autonomous AI hash-routing robotic arm launching in the next ecosystem upgrade.',
  },
};

export const CoinMiningStage3D: React.FC<CoinMiningStage3DProps> = ({
  tokenName,
  tokenTicker,
  priceUsd,
  change24hPercent,
  compact = false,
  onPrimaryAction,
  primaryActionLabel = 'Access Mining Portal',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const [activeModule, setActiveModule] = useState<SubsystemKey>('core');
  const [hashRate, setHashRate] = useState(482.6);

  // Subtle live hash telemetry counter so continuous mining activity is unmistakable
  useEffect(() => {
    const timer = setInterval(() => {
      setHashRate((prev) => {
        const next = prev + (Math.random() - 0.46) * 3.4;
        return Number(Math.max(465, Math.min(518, next)).toFixed(1));
      });
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Detect software WebGL cleanly without touching user agent
    const isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
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

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 320);
    renderer.setSize(width, height);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    const scene = new THREE.Scene();

    // Procedural RoomEnvironment for rich metallic & gold reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0.55, 6.2);
    camera.lookAt(0, 0, 0);

    // Three-point + warm amber core studio lighting
    const ambient = new THREE.AmbientLight(0x1e293b, 0.9);
    scene.add(ambient);

    const warmKey = new THREE.DirectionalLight(0xffb347, 2.4);
    warmKey.position.set(4.5, 5.2, 4.5);
    scene.add(warmKey);

    const coolFill = new THREE.DirectionalLight(0x38bdf8, 1.15);
    coolFill.position.set(-5.0, 2.0, 3.0);
    scene.add(coolFill);

    const rimLight = new THREE.DirectionalLight(0xf97316, 2.0);
    rimLight.position.set(0, 4.0, -4.5);
    scene.add(rimLight);

    const fanGlowLight = new THREE.PointLight(0xff8c1a, 5.5, 7, 1.8);
    fanGlowLight.position.set(1.4, 0.05, 1.25);
    scene.add(fanGlowLight);

    // Materials library (distinct metalness & roughness across parts)
    const chassisDarkMat = new THREE.MeshStandardMaterial({
      color: 0x161c28,
      roughness: 0.52,
      metalness: 0.72,
    });
    const armorTrimMat = new THREE.MeshStandardMaterial({
      color: 0x263144,
      roughness: 0.34,
      metalness: 0.85,
    });
    const goldAccentMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.22,
      metalness: 0.96,
      emissive: 0x451a03,
      emissiveIntensity: 0.45,
    });
    const glowingAmberMat = new THREE.MeshStandardMaterial({
      color: 0xffb74d,
      emissive: 0xff7b00,
      emissiveIntensity: 2.3,
      roughness: 0.25,
      metalness: 0.2,
    });
    const ringGlowMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.58,
    });
    const ringSecondaryMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.4,
    });

    // Composite 3D ASIC Quantum Mining Rig (THREE.Group)
    const rigGroup = new THREE.Group();
    rigGroup.rotation.set(0.18, -0.58, 0.02);
    scene.add(rigGroup);

    // 1. Main Anodized Chassis Core
    const bodyGeo = new THREE.BoxGeometry(2.15, 1.75, 1.48);
    const bodyMesh = new THREE.Mesh(bodyGeo, chassisDarkMat);
    rigGroup.add(bodyMesh);

    // 2. Top Controller Deck & Gold Heat Pipes
    const topDeckGeo = new THREE.BoxGeometry(1.75, 0.28, 1.08);
    const topDeck = new THREE.Mesh(topDeckGeo, armorTrimMat);
    topDeck.position.set(0, 1.0, 0);
    rigGroup.add(topDeck);

    const ledStripGeo = new THREE.BoxGeometry(1.3, 0.05, 0.08);
    const ledStrip = new THREE.Mesh(ledStripGeo, glowingAmberMat);
    ledStrip.position.set(0.1, 1.02, 0.54);
    rigGroup.add(ledStrip);

    // Gold exhaust pipes along left ridge
    const pipeGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.92, 12);
    for (let i = 0; i < 4; i++) {
      const pipe = new THREE.Mesh(pipeGeo, goldAccentMat);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(-0.62, 0.94, -0.36 + i * 0.24);
      rigGroup.add(pipe);
    }

    // 3. Structural Bezel Bars & Side Heatsink Fins
    const finGeo = new THREE.BoxGeometry(0.14, 1.45, 0.08);
    for (let i = 0; i < 6; i++) {
      const fin = new THREE.Mesh(finGeo, armorTrimMat);
      fin.position.set(-1.12, 0, -0.5 + i * 0.2);
      rigGroup.add(fin);
    }

    // Side Gold Medallion Coin Crest
    const crestRingGeo = new THREE.TorusGeometry(0.42, 0.045, 16, 36);
    const crestRing = new THREE.Mesh(crestRingGeo, goldAccentMat);
    crestRing.rotation.y = Math.PI / 2;
    crestRing.position.set(-1.12, -0.05, 0.02);
    rigGroup.add(crestRing);

    const crestCoreGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.04, 24);
    const crestCore = new THREE.Mesh(crestCoreGeo, glowingAmberMat);
    crestCore.rotation.z = Math.PI / 2;
    crestCore.position.set(-1.1, -0.05, 0.02);
    rigGroup.add(crestCore);

    // 4. Dual Front Glowing Cooling Turbines (Continuous High-RPM Spin)
    const fanAssemblies: THREE.Group[] = [];
    const buildTurbineFan = (yOffset: number) => {
      const housing = new THREE.Group();
      housing.position.set(1.09, yOffset, 0);
      housing.rotation.y = Math.PI / 2;

      const shroudGeo = new THREE.TorusGeometry(0.38, 0.055, 16, 36);
      const shroud = new THREE.Mesh(shroudGeo, armorTrimMat);
      housing.add(shroud);

      const glowBackGeo = new THREE.CircleGeometry(0.34, 28);
      const glowBack = new THREE.Mesh(glowBackGeo, glowingAmberMat);
      glowBack.position.z = -0.03;
      housing.add(glowBack);

      const rotor = new THREE.Group();
      const hubGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.06, 16);
      const hub = new THREE.Mesh(hubGeo, goldAccentMat);
      hub.rotation.x = Math.PI / 2;
      rotor.add(hub);

      const bladeGeo = new THREE.BoxGeometry(0.08, 0.28, 0.02);
      for (let b = 0; b < 7; b++) {
        const blade = new THREE.Mesh(bladeGeo, goldAccentMat);
        const angle = (b / 7) * Math.PI * 2;
        blade.position.set(Math.cos(angle) * 0.19, Math.sin(angle) * 0.19, 0.01);
        blade.rotation.z = angle + 0.45;
        blade.rotation.y = 0.28;
        rotor.add(blade);
      }

      housing.add(rotor);
      rigGroup.add(housing);
      fanAssemblies.push(rotor);
    };

    buildTurbineFan(0.42);
    buildTurbineFan(-0.42);

    // 5. Dual Glowing Orbital Rings Rotating Around the Mining Core
    const orbitGroup = new THREE.Group();
    scene.add(orbitGroup);

    const orbit1Geo = new THREE.TorusGeometry(2.15, 0.018, 12, 96);
    const orbit1 = new THREE.Mesh(orbit1Geo, ringGlowMat);
    orbit1.rotation.set(Math.PI * 0.44, 0.22, 0.12);
    orbitGroup.add(orbit1);

    const orbit2Geo = new THREE.TorusGeometry(2.42, 0.014, 12, 96);
    const orbit2 = new THREE.Mesh(orbit2Geo, ringSecondaryMat);
    orbit2.rotation.set(-Math.PI * 0.36, -0.3, 0.28);
    orbitGroup.add(orbit2);

    const orbit3Geo = new THREE.TorusGeometry(1.88, 0.012, 12, 84);
    const orbit3 = new THREE.Mesh(orbit3Geo, ringGlowMat);
    orbit3.rotation.set(Math.PI * 0.52, -0.18, -0.2);
    orbitGroup.add(orbit3);

    // 6. Floating Golden Hash-Rate Ember Particles
    const particleCount = 72;
    const positions = new Float32Array(particleCount * 3);
    const speeds = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      const r = 1.5 + Math.random() * 1.9;
      const theta = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(theta) * r;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 3.4;
      positions[i * 3 + 2] = Math.sin(theta) * r;
      speeds[i] = 0.35 + Math.random() * 0.65;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xfbbf24,
      size: 0.055,
      transparent: true,
      opacity: 0.85,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Subtle pointer parallax
    let pointerX = 0;
    let pointerY = 0;
    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointerX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    container.addEventListener('mousemove', handlePointerMove);

    const handleResize = () => {
      if (!container) return;
      const w = Math.max(container.clientWidth, 320);
      const h = Math.max(container.clientHeight, 320);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    const resizeObs = new ResizeObserver(handleResize);
    resizeObs.observe(container);

    // Software WebGL safe loop vs GPU rAF loop
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

    const animate = () => {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      if (!prefersReducedMotion) {
        // High-RPM continuous fan spin showing active mining
        fanAssemblies[0].rotation.z -= delta * 14.0;
        fanAssemblies[1].rotation.z -= delta * 15.2;

        // Gentle hover & mouse parallax on ASIC core
        const targetRotY = -0.56 + pointerX * 0.18 + Math.sin(elapsed * 0.55) * 0.08;
        const targetRotX = 0.18 + pointerY * 0.1;
        rigGroup.rotation.y += (targetRotY - rigGroup.rotation.y) * Math.min(1, delta * 4);
        rigGroup.rotation.x += (targetRotX - rigGroup.rotation.x) * Math.min(1, delta * 4);
        rigGroup.position.y = Math.sin(elapsed * 1.4) * 0.06;

        // Orbital energy rings rotation
        orbit1.rotation.z += delta * 0.45;
        orbit2.rotation.z -= delta * 0.35;
        orbit3.rotation.y += delta * 0.32;

        // Warm core glow pulse
        fanGlowLight.intensity = 5.0 + Math.sin(elapsed * 4.5) * 0.85;

        // Rising hash-rate particles
        const posAttr = particleGeo.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < particleCount; i++) {
          let y = posAttr.getY(i) + delta * speeds[i] * 0.65;
          if (y > 1.8) y = -1.7;
          posAttr.setY(i, y);
        }
        posAttr.needsUpdate = true;
      }

      renderer.render(scene, camera);

      if (prefersReducedMotion) return;
      if (isSoftwareGl) {
        afterDraw(animate);
      } else {
        frameId = requestAnimationFrame(animate);
      }
    };

    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObs.disconnect();
      container.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
          else m.material?.dispose();
        }
      });
      particleGeo.dispose();
      particleMat.dispose();
      envTarget.dispose();
      renderer.dispose();
    };
  }, []);

  const selectedDetail = SUBSYSTEM_DETAILS[activeModule];

  return (
    <div className="relative rounded-2xl border border-amber-500/25 bg-[#060913] overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.75)]">
      {/* Warm Radial Amber Halo matching Reference Photo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 38% 52%, rgba(245, 158, 11, 0.22) 0%, rgba(249, 115, 22, 0.08) 38%, rgba(6, 9, 19, 0.96) 76%)',
        }}
      />

      <div className={`relative z-10 grid grid-cols-1 ${compact ? '' : 'xl:grid-cols-12'} gap-5 p-5 sm:p-6 items-center`}>
        {/* LEFT / CENTER STAGE: 3D WebGL Mining Rig + Surrounding Constellation Cards */}
        <div className={`${compact ? '' : 'xl:col-span-7'} relative min-h-[380px] sm:min-h-[430px] flex flex-col justify-between`}>
          {/* 3D WebGL Canvas (with graceful CSS fallback if WebGL unavailable) */}
          <div className="relative w-full h-[320px] sm:h-[370px] flex items-center justify-center">
            {!webglFailed ? (
              <div ref={mountRef} className="w-full h-full" aria-label="Interactive 3D Quantum ASIC Mining Rig" />
            ) : (
              <div className="flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-36 h-36 rounded-2xl border border-amber-500/50 bg-gradient-to-br from-slate-900 to-amber-950/50 flex items-center justify-center shadow-[0_0_50px_rgba(245,158,11,0.35)]">
                  <Cpu className="w-14 h-14 text-amber-400" />
                </div>
                <div className="text-xs font-mono text-amber-300">Quantum ASIC Core Online</div>
              </div>
            )}

            {/* Constellation Module 1: Top — BitBooster */}
            <button
              type="button"
              onClick={() => setActiveModule('bitbooster')}
              className={`hidden sm:flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border backdrop-blur-md transition-colors absolute top-1 left-1/2 -translate-x-1/2 z-20 ${
                activeModule === 'bitbooster'
                  ? 'bg-slate-900/90 border-amber-400 text-white'
                  : 'bg-[#0C1220]/75 border-slate-700/80 text-slate-200 hover:border-amber-500/60'
              }`}
            >
              <Usb className="w-5 h-5 text-amber-400" />
              <span className="text-[11px] font-semibold whitespace-nowrap">BitBooster</span>
            </button>

            {/* Constellation Module 2: Left — Coin Booster */}
            <button
              type="button"
              onClick={() => setActiveModule('coinbooster')}
              className={`hidden sm:flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border backdrop-blur-md transition-colors absolute left-1 top-1/2 -translate-y-1/2 z-20 max-w-[122px] text-center ${
                activeModule === 'coinbooster'
                  ? 'bg-slate-900/90 border-amber-400 text-white'
                  : 'bg-[#0C1220]/75 border-slate-700/80 text-slate-200 hover:border-amber-500/60'
              }`}
            >
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-300 via-amber-500 to-orange-600 text-slate-950 font-display font-extrabold text-xs flex items-center justify-center shadow-[0_0_14px_rgba(245,158,11,0.5)]">
                ${tokenTicker.slice(0, 3)}
              </span>
              <span className="text-[11px] font-semibold leading-tight">
                {tokenName} Booster
              </span>
            </button>

            {/* Constellation Module 3: Bottom-Left — Miner */}
            <button
              type="button"
              onClick={() => setActiveModule('miner')}
              className={`hidden sm:flex flex-col items-center gap-1.5 px-3.5 py-2.5 rounded-xl border backdrop-blur-md transition-colors absolute bottom-1 left-3 z-20 ${
                activeModule === 'miner'
                  ? 'bg-slate-900/90 border-amber-400 text-white'
                  : 'bg-[#0C1220]/75 border-slate-700/80 text-slate-200 hover:border-amber-500/60'
              }`}
            >
              <Pickaxe className="w-5 h-5 text-amber-400" />
              <span className="text-[11px] font-semibold whitespace-nowrap">Miner Engine</span>
            </button>

            {/* Constellation Module 4: Bottom-Right — Mining Farms */}
            <button
              type="button"
              onClick={() => setActiveModule('farms')}
              className={`hidden sm:flex flex-col items-center gap-1.5 px-3.5 py-2.5 rounded-xl border backdrop-blur-md transition-colors absolute bottom-1 right-3 z-20 ${
                activeModule === 'farms'
                  ? 'bg-slate-900/90 border-amber-400 text-white'
                  : 'bg-[#0C1220]/75 border-slate-700/80 text-slate-200 hover:border-amber-500/60'
              }`}
            >
              <Server className="w-5 h-5 text-amber-400" />
              <span className="text-[11px] font-semibold whitespace-nowrap">Mining Farms</span>
            </button>
          </div>

          {/* Mobile Quick Subsystem Selector */}
          <div className="flex sm:hidden items-center gap-1.5 overflow-x-auto pb-1">
            {(
              [
                { id: 'core', label: 'ASIC Core' },
                { id: 'bitbooster', label: 'BitBooster' },
                { id: 'coinbooster', label: 'Coin Booster' },
                { id: 'miner', label: 'Miner' },
                { id: 'farms', label: 'Mining Farms' },
              ] as { id: SubsystemKey; label: string }[]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveModule(item.id)}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold whitespace-nowrap shrink-0 ${
                  activeModule === item.id
                    ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                    : 'border-slate-800 bg-slate-900/70 text-slate-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Live Mining Status Strip */}
          <div className="mt-2 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-amber-300 font-mono">
              <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span className="font-semibold">Live Hashrate: {hashRate.toFixed(1)} TH/s</span>
              <span className="text-slate-500">·</span>
              <span className="text-emerald-400">Continuous Mining Active</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveModule('core')}
              className="text-[11px] font-mono text-slate-400 hover:text-amber-300"
            >
              Reset Focus
            </button>
          </div>
        </div>

        {/* RIGHT STAGE: Institutional Coin Mining Copy + UPCOMING Crypto Mining Bot */}
        <div className={`${compact ? '' : 'xl:col-span-5'} space-y-4`}>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-amber-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{tokenName} (${tokenTicker}) Ecosystem</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-400 tabular-nums">
                ${priceUsd.toFixed(6)} (+{change24hPercent}%)
              </span>
            </div>
            <h2 className="font-display font-extrabold text-white text-2xl sm:text-3xl tracking-tight leading-tight">
              Institutional {tokenName} Mining
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Access global computing hash rate and on-chain Pump.fun Solana liquidity. Dual-turbine 3D ASIC nodes run continuously to secure and optimize your {tokenName} (${tokenTicker}) mining allocation.
            </p>
          </div>

          {/* Interactive Selected Subsystem Readout */}
          <div className="p-3.5 rounded-xl bg-slate-900/75 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-white">{selectedDetail.title}</span>
              <span className="font-mono text-[11px] text-amber-400 font-semibold">
                {selectedDetail.badge}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{selectedDetail.summary}</p>
          </div>

          {/* Highlighted UPCOMING Crypto Mining Bot Module (Matching Reference Photo) */}
          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            {onPrimaryAction && (
              <button
                type="button"
                onClick={onPrimaryAction}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-display font-bold text-xs sm:text-sm shadow-[0_8px_28px_rgba(245,158,11,0.35)] transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
              >
                <Zap className="w-4 h-4" />
                {primaryActionLabel}
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveModule('bot')}
              className={`relative flex-1 p-3.5 rounded-xl border text-left transition-colors ${
                activeModule === 'bot'
                  ? 'border-amber-400 bg-amber-950/40'
                  : 'border-amber-500/50 bg-[#0D1322]/90 hover:border-amber-400'
              }`}
            >
              <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-mono font-extrabold text-[10px] tracking-wider uppercase shadow">
                UPCOMING
              </span>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-display font-bold text-white text-sm truncate">
                    Crypto Mining Bot
                  </div>
                  <div className="text-[11px] text-amber-200/80">
                    Autonomous Hash Router · Next Release
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
