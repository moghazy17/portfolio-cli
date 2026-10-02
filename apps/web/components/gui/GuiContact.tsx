import { cvData } from '@ahmed-moghazy/shared';
import CvLink from './CvLink';
import Section from './Section';
import { GithubIcon, LinkedinIcon, MailIcon, MapPinIcon, PhoneIcon } from './icons';

const rowClass = 'flex min-h-11 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:border-accent';

function display(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export default function GuiContact() {
  const { contact } = cvData;
  return (
    <Section id="contact" title="Contact" width="narrow">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <li>
          <a href={`mailto:${contact.email}`} className={rowClass}>
            <MailIcon className="h-5 w-5 shrink-0 text-accent" />
            <span className="min-w-0 [overflow-wrap:anywhere]">{contact.email}</span>
          </a>
        </li>
        <li>
          <a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`} className={rowClass}>
            <PhoneIcon className="h-5 w-5 shrink-0 text-accent" />
            <span className="min-w-0 [overflow-wrap:anywhere]">{contact.phone}</span>
          </a>
        </li>
        <li>
          <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" className={rowClass}>
            <LinkedinIcon className="h-5 w-5 shrink-0 text-accent" />
            <span className="min-w-0 [overflow-wrap:anywhere]">{display(contact.linkedin)}</span>
          </a>
        </li>
        <li>
          <a href={contact.github} target="_blank" rel="noopener noreferrer" className={rowClass}>
            <GithubIcon className="h-5 w-5 shrink-0 text-accent" />
            <span className="min-w-0 [overflow-wrap:anywhere]">{display(contact.github)}</span>
          </a>
        </li>
        <li className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-muted">
          <MapPinIcon className="h-5 w-5 shrink-0 text-accent" />
          <span>{contact.location}</span>
        </li>
        <li>
          <CvLink
            testId="gui-cv-contact"
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-on-accent hover:opacity-90"
          />
        </li>
      </ul>
    </Section>
  );
}
