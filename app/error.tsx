'use client';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-[12px] bg-white p-8 shadow-card">
      <h1 className="title">Redline Supply</h1>
      <p className="mt-2 text-[14px] text-secondary">Something went wrong in this demo.</p>
      <button type="button" className="mt-4 text-[13px] font-semibold text-brand" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
