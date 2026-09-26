import type { CVData } from '../types';
import type { Content } from './schema';

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-');
  const name = monthNames[Number(monthNumber) - 1];
  const displayName = name.length <= 4 ? name : name.slice(0, 3);
  return `${displayName} ${year}`;
}

const displayEnd = (month?: string) => month ? formatMonth(month) : 'Present';

export function toCVData(content: Content): CVData {
  const { resume } = content;
  const linkedin = resume.basics.profiles.find((profile) => profile.network === 'LinkedIn');
  const github = resume.basics.profiles.find((profile) => profile.network === 'GitHub');
  const education = resume.education[0];

  return {
    name: resume.basics.name,
    professionalSummary: resume.basics.summary,
    contact: {
      email: resume.basics.email,
      phone: resume.basics.phone,
      linkedin: linkedin?.url ?? '',
      github: github?.url ?? '',
      location: `${resume.basics.location.city}, ${resume.basics.location.countryCode}`,
    },
    education: {
      degree: `${education.area} — ${education.studyType}`,
      institution: education.institution,
      faculty: education.faculty,
      location: education.location,
      gpa: education.score,
      startDate: formatMonth(education.startDate),
      endDate: displayEnd(education.endDate),
      coursework: education.courses,
    },
    experience: resume.work.map((work) => ({
      company: work.name,
      shortName: work.slug,
      role: work.position,
      startDate: work.startDate ? formatMonth(work.startDate) : '',
      endDate: work.startDate ? displayEnd(work.endDate) : '',
      bullets: work.highlights,
    })),
    projects: resume.projects.map((project) => ({
      name: project.name,
      shortName: project.slug,
      techStack: project.stack,
      startDate: formatMonth(project.startDate),
      endDate: displayEnd(project.endDate),
      isGraduation: project.graduation,
      bullets: project.highlights,
    })),
    certifications: resume.certificates.map((certificate) => ({
      title: certificate.name,
      issuer: certificate.issuer,
      startDate: formatMonth(certificate.startDate),
      endDate: displayEnd(certificate.endDate),
      bullets: certificate.highlights,
    })),
    skills: resume.skills.map((skill) => ({
      name: skill.name,
      skills: skill.keywords,
    })),
  };
}

export function toProfile(content: Content) {
  const { basics } = content.resume;
  return {
    name: basics.name,
    firstName: basics.name.split(/\s+/)[0],
    label: basics.label,
    location: `${basics.location.city}, ${basics.location.countryCode}`,
  };
}
