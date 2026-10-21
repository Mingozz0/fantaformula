import { FormSelect } from './form-select';
import type { PositionError } from '@/lib/result-validation';

export type EditableDriverResult = { constructor_id: number | null; grid_position: number | null;
  finish_position: number | null; result_status: string; formation_lap: boolean };

export function DriverResultFields({ driverId, name, constructors, value, onChange, errors }: {
  driverId: number; name: string;
  constructors: { constructor_id: number; display_name: string }[]; value: EditableDriverResult;
  onChange: (value: EditableDriverResult) => void; errors: PositionError[];
}) {
  const gridError = errors.find((error) => error.field === 'grid');
  const finishError = errors.find((error) => error.field === 'finish');
  return <fieldset className="min-w-0 space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 sm:p-5">
    <legend className="px-2 text-base font-black">{name}</legend>
    <FormSelect label="Scuderia" name={`constructor_${driverId}`} value={String(value.constructor_id ?? '')}
      onValueChange={(constructor) => onChange({ ...value, constructor_id: Number(constructor) })}
      options={constructors.map((constructor) => ({ value: constructor.constructor_id, label: constructor.display_name }))} />
    <div className="grid grid-cols-2 gap-3">
      <label className="min-w-0 text-sm font-semibold text-zinc-700">Posizione in griglia
        <input type="number" inputMode="numeric" min={1} max={30} step={1} name={`grid_${driverId}`} value={value.grid_position ?? ''}
          onChange={(event) => onChange({ ...value, grid_position: event.target.value === '' ? null : Number(event.target.value) })}
          aria-invalid={Boolean(gridError)} aria-describedby={gridError ? `grid-error-${driverId}` : undefined}
          placeholder="Es. 3" className="mt-1.5 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base shadow-xs aria-invalid:border-red-500" />
        {gridError && <span id={`grid-error-${driverId}`} className="mt-1 block text-xs font-normal text-red-700">{gridError.message}</span>}
      </label>
      <label className="min-w-0 text-sm font-semibold text-zinc-700">Posizione all’arrivo
        <input type="number" inputMode="numeric" min={1} max={30} step={1} name={`finish_${driverId}`} value={value.finish_position ?? ''}
          required={value.result_status === 'finished'} disabled={value.result_status !== 'finished'}
          onChange={(event) => onChange({ ...value, finish_position: event.target.value === '' ? null : Number(event.target.value) })}
          aria-invalid={Boolean(finishError)} aria-describedby={finishError ? `finish-error-${driverId}` : undefined}
          placeholder={value.result_status === 'finished' ? 'Es. 1' : 'Non previsto'} className="mt-1.5 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base shadow-xs disabled:bg-zinc-100 aria-invalid:border-red-500" />
        {finishError && <span id={`finish-error-${driverId}`} className="mt-1 block text-xs font-normal text-red-700">{finishError.message}</span>}
      </label>
    </div>
    <FormSelect label="Esito della gara" name={`status_${driverId}`} value={value.result_status}
      onValueChange={(status) => onChange({ ...value, result_status: status, finish_position: status === 'finished' ? value.finish_position : null,
        formation_lap: status === 'dns' ? false : value.result_status === 'dns' ? true : value.formation_lap })}
      options={[{ value: 'finished', label: 'Arrivato' }, { value: 'dnf', label: 'Ritirato' }, { value: 'dns', label: 'Non partito' }, { value: 'dsq', label: 'Squalificato' }]} />
    {value.result_status === 'dns' ? <p className="flex min-h-11 items-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">Non partito (DNS): subentra la riserva</p> : <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700">
      <input type="checkbox" name={`formation_${driverId}`} checked={value.formation_lap}
        onChange={(event) => onChange({ ...value, formation_lap: event.target.checked })} className="size-5 shrink-0 accent-red-600" />
      Ha partecipato al giro di formazione
    </label>}
  </fieldset>;
}
