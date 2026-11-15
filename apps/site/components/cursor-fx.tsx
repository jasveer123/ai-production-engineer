'use client';
import { useEffect } from 'react';

export function CursorFx() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(pointer: fine)').matches;
    if (reduce || !fine) return;
    let magnet: HTMLElement | null = null;
    const move = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest) return;
      const glow = target.closest<HTMLElement>('.px-glow');
      if (glow) {
        const r = glow.getBoundingClientRect();
        glow.style.setProperty('--mx', `${(e.clientX - r.left) / 16}rem`);
        glow.style.setProperty('--my', `${(e.clientY - r.top) / 16}rem`);
      }
      const btn = target.closest<HTMLElement>('.px-btn');
      if (magnet && magnet !== btn) {
        magnet.style.transform = '';
        magnet = null;
      }
      if (btn) {
        const r = btn.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * 0.18;
        const dy = (e.clientY - (r.top + r.height / 2)) * 0.3;
        btn.style.transform = `translate(${dx / 16}rem, ${dy / 16}rem)`;
        magnet = btn;
      }
    };
    document.addEventListener('pointermove', move, { passive: true });
    return () => document.removeEventListener('pointermove', move);
  }, []);

  return null;
}
