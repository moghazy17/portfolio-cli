import { cvData } from '@ahmed-moghazy/shared';
import type { SkillEvidence } from '@ahmed-moghazy/shared';
import Section from './Section';

interface Props {
  // Repo counts per skill; not shown yet.
  evidence?: SkillEvidence;
}

export default function GuiSkills(_props: Props) {
  return (
    <Section id="skills" title="Skills">
      <div className="grid gap-5 sm:grid-cols-2">
        {cvData.skills.map((category) => (
          <div key={category.name} className="rounded-2xl border border-border bg-card p-6">
            <h3 className="mb-3 text-lg font-semibold">{category.name}</h3>
            <ul className="flex flex-wrap gap-2">
              {category.skills.map((skill) => (
                <li key={skill} className="rounded-full border border-border bg-bg px-3 py-1 text-sm">
                  {skill}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}
