'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Check,
  ChevronRight,
  Code2,
  GitBranch,
  LockKeyhole,
  Pause,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { asset } from '@/data/base-path';

const scenes = [
  {
    name: 'Gather context',
    question: 'Why is checkout slowing down?',
    response:
      'I’ll bring the failing requests, related logs and recent changes into one investigation.',
    task: 'Reading production context',
    tags: ['checkout-api', 'OTLP traces', 'Recent deployment'],
    heading: 'The signals belong together.',
    sub: 'A single incident. Evidence from across your stack.',
  },
  {
    name: 'Investigate',
    question: 'What does the evidence point to?',
    response:
      'The slow requests are waiting on a database connection. The pool configuration changed in the same release. That’s a hypothesis worth checking.',
    task: 'Connecting the evidence',
    tags: ['Connection timeout', 'Waiting spans', 'Configuration diff'],
    heading: 'A cause you can question.',
    sub: 'Follow the sources behind the explanation.',
  },
  {
    name: 'Propose a fix',
    question: 'What could we change?',
    response:
      'A pool configuration change is one candidate. Check database capacity and validate it in isolation before deciding whether to proceed.',
    task: 'Preparing a candidate change',
    tags: ['Candidate patch', 'Isolated validation', 'Review required'],
    heading: 'A next step, with context.',
    sub: 'Review the patch and its assumptions together.',
  },
  {
    name: 'Human review',
    question: 'Who decides what reaches production?',
    response:
      'Your team does. Review the evidence, the candidate change and validation output before approving an external write.',
    task: 'Waiting for an engineering decision',
    tags: ['Evidence attached', 'Inspect validation', 'Human approval'],
    heading: 'You keep the final say.',
    sub: 'An explicit decision before a consequential action.',
  },
];

function TypedAnswer({ text, animate }: { text: string; animate: boolean }) {
  const [length, setLength] = useState(0);
  useEffect(() => {
    if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let position = 0;
    const timer = setInterval(() => {
      position = Math.min(position + 5, text.length);
      setLength(position);
      if (position === text.length) clearInterval(timer);
    }, 22);
    return () => clearInterval(timer);
  }, [text, animate]);
  return (
    <p className="agent-answer">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {animate ? text.slice(0, length) : text}
        <span className="typing-caret" />
      </span>
    </p>
  );
}

export function AgentTheater() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const scene = scenes[step];
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(preference.matches);
    update();
    preference.addEventListener('change', update);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.2,
    });
    if (root.current) observer.observe(root.current);
    return () => {
      observer.disconnect();
      preference.removeEventListener('change', update);
    };
  }, []);
  useEffect(() => {
    if (!playing || !visible || reduced) return;
    const timer = setInterval(() => {
      if (!document.hidden) setStep((n) => (n + 1) % scenes.length);
    }, 7500);
    return () => clearInterval(timer);
  }, [playing, visible, reduced]);
  const select = (index: number) => {
    setStep(index);
    setPlaying(false);
  };
  return (
    <div className="agent-theater" data-paused={!playing || !visible || reduced} ref={root}>
      <div className="theater-chrome">
        <span>
          <img src={asset('/brand/logo.svg')} alt="" width="23" height="23" /> Pramaan <b>/</b> AI
          investigation
        </span>
        <span className="theater-example">
          <i /> Interactive product story
        </span>
      </div>
      <div className="theater-body">
        <div className="theater-evidence">
          <div className="theater-service">
            <span className="service-dot" /> checkout-api <span>Incident context</span>
          </div>
          <div className="theater-visual" data-step={step}>
            <div className="orbit-label orbit-log">
              <Terminal size={16} />
              <span>Logs</span>
            </div>
            <div className="orbit-label orbit-trace">
              <Activity size={16} />
              <span>Traces</span>
            </div>
            <div className="orbit-label orbit-code">
              <GitBranch size={16} />
              <span>Code</span>
            </div>
            <svg className="context-paths" viewBox="0 0 470 240" aria-hidden="true">
              <path d="M84 45 C220 45 120 120 235 120 S290 45 390 45" />
              <path d="M84 193 C190 193 130 120 235 120 S295 193 390 193" />
              <path d="M235 120L390 120" />
              <circle className="path-particle" r="3">
                <animateMotion
                  dur="4s"
                  repeatCount="indefinite"
                  path="M84 45 C220 45 120 120 235 120 S290 45 390 45"
                />
              </circle>
              <circle className="path-particle second" r="3">
                <animateMotion
                  dur="5s"
                  repeatCount="indefinite"
                  path="M84 193 C190 193 130 120 235 120 S295 193 390 193"
                />
              </circle>
            </svg>
            <div className="agent-core">
              <div className="core-ring" />
              <div className="core-ring ring-two" />
              <img
                src={asset('/brand/logo.svg')}
                alt="Pramaan connects operational evidence"
                width="62"
                height="62"
              />
            </div>
            <div className="evidence-result">
              <Check size={15} />
              <span>{step < 2 ? 'Evidence' : 'Review'}</span>
            </div>
          </div>
          <div className="theater-caption" key={step}>
            <span>0{step + 1} / 04</span>
            <h3>{scene.heading}</h3>
            <p>{scene.sub}</p>
          </div>
          <div className="evidence-sources">
            <span>
              <Terminal size={12} /> logs
            </span>
            <span>
              <Activity size={12} /> traces
            </span>
            <span>
              <Code2 size={12} /> repository
            </span>
          </div>
        </div>
        <div className="agent-conversation">
          <div className="conversation-header">
            <Sparkles size={15} />
            <span>Your AI SRE</span>
            <span className="agent-mode">Evidence mode</span>
          </div>
          <div className="user-question" key={`q${step}`}>
            <span>You</span>
            <p>{scene.question}</p>
          </div>
          <div className="assistant-response" key={`a${step}`}>
            <div className="assistant-name">
              <img src={asset('/brand/logo.svg')} alt="" width="23" height="23" />
              <strong>Pramaan</strong>
              <span>AI SRE</span>
            </div>
            <TypedAnswer text={scene.response} animate={visible && !reduced && playing} />
            <div className="agent-tool">
              <Search size={13} />
              <span>{scene.task}</span>
              <Check size={13} />
            </div>
            <div className="source-pills">
              {scene.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            {step >= 2 && (
              <div className="mini-patch">
                <div>
                  <GitBranch size={12} /> database/config.ts <span>Candidate</span>
                </div>
                <code className="patch-removed">− pool: &#123; max: 2 &#125;</code>
                <code className="patch-added">+ pool: &#123; max: 20 &#125;</code>
                <small>
                  <LockKeyhole size={11} /> Requires capacity checks and validation
                </small>
              </div>
            )}
          </div>
          <button className="next-question" onClick={() => select((step + 1) % scenes.length)}>
            <span>{scenes[(step + 1) % scenes.length].question}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
      <div className="theater-controls">
        <div className="scene-select" aria-label="Investigation story stages">
          {scenes.map((item, index) => (
            <button key={item.name} aria-pressed={index === step} onClick={() => select(index)}>
              <span>0{index + 1}</span>
              {item.name}
              <ChevronRight size={12} />
            </button>
          ))}
        </div>
        <button
          className="play-control"
          aria-label={playing ? 'Pause product story' : 'Play product story'}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <button
          className="play-control restart-story"
          aria-label="Restart product story"
          onClick={() => {
            setStep(0);
            setPlaying(true);
          }}
        >
          <RotateCcw size={13} />
        </button>
      </div>
      <div className="theater-disclaimer">
        Illustrative incident and candidate patch. Live AI requires your workspace’s configured
        sources and workers.
      </div>
    </div>
  );
}
