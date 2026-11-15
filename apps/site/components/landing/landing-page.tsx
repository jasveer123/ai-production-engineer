import { MotionScene } from '../motion-scene';
import { Hero } from './hero';
import { StackStrip } from './stack-strip';
import { Problem } from './problem';
import { ProofLoop } from './proof-loop';
import { Platform } from './platform';
import { Faq } from './faq';
import { FinalCta } from './final-cta';

export function LandingPage() {
  return (
    <main id="main" className="px-page">
      <MotionScene />
      <Hero />
      <StackStrip />
      <Problem />
      <ProofLoop />
      <Platform />
      <Faq />
      <FinalCta />
    </main>
  );
}
