import React from 'react';
import { formatCurrency, toIsoUtcString } from '@creatorconnect/utils';

export default function HomePage() {
  const currentDate = toIsoUtcString(new Date());
  const formattedSampleAmount = formatCurrency(500000, 'INR');

  return (
    <main style={{ maxWidth: '900px', margin: '0 auto', padding: '4rem 1.5rem' }}>
      <header
        style={{ borderBottom: '1px solid #27272a', paddingBottom: '2rem', marginBottom: '2rem' }}
      >
        <h1
          style={{ fontSize: '2.25rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#60a5fa' }}
        >
          CreatorConnect
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '1.125rem', margin: 0 }}>
          Phase 1: Production Engineering &amp; Monorepo Foundation
        </p>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2.5rem',
        }}
      >
        <div
          style={{
            backgroundColor: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '8px',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#34d399', fontSize: '1.125rem' }}>
            REST API Service
          </h3>
          <p style={{ color: '#a1a1aa', fontSize: '0.9rem', margin: 0 }}>
            Fastify 4 / Scalar OpenAPI / RFC 7807 Error Handling / Port 3000
          </p>
        </div>

        <div
          style={{
            backgroundColor: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '8px',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#a78bfa', fontSize: '1.125rem' }}>
            Realtime Service
          </h3>
          <p style={{ color: '#a1a1aa', fontSize: '0.9rem', margin: 0 }}>
            Socket.IO 4 / Redis Adapter / Port 3001
          </p>
        </div>

        <div
          style={{
            backgroundColor: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '8px',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#fbbf24', fontSize: '1.125rem' }}>
            Worker Supervisor
          </h3>
          <p style={{ color: '#a1a1aa', fontSize: '0.9rem', margin: 0 }}>
            BullMQ 5 / Redis Queue / Graceful Shutdown
          </p>
        </div>
      </section>

      <section
        style={{
          backgroundColor: '#18181b',
          border: '1px solid #27272a',
          borderRadius: '8px',
          padding: '1.5rem',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', marginTop: 0, color: '#f3f4f6' }}>
          Shared Packages Integration Check
        </h2>
        <ul style={{ color: '#d1d5db', lineHeight: 1.8, paddingLeft: '1.25rem' }}>
          <li>
            Shared Utils Date: <code>{currentDate}</code>
          </li>
          <li>
            Shared Currency Formatter: <code>{formattedSampleAmount}</code>
          </li>
          <li>Architectural Boundary: Phase 1 Monorepo Active (No Phase 2 features)</li>
        </ul>
      </section>
    </main>
  );
}
