import { describe, expect, it } from 'vitest';
import { skillEvidence } from '../src/inventory/skills';
import type { InventorySnapshot } from '../src/inventory/types';

const evidence = (repo: string, match: string) => ({ repo, match, file: 'package.json', kind: 'manifest' as const, lastActivity: '2026-01-01' });
const snapshot = {
  generatedAt: '2026-01-01', techs: {
    python: { id: 'python', label: 'Python', evidence: [evidence('one', 'python'), evidence('two', 'python')] },
    rag: { id: 'rag', label: 'RAG', evidence: [evidence('one', 'rag'), evidence('two', 'rag'), evidence('three', 'rag')] },
    langchain: { id: 'langchain', label: 'LangChain', evidence: [evidence('one', 'langchain-core'), evidence('one', 'langchain-openai')] },
  }, packages: {}, readmeMentions: {}, aliasIndex: { 'langchain-core': 'langchain' },
} as unknown as InventorySnapshot;

describe('skillEvidence', () => {
  it('counts distinct repos using labels, acronyms and aliases', () => {
    expect(skillEvidence(snapshot, [{ name: 'Skills', skills: ['Python (Advanced)', 'Retrieval-Augmented Generation (RAG)', 'langchain-core', 'Unknown'] }])).toEqual({
      'Python (Advanced)': 2, 'Retrieval-Augmented Generation (RAG)': 3, 'langchain-core': 1, Unknown: 0,
    });
  });
});
