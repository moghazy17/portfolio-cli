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
import { grepLines, headLines, tailLines, wcLines, sortLines } from '../shell/filters';
import { renderSynopsis } from '../shell/args';
import { catCommand, cdCommand, lsCommand, pwdCommand, readOnlyCommand, treeCommand } from './fs';
import type { CommandContext } from '../types';

function lineCount(ctx: CommandContext, name: 'head' | 'tail'): CommandResult {
  const raw = ctx.flags.lines ?? '10';
  const number = Number(raw);
  if (!/^[0-9]+$/.test(String(raw)) || !Number.isSafeInteger(number)) {
    return { output: [{ type: 'error', content: `${name}: invalid number of lines: '${raw}'` }], status: 'error' };
  }
  const input = ctx.stdin || [];
  return { output: [{ type: 'lines', lines: name === 'head' ? headLines(input, number) : tailLines(input, number) }] };
}

function grep(ctx: CommandContext): CommandResult {
  if (!ctx.args.length) {
    return { output: [{ type: 'error', content: `usage: ${renderSynopsis(commandRegistry.find((def) => def.name === 'grep')!)}` }], status: 'error' };
  }
  const result = grepLines(ctx.stdin || [], ctx.args.join(' '), ctx.flags);
  return { output: [{ type: 'lines', lines: result.lines, showItems: result.showItems }], status: result.status };
}

function helpCommand(): CommandResult {
  const rows = commandRegistry
    .filter((cmd) => !cmd.hidden && cmd.kind !== 'filter')
    .map((cmd) => [cmd.usage, cmd.description]);
  rows.push(['<cmd> | grep, head, tail, wc, sort', 'Pipes: filter any command output']);
  return {
    output: [
      { type: 'text', content: 'Available Commands:', style: { bold: true } },
      { type: 'table', headers: ['Command', 'Description'], rows },
      { type: 'divider' },
      {
        type: 'text',
        content: 'Tip: Tab completes, ↑/↓ browse history, pipes work: projects | grep rag',
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
    args: { positional: [{ name: 'company', complete: 'experience' }] },
    execute: (ctx) => experienceCommand(ctx.args),
  },
  {
    name: 'projects',
    description: 'Technical projects (filter by name)',
    usage: 'projects [name]',
    aliases: ['proj'],
    menu: true,
    args: { positional: [{ name: 'name', complete: 'projects' }] },
    execute: (ctx) => projectsCommand(ctx.args),
  },
  {
    name: 'skills',
    description: 'Technical skills by category',
    usage: 'skills [category]',
    aliases: ['sk'],
    menu: true,
    args: { positional: [{ name: 'category', complete: 'skills' }] },
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
    args: { positional: [{ name: 'target', complete: 'open-targets' }] },
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
    args: { positional: [{ name: 'name', complete: 'themes' }] },
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
    execute: (ctx) => githubCommand(ctx.signal),
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
  {
    name: 'ls', description: 'List files and folders', usage: 'ls [-a] [-l] [path…]', aliases: [],
    args: {
      flags: [
        { short: 'a', long: 'all', description: 'Include . and ..' },
        { short: 'l', long: 'long', description: 'Show type and size' },
      ],
      positional: [{ name: 'path', variadic: true, complete: 'path' }],
    },
    man: { description: 'List files and folders in the portfolio.', examples: ['ls', 'ls -l projects'] },
    execute: lsCommand,
  },
  {
    name: 'cd', description: 'Change current folder', usage: 'cd [path]', aliases: [],
    args: { positional: [{ name: 'path', complete: 'dir' }] },
    man: { description: 'Change the current folder.', examples: ['cd projects', 'cd ~'] },
    execute: cdCommand,
  },
  {
    name: 'pwd', description: 'Print current folder', usage: 'pwd', aliases: [],
    man: { description: 'Print the absolute current folder path.', examples: ['pwd', 'cd projects && pwd'] },
    execute: pwdCommand,
  },
  {
    name: 'cat', description: 'Read a file', usage: 'cat <path…>', aliases: [],
    args: { positional: [{ name: 'path', required: true, variadic: true, complete: 'path' }] },
    man: { description: 'Show the contents of one or more files.', examples: ['cat about.md', 'cat projects/example.md'] },
    execute: catCommand,
  },
  {
    name: 'tree', description: 'Show folder tree', usage: 'tree [path]', aliases: [],
    args: { positional: [{ name: 'path', complete: 'dir' }] },
    man: { description: 'Show files and folders as a tree.', examples: ['tree', 'tree projects'] },
    execute: treeCommand,
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
    execute: (ctx) => rmCommand(ctx.args),
  },
  ...['mkdir', 'touch', 'mv', 'cp', 'rmdir', 'nano', 'vim', 'vi', 'chmod'].map((name): CommandDefinition => ({
    name, description: 'Read-only file system', usage: name, aliases: [], hidden: true,
    execute: readOnlyCommand(name),
  })),
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
  {
    name: 'grep', description: 'Find lines containing literal text', usage: 'grep [-i] [-v] [-c] [-h] <pattern>',
    aliases: [], kind: 'filter', surfaces: ['web', 'ssh', 'curl'],
    args: { flags: [
      { short: 'i', long: 'ignore-case', description: 'Ignore case' },
      { short: 'v', long: 'invert-match', description: 'Invert matches' },
      { short: 'c', long: 'count', description: 'Count matches' },
      { short: 'h', long: 'no-filename', description: 'Hide item names' },
    ], positional: [{ name: 'pattern', required: true }] },
    man: { description: 'Filter lines by a literal substring.', examples: ['projects | grep React', 'skills | grep -i typescript'] },
    execute: grep,
  },
  {
    name: 'head', description: 'Show the first lines', usage: 'head [-n N]', aliases: [],
    kind: 'filter', surfaces: ['web', 'ssh', 'curl'],
    args: { flags: [{ short: 'n', long: 'lines', value: 'number', description: 'Number of lines' }] },
    man: { description: 'Show the first N lines of piped input.', examples: ['projects | head', 'skills | head -n 3'] },
    execute: (ctx) => lineCount(ctx, 'head'),
  },
  {
    name: 'tail', description: 'Show the last lines', usage: 'tail [-n N]', aliases: [],
    kind: 'filter', surfaces: ['web', 'ssh', 'curl'],
    args: { flags: [{ short: 'n', long: 'lines', value: 'number', description: 'Number of lines' }] },
    man: { description: 'Show the last N lines of piped input.', examples: ['projects | tail', 'skills | tail -n 3'] },
    execute: (ctx) => lineCount(ctx, 'tail'),
  },
  {
    name: 'wc', description: 'Count lines, words and characters', usage: 'wc [-l] [-w] [-c]', aliases: [],
    kind: 'filter', surfaces: ['web', 'ssh', 'curl'],
    args: { flags: [
      { short: 'l', long: 'lines', description: 'Count lines' },
      { short: 'w', long: 'words', description: 'Count words' },
      { short: 'c', long: 'chars', description: 'Count characters' },
    ] },
    man: { description: 'Count piped text.', examples: ['projects | wc', 'skills | wc -l'] },
    execute: (ctx) => ({ output: [{ type: 'lines', lines: wcLines(ctx.stdin || [], ctx.flags), showItems: false }] }),
  },
  {
    name: 'sort', description: 'Sort lines', usage: 'sort [-r] [-u]', aliases: [],
    kind: 'filter', surfaces: ['web', 'ssh', 'curl'],
    args: { flags: [
      { short: 'r', long: 'reverse', description: 'Reverse order' },
      { short: 'u', long: 'unique', description: 'Remove duplicate text' },
    ] },
    man: { description: 'Sort piped lines by code point.', examples: ['skills | sort', 'projects | sort -ru'] },
    execute: (ctx) => ({ output: [{ type: 'lines', lines: sortLines(ctx.stdin || [], ctx.flags) }] }),
  },
];
