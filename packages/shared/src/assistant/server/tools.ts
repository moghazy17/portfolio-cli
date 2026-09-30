import { tool } from 'ai';
import { z } from 'zod';
import { validateAssistantCommandLine } from '../allowlist';
import { commandRegistry } from '../../commands/registry';
import { createShell } from '../../shell/shell';
import { toLines } from '../../shell/lines';
import type { CommandOutput, ShellResult } from '../../types';
import { isExcludedRepo } from '../../exclusion';
import { listRepos, lookupTech } from '../../inventory/lookup';
import type { InventorySnapshot } from '../../inventory/types';

export interface AssistantDeps {
  inventory(): Promise<InventorySnapshot | null>;
  live?: { currentRepos(): Promise<Array<{ name: string; fork?: boolean; topics?: string[] }>> };
  surface?: 'web' | 'ssh';
  origin?: string;
  signal?: AbortSignal;
  onCommand?: (command: { id: string; commandLine: string; output: CommandOutput[]; status: 'ok' | 'error' }) => void;
}

export function createToolBudget(max = 5) {
  let used = 0;
  return { get used() { return used; }, get exhausted() { return used >= max; }, take() {
    if (used >= max) return false;
    used += 1;
    return true;
  } };
}
export type ToolBudget = ReturnType<typeof createToolBudget>;

export function capResult(value: object): Record<string, unknown> {
  if (JSON.stringify(value).length <= 2000) return value as Record<string, unknown>;
  const copy = structuredClone(value) as Record<string, unknown>;
  for (const key of ['untrusted_text', 'repos', 'evidence', 'readmeOnly']) {
    const field = copy[key];
    if (typeof field === 'string') copy[key] = field.slice(0, 100);
    if (Array.isArray(field)) {
      for (const item of field) if (item && typeof item === 'object' && 'untrusted_text' in item) item.untrusted_text = String(item.untrusted_text).slice(0, 100);
      while (JSON.stringify({ ...copy, truncated: true }).length > 2000 && field.length) field.pop();
    }
  }
  return JSON.stringify({ ...copy, truncated: true }).length <= 2000 ? { ...copy, truncated: true } : { truncated: true };
}

export function createAssistantTools(deps: AssistantDeps, budget = createToolBudget()) {
  const available = async () => {
    const snapshot = await deps.inventory();
    if (!snapshot) return null;
    if (!deps.live) return snapshot;
    const current = await deps.live.currentRepos();
    const allowed = new Set(current.filter((repo) => !isExcludedRepo(repo)).map((repo) => repo.name));
    const repos = Object.fromEntries(Object.entries(snapshot.repos).filter(([name]) => allowed.has(name)));
    const techs = Object.fromEntries(Object.entries(snapshot.techs).map(([id, tech]) => [id, { ...tech, evidence: tech.evidence.filter((item) => allowed.has(item.repo)) }]).filter(([, tech]) => (tech as InventorySnapshot['techs'][string]).evidence.length));
    return { ...snapshot, repos, techs,
      packages: Object.fromEntries(Object.entries(snapshot.packages).map(([key, items]) => [key, items.filter((item) => allowed.has(item.repo))])),
      readmeMentions: Object.fromEntries(Object.entries(snapshot.readmeMentions).map(([key, items]) => [key, items.filter((item) => allowed.has(item.repo))])),
      stats: { ...snapshot.stats, repoCount: Object.keys(repos).length, techCount: Object.keys(techs).length } } as InventorySnapshot;
  };
  const execute = <T extends object>(fn: () => Promise<T>) => async () => {
    if (!budget.take()) return { budgetExhausted: true };
    try { return capResult(await fn()); }
    catch { return { unavailable: true, what: deps.live ? 'github' : 'inventory' }; }
  };
  return {
    run_command: tool({
      description: 'Run one allowed portfolio command or a short pipeline to show sourced portfolio content.',
      inputSchema: z.object({ commandLine: z.string().min(1).max(200) }),
      execute: async ({ commandLine }) => execute(async () => {
        const validation = validateAssistantCommandLine(commandLine, commandRegistry);
        if (!validation.ok) return { ok: false, reason: validation.reason === 'syntax' ? 'parse_error' : 'not_allowed', detail: validation.detail };
        const timeout = AbortSignal.timeout(5000);
        const signal = deps.signal ? AbortSignal.any([deps.signal, timeout]) : timeout;
        let onAbort: () => void = () => undefined;
        const cancelled = new Promise<ShellResult>((resolve) => {
          onAbort = () => resolve({ output: [], cancelled: true });
          signal.addEventListener('abort', onAbort, { once: true });
          if (signal.aborted) onAbort();
        });
        let result: ShellResult;
        try {
          result = await Promise.race([
            createShell({ surface: deps.surface ?? 'web', origin: deps.origin ?? '' }).run(commandLine, { signal }),
            cancelled,
          ]);
        } finally {
          signal.removeEventListener('abort', onAbort);
        }
        if (signal.aborted || result.cancelled) return { ok: false, reason: 'failed', detail: 'Command timed out or was cancelled.' };
        if (['clear', 'mode', 'openUrl', 'theme', 'welcome', 'download', 'sequence', 'ask'].some((key) => key in result)) {
          return { ok: false, reason: 'effect_blocked', detail: 'Command produced an unsupported effect.' };
        }
        const status = result.status === 'error' ? 'error' : 'ok';
        if (status === 'ok' || result.output.length) deps.onCommand?.({ id: crypto.randomUUID(), commandLine, output: result.output, status });
        if (status === 'error') return { ok: false, reason: 'failed', detail: toLines(result.output).map((line) => line.text).join('\n').slice(0, 1800) };
        return { ok: true, commandLine, text: toLines(result.output).map((line) => line.text).join('\n').slice(0, 1800) };
      })(),
    }),
    lookup_tech: tool({
      description: 'Find code-level technology evidence, including repo, file and last activity. README mentions are separate from code evidence.',
      inputSchema: z.object({ query: z.string().min(1).max(60) }),
      execute: async ({ query }) => execute(async () => {
        const snapshot = await available();
        return snapshot ? lookupTech(snapshot, query) : { unavailable: true, what: 'inventory' };
      })(),
    }),
    list_repos: tool({
      description: 'List included public repositories, optionally filtered by technology, topic or recency.',
      inputSchema: z.object({ tech: z.string().optional(), topic: z.string().optional(), activeWithinDays: z.number().positive().optional(), limit: z.number().int().min(1).max(10).optional() }),
      execute: async (filters) => execute(async () => {
        const snapshot = await available();
        return snapshot ? listRepos(snapshot, filters) : { unavailable: true, what: 'inventory' };
      })(),
    }),
    get_repo: tool({
      description: 'Get one included public repository with code evidence and a quoted untrusted description and README excerpt.',
      inputSchema: z.object({ name: z.string().min(1).max(100) }),
      execute: async ({ name }) => execute(async () => {
        const snapshot = await available();
        if (!snapshot) return { unavailable: true, what: 'inventory' };
        const repo = snapshot.repos[name];
        if (!repo) return { notFound: true };
        return { name: repo.name, url: repo.url, lastActivity: repo.lastActivity, archived: repo.archived,
          topics: repo.topics, languages: repo.languages.map((item) => item.name), techs: repo.techs,
          evidenceFiles: repo.evidenceFiles, untrusted_text: [repo.description, repo.readmeExcerpt].filter(Boolean).join('\n') };
      })(),
    }),
  };
}
