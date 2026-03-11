import type { CVData } from './types';

export function buildSystemPrompt(
  cvData: CVData,
  githubData?: string,
): string {
  const sections: string[] = [
    `You are an AI assistant representing ${cvData.name}. Answer questions about Ahmed in first person as if you ARE Ahmed, but make it clear you're an AI when directly asked.`,
    '',
    'RULES:',
    '- Only use the data provided below. Do not fabricate information.',
    '- Keep answers concise (2-4 sentences unless asked for detail).',
    '- Format for terminal display: no markdown headers, no bold/italic syntax, use plain text.',
    '- Use bullet points with "•" for lists.',
    '- Be friendly and professional.',
    '',
    '=== PROFESSIONAL SUMMARY ===',
    cvData.professionalSummary,
    '',
    '=== CONTACT ===',
    `Email: ${cvData.contact.email}`,
    `Phone: ${cvData.contact.phone}`,
    `LinkedIn: ${cvData.contact.linkedin}`,
    `GitHub: ${cvData.contact.github}`,
    `Location: ${cvData.contact.location}`,
    '',
    '=== EDUCATION ===',
    `${cvData.education.degree} — ${cvData.education.institution} (${cvData.education.faculty})`,
    `GPA: ${cvData.education.gpa} | ${cvData.education.startDate} – ${cvData.education.endDate}`,
    `Coursework: ${cvData.education.coursework.join(', ')}`,
    '',
    '=== WORK EXPERIENCE ===',
    ...cvData.experience.map(
      (exp) =>
        `${exp.role} @ ${exp.company} (${exp.startDate} – ${exp.endDate})\n${exp.bullets.map((b) => `  • ${b}`).join('\n')}`,
    ),
    '',
    '=== PROJECTS ===',
    ...cvData.projects.map(
      (proj) =>
        `${proj.name} [${proj.techStack}] (${proj.startDate} – ${proj.endDate})${proj.isGraduation ? ' [Graduation Project]' : ''}\n${proj.bullets.map((b) => `  • ${b}`).join('\n')}`,
    ),
    '',
    '=== CERTIFICATIONS ===',
    ...cvData.certifications.map(
      (cert) =>
        `${cert.title} — ${cert.issuer} (${cert.startDate} – ${cert.endDate})${cert.bullets.length ? '\n' + cert.bullets.map((b) => `  • ${b}`).join('\n') : ''}`,
    ),
    '',
    '=== SKILLS ===',
    ...cvData.skills.map((cat) => `${cat.name}: ${cat.skills.join(', ')}`),
  ];

  if (githubData) {
    sections.push('', '=== GITHUB ACTIVITY ===', githubData);
  }

  return sections.join('\n');
}
