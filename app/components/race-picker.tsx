'use client';

import { useId, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function RacePicker({ races, value, href }: {
  races: { id: number; round: number; name: string }[]; value: number; href: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const id = useId();
  return <div className="w-full space-y-2 sm:max-w-sm">
    <label htmlFor={id} className="text-sm font-semibold text-zinc-700">Scegli il Gran Premio</label>
    <Select value={String(value)} onValueChange={(race) => startTransition(() => {
      const [pathname, query] = href.split('?');
      const params = new URLSearchParams(query);
      params.set('race', race);
      router.push(`${pathname}?${params}`, { scroll: false });
    })}>
      <SelectTrigger id={id} disabled={pending} className="h-12! w-full rounded-xl bg-white font-semibold">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-96 rounded-xl">
        {races.map((race) => <SelectItem value={String(race.id)} key={race.id} className="cursor-pointer py-2.5">{race.round}. {race.name}</SelectItem>)}
      </SelectContent>
    </Select>
    {pending && <p role="status" className="text-xs text-zinc-500">Caricamento Gran Premio…</p>}
  </div>;
}
