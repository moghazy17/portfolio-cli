import type { CommandOutput, Line } from '../types';

export function toLines(output: CommandOutput[]): Line[] {
  const lines: Line[] = [];

  function append(nodes: CommandOutput[], item?: string): void {
    for (const node of nodes) {
      switch (node.type) {
        case 'text':
        case 'ascii':
          lines.push(...node.content.split('\n').map((text) => ({
            text,
            ...(node.style && { style: node.style }),
            ...(item && { item }),
          })));
          break;
        case 'error':
          lines.push(...node.content.split('\n').map((text) => ({
            text, style: { color: 'error' }, ...(item && { item }),
          })));
          break;
        case 'section': {
          const sectionItem = node.item || item;
          lines.push({
            text: node.title,
            style: { bold: true, color: 'accent' },
            ...(sectionItem && { item: sectionItem }),
          });
          append(node.children, sectionItem);
          break;
        }
        case 'list':
          lines.push(...node.items.map((value, index) => ({
            text: `${node.ordered ? `${index + 1}.` : '▸'} ${value}`,
            ...(node.style && { style: node.style }),
            ...(item && { item }),
          })));
          break;
        case 'table': {
          const rows = [node.headers, ...node.rows];
          const widths = node.headers.map((_, index) =>
            Math.max(...rows.map((row) => (row[index] || '').length)),
          );
          lines.push(...rows.map((row) => ({
            text: row.map((cell, index) => cell.padEnd(widths[index] || 0)).join('  ').trimEnd(),
            ...(item && { item }),
          })));
          break;
        }
        case 'link':
          lines.push({ text: `${node.text}: ${node.url}`, ...(item && { item }) });
          break;
        case 'progress':
          lines.push({ text: `${node.label}  ${Math.round(node.value * 100)}%`, ...(item && { item }) });
          break;
        case 'lines':
          lines.push(...node.lines.map((line) => ({ ...line, ...((line.item || item) && { item: line.item || item }) })));
          break;
        case 'divider':
          break;
      }
    }
  }

  append(output);
  return lines;
}
