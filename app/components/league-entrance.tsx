import type { ReactNode } from 'react';
import { ArrowRight, Flag } from 'lucide-react';
import { NavigationLink } from './action-feedback';
import { leagueStatusLabel } from '@/lib/labels';

export function LeagueEntrance({ leagues, children }: {
  leagues: { id: string; name: string; status: string; role: string }[]; children: ReactNode;
}) {
  return <>
    <div><p className="text-xs font-bold uppercase tracking-widest text-red-600">Il tuo portale</p>
      <h1 className="mt-2 text-3xl font-black sm:text-4xl">Le mie leghe</h1>
      <p className="mt-2 text-sm text-zinc-500">Scegli la lega in cui entrare oppure inizia una nuova sfida.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{leagues.map((league) => <NavigationLink key={league.id}
      href={`/home?${new URLSearchParams({ league: league.id, tab: 'overview' })}`}
      className="group block rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs transition hover:border-red-300 hover:shadow-sm [&>span]:flex [&>span]:h-full [&>span]:w-full [&>span]:flex-col [&>span]:items-stretch [&>span]:gap-0">
      <span className="mb-5 grid size-10 place-items-center rounded-xl bg-red-50 text-red-600"><Flag className="size-5" /></span>
      <h2 className="break-words text-xl font-black">{league.name}</h2>
      <p className="mt-2 text-xs text-zinc-500">Stagione 2026 · {leagueStatusLabel(league.status)} · {league.role === 'admin' ? 'Amministratore' : 'Partecipante'}</p>
      <span className="mt-6 flex items-center justify-between text-sm font-bold text-red-600">Entra nella lega<ArrowRight className="size-4" /></span>
    </NavigationLink>)}</div>
    {!leagues.length && <p className="rounded-xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-500">Non fai ancora parte di una lega. Creane una o inserisci un codice invito.</p>}
    <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6"><h2 className="text-lg font-black sm:text-xl">Una nuova sfida</h2>{children}</div>
  </>;
}
