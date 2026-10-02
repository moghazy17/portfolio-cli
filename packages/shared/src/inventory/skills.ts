import type { SkillCategory, SkillEvidence } from '../types';
import { lookupTech } from './lookup';
import type { InventorySnapshot } from './types';

export function skillEvidence(snapshot: InventorySnapshot, skills: SkillCategory[]): SkillEvidence {
  const counts: SkillEvidence = {};
  for (const category of skills) for (const label of category.skills) {
    const base = label.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const acronym = label.match(/\(([A-Z]{2,6})\)\s*$/)?.[1];
    const parts = base.includes('/') ? base.split('/').map((part) => part.trim()).filter(Boolean) : [];
    counts[label] = Math.max(...[base, ...parts, ...(acronym ? [acronym] : [])].map((name) => lookupTech(snapshot, name).totalRepos));
  }
  return counts;
}
