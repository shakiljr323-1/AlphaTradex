import React from 'react';
import { CheckCircle2, Clock, Compass, Radio } from 'lucide-react';
import { DEFAULT_BOOSTER_CONFIG, DEFAULT_ROADMAP_CONFIG } from '../constants/defaults';
import { usePlatform } from '../context/PlatformContext';
import { RoadmapPhaseStatus } from '../types/platform';

interface PlatformRoadmapViewProps {
  compact?: boolean;
}

const STATUS_STYLE: Record<
  RoadmapPhaseStatus,
  { label: string; badge: string; dot: string; cardBorder: string }
> = {
  completed: {
    label: 'Completed',
    badge: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    dot: 'bg-emerald-400',
    cardBorder: 'border-slate-800 hover:border-emerald-500/35',
  },
  active: {
    label: 'Active Now',
    badge: 'border-amber-500/50 bg-amber-500/15 text-amber-300',
    dot: 'bg-amber-400 animate-pulse',
    cardBorder: 'border-amber-500/45 shadow-lg shadow-amber-500/5',
  },
  upcoming: {
    label: 'Upcoming',
    badge: 'border-sky-500/35 bg-sky-500/10 text-sky-300',
    dot: 'bg-sky-400',
    cardBorder: 'border-slate-800 hover:border-sky-500/35',
  },
};

export const PlatformRoadmapView: React.FC<PlatformRoadmapViewProps> = ({ compact = false }) => {
  const { platformConfig } = usePlatform();
  const roadmap = platformConfig.roadmapConfig || DEFAULT_ROADMAP_CONFIG;
  const boosterName =
    platformConfig.boosterBrandName?.trim() ||
    platformConfig.boosterConfig?.brandName?.trim() ||
    DEFAULT_BOOSTER_CONFIG.brandName;

  if (!roadmap.enabled) return null;

  const resolveTokens = (text: string) => text.replace(/\{BOOSTER\}/g, boosterName);

  return (
    <section className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
            <Compass className="h-3.5 w-3.5" />
            <span>AlphaTradex Strategic Timeline · alphatradex.pro</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {resolveTokens(roadmap.title || DEFAULT_ROADMAP_CONFIG.title)}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            {resolveTokens(roadmap.subtitle || DEFAULT_ROADMAP_CONFIG.subtitle)}
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Completed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Active
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            Upcoming
          </span>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${compact ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-2'} gap-4`}>
        {(roadmap.phases || DEFAULT_ROADMAP_CONFIG.phases).map((phase) => {
          const st = STATUS_STYLE[phase.status] || STATUS_STYLE.upcoming;
          const StatusIcon =
            phase.status === 'completed'
              ? CheckCircle2
              : phase.status === 'active'
              ? Radio
              : Clock;

          return (
            <article
              key={phase.id}
              className={`rounded-2xl border bg-slate-900/75 p-5 sm:p-6 flex flex-col justify-between gap-4 transition-colors ${st.cardBorder}`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-400">
                    {phase.phaseLabel} · {phase.quarter}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-md border ${st.badge}`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    <span>{st.label}</span>
                  </span>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                  {resolveTokens(phase.title)}
                </h3>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {resolveTokens(phase.description)}
                </p>
              </div>

              <ul className="space-y-2 pt-3 border-t border-slate-800/80">
                {(phase.milestones || []).map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                    <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${st.dot}`} />
                    <span>{resolveTokens(item)}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
};
