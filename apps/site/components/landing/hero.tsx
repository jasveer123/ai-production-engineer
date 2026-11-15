import Link from 'next/link';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { appUrl } from '@/data/products';
import { HeroDashboard } from './hero-dashboard';
import { HeroScroll } from './hero-scroll';
import { BeamsBackground } from '../ui/beams-background';

export function Hero() {
  return (
    <HeroScroll className="px-hero">
      <div className="px-hero-bg" aria-hidden="true">
        <BeamsBackground />
        <div className="px-hero-grain" />
      </div>
      <div className="px-wrap px-hero-inner">
        <Link href="/product/ai-investigation/" className="px-pill px-rise">
          <i className="px-pill-dot" />
          <span>Early access · AI production engineer</span>
          <ArrowRight size={13} />
        </Link>
        <h1 className="px-rise px-d1">
          Every incident ends <br className="px-br" />
          with{' '}
          <span className="px-stamp">
            proof
            <i className="px-stamp-check" aria-hidden="true">
              <Check size={14} strokeWidth={3} />
            </i>
          </span>{' '}
          it is fixed.
        </h1>
        <p className="px-lede px-rise px-d2">
          Pramaan watches your production, finds the root cause with cited evidence, drafts a fix in
          a sandbox, waits for your approval and then proves in production that it worked.
        </p>
        <div className="px-actions px-rise px-d3">
          <a className="px-btn px-btn-primary" href={`${appUrl}/sign-up`}>
            Request early access <ArrowRight size={16} />
          </a>
          <a className="px-btn px-btn-ghost" href="#loop">
            See how it works
          </a>
        </div>
        <p className="px-hero-note px-rise px-d3">
          <ShieldCheck size={14} /> AI does the legwork. Your team makes the call.
        </p>
      </div>
      <div className="px-wrap px-hero-stage px-rise px-d4">
        <p className="px-stage-note">Illustrative incident. Not live data.</p>
        <HeroDashboard />
      </div>
    </HeroScroll>
  );
}
