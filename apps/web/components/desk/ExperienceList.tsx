'use client';

import { useState } from 'react';
import type { WorkExperience } from '@ahmed-moghazy/shared';

/** Tracker-style list: pick a row to read its details below. Every detail pane is in the markup. */
export default function ExperienceList({ experience }: { experience: WorkExperience[] }) {
  const [selected, setSelected] = useState(0);
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
              onClick={() => setSelected(index)}
            >
              <span className="be-row-name"><img src="/desk/experience.webp" alt="" width={22} height={22} />{exp.role}</span>
              <span>{exp.company}</span>
              <span className="be-num">{exp.startDate}{exp.endDate && exp.endDate !== exp.startDate ? ` – ${exp.endDate}` : ''}</span>
            </button>
          </li>
        ))}
      </ul>
      {experience.map((exp, index) => (
        <div key={exp.shortName} id={`exp-${exp.shortName}`} className="be-detail" hidden={selected !== index}>
          <h3>{exp.role} <span>· {exp.company}</span></h3>
          <ul>{exp.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
        </div>
      ))}
    </div>
  );
}
