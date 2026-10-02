// Layout ported from the 21st.dev "Hero Block" by moumensoliman (21st id 10628).
import { cvData, profile } from '@ahmed-moghazy/shared';
import CvLink from './CvLink';
import { ArrowDownIcon, GithubIcon, LinkedinIcon, MailIcon } from './icons';

const buttonBase = 'inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold';
const socialClass = 'flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-fg hover:bg-accent hover:text-on-accent';

function firstSentence(text: string): string {
  return text.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? text;
}

function initials(name: string): string {
  return name.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase();
}

export default function GuiHero() {
  const { contact } = cvData;
  return (
    <header id="hero" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(to_right,#80808014_1px,transparent_1px),linear-gradient(to_bottom,#80808014_1px,transparent_1px)] bg-[size:24px_24px]"
      />
      <div className="relative mx-auto flex min-h-[80svh] max-w-3xl flex-col items-center justify-center px-5 py-16 text-center sm:px-6">
        <div
          aria-hidden="true"
          className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border-4 border-bg bg-gradient-to-br from-brand to-accent font-code text-3xl font-bold text-on-accent shadow-lg"
        >
          {initials(profile.name)}
        </div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight sm:text-6xl">{profile.name}</h1>
        <p className="mb-5 font-code text-lg text-accent sm:text-xl">{profile.label}</p>
        <p className="mb-8 max-w-2xl text-lg text-muted sm:text-xl">{firstSentence(cvData.professionalSummary)}</p>

        <div className="mb-8 flex flex-wrap justify-center gap-3">
          <CvLink className={`${buttonBase} bg-accent text-on-accent hover:opacity-90`} />
          <a href="#projects" className={`${buttonBase} border border-border bg-card hover:border-accent`}>
            View projects
            <ArrowDownIcon className="h-4 w-4" />
          </a>
        </div>

        <ul className="flex justify-center gap-3">
          <li>
            <a href={contact.github} className={socialClass} aria-label="GitHub" target="_blank" rel="noopener noreferrer">
              <GithubIcon />
            </a>
          </li>
          <li>
            <a href={contact.linkedin} className={socialClass} aria-label="LinkedIn" target="_blank" rel="noopener noreferrer">
              <LinkedinIcon />
            </a>
          </li>
          <li>
            <a href={`mailto:${contact.email}`} className={socialClass} aria-label={`Email ${contact.email}`}>
              <MailIcon />
            </a>
          </li>
        </ul>
      </div>
    </header>
  );
}
