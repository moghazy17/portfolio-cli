import type { CommandContext, CommandDefinition, CommandResult, SectionOutput } from '../types';
import { renderSynopsis } from '../shell/args';

function synopsis(def: CommandDefinition): string {
  const rendered = renderSynopsis(def);
  return !def.args && def.usage !== def.name ? def.usage : rendered;
}

export function renderManPage(def: CommandDefinition): SectionOutput[] {
  const sections: SectionOutput[] = [
    { type: 'section', title: 'NAME', children: [{ type: 'text', content: `${def.name} — ${def.description}` }] },
    { type: 'section', title: 'SYNOPSIS', children: [{ type: 'text', content: synopsis(def) }] },
    { type: 'section', title: 'DESCRIPTION', children: [{ type: 'text', content: def.man!.description }] },
  ];
  const flags = def.args?.flags || [];
  if (flags.length) {
    sections.push({
      type: 'section', title: 'OPTIONS', children: [{
        type: 'table', headers: ['Option', 'Description'], rows: flags.map((flag) => [
          [flag.short && `-${flag.short}`, flag.long && `--${flag.long}`].filter(Boolean).join(', ') + (flag.value ? ' N' : ''),
          flag.description,
        ]),
      }],
    });
  }
  sections.push({ type: 'section', title: 'EXAMPLES', children: [{ type: 'list', items: def.man!.examples }] });
  if (def.aliases.length) {
    sections.push({ type: 'section', title: 'ALIASES', children: [{ type: 'text', content: def.aliases.join(', ') }] });
  }
  return sections;
}

export function manCommand(ctx: CommandContext, registry: CommandDefinition[]): CommandResult {
  const name = ctx.args[0];
  if (!name) {
    return {
      status: 'error',
      output: [
        { type: 'text', content: 'What manual page do you want?' },
        { type: 'text', content: "For example, try 'man projects'." },
      ],
    };
  }
  const def = registry.find((entry) => entry.name === name.toLowerCase() || entry.aliases.includes(name.toLowerCase()));
  if (!def || def.hidden) return { status: 'error', output: [{ type: 'error', content: `No manual entry for ${name}` }] };
  return { output: renderManPage(def) };
}
