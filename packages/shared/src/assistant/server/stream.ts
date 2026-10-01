import { convertToModelMessages, createUIMessageStream, hasToolCall, stepCountIs, streamText, type LanguageModel, type UIMessage } from 'ai';
import type { AssistantSurface, NoticeKind } from '../types';
import { ASSISTANT_ERROR_MESSAGE } from '../client';
import { createStreamingRedactor } from '../sanitize';
import { profile } from '../../content';
import { STALE_AFTER_MS } from '../../inventory/constants';
import { buildAssistantPrompt } from './prompt';
import { createAssistantTools, createToolBudget, type AssistantDeps } from './tools';

const MAX_HISTORY_MESSAGES = 10;
const MAX_MESSAGE_CHARS = 1500;
const MAX_HISTORY_CHARS = 6000;

/**
 * Text-only history, bounded in size as well as count so a short question cannot carry an
 * arbitrarily large prompt: earlier messages are cut to 1,500 characters and the oldest are
 * dropped until the whole history fits in 6,000. The newest message is the question itself,
 * already capped by the route.
 */
export function boundHistory(messages: UIMessage[]): UIMessage[] {
  const recent = messages.filter((message) => message.role === 'user' || message.role === 'assistant')
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message, index, all) => {
      const text = message.parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('\n');
      const capped = index === all.length - 1 ? text : text.slice(0, MAX_MESSAGE_CHARS);
      return { ...message, parts: [{ type: 'text' as const, text: capped }] };
    });
  let total = recent.reduce((sum, message) => sum + (message.parts[0] as { text: string }).text.length, 0);
  while (recent.length > 1 && total > MAX_HISTORY_CHARS) {
    total -= (recent.shift()!.parts[0] as { text: string }).text.length;
  }
  return recent;
}

export interface AssistantSources {
  commands: string[];
  evidence: { repo: string; file: string }[];
  repos: string[];
}

export interface AssistantFinish {
  toolCalls: { name: string; citable: boolean }[];
  text: string;
  sources: AssistantSources;
  notice?: NoticeKind;
  error: boolean;
  /** The visitor cancelled; the answer is partial and should not be logged as an outcome. */
  aborted: boolean;
}

const refusalText = {
  off_topic: `I only answer questions about ${profile.firstName}'s work — try \`has he used Kafka?\` or type \`help\`.`,
  personal: `That's best asked to ${profile.firstName} directly — run \`contact\` for how to reach him.`,
  instructions: `I can't share or change my instructions, but I'm happy to answer questions about ${profile.firstName}'s work.`,
};
const UNAVAILABLE_MESSAGE = 'The assistant is unavailable right now — commands like `projects` still work.';

export function createAssistantStream({ messages, surface, deps, model, signal, onFinish, onError }: {
  messages: UIMessage[];
  surface: AssistantSurface;
  deps: AssistantDeps;
  model: LanguageModel;
  signal?: AbortSignal;
  onFinish?: (result: AssistantFinish) => void | Promise<void>;
  onError?: (error: unknown) => string;
}) {
  return createUIMessageStream({
    execute: async ({ writer }) => {
      const history = boundHistory(messages);
      const budget = createToolBudget();
      const commands: string[] = [];
      const pairs: AssistantSources['evidence'] = [];
      const repos: string[] = [];
      const repoCandidates: string[] = [];
      const toolCalls: AssistantFinish['toolCalls'] = [];
      let text = '';
      let error = false;
      let emittedOutput = false;
      let declined: keyof typeof refusalText | undefined;
      const inventory = await deps.inventory().catch(() => null);
      // One clock for staleness, the prompt and the tools, so a fixed clock (evals) stays consistent.
      const now = deps.now?.() ?? new Date();
      if (inventory && now.getTime() - new Date(inventory.generatedAt).getTime() > STALE_AFTER_MS) {
        writer.write({ type: 'data-notice', data: { kind: 'stale', message: 'Repository evidence may be out of date.' } });
      }
      const tools = createAssistantTools({ ...deps, surface, signal, onCommand: (command) => {
        deps.onCommand?.(command);
        writer.write({ type: 'data-command', data: command });
        if (command.status === 'ok') commands.push(command.commandLine);
      } }, budget, deps.now);
      const result = streamText({
        model,
        system: buildAssistantPrompt({ now, inventoryStats: inventory ? { ...inventory.stats, generatedAt: inventory.generatedAt } : null }),
        messages: await convertToModelMessages(history),
        tools,
        stopWhen: [stepCountIs(6), hasToolCall('decline')],
        maxOutputTokens: 400,
        prepareStep: () => budget.exhausted ? { activeTools: ['decline'], toolChoice: 'auto' } : {},
        abortSignal: signal,
        onStepFinish: (step) => {
          for (const item of step.toolResults) {
            const output = item.output as Record<string, unknown>;
            if (Array.isArray(output?.evidence)) for (const entry of output.evidence) {
              if (entry && typeof entry === 'object' && 'repo' in entry && 'file' in entry && typeof entry.repo === 'string' && typeof entry.file === 'string') pairs.push({ repo: entry.repo, file: entry.file });
            }
            if (Array.isArray(output?.evidenceFiles) && typeof output.name === 'string') for (const file of output.evidenceFiles) {
              if (typeof file === 'string') pairs.push({ repo: output.name, file });
            }
            if (Array.isArray(output?.activity)) for (const entry of output.activity) {
              if (entry && typeof entry === 'object' && 'repo' in entry && typeof entry.repo === 'string') repos.push(entry.repo);
            }
            if (Array.isArray(output?.hits)) for (const entry of output.hits) {
              if (entry && typeof entry === 'object' && 'repo' in entry && 'path' in entry && typeof entry.repo === 'string' && typeof entry.path === 'string') pairs.push({ repo: entry.repo, file: entry.path });
            }
            // Listings, repo details and README-only matches cite the repository itself.
            if (Array.isArray(output?.repos)) for (const entry of output.repos) {
              if (entry && typeof entry === 'object' && 'name' in entry && typeof entry.name === 'string') repoCandidates.push(entry.name);
            }
            if (typeof output?.name === 'string' && typeof output?.url === 'string') repoCandidates.push(output.name);
            if (Array.isArray(output?.readmeOnly)) for (const entry of output.readmeOnly) {
              if (entry && typeof entry === 'object' && 'repo' in entry && typeof entry.repo === 'string') repoCandidates.push(entry.repo);
            }
          }
          for (const call of step.toolCalls) {
            if (call.toolName === 'decline') {
              const category = (call.input as { category?: string }).category;
              if (category === 'off_topic' || category === 'personal' || category === 'instructions') {
                declined = category;
                writer.write({ type: 'data-decline', data: { category } });
              }
            }
            const output = step.toolResults.find((item) => item.toolCallId === call.toolCallId)?.output as Record<string, unknown> | undefined;
            const citable = call.toolName === 'run_command' ? commands.length > 0
              : Array.isArray(output?.evidence) ? output.evidence.length > 0
                : Array.isArray(output?.evidenceFiles) ? output.evidenceFiles.length > 0
                  : Array.isArray(output?.repos) ? output.repos.length > 0
                    : Array.isArray(output?.activity) ? output.activity.length > 0
                      : Array.isArray(output?.hits) ? output.hits.length > 0 : false;
            toolCalls.push({ name: call.toolName, citable });
          }
        },
      });
      // Model text is redacted here, not only in clients, so every consumer of the endpoint
      // gets the same guarantee. The redactor holds back a short tail, flushed at text-end.
      const redactors = new Map<string, ReturnType<typeof createStreamingRedactor>>();
      const redactorFor = (id: string) => {
        let redactor = redactors.get(id);
        if (!redactor) { redactor = createStreamingRedactor(); redactors.set(id, redactor); }
        return redactor;
      };
      try {
        for await (const part of result.toUIMessageStream({ sendReasoning: false, onError: (cause) => onError?.(cause) ?? ASSISTANT_ERROR_MESSAGE })) {
          if (signal?.aborted) break;
          if (part.type === 'error') {
            error = true;
            writer.write({ type: 'data-notice', data: { kind: emittedOutput ? 'error' : 'unavailable', message: emittedOutput ? (part.errorText || ASSISTANT_ERROR_MESSAGE) : UNAVAILABLE_MESSAGE } });
          } else if (part.type === 'text-delta') {
            if (declined) continue;
            const delta = redactorFor(part.id).push(part.delta);
            if (!delta) continue;
            text += delta;
            emittedOutput = true;
            writer.write({ ...part, delta });
          } else if (part.type === 'text-end') {
            if (declined) continue;
            const rest = redactorFor(part.id).flush();
            if (rest) {
              text += rest;
              emittedOutput = true;
              writer.write({ type: 'text-delta', id: part.id, delta: rest });
            }
            writer.write(part);
          } else if (part.type === 'start' || part.type === 'text-start' || part.type === 'finish') {
            if (!declined || part.type === 'start') writer.write(part);
          }
        }
      } catch (cause) {
        error = true;
        if (!signal?.aborted) writer.write({ type: 'data-notice', data: { kind: emittedOutput ? 'error' : 'unavailable', message: emittedOutput ? (onError?.(cause) ?? ASSISTANT_ERROR_MESSAGE) : UNAVAILABLE_MESSAGE } });
      }
      if (declined && !signal?.aborted) {
        text = refusalText[declined];
        const id = crypto.randomUUID();
        writer.write({ type: 'text-start', id });
        writer.write({ type: 'text-delta', id, delta: text });
        writer.write({ type: 'text-end', id });
        writer.write({ type: 'finish' });
      }
      const mentioned = pairs.filter(({ repo }) => text.toLowerCase().includes(repo.toLowerCase()));
      const uniqueCandidates = [...new Set(repoCandidates)];
      const mentionedRepos = uniqueCandidates.filter((repo) => text.toLowerCase().includes(repo.toLowerCase()));
      const citedRepos = mentionedRepos.length ? mentionedRepos : uniqueCandidates.slice(0, 3);
      const sources: AssistantSources = {
        commands: [...new Set(commands)],
        evidence: [...new Map((mentioned.length ? mentioned : pairs.slice(0, 3)).map((item) => [`${item.repo}/${item.file}`, item])).values()],
        repos: [...new Set([...repos, ...citedRepos])],
      };
      if (!signal?.aborted && (sources.commands.length || sources.evidence.length || sources.repos.length)) writer.write({ type: 'data-sources', data: sources });
      await onFinish?.({ toolCalls, text, sources, ...(error && { notice: emittedOutput ? 'error' : 'unavailable' }), error, aborted: Boolean(signal?.aborted) });
    },
  });
}
