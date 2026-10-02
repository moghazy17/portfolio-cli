import { cvData } from '@ahmed-moghazy/shared';
import type { SkillEvidence } from '@ahmed-moghazy/shared';
import Section from './Section';

interface Props {
  evidence?: SkillEvidence;
}

export default function GuiSkills({ evidence }: Props) {
  const maximum = Math.max(1, ...Object.values(evidence ?? {}));
  return (
    <Section id="skills" title="Skills">
      <div className="grid gap-5 sm:grid-cols-2">
        {cvData.skills.map((category) => (
          <div key={category.name} className="rounded-2xl border border-border bg-card p-6">
            <h3 className="mb-3 text-lg font-semibold">{category.name}</h3>
            <ul className={evidence ? 'space-y-3' : 'flex flex-wrap gap-2'}>
              {category.skills.map((skill) => (
                <li key={skill} className={evidence ? 'text-sm' : 'rounded-full border border-border bg-bg px-3 py-1 text-sm'}>
                  {evidence ? <>
                    <div className="mb-1 flex justify-between gap-3"><span>{skill}</span><span className="text-muted-foreground">{evidence[skill] === 1 ? '1 repo' : evidence[skill] ? `${evidence[skill]} repos` : 'no public repos'}</span></div>
                    <div className="h-2 rounded-full bg-border" role="img" aria-label={`${skill}: ${evidence[skill] ?? 0} public repositories`}>
                      <div className="h-full rounded-full bg-accent" style={{ width: `${100 * (evidence[skill] ?? 0) / maximum}%` }} />
                    </div>
                  </> : skill}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}
