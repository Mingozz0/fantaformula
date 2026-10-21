'use client';
import {useState} from 'react';
import {ChevronDown,History} from 'lucide-react';
import {FormSelect} from './form-select';
import type {AuditEntry} from '@/lib/audit';
const labels:Record<string,string>={lineup:'Formazioni',draft_saved:'Bozze risultati',published:'Pubblicazioni',schedule_updated:'Orari',baseline:'Situazione iniziale'};
export function ChangeHistory({entries}:{entries:AuditEntry[]}) {
  const [kind,setKind]=useState('all');
  const [visible,setVisible]=useState(20);
  const filtered=entries.filter((entry)=>kind==='all'||entry.kind===kind);
  const kinds=[...new Set(entries.map((entry)=>entry.kind))];
  return <section aria-label="Storico modifiche" className="min-w-0 space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-black"><History aria-hidden className="size-5 text-red-600" />Storico modifiche</h2>
      <FormSelect label="Tipo di modifica" name="history_kind" value={kind} onValueChange={(value)=>{setKind(value);setVisible(20);}} options={[{value:'all',label:'Tutte le modifiche'},...kinds.map((value)=>({value,label:labels[value]??value}))]} /></div>
    {!filtered.length&&<p className="py-6 text-sm text-zinc-500">Nessuna modifica registrata per questa gara.</p>}
    <div className="space-y-3">{filtered.slice(0,visible).map((entry)=><details key={entry.id} className="group min-w-0 rounded-xl border border-zinc-200">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${entry.kind==='published'?'bg-emerald-50 text-emerald-700':entry.kind==='draft_saved'?'bg-amber-50 text-amber-800':'bg-zinc-100 text-zinc-600'}`}>{labels[entry.kind]??entry.kind}</span>{entry.version!=null&&entry.version>0&&<span className="text-[10px] text-zinc-400">Versione {entry.version}</span>}</div>
        <p className="mt-2 break-words text-sm font-bold">{entry.title}</p><p className="mt-1 text-xs text-zinc-500">{entry.actor} · {new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Europe/Rome'}).format(new Date(entry.changedAt))}</p>
        <p className="mt-2 text-xs font-semibold text-zinc-500">{entry.kind==='baseline'?'Dati presenti all’attivazione dello storico':`${entry.changes.length} ${entry.changes.length===1?'variazione':'variazioni'}`}</p></div><ChevronDown aria-hidden className="mt-1 size-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-180" /></summary>
      <div className="space-y-3 border-t border-zinc-100 p-4">{entry.changes.length?entry.changes.map((change,index)=><div key={index} className="min-w-0 rounded-lg bg-zinc-50 p-3"><p className="break-words text-xs font-bold">{change.label}</p><div className="mt-2 grid min-w-0 grid-cols-2 gap-3 text-xs"><div className="min-w-0"><p className="text-[10px] text-zinc-400">Prima</p><p className="mt-1 break-words text-zinc-500">{change.before}</p></div><div className="min-w-0"><p className="text-[10px] text-zinc-400">Dopo</p><p className="mt-1 break-words font-semibold text-zinc-900">{change.after}</p></div></div></div>):<p className="text-xs text-zinc-500">Nessuna variazione dei valori sportivi.</p>}</div>
    </details>)}</div>
    {filtered.length>visible&&<button type="button" onClick={()=>setVisible((count)=>count+20)} className="min-h-11 w-full rounded-xl border border-zinc-300 text-sm font-bold">Mostra altre modifiche ({filtered.length-visible})</button>}
    {entries.length>=200&&<p className="text-xs text-zinc-500">Sono mostrate le modifiche più recenti della gara selezionata.</p>}
  </section>;
}
