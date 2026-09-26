import type { CommandDefinition, CommandResult } from '../types';
import { profile } from '../content';
import {
  aboutCommand,
  educationCommand,
  experienceCommand,
  projectsCommand,
  skillsCommand,
  certificationsCommand,
  contactCommand,
} from './cv';
import {
  openCommand,
  timelineCommand,
  themeCommand,
  welcomeCommand,
  whoamiCommand,
} from './utility';
import { githubCommand } from './github';
import {
  sudoCommand,
  rmCommand,
  neofetchCommand,
  helloCommand,
  exitCommand,
} from './easter-eggs';
import { chatCommand } from './chat';

function helpCommand(): CommandResult {
  const rows = commandRegistry
    .filter((cmd) => !cmd.hidden)
    .map((cmd) => [cmd.usage, cmd.description]);
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

export const commandRegistry: CommandDefinition[] = [
  {
    name: 'help',
    description: 'List all available commands',
    usage: 'help',
    aliases: ['h', '?'],
    menu: true,
    execute: () => helpCommand(),
  },
  {
    name: 'about',
    description: 'Professional summary',
    usage: 'about',
    aliases: ['summary', 'bio'],
    menu: true,
    execute: () => aboutCommand(),
  },
  {
    name: 'education',
    description: 'Education details and coursework',
    usage: 'education',
    aliases: ['edu'],
    menu: true,
    execute: () => educationCommand(),
  },
  {
    name: 'experience',
    description: 'Work experience (filter by company)',
    usage: 'experience [company]',
    aliases: ['exp', 'work'],
    menu: true,
    execute: (ctx) => experienceCommand(ctx.args),
  },
  {
    name: 'projects',
    description: 'Technical projects (filter by name)',
    usage: 'projects [name]',
    aliases: ['proj'],
    menu: true,
    execute: (ctx) => projectsCommand(ctx.args),
  },
  {
    name: 'skills',
    description: 'Technical skills by category',
    usage: 'skills [category]',
    aliases: ['sk'],
    menu: true,
    execute: (ctx) => skillsCommand(ctx.args),
  },
  {
    name: 'certifications',
    description: 'Certifications and achievements',
    usage: 'certifications',
    aliases: ['certs', 'awards'],
    menu: true,
    execute: () => certificationsCommand(),
  },
  {
    name: 'contact',
    description: 'Contact information and links',
    usage: 'contact',
    aliases: ['email', 'links'],
    menu: true,
    execute: () => contactCommand(),
  },
  {
    name: 'open',
    description: 'Open a profile link in your browser',
    usage: 'open [target]',
    aliases: [],
    execute: (ctx) => openCommand(ctx.args),
  },
  {
    name: 'timeline',
    description: 'Reverse-chronological career overview',
    usage: 'timeline',
    aliases: ['tl'],
    menu: true,
    execute: () => timelineCommand(),
  },
  {
    name: 'theme',
    description: 'Switch color theme',
    usage: 'theme [name]',
    aliases: [],
    execute: (ctx) => themeCommand(ctx.args),
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
    name: 'github',
    description: 'Live GitHub profile stats',
    usage: 'github',
    aliases: ['gh'],
    menu: true,
    execute: () => githubCommand(),
  },
  {
    name: 'chat',
    description: `Chat with AI about ${profile.firstName}`,
    usage: 'chat',
    aliases: ['ask', 'ai'],
    menu: true,
    execute: () => chatCommand(),
  },
  {
    name: 'clear',
    description: 'Clear the terminal',
    usage: 'clear',
    aliases: ['cls'],
    execute: () => ({ output: [], clear: true }),
  },
  // Easter eggs (hidden from help and menus)
  {
    name: 'sudo',
    description: '???',
    usage: 'sudo [command]',
    aliases: [],
    hidden: true,
    execute: (ctx) => sudoCommand(ctx.args),
  },
  {
    name: 'rm',
    description: '???',
    usage: 'rm',
    aliases: [],
    hidden: true,
    execute: () => rmCommand(),
  },
  {
    name: 'neofetch',
    description: '???',
    usage: 'neofetch',
    aliases: ['sysinfo'],
    hidden: true,
    execute: () => neofetchCommand(),
  },
  {
    name: 'hello',
    description: '???',
    usage: 'hello',
    aliases: ['hi', 'hey'],
    hidden: true,
    execute: () => helloCommand(),
  },
  {
    name: 'exit',
    description: '???',
    usage: 'exit',
    aliases: ['quit'],
    hidden: true,
    execute: () => exitCommand(),
  },
];
