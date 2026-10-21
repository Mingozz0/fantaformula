'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function RacePicker({ races, value, leagueId }: {
  races: { id: number; round: number; name: string }[]; value: number; leagueId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <div className="w-full space-y-2 sm:max-w-sm">
    <label htmlFor="results-race" className="text-sm font-semibold text-zinc-700">Scegli il Gran Premio</label>
    <Select value={String(value)} onValueChange={(race) => startTransition(() =>
      router.push(`/home?${new URLSearchParams({ league: leagueId, tab: 'results', race })}`, { scroll: false }))}>
      <SelectTrigger id="results-race" disabled={pending} className="h-12! w-full rounded-xl bg-white font-semibold">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-96 rounded-xl">
        {races.map((race) => <SelectItem value={String(race.id)} key={race.id} className="cursor-pointer py-2.5">{race.round}. {race.name}</SelectItem>)}
      </SelectContent>
    </Select>
    {pending && <p role="status" className="text-xs text-zinc-500">Caricamento risultati…</p>}
  </div>;
}
