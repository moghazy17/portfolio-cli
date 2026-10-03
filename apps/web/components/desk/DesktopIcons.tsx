'use client';

import { useEffect, useState } from 'react';
import { useDesktop, type WindowId } from './DesktopContext';

type Icon = { label: string; icon: string } & ({ open: WindowId } | { run: string } | { href: string; download?: string });

/** The desktop's life inventory. A link where the target is a file, a button where it opens a window. */
export default function DesktopIcons({ icons, variant }: { icons: Icon[]; variant: 'desktop' | 'dock' }) {
  const desktop = useDesktop();
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (variant !== 'desktop') return;
    const clearOnBackground = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('.be-desk') && !target.closest('.be-win, .be-deskbar, .be-icons, .be-dock')) setSelected(null);
    };
    document.addEventListener('pointerdown', clearOnBackground);
    return () => document.removeEventListener('pointerdown', clearOnBackground);
  }, [variant]);
  return (
    // A landmark, so the icons are reachable by region navigation (the list keeps its own styling).
    <nav aria-label={variant === 'dock' ? 'Dock' : 'Desktop'}>
    <ul className={variant === 'dock' ? 'be-dock' : 'be-icons'}>
      {icons.map((item) => {
        const face = <><img src={item.icon} alt="" width={48} height={48} /><span>{item.label}</span></>;
        return (
          <li key={item.label}>
            {'href' in item ? (
              <a className={`be-icon${selected === item.label ? ' is-selected' : ''}`} href={item.href} download={item.download}
                onClick={() => { if (variant === 'desktop') setSelected(item.label); }}>{face}</a>
            ) : (
              <button
                type="button"
                className={`be-icon${selected === item.label ? ' is-selected' : ''}`}
                onClick={(event) => {
                  if (variant === 'desktop') setSelected(item.label);
                  if ('open' in item) desktop.open(item.open, event.currentTarget);
                  else desktop.run(item.run, event.currentTarget);
                }}
              >
                {face}
              </button>
            )}
          </li>
        );
      })}
    </ul>
    </nav>
  );
}
