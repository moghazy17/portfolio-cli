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

/** The published CV's path and download filename, or null while no CV is published. */
export function resumeDownload(data: Content = content): { url: string; filename: string } | null {
  if (!data.cv.available) return null;
  return { url: data.cv.path, filename: `${data.resume.basics.name.trim().split(/\s+/).join('-')}-CV.pdf` };
}

export function resumeCommand(ctx: CommandContext, data: Content = content): CommandResult {
  const download = resumeDownload(data);
  if (!download) {
    return { status: 'error', output: [{ type: 'error', content: 'resume: CV not published yet' }] };
  }
  const { filename } = download;
  if (ctx.surface === 'web') {
    return {
      download,
      output: [
        { type: 'text', content: 'Downloading resume…', style: { color: 'success' } },
        { type: 'link', text: filename, url: data.cv.path },
      ],
    };
  }
  return { output: [{ type: 'text', content: `Resume (PDF): ${resumeUrl(data.cv.path, ctx.origin)}` }] };
}
