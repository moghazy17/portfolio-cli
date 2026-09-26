import { normalizeText } from './pdf';
import type { AppliedChange } from './types';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthForms(value: string): string[] {
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return [];
  const month = months[Number(match[2]) - 1];
  return [
    `${month} ${match[1]}`,
    `${month.slice(0, 3)} ${match[1]}`,
    `${match[2]}/${match[1]}`,
    `${match[1]}-${match[2]}`,
  ];
}

function isGrounded(value: string, text: string) {
  const normalizedValue = normalizeText(value).toLocaleLowerCase();
  if (text.includes(normalizedValue)) return true;
  return monthForms(value).some((form) => text.includes(normalizeText(form).toLocaleLowerCase()));
}

export function findUngrounded(
  changes: AppliedChange[],
  pdfText: string,
): AppliedChange[] {
  const text = normalizeText(pdfText).toLocaleLowerCase();
  const candidates = changes.flatMap((change) => {
    if (change.groundValues) return change.groundValues;
    if (change.kind === 'added') return [{ path: change.path, value: change.value }];
    if (change.kind === 'updated') return [{ path: change.path, value: change.to }];
    return [];
  });
  return candidates
    .filter(({ value }) => !isGrounded(value, text))
    .map(({ path, value }) => ({ kind: 'not-grounded', path, value }));
}
