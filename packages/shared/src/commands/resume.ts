import { content } from '../content';
import type { Content } from '../content/schema';
import type { CommandContext, CommandResult } from '../types';

function resumeUrl(path: string, origin: string): string {
  if (!origin) return path;
  try {
    return new URL(path, origin).href;
  } catch {
    return path;
  }
}

export function resumeCommand(ctx: CommandContext, data: Content = content): CommandResult {
  if (!data.cv.available) {
    return { status: 'error', output: [{ type: 'error', content: 'resume: CV not published yet' }] };
  }
  const filename = `${data.resume.basics.name.trim().split(/\s+/).join('-')}-CV.pdf`;
  if (ctx.surface === 'web') {
    return {
      download: { url: data.cv.path, filename },
      output: [
        { type: 'text', content: 'Downloading resume…', style: { color: 'success' } },
        { type: 'link', text: filename, url: data.cv.path },
      ],
    };
  }
  return { output: [{ type: 'text', content: `Resume (PDF): ${resumeUrl(data.cv.path, ctx.origin)}` }] };
}
