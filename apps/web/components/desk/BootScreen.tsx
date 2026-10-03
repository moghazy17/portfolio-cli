'use client';

import { useEffect, useRef, useState } from 'react';
import { useDesktop } from './DesktopContext';

const icons = ['terminal', 'resume', 'projects', 'experience', 'skills', 'mail', 'films'];
const bootKey = 'gui-boot:v1';
// Runs as the first child of the desk, before it paints. It only hides the desk for a
// first-visit boot; the client overlay itself is still mounted after hydration.
const preboot = `(function(){try{if(!location.hash&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&!sessionStorage.getItem('${bootKey}')){document.documentElement.classList.add('be-boot-pending');setTimeout(function(){document.documentElement.classList.remove('be-boot-pending')},3000)}}catch(e){}})()`;

/** A client-only first-visit layer. The complete desk remains in the server HTML below it. */
export default function BootScreen() {
  const desktop = useDesktop();
  const [visible, setVisible] = useState(false);
  const [lit, setLit] = useState(-1);
  const [leaving, setLeaving] = useState(false);
  const terminalIcon = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const clearPending = () => document.documentElement.classList.remove('be-boot-pending');
    if (window.location.hash || window.matchMedia('(prefers-reduced-motion: reduce)').matches || sessionStorage.getItem(bootKey)) {
      clearPending();
      return;
    }
    sessionStorage.setItem(bootKey, '1');
    setVisible(true);
    const revealFrame = requestAnimationFrame(() => requestAnimationFrame(clearPending));
    const timers: number[] = [];
    let done = false;
    let skip: (event: Event) => void;
    const removeListeners = () => {
      window.removeEventListener('keydown', skip, true);
      window.removeEventListener('pointerdown', skip, true);
      window.removeEventListener('touchstart', skip, true);
      window.removeEventListener('click', skip, true);
    };
    const finish = (skip: boolean) => {
      if (done) return;
      timers.forEach(window.clearTimeout);
      if (skip) {
        done = true;
        removeListeners();
        setVisible(false);
      } else {
        setLeaving(true);
        timers.push(window.setTimeout(() => {
          done = true;
          removeListeners();
          desktop.open('terminal', terminalIcon.current);
          history.replaceState(null, '', window.location.pathname + window.location.search);
          setVisible(false);
        }, 160));
      }
    };
    icons.forEach((_, index) => timers.push(window.setTimeout(() => setLit(index), index * 160 + 80)));
    timers.push(window.setTimeout(() => finish(false), 1200));
    const swallowClick = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.removeEventListener('click', swallowClick, true);
    };
    skip = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.type !== 'keydown') {
        window.addEventListener('click', swallowClick, true);
        window.setTimeout(() => window.removeEventListener('click', swallowClick, true), 500);
      }
      finish(true);
    };
    window.addEventListener('keydown', skip, true);
    window.addEventListener('pointerdown', skip, true);
    window.addEventListener('touchstart', skip, true);
    window.addEventListener('click', skip, true);
    return () => {
      cancelAnimationFrame(revealFrame);
      clearPending();
      timers.forEach(window.clearTimeout);
      removeListeners();
    };
  }, [desktop.open]);

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: preboot }} />
      {visible && (
        <div className={`be-boot${leaving ? ' is-leaving' : ''}`} data-testid="gui-boot" aria-label="Starting Be Desktop" role="status">
          <div className="be-boot-icons" aria-hidden="true">
            {icons.map((icon, index) => (
              <img key={icon} ref={index === 0 ? terminalIcon : undefined} src={`/desk/${icon}.webp`} alt="" width={56} height={56}
                className={`${index <= lit ? 'is-lit' : ''}${index === lit ? ' is-lighting' : ''}`} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
