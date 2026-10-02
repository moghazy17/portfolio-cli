import type { Metadata } from 'next';
import { profile, site } from '@ahmed-moghazy/shared';
import GuiAbout from '../../components/gui/GuiAbout';
import GuiContact from '../../components/gui/GuiContact';
import GuiHero from '../../components/gui/GuiHero';
import GuiNav from '../../components/gui/GuiNav';
import GuiProjects from '../../components/gui/GuiProjects';
import GuiSkills from '../../components/gui/GuiSkills';
import GuiTimeline from '../../components/gui/GuiTimeline';
import Reveal from '../../components/gui/Reveal';
import ViewMemory from '../../components/gui/ViewMemory';

// Static, refreshed hourly (not force-static) so data fetched at render time can stay current.
export const revalidate = 3600;

const title = `${profile.name} — Portfolio`;

export const metadata: Metadata = {
  metadataBase: new URL('https://moghazy.me'),
  title,
  description: site.description,
  alternates: { canonical: '/gui' },
  openGraph: {
    title,
    description: site.description,
    type: 'website',
    url: '/gui',
    images: ['/og-image.png'],
  },
};

const navLinks = [
  { href: '#about', label: 'About' },
  { href: '#experience', label: 'Experience' },
  { href: '#projects', label: 'Projects' },
  { href: '#skills', label: 'Skills' },
  { href: '#contact', label: 'Contact' },
];

export default function GuiPage() {
  return (
    <>
      <ViewMemory />
      <GuiNav name={profile.name} links={navLinks} />
      <main id="main">
        <GuiHero />
        <Reveal><GuiAbout /></Reveal>
        <Reveal><GuiTimeline /></Reveal>
        <Reveal><GuiProjects /></Reveal>
        <Reveal><GuiSkills /></Reveal>
        <Reveal><GuiContact /></Reveal>
      </main>
    </>
  );
}
