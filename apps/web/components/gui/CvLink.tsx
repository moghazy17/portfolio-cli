import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { cvData, resumeDownload } from '@ahmed-moghazy/shared';
import { DownloadIcon } from './icons';

interface Props {
  className?: string;
  testId?: string;
}

// `available` comes from the generated content, so it is the same check the `resume` command makes.
// The file check also catches a build where the CV copy step was skipped. On Vercel, public files
// are served from the CDN and are not on the function's disk at revalidation time, so there the
// generated flag is trusted.
function cvFileExists(url: string): boolean {
  if (process.env.VERCEL) return true;
  return existsSync(join(process.cwd(), 'public', url));
}

export default function CvLink({ className, testId = 'gui-cv' }: Props) {
  const download = resumeDownload();
  if (!download || !cvFileExists(download.url)) {
    return (
      <a href={`mailto:${cvData.contact.email}`} className={className} data-testid={`${testId}-unavailable`}>
        CV temporarily unavailable, email me
      </a>
    );
  }
  return (
    <a href={download.url} download={download.filename} className={className} data-testid={testId}>
      <DownloadIcon className="h-4 w-4" />
      Download CV
    </a>
  );
}
