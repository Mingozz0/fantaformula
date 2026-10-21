import { Check, Flag, Shield, Users } from 'lucide-react';
import { sessionTime } from '@/lib/weekend';
export type SummaryLineup = {driver_one_id:number;driver_two_id:number;reserve_driver_id:number;submitted_at?:string;retroactive?:boolean};
export function LineupSummary({lineup,driverName,constructorName,teamName,closed=false}:{lineup?:SummaryLineup;driverName:(id:number)=>string;constructorName:string;teamName:string;closed?:boolean}) {
  return <section aria-label="Riepilogo formazione" className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold text-zinc-500">{teamName}</p><h3 className="mt-1 font-black">La tua formazione</h3></div>
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${lineup?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-800'}`}>{lineup&&<Check aria-hidden className="size-3.5" />}{lineup?'Consegnata':closed?'Non consegnata':'Da consegnare'}</span></div>
    <div className="grid gap-3 sm:grid-cols-2">{[{label:'Titolare 1',id:lineup?.driver_one_id,icon:Users},{label:'Titolare 2',id:lineup?.driver_two_id,icon:Users},{label:'Riserva',id:lineup?.reserve_driver_id,icon:Shield}].map(({label,id,icon:Icon})=><div key={label} className="min-w-0 rounded-xl bg-zinc-50 p-3"><p className="flex items-center gap-2 text-xs font-semibold text-zinc-500"><Icon aria-hidden className="size-3.5" />{label}</p><p className="mt-2 break-words text-sm font-bold">{id?driverName(id):'Da selezionare'}</p></div>)}
      <div className="min-w-0 rounded-xl border border-red-100 bg-red-50/60 p-3"><p className="flex items-center gap-2 text-xs font-semibold text-red-700"><Flag aria-hidden className="size-3.5" />Scuderia</p><p className="mt-2 break-words text-sm font-bold">{constructorName}</p></div></div>
    {lineup?.submitted_at&&<p className="text-xs text-zinc-500">Salvata {sessionTime(lineup.submitted_at)}{lineup.retroactive?' · Recupero dell’amministratore':''}</p>}
  </section>;
}
