'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, Download, LoaderCircle, X } from 'lucide-react';
import { previewResultImport } from '@/app/manager/import-actions';
import { driverStatusLabel } from '@/lib/labels';
import type { ResultImport } from '@/lib/result-import';
import { toast } from 'sonner';

export function ResultImportPanel({ raceId, event, drivers, disabled, onApply }: {
  raceId: number; event: 'gp' | 'sprint'; drivers: { id: number; name: string }[];
  disabled: boolean; onApply: (result: ResultImport) => void;
}) {
  const [pending, startImport] = useTransition();
  const [preview, setPreview] = useState<ResultImport | null>(null);
  const name = (id: number) => drivers.find((driver) => driver.id === id)?.name ?? `Pilota ${id}`;
  function load() {
    setPreview(null);
    startImport(async () => {
      try {
        const reply = await previewResultImport(raceId, event);
        if (reply.ok) setPreview(reply.result);
        else toast.error(reply.error);
      } catch { toast.error('Importazione non riuscita. La bozza è conservata: riprova.'); }
    });
  }
  return <section aria-label="Importazione risultati" className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-sm font-black">Risultati automatici</h3><p className="mt-1 text-xs text-zinc-500">Jolpica-F1 · Anteprima prima di applicare alla bozza</p></div>
      <button type="button" onClick={load} disabled={disabled || pending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 text-sm font-bold text-white disabled:opacity-50">
        {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Download aria-hidden className="size-4" />}{pending ? 'Recupero risultati…' : 'Importa risultati'}
      </button>
    </div>
    {preview && <div className="space-y-4" aria-live="polite">
      <div className="flex items-center justify-between gap-3"><h4 className="text-sm font-bold">Anteprima · {preview.drivers.filter((row)=>row.result_status!=='not_entered').length} partecipanti associati{preview.drivers.some((row)=>row.result_status==='not_entered')&&` · ${preview.drivers.filter((row)=>row.result_status==='not_entered').length} non iscritti`}</h4>
        <button type="button" onClick={() => setPreview(null)} aria-label="Chiudi anteprima" className="grid size-11 shrink-0 place-items-center rounded-lg hover:bg-zinc-200"><X aria-hidden className="size-4" /></button></div>
      <div className="max-h-80 overflow-auto rounded-lg border border-zinc-200 bg-white" tabIndex={0} role="region" aria-label="Risultati da importare">
        <table className="w-full text-left text-xs"><thead className="sticky top-0 bg-zinc-100 text-zinc-600"><tr>
          <th scope="col" className="p-3">Pilota</th><th scope="col" className="p-3">Griglia</th><th scope="col" className="p-3">Arrivo</th><th scope="col" className="p-3">Esito</th>
        </tr></thead><tbody>{preview.drivers.toSorted((a, b) => (a.finish_position ?? 100) - (b.finish_position ?? 100)).map((driver) => <tr key={driver.driver_id} className="border-t border-zinc-100">
          <th scope="row" className="p-3 font-semibold">{name(driver.driver_id)}</th><td className="p-3 tabular-nums">{driver.grid_position ?? '—'}</td>
          <td className="p-3 tabular-nums">{driver.finish_position ?? '—'}</td><td className="p-3">{driverStatusLabel(driver.result_status)}{driver.result_status === 'dns' && <span className="mt-1 block text-[11px] font-medium text-amber-700">Attiva la riserva</span>}</td>
        </tr>)}</tbody></table>
      </div>
      <p className="text-xs text-zinc-600">Giro veloce: <strong>{preview.fastest_driver_id ? name(preview.fastest_driver_id) : 'Da completare'}</strong></p>
      {preview.warnings.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <p className="flex items-center gap-2 font-bold"><AlertTriangle aria-hidden className="size-4 shrink-0" />Da verificare</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">{preview.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
      </div>}
      <p className="text-xs leading-relaxed text-zinc-600">Sostituisce griglia, arrivo, esito e scuderia dei piloti associati e il giro veloce disponibile. Conserva gli altri bonus e i dati non importati. {event === 'gp' && 'Pilota del giorno e migliore sosta si completano manualmente.'} I risultati pubblicati cambiano solo con “Pubblica risultati”.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={disabled} onClick={() => { onApply(preview); setPreview(null); }} className="min-h-11 flex-1 rounded-xl bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50">Applica alla bozza</button>
        <button type="button" onClick={() => setPreview(null)} className="min-h-11 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-bold">Annulla</button>
      </div>
    </div>}
  </section>;
}
