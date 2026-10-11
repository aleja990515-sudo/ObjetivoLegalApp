import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import './globals.css';

const geist = localFont({
  src: '../fonts/Geist-Variable.woff2',
  variable: '--font-geist',
  display: 'swap',
  weight: '100 900',
});

const geistMono = localFont({
  src: '../fonts/GeistMono-Variable.woff2',
  variable: '--font-geist-mono',
  display: 'swap',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'Mis Procesos',
  description: 'Seguimiento de procesos judiciales de la oficina',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f5f7' },
    { media: '(prefers-color-scheme: dark)', color: '#111113' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es" className={`${geist.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
