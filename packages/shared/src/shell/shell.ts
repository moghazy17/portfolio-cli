import type {
  CommandContext, CommandDefinition, CommandResult, Line, ShellResult, ShellSession, Surface,
  UnknownCommandHandler, VfsPath,
} from '../types';
import { commandRegistry } from '../commands/registry';
import { content } from '../content';
import { buildFileSystem } from '../vfs';
import { parseArgs, helpUsage, renderSynopsis } from './args';
import { toLines } from './lines';
import { parseShell, type Pipeline, type Stage } from './parser';
import { suggestCommand } from './suggest';
import { defaultUnknownCommandHandler } from './unknown';
import { complete, type Completion } from './completion';
import { tokenize } from './tokenizer';

export interface ShellOptions {
  surface: Surface;
  origin: string;
  onUnknownCommand?: UnknownCommandHandler;
  initialCwd?: VfsPath;
  registry?: CommandDefinition[];
}

export interface Shell {
  run(line: string, opts?: { signal?: AbortSignal }): Promise<ShellResult>;
  complete(line: string, cursor?: number): Completion;
  prompt(): { user: 'visitor'; host: 'portfolio'; cwd: string };
  readonly session: Readonly<ShellSession>;
}

const effectKeys = ['clear', 'mode', 'openUrl', 'theme', 'welcome', 'download', 'sequence', 'ask'] as const;

function failure(message: string): CommandResult {
  return { output: [{ type: 'error', content: message }], status: 'error' };
}

function findCommand(registry: CommandDefinition[], name: string): CommandDefinition | undefined {
  return registry.find((def) => def.name === name || def.aliases.includes(name));
}

// Routes on the leading command candidate without tokenizing the whole line, so free
// text such as `what's his stack?` reaches the unknown-command hook instead of failing
// as an unterminated quote. Operators end the candidate even without surrounding spaces.
function routeWord(line: string, registry: CommandDefinition[]): string {
  const raw = line.match(/^(?:\\.|[^\s|&;<>\\])*/)![0];
  const word = raw.toLowerCase();
  if (!raw || findCommand(registry, word)) return word;
  const tokenized = tokenize(raw);
  if ('error' in tokenized || tokenized.tokens.length !== 1) return word;
  const name = tokenized.tokens[0].value.toLowerCase();
  return findCommand(registry, name) ? name : word;
}

function mergeEffects(target: ShellResult, source: CommandResult): void {
  for (const key of effectKeys) {
    if (source[key] !== undefined) Object.assign(target, { [key]: source[key] });
  }
}

export function createShell(options: ShellOptions): Shell {
  const registry = options.registry || commandRegistry;
  const fs = () => buildFileSystem(content);
  const session: ShellSession = { cwd: options.initialCwd || '/', lastStatus: 'ok' };
  const unknown = options.onUnknownCommand || defaultUnknownCommandHandler;

  async function runStage(stage: Stage, stdin: Line[] | undefined, signal: AbortSignal): Promise<CommandResult | 'cancelled'> {
    const def = findCommand(registry, stage.name);
    if (!def) {
      const suggestion = suggestCommand(stage.name, registry);
      return { output: [
        { type: 'error', content: `${stage.name}: command not found` },
        ...(suggestion ? [{ type: 'text' as const, content: `did you mean \`${suggestion}\`?` }] : []),
      ], status: 'error' };
    }
    if (def.surfaces && !def.surfaces.includes(options.surface)) return failure(`${def.name}: not available on this surface`);
    const terminator = stage.argv.indexOf('--');
    if (!def.hidden && stage.argv.slice(0, terminator < 0 ? undefined : terminator).includes('--help')) {
      return { output: helpUsage(def), status: 'ok' };
    }
    const parsed = parseArgs(def, stage.argv);
    if ('error' in parsed) {
      return { output: [
        { type: 'error', content: parsed.error },
        { type: 'text', content: `usage: ${renderSynopsis(def)}` },
      ], status: 'error' };
    }
    const ctx: CommandContext = {
      args: parsed.args, flags: parsed.flags, argv: stage.argv,
      session, surface: options.surface, origin: options.origin,
      signal, fs: fs(), ...(stdin && { stdin }),
    };
    try {
      const result = await def.execute(ctx);
      return signal.aborted ? 'cancelled' : result;
    } catch (error) {
      if (signal.aborted) return 'cancelled';
      console.error(error);
      return failure(`${def.name}: something went wrong`);
    }
  }

  async function runPipeline(pipeline: Pipeline, signal: AbortSignal): Promise<CommandResult | 'cancelled'> {
    let input: Line[] | undefined;
    let showItems = false;
    for (const [index, stage] of pipeline.stages.entries()) {
      const result = await runStage(stage, input, signal);
      if (result === 'cancelled' || signal.aborted) return 'cancelled';
      if (index === pipeline.stages.length - 1) {
        if (input !== undefined && result.output.length === 1 && result.output[0].type === 'lines') {
          const node = result.output[0];
          return { output: [{ ...node, showItems: stage.name === 'wc' ? false : stage.name === 'grep' ? node.showItems : showItems }], status: result.status || 'ok' };
        }
        return result;
      }
      input = toLines(result.output);
      if (stage.name === 'wc' || (stage.name === 'grep' && result.output[0]?.type === 'lines' && !result.output[0].showItems)) showItems = false;
      else if (stage.name === 'grep') showItems = true;
    }
    return { output: [] };
  }

  async function run(line: string, opts: { signal?: AbortSignal } = {}): Promise<ShellResult> {
    const signal = opts.signal || new AbortController().signal;
    if (signal.aborted) return { output: [], cancelled: true };
    try {
      const trimmed = line.trim();
      if (!trimmed) {
        session.lastStatus = 'ok';
        return { output: [] };
      }
      if (line.length > 1000) {
        session.lastStatus = 'error';
        return failure('error: input too long (max 1000 characters)');
      }
      const word = routeWord(trimmed, registry);
      if (word && !findCommand(registry, word)) {
        const suggestion = /^\S+$/.test(trimmed) ? suggestCommand(word, registry) : undefined;
        const result = await unknown({ raw: line, word, suggestion }, {
          session, surface: options.surface, origin: options.origin, signal, fs: fs(),
        });
        if (signal.aborted) return { output: [], cancelled: true };
        session.lastStatus = result.status || 'ok';
        return result;
      }
      const parsed = parseShell(line, (name) => findCommand(registry, name)?.kind || (findCommand(registry, name) ? 'command' : undefined));
      if ('error' in parsed) {
        session.lastStatus = 'error';
        return failure(parsed.error.message);
      }
      const merged: ShellResult = { output: [], status: 'ok' };
      for (const pipeline of parsed.chain.pipelines) {
        const result = await runPipeline(pipeline, signal);
        if (result === 'cancelled' || signal.aborted) return { output: [], cancelled: true };
        // A screen reset hides everything printed before it, as in a real terminal.
        if (result.clear || result.welcome) {
          merged.output = [];
          delete merged.sequence;
        }
        merged.output.push(...result.output);
        mergeEffects(merged, result);
        merged.status = result.status || 'ok';
        session.lastStatus = merged.status;
        if (merged.status === 'error') break;
      }
      return merged;
    } catch (error) {
      if (signal.aborted) return { output: [], cancelled: true };
      console.error(error);
      session.lastStatus = 'error';
      return failure(`${line.trim().split(/\s+/)[0] || 'shell'}: something went wrong`);
    }
  }

  return {
    run,
    complete: (line, cursor = line.length) => complete(line, cursor, registry, session, fs()),
    prompt: () => ({ user: 'visitor', host: 'portfolio', cwd: fs().display(session.cwd) }),
    get session() { return session; },
  };
}
