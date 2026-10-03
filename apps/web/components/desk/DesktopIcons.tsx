'use client';

import { useDesktop, type WindowId } from './DesktopContext';

type Icon = { label: string; icon: string } & ({ open: WindowId } | { run: string } | { href: string; download?: string });

/** The desktop's life inventory. A link where the target is a file, a button where it opens a window. */
export default function DesktopIcons({ icons, variant }: { icons: Icon[]; variant: 'desktop' | 'dock' }) {
  const desktop = useDesktop();
  return (
    <ul className={variant === 'dock' ? 'be-dock' : 'be-icons'} aria-label={variant === 'dock' ? 'Dock' : 'Desktop'}>
      {icons.map((item) => {
        const face = <><img src={item.icon} alt="" width={48} height={48} /><span>{item.label}</span></>;
        return (
          <li key={item.label}>
            {'href' in item ? (
              <a className="be-icon" href={item.href} download={item.download}>{face}</a>
            ) : (
              <button
                type="button"
                className="be-icon"
                onClick={(event) => ('open' in item ? desktop.open(item.open, event.currentTarget) : desktop.run(item.run, event.currentTarget))}
              >
                {face}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
