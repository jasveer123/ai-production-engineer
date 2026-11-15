import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { appUrl } from '@/data/products';
import { LottiePlayer } from '../ui/lottie-player';

const steps = [
  { time: '1 · 02:14', text: 'Error spike detected' },
  { time: '2 · 02:21', text: 'Cause found in checkout-api' },
  { time: '3 · 02:33', text: 'You approved the fix' },
  { time: '4 · 03:08', text: 'Recovery verified' },
];

export function FinalCta() {
  return (
    <section className="px-wrap px-final">
      <div className="px-final-card is-split reveal">
        <div className="px-final-copy">
          <span className="px-eyebrow">Early access</span>
          <h2>
            Stop hoping it is fixed.
            <br />
            <span className="px-dim">Know it is.</span>
          </h2>
          <p>
            Connect one service, trigger one incident and watch Pramaan take it from alert to proof.
          </p>
          <div className="px-actions">
            <a className="px-btn px-btn-primary" href={`${appUrl}/sign-up`}>
              Request early access <ArrowRight size={16} />
            </a>
            <Link className="px-btn px-btn-ghost" href="/docs/getting-started/">
              Read the quick start
            </Link>
          </div>
        </div>
        <figure className="px-final-monitor">
          <div className="px-final-chart">
            <LottiePlayer
              src="/lottie/incident-monitor.json"
              label="Error rate spikes, a fix is deployed and errors return to zero"
            />
            <span className="px-final-fix">Fix deployed</span>
          </div>
          <ol>
            {steps.map((s) => (
              <li key={s.time}>
                <span>{s.time}</span>
                <b>{s.text}</b>
              </li>
            ))}
          </ol>
        </figure>
      </div>
    </section>
  );
}
