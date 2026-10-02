'use client';

import type { Suggestion } from '@ahmed-moghazy/shared';

export default function SuggestionBar({ items, onSelect }: { items: Suggestion[]; onSelect: (line: string) => void }) {
  return (
    <nav className="suggestion-bar" aria-label="Suggestions">
      {items.map((item) => (
        <button type="button" className="suggestion-chip" key={`${item.kind}:${item.line}`}
          onClick={() => onSelect(item.line)} aria-label={item.kind === 'question' ? `Ask: ${item.label}` : item.label}>
          {item.kind === 'question' ? `ask: ${item.label}` : item.label}
        </button>
      ))}
    </nav>
  );
}
