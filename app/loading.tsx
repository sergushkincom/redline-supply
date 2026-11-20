export default function Loading() {
  return (
    <div className="h-full rounded-[12px] bg-white p-6 shadow-card" aria-busy="true" aria-live="polite">
      <div className="h-7 w-48 rounded-[6px] bg-muted" />
      <div className="mt-6 h-10 rounded-[6px] bg-muted" />
      <div className="mt-2 h-10 rounded-[6px] bg-muted" />
      <div className="mt-2 h-10 rounded-[6px] bg-muted" />
    </div>
  );
}
