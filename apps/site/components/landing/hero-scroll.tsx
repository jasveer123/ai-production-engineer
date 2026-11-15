'use client';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface HeroScrollProps {
  className?: string;
  children: ReactNode;
}

export function HeroScroll({ className, children }: HeroScrollProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.setProperty('--hs', '1');
      return;
    }
    const stage = el.querySelector<HTMLElement>('.px-hero-stage');
    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      const hy = Math.min(Math.max(window.scrollY / (vh * 0.7), 0), 1);
      let hs = 1;
      if (stage) {
        const top = stage.getBoundingClientRect().top;
        hs = Math.min(Math.max(1 - (top - vh * 0.18) / (vh * 0.55), 0), 1);
      }
      el.style.setProperty('--hy', hy.toFixed(3));
      el.style.setProperty('--hs', hs.toFixed(3));
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

  return (
    <section ref={ref} className={className}>
      {children}
    </section>
  );
}
