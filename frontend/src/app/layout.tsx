import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Navbar } from '../components/Navbar';

export const metadata: Metadata = {
  title: 'AI Prompt Experiment & Release Manager | Production AI Quality Platform',
  description:
    'Full-stack platform for immutable prompt version management, deterministic A/B testing, offline evaluation runners, quality gates, and staged AI releases.',
  icons: {
    icon: '/logo.svg',
    shortcut: '/logo.svg',
    apple: '/logo.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-slate-100 antialiased selection:bg-violet-500/30 selection:text-white">
        <Navbar />
        <main className="min-h-[calc(100vh-4rem)] pb-12">{children}</main>
      </body>
    </html>
  );
}
