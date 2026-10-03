'use client';

const svgNS = 'http://www.w3.org/2000/svg';

function motionAllowed() {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function layer(className: string): HTMLDivElement | null {
  const desk = document.querySelector('.be-desk');
  if (!desk) return null;
  const node = document.createElement('div');
  node.className = `be-fx-layer ${className}`;
  node.setAttribute('aria-hidden', 'true');
  desk.appendChild(node);
  return node;
}

export function playWebStrand(target: Element): () => void {
  if (!motionAllowed()) return () => {};
  const host = layer('be-fx-web');
  if (!host) return () => {};
  const tab = target.getBoundingClientRect();
  const desk = document.querySelector('.be-desk')!.getBoundingClientRect();
  const sx = Math.max(12, desk.left + 18);
  const sy = Math.max(12, desk.top + 18);
  const ex = tab.left + Math.min(85, tab.width * .45);
  const ey = tab.top + 5;
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${innerWidth} ${innerHeight}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  const main = document.createElementNS(svgNS, 'path');
  main.setAttribute('d', `M ${sx} ${sy} Q ${sx + (ex - sx) * .45} ${ey - 55} ${ex} ${ey}`);
  main.setAttribute('pathLength', '1');
  main.setAttribute('class', 'be-web-strand');
  svg.appendChild(main);
  host.appendChild(svg);
  const length = main.getTotalLength();
  for (const fraction of [.43, .56, .69, .82]) {
    const point = main.getPointAtLength(length * fraction);
    const ahead = main.getPointAtLength(Math.min(length, length * fraction + 2));
    const behind = main.getPointAtLength(Math.max(0, length * fraction - 2));
    const angle = Math.atan2(ahead.y - behind.y, ahead.x - behind.x) + Math.PI / 2;
    const half = 5 + 3 * fraction;
    const cross = document.createElementNS(svgNS, 'line');
    cross.setAttribute('x1', String(point.x - Math.cos(angle) * half));
    cross.setAttribute('y1', String(point.y - Math.sin(angle) * half));
    cross.setAttribute('x2', String(point.x + Math.cos(angle) * half));
    cross.setAttribute('y2', String(point.y + Math.sin(angle) * half));
    cross.setAttribute('class', 'be-web-cross');
    svg.appendChild(cross);
  }
  let removed = false;
  const cleanup = () => { if (!removed) { removed = true; clearTimeout(timer); host.remove(); } };
  const timer = window.setTimeout(cleanup, 720);
  return cleanup;
}

export function playConfetti(): () => void {
  if (!motionAllowed()) return () => {};
  const host = layer('be-fx-confetti');
  if (!host) return () => {};
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 60; index++) {
    const piece = document.createElement('i');
    piece.className = 'be-confetti-piece';
    piece.style.left = `${4 + Math.random() * 92}%`;
    piece.style.top = `${-10 - Math.random() * 25}px`;
    piece.style.width = `${4 + Math.random() * 4}px`;
    piece.style.height = `${7 + Math.random() * 6}px`;
    piece.style.background = index % 2 ? '#a50044' : '#004d98';
    piece.style.setProperty('--fall', `${Math.round(innerHeight * (.52 + Math.random() * .52))}px`);
    piece.style.setProperty('--sway', `${Math.round((Math.random() - .5) * 110)}px`);
    piece.style.setProperty('--turn', `${Math.round((Math.random() - .5) * 700)}deg`);
    piece.style.animationDelay = `${Math.random() * 160}ms`;
    fragment.appendChild(piece);
  }
  host.appendChild(fragment);
  let removed = false;
  const cleanup = () => { if (!removed) { removed = true; clearTimeout(timer); host.remove(); } };
  const timer = window.setTimeout(cleanup, 1220);
  return cleanup;
}

/** Animate the native project disclosures in both directions, keeping their contents in the DOM. */
export function installDisclosureMotion(): () => void {
  const animations = new Set<Animation>();
  const active = new WeakMap<HTMLDetailsElement, Animation>();
  const touched = new Set<HTMLDetailsElement>();
  const desired = new WeakMap<HTMLDetailsElement, boolean>();
  const onClick = (event: MouseEvent) => {
    if (!motionAllowed()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const summary = target.closest('summary');
    const details = summary?.parentElement;
    if (!(details instanceof HTMLDetailsElement) || !details.classList.contains('be-disclosure')) return;
    event.preventDefault();
    const opening = !(desired.get(details) ?? details.open);
    desired.set(details, opening);
    const start = details.getBoundingClientRect().height;
    const prior = active.get(details);
    if (prior) { prior.cancel(); animations.delete(prior); }
    if (opening) details.open = true;
    const end = opening ? details.scrollHeight : summary!.getBoundingClientRect().height;
    details.style.overflow = 'hidden';
    const animation = details.animate([{ height: `${start}px` }, { height: `${end}px` }], {
      duration: 200, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'forwards',
    });
    animations.add(animation);
    active.set(details, animation);
    touched.add(details);
    const finish = () => {
      animations.delete(animation);
      if (desired.get(details) !== opening) return;
      active.delete(details);
      if (!opening) details.open = false;
      details.style.overflow = '';
      animation.cancel();
    };
    animation.onfinish = finish;
  };
  document.addEventListener('click', onClick);
  return () => {
    document.removeEventListener('click', onClick);
    animations.forEach((animation) => animation.cancel());
    touched.forEach((details) => { details.style.overflow = ''; });
  };
}
