'use client';

import { useState } from 'react';
import { saveResults } from '@/app/manager/actions';
import { validatePositions } from '@/lib/result-validation';
import { DriverResultFields, type EditableDriverResult } from './driver-result-fields';
import { FormSelect } from './form-select';
import { SubmitButton } from './action-feedback';

type EditorDriver = { id: number; name: string; constructorId: number };
export type EditorResult = EditableDriverResult & { driver_id: number; fastest_lap: boolean; driver_of_the_day?: boolean };

export function ResultsEditor({ raceId, event, leagueId, drivers, constructors, results, pitId }: {
  raceId: number; event: 'gp' | 'sprint'; leagueId?: string; drivers: EditorDriver[];
  constructors: { constructor_id: number; display_name: string }[]; results: EditorResult[]; pitId?: number;
}) {
  const [values, setValues] = useState<Record<number, EditableDriverResult>>(() => Object.fromEntries(drivers.map((driver) => {
    const saved = results.find((result) => result.driver_id === driver.id);
    return [driver.id, saved ?? { constructor_id: driver.constructorId, grid_position: null, finish_position: null, result_status: 'finished', formation_lap: true }];
  })));
  const [fastest, setFastest] = useState(() => String(results.find((row) => row.fastest_lap)?.driver_id ?? ''));
  const [dotd, setDotd] = useState(() => String(results.find((row) => row.driver_of_the_day)?.driver_id ?? ''));
  const [pit, setPit] = useState(() => String(pitId ?? ''));
  const errors = validatePositions(drivers.map((driver) => ({ ...values[driver.id], driver_id: driver.id, name: driver.name })), false);
  const options = drivers.map((driver) => ({ value: driver.id, label: driver.name }));
  return <form action={saveResults} autoComplete="off" className="mt-6 space-y-6">
    <input type="hidden" name="race_id" value={raceId} />
    <input type="hidden" name="league_id" value={leagueId ?? ''} />
    <input type="hidden" name="event" value={event} />
    <div className="grid gap-3 md:grid-cols-3">
      <FormSelect label="Giro veloce" required name="fastest_driver_id" value={fastest} onValueChange={setFastest} options={options} />
      {event === 'gp' && <>
        <FormSelect label="Pilota del giorno" required name="dotd_driver_id" value={dotd} onValueChange={setDotd} options={options} />
        <FormSelect label="Migliore sosta ai box" required name="pit_constructor_id" value={pit} onValueChange={setPit}
          options={constructors.map((row) => ({ value: row.constructor_id, label: row.display_name }))} />
      </>}
    </div>
    <div className="grid items-start gap-5 lg:grid-cols-2">{drivers.map((driver) => <DriverResultFields key={driver.id}
      driverId={driver.id} name={driver.name} constructors={constructors} value={values[driver.id]}
      onChange={(value) => setValues((current) => ({ ...current, [driver.id]: value }))}
      errors={errors.filter((error) => error.driverId === driver.id)} />)}</div>
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-sm backdrop-blur-sm">
      <p role="status" className={`text-xs ${errors.length ? 'text-red-700' : 'text-zinc-500'}`}>{errors.length ? 'Correggi le posizioni evidenziate prima di salvare.' : 'Ogni gara ha posizioni e bonus indipendenti.'}</p>
      <SubmitButton disabled={errors.length > 0} className="min-h-11 w-full rounded-xl bg-red-600 px-5 py-3 font-bold text-white sm:w-auto">Salva risultati {event === 'gp' ? 'GP' : 'Sprint'}</SubmitButton>
    </div>
  </form>;
}
