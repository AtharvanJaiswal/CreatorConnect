import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'CreatorConnect — Engineering Foundation',
  description: 'Multi-sided creator economy platform foundation',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          backgroundColor: '#0a0a0c',
          color: '#f3f4f6',
        }}
      >
        {children}
      </body>
    </html>
  );
}
