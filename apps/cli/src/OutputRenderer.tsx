import React from 'react';
import { Box, Text } from 'ink';
import type { CommandOutput } from '@ahmed-moghazy/shared';

interface Props {
  output: CommandOutput[];
}

export default function OutputRenderer({ output }: Props) {
  const renderBlock = (block: CommandOutput, index: number): React.ReactNode => {
    switch (block.type) {
      case 'text': {
        const color =
          block.style?.color === 'primary'
            ? 'green'
            : block.style?.color === 'error'
              ? 'red'
              : block.style?.color === 'success'
                ? 'green'
                : block.style?.color === 'accent'
                  ? 'cyan'
                  : undefined;
        return (
          <Text
            key={index}
            bold={block.style?.bold}
            dimColor={block.style?.dim}
            color={color}
          >
            {block.content}
          </Text>
        );
      }

      case 'section':
        return (
          <Box key={index} flexDirection="column" marginBottom={1}>
            <Text bold color="cyan">
              {'\u2500\u2500'} {block.title} {'\u2500'.repeat(Math.max(0, 50 - block.title.length))}
            </Text>
            {block.children.map((child, i) => renderBlock(child, i))}
          </Box>
        );

      case 'list':
        return (
          <Box key={index} flexDirection="column" paddingLeft={2}>
            {block.items.map((item, i) => (
              <Text key={i}>
                <Text color="green">{block.ordered ? `${i + 1}.` : '\u25B8'}</Text>
                {' '}
                {item}
              </Text>
            ))}
          </Box>
        );

      case 'table': {
        const colWidths = block.headers.map((h, ci) =>
          Math.max(h.length, ...block.rows.map((r) => (r[ci] || '').length)),
        );
        return (
          <Box key={index} flexDirection="column">
            <Text bold color="cyan">
              {block.headers.map((h, i) => h.padEnd(colWidths[i] + 2)).join('')}
            </Text>
            <Text dimColor>
              {colWidths.map((w) => '\u2500'.repeat(w + 2)).join('')}
            </Text>
            {block.rows.map((row, ri) => (
              <Text key={ri}>
                {row.map((cell, ci) => cell.padEnd(colWidths[ci] + 2)).join('')}
              </Text>
            ))}
          </Box>
        );
      }

      case 'ascii':
        return (
          <Text key={index} color="green">
            {block.content}
          </Text>
        );

      case 'link':
        return (
          <Text key={index}>
            <Text dimColor>{block.text}: </Text>
            <Text color="blue" underline>
              {block.url}
            </Text>
          </Text>
        );

      case 'divider':
        return (
          <Text key={index} dimColor>
            {'\u2500'.repeat(60)}
          </Text>
        );

      default:
        return null;
    }
  };

  return <Box flexDirection="column">{output.map(renderBlock)}</Box>;
}
