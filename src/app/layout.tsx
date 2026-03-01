import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';

export const metadata: Metadata = {
  title: 'PaperLens | Decode Research Papers',
  description:
    'Make research papers fun, visual, and easy to understand. Paste any arXiv link and get a beautiful visual learning dashboard.',
  keywords: [
    'research papers',
    'arxiv',
    'AI',
    'machine learning',
    'visual learning',
    'paper summarizer',
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
