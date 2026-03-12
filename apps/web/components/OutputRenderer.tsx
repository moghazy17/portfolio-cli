'use client';

import type { CommandOutput, Theme } from '@ahmed-moghazy/shared';

interface Props {
  output: CommandOutput[];
  theme: Theme;
}

export default function OutputRenderer({ output, theme }: Props) {
  const resolveColor = (color?: string): string | undefined => {
    if (!color) return undefined;
    const map: Record<string, string> = {
      primary: theme.primary,
      secondary: theme.secondary,
      accent: theme.accent,
      error: theme.error,
      success: theme.success,
    };
    return map[color] || color;
  };

  const renderBlock = (block: CommandOutput, index: number): React.ReactNode => {
    switch (block.type) {
      case 'text':
        return (
          <div
            key={index}
            style={{
              color: resolveColor(block.style?.color),
              fontWeight: block.style?.bold ? 'bold' : undefined,
              opacity: block.style?.dim ? 0.6 : undefined,
              fontStyle: block.style?.italic ? 'italic' : undefined,
              marginBottom: '4px',
            }}
          >
            {block.content}
          </div>
        );

      case 'section':
        return (
          <div key={index} style={{ marginBottom: '12px' }}>
            <div
              style={{
                color: theme.accent,
                fontWeight: 'bold',
                borderBottom: `1px solid ${theme.dimmed}`,
                paddingBottom: '4px',
                marginBottom: '8px',
              }}
            >
              {block.title}
            </div>
            {block.children.map((child, i) => renderBlock(child, i))}
          </div>
        );

      case 'list':
        return (
          <ul
            key={index}
            style={{
              listStyle: 'none',
              paddingLeft: '16px',
              marginBottom: '8px',
            }}
          >
            {block.items.map((item, i) => (
              <li key={i} style={{ marginBottom: '2px' }}>
                <span style={{ color: theme.accent, marginRight: '8px' }}>
                  {block.ordered ? `${i + 1}.` : '\u25B8'}
                </span>
                {item}
              </li>
            ))}
          </ul>
        );

      case 'table':
        return (
          <div key={index} style={{ overflowX: 'auto', marginBottom: '8px' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr>
                  {block.headers.map((h, i) => (
                    <th
                      key={i}
                      style={{
                        textAlign: 'left',
                        color: theme.accent,
                        padding: '4px 12px 4px 0',
                        borderBottom: `1px solid ${theme.dimmed}`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} style={{ padding: '2px 12px 2px 0' }}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'ascii':
        return (
          <pre
            key={index}
            className="ascii-banner"
            style={{
              color: resolveColor(block.style?.color),
              fontSize: '10px',
              lineHeight: '1.1',
              marginBottom: '8px',
              overflowX: 'auto',
            }}
          >
            {block.content}
          </pre>
        );

      case 'link':
        return (
          <div key={index} style={{ marginBottom: '4px' }}>
            <span style={{ color: theme.dimmed }}>{block.text}: </span>
            <a
              href={block.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: theme.primary, textDecoration: 'underline', wordBreak: 'break-all' }}
            >
              {block.url}
            </a>
          </div>
        );

      case 'divider':
        return (
          <hr
            key={index}
            style={{
              border: 'none',
              borderTop: `1px solid ${theme.dimmed}`,
              margin: '8px 0',
            }}
          />
        );

      default:
        return null;
    }
  };

  return <div style={{ marginTop: '8px' }}>{output.map(renderBlock)}</div>;
}
