import { describe, expect, it } from 'vitest';
import { skillEvidence, skillEvidenceWithRepos } from '../src/inventory/skills';
import { lookupTech } from '../src/inventory/lookup';
import { githubRepoSearchUrl } from '../src/github';
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

  it('keeps every repo behind a count even when lookup evidence is truncated', () => {
    const many = {
      ...snapshot,
      techs: {
        ...snapshot.techs,
        python: { ...snapshot.techs.python, evidence: [
          evidence('one', 'python'), evidence('two', 'python'), evidence('three', 'python'),
          evidence('four', 'python'), evidence('five', 'python'), evidence('five', 'python'),
        ] },
      },
    };
    expect(lookupTech(many, 'Python').evidence).toHaveLength(3);
    const result = skillEvidenceWithRepos(many, [{ name: 'Skills', skills: ['Python/RAG'] }]);
    expect(result.evidence['Python/RAG']).toBe(5);
    expect(result.repos['Python/RAG']).toHaveLength(result.evidence['Python/RAG']);
    expect(new Set(result.repos['Python/RAG'])).toEqual(new Set(['one', 'two', 'three', 'four', 'five']));
  });

  it('builds the exact encoded GitHub repository search', () => {
    expect(githubRepoSearchUrl(['a', 'b'])).toBe('https://github.com/search?type=repositories&q=repo%3Amoghazy17%2Fa%20repo%3Amoghazy17%2Fb');
  });
});
