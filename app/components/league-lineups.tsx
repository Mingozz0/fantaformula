import {Check,Clock,Flag,LockKeyhole,Shield,Users} from 'lucide-react';
import {NavigationLink} from './action-feedback';
import {canRevealLineup,lineupClosed,submissionLabel,type LeagueLineup,type SubmissionStatus} from '@/lib/lineup-visibility';
import {hasSubmittedLineup,scoreEvent,type DriverResult,type ScoringRules} from '@/lib/scoring';
type Race={id:number;name:string;lineup_deadline_at:string|null;gp_published:boolean;sprint_published:boolean;has_sprint:boolean};
export function LeagueLineups({race,leagueId,teams,lineups,statuses,viewerId,now,driverName,constructorName,ownerName,gpResults,sprintResults,pit,rules,filter='all'}:{
  race:Race;leagueId:string;teams:{id:string;name:string;user_id:string;constructor_id:number}[];
  lineups:LeagueLineup[];statuses:SubmissionStatus[];viewerId:string;now:number;
  driverName:(id:number)=>string;constructorName:(id:number)=>string;ownerName:(id:string)=>string;
  gpResults:DriverResult[];sprintResults:DriverResult[];pit:number|null;rules:ScoringRules|null;filter:string;
}) {
  const closed=lineupClosed(race.lineup_deadline_at,now);
  const submitted=(id:string)=>statuses.some((row)=>row.race_id===race.id&&row.fantasy_team_id===id&&row.is_submitted);
  const count=teams.filter((team)=>submitted(team.id)).length;
  const choices=[{id:'all',label:'Tutte',count:teams.length},{id:'submitted',label:'Consegnate',count},{id:'missing',label:closed?'Non consegnate':'Da consegnare',count:teams.length-count}];
  const visible=teams.filter((team)=>filter==='submitted'?submitted(team.id):filter==='missing'?!submitted(team.id):true);
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-black">Formazioni della giornata</h2><p className="mt-2 text-sm text-zinc-500"><strong className="text-zinc-900">{count} di {teams.length}</strong> squadre hanno consegnato</p></div>
      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${closed?'bg-zinc-200 text-zinc-700':'bg-emerald-50 text-emerald-700'}`}>{closed?<LockKeyhole aria-hidden className="size-3.5"/>:<Clock aria-hidden className="size-3.5"/>}{closed?'Scelte aperte alla lega':'Scelte riservate fino alla scadenza'}</span></div>
    <nav aria-label="Filtra le consegne" className="flex flex-wrap gap-2">{choices.map((choice)=><NavigationLink key={choice.id} href={`/home?${new URLSearchParams({league:leagueId,tab:'lineups',race:String(race.id),delivery:choice.id})}`} aria-current={filter===choice.id?'page':undefined} className={`min-h-11 rounded-xl border px-3 py-3 text-xs font-bold ${filter===choice.id?'border-zinc-950 bg-zinc-950 text-white':'border-zinc-200 bg-white text-zinc-600'}`}>{choice.label} · {choice.count}</NavigationLink>)}</nav>
    <div className="grid auto-rows-fr gap-4 lg:grid-cols-2">{visible.map((team)=>{
      const delivered=submitted(team.id);
      const reveal=canRevealLineup(team.user_id,viewerId,race.lineup_deadline_at,now);
      const lineup=lineups.find((row)=>row.fantasy_team_id===team.id&&row.race_id===race.id);
      const usable=hasSubmittedLineup(lineup);
      const events=reveal&&rules?[{label:'GP',published:race.gp_published,sprint:false,rows:gpResults},...(race.has_sprint?[{label:'Sprint',published:race.sprint_published,sprint:true,rows:sprintResults}]:[])].filter((event)=>event.published).map((event)=>({...event,score:scoreEvent(lineup??null,team.constructor_id,event.rows,rules,event.sprint,pit)})):[];
      return <article key={team.id} className="flex h-full min-w-0 flex-col rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-black">{team.name}{team.user_id===viewerId&&<span className="ml-2 text-xs font-medium text-zinc-500">Tu</span>}</h3><p className="mt-1 break-words text-xs text-zinc-500">{ownerName(team.user_id)}</p></div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${delivered?'bg-emerald-50 text-emerald-700':closed?'bg-red-50 text-red-700':'bg-amber-50 text-amber-800'}`}>{delivered&&<Check aria-hidden className="size-3.5"/>}{submissionLabel(delivered,closed)}</span></div>
        {reveal?<><div className="mt-5 grid flex-1 grid-cols-2 gap-3">{[{label:'Titolare 1',id:lineup?.driver_one_id,icon:Users},{label:'Titolare 2',id:lineup?.driver_two_id,icon:Users},{label:'Riserva',id:lineup?.reserve_driver_id,icon:Shield}].map(({label,id,icon:Icon})=><div key={label} className="min-w-0 rounded-xl bg-zinc-50 p-3"><p className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500"><Icon aria-hidden className="size-3.5"/>{label}</p><p className="mt-2 break-words text-sm font-bold">{usable&&id?driverName(id):closed||lineup?.is_empty?'Non schierato':'Da selezionare'}</p></div>)}
          <div className="min-w-0 rounded-xl border border-red-100 bg-red-50/60 p-3"><p className="flex items-center gap-1.5 text-[11px] font-semibold text-red-700"><Flag aria-hidden className="size-3.5"/>Scuderia</p><p className="mt-2 break-words text-sm font-bold">{constructorName(team.constructor_id)}</p>{!usable&&<p className="mt-1 text-xs text-zinc-500">Non schierata</p>}</div></div>
          {events.length>0&&<div className="mt-4 space-y-2 border-t border-zinc-100 pt-4"><div className="flex items-center justify-between gap-3"><span className="text-xs text-zinc-500">{events.map((event)=>`${event.label} ${event.score.total} pt`).join(' · ')}</span><strong className="shrink-0 text-xl tabular-nums">{events.reduce((sum,event)=>sum+event.score.total,0)} <span className="text-xs font-medium text-zinc-500">pt</span></strong></div>
            {events.filter((event)=>event.score.reserveUsed).map((event)=>{const replaced=usable?[lineup.driver_one_id,lineup.driver_two_id].find((id)=>!event.score.driverIds.includes(id)):undefined;return <p key={event.label} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{event.label}: {usable?driverName(lineup.reserve_driver_id):'Riserva'} subentra{replaced?` a ${driverName(replaced)}`:''}.</p>;})}</div>}
        </>:<div className="mt-5 flex min-h-36 flex-1 flex-col items-center justify-center gap-3 rounded-xl bg-zinc-50 p-5 text-center text-sm text-zinc-500"><LockKeyhole aria-hidden className="size-5"/><p>Le scelte si aprono alla scadenza.</p></div>}
      </article>;
    })}</div>
    {!visible.length&&<div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">{teams.length?'Nessuna squadra con questo stato.':'Le squadre devono ancora essere assegnate.'}</div>}
  </div>;
}
