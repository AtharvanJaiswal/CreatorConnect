'use client';

import React, { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error securely without leaking sensitive info
    console.error('WebShell Error Caught:', error.message);
  }, [error]);

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2 style={{ color: '#ef4444' }}>Application Error</h2>
      <p style={{ color: '#9ca3af' }}>An unexpected error occurred in the Web Shell.</p>
      <button
        onClick={() => reset()}
        style={{
          backgroundColor: '#2563eb',
          color: '#ffffff',
          border: 'none',
          padding: '0.5rem 1rem',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Retry
      </button>
    </div>
  );
}
