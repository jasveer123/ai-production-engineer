'use client';
import { useEffect, useRef } from 'react';

interface BeamsBackgroundProps {
  className?: string;
  intensity?: 'subtle' | 'medium' | 'strong';
}

interface Beam {
  x: number;
  y: number;
  width: number;
  length: number;
  angle: number;
  speed: number;
  opacity: number;
  hue: number;
  pulse: number;
  pulseSpeed: number;
}

const BEAM_COUNT = 24;
const INTENSITY = { subtle: 0.7, medium: 0.85, strong: 1 };
const HUES = [234, 244, 256, 268, 150];

function pickHue(index: number) {
  return HUES[index % HUES.length] + (Math.random() - 0.5) * 12;
}

function createBeam(w: number, h: number, index: number): Beam {
  return {
    x: Math.random() * w * 1.5 - w * 0.25,
    y: Math.random() * h * 1.5 - h * 0.25,
    width: 40 + Math.random() * 80,
    length: h * 2.5,
    angle: -35 + Math.random() * 10,
    speed: 0.5 + Math.random() * 0.9,
    opacity: 0.12 + Math.random() * 0.16,
    hue: pickHue(index),
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: 0.02 + Math.random() * 0.03,
  };
}

export function BeamsBackground({ className, intensity = 'strong' }: BeamsBackgroundProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    let beams: Beam[] = [];
    let frame = 0;
    let running = false;
    let light = false;

    const readTheme = () => {
      light = document.documentElement.dataset.theme === 'light';
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w);
      canvas.height = Math.round(h);
      beams = Array.from({ length: BEAM_COUNT }, (_, i) => createBeam(w, h, i));
    };

    const reset = (beam: Beam, index: number) => {
      const spacing = w / 3;
      beam.y = h + 100;
      beam.x = (index % 3) * spacing + spacing / 2 + (Math.random() - 0.5) * spacing * 0.5;
      beam.width = 100 + Math.random() * 100;
      beam.speed = 0.5 + Math.random() * 0.4;
      beam.hue = pickHue(index);
      beam.opacity = 0.2 + Math.random() * 0.1;
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.filter = 'blur(35px)';
      const tone = light ? '82%, 58%' : '85%, 65%';
      const strength = INTENSITY[intensity] * (light ? 1.4 : 1.7);
      beams.forEach((beam) => {
        const o = beam.opacity * (0.8 + Math.sin(beam.pulse) * 0.2) * strength;
        const c = (a: number) => `hsla(${beam.hue}, ${tone}, ${a})`;
        ctx.save();
        ctx.translate(beam.x, beam.y);
        ctx.rotate((beam.angle * Math.PI) / 180);
        const g = ctx.createLinearGradient(0, 0, 0, beam.length);
        g.addColorStop(0, c(0));
        g.addColorStop(0.1, c(o * 0.5));
        g.addColorStop(0.4, c(o));
        g.addColorStop(0.6, c(o));
        g.addColorStop(0.9, c(o * 0.5));
        g.addColorStop(1, c(0));
        ctx.fillStyle = g;
        ctx.fillRect(-beam.width / 2, 0, beam.width, beam.length);
        ctx.restore();
      });
    };

    const loop = () => {
      beams.forEach((beam, i) => {
        beam.y -= beam.speed;
        beam.pulse += beam.pulseSpeed;
        if (beam.y + beam.length < -100) reset(beam, i);
      });
      draw();
      frame = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running || reduce) return;
      running = true;
      frame = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };

    readTheme();
    resize();
    draw();
    const ro = new ResizeObserver(() => {
      resize();
      draw();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()));
    io.observe(canvas);
    const mo = new MutationObserver(() => {
      readTheme();
      draw();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
    };
  }, [intensity]);

  return <canvas ref={ref} className={`px-beams ${className ?? ''}`} aria-hidden="true" />;
}
