'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {countdownParts} from '@/lib/weekend';
export function LineupDeadline({deadline,initialNow,children}:{deadline:string;initialNow:number;children:ReactNode}) {
  const [now,setNow]=useState(initialNow);
  const refreshed=useRef(false);
  const router=useRouter();
  const countdown=countdownParts(deadline,now);
  useEffect(()=>{
    const tick=()=>setNow(Date.now());
    const timer=setInterval(tick,1000);
    document.addEventListener('visibilitychange',tick);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',tick);};
  },[]);
  useEffect(()=>{
    if(countdown?.closed&&!refreshed.current){refreshed.current=true;router.refresh();}
  },[countdown?.closed,router]);
  if(!countdown||countdown.closed)return <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">Formazione chiusa. Il riepilogo salvato resta consultabile.</p>;
  return <div className="space-y-4"><p className="text-xs font-bold text-red-700">Chiusura tra <span className="tabular-nums">{countdown.days>0&&`${countdown.days}g `}{String(countdown.hours).padStart(2,'0')}:{String(countdown.minutes).padStart(2,'0')}:{String(countdown.seconds).padStart(2,'0')}</span></p>{children}</div>;
}
