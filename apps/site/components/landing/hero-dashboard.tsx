'use client';
import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bug,
  LayoutGrid,
  Pause,
  Play,
  ScrollText,
  Sparkles,
  Waypoints,
} from 'lucide-react';
import { PHASE_COUNT, phaseLabels, phaseTone } from '@/data/dashboard';
import { DashChart } from './dash/dash-chart';
import { DashKpis } from './dash/dash-kpis';
import { DashLogs } from './dash/dash-logs';
import { DashAiFeed } from './dash/dash-ai-feed';

const PHASE_MS = [2600, 2800, 3000, 3200, 2400, 4600];

const nav = [
  { Icon: LayoutGrid, label: 'Overview' },
  { Icon: AlertTriangle, label: 'Incidents', active: true },
  { Icon: Activity, label: 'Monitors' },
  { Icon: ScrollText, label: 'Logs' },
  { Icon: Waypoints, label: 'Traces' },
  { Icon: Bug, label: 'Errors' },
  { Icon: Sparkles, label: 'AI engineer' },
];

export function HeroDashboard() {
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = requestAnimationFrame(() => {
      setPlaying(false);
      setPhase(PHASE_COUNT - 1);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!playing || hovered) return;
    const timer = window.setTimeout(() => setPhase((p) => (p + 1) % PHASE_COUNT), PHASE_MS[phase]);
    return () => window.clearTimeout(timer);
  }, [phase, playing, hovered]);

  return (
    <div
      className="px-dash px-glow"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="px-dash-bar">
        <span className="px-lights" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="px-dash-crumb">
          Incidents <em>/</em> INC-482
        </span>
        <span className={`px-dash-status px-tone-${phaseTone[phase]}`}>
          <i />
          {phaseLabels[phase]}
        </span>
        <button
          type="button"
          className="px-console-play"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? 'Pause walkthrough' : 'Play walkthrough'}
        >
          {playing ? <Pause size={13} /> : <Play size={13} />}
        </button>
      </div>
      <div className="px-dash-body">
        <nav className="px-dash-nav" aria-label="Example product navigation">
          {nav.map(({ Icon, label, active }) => (
            <span key={label} className={active ? 'is-active' : undefined}>
              <Icon size={15} />
              <em>{label}</em>
            </span>
          ))}
        </nav>
        <div className="px-dash-main">
          <div className="px-dash-title">
            <div>
              <span className="px-sev">SEV-1</span>
              <h3>Checkout requests are timing out</h3>
            </div>
            <span className="px-dash-meta">checkout-api · started 02:14 · on-call paged</span>
          </div>
          <DashKpis phase={phase} />
          <DashChart phase={phase} />
          <DashLogs recovered={phase >= 5} />
        </div>
        <DashAiFeed phase={phase} />
      </div>
    </div>
  );
}
