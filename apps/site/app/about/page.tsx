import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Eye, UserCheck } from 'lucide-react';
import { MotionScene } from '@/components/motion-scene';
import { appUrl } from '@/data/products';
import { HeroBackdrop } from '@/components/ui/hero-backdrop';
import { asset } from '@/data/base-path';

export const metadata: Metadata = {
  title: 'About and vision — Pramaan',
  description:
    'Why we are building Pramaan: an AI production engineer that ends every incident with proof it is fixed.',
};

const values = [
  {
    Icon: Eye,
    title: 'Show the working',
    body: 'An answer without evidence is a guess. Every conclusion Pramaan reaches points back to the signal it came from.',
  },
  {
    Icon: UserCheck,
    title: 'People decide',
    body: 'The AI investigates and proposes. Engineers review and approve. That line does not move.',
  },
  {
    Icon: BadgeCheck,
    title: 'Done means proven',
    body: 'An incident is over when production says so, not when someone says so in a channel.',
  },
];

export default function AboutPage() {
  return (
    <main id="main" className="px-page">
      <MotionScene />
      <section className="px-about-hero">
        <HeroBackdrop />
        <div className="px-wrap">
          <span className="px-eyebrow px-rise">About Pramaan</span>
          <h1 className="px-rise px-d1">
            प्रमाण means <span className="px-dim">proof.</span>
          </h1>
          <p className="px-lede px-rise px-d2">
            We are building the production engineer every team wishes it had at 2 a.m.: one that
            reads everything, explains itself, never ships alone and does not call it fixed until it
            is.
          </p>
        </div>
      </section>
      <section className="px-wrap reveal">
        <figure className="px-about-figure">
          <img
            src={asset('/visuals/vision.webp')}
            alt="Streams of data across a dark grid rise toward a single bright beacon on the horizon"
            width="1376"
            height="768"
            loading="lazy"
          />
        </figure>
      </section>
      <section className="px-section px-wrap px-prose-grid">
        <h2 className="reveal">Why we are building it</h2>
        <div className="px-prose reveal">
          <p>
            Modern systems produce more telemetry than any person can read during an outage. Teams
            buy more dashboards, more alerts and more tools, and the hardest part of an incident
            stays the same:{' '}
            <strong>working out what actually broke, and knowing for sure the fix worked.</strong>
          </p>
          <p>
            AI can read millions of log lines in the time it takes to open a laptop. But an AI that
            guesses, or one that changes production on its own, creates a new kind of risk. We think
            the answer is an AI that behaves like a great SRE: it gathers evidence, ranks
            hypotheses, tests a fix somewhere safe, asks for review and checks the result.
          </p>
          <p>
            That is Pramaan. Monitoring, incidents, on-call, status pages, logs, traces, metrics,
            errors and real-user monitoring in one platform, so the AI has the full picture, and
            every incident ends with a record anyone can trust.
          </p>
        </div>
      </section>
      <section className="px-section px-wrap" style={{ paddingTop: 0 }}>
        <div className="px-heading reveal">
          <span className="px-eyebrow">What we believe</span>
          <h2>Three rules we build by.</h2>
        </div>
        <div className="px-values px-cells">
          {values.map(({ Icon, title, body }) => (
            <article key={title} className="px-card reveal">
              <span className="px-card-icon">
                <Icon size={18} />
              </span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="px-wrap px-final">
        <div className="px-final-card reveal">
          <h2>
            Help us shape <span className="px-dim">Pramaan.</span>
          </h2>
          <p>
            We are in early access and working closely with the first teams. Bring a real service
            and tell us what would make it trustworthy for you.
          </p>
          <div className="px-actions">
            <a className="px-btn px-btn-primary" href={`${appUrl}/sign-up`}>
              Request early access <ArrowRight size={16} />
            </a>
            <Link className="px-btn px-btn-ghost" href="/#loop">
              See how it works
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
