'use client';

import type { CommandOutput, Theme } from '@ahmed-moghazy/shared';
import { useEffect, useState } from 'react';
import { useTypewriter } from '../hooks/useTypewriter';

interface Props {
  output: CommandOutput[];
  theme: Theme;
  reveal?: boolean;
}

function contentLength(output: CommandOutput[]): number {
  return output.reduce((sum, node) => sum + (node.type === 'section' ? node.title.length + contentLength(node.children)
    : node.type === 'text' || node.type === 'ascii' || node.type === 'error' ? node.content.length
    : node.type === 'list' ? node.items.join('').length
    : node.type === 'table' ? node.headers.join('').length + node.rows.flat().join('').length
    : node.type === 'link' ? node.text.length + node.url.length
    : node.type === 'progress' ? node.label.length + (node.note?.length ?? 0)
    : node.type === 'lines' ? node.lines.map((line) => line.text).join('').length : 0), 0);
}

function partial(output: CommandOutput[], budget: number): CommandOutput[] {
  let left = budget;
  const take = (value: string) => { const part = value.slice(0, left); left -= part.length; return part; };
  const walk = (nodes: CommandOutput[]): CommandOutput[] => nodes.map((node): CommandOutput => {
    if (node.type === 'section') return { ...node, title: take(node.title), children: walk(node.children) };
    if (node.type === 'text' || node.type === 'ascii' || node.type === 'error') return { ...node, content: take(node.content) };
    if (node.type === 'list') return { ...node, items: node.items.map(take) };
    if (node.type === 'table') return { ...node, headers: node.headers.map(take), rows: node.rows.map((row) => row.map(take)) };
    if (node.type === 'link') return { ...node, text: take(node.text), url: take(node.url) };
    if (node.type === 'lines') return { ...node, lines: node.lines.map((line) => ({ ...line, text: take(line.text) })) };
    if (node.type === 'progress') { take(node.label); take(node.note ?? ''); return node; }
    return node;
  });
  return walk(output);
}

export default function OutputRenderer({ output, theme, reveal = false }: Props) {
  const total = contentLength(output);
  const { budget } = useTypewriter(total, reveal);
  const typing = reveal && budget < total;
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
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

  const renderBlock = (block: CommandOutput, index: number, animated = true): React.ReactNode => {
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
            {block.children.map((child, i) => renderBlock(child, i, animated))}
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

      case 'error':
        return <div key={index} style={{ color: theme.error }}>{block.content}</div>;

      case 'progress':
        return (
          <div
            key={index}
            role="progressbar"
            aria-valuenow={Math.round(block.value * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={block.label}
            aria-valuetext={block.note}
            style={{ whiteSpace: 'pre', fontFamily: 'var(--font-mono)' }}
          >
            {block.label} <span className={animated && block.reveal && !reduced ? 'skill-fill' : undefined}
              style={{ display: 'inline-block', width: `${Math.round(block.value * 20)}ch`, overflow: 'hidden', verticalAlign: 'bottom' }}>
              {'█'.repeat(Math.round(block.value * 20))}
            </span>{'░'.repeat(20 - Math.round(block.value * 20))} {block.note ?? `${Math.round(block.value * 100)}%`}
          </div>
        );

      case 'lines':
        return (
          <div key={index}>
            {block.lines.map((line, i) => (
              <div
                key={i}
                style={{
                  color: resolveColor(line.style?.color),
                  fontWeight: line.style?.bold ? 'bold' : undefined,
                  opacity: line.style?.dim ? 0.6 : undefined,
                  fontStyle: line.style?.italic ? 'italic' : undefined,
                  whiteSpace: 'pre',
                  marginBottom: '4px',
                }}
              >
                {block.showItems && line.item && <span style={{ color: theme.dimmed }}>{line.item}: </span>}
                {line.text}
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return <>
    <div className={typing ? 'sr-only' : undefined} style={{ marginTop: '8px' }}>
      {output.map((block, index) => renderBlock(block, index))}
    </div>
    {typing && <div aria-hidden="true" data-reveal="typing" style={{ marginTop: '8px' }}>
      {partial(output, budget).map((block, index) => renderBlock(block, index, false))}
    </div>}
  </>;
}
