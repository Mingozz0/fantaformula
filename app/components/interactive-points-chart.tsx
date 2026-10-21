'use client';
import { useId, useState } from 'react';
import { FormSelect } from './form-select';
import { chartSeries, type ChartMode, type ChartSource } from '@/lib/chart-data';
import type { TeamStats } from '@/lib/league-stats';

const colors = ['#e7000b','#2563eb','#059669','#9333ea','#d97706','#0891b2','#db2777'];
const number = (value: number) => new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(value);
export function InteractivePointsChart({ entries }: { entries: TeamStats[] }) {
  const [visible, setVisible] = useState(() => entries.map((entry) => entry.team.id));
  const [source, setSource] = useState<ChartSource>('all');
  const [mode, setMode] = useState<ChartMode>('cumulative');
  const [period, setPeriod] = useState('all');
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  const all = chartSeries(entries, source, mode);
  const series = all.filter((entry) => visible.includes(entry.id)).map((entry) => ({ ...entry, rows: period === 'last5' ? entry.rows.slice(-5) : entry.rows }));
  const rows = series[0]?.rows ?? [];
  const numbers = series.flatMap((entry) => entry.rows.map((row) => row.value));
  const min = mode === 'position' ? 1 : Math.min(0, ...numbers);
  const max = mode === 'position' ? Math.max(2, entries.length) : Math.max(1, ...numbers);
  const x = (index: number) => rows.length === 1 ? 320 : 52 + index * (556 / Math.max(1, rows.length - 1));
  const y = (value: number) => mode === 'position' ? 24 + (value - min) / (max - min) * 152 : 176 - (value - min) / (max - min) * 152;
  const active = rows.length ? Math.min(hover ?? rows.length - 1, rows.length - 1) : 0;
  const ticks = [...new Set(mode === 'position' ? [1, Math.ceil(entries.length / 2), Math.max(1, entries.length)] : [min, min + (max-min)/2, max])];
  const color = (teamId: string) => colors[entries.findIndex((entry) => entry.team.id === teamId) % colors.length];
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      <FormSelect label="Vista" name={`${id}-mode`} value={mode} onValueChange={(value) => { setMode(value as ChartMode); setHover(null); }} options={[{value:'cumulative',label:'Punti cumulativi'},{value:'round',label:'Punti per tappa'},{value:'position',label:'Posizione in classifica'}]} />
      <FormSelect label="Gare" name={`${id}-source`} value={source} onValueChange={(value) => { setSource(value as ChartSource); setHover(null); }} options={[{value:'all',label:'GP + Sprint'},{value:'gp',label:'Solo GP'},{value:'sprint',label:'Solo Sprint'}]} />
      <FormSelect label="Periodo" name={`${id}-period`} value={period} onValueChange={(value) => { setPeriod(value); setHover(null); }} options={[{value:'all',label:'Tutta la stagione'},{value:'last5',label:'Ultime 5 tappe'}]} />
    </div>
    {entries.length > 1 && <>
      <div className="flex flex-wrap gap-2">{entries.map((entry) => <button key={entry.team.id} type="button" aria-pressed={visible.includes(entry.team.id)} onClick={() => { setVisible((ids) => ids.includes(entry.team.id) ? ids.filter((id) => id !== entry.team.id) : [...ids, entry.team.id]); setHover(null); }}
        className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-left text-xs font-semibold transition aria-pressed:bg-zinc-100 aria-pressed:text-zinc-950 aria-[pressed=false]:text-zinc-400"><span className="size-2 shrink-0 rounded-full" style={{backgroundColor:visible.includes(entry.team.id)?color(entry.team.id):'#d4d4d8'}} /><span className="break-words">{entry.team.name}</span></button>)}</div>
      <div className="flex flex-wrap gap-4 text-xs font-semibold text-red-600"><button type="button" onClick={() => setVisible(entries.map((entry) => entry.team.id))}>Tutte</button><button type="button" onClick={() => setVisible([])}>Nessuna</button><button type="button" onClick={() => setVisible((ids) => ids.length >= 2 ? ids.slice(0,2) : entries.slice(0,2).map((entry) => entry.team.id))}>Testa a testa</button></div>
    </>}
    {rows.length ? <>
      <svg viewBox="0 0 640 220" role="img" aria-label={mode === 'position' ? 'Andamento della posizione in classifica' : 'Andamento punti delle squadre selezionate'} className="h-auto w-full touch-pan-y" onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const cursor = (event.clientX-bounds.left)/bounds.width*640;
        setHover(Math.max(0, Math.min(rows.length-1, Math.round((cursor-52)/556*(rows.length-1)))));
      }} onPointerLeave={() => setHover(null)}>
        <title>{mode === 'position' ? 'Posizioni in classifica' : 'Punti per tappa'}</title>
        {ticks.map((value) => <g key={value}><line x1="52" x2="608" y1={y(value)} y2={y(value)} stroke="#e4e4e7" strokeDasharray="3 5" /><text x="40" y={y(value)+4} textAnchor="end" fontSize="11" fill="#71717a">{number(value)}</text></g>)}
        <line x1={x(active)} x2={x(active)} y1="20" y2="180" stroke="#a1a1aa" strokeDasharray="3 4" />
        {series.map((entry) => <g key={entry.id}><polyline fill="none" stroke={color(entry.id)} strokeWidth="3" strokeLinejoin="round" points={entry.rows.map((row,index) => `${x(index)},${y(row.value)}`).join(' ')} />
          {entry.rows.map((row,index) => <circle key={row.race.id} cx={x(index)} cy={y(row.value)} r={index===active?5:3.5} fill={color(entry.id)} tabIndex={0} onFocus={() => setHover(index)} aria-label={`${entry.name}, ${row.race.name}: ${number(row.value)} ${mode==='position'?'posto':'punti'}`} className="outline-offset-4 focus:outline-2"><title>{`${entry.name} · ${row.race.name}: ${number(row.value)}`}</title></circle>)}
        </g>)}
        {rows.filter((_,index) => rows.length<=8 || index%Math.ceil(rows.length/7)===0 || index===rows.length-1).map((row) => <text key={row.race.id} x={x(rows.indexOf(row))} y="208" textAnchor="middle" fontSize="11" fill="#71717a">{`GP ${row.race.round}`}</text>)}
      </svg>
      <div className="rounded-xl bg-zinc-50 p-3"><p className="text-xs font-bold text-zinc-500">{rows[active]?.race.name}</p><dl className="mt-2 grid gap-2 sm:grid-cols-2">{series.map((entry) => <div key={entry.id} className="flex min-w-0 justify-between gap-3 text-xs"><dt className="break-words font-semibold" style={{color:color(entry.id)}}>{entry.name}</dt><dd className="shrink-0 font-bold tabular-nums">{number(entry.rows[active].value)}{mode==='position'?'º':' pt'}</dd></div>)}</dl>
        {series.length===2 && <p className="mt-3 border-t border-zinc-200 pt-2 text-xs font-semibold">Distacco: {number(Math.abs(series[0].rows[active].cumulative-series[1].rows[active].cumulative))} pt</p>}
      </div>
    </> : <p className="py-8 text-center text-sm text-zinc-400">{visible.length ? 'Nessuna gara pubblicata' : 'Seleziona le squadre da confrontare'}</p>}
  </div>;
}
