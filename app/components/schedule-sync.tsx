'use client';
import { useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { syncWeekendSchedule } from '@/app/manager/schedule-actions';
export function ScheduleSync({raceId}:{raceId:number}) {
  const [pending,start]=useTransition();
  const [message,setMessage]=useState('');
  const [failed,setFailed]=useState(false);
  return <div className="space-y-2"><button type="button" disabled={pending} onClick={()=>start(async()=>{
    setMessage('');
    try{const reply=await syncWeekendSchedule(raceId);setFailed(!reply.ok);setMessage(reply.ok?`${reply.count} sessioni aggiornate.`:reply.error);}
    catch{setFailed(true);setMessage('Connessione interrotta. Riprova.');}
  })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-bold disabled:opacity-50"><RefreshCw aria-hidden className={`size-4 ${pending?'animate-spin':''}`} />{pending?'Aggiornamento…':'Aggiorna orari'}</button>
    {message&&<p role={failed?'alert':'status'} className={`text-xs ${failed?'text-red-700':'text-emerald-700'}`}>{message}</p>}</div>;
}
