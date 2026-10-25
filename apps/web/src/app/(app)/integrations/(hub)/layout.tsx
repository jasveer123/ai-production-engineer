import type { ReactNode } from 'react';
import { WaterfallHero } from '@/components/shared/waterfall-hero';
import { Eyebrow } from '@/components/ui/card';
import { HowItWorks } from '@/features/integrations/components/how-it-works';
import { SilentBanner } from '@/features/integrations/components/silent-banner';
import { TokenPanel } from '@/features/integrations/components/token-panel';
import { WayFinder } from '@/features/integrations/components/way-finder';

export default function IntegrationsHubLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <WaterfallHero>
        <div className="max-w-[640px]">
          <Eyebrow>Integrations</Eyebrow>
          <h1 className="mt-1.5 font-display text-[28px] font-[650] leading-[34px] tracking-[-0.015em]">
            Connect your apps in a few minutes
          </h1>
          <p className="mt-2 text-ink-muted">
            There are 7 ways to send us data. Pick the one that matches how your app works today.
            They all end up in the same place, and you can use more than one.
          </p>
        </div>
        <HowItWorks />
      </WaterfallHero>
      <SilentBanner />
      <WayFinder />
      <div className="max-w-[460px]">
        <TokenPanel />
      </div>
      {children}
    </>
  );
}
