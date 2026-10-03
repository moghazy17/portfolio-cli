import type { CommandContext, CommandOutput, CommandResult, ProgressOutput } from '../types';
import { cvData, profile, site } from '../content';

function host(origin: string): string {
  try {
    return origin ? new URL(origin).host : site.title;
  } catch {
    return site.title;
  }
}

export function hireMe(ctx: CommandContext): CommandResult {
  const email = cvData.contact.email;
  const mailto = `mailto:${email}?subject=${encodeURIComponent(`Hiring inquiry via ${host(ctx.origin)}`)}&body=${encodeURIComponent(`Hi ${profile.firstName},\n\nI came across your portfolio and would love to talk about an opportunity.\n\n`)}`;
  const prompt = '[sudo] password for visitor: ';
  const frames: Array<{ delayMs: number; output: CommandOutput[] }> = [
    { delayMs: 150, output: [{ type: 'text', content: prompt, style: { bold: true } }] },
    { delayMs: 300, output: [{ type: 'text', content: `${prompt}****`, style: { bold: true } }] },
    { delayMs: 300, output: [{ type: 'text', content: `${prompt}********`, style: { bold: true } }] },
  ];
  const progress: ProgressOutput[] = [];
  for (const label of ['verifying credentials', 'checking coffee supply', 'granting access']) {
    for (const value of [0, 0.5, 1]) {
      const next = value === 0 ? [...progress, { type: 'progress' as const, label, value }] : progress.map((item) => item.label === label ? { ...item, value } : item);
      progress.splice(0, progress.length, ...next);
      frames.push({
        delayMs: 200,
        output: [{ type: 'text', content: `${prompt}********`, style: { bold: true } }, ...progress.map((item) => ({ ...item }))],
      });
    }
  }
  frames.push({
    delayMs: 450,
    output: [
      { type: 'text', content: `${prompt}********`, style: { bold: true } },
      ...progress.map((item) => ({ ...item })),
      { type: 'text', content: 'ACCESS GRANTED', style: { bold: true, color: 'success' } },
    ],
  });
  return {
    sequence: frames,
    output: [
      { type: 'text', content: `Welcome aboard. Here's how to reach ${profile.firstName}:`, style: { bold: true } },
      { type: 'text', content: cvData.name },
      { type: 'text', content: `Email:    ${email}` },
      { type: 'link', text: 'LinkedIn', url: cvData.contact.linkedin },
      { type: 'link', text: 'Send an email', url: mailto },
    ],
  };
}

export function sudoCommand(args: string[], ctx: CommandContext): CommandResult {
  if (args[0]?.toLowerCase().startsWith('hire')) return hireMe(ctx);
  return {
    status: 'error',
    output: [
      { type: 'text', content: `[sudo] password for visitor: `, style: { bold: true } },
      { type: 'text', content: 'Permission denied. Nice try though.' },
      { type: 'text', content: 'Hint: try "sudo hire-me"', style: { dim: true } },
    ],
  };
}

export function rmCommand(args: string[] = []): CommandResult {
  if (args.length && !(args.length === 2 && /^-[rRfF]{2}$/.test(args[0]) && /r/i.test(args[0]) && /f/i.test(args[0]) && ['/', '/*', '~'].includes(args[1]))) {
    return { output: [{ type: 'error', content: "rm: read-only file system — this portfolio is look-but-don't-touch 🙂" }], status: 'error' };
  }
  return {
    output: [
      { type: 'text', content: 'rm: cannot remove \'/\': Permission denied', style: { color: 'error' } },
      { type: 'text', content: 'Nice try. This portfolio is indestructible.', style: { bold: true } },
      { type: 'text', content: '(╯°□°)╯︵ ┻━┻  ...  ┬─┬ ノ( ゜-゜ノ)', style: { dim: true } },
    ],
    status: 'error',
  };
}

export function neofetchCommand(): CommandResult {
  const skills = cvData.skills.flatMap((s) => s.skills).slice(0, 8).join(', ');
  const yearsActive = new Date().getFullYear() - 2021;

  const info = [
    `visitor@ahmed-portfolio`,
    `──────────────────────`,
    `Name:      ${cvData.name}`,
    `Role:      ${profile.label}`,
    `Location:  ${cvData.contact.location}`,
    `Education: ${cvData.education.institution}`,
    `Shell:     portfolio-cli v1.0.0`,
    `Uptime:    ${yearsActive} years in tech`,
    `Repos:     github.com/${cvData.contact.github.replace('https://github.com/', '')}`,
    `Stack:     ${skills}`,
    `Off-hours: 🕷️  ⚽  🎬`,
    ``,
    `  ███  ███  ███  ███  ███  ███  ███  ███`,
  ];

  return {
    output: [
      { type: 'ascii', content: info.join('\n'), style: { color: 'primary' } },
    ],
  };
}

export function helloCommand(): CommandResult {
  const greetings = [
    `Hello there! Welcome to ${profile.firstName}'s portfolio.`,
    'Hey! Glad you stopped by.',
    'Hi! Curious minds are always welcome here.',
    'Ahlan! (That\'s "hello" in Arabic.)',
  ];
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];

  return {
    output: [
      { type: 'text', content: greeting, style: { bold: true } },
      { type: 'text', content: `Type "help" to see what you can explore, or try "about" to learn about ${profile.firstName}.`, style: { dim: true } },
    ],
  };
}

export function exitCommand(): CommandResult {
  return {
    output: [
      { type: 'text', content: 'There is no escape from this portfolio...', style: { bold: true } },
      { type: 'text', content: 'But seriously, thanks for visiting! Feel free to reach out:', style: { dim: true } },
      { type: 'link', text: 'Email', url: `mailto:${cvData.contact.email}` },
      { type: 'link', text: 'LinkedIn', url: cvData.contact.linkedin },
    ],
  };
}

const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const SPIDEY_QUIPS = [
  'With great power comes great responsibility to validate your training split.',
  'Spidey-sense tingling: a data leak between train and test.',
  'Your friendly neighborhood ML engineer. No radioactive spiders were used in training.',
  'Hanging upside down until the model converges.',
  'Not every hero wears a mask. Some just wear headphones and fix flaky pipelines.',
];

export function spideyCommand(): CommandResult {
  const web = (length: number) => `  🕷️${'─'.repeat(length)}${length >= 24 ? ' THWIP!' : ''}`;
  return {
    sequence: [6, 12, 18, 24].map((length) => ({ delayMs: 90, output: [{ type: 'text' as const, content: web(length), style: { color: 'error', bold: true } }] })),
    output: [
      { type: 'text', content: web(24), style: { color: 'error', bold: true } },
      { type: 'text', content: pick(SPIDEY_QUIPS), style: { bold: true } },
      { type: 'text', content: `Swing by any time:`, style: { dim: true } },
      { type: 'link', text: 'Send a web-mail', url: `mailto:${cvData.contact.email}` },
    ],
  };
}

const GARNET = '#e0457b';
const BLAU = '#5b9be8';

const BARCA_LINES = [
  'Més que un dev.',
  'Tiki-taka for data: short passes from raw rows to features to model to insight.',
  'Possession-based modelling: keep the data, wait for the opening.',
  'La Masia taught passing. University taught gradient descent.',
];

export function viscaCommand(): CommandResult {
  return {
    output: [
      { type: 'text', content: '━━━  VISCA EL BARÇA  ━━━', style: { color: GARNET, bold: true } },
      { type: 'text', content: `  ${profile.firstName.toUpperCase()}  1 — 0  MESSY DATA`, style: { color: BLAU, bold: true } },
      { type: 'text', content: "  ⚽ 17'  goal (assist: pandas)", style: { dim: true } },
      { type: 'text', content: pick(BARCA_LINES) },
      { type: 'text', content: 'Matchday? Ask about work at half-time.', style: { dim: true } },
    ],
  };
}

export function screensaverCommand(args: string[]): CommandResult {
  const off = /^(off|stop|no|false|0)$/i.test(args[0] ?? '');
  return {
    screensaver: !off,
    output: [{ type: 'text', content: off
      ? 'Screensaver off.'
      : 'Screensaver on: the rain starts after a minute without input. Run "screensaver off" to stop it.', style: { dim: off } }],
  };
}
