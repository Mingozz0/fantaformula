'use client';

import { useState } from 'react';
import { FormSelect, type SelectOption } from './form-select';
import { SubmitButton } from './action-feedback';

export function LineupSelection({ options, initialOne, initialTwo }: {
  options: SelectOption[]; initialOne?: number; initialTwo?: number;
}) {
  const [one, setOne] = useState(initialOne ? String(initialOne) : '');
  const [two, setTwo] = useState(initialTwo ? String(initialTwo) : '');
  const reserve = one && two ? options.find((option) => ![one, two].includes(String(option.value))) : undefined;
  return <>
    <FormSelect label="Titolare 1" name="driver_one_id" required value={one} onValueChange={setOne}
      options={options.map((option) => ({ ...option, disabled: String(option.value) === two }))} />
    <FormSelect label="Titolare 2" name="driver_two_id" required value={two} onValueChange={setTwo}
      options={options.map((option) => ({ ...option, disabled: String(option.value) === one }))} />
    <div className="flex items-end"><SubmitButton disabled={!one || !two || one === two} className="h-11 w-full rounded-xl bg-red-600 px-4 font-bold text-white">Salva formazione</SubmitButton></div>
    <p aria-live="polite" className="text-xs text-zinc-500 md:col-span-3">{reserve ? `Riserva: ${reserve.label}.` : 'Scegli due piloti diversi: il terzo sarà la riserva.'}</p>
  </>;
}
