import type { Metadata } from 'next';
import { LottiePlayer } from '@/components/ui/lottie-player';

export const metadata: Metadata = {
  title: 'Lottie test — Pramaan',
  robots: { index: false, follow: false },
};

const samples = [
  {
    src: '/lottie/alert-pulse.json',
    title: 'Alert pulse',
    use: 'Detect step, live status dots, incident badge',
  },
  {
    src: '/lottie/ai-scan.json',
    title: 'AI scanning',
    use: 'Investigate step, AI engineer working state',
  },
  {
    src: '/lottie/verified-check.json',
    title: 'Verified',
    use: 'Prove step, resolved with proof, success states',
  },
  {
    src: '/lottie/incident-line.json',
    title: 'Incident to recovery',
    use: 'Hero or story: error spike, fix, recovery',
    wide: true,
  },
];

export default function LottieLabPage() {
  return (
    <main id="main" className="px-page">
      <section className="px-section px-wrap px-lab">
        <div className="px-heading px-heading-left">
          <h2>Lottie test</h2>
          <p>
            Four animations written for Pramaan and played with the free, open-source lottie-web
            player. This page is not linked anywhere.
          </p>
        </div>
        <div className="px-lab-grid">
          {samples.map((s) => (
            <figure key={s.src} className={s.wide ? 'px-lab-card is-wide' : 'px-lab-card'}>
              <LottiePlayer src={s.src} label={s.title} />
              <figcaption>
                <b>{s.title}</b>
                <span>{s.use}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </main>
  );
}
