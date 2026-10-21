'use client';

import { useId } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type SelectOption = { value: string | number; label: string };

export function FormSelect({ name, label, options, defaultValue, placeholder = 'Seleziona', required, disabled, hideLabel, className = '' }: {
  name: string; label: string; options: SelectOption[]; defaultValue?: string | number;
  placeholder?: string; required?: boolean; disabled?: boolean; hideLabel?: boolean; className?: string;
}) {
  const id = useId();
  return <div className={`min-w-0 space-y-1.5 ${className}`}>
    <label htmlFor={id} className={hideLabel ? 'sr-only' : 'block text-sm font-semibold text-zinc-700'}>{label}</label>
    <Select key={String(defaultValue ?? '')} name={name} defaultValue={defaultValue ? String(defaultValue) : undefined}
      required={required} disabled={disabled}>
      <SelectTrigger id={id} className="h-11! w-full min-w-0 rounded-xl bg-white text-left shadow-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="max-h-80 rounded-xl">
        {options.map((option) => <SelectItem key={option.value} value={String(option.value)} className="cursor-pointer rounded-lg py-2.5">{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>;
}
