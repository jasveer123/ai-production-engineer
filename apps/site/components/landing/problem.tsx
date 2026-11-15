'use client';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  BadgeCheck,
  BellRing,
  ChevronsLeftRight,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Search,
  TerminalSquare,
  UserRoundX,
} from 'lucide-react';

const tabs = ['Dashboard · prod', 'Logs', 'Traces', 'Errors', 'Deploys', 'runbook.md', '#incident'];

const noise = [
  { icon: BellRing, text: '17 alerts firing', tone: 'bad', x: 6, y: 24 },
  {
    icon: MessageSquare,
    text: 'Anyone deploy recently?',
    tone: 'warn',
    x: 52,
    y: 20,
  },
  {
    icon: TerminalSquare,
    text: 'grep -r timeout ./logs',
    tone: 'muted',
    x: 14,
    y: 44,
  },
  { icon: LayoutDashboard, text: 'Panel: no data', tone: 'warn', x: 58, y: 40 },
  { icon: Search, text: 'Trace ID not found', tone: 'bad', x: 4, y: 64 },
  { icon: UserRoundX, text: 'Who owns checkout?', tone: 'warn', x: 46, y: 60 },
  {
    icon: FileText,
    text: 'Runbook last edited 2023',
    tone: 'muted',
    x: 20,
    y: 82,
  },
  {
    icon: BellRing,
    text: 'Page escalated (no ack)',
    tone: 'bad',
    x: 58,
    y: 80,
  },
];

const thread = [
  { t: '02:14', text: 'Monitor failed in 3 regions. On-call paged.' },
  { t: '02:15', text: 'Logs, traces, deploys and code gathered.' },
  { t: '02:21', text: 'Root cause ranked: pool exhausted after #1842.' },
  { t: '02:33', text: 'Fix tested in sandbox and approved.' },
  { t: '03:08', text: 'Production verified. Closed with proof.' },
];

export function Problem() {
  const [split, setSplit] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const touched = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || touched.current) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          if (touched.current) return;
          const t = Math.min((now - start) / 2200, 1);
          setSplit(50 + Math.sin(t * Math.PI * 2) * 18 * (1 - t));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section className="px-section px-wrap" id="why">
      <div className="px-heading reveal">
        <h2>
          Monitoring tells you something broke.
          <br />
          <span className="px-dim">It never tells you it is fixed.</span>
        </h2>
        <p>
          Drag across the same incident. On the left, ten tabs and a noisy channel. On the right,
          one thread that ends in evidence.
        </p>
      </div>
      <div ref={ref} className="px-cs reveal" style={{ '--split': `${split}%` } as CSSProperties}>
        <div className="px-cs-layer px-cs-before" aria-hidden="true">
          <div className="px-cs-tabs">
            {tabs.map((t, i) => (
              <span key={t} style={{ '--i': i } as CSSProperties}>
                {t}
              </span>
            ))}
          </div>
          {noise.map((n, i) => (
            <span
              key={n.text}
              className={`px-cs-noise px-tone-${n.tone}`}
              style={
                {
                  left: `${n.x}%`,
                  top: `${n.y}%`,
                  '--i': i,
                } as CSSProperties
              }
            >
              <n.icon size={14} /> {n.text}
            </span>
          ))}
          <span className="px-cs-label px-cs-label-bad">Without Pramaan</span>
        </div>
        <div className="px-cs-layer px-cs-after" aria-hidden="true">
          <div className="px-cs-thread">
            <div className="px-cs-thread-head">
              <span className="px-sev">SEV-1</span>
              <b>INC-482 · Checkout requests are timing out</b>
            </div>
            <ol>
              {thread.map((s) => (
                <li key={s.t}>
                  <time>{s.t}</time>
                  <span>{s.text}</span>
                </li>
              ))}
            </ol>
            <div className="px-cs-thread-foot">
              <BadgeCheck size={15} /> Resolved with proof attached
            </div>
          </div>
          <span className="px-cs-label px-cs-label-good">With Pramaan</span>
        </div>
        <div className="px-cs-handle" aria-hidden="true">
          <span>
            <ChevronsLeftRight size={16} />
          </span>
        </div>
        <input
          className="px-cs-range"
          type="range"
          min={0}
          max={100}
          value={split}
          aria-label="Compare an incident without and with Pramaan"
          onChange={(e) => {
            touched.current = true;
            setSplit(Number(e.target.value));
          }}
        />
      </div>
      <div className="px-cs-captions reveal" data-stagger>
        <div>
          <h3>Hunting across tools at 2 a.m.</h3>
          <p>
            Alerts in one place, logs in another, traces somewhere else. The fix ships on a hunch
            and the incident closes on a thumbs-up.
          </p>
        </div>
        <div>
          <h3>One thread, from alert to proof.</h3>
          <p>
            Detection, investigation, the fix and the verification live on the same incident, so
            anyone can see what happened and why it is over.
          </p>
        </div>
      </div>
    </section>
  );
}
