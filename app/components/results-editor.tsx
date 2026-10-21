'use client';

import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveResultDraft, publishResultDraft } from '@/app/manager/draft-actions';
import { validatePositions } from '@/lib/result-validation';
import { isDraftPayload, type DraftPayload, type DraftReply, type ResultDraft } from '@/lib/result-draft';
import { DriverResultFields, type EditableDriverResult } from './driver-result-fields';
import { FormSelect } from './form-select';
import { ResultImportPanel } from './result-import-panel';
import { mergeResultImport, type ResultImport } from '@/lib/result-import';
import { toast } from 'sonner';

type EditorDriver = { id: number; name: string; constructorId: number };
export type EditorResult = EditableDriverResult & { driver_id: number; fastest_lap: boolean; driver_of_the_day?: boolean };

export function ResultsEditor({ raceId, event, userId, drivers, constructors, results, pitId, draft, published = false }: {
  raceId: number; event: 'gp' | 'sprint'; userId: string; drivers: EditorDriver[];
  constructors: { constructor_id: number; display_name: string }[]; results: EditorResult[]; pitId?: number; draft?: ResultDraft; published?: boolean;
}) {
  const router = useRouter();
  const [payload, setPayload] = useState<DraftPayload>(() => ({ drivers: drivers.map((driver) => {
    const saved = draft?.payload.drivers.find((result) => result.driver_id === driver.id) ?? results.find((result) => result.driver_id === driver.id);
    return { driver_id: driver.id, constructor_id: saved?.constructor_id ?? driver.constructorId, grid_position: saved?.grid_position ?? null,
      finish_position: saved?.finish_position ?? null, result_status: saved?.result_status ?? 'finished', formation_lap: saved?.formation_lap ?? true };
  }), fastest_driver_id: draft ? draft.payload.fastest_driver_id : results.find((row) => row.fastest_lap)?.driver_id ?? null,
    dotd_driver_id: draft ? draft.payload.dotd_driver_id : results.find((row) => row.driver_of_the_day)?.driver_id ?? null,
    pit_constructor_id: draft ? draft.payload.pit_constructor_id : pitId ?? null, ...(draft?.payload.imported ? { imported: draft.payload.imported } : {}) }));
  const storageKey = `gridf1-draft:${userId}:${raceId}:${event}`;
  const version = useRef(draft?.version ?? 0);
  const [savedVersion, setSavedVersion] = useState(draft?.version ?? 0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [savedSignature, setSavedSignature] = useState(() => JSON.stringify(payload));
  const signature = JSON.stringify(payload);
  const dirty = signature !== savedSignature;
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savedAt, setSavedAt] = useState(draft?.updated_at ?? '');
  const [publishedVersion, setPublishedVersion] = useState(draft?.published_version ?? 0);
  const [publicationAttempt, setPublicationAttempt] = useState(false);
  const [isPublished, setIsPublished] = useState(published);
  const current = useRef(payload);
  const initialVersion = draft?.version ?? 0;

  function update(next: DraftPayload) {
    current.current = next; setPayload(next);
    try { sessionStorage.setItem(storageKey, JSON.stringify({ version: version.current, payload: next })); } catch { /* Server save remains available. */ }
  }
  useEffect(() => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
      if (cached && cached.version === initialVersion && isDraftPayload(cached.payload)
        && cached.payload.drivers.length === drivers.length && drivers.every((driver) => cached.payload.drivers.some((row: DraftPayload['drivers'][number]) => row.driver_id === driver.id))) {
        current.current = cached.payload;
        startTransition(() => { setPayload(cached.payload); });
        toast.info('Bozza locale recuperata.', { id: storageKey });
      }
    } catch { /* An unavailable local cache never blocks the editor. */ }
  }, [storageKey, initialVersion, drivers]);

  const save = useCallback((snapshot: DraftPayload, successMessage?: string): Promise<DraftReply> => {
    const request = queue.current.then(async () => {
      setSaving(true);
      let reply: DraftReply;
      try { reply = await saveResultDraft(raceId, event, snapshot, version.current); }
      catch { reply = { ok: false, error: 'Connessione interrotta. La bozza locale è conservata: riprova.' }; }
      if (reply.ok) {
        version.current = reply.version; setSavedVersion(reply.version); setSavedSignature(JSON.stringify(snapshot)); setSavedAt(reply.savedAt ?? '');
        setPublishedVersion(reply.publishedVersion ?? 0);
        toast.dismiss(`save-error:${storageKey}`);
        if (successMessage) toast.success(successMessage);
        try {
          if (JSON.stringify(current.current) === JSON.stringify(snapshot)) sessionStorage.removeItem(storageKey);
          else sessionStorage.setItem(storageKey, JSON.stringify({ version: reply.version, payload: current.current }));
        } catch { /* The database already holds this snapshot. */ }
      } else toast.error(reply.error, { id: `save-error:${storageKey}` });
      setSaving(false); return reply;
    });
    queue.current = request; return request;
  }, [raceId, event, storageKey]);

  useEffect(() => {
    if (!dirty || publishing) return;
    const timer = setTimeout(() => { void save(payload); }, 1200);
    return () => clearTimeout(timer);
  }, [payload, dirty, publishing, save]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const rows = drivers.map((driver) => ({ ...payload.drivers.find((row) => row.driver_id === driver.id)!, name: driver.name }));
  const errors = validatePositions(rows, publicationAttempt);
  async function publish() {
    setPublicationAttempt(true);
    const incomplete = validatePositions(rows);
    if (incomplete.length || !payload.fastest_driver_id || event === 'gp' && (!payload.dotd_driver_id || !payload.pit_constructor_id)) {
      toast.error(incomplete[0]?.message ?? 'Seleziona i bonus della gara prima di pubblicare.'); return;
    }
    setPublishing(true);
    try {
      const saved = dirty || version.current === 0 ? await save(payload) : { ok: true, version: version.current };
      if (!saved.ok) return;
      const reply = await publishResultDraft(raceId, event, version.current);
      if (!reply.ok) { toast.error(reply.error); return; }
      setPublishedVersion(reply.publishedVersion ?? reply.version); setIsPublished(true); toast.success('Risultati pubblicati.'); router.refresh();
    } catch { toast.error('Pubblicazione non riuscita. La bozza è conservata: riprova.'); }
    finally { setPublishing(false); }
  }
  const options = drivers.map((driver) => ({ value: driver.id, label: driver.name }));
  const alreadyPublished = isPublished && !dirty && (savedVersion === 0 || publishedVersion === savedVersion);
  const missingImportFields = [!payload.fastest_driver_id && 'giro veloce',
    event === 'gp' && !payload.dotd_driver_id && 'pilota del giorno', event === 'gp' && !payload.pit_constructor_id && 'migliore sosta ai box',
    ...drivers.filter((driver) => payload.drivers.some((row) => row.driver_id === driver.id && row.grid_position === null && row.result_status !== 'dns')).map((driver) => `griglia di ${driver.name}`),
  ].filter(Boolean);
  function applyImport(imported: ResultImport) {
    const next = mergeResultImport(current.current, imported);
    update(next); setPublicationAttempt(false);
    void save(next, 'Risultati importati e salvati nella bozza.');
  }
  return <form onSubmit={(event) => { event.preventDefault(); void save(payload, 'Bozza salvata.'); }} noValidate autoComplete="off" className="mt-6 space-y-6">
    <ResultImportPanel raceId={raceId} event={event} drivers={drivers} disabled={saving || publishing} onApply={applyImport} />
    {payload.imported && <p className="text-xs text-zinc-500">Importato da <a href={payload.imported.url} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">Jolpica-F1</a> · {new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }).format(new Date(payload.imported.imported_at))}
      {missingImportFields.length > 0 && <span className="mt-1 block font-semibold text-amber-700">Da verificare: {missingImportFields.join(', ')}.</span>}</p>}
    <fieldset disabled={publishing} className="space-y-6">
    <div className="grid gap-3 md:grid-cols-3">
      <FormSelect label="Giro veloce" name="fastest_driver_id" value={String(payload.fastest_driver_id ?? '')} onValueChange={(value) => update({ ...payload, fastest_driver_id: Number(value) })} options={options} />
      {event === 'gp' && <>
        <FormSelect label="Pilota del giorno" name="dotd_driver_id" value={String(payload.dotd_driver_id ?? '')} onValueChange={(value) => update({ ...payload, dotd_driver_id: Number(value) })} options={options} />
        <FormSelect label="Migliore sosta ai box" name="pit_constructor_id" value={String(payload.pit_constructor_id ?? '')} onValueChange={(value) => update({ ...payload, pit_constructor_id: Number(value) })}
          options={constructors.map((row) => ({ value: row.constructor_id, label: row.display_name }))} />
      </>}
    </div>
    <div className="grid items-start gap-5 lg:grid-cols-2">{drivers.map((driver) => <DriverResultFields key={driver.id}
      driverId={driver.id} name={driver.name} constructors={constructors} value={payload.drivers.find((row) => row.driver_id === driver.id)!}
      onChange={(value) => update({ ...payload, drivers: payload.drivers.map((row) => row.driver_id === driver.id ? { ...value, driver_id: driver.id } : row) })}
      errors={errors.filter((error) => error.driverId === driver.id)} />)}</div>
    </fieldset>
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-sm backdrop-blur-sm">
      <p role="status" className="w-full text-xs text-zinc-500">{saving ? 'Salvataggio bozza…' : dirty ? 'Modifiche da salvare' : savedAt ? `Bozza salvata · ${new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }).format(new Date(savedAt))}` : 'Nessuna bozza salvata'}</p>
      <button type="submit" disabled={saving || publishing || (!dirty && savedVersion > 0)} className="min-h-11 flex-1 rounded-xl border border-zinc-300 px-4 text-sm font-bold disabled:opacity-50">Salva bozza</button>
      <button type="button" onClick={() => void publish()} disabled={saving || publishing || alreadyPublished} className="min-h-11 flex-1 rounded-xl bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50">{publishing ? 'Pubblicazione…' : alreadyPublished ? 'Pubblicati' : 'Pubblica risultati'}</button>
    </div>
  </form>;
}
