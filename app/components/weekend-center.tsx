'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Flag, LockKeyhole, Timer } from 'lucide-react';
import { NavigationLink } from './action-feedback';
import { countdownParts, sessionLabels, sessionTime, type RaceSession, type WeekendRace } from '@/lib/weekend';

export function WeekendCenter({race,sessions,initialNow,leagueId,active,hasTeam,children}:{race:WeekendRace;sessions:RaceSession[];initialNow:number;leagueId:string;active:boolean;hasTeam:boolean;children?:ReactNode}) {
  const [now,setNow]=useState(initialNow);
  const router=useRouter();
  const refreshed=useRef(false);
  useEffect(()=>{
    const tick=()=>setNow(Date.now());
    const timer=setInterval(tick,1000);
    document.addEventListener('visibilitychange',tick);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',tick);};
  },[]);
  const deadline=countdownParts(race.lineup_deadline_at,now);
  useEffect(()=>{
    if(!refreshed.current&&race.lineup_deadline_at&&initialNow<Date.parse(race.lineup_deadline_at)&&now>=Date.parse(race.lineup_deadline_at)){
      refreshed.current=true;router.refresh();
    }
  },[now,initialNow,race.lineup_deadline_at,router]);
  const ordered=sessions.toSorted((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at));
  const next=ordered.find((session)=>Date.parse(session.starts_at)>now);
  const target=deadline&&!deadline.closed?race.lineup_deadline_at:next?.starts_at??null;
  const countdown=countdownParts(target,now);
  const label=deadline&&!deadline.closed?'Chiusura formazione':next?`Alla sessione: ${sessionLabels[next.session_key]}`:ordered.length?'Programma terminato':'Orari da confermare';
  const href=(tab:string)=>`/home?${new URLSearchParams({league:leagueId,tab,race:String(race.id)})}`;
  const updated=sessions.map((row)=>row.synced_at).sort().at(-1);
  return <section aria-label="Centro del weekend" className="min-w-0 space-y-5">
    <div className="overflow-hidden rounded-2xl bg-zinc-950 p-5 text-white sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-400">Centro del weekend · Tappa {race.round}</p><h2 className="mt-2 text-3xl font-black">{race.name}</h2><p className="mt-2 text-sm text-zinc-400">{race.circuit}</p></div>
        <span className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold">{race.has_sprint?'Weekend Sprint':'Weekend GP'}</span></div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2"><div><p className="flex items-center gap-2 text-xs text-zinc-400"><Timer aria-hidden className="size-4" />{label}</p>
        {countdown&&!countdown.closed?<p className="mt-2 text-3xl font-black tabular-nums sm:text-4xl">{countdown.days>0&&`${countdown.days}g `}{String(countdown.hours).padStart(2,'0')}<span className="text-zinc-500">:</span>{String(countdown.minutes).padStart(2,'0')}<span className="text-zinc-500">:</span>{String(countdown.seconds).padStart(2,'0')}</p>:<p className="mt-2 text-lg font-bold">{!race.lineup_deadline_at?'Scadenza da definire':race.gp_published?'Risultati pubblicati':'In attesa dei risultati'}</p>}
        <p className="mt-2 text-xs text-zinc-400">{target?sessionTime(target):'Orari Italia · Europe/Rome'}</p></div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4"><p className="flex items-center gap-2 text-xs text-zinc-400"><LockKeyhole aria-hidden className="size-4" />Scadenza formazione</p><p className="mt-2 text-sm font-bold">{sessionTime(race.lineup_deadline_at)}</p><p className={`mt-2 text-xs font-semibold ${deadline?.closed?'text-amber-300':'text-emerald-300'}`}>{!active?'Lega non attiva':!hasTeam?'Squadra da assegnare':deadline?(deadline.closed?'Formazione chiusa':'Formazione aperta'):'Scadenza non disponibile'}</p>
          <p className="mt-2 text-[11px] text-zinc-400">{race.has_sprint?'Chiusura alle qualifiche Sprint':'Chiusura alle 00:00 del sabato'} · Orari Italia</p></div></div>
      <div className="mt-5 flex flex-wrap gap-2">{hasTeam&&<NavigationLink href={href('lineup')} className="min-h-11 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold">{active&&deadline&&!deadline.closed?'Gestisci formazione':'Vedi formazione'}</NavigationLink>}
        <NavigationLink href={href('results')} className="min-h-11 rounded-xl border border-white/20 px-4 py-3 text-sm font-bold">Risultati del weekend</NavigationLink></div>
    </div>
    <div className="grid gap-5 xl:grid-cols-2"><section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5"><h3 className="flex items-center gap-2 font-black"><Clock aria-hidden className="size-4 text-red-600" />Programma · orari Italia</h3>
      {ordered.length?<ol className="mt-4 divide-y divide-zinc-100">{ordered.map((session)=><li key={session.session_key} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="text-sm font-bold">{sessionLabels[session.session_key]}</p><p className="mt-1 text-xs text-zinc-500">{sessionTime(session.starts_at)}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${next?.session_key===session.session_key?'bg-red-50 text-red-700':'bg-zinc-100 text-zinc-500'}`}>{next?.session_key===session.session_key?'Prossima':Date.parse(session.starts_at)<=now?'Orario trascorso':'In programma'}</span></li>)}</ol>:<p className="mt-4 text-sm text-zinc-500">Programma da confermare.</p>}
      {updated&&<p className="mt-3 text-[11px] text-zinc-400">Fonte Jolpica-F1 · aggiornato {sessionTime(updated)}</p>}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-4">{[{name:'GP',ready:race.gp_published},...(race.has_sprint?[{name:'Sprint',ready:race.sprint_published}]:[])].map((event)=><span key={event.name} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold ${event.ready?'bg-emerald-50 text-emerald-700':'bg-zinc-100 text-zinc-500'}`}><Flag aria-hidden className="size-3" />{event.name}: {event.ready?'pubblicato':'da pubblicare'}</span>)}</div>
    </section><div className="min-w-0">{children??<div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-500">La tua squadra deve ancora essere assegnata.</div>}</div></div>
  </section>;
}
