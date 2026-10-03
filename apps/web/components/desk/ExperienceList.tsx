'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { WorkExperience } from '@ahmed-moghazy/shared';

/** Tracker-style list: pick a row to read its details below. Every detail pane is in the markup. */
export default function ExperienceList({ experience }: { experience: WorkExperience[] }) {
  const [selected, setSelected] = useState(0);
  const [outgoing, setOutgoing] = useState<number | null>(null);
  const previous = useRef(0);
  const interruptedHeight = useRef<number | null>(null);
  const shell = useRef<HTMLDivElement>(null);
  const panes = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    const container = shell.current;
    const incoming = panes.current[selected];
    if (!container || !incoming) return;
    const nextHeight = incoming.offsetHeight;
    const oldIndex = previous.current;
    const old = panes.current[oldIndex];
    previous.current = selected;
    if (selected === oldIndex || !old || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      container.style.height = `${nextHeight}px`;
      if (selected !== oldIndex) setOutgoing(null);
      return;
    }
    const oldHeight = interruptedHeight.current ?? old.offsetHeight;
    interruptedHeight.current = null;
    container.style.height = `${nextHeight}px`;
    const options = { duration: 180, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'both' as const };
    const height = container.animate([{ height: `${oldHeight}px` }, { height: `${nextHeight}px` }], options);
    const fadeOut = old.animate([{ opacity: 1 }, { opacity: 0 }], options);
    const fadeIn = incoming.animate([{ opacity: 0 }, { opacity: 1 }], options);
    height.onfinish = () => setOutgoing(null);
    return () => { height.cancel(); fadeOut.cancel(); fadeIn.cancel(); };
  }, [selected]);

  useLayoutEffect(() => {
    const incoming = panes.current[selected];
    const container = shell.current;
    if (!incoming || !container) return;
    const observer = new ResizeObserver(() => { container.style.height = `${incoming.offsetHeight}px`; });
    observer.observe(incoming);
    return () => observer.disconnect();
  }, [selected]);
  return (
    <div className="be-tracker">
      <div className="be-tracker-head" aria-hidden="true"><span>Role</span><span>Company</span><span>Dates</span></div>
      <ul className="be-tracker-rows" aria-label="Roles">
        {experience.map((exp, index) => (
          <li key={exp.shortName}>
            <button
              type="button"
              className="be-row"
              aria-pressed={selected === index}
              aria-controls={`exp-${exp.shortName}`}
              onClick={() => {
                if (index === selected) return;
                interruptedHeight.current = shell.current?.getBoundingClientRect().height ?? null;
                setOutgoing(selected);
                setSelected(index);
              }}
            >
              <span className="be-row-name"><img src="/desk/experience.webp" alt="" width={22} height={22} />{exp.role}</span>
              <span>{exp.company}</span>
              <span className="be-num">{exp.startDate}{exp.endDate && exp.endDate !== exp.startDate ? ` – ${exp.endDate}` : ''}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="be-experience-panes" ref={shell}>
      {experience.map((exp, index) => (
        <div key={exp.shortName} id={`exp-${exp.shortName}`} ref={(node) => { panes.current[index] = node; }} className="be-detail"
          hidden={selected !== index && outgoing !== index} aria-hidden={selected !== index}>
          <h3>{exp.role} <span>· {exp.company}</span></h3>
          <ul>{exp.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
        </div>
      ))}
      </div>
    </div>
  );
}
