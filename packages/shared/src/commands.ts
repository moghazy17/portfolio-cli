import type {
  CommandDefinition,
  CommandResult,
  SectionOutput,
} from './types';
import { cvData } from './data';
import { themes, DEFAULT_THEME } from './theme';
import { ASCII_BANNER, WELCOME_SUBTITLE, WELCOME_HINT } from './ascii';

// ============================================================
// COMMAND IMPLEMENTATIONS
// ============================================================

function helpCommand(): CommandResult {
  const rows = commandRegistry.map((cmd) => [cmd.usage, cmd.description]);
  return {
    output: [
      { type: 'text', content: 'Available Commands:', style: { bold: true } },
      { type: 'table', headers: ['Command', 'Description'], rows },
      { type: 'divider' },
      {
        type: 'text',
        content: 'Tip: Use arrow keys in menu mode, or type commands directly.',
        style: { dim: true },
      },
    ],
  };
}

function aboutCommand(): CommandResult {
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

function educationCommand(): CommandResult {
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

function experienceCommand(args: string[]): CommandResult {
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

function projectsCommand(args: string[]): CommandResult {
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

function skillsCommand(args: string[]): CommandResult {
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

function certificationsCommand(): CommandResult {
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

function contactCommand(): CommandResult {
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

function welcomeCommand(): CommandResult {
  return {
    output: [
      { type: 'ascii', content: ASCII_BANNER, style: { color: 'primary' } },
      { type: 'text', content: WELCOME_SUBTITLE, style: { bold: true } },
      { type: 'divider' },
      { type: 'text', content: WELCOME_HINT, style: { dim: true } },
    ],
  };
}

function whoamiCommand(): CommandResult {
  return {
    output: [
      {
        type: 'text',
        content:
          "You are a curious visitor exploring Ahmed's portfolio. Nice taste in CLI tools, by the way.",
      },
      {
        type: 'text',
        content: 'Run "about" to learn about the person who built this.',
        style: { dim: true },
      },
    ],
  };
}

function themeCommand(args: string[]): CommandResult {
  if (args.length === 0) {
    return {
      output: [
        { type: 'text', content: 'Available themes:', style: { bold: true } },
        {
          type: 'list',
          items: Object.keys(themes).map(
            (t) => `${t}${t === DEFAULT_THEME ? ' (default)' : ''}`,
          ),
        },
        { type: 'text', content: 'Usage: theme <name>', style: { dim: true } },
      ],
    };
  }

  const themeName = args[0].toLowerCase();
  if (!themes[themeName]) {
    return {
      output: [
        {
          type: 'text',
          content: `Unknown theme "${args[0]}". Available: ${Object.keys(themes).join(', ')}`,
          style: { color: 'error' },
        },
      ],
    };
  }

  return {
    output: [
      { type: 'text', content: `Theme switched to "${themeName}".`, style: { color: 'success' } },
    ],
  };
}

// ============================================================
// COMMAND REGISTRY
// ============================================================

export const commandRegistry: CommandDefinition[] = [
  {
    name: 'help',
    description: 'List all available commands',
    usage: 'help',
    aliases: ['h', '?'],
    execute: () => helpCommand(),
  },
  {
    name: 'about',
    description: 'Professional summary',
    usage: 'about',
    aliases: ['summary', 'bio'],
    execute: () => aboutCommand(),
  },
  {
    name: 'education',
    description: 'Education details and coursework',
    usage: 'education',
    aliases: ['edu'],
    execute: () => educationCommand(),
  },
  {
    name: 'experience',
    description: 'Work experience (filter by company)',
    usage: 'experience [company]',
    aliases: ['exp', 'work'],
    execute: (args) => experienceCommand(args),
  },
  {
    name: 'projects',
    description: 'Technical projects (filter by name)',
    usage: 'projects [name]',
    aliases: ['proj'],
    execute: (args) => projectsCommand(args),
  },
  {
    name: 'skills',
    description: 'Technical skills by category',
    usage: 'skills [category]',
    aliases: ['sk'],
    execute: (args) => skillsCommand(args),
  },
  {
    name: 'certifications',
    description: 'Certifications and achievements',
    usage: 'certifications',
    aliases: ['certs', 'awards'],
    execute: () => certificationsCommand(),
  },
  {
    name: 'contact',
    description: 'Contact information and links',
    usage: 'contact',
    aliases: ['email', 'links'],
    execute: () => contactCommand(),
  },
  {
    name: 'theme',
    description: 'Switch color theme',
    usage: 'theme [name]',
    aliases: [],
    execute: (args) => themeCommand(args),
  },
  {
    name: 'welcome',
    description: 'Show the welcome screen',
    usage: 'welcome',
    aliases: ['home', 'banner'],
    execute: () => welcomeCommand(),
  },
  {
    name: 'whoami',
    description: '???',
    usage: 'whoami',
    aliases: [],
    execute: () => whoamiCommand(),
  },
  {
    name: 'clear',
    description: 'Clear the terminal',
    usage: 'clear',
    aliases: ['cls'],
    execute: () => ({ output: [], clear: true }),
  },
];

// ============================================================
// COMMAND EXECUTION ENGINE
// ============================================================

export function executeCommand(input: string): CommandResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { output: [] };
  }

  const parts = trimmed.split(/\s+/);
  const cmdName = parts[0].toLowerCase();
  const args = parts.slice(1);

  const command = commandRegistry.find(
    (c) => c.name === cmdName || c.aliases.includes(cmdName),
  );

  if (!command) {
    return {
      output: [
        {
          type: 'text',
          content: `Command not found: "${cmdName}". Type "help" for available commands.`,
          style: { color: 'error' },
        },
      ],
    };
  }

  return command.execute(args);
}

export function getCompletions(partial: string): string[] {
  const lower = partial.toLowerCase();
  const all: string[] = [];
  for (const cmd of commandRegistry) {
    all.push(cmd.name, ...cmd.aliases);
  }
  if (!lower) return all;
  return all.filter((name) => name.startsWith(lower));
}

export function getMenuItems(): Array<{ label: string; value: string }> {
  return commandRegistry
    .filter((c) => !['clear', 'welcome', 'whoami', 'theme'].includes(c.name))
    .map((c) => ({
      label: `${c.name.padEnd(16)} ${c.description}`,
      value: c.name,
    }));
}
