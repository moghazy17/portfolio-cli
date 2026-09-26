import type { ResumeInput } from '../content/schema';
import type { AppliedChange, CvExtraction, ExtractedEntry, ExtractedItem } from './types';

type RecordValue = Record<string, unknown>;
type Section = 'education' | 'work' | 'projects' | 'certificates' | 'skills';

const sectionConfig: Record<Section, {
  prefix: string;
  label: string;
  fields: string[];
  items: 'courses' | 'highlights' | 'keywords';
  slug?: true;
}> = {
  education: {
    prefix: 'e', label: 'institution',
    fields: ['institution', 'area', 'studyType', 'faculty', 'location', 'score', 'startDate', 'endDate'],
    items: 'courses',
  },
  work: {
    prefix: 'w', label: 'name', fields: ['name', 'position', 'startDate', 'endDate'],
    items: 'highlights', slug: true,
  },
  projects: {
    prefix: 'p', label: 'name', fields: ['name', 'stack', 'startDate', 'endDate'],
    items: 'highlights', slug: true,
  },
  certificates: {
    prefix: 'c', label: 'name', fields: ['name', 'issuer', 'startDate', 'endDate'],
    items: 'highlights',
  },
  skills: {
    prefix: 's', label: 'name', fields: ['name'], items: 'keywords',
  },
};

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isManual(value: unknown): value is { value: string; manual: true } {
  return isRecord(value) && value.manual === true && typeof value.value === 'string';
}

function text(value: unknown): string {
  if (isManual(value)) return value.value;
  return value === undefined ? '' : String(value);
}

function displayPath(path: Array<string | number>) {
  return path.reduce<string>((result, part) => typeof part === 'number'
    ? `${result}[${part}]`
    : result ? `${result}.${part}` : part, '');
}

function slugify(value: string) {
  return value.toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'entry';
}

function uniqueSlug(value: string, used: Set<string>) {
  const base = slugify(value);
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function entryGroundValues(entry: RecordValue, path: string, itemKey: string) {
  const ignored = new Set(['_id', '_match', 'slug', 'graduation']);
  return Object.entries(entry).flatMap(([key, value]) => {
    if (ignored.has(key)) return [];
    if (key === itemKey && Array.isArray(value)) {
      return value.map((item, index) => ({
        path: `${path}.${key}[${index}]`,
        value: text(isRecord(item) ? item.value : item),
      }));
    }
    if (isRecord(value)) {
      return Object.entries(value).map(([nested, nestedValue]) => ({
        path: `${path}.${key}.${nested}`,
        value: text(nestedValue),
      }));
    }
    if (value === undefined) return [];
    return [{ path: `${path}.${key}`, value: text(value) }];
  });
}

function cleanNewEntry(
  section: Section,
  entry: ExtractedEntry,
  usedSlugs: Set<string>,
): RecordValue {
  const config = sectionConfig[section];
  const next: RecordValue = {};
  if (config.slug) next.slug = uniqueSlug(text(entry[config.label]), usedSlugs);
  for (const field of config.fields) {
    if (entry[field] !== undefined) next[field] = entry[field];
  }
  if (section === 'projects') next.graduation = false;
  next[config.items] = ((entry[config.items] as ExtractedItem[]) ?? []).map((item) => item.value);
  return next;
}

function warning(changes: AppliedChange[], path: string, id: string) {
  changes.push({
    kind: 'warning',
    path,
    message: `Ignored unknown transient id ${id}`,
  });
}

function mergeBasics(next: RecordValue, extraction: CvExtraction, changes: AppliedChange[]) {
  const current = next.basics as RecordValue;
  const incoming = extraction.basics;
  const scalarFields = ['name', 'label', 'summary', 'email', 'phone'];
  for (const field of scalarFields) {
    if (incoming[field] === undefined || isManual(current[field])) continue;
    const from = text(current[field]);
    const to = text(incoming[field]);
    if (from === to) continue;
    current[field] = to;
    const path = `basics.${field}`;
    changes.push({
      kind: 'updated', path, from, to,
      operation: { type: 'set', path: ['basics', field], value: to },
    });
  }
  const currentLocation = current.location as RecordValue;
  const incomingLocation = incoming.location as RecordValue | undefined;
  if (incomingLocation) {
    for (const field of ['city', 'countryCode']) {
      if (incomingLocation[field] === undefined || isManual(currentLocation[field])) continue;
      const from = text(currentLocation[field]);
      const to = text(incomingLocation[field]);
      if (from === to) continue;
      currentLocation[field] = to;
      const path = `basics.location.${field}`;
      changes.push({
        kind: 'updated', path, from, to,
        operation: { type: 'set', path: ['basics', 'location', field], value: to },
      });
    }
  }
}

function mergeItems(
  section: Section,
  entryIndex: number,
  currentEntry: RecordValue,
  incomingEntry: ExtractedEntry,
  changes: AppliedChange[],
) {
  const config = sectionConfig[section];
  const key = config.items;
  const currentItems = (currentEntry[key] as unknown[]) ?? [];
  const originalItemCount = currentItems.length;
  const incomingItems = (incomingEntry[key] as ExtractedItem[]) ?? [];
  const referenced = new Set<number>();
  const additions: string[] = [];
  const itemPrefix = key === 'highlights' ? 'h' : key === 'keywords' ? 'k' : 'c';

  for (const item of incomingItems) {
    if (!item._id) {
      additions.push(item.value);
      continue;
    }
    const match = item._id.match(new RegExp(`^${config.prefix}${entryIndex}\\.${itemPrefix}(\\d+)$`));
    const index = match ? Number(match[1]) : -1;
    if (index < 0 || index >= originalItemCount) {
      additions.push(item.value);
      changes.push({
        kind: 'warning',
        path: `${section}[${entryIndex}].${key}`,
        message: `Unknown item id ${item._id}; added as a new item`,
      });
      continue;
    }
    if (referenced.has(index)) {
      if (isManual(currentItems[index])) continue;
      additions.push(item.value);
      changes.push({
        kind: 'warning',
        path: `${section}[${entryIndex}].${key}`,
        message: `Duplicate reference to ${item._id}; added as a new item`,
      });
      continue;
    }
    referenced.add(index);
    if (isManual(currentItems[index])) continue;
    const from = text(currentItems[index]);
    if (from === item.value) continue;
    currentItems[index] = item.value;
    const path = `${section}[${entryIndex}].${key}[${index}]`;
    changes.push({
      kind: 'updated', path, from, to: item.value,
      operation: { type: 'set', path: [section, entryIndex, key, index], value: item.value },
    });
  }

  const removals: number[] = [];
  for (let index = 0; index < currentItems.length; index += 1) {
    if (referenced.has(index)) continue;
    const path = `${section}[${entryIndex}].${key}[${index}]`;
    if (isManual(currentItems[index])) {
      changes.push({ kind: 'protected-unmatched', path, value: text(currentItems[index]) });
    } else {
      removals.push(index);
    }
  }
  for (const index of removals.reverse()) {
    const value = text(currentItems[index]);
    currentItems.splice(index, 1);
    const path = `${section}[${entryIndex}].${key}[${index}]`;
    changes.push({
      kind: 'removed', path, value,
      operation: { type: 'delete', path: [section, entryIndex, key, index] },
    });
  }
  for (const value of additions) {
    const index = currentItems.length;
    currentItems.push(value);
    const path = `${section}[${entryIndex}].${key}[${index}]`;
    changes.push({
      kind: 'added', path, value,
      operation: { type: 'add', path: [section, entryIndex, key], value },
    });
  }
}

function mergeSection(
  next: RecordValue,
  extraction: CvExtraction,
  section: Section,
  changes: AppliedChange[],
) {
  const config = sectionConfig[section];
  const currentEntries = next[section] as RecordValue[];
  const originalEntryCount = currentEntries.length;
  const incomingEntries = extraction[section] as ExtractedEntry[];
  const referenced = new Set<number>();
  const usedSlugs = new Set(currentEntries.map((entry) => text(entry.slug)).filter(Boolean));

  const addEntry = (incoming: ExtractedEntry) => {
    const newEntry = cleanNewEntry(section, incoming, usedSlugs);
    const index = currentEntries.length;
    currentEntries.push(newEntry);
    const path = `${section}[${index}]`;
    const label = text(newEntry[config.label]);
    changes.push({
      kind: 'added', path, value: label,
      operation: { type: 'add', path: [section], value: newEntry },
      groundValues: entryGroundValues(incoming, path, config.items),
    });
    if (section === 'projects') {
      changes.push({ kind: 'new-project-review', path, label });
    }
  };

  for (const incoming of incomingEntries) {
    if (!incoming._id) {
      addEntry(incoming);
      continue;
    }

    const match = incoming._id.match(new RegExp(`^${config.prefix}(\\d+)$`));
    const index = match ? Number(match[1]) : -1;
    if (index < 0 || index >= originalEntryCount) {
      warning(changes, section, incoming._id);
      continue;
    }
    if (referenced.has(index)) {
      addEntry(incoming);
      changes.push({
        kind: 'warning',
        path: section,
        message: `Duplicate reference to ${incoming._id}; added as a new entry`,
      });
      continue;
    }
    referenced.add(index);
    const current = currentEntries[index];
    const resumeLabel = text(current[config.label]);
    const cvLabel = text(incoming[config.label]);
    const nameChanged = resumeLabel !== cvLabel;
    const datesChanged = text(current.startDate) !== text(incoming.startDate)
      || text(current.endDate) !== text(incoming.endDate);
    if (incoming._match === 'uncertain' || (nameChanged && datesChanged)) {
      changes.push({
        kind: 'possible-rename', path: `${section}[${index}]`, cvLabel, resumeLabel,
      });
    }

    for (const field of config.fields) {
      if (isManual(current[field])) continue;
      const from = text(current[field]);
      const hasIncoming = incoming[field] !== undefined;
      const to = hasIncoming ? text(incoming[field]) : '';
      if (from === to) continue;
      const pathArray: Array<string | number> = [section, index, field];
      const path = displayPath(pathArray);
      if (!hasIncoming && field === 'endDate' && incoming.startDate !== undefined) {
        delete current[field];
        changes.push({
          kind: 'removed', path, value: from,
          operation: { type: 'delete', path: pathArray },
        });
      } else if (!hasIncoming) {
        continue;
      } else if (from === '') {
        current[field] = to;
        changes.push({
          kind: 'added', path, value: to,
          operation: { type: 'set', path: pathArray, value: to },
        });
      } else {
        current[field] = to;
        changes.push({
          kind: 'updated', path, from, to,
          operation: { type: 'set', path: pathArray, value: to },
        });
      }
    }
    mergeItems(section, index, current, incoming, changes);
  }

  currentEntries.forEach((entry, index) => {
    if (!referenced.has(index) && index < originalEntryCount) {
      changes.push({
        kind: 'kept-not-in-cv',
        path: `${section}[${index}]`,
        label: text(entry[config.label]),
      });
    }
  });
}

export function mergeCv(
  currentDoc: ResumeInput,
  extraction: CvExtraction,
): { next: ResumeInput; changes: AppliedChange[] } {
  const next = structuredClone(currentDoc) as RecordValue;
  const changes: AppliedChange[] = [];
  mergeBasics(next, extraction, changes);
  for (const section of Object.keys(sectionConfig) as Section[]) {
    mergeSection(next, extraction, section, changes);
  }
  for (const item of extraction.unmapped) {
    changes.push({ kind: 'not-mapped', heading: item.heading, text: item.text });
  }
  return { next: next as ResumeInput, changes };
}
