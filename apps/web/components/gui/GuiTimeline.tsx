// Layout ported from the 21st.dev "Experience Timeline" (timeline-02) by shadcnui-blocks (21st id 28334).
import { cvData } from '@ahmed-moghazy/shared';
import Section from './Section';
import { BriefcaseIcon, CalendarIcon } from './icons';

export default function GuiTimeline() {
  return (
    <Section id="experience" title="Experience" width="narrow">
      <ol className="relative ml-3 border-l-2 border-border">
        {cvData.experience.map((exp) => (
          <li key={exp.shortName} className="relative pb-12 pl-10 last:pb-0">
            <span
              aria-hidden="true"
              className="absolute -left-px flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-bg text-accent"
            >
              <BriefcaseIcon className="h-5 w-5" />
            </span>
            <div className="space-y-3">
              <p className="text-base font-medium text-accent">{exp.company}</p>
              <div>
                <h3 className="text-xl font-semibold tracking-tight">{exp.role}</h3>
                <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                  <CalendarIcon className="h-4 w-4" />
                  {exp.startDate} — {exp.endDate}
                </p>
              </div>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted sm:text-base">
                {exp.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
