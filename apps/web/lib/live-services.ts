import type { SkillEvidence } from '@ahmed-moghazy/shared';

export async function fetchSkillEvidence(signal: AbortSignal): Promise<SkillEvidence> {
  const response = await fetch('/api/skills', { signal });
  if (!response.ok) throw new Error(`Skill evidence unavailable (${response.status})`);
  const data = await response.json() as { evidence: SkillEvidence };
  return data.evidence;
}
