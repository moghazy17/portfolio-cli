import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Ahmed Moghazy | Data Science & ML Engineer',
  description:
    'Interactive terminal portfolio of Ahmed Moghazy — Data Science graduate specializing in ML, AI, RAG, and LangChain. Type "help" to explore.',
  keywords: [
    'Ahmed Moghazy',
    'Data Science',
    'Machine Learning',
    'Portfolio',
    'ML Engineer',
    'AI',
    'RAG',
    'LangChain',
  ],
  authors: [{ name: 'Ahmed Moghazy' }],
  openGraph: {
    title: 'Ahmed Moghazy | Terminal Portfolio',
    description:
      'Interactive CLI-style portfolio. Explore experience, projects, and skills. Try: npx ahmed-moghazy',
    type: 'website',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ahmed Moghazy | Terminal Portfolio',
    description: 'Interactive CLI-style portfolio',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={jetbrainsMono.variable}>
      <body>{children}</body>
    </html>
  );
}
