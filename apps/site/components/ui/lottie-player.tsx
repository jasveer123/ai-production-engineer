'use client';
import { useEffect, useRef } from 'react';
import { asset } from '@/data/base-path';

interface LottieAnimation {
  destroy: () => void;
  play: () => void;
  pause: () => void;
}

interface LottieApi {
  loadAnimation: (options: {
    container: Element;
    renderer: 'svg';
    loop: boolean;
    autoplay: boolean;
    path: string;
  }) => LottieAnimation;
}

declare global {
  interface Window {
    lottie?: LottieApi;
  }
}

const SCRIPT_SRC = asset('/vendor/lottie/lottie_light.min.js');
let loading: Promise<LottieApi> | null = null;

function loadLottie() {
  if (window.lottie) return Promise.resolve(window.lottie);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () =>
        window.lottie ? resolve(window.lottie) : reject(new Error('lottie missing'));
      script.onerror = () => reject(new Error('lottie failed to load'));
      document.head.appendChild(script);
    });
  }
  return loading;
}

interface LottiePlayerProps {
  src: string;
  label: string;
  className?: string;
}

export function LottiePlayer({ src, label, className }: LottiePlayerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let anim: LottieAnimation | undefined;
    let cancelled = false;
    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!anim || reduce) return;
      if (visible) anim.play();
      else anim.pause();
    });
    io.observe(el);
    loadLottie()
      .then((lottie) => {
        if (cancelled) return;
        anim = lottie.loadAnimation({
          container: el,
          renderer: 'svg',
          loop: !reduce,
          autoplay: !reduce,
          path: asset(src),
        });
        if (!visible) anim.pause();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      io.disconnect();
      anim?.destroy();
    };
  }, [src]);

  return <div ref={ref} role="img" aria-label={label} className={`px-lottie ${className ?? ''}`} />;
}
