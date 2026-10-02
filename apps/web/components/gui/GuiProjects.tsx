// Card style follows the 21st.dev "Project Card" by ravikatiyar162 (21st id 5964), text-only: projects have no images.
import { content, cvData } from '@ahmed-moghazy/shared';
import Section from './Section';
import { CalendarIcon, ExternalLinkIcon } from './icons';

function stackBadges(techStack: string): string[] {
  return techStack.split(/\s*[+,]\s*/).filter(Boolean);
}

export default function GuiProjects() {
  return (
    <Section id="projects" title="Projects">
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cvData.projects.map((project) => {
          const links = content.writeups[project.shortName]?.links ?? [];
          return (
            <li key={project.shortName} className="flex">
              <article className="flex w-full flex-col gap-4 rounded-2xl border border-border bg-card p-6 transition-colors hover:border-accent">
                <div>
                  {project.isGraduation && (
                    <p className="mb-2 font-code text-xs font-semibold uppercase tracking-wide text-accent">Graduation project</p>
                  )}
                  <h3 className="text-xl font-semibold tracking-tight">{project.name}</h3>
                  <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                    <CalendarIcon className="h-4 w-4" />
                    {project.startDate} — {project.endDate}
                  </p>
                </div>
                <ul className="flex flex-wrap gap-2" aria-label="Tech stack">
                  {stackBadges(project.techStack).map((tech) => (
                    <li key={tech} className="rounded-full border border-border bg-bg px-3 py-1 font-code text-xs text-accent">
                      {tech}
                    </li>
                  ))}
                </ul>
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
                  {project.bullets.map((bullet, index) => (
                    <li key={index}>{bullet}</li>
                  ))}
                </ul>
                {links.length > 0 && (
                  <ul className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-2">
                    {links.map((link) => (
                      <li key={link.url}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                        >
                          {link.label}
                          <ExternalLinkIcon className="h-3.5 w-3.5" />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
