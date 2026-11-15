import { BeamsBackground } from './beams-background';

export function HeroBackdrop() {
  return (
    <div className="px-hero-bg px-hero-bleed" aria-hidden="true">
      <BeamsBackground />
      <div className="px-hero-grain" />
    </div>
  );
}
