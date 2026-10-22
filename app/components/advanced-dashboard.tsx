import type {ReactNode} from 'react';
import {ArrowUpRight,Flame,ShieldCheck,Sparkles} from 'lucide-react';
import {buildAdvancedStats} from '@/lib/advanced-stats';
import type {TeamStats} from '@/lib/league-stats';
import {InteractivePointsChart} from './interactive-points-chart';
import {RoundComparison} from './round-comparison';
import {NavigationLink} from './action-feedback';
type Advanced=ReturnType<typeof buildAdvancedStats>;
const number=(value:number)=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:1}).format(value);
function Panel({title,detail,children}:{title:string;detail?:string;children:ReactNode}) {
  return <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6"><h2 className="text-lg font-black">{title}</h2>{detail&&<p className="mt-1 text-xs text-zinc-500">{detail}</p>}<div className="mt-5">{children}</div></section>;
}
function Bars({rows}:{rows:{id:string;name:string;value:number;detail?:string}[]}) {
  const max=Math.max(1,...rows.map((row)=>Math.abs(row.value)));
  return <div className="space-y-4">{rows.map((row)=><div key={row.id}><div className="mb-2 flex items-start justify-between gap-3 text-sm"><div className="min-w-0"><p className="break-words font-semibold">{row.name}</p>{row.detail&&<p className="mt-1 text-xs text-zinc-500">{row.detail}</p>}</div><strong className="shrink-0 tabular-nums">{number(row.value)} pt</strong></div><div className="h-2 overflow-hidden rounded-full bg-zinc-100"><div className={`h-full rounded-full ${row.value<0?'bg-amber-500':'bg-red-600'}`} style={{width:`${Math.abs(row.value)/max*100}%`}}/></div></div>)}{!rows.length&&<p className="text-sm text-zinc-500">Nessun dato disponibile.</p>}</div>;
}
export function AdvancedDashboard({data,entries,drivers,constructors,leagueId,initialTeamId,initialRaceId}:{
  data:Advanced;entries:TeamStats[];drivers:{id:number;first_name:string;last_name:string}[];
  constructors:{constructor_id:number;display_name:string}[];leagueId:string;initialTeamId?:string;initialRaceId?:number;
}) {
  const form=data.teams.toSorted((a,b)=>b.recentPoints-a.recentPoints);
  const reserves=data.teams.toSorted((a,b)=>b.reservePoints-a.reservePoints);
  const activeReserves=reserves.filter((team)=>team.reserves>0);
  const bestChoices=data.teams.toSorted((a,b)=>(b.eligible?b.perfect/b.eligible:-1)-(a.eligible?a.perfect/a.eligible:-1));
  const streaks=data.teams.toSorted((a,b)=>b.winStreak-a.winStreak||b.podiumStreak-a.podiumStreak);
  const driverName=(id:number)=>{const driver=drivers.find((row)=>row.id===id);return driver?`${driver.first_name} ${driver.last_name}`:`Pilota ${id}`;};
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-black">Dentro la stagione</h2><p className="mt-2 text-sm text-zinc-500">{data.completeCount} tappe complete · {data.teams.length} squadre</p></div><NavigationLink href={`/home?${new URLSearchParams({league:leagueId,tab:'standings'})}`} className="min-h-11 py-3 text-sm font-bold text-red-600">Classifica<ArrowUpRight aria-hidden className="size-3.5"/></NavigationLink></div>
    <div className="grid gap-3 sm:grid-cols-3">{[
      {label:'Forma del momento',name:data.recentCount?form.filter((team)=>team.recentPoints===form[0]?.recentPoints).map((team)=>team.name).join(' · '):'—',value:data.recentCount&&form[0]?`${number(form[0].recentPoints)} pt`:'—',detail:`Ultime ${data.recentCount} tappe complete`,icon:Flame},
      {label:'Panchina decisiva',name:activeReserves.length?activeReserves.filter((team)=>team.reservePoints===activeReserves[0]?.reservePoints).map((team)=>team.name).join(' · '):'—',value:activeReserves.length?`${number(activeReserves[0].reservePoints)} pt`:'—',detail:'Punti delle riserve subentrate',icon:ShieldCheck},
      {label:'Scelte perfette',name:bestChoices[0]?.eligible?bestChoices[0].name:'—',value:bestChoices[0]?.eligible?`${bestChoices[0].perfect}/${bestChoices[0].eligible}`:'—',detail:'Migliore formazione della propria rosa',icon:Sparkles},
    ].map(({label,name,value,detail,icon:Icon})=><div key={label} className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5"><p className="flex items-center gap-2 text-xs font-semibold text-zinc-500"><Icon aria-hidden className="size-4 text-red-600"/>{label}</p><p className="mt-4 text-3xl font-black tabular-nums">{value}</p><p className="mt-2 break-words text-sm font-bold">{name}</p><p className="mt-1 text-xs text-zinc-500">{detail}</p></div>)}</div>
    <Panel title="Andamento della stagione"><InteractivePointsChart entries={entries}/></Panel>
    <RoundComparison rounds={data.rounds} drivers={drivers} constructors={constructors} leagueId={leagueId} initialTeamId={initialTeamId} initialRaceId={initialRaceId}/>
    <div className="grid gap-5 lg:grid-cols-2"><Panel title="Forma recente" detail={`Punti nelle ultime ${data.recentCount} tappe complete`}><Bars rows={form.map((team)=>({id:team.id,name:team.name,value:team.recentPoints,detail:team.recent.map((row)=>`${row.name} ${number(row.total)}`).join(' · ')}))}/></Panel>
      <Panel title="Panchina decisiva" detail="Punti ottenuti quando è entrata la riserva"><Bars rows={reserves.map((team)=>({id:team.id,name:team.name,value:team.reservePoints,detail:`${team.reserves} ingressi tra GP e Sprint`}))}/></Panel></div>
    <Panel title="Scelte di formazione" detail="Una sola formazione per tutto il weekend, GP e Sprint insieme">
      <div className="grid gap-4 sm:grid-cols-2">{bestChoices.map((team)=><div key={team.id} className="min-w-0 rounded-xl border border-zinc-200 p-4"><NavigationLink href={`/home?${new URLSearchParams({league:leagueId,tab:'team',team:team.id})}`} className="break-words text-sm font-bold hover:text-red-600">{team.name}</NavigationLink><div className="mt-4 flex items-end justify-between gap-3"><div><p className="text-xs text-zinc-500">Scelte perfette</p><p className="mt-1 text-2xl font-black tabular-nums">{team.perfect}<span className="text-sm font-medium text-zinc-400"> / {team.eligible}</span></p></div><div className="text-right"><p className="text-xs text-zinc-500">Punti lasciati in panchina</p><p className="mt-1 text-lg font-bold tabular-nums">{number(team.missed)} pt</p></div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-label={`Formazioni perfette di ${team.name}`} aria-valuenow={team.eligible?Math.round(team.perfect/team.eligible*100):0} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-emerald-600" style={{width:`${team.eligible?team.perfect/team.eligible*100:0}%`}}/></div></div>)}</div>
      {!data.completeCount&&<p className="mt-4 text-sm text-zinc-500">Le scelte si valutano al termine del weekend.</p>}
    </Panel>
    <Panel title="Serie positive" detail="Serie attuali e record nelle tappe complete"><div className="grid gap-4 sm:grid-cols-2">{streaks.map((team)=><div key={team.id} className="min-w-0 rounded-xl bg-zinc-50 p-4"><h3 className="break-words text-sm font-bold">{team.name}</h3><dl className="mt-4 grid grid-cols-3 gap-2">{[['Vittorie in fila',team.winStreak],['Podi in fila',team.podiumStreak],['Podi totali',team.podiums]].map(([label,value])=><div key={label}><dt className="text-[11px] text-zinc-500">{label}</dt><dd className="mt-1 text-2xl font-black tabular-nums">{value}</dd></div>)}</dl><p className="mt-3 border-t border-zinc-200 pt-3 text-xs text-zinc-500">Record: <b className="text-zinc-800">{team.bestWinStreak}</b> vittorie · <b className="text-zinc-800">{team.bestPodiumStreak}</b> podi consecutivi</p></div>)}</div></Panel>
    <div className="grid gap-5 lg:grid-cols-2"><Panel title="Contributo dei piloti" detail="Punti sommati nelle formazioni schierate nella lega"><Bars rows={data.drivers.map((driver)=>({id:String(driver.id),name:driverName(driver.id),value:driver.points}))}/></Panel>
      <Panel title="Presenze e costanza" detail="Intervallo dei punteggi nelle tappe complete"><div className="divide-y divide-zinc-100">{data.teams.map((team)=><div key={team.id} className="py-4 first:pt-0"><h3 className="break-words text-sm font-bold">{team.name}</h3><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500"><span>Da <b className="text-zinc-800">{team.min===null?'—':number(team.min)}</b> a <b className="text-zinc-800">{team.max===null?'—':number(team.max)}</b> pt</span><span>Formazioni mancanti <b className="text-zinc-800">{team.missing}</b></span></div></div>)}</div></Panel></div>
  </div>;
}
