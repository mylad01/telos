'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="shared">
      <h1 className="shared-title">Something went wrong</h1>
      <p className="shared-meta">{error.message}</p>
      <button className="shared-cta" type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
