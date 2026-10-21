'use client';
import Link from 'next/link';
export function PortalError({ retry }: { retry: () => void }) {
  return <div role="alert" className="mx-auto my-12 max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-950 shadow-sm">
    <h1 className="text-xl font-black">Impossibile caricare questa pagina</h1>
    <p className="mt-2 text-sm text-zinc-500">Controlla la connessione e riprova.</p>
    <div className="mt-5 flex flex-wrap gap-3"><button onClick={retry} className="min-h-11 rounded-xl bg-red-600 px-5 font-bold text-white">Riprova</button><Link href="/home" className="inline-flex min-h-11 items-center rounded-xl border border-zinc-200 px-5 text-sm font-semibold">Le mie leghe</Link></div>
  </div>;
}
