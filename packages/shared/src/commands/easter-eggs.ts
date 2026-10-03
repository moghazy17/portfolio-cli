import type { CommandContext, CommandOutput, CommandResult, ProgressOutput } from '../types';
import { cvData, profile, site } from '../content';
import { BARCA_FIXTURES_URL, formatFixture } from '../barca';

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

const SPIDEY_QUOTES = [
  'With great power comes great responsibility.',
  'Your friendly neighborhood Spider-Man.',
  'Face it, Tiger... you just hit the jackpot!',
  'Anyone can wear the mask.',
];

export function spideyCommand(): CommandResult {
  const web = (length: number) => `  🕷️${'─'.repeat(length)}${length >= 24 ? ' THWIP!' : ''}`;
  return {
    fx: 'web',
    sequence: [6, 12, 18, 24].map((length) => ({ delayMs: 90, output: [{ type: 'text' as const, content: web(length), style: { color: 'error', bold: true } }] })),
    output: [
      { type: 'text', content: web(24), style: { color: 'error', bold: true } },
      { type: 'text', content: pick(SPIDEY_QUOTES), style: { bold: true } },
    ],
  };
}

const GARNET = '#e0457b';
const BLAU = '#5b9be8';

export async function viscaCommand(ctx: CommandContext): Promise<CommandResult> {
  const banner: CommandOutput = { type: 'text', content: '━━━  VISCA EL BARÇA  ━━━', style: { color: GARNET, bold: true } };
  const ending: CommandOutput = { type: 'text', content: 'Força Barça!', style: { color: BLAU, bold: true } };
  try {
    const fixture = await ctx.live?.fixture?.(ctx.signal);
    if (ctx.signal.aborted || !fixture) throw new Error('Fixture unavailable');
    const formatted = formatFixture(fixture, {
      now: new Date(),
      ...(ctx.surface !== 'web' && { timeZone: 'UTC' }),
    });
    return {
      fx: 'confetti',
      output: [
        banner,
        { type: 'text', content: formatted.match, style: { color: BLAU, bold: true } },
        { type: 'text', content: formatted.competition },
        { type: 'text', content: `${formatted.kickoff} (${ctx.surface === 'web' ? 'your time' : 'UTC'})` },
        { type: 'text', content: formatted.relative, style: { dim: true } },
        ending,
      ],
    };
  } catch {
    return {
      fx: 'confetti',
      output: [
        banner,
        { type: 'text', content: 'Fixture unavailable', style: { dim: true } },
        { type: 'link', text: BARCA_FIXTURES_URL, url: BARCA_FIXTURES_URL },
        ending,
      ],
    };
  }
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
