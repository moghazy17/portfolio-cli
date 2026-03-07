import type { CommandResult } from '../types';
import { cvData } from '../data';

export function sudoCommand(args: string[]): CommandResult {
  const fullCmd = args.join(' ').toLowerCase();

  if (fullCmd.includes('hire')) {
    return {
      output: [
        { type: 'text', content: 'Processing hire request...', style: { color: 'success' } },
        { type: 'text', content: '█████████████████████████████████ 100%', style: { color: 'success' } },
        { type: 'divider' },
        { type: 'text', content: 'Request approved! Ahmed would love to hear from you.', style: { bold: true } },
        { type: 'link', text: 'Send an email', url: `mailto:${cvData.contact.email}` },
        { type: 'link', text: 'Connect on LinkedIn', url: cvData.contact.linkedin },
      ],
    };
  }

  return {
    output: [
      { type: 'text', content: `[sudo] password for visitor: `, style: { bold: true } },
      { type: 'text', content: 'Permission denied. Nice try though.' },
      { type: 'text', content: 'Hint: try "sudo hire ahmed"', style: { dim: true } },
    ],
  };
}

export function rmCommand(): CommandResult {
  return {
    output: [
      { type: 'text', content: 'rm: cannot remove \'/\': Permission denied', style: { color: 'error' } },
      { type: 'text', content: 'Nice try. This portfolio is indestructible.', style: { bold: true } },
      { type: 'text', content: '(╯°□°)╯︵ ┻━┻  ...  ┬─┬ ノ( ゜-゜ノ)', style: { dim: true } },
    ],
  };
}

export function neofetchCommand(): CommandResult {
  const skills = cvData.skills.flatMap((s) => s.skills).slice(0, 8).join(', ');
  const yearsActive = new Date().getFullYear() - 2021;

  const info = [
    `visitor@ahmed-portfolio`,
    `──────────────────────`,
    `Name:      ${cvData.name}`,
    `Role:      Data Science & ML Engineer`,
    `Location:  ${cvData.contact.location}`,
    `Education: ${cvData.education.institution}`,
    `Shell:     portfolio-cli v1.0.0`,
    `Uptime:    ${yearsActive} years in tech`,
    `Repos:     github.com/${cvData.contact.github.replace('https://github.com/', '')}`,
    `Stack:     ${skills}`,
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
    'Hello there! Welcome to Ahmed\'s portfolio.',
    'Hey! Glad you stopped by.',
    'Hi! Curious minds are always welcome here.',
    'Ahlan! (That\'s "hello" in Arabic.)',
  ];
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];

  return {
    output: [
      { type: 'text', content: greeting, style: { bold: true } },
      { type: 'text', content: 'Type "help" to see what you can explore, or try "about" to learn about Ahmed.', style: { dim: true } },
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
