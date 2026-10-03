import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { createShell, cvData, profile, resumeDownload, site } from '@ahmed-moghazy/shared';
import type { FilmEntry } from '@ahmed-moghazy/shared';
import { skillEvidence, STALE_AFTER_MS } from '@ahmed-moghazy/shared/assistant-server';
import { getInventory } from '../../lib/inventory-store';
import { recentFilms } from '../../lib/letterboxd';
import BeWindow from '../../components/desk/BeWindow';
import Deskbar from '../../components/desk/Deskbar';
import DeskTerminal from '../../components/desk/DeskTerminal';
import DesktopIcons from '../../components/desk/DesktopIcons';
import { DesktopProvider } from '../../components/desk/DesktopContext';
import BootScreen from '../../components/desk/BootScreen';
import ExperienceList from '../../components/desk/ExperienceList';
import FilmsList from '../../components/desk/FilmsList';
import GuestbookBody from '../../components/desk/GuestbookBody';
import CvLink from '../../components/gui/CvLink';
import ViewMemory from '../../components/gui/ViewMemory';
import { GithubIcon, LinkedinIcon, MailIcon, MapPinIcon, PhoneIcon } from '../../components/gui/icons';

// Static, refreshed hourly (not force-static) so data fetched at render time can stay current.
export const revalidate = 3600;

const title = `${profile.name} — Portfolio`;

export const metadata: Metadata = {
  metadataBase: new URL('https://moghazy.me'),
  title,
  description: site.description,
  alternates: { canonical: '/' },
  openGraph: { title, description: site.description, type: 'website', url: '/', images: ['/og-image.png'] },
};

const getGuiSkillEvidence = unstable_cache(async () => {
  const inventory = await getInventory();
  return inventory && Number.isFinite(Date.parse(inventory.generatedAt)) && Date.now() - Date.parse(inventory.generatedAt) <= STALE_AFTER_MS
    ? skillEvidence(inventory, cvData.skills) : null;
}, ['gui-skill-evidence'], { revalidate: 3600 });

async function films(): Promise<FilmEntry[]> {
  try { return await recentFilms(); } catch { return []; }
}

function display(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export default async function GuiPage() {
  const [evidence, diary] = await Promise.all([getGuiSkillEvidence(), films()]);
  const shell = createShell({ surface: 'web', origin: 'https://moghazy.me' });
  const about = await shell.run('about');
  const { user, host, cwd } = shell.prompt();
  const initial = [
    { input: '', output: [], identity: { name: profile.name, label: profile.label, location: cvData.contact.location } },
    { prompt: `${user}@${host}:${cwd}$`, input: 'about', output: about.output },
  ];
  const { contact, education } = cvData;
  const current = cvData.experience[0];
  // The IANA zone is named after the city in content; keep the two in step if the location changes.
  const city = contact.location.split(',')[0];
  const download = resumeDownload();
  const topSkills = cvData.skills.slice(0, 3).flatMap((category) => category.skills.slice(0, 2));
  const proven = (skill: string) => (evidence?.[skill] ?? 0) > 0;
  const maximum = Math.max(1, ...Object.values(evidence ?? {}));

  return (
    <DesktopProvider>
      <BootScreen />
      <ViewMemory />
      <div className="be-desk">
        <Deskbar host="moghazy.me" place={city} timeZone={`Africa/${city}`} />
        <DesktopIcons
          variant="desktop"
          icons={[
            ...(download ? [{ label: 'Résumé.pdf', icon: '/desk/resume.webp', href: download.url, download: download.filename }] : []),
            { label: 'About', icon: '/desk/about.webp', open: 'about' },
            { label: 'Projects', icon: '/desk/projects.webp', open: 'projects' },
            { label: 'Experience', icon: '/desk/experience.webp', open: 'experience' },
            { label: 'Skills', icon: '/desk/skills.webp', open: 'skills' },
            { label: 'Guestbook', icon: '/desk/guestbook.webp', open: 'guestbook' },
            { label: 'Mail', icon: '/desk/mail.webp', open: 'contact' },
            { label: 'Films', icon: '/desk/films.webp', open: 'films' },
            { label: 'Matchday', icon: '/desk/matchday.webp', run: 'visca' },
          ]}
        />

        <main id="main" className="be-scenes">
          <h1 className="sr-only">{profile.name}, {profile.label}</h1>
          <div className="be-scene be-scene-1">
            <DeskTerminal initial={initial} />

            <BeWindow id="hero" as="header" title="Résumé.pdf" heading={false} className="be-hero"
              mark={{ command: 'sudo hire-me', label: 'Secret: sudo hire-me', glyph: 'key' }}>
              <div className="be-paper">
                <p className="be-paper-name">{profile.name}</p>
                <p className="be-paper-role">{profile.label}</p>
                <p className="be-paper-meta">{contact.location}</p>
                <p className="be-paper-rule">Experience</p>
                <p className="be-paper-line"><strong>{current.role}</strong> · {current.company}<span className="be-num">{current.startDate} – {current.endDate}</span></p>
                <p className="be-paper-rule">Skills</p>
                <p className="be-paper-small">{topSkills.join(' · ')}</p>
                <p className="be-paper-rule">Education</p>
                <p className="be-paper-line"><strong>{education.degree}</strong><span className="be-num">{education.startDate} – {education.endDate}</span></p>
                <p className="be-paper-small">{education.institution}</p>
                <ul className="be-paper-links">
                  <li><a href={contact.github} target="_blank" rel="noopener noreferrer"><GithubIcon className="be-ico" />GitHub</a></li>
                  <li><a href={contact.linkedin} target="_blank" rel="noopener noreferrer"><LinkedinIcon className="be-ico" />LinkedIn</a></li>
                </ul>
              </div>
              <CvLink className="be-button be-button-default be-button-wide" />
            </BeWindow>

            <BeWindow id="projects" title="Projects" className="be-projects">
              <div className="be-tracker">
                <div className="be-tracker-head" aria-hidden="true"><span>Name</span><span>Tech</span><span>Year</span></div>
                <ul className="be-tracker-rows">
                  {cvData.projects.map((project) => (
                    <li key={project.shortName}>
                      <details className="be-disclosure">
                        <summary className="be-row">
                          <span className="be-row-name">
                            <img src="/desk/projects.webp" alt="" width={22} height={22} />
                            <span>
                              <h3>{project.name}</h3>
                              <span className="be-row-sub">{project.bullets[0]}</span>
                            </span>
                          </span>
                          <span>{project.techStack}</span>
                          <span className="be-num">{project.startDate === project.endDate ? project.startDate : `${project.startDate} – ${project.endDate}`}</span>
                        </summary>
                        <div className="be-detail">
                          {project.isGraduation && <p className="be-badge">Graduation project</p>}
                          <ul>{project.bullets.slice(1).map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </div>
            </BeWindow>
          </div>

          <div className="be-scene be-scene-2">
            <BeWindow id="experience" title="Experience" className="be-experience">
              <ExperienceList experience={cvData.experience} />
            </BeWindow>

            <BeWindow id="films" title="Films" className="be-films">
              <FilmsList films={diary} />
            </BeWindow>

            <BeWindow id="guestbook" title="Guestbook" className="be-guestbook-win"
              mark={{ command: 'spidey', label: 'Secret: thwip', glyph: 'spider' }}>
              <GuestbookBody />
            </BeWindow>
          </div>

          <div className="be-scene be-scene-3">
            <BeWindow id="about" title="About" className="be-about">
              <div className="be-pad be-prose">
                <p>{cvData.professionalSummary}</p>
                <h3>{education.degree}</h3>
                <p className="be-muted">{education.faculty}, {education.institution} · {education.startDate} – {education.endDate} · GPA {education.gpa}</p>
                <p className="be-muted">Coursework: {education.coursework.join(', ')}.</p>
              </div>
            </BeWindow>

            <BeWindow id="skills" title="Skills" className="be-skills">
              <div className="be-profile">
                {cvData.skills.map((category) => (
                  <div key={category.name} className="be-profile-group">
                    <h3>{category.name}</h3>
                    {evidence && category.skills.some(proven) && (
                      <ul className="be-meters">
                        {category.skills.filter(proven).map((skill) => (
                          <li key={skill}>
                            <span>{skill}</span>
                            <span className="be-meter" role="img" aria-label={`${skill}: ${evidence[skill]} public repositories`}>
                              <span style={{ width: `${100 * evidence[skill] / maximum}%` }} />
                            </span>
                            <span className="be-num">{evidence[skill]}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {category.skills.some((skill) => !evidence || !proven(skill)) && (
                      <p className="be-chiplist">{category.skills.filter((skill) => !evidence || !proven(skill)).join(' · ')}</p>
                    )}
                  </div>
                ))}
                {evidence && <p className="be-muted be-profile-note">Bars count public GitHub repositories that use each skill.</p>}
              </div>
            </BeWindow>

            <BeWindow id="contact" title="Mail" className="be-contact">
              <ul className="be-mail">
                <li><a href={`mailto:${contact.email}`}><MailIcon className="be-ico" />{contact.email}</a></li>
                <li><a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}><PhoneIcon className="be-ico" />{contact.phone}</a></li>
                <li><a href={contact.linkedin} target="_blank" rel="noopener noreferrer"><LinkedinIcon className="be-ico" />{display(contact.linkedin)}</a></li>
                <li><a href={contact.github} target="_blank" rel="noopener noreferrer"><GithubIcon className="be-ico" />{display(contact.github)}</a></li>
                <li><span><MapPinIcon className="be-ico" />{contact.location}</span></li>
              </ul>
              <div className="be-mail-actions">
                <a className="be-button be-button-default" href={`mailto:${contact.email}`}>Compose</a>
                <CvLink testId="gui-cv-contact" className="be-button" />
              </div>
            </BeWindow>
          </div>

          <footer className="be-footer">
            <p>Psst: two windows hide something in their bottom-right corner.</p>
          </footer>
        </main>

        <DesktopIcons
          variant="dock"
          icons={[
            { label: 'Résumé', icon: '/desk/resume.webp', open: 'hero' },
            { label: 'About', icon: '/desk/about.webp', open: 'about' },
            { label: 'Projects', icon: '/desk/projects.webp', open: 'projects' },
            { label: 'Guestbook', icon: '/desk/guestbook.webp', open: 'guestbook' },
            { label: 'Mail', icon: '/desk/mail.webp', open: 'contact' },
          ]}
        />
      </div>
    </DesktopProvider>
  );
}
