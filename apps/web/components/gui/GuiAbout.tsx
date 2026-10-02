import { cvData } from '@ahmed-moghazy/shared';
import Section from './Section';
import { CalendarIcon, GraduationIcon } from './icons';

export default function GuiAbout() {
  const { education } = cvData;
  return (
    <Section id="about" title="About">
      <div className="grid gap-8 lg:grid-cols-5">
        <p className="text-lg leading-relaxed text-muted lg:col-span-3">{cvData.professionalSummary}</p>

        <div className="rounded-2xl border border-border bg-card p-6 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg text-accent">
              <GraduationIcon className="h-5 w-5" />
            </span>
            <h3 className="text-lg font-semibold">Education</h3>
          </div>
          <p className="font-medium">{education.degree}</p>
          <p className="text-sm text-muted">{education.faculty}, {education.institution}</p>
          <p className="text-sm text-muted">{education.location}</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted">
            <CalendarIcon className="h-4 w-4" />
            {education.startDate} — {education.endDate} · GPA {education.gpa}
          </p>
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Relevant coursework">
            {education.coursework.map((course) => (
              <li key={course} className="rounded-full border border-border bg-bg px-3 py-1 text-xs text-muted">
                {course}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
