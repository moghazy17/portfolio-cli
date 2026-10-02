import { cvData } from '@ahmed-moghazy/shared';
import type { SkillEvidence } from '@ahmed-moghazy/shared';
import Section from './Section';

interface Props {
  evidence?: SkillEvidence;
}

export default function GuiSkills({ evidence: given }: Props) {
  // Skills with public evidence get a bar; the rest stay as chips, so every skill is still shown.
  const proven = (skill: string) => (given?.[skill] ?? 0) > 0;
  const evidence = cvData.skills.some((category) => category.skills.some(proven)) ? given : undefined;
  const maximum = Math.max(1, ...Object.values(evidence ?? {}));
  return (
    <Section id="skills" title="Skills">
      <div className="grid gap-5 sm:grid-cols-2">
        {cvData.skills.map((category) => (
          <div key={category.name} className="rounded-2xl border border-border bg-card p-6">
            <h3 className="mb-3 text-lg font-semibold">{category.name}</h3>
            {evidence && category.skills.some(proven) && (
              <ul className="mb-4 space-y-3">
                {category.skills.filter(proven).map((skill) => (
                  <li key={skill} className="text-sm">
                    <div className="mb-1 flex justify-between gap-3"><span>{skill}</span><span className="text-muted">{evidence[skill] === 1 ? '1 repo' : `${evidence[skill]} repos`}</span></div>
                    <div className="h-2 rounded-full bg-border" role="img" aria-label={`${skill}: ${evidence[skill]} public repositories`}>
                      <div className="h-full rounded-full bg-accent" style={{ width: `${100 * evidence[skill] / maximum}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {category.skills.some((skill) => !evidence || !proven(skill)) && (
              <ul className="flex flex-wrap gap-2">
                {category.skills.filter((skill) => !evidence || !proven(skill)).map((skill) => (
                  <li key={skill} className="rounded-full border border-border bg-bg px-3 py-1 text-sm">{skill}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}
