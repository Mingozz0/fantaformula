import { FormSelect } from './form-select';

export type EditableDriverResult = { constructor_id: number | null; grid_position: number | null;
  finish_position: number | null; result_status: string; formation_lap: boolean };

export function DriverResultFields({ driverId, name, constructorId, constructors, result }: {
  driverId: number; name: string; constructorId: number;
  constructors: { constructor_id: number; display_name: string }[]; result?: EditableDriverResult;
}) {
  return <fieldset className="min-w-0 space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 sm:p-5">
    <legend className="px-2 text-base font-black">{name}</legend>
    <FormSelect label="Scuderia" name={`constructor_${driverId}`} defaultValue={result?.constructor_id ?? constructorId}
      options={constructors.map((constructor) => ({ value: constructor.constructor_id, label: constructor.display_name }))} />
    <div className="grid grid-cols-2 gap-3">
      <label className="min-w-0 text-sm font-semibold text-zinc-700">Posizione in griglia
        <input type="number" inputMode="numeric" min={1} max={30} name={`grid_${driverId}`} defaultValue={result?.grid_position ?? ''}
          placeholder="Es. 3" className="mt-1.5 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base shadow-xs" />
      </label>
      <label className="min-w-0 text-sm font-semibold text-zinc-700">Posizione all’arrivo
        <input type="number" inputMode="numeric" min={1} max={30} name={`finish_${driverId}`} defaultValue={result?.finish_position ?? ''}
          placeholder="Es. 1" className="mt-1.5 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base shadow-xs" />
      </label>
    </div>
    <FormSelect label="Esito della gara" name={`status_${driverId}`} defaultValue={result?.result_status ?? 'finished'}
      options={[{ value: 'finished', label: 'Arrivato' }, { value: 'dnf', label: 'Ritirato' }, { value: 'dns', label: 'Non partito' }, { value: 'dsq', label: 'Squalificato' }]} />
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700">
      <input type="checkbox" name={`formation_${driverId}`} defaultChecked={result?.formation_lap ?? true} className="size-5 shrink-0 accent-red-600" />
      Ha partecipato al giro di formazione
    </label>
    <p className="text-xs leading-relaxed text-zinc-500">Per ritirati, non partiti e squalificati lascia vuota la posizione all’arrivo.</p>
  </fieldset>;
}
