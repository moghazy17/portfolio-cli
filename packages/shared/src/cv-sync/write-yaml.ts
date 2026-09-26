import type { Document } from 'yaml';
import type { AppliedChange } from './types';

export function applyToDocument(
  document: Document,
  changes: AppliedChange[],
): string {
  for (const change of changes) {
    const operation = change.operation;
    if (!operation) continue;
    if (operation.type === 'set') {
      document.setIn(operation.path, operation.value);
    } else if (operation.type === 'add') {
      document.addIn(operation.path, operation.value);
    } else {
      document.deleteIn(operation.path);
    }
  }
  return document.toString();
}
