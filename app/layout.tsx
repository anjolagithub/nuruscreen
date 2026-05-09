import type { Metadata, Viewport } from 'next';
import { DM_Sans, DM_Mono } from 'next/font/google';
import { AuthProvider } from '@/lib/auth';
import './globals.css';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans', weight: ['300','400','500','600','700'] });
const dmMono = DM_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400','500'] });

export const metadata: Metadata = {
  title: 'NuruScreen — Child Malnutrition Screening',
  description: 'AI-powered malnutrition screening for community health workers. Works offline.',
  manifest: '/manifest.json',
  icons: { icon: '/logo.svg', apple: '/logo.svg' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'NuruScreen' },
};

export const viewport: Viewport = {
  themeColor: '#0f4c35', width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable}`}>
      <body>
        <script dangerouslySetInnerHTML={{
  __html: `if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');`
}} />
        <AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
