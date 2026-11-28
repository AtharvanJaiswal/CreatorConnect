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
    <div className="p-8 text-center">
      <h2 className="text-lg font-semibold text-red-500">Application Error</h2>
      <p className="mt-2 text-sm text-neutral-500">
        An unexpected error occurred in the Web Shell.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-4 cursor-pointer rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Retry
      </button>
    </div>
  );
}
