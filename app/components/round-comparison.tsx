'use client';
import {useState} from 'react';
import {ArrowRightLeft} from 'lucide-react';
import type {AdvancedRound,RoundTeam} from '@/lib/advanced-stats';
import {FormSelect} from './form-select';
import {NavigationLink} from './action-feedback';
const number=(value:number)=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:1}).format(value);
export function RoundComparison({rounds,drivers,constructors,leagueId,initialTeamId,initialRaceId}:{
  rounds:AdvancedRound[];drivers:{id:number;first_name:string;last_name:string}[];
  constructors:{constructor_id:number;display_name:string}[];leagueId:string;initialTeamId?:string;initialRaceId?:number;
}) {
  const initial=rounds.find((round)=>round.race.id===initialRaceId)??rounds.at(-1);
  const firstTeam=initial?.teams.find((team)=>team.id===initialTeamId)?.id??initial?.teams[0]?.id??'';
  const [raceId,setRaceId]=useState(String(initial?.race.id??''));
  const [leftId,setLeftId]=useState(firstTeam);
  const [rightId,setRightId]=useState(initial?.teams.find((team)=>team.id!==firstTeam)?.id??'');
  const round=rounds.find((round)=>String(round.race.id)===raceId);
  const left=round?.teams.find((team)=>team.id===leftId),right=round?.teams.find((team)=>team.id===rightId);
  const driverName=(id:number)=>{const driver=drivers.find((driver)=>driver.id===id);return driver?`${driver.first_name} ${driver.last_name}`:`Pilota ${id}`;};
  const constructorName=(id:number)=>constructors.find((row)=>row.constructor_id===id)?.display_name??'Scuderia';
  const difference=left&&right?left.total-right.total:0;
  const options=round?.teams.map((team)=>({value:team.id,label:team.name}))??[];
  return <section aria-label="Testa a testa della giornata" className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-black"><ArrowRightLeft aria-hidden className="size-4 text-red-600"/>Testa a testa della giornata</h2>{round&&!round.complete&&<span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">Provvisorio</span>}</div>
    {!rounds.length?<p className="py-5 text-sm text-zinc-500">Il confronto si apre con i primi risultati pubblicati.</p>:<>
      <div className="grid gap-3 sm:grid-cols-3"><FormSelect label="Gran Premio" name="comparison-race" value={raceId} onValueChange={setRaceId} options={rounds.toReversed().map(({race})=>({value:race.id,label:`${race.round}. ${race.name}`}))}/>
        <FormSelect label="Prima squadra" name="comparison-left" value={leftId} onValueChange={setLeftId} options={options.map((option)=>({...option,disabled:option.value===rightId}))}/>
        <FormSelect label="Seconda squadra" name="comparison-right" value={rightId} onValueChange={setRightId} options={options.map((option)=>({...option,disabled:option.value===leftId}))}/></div>
      {left&&right&&round?<>
        <div className="grid grid-cols-2 gap-3">{[left,right].map((team)=><div key={team.id} className="min-w-0 rounded-xl bg-zinc-50 p-3 sm:p-4"><h3 className="break-words text-sm font-bold">{team.name}</h3><p className="mt-3 text-3xl font-black tabular-nums">{number(team.total)} <span className="text-xs font-medium text-zinc-500">pt</span></p><p className={`mt-2 text-xs ${team.hasLineup?'text-zinc-500':'font-semibold text-red-700'}`}>{team.hasLineup?`GP ${team.gp===null?'—':number(team.gp)}${round.race.has_sprint?` · Sprint ${team.sprint===null?'—':number(team.sprint)}`:''}`:'Formazione non consegnata'}</p></div>)}</div>
        <p aria-live="polite" className="rounded-xl bg-zinc-950 px-4 py-3 text-center text-sm font-bold text-white">{difference===0?'Parità':`${difference>0?left.name:right.name} avanti di ${number(Math.abs(difference))} punti`}</p>
        <div className="grid grid-cols-[minmax(0,1fr)_4rem_4rem] gap-2 border-b border-zinc-200 pb-2 text-xs font-bold sm:grid-cols-[minmax(0,1fr)_6rem_6rem]"><span className="text-zinc-500">Contributo</span><span className="break-words text-right">{left.name}</span><span className="break-words text-right">{right.name}</span></div>
        <dl className="divide-y divide-zinc-100">{[
          {label:'Piloti · GP',a:left.gp===null?null:left.gpDrivers,b:right.gp===null?null:right.gpDrivers},
          {label:'Scuderia · GP',a:left.gp===null?null:left.gpConstructor,b:right.gp===null?null:right.gpConstructor},
          ...(round.race.has_sprint?[{label:'Piloti · Sprint',a:left.sprint===null?null:left.sprintDrivers,b:right.sprint===null?null:right.sprintDrivers},{label:'Scuderia · Sprint',a:left.sprint===null?null:left.sprintConstructor,b:right.sprint===null?null:right.sprintConstructor}]:[]),
        ].map(({label,a,b})=><div key={label} className="grid grid-cols-[minmax(0,1fr)_4rem_4rem] items-center gap-2 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_6rem_6rem]"><dt className="text-xs text-zinc-500 sm:text-sm">{label}</dt><dd aria-label={`${left.name}: ${a??'in attesa'}`} className="text-right font-bold tabular-nums">{a===null?'—':number(a)}</dd><dd aria-label={`${right.name}: ${b??'in attesa'}`} className="text-right font-bold tabular-nums">{b===null?'—':number(b)}</dd></div>)}</dl>
        <details className="group rounded-xl border border-zinc-200 p-4"><summary className="cursor-pointer text-sm font-bold">Dettaglio piloti e scuderie</summary><div className="mt-4 grid gap-5 sm:grid-cols-2">{[left,right].map((team)=><ComparisonTeam key={team.id} team={team} hasSprint={round.race.has_sprint} driverName={driverName} constructorName={constructorName}/>)}</div></details>
        <NavigationLink href={`/home?${new URLSearchParams({league:leagueId,tab:'lineups',race:raceId})}`} className="min-h-11 py-2 text-sm font-bold text-red-600">Vedi tutte le formazioni della gara</NavigationLink>
      </>:<p className="py-5 text-sm text-zinc-500">Servono due squadre per il confronto.</p>}
    </>}
  </section>;
}
function ComparisonTeam({team,hasSprint,driverName,constructorName}:{team:RoundTeam;hasSprint:boolean;driverName:(id:number)=>string;constructorName:(id:number)=>string}) {
  return <div className="min-w-0 space-y-3"><h4 className="break-words text-sm font-black">{team.name}</h4>{team.drivers.map((driver)=><div key={driver.id} className="rounded-lg bg-zinc-50 p-3"><p className="break-words text-xs font-bold">{driverName(driver.id)}{driver.reserve&&<span className="ml-1 font-medium text-amber-700">· Riserva subentrata</span>}</p><p className="mt-1 text-xs text-zinc-500">GP {driver.gp===null?team.gp===null?'da pubblicare':'non schierato':`${number(driver.gp)} pt`}{hasSprint?` · Sprint ${driver.sprint===null?team.sprint===null?'da pubblicare':'non schierato':`${number(driver.sprint)} pt`}`:''}</p></div>)}
    <p className="text-xs text-zinc-500">Scuderia: <b className="text-zinc-800">{constructorName(team.constructorId)}</b>{!team.hasLineup?' · Non schierata':''}</p></div>;
}
