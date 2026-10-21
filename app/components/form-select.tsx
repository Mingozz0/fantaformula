'use client';

import { useId } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type SelectOption = { value: string | number; label: string; disabled?: boolean };

export function FormSelect({ name, label, options, defaultValue, value, onValueChange, placeholder = 'Seleziona', required, disabled, hideLabel, className = '' }: {
  name: string; label: string; options: SelectOption[]; defaultValue?: string | number;
  placeholder?: string; required?: boolean; disabled?: boolean; hideLabel?: boolean; className?: string;
  value?: string; onValueChange?: (value: string) => void;
}) {
  const id = useId();
  return <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
    <label htmlFor={id} className={hideLabel ? 'sr-only' : 'block text-sm font-semibold text-zinc-700'}>{label}</label>
    <Select key={String(defaultValue ?? '')} name={name} defaultValue={defaultValue ? String(defaultValue) : undefined}
      value={value} onValueChange={onValueChange} required={required} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="max-h-80">
        {options.map((option) => <SelectItem key={option.value} value={String(option.value)} disabled={option.disabled}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>;
}
