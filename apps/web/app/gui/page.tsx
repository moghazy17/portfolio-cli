import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { cvData, profile, site } from '@ahmed-moghazy/shared';
import { skillEvidence, STALE_AFTER_MS } from '@ahmed-moghazy/shared/assistant-server';
import { getInventory } from '../../lib/inventory-store';
import GuiAbout from '../../components/gui/GuiAbout';
import GuiContact from '../../components/gui/GuiContact';
import GuiHero from '../../components/gui/GuiHero';
import GuiGuestbook from '../../components/gui/GuiGuestbook';
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
  { href: '#guestbook', label: 'Guestbook' },
  { href: '#contact', label: 'Contact' },
];

const getGuiSkillEvidence = unstable_cache(async () => {
  const inventory = await getInventory();
  return inventory && Number.isFinite(Date.parse(inventory.generatedAt)) && Date.now() - Date.parse(inventory.generatedAt) <= STALE_AFTER_MS
    ? skillEvidence(inventory, cvData.skills) : null;
}, ['gui-skill-evidence'], { revalidate: 3600 });

export default async function GuiPage() {
  const evidence = await getGuiSkillEvidence();
  return (
    <>
      <ViewMemory />
      <GuiNav name={profile.name} links={navLinks} />
      <main id="main">
        <GuiHero />
        <Reveal><GuiAbout /></Reveal>
        <Reveal><GuiTimeline /></Reveal>
        <Reveal><GuiProjects /></Reveal>
        <Reveal><GuiSkills evidence={evidence ?? undefined} /></Reveal>
        <Reveal><GuiGuestbook /></Reveal>
        <Reveal><GuiContact /></Reveal>
      </main>
    </>
  );
}
