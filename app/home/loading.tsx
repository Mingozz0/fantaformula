export default function Loading() {
  return <main className="min-h-screen bg-[#f6f6f4] px-5 py-12 text-zinc-950">
    <div role="status" className="mx-auto max-w-7xl rounded-2xl border border-zinc-200 bg-white p-6">
      <p className="font-semibold">Caricamento della pagina…</p>
      <div aria-hidden="true" className="mt-5 space-y-3 motion-safe:animate-pulse">
        <div className="h-6 w-1/3 rounded bg-zinc-100" />
        <div className="h-20 rounded bg-zinc-100" />
      </div>
    </div>
  </main>;
}
