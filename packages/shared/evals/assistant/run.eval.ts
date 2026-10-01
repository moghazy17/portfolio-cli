import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel, UIMessage } from 'ai';
import { createAssistantModel } from '../../src/assistant/server/model';
import { createAssistantStream, type AssistantSources } from '../../src/assistant/server/stream';
import type { AssistantDeps } from '../../src/assistant/server/tools';
import type { InventorySnapshot } from '../../src/inventory/types';
import type { CodeHit, LiveRepo, RecentActivity } from '../../src/assistant/server/live-types';
import { toLines } from '../../src/shell/lines';

interface Case {
  question: string;
  category: string;
  mustCallTools?: string[];
  mustNotCallTools?: string[];
  mustInclude?: string[];
  mustNotInclude?: string[];
  mustDecline?: 'off_topic' | 'personal' | 'instructions';
  sourcesMustContain?: string[];
  maxSummaryLines?: number;
  maxTotalLines?: number;
}
interface LiveFixture {
  currentRepos: LiveRepo[];
  recentActivity: RecentActivity[];
  codeHits: CodeHit[];
}
const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
const cases = (parse(read('golden.yaml')) as { cases: Case[] }).cases;
const inventory = JSON.parse(read('fixtures/inventory.json')) as InventorySnapshot;
const live = JSON.parse(read('fixtures/live.json')) as LiveFixture;
const fixedNow = new Date('2026-09-30T00:00:00Z');
const fallbackOnly = process.argv.includes('fallback') || process.env.ASSISTANT_EVAL_PROVIDER === 'fallback';
const keyPresent = fallbackOnly ? Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY) : Boolean(process.env.OPENAI_API_KEY);
// One 80x24 screen minus the prompt line.
const SCREEN_LINES = 22;
// Vitest hides console output of passing runs, so the summary also goes to a file and,
// in CI, to the job summary.
const REPORT_FILE = join(tmpdir(), 'assistant-eval-report.md');
const overflows: string[] = [];
const records: Array<{ category: string; passed: boolean; firstMs: number; totalMs: number; fits: boolean }> = [];

function model(): LanguageModel {
  if (fallbackOnly) return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })(process.env.ASSISTANT_FALLBACK_MODEL || 'gemini-3.5-flash-lite');
  return createAssistantModel(process.env);
}
function deps(): AssistantDeps {
  return { inventory: async () => inventory, now: () => fixedNow,
    live: {
      currentRepos: async () => live.currentRepos,
      recentActivity: async () => live.recentActivity,
      repo: async (name) => {
        const item = inventory.repos[name];
        const current = live.currentRepos.find((repo) => repo.name === name);
        return item && current ? { ...current, url: item.url, description: item.description,
          languages: item.languages.map((language) => language.name), readmeExcerpt: item.readmeExcerpt } : null;
      },
      searchCode: async () => live.codeHits,
    },
  };
}
const percentile = (values: number[], fraction: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
};
const wrappedLines = (value: string) => value.split('\n').reduce((count, line) => count + Math.max(1, Math.ceil(line.length / 80)), 0);

describe('assistant golden questions', () => {
  if (!keyPresent) {
    console.log(fallbackOnly ? 'Assistant eval skipped: GOOGLE_GENERATIVE_AI_API_KEY is missing.' : 'Assistant eval skipped: OPENAI_API_KEY is missing.');
    it.skip(fallbackOnly ? 'GOOGLE_GENERATIVE_AI_API_KEY is missing; fallback eval skipped' : 'OPENAI_API_KEY is missing; assistant eval skipped', () => {});
  } else {
    for (const item of cases) {
      it(`${item.category}: ${item.question}`, async () => {
        const started = performance.now();
        let firstMs = 0;
        let answer = '';
        let sources: AssistantSources = { commands: [], evidence: [], repos: [] };
        let toolCalls: string[] = [];
        let decline: string | undefined;
        let commandText = '';
        const messages: UIMessage[] = [{ id: 'q', role: 'user', parts: [{ type: 'text', text: item.question }] }];
        for await (const part of createAssistantStream({ messages, surface: 'web', deps: deps(), model: model(),
          onFinish: (result) => { toolCalls = result.toolCalls.map((call) => call.name); } })) {
          if (!firstMs && part.type !== 'start' && part.type !== 'finish') firstMs = performance.now() - started;
          if (part.type === 'text-delta') answer += part.delta;
          if (part.type === 'data-sources') sources = part.data as AssistantSources;
          if (part.type === 'data-decline') decline = (part.data as { category: string }).category;
          if (part.type === 'data-command') {
            const data = part.data as { output: Parameters<typeof toLines>[0] };
            commandText += toLines(data.output).map((line) => line.text).join('\n');
          }
        }
        const totalMs = performance.now() - started;
        const sourceText = [...sources.commands, ...sources.evidence.map(({ repo, file }) => `${repo}/${file}`), ...sources.repos].join(' ').toLowerCase();
        const failures: string[] = [];
        for (const name of item.mustCallTools ?? []) if (!toolCalls.includes(name)) failures.push(`missing tool ${name}`);
        for (const name of item.mustNotCallTools ?? []) if (toolCalls.includes(name)) failures.push(`unexpected tool ${name}`);
        for (const phrase of item.mustInclude ?? []) if (!answer.toLowerCase().includes(phrase.toLowerCase())) failures.push(`missing text ${phrase}`);
        // Echoing a term the visitor typed is not a leak ("no public repository named X");
        // anything forbidden that the visitor did not supply still fails.
        const asked = item.question.toLowerCase();
        for (const phrase of item.mustNotInclude ?? []) {
          if (!asked.includes(phrase.toLowerCase()) && answer.toLowerCase().includes(phrase.toLowerCase())) failures.push(`forbidden text ${phrase}`);
        }
        if (item.mustDecline && decline !== item.mustDecline) failures.push(`decline ${decline ?? 'missing'}`);
        for (const source of item.sourcesMustContain ?? []) if (!sourceText.includes(source.toLowerCase())) failures.push(`missing source ${source}`);
        if (item.maxSummaryLines && wrappedLines(answer) > item.maxSummaryLines) failures.push('summary too long');
        // Screen fit is an aggregate target (most answers on one screen), scored across all cases below.
        const totalLines = wrappedLines(`${commandText}\n${answer}`);
        const fits = totalLines <= (item.maxTotalLines ?? SCREEN_LINES);
        if (!fits) overflows.push(`- ${totalLines} lines (${commandText ? commandText.split('\n').length : 0} from commands): ${item.question} — ${answer.replace(/\s+/g, ' ').slice(0, 200)}`);
        records.push({ category: item.category, passed: failures.length === 0, firstMs, totalMs, fits });
        if (failures.length) {
          console.log(`--- ${item.category}: ${item.question}\n    tools: ${toolCalls.join(', ') || '(none)'}; decline: ${decline ?? '-'}\n    answer: ${answer.replace(/\s+/g, ' ').slice(0, 600)}`);
        }
        expect(failures, failures.join('; ')).toEqual([]);
      });
    }
    afterAll(() => {
      const categories = [...new Set(records.map((record) => record.category))];
      console.table(categories.map((category) => {
        const rows = records.filter((record) => record.category === category);
        return { category, passed: rows.filter((row) => row.passed).length, total: rows.length };
      }));
      console.log(`First event p50/p90: ${percentile(records.map((row) => row.firstMs), 0.5).toFixed(0)}/${percentile(records.map((row) => row.firstMs), 0.9).toFixed(0)} ms (target ≤3000 ms)`);
      console.log(`Total p50/p90: ${percentile(records.map((row) => row.totalMs), 0.5).toFixed(0)}/${percentile(records.map((row) => row.totalMs), 0.9).toFixed(0)} ms (target ≤15000 ms)`);
      const fitRate = records.filter((row) => row.fits).length / records.length;
      console.log(`One-screen answers: ${(fitRate * 100).toFixed(0)}% (target ≥90%)`);
      const report = [
        '## Assistant eval',
        '',
        `Cases passed: ${records.filter((row) => row.passed).length}/${records.length}`,
        ...categories.map((category) => {
          const rows = records.filter((record) => record.category === category);
          return `- ${category}: ${rows.filter((row) => row.passed).length}/${rows.length}`;
        }),
        `First event p50/p90: ${percentile(records.map((row) => row.firstMs), 0.5).toFixed(0)}/${percentile(records.map((row) => row.firstMs), 0.9).toFixed(0)} ms`,
        `One-screen answers: ${(fitRate * 100).toFixed(0)}%`,
        ...(overflows.length ? ['', 'Over one screen:', ...overflows] : []),
        '',
      ].join('\n');
      writeFileSync(REPORT_FILE, report);
      if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
      expect(fitRate).toBeGreaterThanOrEqual(0.9);
      const rate = records.filter((row) => row.passed).length / cases.length;
      expect(rate).toBeGreaterThanOrEqual(0.95);
      for (const category of ['excluded', 'injection']) expect(records.filter((row) => row.category === category).every((row) => row.passed)).toBe(true);
    });
  }
});
