import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import AnalyticsTracker from '@/components/AnalyticsTracker';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://paperlens.in'),
  title: {
    default: 'PaperLens | AI Research Paper Companion for arXiv',
    template: '%s | PaperLens',
  },
  description:
    'Understand arXiv research papers through layered explanations, diagrams, concept cards, cited chat, learning paths, bookmarks, and PDF exports.',
  keywords: [
    'research papers',
    'arxiv',
    'AI',
    'machine learning',
    'visual learning',
    'paper summarizer',
  ],
  openGraph: {
    title: 'PaperLens | AI Research Paper Companion for arXiv',
    description:
      'Paste an arXiv paper and get a clear visual breakdown with cited explanations, diagrams, concepts, and a learning path.',
    url: '/',
    siteName: 'PaperLens',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PaperLens | Decode arXiv Papers Clearly',
    description:
      'Layered explanations, visual diagrams, concept cards, cited chat, and study-ready exports for arXiv papers.',
  },
  alternates: {
    canonical: '/',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <AuthProvider>
          {children}
          <Suspense fallback={null}>
            <AnalyticsTracker />
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}
