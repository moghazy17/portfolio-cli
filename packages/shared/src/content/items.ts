import type { Content } from './schema';

export type ItemKind = 'project' | 'experience' | 'certification' | 'skill';

export interface ItemId {
  kind: ItemKind;
  id: string;
  index: number;
}

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/, '');
}

function uniqueIds(kind: ItemKind, bases: string[]): string[] {
  const counts = new Map<string, number>();
  const used = new Set<string>();

  return bases.map((base, index) => {
    const value = base || `${kind}-${index + 1}`;
    let count = counts.get(value) || 0;
    let id: string;
    do {
      count += 1;
      id = count === 1 ? value : `${value}-${count}`;
    } while (used.has(id));
    counts.set(value, count);
    used.add(id);
    return id;
  });
}

export function itemIds(content: Content): Record<ItemKind, string[]> {
  return {
    project: uniqueIds('project', content.resume.projects.map((project) => project.slug)),
    experience: uniqueIds('experience', content.resume.work.map((work) =>
      `${work.slug}-${slugify(work.position)}`,
    )),
    certification: uniqueIds('certification', content.resume.certificates.map((certificate) =>
      slugify(certificate.name),
    )),
    skill: uniqueIds('skill', content.resume.skills.map((skill) => slugify(skill.name))),
  };
}
