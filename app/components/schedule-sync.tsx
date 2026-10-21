'use client';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { syncWeekendSchedule } from '@/app/manager/schedule-actions';
export function ScheduleSync({raceId}:{raceId:number}) {
  const [pending,start]=useTransition();
  return <div className="space-y-2"><button type="button" disabled={pending} onClick={()=>start(async()=>{
    try{const reply=await syncWeekendSchedule(raceId);if(reply.ok)toast.success(`${reply.count} sessioni aggiornate.`);else toast.error(reply.error);}
    catch{toast.error('Connessione interrotta. Riprova.');}
  })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-bold disabled:opacity-50"><RefreshCw aria-hidden className={`size-4 ${pending?'animate-spin':''}`} />{pending?'Aggiornamento…':'Aggiorna orari'}</button>
    </div>;
}
