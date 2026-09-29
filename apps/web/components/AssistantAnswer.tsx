'use client';

import type { Theme } from '@ahmed-moghazy/shared';
import OutputRenderer from './OutputRenderer';
import type { AssistantEntryState } from '../hooks/useTerminal';

interface Props {
  state: AssistantEntryState;
  theme: Theme;
}

export default function AssistantAnswer({ state, theme }: Props) {
  const busy = state.status === 'thinking' || state.status === 'streaming';

  return (
    <div className="assistant-answer" aria-busy={busy ? 'true' : 'false'}>
      {state.status === 'thinking' && (
        <div className="assistant-thinking" style={{ color: theme.dimmed }}>thinking…</div>
      )}
      {state.parts.map((part, index) => {
        switch (part.kind) {
          case 'command':
            return (
              <div key={index} style={{ marginBottom: '4px' }}>
                <div style={{ color: theme.dimmed }}>↳ {part.commandLine}</div>
                <OutputRenderer output={part.output} theme={theme} />
              </div>
            );
          case 'text':
            return (
              <div key={index} style={{ whiteSpace: 'pre-wrap', marginBottom: '4px' }}>{part.text}</div>
            );
          case 'sources':
            return (
              <div key={index} style={{ color: theme.dimmed, marginBottom: '4px' }}>{part.line}</div>
            );
          case 'notice':
            return (
              <div
                key={index}
                style={{ color: part.notice === 'error' || part.notice === 'too-long' ? theme.error : theme.dimmed, marginBottom: '4px' }}
              >
                {part.message}
              </div>
            );
        }
      })}
      {state.status === 'cancelled' && <div style={{ color: theme.dimmed }}>^C</div>}
    </div>
  );
}
