import type { ReactNode } from 'react';
import { AppShell, SiteFooter, themeInitScript } from '@eylulg/ui/chrome';
import '@eylulg/ui/fonts.css';
import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';
import { Nav } from './nav';

export const metadata: Metadata = {
  title: 'Review Companion',
  description:
    'Paste a GitHub pull request URL, get a structured code review from Claude, triage the findings and copy them as review comments.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0e12' },
  ],
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // The theme script changes the class on <html> before React hydrates, so suppress the attribute mismatch.
    <html lang='en' suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <AppShell header={<Nav />} footer={<SiteFooter currentId='review-companion' />}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
