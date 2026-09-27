import type { CommandContext, CommandOutput, CommandResult, VfsDir, VfsNode } from '../types';

function failure(message: string): CommandResult {
  return { output: [{ type: 'error', content: message }], status: 'error' };
}

function shownName(node: VfsNode): string {
  return `${node.name}${node.kind === 'dir' && node.path !== '/' ? '/' : ''}`;
}

export function pwdCommand(ctx: CommandContext): CommandResult {
  return { output: [{ type: 'text', content: ctx.session.cwd }] };
}

export function cdCommand(ctx: CommandContext): CommandResult {
  if (ctx.args.length > 1) return failure('cd: too many arguments');
  const input = ctx.args[0] || '~';
  const result = ctx.fs.resolve(ctx.session.cwd, input);
  if (result.error === 'ENOENT') return failure(`cd: no such file or directory: ${input}`);
  if (result.error || result.node?.kind !== 'dir') return failure(`cd: not a directory: ${input}`);
  ctx.session.cwd = result.path;
  return { output: [] };
}

export function lsCommand(ctx: CommandContext): CommandResult {
  const paths = ctx.args.length ? ctx.args : ['.'];
  const output: CommandOutput[] = [];
  let status: 'ok' | 'error' = 'ok';
  for (const [index, input] of paths.entries()) {
    if (index > 0) output.push({ type: 'text', content: '' });
    if (paths.length > 1) output.push({ type: 'text', content: `${input}:`, style: { bold: true } });
    const result = ctx.fs.resolve(ctx.session.cwd, input);
    if (result.error || !result.node) {
      status = 'error';
      output.push({ type: 'error', content: `ls: cannot access '${input}': No such file or directory` });
      continue;
    }
    const entries = result.node.kind === 'dir' ? result.node.children : [result.node];
    const specials = ctx.flags.all && result.node.kind === 'dir' ? ['./', '../'] : [];
    const width = Math.max(1, ...entries.filter((node) => node.kind === 'file').map((node) => node.kind === 'file' ? (node.binary ? 3 : String(node.size).length) : 0));
    for (const name of specials) {
      output.push({ type: 'text', content: ctx.flags.long ? `d  -  ${name}` : name, style: { color: 'primary' } });
    }
    for (const node of entries) {
      const name = shownName(node);
      const size = node.kind === 'dir' ? '-' : node.binary ? 'pdf' : String(node.size);
      output.push({
        type: 'text',
        content: ctx.flags.long ? `${node.kind === 'dir' ? `d  -  ${name}` : `-  ${size.padStart(width)}  ${name}`}` : name,
        ...(node.kind === 'dir' && { style: { color: 'primary' } }),
      });
    }
  }
  return { output, status };
}

export function catCommand(ctx: CommandContext): CommandResult {
  if (!ctx.args.length) return failure('usage: cat <path…>');
  const output: CommandOutput[] = [];
  let status: 'ok' | 'error' = 'ok';
  for (const input of ctx.args) {
    const result = ctx.fs.resolve(ctx.session.cwd, input);
    if (result.error || !result.node) {
      status = 'error';
      output.push({ type: 'error', content: `cat: ${input}: No such file or directory` });
    } else if (result.node.kind === 'dir') {
      status = 'error';
      output.push({ type: 'error', content: `cat: ${input}: Is a directory` });
    } else if (result.node.binary) {
      output.push({ type: 'text', content: "resume.pdf: PDF document — run 'resume' to download it" });
    } else {
      output.push(...result.node.render());
    }
  }
  return { output, status };
}

export function treeCommand(ctx: CommandContext): CommandResult {
  if (ctx.args.length > 1) return failure('tree: too many arguments');
  const input = ctx.args[0] || '.';
  const result = ctx.fs.resolve(ctx.session.cwd, input);
  if (result.error || !result.node) return failure(`tree: ${input}: No such file or directory`);
  const lines = [ctx.fs.display(result.path)];
  let directories = 0;
  let files = 0;
  function walk(dir: VfsDir, prefix: string) {
    dir.children.forEach((node, index) => {
      const last = index === dir.children.length - 1;
      lines.push(`${prefix}${last ? '└── ' : '├── '}${shownName(node)}`);
      if (node.kind === 'dir') {
        directories++;
        walk(node, `${prefix}${last ? '    ' : '│   '}`);
      } else files++;
    });
  }
  if (result.node.kind === 'dir') walk(result.node, '');
  else files = 1;
  lines.push('', `${directories} directories, ${files} files`);
  return { output: [{ type: 'lines', lines: lines.map((text) => ({ text })), showItems: false }] };
}

export function readOnlyCommand(name: string): () => CommandResult {
  return () => failure(`${name}: read-only file system — this portfolio is look-but-don't-touch 🙂`);
}
