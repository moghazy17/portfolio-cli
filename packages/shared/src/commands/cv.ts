import type { CommandResult, SectionOutput } from '../types';
import { cvData } from '../data';

export function aboutCommand(): CommandResult {
  return {
    output: [
      {
        type: 'section',
        title: `About ${cvData.name}`,
        children: [{ type: 'text', content: cvData.professionalSummary }],
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

  const sections: SectionOutput[] = entries.map((exp) => ({
    type: 'section',
    title: `${exp.company} — ${exp.role}`,
    children: [
      { type: 'text', content: `${exp.startDate} — ${exp.endDate}`, style: { dim: true } },
      { type: 'list', items: exp.bullets },
    ],
  }));

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

  const sections: SectionOutput[] = entries.map((proj) => ({
    type: 'section',
    title: `${proj.isGraduation ? '[Graduation] ' : ''}${proj.name} (${proj.techStack})`,
    children: [
      { type: 'text', content: `${proj.startDate} — ${proj.endDate}`, style: { dim: true } },
      { type: 'list', items: proj.bullets },
    ],
  }));

  return {
    output: [
      { type: 'text', content: 'Technical Projects', style: { bold: true } },
      ...sections,
    ],
  };
}

export function skillsCommand(args: string[]): CommandResult {
  let categories = cvData.skills;

  if (args.length > 0) {
    const filter = args[0].toLowerCase();
    categories = categories.filter((c) => c.name.toLowerCase().includes(filter));
    if (categories.length === 0) {
      return {
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

  const sections: SectionOutput[] = categories.map((cat) => ({
    type: 'section',
    title: cat.name,
    children: [{ type: 'list', items: cat.skills }],
  }));

  return {
    output: [
      { type: 'text', content: 'Skills', style: { bold: true } },
      ...sections,
    ],
  };
}

export function certificationsCommand(): CommandResult {
  const sections: SectionOutput[] = cvData.certifications.map((cert) => ({
    type: 'section',
    title: `${cert.issuer} — ${cert.title}`,
    children: [
      { type: 'text', content: `${cert.startDate} — ${cert.endDate}`, style: { dim: true } },
      ...(cert.bullets.length > 0 ? [{ type: 'list' as const, items: cert.bullets }] : []),
    ],
  }));

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
