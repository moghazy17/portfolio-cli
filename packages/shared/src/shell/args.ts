import type { CommandDefinition, CommandOutput, FlagSpec } from '../types';

export type ParsedArgs = { args: string[]; flags: Record<string, string | boolean> } | { error: string };

const key = (flag: FlagSpec) => flag.long || flag.short || '';

export function renderSynopsis(def: CommandDefinition): string {
  const flags = (def.args?.flags || []).map((flag) => {
    const name = flag.short ? `-${flag.short}` : `--${flag.long}`;
    return `[${name}${flag.value ? ' N' : ''}]`;
  });
  const positional = (def.args?.positional || []).map((arg) => {
    const name = `${arg.name}${arg.variadic ? '…' : ''}`;
    return arg.required ? `<${name}>` : `[${name}]`;
  });
  return [def.name, ...flags, ...positional].join(' ');
}

export function helpUsage(def: CommandDefinition): CommandOutput[] {
  return [
    { type: 'text', content: `usage: ${renderSynopsis(def)}` },
    { type: 'text', content: `See 'man ${def.name}' for details.` },
  ];
}

export function parseArgs(def: CommandDefinition, argv: string[]): ParsedArgs {
  if (!def.args?.flags) return { args: [...argv], flags: {} };
  const flags: Record<string, string | boolean> = {};
  const args: string[] = [];
  let options = true;
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (!options || token === '-' || !token.startsWith('-')) {
      args.push(token);
      continue;
    }
    if (token === '--') {
      options = false;
      continue;
    }
    if ((def.name === 'head' || def.name === 'tail') && /^-[0-9]+$/.test(token)) {
      flags.lines = token.slice(1);
      continue;
    }
    if (token.startsWith('--')) {
      const equal = token.indexOf('=');
      const name = token.slice(2, equal < 0 ? undefined : equal);
      const flag = def.args.flags.find((item) => item.long === name);
      if (!flag) return { error: `${def.name}: unknown option '${token}'` };
      if (flag.value) flags[key(flag)] = equal >= 0 ? token.slice(equal + 1) : argv[++index] ?? '';
      else if (equal >= 0) return { error: `${def.name}: unknown option '${token}'` };
      else flags[key(flag)] = true;
      continue;
    }
    for (let offset = 1; offset < token.length; offset++) {
      const short = token[offset];
      const flag = def.args.flags.find((item) => item.short === short);
      if (!flag) return { error: `${def.name}: unknown option '-${short}'` };
      if (flag.value) {
        flags[key(flag)] = token.slice(offset + 1) || argv[++index] || '';
        break;
      }
      flags[key(flag)] = true;
    }
  }
  return { args, flags };
}
