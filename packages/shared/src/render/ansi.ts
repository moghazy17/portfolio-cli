import type { CommandOutput, OutputStyle, Theme } from '../types';
import { toLines } from '../shell/lines';
import { DEFAULT_THEME, themes } from '../theme';

function styleCodes(style: OutputStyle | undefined, theme: Theme): string {
  if (!style) return '';
  let codes = '';
  if (style.color) {
    const color = style.color in theme ? theme[style.color as keyof Theme] : style.color;
    if (/^#[0-9a-f]{6}$/i.test(color)) {
      const rgb = color.slice(1).match(/../g)!.map((part) => parseInt(part, 16));
      codes += `\x1b[38;2;${rgb.join(';')}m`;
    }
  }
  if (style.bold) codes += '\x1b[1m';
  if (style.dim) codes += '\x1b[2m';
  if (style.italic) codes += '\x1b[3m';
  return codes;
}

export function renderAnsi(
  output: CommandOutput[],
  { color = true, width = 80, theme = themes[DEFAULT_THEME] }: { color?: boolean; width?: number; theme?: Theme } = {},
): string {
  void width;
  const rendered = output.flatMap((node) => toLines([node]).map((line) => ({
    line,
    showItems: node.type === 'lines' && node.showItems,
  })));
  if (!rendered.length) return '';
  return rendered.map(({ line, showItems }) => {
    const visible = `${line.item && showItems ? `${line.item}: ` : ''}${line.text}`;
    if (!color) return visible;
    const codes = styleCodes(line.style, theme);
    const styled = codes ? `${codes}${visible}\x1b[0m` : visible;
    return line.href ? `\x1b]8;;${line.href}\x1b\\${styled}\x1b]8;;\x1b\\` : styled;
  }).join('\n') + '\n';
}
