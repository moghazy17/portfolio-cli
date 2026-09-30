import { describe, expect, it } from 'vitest';
import { compileAliases } from '../src/inventory/aliases';

describe('technology aliases', () => {
  const aliases = compileAliases({
    langchain: { label: 'LangChain', category: 'ai', aliases: ['langchain-*', '@langchain/*'] },
    kafka: { label: 'Kafka', category: 'data', aliases: ['org.apache.kafka:*'] },
    'c++': { label: 'C++', category: 'language', aliases: ['std::c++[core]'] },
  });
  it('matches globs and ignores case', () => {
    expect(aliases.resolve('LangChain-OPENAI')).toBe('langchain');
    expect(aliases.resolve('@LANGCHAIN/core')).toBe('langchain');
    expect(aliases.resolve('org.apache.kafka:kafka-clients')).toBe('kafka');
  });
  it('has implicit ids and safe literal metacharacters', () => {
    expect(aliases.resolve('KAFKA')).toBe('kafka');
    expect(aliases.resolve('std::c++[core]')).toBe('c++');
    expect(aliases.resolve('std::c++xcore')).toBeNull();
    expect(aliases.resolve('unmapped-package')).toBeNull();
  });
});
