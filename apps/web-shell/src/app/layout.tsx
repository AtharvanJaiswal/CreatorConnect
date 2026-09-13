import type { Metadata } from 'next';
import React from 'react';
import '@creatorconnect/design-system/globals.css';
import { Header } from '../components/header';
import { Footer } from '../components/footer';

export const metadata: Metadata = {
  title: 'CreatorConnect — Multi-Sided Creator Economy Platform',
  description:
    'Production-grade multi-sided ecosystem connecting Creators, Production Talent, Brands, and Operations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/20 selection:text-primary flex flex-col justify-between">
        <div>
          <Header />
          <main className="flex-1">{children}</main>
        </div>
        <Footer />
      </body>
    </html>
  );
}
