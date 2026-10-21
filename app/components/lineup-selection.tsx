'use client';

import { useState } from 'react';
import { FormSelect, type SelectOption } from './form-select';
import { SubmitButton } from './action-feedback';

export function LineupSelection({ options, initialOne, initialTwo, initialEmpty = false }: {
  options: SelectOption[]; initialOne?: number | null; initialTwo?: number | null; initialEmpty?: boolean;
}) {
  const [empty, setEmpty] = useState(initialEmpty);
  const [one, setOne] = useState(initialOne ? String(initialOne) : '');
  const [two, setTwo] = useState(initialTwo ? String(initialTwo) : '');
  const reserve = one && two ? options.find((option) => ![one, two].includes(String(option.value))) : undefined;
  return <>
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold md:col-span-3">
      <input type="checkbox" name="is_empty" value="true" checked={empty} onChange={(event) => setEmpty(event.target.checked)} className="size-4 accent-red-600" />
      Formazione non consegnata · 0 punti
    </label>
    <FormSelect label="Titolare 1" name="driver_one_id" required={!empty} disabled={empty} value={empty ? '' : one} onValueChange={setOne}
      options={options.map((option) => ({ ...option, disabled: String(option.value) === two }))} />
    <FormSelect label="Titolare 2" name="driver_two_id" required={!empty} disabled={empty} value={empty ? '' : two} onValueChange={setTwo}
      options={options.map((option) => ({ ...option, disabled: String(option.value) === one }))} />
    <div className="flex items-end"><SubmitButton disabled={!empty && (!one || !two || one === two)} className="h-11 w-full rounded-xl bg-red-600 px-4 font-bold text-white">Salva formazione</SubmitButton></div>
    <p aria-live="polite" className="text-xs text-zinc-500 md:col-span-3">{empty ? 'Nessun pilota o scuderia schierati.' : reserve ? `Riserva: ${reserve.label}.` : 'Scegli due piloti diversi: il terzo sarà la riserva.'}</p>
  </>;
}
