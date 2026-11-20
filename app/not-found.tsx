import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex h-full flex-col items-start justify-center rounded-[12px] bg-white px-8 shadow-card">
      <h1 className="title">Redline Supply</h1>
      <p className="mt-2 text-[14px] text-secondary">That page is not in this demo.</p>
      <Link href="/" className="mt-4 text-[13px] font-semibold text-brand">
        Go home
      </Link>
    </div>
  );
}
