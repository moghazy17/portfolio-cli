import { convertToModelMessages, createUIMessageStream, stepCountIs, streamText, type LanguageModel, type UIMessage } from 'ai';
import type { AssistantSurface, NoticeKind } from '../types';
import { ASSISTANT_ERROR_MESSAGE } from '../client';
import { STALE_AFTER_MS } from '../../inventory/constants';
import { buildAssistantPrompt } from './prompt';
import { createAssistantTools, createToolBudget, type AssistantDeps } from './tools';

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
}

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
      const history = messages.filter((message) => message.role === 'user' || message.role === 'assistant')
        .slice(-10).map((message) => ({ ...message, parts: message.parts.filter((part) => part.type === 'text') }));
      const budget = createToolBudget();
      const commands: string[] = [];
      const pairs: AssistantSources['evidence'] = [];
      const repos: string[] = [];
      const toolCalls: AssistantFinish['toolCalls'] = [];
      let text = '';
      let error = false;
      const inventory = await deps.inventory().catch(() => null);
      if (inventory && Date.now() - new Date(inventory.generatedAt).getTime() > STALE_AFTER_MS) {
        writer.write({ type: 'data-notice', data: { kind: 'stale', message: 'Repository evidence may be out of date.' } });
      }
      const tools = createAssistantTools({ ...deps, surface, signal, onCommand: (command) => {
        deps.onCommand?.(command);
        writer.write({ type: 'data-command', data: command });
        if (command.status === 'ok') commands.push(command.commandLine);
      } }, budget);
      const result = streamText({
        model,
        system: buildAssistantPrompt({ inventoryStats: inventory ? { ...inventory.stats, generatedAt: inventory.generatedAt } : null }),
        messages: await convertToModelMessages(history),
        tools,
        stopWhen: [stepCountIs(6)],
        maxOutputTokens: 400,
        prepareStep: () => budget.exhausted ? { activeTools: [], toolChoice: 'auto' } : {},
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
          }
          for (const call of step.toolCalls) {
            const output = step.toolResults.find((item) => item.toolCallId === call.toolCallId)?.output as Record<string, unknown> | undefined;
            const citable = call.toolName === 'run_command' ? commands.length > 0
              : Array.isArray(output?.evidence) ? output.evidence.length > 0
                : Array.isArray(output?.evidenceFiles) ? output.evidenceFiles.length > 0
                  : Array.isArray(output?.repos) ? output.repos.length > 0
                    : Array.isArray(output?.activity) ? output.activity.length > 0 : false;
            toolCalls.push({ name: call.toolName, citable });
          }
        },
      });
      try {
        for await (const part of result.toUIMessageStream({ sendReasoning: false, onError: (cause) => onError?.(cause) ?? ASSISTANT_ERROR_MESSAGE })) {
          if (signal?.aborted) break;
          if (part.type === 'text-delta') text += part.delta;
          if (part.type === 'error') {
            error = true;
            writer.write({ type: 'data-notice', data: { kind: 'error', message: part.errorText || ASSISTANT_ERROR_MESSAGE } });
          } else if (part.type === 'start' || part.type === 'text-start' || part.type === 'text-delta' || part.type === 'text-end' || part.type === 'finish') writer.write(part);
        }
      } catch (cause) {
        error = true;
        if (!signal?.aborted) writer.write({ type: 'data-notice', data: { kind: 'error', message: onError?.(cause) ?? ASSISTANT_ERROR_MESSAGE } });
      }
      const mentioned = pairs.filter(({ repo }) => text.toLowerCase().includes(repo.toLowerCase()));
      const sources: AssistantSources = {
        commands: [...new Set(commands)],
        evidence: [...new Map((mentioned.length ? mentioned : pairs.slice(0, 3)).map((item) => [`${item.repo}/${item.file}`, item])).values()],
        repos: [...new Set(repos)],
      };
      if (!signal?.aborted && (sources.commands.length || sources.evidence.length || sources.repos.length)) writer.write({ type: 'data-sources', data: sources });
      await onFinish?.({ toolCalls, text, sources, ...(error && { notice: 'error' }), error });
    },
  });
}
