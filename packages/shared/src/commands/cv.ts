import type { CommandContext, CommandResult, SectionOutput, SkillEvidence } from '../types';
import { content, cvData, itemIds } from '../content';
import type { Content } from '../content/schema';
import { toCVData } from '../content/view';

export function projectSection(index: number, data: Content = content): SectionOutput {
  const proj = data === content ? cvData.projects[index] : toCVData(data).projects[index];
  return {
    type: 'section', item: itemIds(data).project[index],
    title: `${proj.isGraduation ? '[Graduation] ' : ''}${proj.name} (${proj.techStack})`,
    children: [
      { type: 'text', content: `${proj.startDate} — ${proj.endDate}`, style: { dim: true } },
      { type: 'list', items: proj.bullets },
    ],
  };
}

export function experienceSection(index: number, data: Content = content): SectionOutput {
  const exp = data === content ? cvData.experience[index] : toCVData(data).experience[index];
  return {
    type: 'section', item: itemIds(data).experience[index], title: `${exp.company} — ${exp.role}`,
    children: [
      { type: 'text', content: `${exp.startDate} — ${exp.endDate}`, style: { dim: true } },
      { type: 'list', items: exp.bullets },
    ],
  };
}

export function certificationSection(index: number, data: Content = content): SectionOutput {
  const cert = data === content ? cvData.certifications[index] : toCVData(data).certifications[index];
  return {
    type: 'section', item: itemIds(data).certification[index], title: `${cert.issuer} — ${cert.title}`,
    children: [
      { type: 'text', content: `${cert.startDate} — ${cert.endDate}`, style: { dim: true } },
      ...(cert.bullets.length > 0 ? [{ type: 'list' as const, items: cert.bullets }] : []),
    ],
  };
}

export function aboutCommand(data: Content = content): CommandResult {
  const cv = data === content ? cvData : toCVData(data);
  return {
    output: [
      {
        type: 'section',
        title: `About ${cv.name}`,
        children: [{ type: 'text', content: cv.professionalSummary }],
      },
    ],
  };
}

export function educationCommand(): CommandResult {
  const edu = cvData.education;
  return {
    output: [
      {
        type: 'section',
        title: 'Education',
        children: [
          { type: 'text', content: edu.degree, style: { bold: true } },
          { type: 'text', content: `${edu.faculty}, ${edu.institution}, ${edu.location}` },
          {
            type: 'text',
            content: `${edu.startDate} — ${edu.endDate}  |  GPA: ${edu.gpa}`,
            style: { dim: true },
          },
          { type: 'divider' },
          { type: 'text', content: 'Relevant Coursework:', style: { bold: true } },
          { type: 'list', items: edu.coursework },
        ],
      },
    ],
  };
}

export function experienceCommand(args: string[]): CommandResult {
  let entries = cvData.experience;

  if (args.length > 0) {
    const filter = args[0].toLowerCase();
    entries = entries.filter(
      (e) =>
        e.shortName.toLowerCase() === filter ||
        e.company.toLowerCase().includes(filter),
    );
    if (entries.length === 0) {
      return {
        status: 'error',
        output: [
          {
            type: 'text',
            content: `No experience found matching "${args[0]}". Try: ${cvData.experience.map((e) => e.shortName).join(', ')}`,
            style: { color: 'error' },
          },
        ],
      };
    }
  }

  const sections: SectionOutput[] = entries.map((exp) => experienceSection(cvData.experience.indexOf(exp)));

  return {
    output: [
      { type: 'text', content: 'Work Experience', style: { bold: true } },
      ...sections,
    ],
  };
}

export function projectsCommand(args: string[]): CommandResult {
  let entries = cvData.projects;

  if (args.length > 0) {
    const filter = args[0].toLowerCase();
    entries = entries.filter(
      (p) =>
        p.shortName.toLowerCase() === filter ||
        p.name.toLowerCase().includes(filter),
    );
    if (entries.length === 0) {
      return {
        status: 'error',
        output: [
          {
            type: 'text',
            content: `No project found matching "${args[0]}". Try: ${cvData.projects.map((p) => p.shortName).join(', ')}`,
            style: { color: 'error' },
          },
        ],
      };
    }
  }

  const sections: SectionOutput[] = entries.map((proj) => projectSection(cvData.projects.indexOf(proj)));

  return {
    output: [
      { type: 'text', content: 'Technical Projects', style: { bold: true } },
      ...sections,
    ],
  };
}

export async function skillsCommand(args: string[], ctx?: CommandContext): Promise<CommandResult> {
  let categories = cvData.skills;

  if (args.length > 0) {
    const filter = args[0].toLowerCase();
    categories = categories.filter((c) => c.name.toLowerCase().includes(filter));
    if (categories.length === 0) {
      return {
        status: 'error',
        output: [
          {
            type: 'text',
            content: `No skill category matching "${args[0]}". Categories: ${cvData.skills.map((s) => s.name).join(', ')}`,
            style: { color: 'error' },
          },
        ],
      };
    }
  }

  const ids = itemIds(content);
  const sections: SectionOutput[] = categories.map((cat) => ({
    type: 'section',
    item: ids.skill[cvData.skills.indexOf(cat)],
    title: cat.name,
    children: [{ type: 'list', items: cat.skills }],
  }));

  const plain: CommandResult = {
    output: [
      { type: 'text', content: 'Skills', style: { bold: true } },
      ...sections,
    ],
  };
  if (!ctx?.skillEvidence) return plain;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let evidence: SkillEvidence | null = null;
  try {
    evidence = await Promise.race([
      ctx.skillEvidence(ctx.signal),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 2000); }),
    ]);
  } catch {
    return plain;
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!evidence) return plain;
  const max = Math.max(1, ...categories.flatMap((cat) => cat.skills.map((label) => evidence[label] ?? 0)));
  return { output: [
    { type: 'text', content: 'Skills', style: { bold: true } },
    ...categories.map((cat): SectionOutput => ({
      type: 'section', item: ids.skill[cvData.skills.indexOf(cat)], title: cat.name,
      children: cat.skills.map((label) => {
        const count = evidence[label] ?? 0;
        return { type: 'progress' as const, label: label.padEnd(Math.max(...cat.skills.map((skill) => skill.length))),
          value: count / max, note: count === 0 ? 'no public repos' : `${count} ${count === 1 ? 'repo' : 'repos'}`, reveal: true };
      }),
    })),
    { type: 'text', content: 'Bars: public GitHub repos using each skill (nightly).', style: { dim: true } },
  ] };
}

export function certificationsCommand(): CommandResult {
  const sections: SectionOutput[] = cvData.certifications.map((_, index) => certificationSection(index));

  return {
    output: [
      { type: 'text', content: 'Certifications & Achievements', style: { bold: true } },
      ...sections,
    ],
  };
}

export function contactCommand(): CommandResult {
  const c = cvData.contact;
  return {
    output: [
      { type: 'text', content: 'Contact', style: { bold: true } },
      { type: 'text', content: `Email:    ${c.email}` },
      { type: 'text', content: `Phone:    ${c.phone}` },
      { type: 'link', text: 'LinkedIn', url: c.linkedin },
      { type: 'link', text: 'GitHub', url: c.github },
      { type: 'text', content: `Location: ${c.location}` },
    ],
  };
}
