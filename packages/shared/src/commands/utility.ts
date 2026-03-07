import type { CommandResult } from '../types';
import { cvData } from '../data';
import { themes, DEFAULT_THEME } from '../theme';
import { ASCII_BANNER, WELCOME_SUBTITLE, WELCOME_HINT } from '../ascii';
import { parseTimelineDate } from './helpers';

export function openCommand(args: string[]): CommandResult {
  const targets: Record<string, string> = {
    github:   cvData.contact.github,
    linkedin: cvData.contact.linkedin,
  };

  if (args.length === 0) {
    return {
      output: [
        { type: 'text', content: 'Openable targets:', style: { bold: true } },
        ...Object.entries(targets).map(([name, url]) => ({ type: 'link' as const, text: name, url })),
        { type: 'text', content: 'Usage: open <target>', style: { dim: true } },
      ],
    };
  }

  const target = args[0].toLowerCase();

  if (!targets[target]) {
    return {
      output: [{
        type: 'text',
        content: `Unknown target "${args[0]}". Available: ${Object.keys(targets).join(', ')}`,
        style: { color: 'error' },
      }],
    };
  }

  return {
    output: [
      { type: 'text', content: `Opening ${target}...`, style: { color: 'success' } },
      { type: 'link', text: target, url: targets[target] },
    ],
  };
}

export function timelineCommand(): CommandResult {
  const entries = [
    {
      endNum:   parseTimelineDate(cvData.education.endDate),
      startNum: parseTimelineDate(cvData.education.startDate),
      period:   `${cvData.education.startDate} – ${cvData.education.endDate}`,
      role:     cvData.education.degree,
      org:      cvData.education.institution,
    },
    ...cvData.experience.map((exp) => ({
      endNum:   parseTimelineDate(exp.endDate),
      startNum: parseTimelineDate(exp.startDate),
      period:   `${exp.startDate} – ${exp.endDate}`,
      role:     exp.role,
      org:      exp.company,
    })),
  ];

  entries.sort((a, b) =>
    b.endNum !== a.endNum ? b.endNum - a.endNum : b.startNum - a.startNum,
  );

  return {
    output: [{
      type: 'table',
      headers: ['Period', 'Role / Degree', 'Organization'],
      rows: entries.map((e) => [e.period, e.role, e.org]),
    }],
  };
}

export function themeCommand(args: string[]): CommandResult {
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

export function welcomeCommand(): CommandResult {
  return {
    output: [
      { type: 'ascii', content: ASCII_BANNER, style: { color: 'primary' } },
      { type: 'text', content: WELCOME_SUBTITLE, style: { bold: true } },
      { type: 'divider' },
      { type: 'text', content: WELCOME_HINT, style: { dim: true } },
    ],
  };
}

export function whoamiCommand(): CommandResult {
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
