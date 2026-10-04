import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { profile, site } from '@ahmed-moghazy/shared';
import './globals.css';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: site.title,
  description: site.description,
  keywords: site.keywords,
  authors: [{ name: profile.name }],
  openGraph: {
    title: site.ogTitle,
    description: site.ogDescription,
    type: 'website',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: site.ogTitle,
    description: site.twitterDescription,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={jetbrainsMono.variable}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
