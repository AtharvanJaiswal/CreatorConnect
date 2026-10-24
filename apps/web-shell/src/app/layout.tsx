import type { Metadata } from 'next';
import React from 'react';
import '@creatorconnect/design-system/globals.css';
import { Header } from '../components/header';
import { Footer } from '../components/footer';
import { AuthProvider } from '../providers/auth-provider';

export const metadata: Metadata = {
  title: 'CreatorConnect — Multi-Sided Creator Economy Platform',
  description:
    'Production-grade multi-sided ecosystem connecting Creators, Production Talent, Brands, and Operations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400..800;1,400..800&family=Inter:wght@300;400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,200..800;1,6..72,200..800&family=Outfit:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@1,400;1,600&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/20 selection:text-primary flex flex-col justify-between">
        <AuthProvider>
          <div>
            <Header />
            <main className="flex-1">{children}</main>
          </div>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
