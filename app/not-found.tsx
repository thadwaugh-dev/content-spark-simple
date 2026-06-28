import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-900 p-6">
      <h1 className="text-4xl font-semibold tracking-tight mb-2">404</h1>
      <p className="text-slate-600 mb-6">This page could not be found.</p>
      <Link
        href="/"
        className="text-emerald-600 font-medium hover:underline"
      >
        Back to ContentSpark
      </Link>
    </main>
  );
}