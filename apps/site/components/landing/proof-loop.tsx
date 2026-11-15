'use client';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Check } from 'lucide-react';
import { loopSteps } from '@/data/landing';
import { StoryScene } from './story/story-scene';
import { LottiePlayer } from '../ui/lottie-player';

const icons = {
  alert: '/lottie/alert-pulse.json',
  investigate: '/lottie/ai-scan.json',
  cause: '/lottie/ai-scan.json',
  fix: '/lottie/sandbox-tests.json',
  approve: '/lottie/approval-shield.json',
  proof: '/lottie/verified-check.json',
};

const tones = ['bad', 'ai', 'ai', 'warn', 'warn', 'good'];

export function ProofLoop() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = track.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const p = total > 0 ? Math.min(Math.max(-rect.top / total, 0), 1) : 0;
      setProgress(p);
      setIndex(Math.min(loopSteps.length - 1, Math.floor(p * loopSteps.length)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const step = loopSteps[index];

  return (
    <section className="px-section px-story" id="loop">
      <div className="px-wrap">
        <div className="px-heading reveal">
          <h2>
            One incident, start to finish.
            <br />
            <span className="px-dim">Scroll through INC-482.</span>
          </h2>
          <p>
            Fifty-four minutes from the first failed check to a closed incident with proof attached.
            Every step lands on the same record.
          </p>
        </div>
      </div>
      <div
        ref={trackRef}
        className="px-story-track"
        style={{ '--steps': loopSteps.length } as CSSProperties}
      >
        <div
          className="px-story-pin"
          data-tone={tones[index]}
          style={{ '--story-p': progress } as CSSProperties}
        >
          <div className="px-wrap px-story-grid">
            <div className="px-story-copy">
              <div className="px-story-clock">
                <span key={step.time} className="px-story-time">
                  {step.time}
                </span>
                <span className="px-story-inc">
                  INC-482 · step {index + 1} of {loopSteps.length}
                </span>
              </div>
              <ol className="px-story-rail" aria-label="Incident steps">
                {loopSteps.map((s, i) => (
                  <li
                    key={s.number}
                    className={i < index ? 'is-done' : i === index ? 'is-current' : undefined}
                  >
                    <i>{i < index ? <Check size={10} /> : null}</i>
                    <span>{s.title}</span>
                  </li>
                ))}
              </ol>
              <div key={step.number} className="px-story-text">
                <LottiePlayer
                  src={icons[step.stage]}
                  label={step.title}
                  className="px-story-icon"
                />
                <h3>{step.heading}</h3>
                <p>{step.body}</p>
                <ul>
                  {step.points.map((p) => (
                    <li key={p}>
                      <Check size={14} /> {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="px-story-deck" aria-live="polite">
              {loopSteps.map((s, i) => {
                const off = i - index;
                return (
                  <div
                    key={s.number}
                    className="px-story-card"
                    data-state={off > 0 ? 'next' : off === 0 ? 'current' : 'past'}
                    style={
                      {
                        '--off': Math.max(off, -3),
                        zIndex: 10 + off,
                      } as CSSProperties
                    }
                    aria-hidden={off !== 0}
                  >
                    <StoryScene stage={s.stage} />
                  </div>
                );
              })}
            </div>
          </div>
          <div
            className="px-story-progress"
            aria-hidden="true"
            style={{ opacity: progress > 0 && progress < 1 ? 1 : 0 }}
          >
            <i style={{ transform: `scaleX(${progress})` }} />
          </div>
        </div>
      </div>
      <div className="px-wrap px-story-list">
        {loopSteps.map((s) => (
          <article key={s.number} className="px-story-item reveal">
            <LottiePlayer src={icons[s.stage]} label={s.title} className="px-story-icon" />
            <span className="px-step-num">
              {s.time} · {s.title}
            </span>
            <h3>{s.heading}</h3>
            <p>{s.body}</p>
            <StoryScene stage={s.stage} />
          </article>
        ))}
      </div>
    </section>
  );
}
