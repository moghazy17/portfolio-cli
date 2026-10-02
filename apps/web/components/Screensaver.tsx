'use client';

import { useEffect, useRef } from 'react';

export default function Screensaver({ color }: { color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    let frame = 0;
    let last = 0;
    let drops: number[] = [];
    const resize = () => {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      drops = Array.from({ length: Math.ceil(canvas.width / 18) }, () => Math.random() * -canvas.height / 18);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    resize();
    const glyphs = 'アイウエオカキクケコサシスセソ0123456789';
    const draw = (now: number) => {
      if (document.hidden) return;
      if (now - last >= 1000 / 30) {
        last = now;
        context.fillStyle = 'rgba(0,0,0,0.12)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = color;
        context.font = '16px monospace';
        drops.forEach((drop, i) => {
          context.fillText(glyphs[Math.floor(Math.random() * glyphs.length)], i * 18, drop * 18);
          drops[i] = drop * 18 > canvas.height && Math.random() > 0.96 ? 0 : drop + 1;
        });
      }
      frame = requestAnimationFrame(draw);
    };
    const visibility = () => { if (document.hidden) cancelAnimationFrame(frame); else frame = requestAnimationFrame(draw); };
    document.addEventListener('visibilitychange', visibility);
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  }, [color]);
  return <canvas ref={ref} data-testid="screensaver" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 5, pointerEvents: 'none', background: '#030703' }} />;
}
