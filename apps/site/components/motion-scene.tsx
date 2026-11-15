'use client';
import { useEffect } from 'react';
export function MotionScene() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduce.matches) return;
    const elements = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.12 },
    );
    elements.forEach((el) => {
      if (el.hasAttribute('data-stagger')) {
        Array.from(el.children).forEach((child, i) =>
          (child as HTMLElement).style.setProperty('--i', String(i)),
        );
      }
      el.classList.add('will-reveal');
      observer.observe(el);
    });
    const hero = document.querySelector<HTMLElement>('.ai-hero');
    let frame = 0;
    const scroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--page-scroll', String(window.scrollY));
        hero?.style.setProperty('--hero-parallax', `${Math.min(window.scrollY * 0.1, 65)}px`);
        frame = 0;
      });
    };
    const pointer = (event: PointerEvent) => {
      if (!hero || event.pointerType === 'touch') return;
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--mouse-x', `${((event.clientX - r.left) / r.width - 0.5) * 12}px`);
      hero.style.setProperty('--mouse-y', `${((event.clientY - r.top) / r.height - 0.5) * 9}px`);
    };
    window.addEventListener('scroll', scroll, { passive: true });
    hero?.addEventListener('pointermove', pointer, { passive: true });
    scroll();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scroll);
      hero?.removeEventListener('pointermove', pointer);
    };
  }, []);
  return null;
}
