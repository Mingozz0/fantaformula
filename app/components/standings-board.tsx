import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { NavigationLink } from './action-feedback';
import { standingsDetails } from '@/lib/standings';
import type { TeamStats } from '@/lib/league-stats';
const number=(value:number)=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:1}).format(value);
export function StandingsBoard({entries,leagueId,ownerName}:{entries:TeamStats[];leagueId:string;ownerName:(id:string)=>string}) {
  const latest=entries[0]?.races.at(-1);
  return <div className="space-y-4">
    {latest&&<p className="text-xs text-zinc-500">Aggiornata a {latest.race.name}{!latest.complete?' · Tappa in corso':''}</p>}
    <div className="space-y-3">{standingsDetails(entries).map((entry)=>{
      const Delta=entry.rankDelta===null||entry.rankDelta===0?Minus:entry.rankDelta>0?ArrowUp:ArrowDown;
      const movement=entry.rankDelta===null?'Prima tappa':entry.rankDelta===0?'Posizione invariata':`${Math.abs(entry.rankDelta)} ${Math.abs(entry.rankDelta)===1?`posizione ${entry.rankDelta>0?'guadagnata':'persa'}`:`posizioni ${entry.rankDelta>0?'guadagnate':'perse'}`}`;
      return <article key={entry.team.id} className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
        <div className="flex items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-zinc-100 text-lg font-black">{entry.rank}º</span>
          <NavigationLink href={`/home?${new URLSearchParams({league:leagueId,tab:'team',team:entry.team.id})}`} className="min-w-0 flex-1 break-words hover:text-red-600 [&>span]:flex [&>span]:flex-col [&>span]:items-start [&>span]:gap-1"><strong className="text-sm sm:text-base">{entry.team.name}</strong><span className="text-xs font-normal text-zinc-500">{ownerName(entry.team.user_id)}</span></NavigationLink>
          <strong className="shrink-0 text-xl font-black tabular-nums sm:text-2xl">{number(entry.points)} <span className="text-xs font-medium text-zinc-500">pt</span></strong></div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-zinc-100 pt-3 text-xs">
          <span title={movement} aria-label={movement} className={`inline-flex items-center gap-1 font-bold ${entry.rankDelta&&entry.rankDelta>0?'text-emerald-700':entry.rankDelta&&entry.rankDelta<0?'text-red-600':'text-zinc-500'}`}><Delta aria-hidden className="size-3.5" />{entry.rankDelta===null?'—':entry.rankDelta===0?'Invariata':Math.abs(entry.rankDelta)}</span>
          <span className="text-zinc-500">Ultima tappa <b className="text-zinc-900">{entry.lastPoints===null?'—':`${number(entry.lastPoints)} pt`}</b></span>
          <span className="text-zinc-500">{entry.rank===1?<b className="text-zinc-900">In testa</b>:<>Dalla vetta <b className="text-zinc-900">{number(entry.gapToLeader)} pt</b></>}</span>
          {entry.rank>1&&<span className="text-zinc-500">Da chi precede <b className="text-zinc-900">{number(entry.gapToNext)} pt</b></span>}
        </div>
      </article>;
    })}</div>
    {!entries.length&&<p className="py-6 text-center text-sm text-zinc-500">Le squadre non sono ancora state assegnate.</p>}
  </div>;
}
