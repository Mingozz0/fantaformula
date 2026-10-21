import { NavigationLink as Link, SubmitButton } from '@/app/components/action-feedback';
import { FormSelect } from '@/app/components/form-select';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { publishResults, saveResults } from './actions';

type Race = { id: number; round: number; name: string; has_sprint: boolean;
  gp_published: boolean; sprint_published: boolean; race_date: string | null };
type Driver = { id: number; first_name: string; last_name: string };
type Result = { driver_id: number; constructor_id: number | null; grid_position: number | null;
  finish_position: number | null; result_status: string; formation_lap: boolean;
  fastest_lap: boolean; driver_of_the_day?: boolean };

export default async function ManagerPage({ searchParams }: {
  searchParams: Promise<{ race?: string; event?: string; message?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect('/');
  const { data: manager } = await supabase.from('game_managers').select('user_id').eq('user_id', userId).maybeSingle();
  if (!manager) redirect('/home');
  const { data: season } = await supabase.from('seasons').select('id').eq('year', 2026).single();
  if (!season) return <p>Stagione 2026 non disponibile.</p>;
  const [{ data: racesData }, { data: rosterData }, { data: constructorData }] = await Promise.all([
    supabase.from('races').select('*').eq('season_id', season.id).order('round'),
    supabase.from('season_drivers').select('driver_id,constructor_id').eq('season_id', season.id),
    supabase.from('season_constructors').select('constructor_id,display_name').eq('season_id', season.id),
  ]);
  const races = (racesData ?? []) as Race[];
  const roster = rosterData ?? [];
  const constructors = constructorData ?? [];
  const selected = races.find((race) => race.id === Number(params.race)) ?? races[0];
  const event = params.event === 'sprint' && selected?.has_sprint ? 'sprint' : 'gp';
  const [{ data: driversData }, { data: resultsData }, { data: pitData }] = await Promise.all([
    roster.length ? supabase.from('drivers').select('id,first_name,last_name').in('id', roster.map((row) => row.driver_id)) : Promise.resolve({ data: [] }),
    selected ? supabase.from(event === 'gp' ? 'race_driver_results' : 'sprint_driver_results')
      .select('*').eq('race_id', selected.id) : Promise.resolve({ data: [] }),
    selected ? supabase.from('race_constructor_results').select('constructor_id,fastest_pit_stop').eq('race_id', selected.id) : Promise.resolve({ data: [] }),
  ]);
  const drivers = (driversData ?? []) as Driver[];
  const results = (resultsData ?? []) as Result[];
  const fastestId = results.find((item) => item.fastest_lap)?.driver_id;
  const dotdId = results.find((item) => item.driver_of_the_day)?.driver_id;
  const pitId = (pitData ?? []).find((item) => item.fastest_pit_stop)?.constructor_id;
  const driverName = (id: number) => { const d = drivers.find((item) => item.id === id); return d ? `${d.first_name} ${d.last_name}` : `Pilota ${id}`; };
  return <main className="min-h-screen bg-zinc-100 px-5 py-8 text-zinc-950"><div className="mx-auto max-w-7xl">
    <header className="flex items-center justify-between"><Link href="/home" className="text-xl font-black">GRID<span className="text-red-600">F1</span></Link>
      <Link className="text-sm font-bold text-red-600" href="/home">Torna alle leghe</Link></header>
    <div className="mt-9"><p className="text-xs font-bold uppercase tracking-widest text-red-600">Gestore del gioco</p>
      <h1 className="mt-2 text-4xl font-black">Risultati 2026</h1>
      <p className="mt-2 text-zinc-600">Compila tutti i piloti, salva, verifica e pubblica. Ogni correzione toglie la pubblicazione finché non la confermi di nuovo.</p></div>
    {params.message && <p role="status" className="mt-6 rounded-xl bg-amber-100 p-4 text-sm text-amber-950">{params.message}</p>}
    <div className="mt-7 flex flex-wrap gap-2">{races.map((race) => <Link key={race.id}
      href={`/manager?race=${race.id}&event=gp`} className={`rounded-lg px-3 py-2 text-sm font-semibold ${selected?.id === race.id ? 'bg-red-600 text-white' : 'bg-white'}`}>
      {race.round}. {race.name}{race.gp_published ? ' ✓' : ''}</Link>)}</div>
    {selected && <><div className="mt-6 flex gap-2"><Link href={`/manager?race=${selected.id}&event=gp`}
      className={`rounded-lg px-4 py-2 font-bold ${event === 'gp' ? 'bg-zinc-950 text-white' : 'bg-white'}`}>Gran Premio</Link>
      {selected.has_sprint && <Link href={`/manager?race=${selected.id}&event=sprint`}
        className={`rounded-lg px-4 py-2 font-bold ${event === 'sprint' ? 'bg-zinc-950 text-white' : 'bg-white'}`}>Sprint</Link>}</div>
      <div className="mt-5 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-black">{selected.name} · {event === 'gp' ? 'GP' : 'Sprint'}</h2>
        <p className="mt-1 text-sm text-zinc-500">{results.length}/{roster.length} piloti registrati · {(event === 'gp' ? selected.gp_published : selected.sprint_published) ? 'pubblicato' : 'non pubblicato'}</p>
        <form action={saveResults} className="mt-6 space-y-6"><input type="hidden" name="race_id" value={selected.id} />
          <input type="hidden" name="event" value={event} />
          <div className="grid gap-3 md:grid-cols-3">
            <FormSelect label="Giro veloce" required name="fastest_driver_id" defaultValue={fastestId}
              options={roster.map((row) => ({ value: row.driver_id, label: driverName(row.driver_id) }))} />
            {event === 'gp' && <>
              <FormSelect label="Pilota del giorno" required name="dotd_driver_id" defaultValue={dotdId}
                options={roster.map((row) => ({ value: row.driver_id, label: driverName(row.driver_id) }))} />
              <FormSelect label="Migliore sosta ai box" required name="pit_constructor_id" defaultValue={pitId}
                options={constructors.map((row) => ({ value: row.constructor_id, label: row.display_name }))} />
            </>}
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-zinc-500">
            <th className="p-2">Pilota</th><th className="p-2">Scuderia reale</th><th className="p-2">Griglia</th>
            <th className="p-2">Arrivo</th><th className="p-2">Esito</th><th className="p-2">Giro di formazione</th>
          </tr></thead><tbody>{roster.map((row) => {
            const result = results.find((item) => item.driver_id === row.driver_id);
            return <tr key={row.driver_id} className="border-b border-zinc-100"><td className="p-2 font-semibold">{driverName(row.driver_id)}</td>
              <td className="p-2"><FormSelect hideLabel label={`Scuderia di ${driverName(row.driver_id)}`} name={`constructor_${row.driver_id}`}
                defaultValue={result?.constructor_id ?? row.constructor_id} options={constructors.map((item) => ({ value: item.constructor_id, label: item.display_name }))} /></td>
              <td className="p-2"><input type="number" min={1} max={30} name={`grid_${row.driver_id}`} defaultValue={result?.grid_position ?? ''}
                className="w-20 rounded border p-2" /></td>
              <td className="p-2"><input type="number" min={1} max={30} name={`finish_${row.driver_id}`} defaultValue={result?.finish_position ?? ''}
                className="w-20 rounded border p-2" /></td>
              <td className="p-2"><FormSelect hideLabel label={`Esito di ${driverName(row.driver_id)}`} name={`status_${row.driver_id}`} defaultValue={result?.result_status ?? 'finished'}
                options={[{ value: 'finished', label: 'Arrivato' }, { value: 'dnf', label: 'Ritirato' }, { value: 'dns', label: 'Non partito' }, { value: 'dsq', label: 'Squalificato' }]} /></td>
              <td className="p-2 text-center"><input type="checkbox" name={`formation_${row.driver_id}`} defaultChecked={result?.formation_lap ?? true} /></td>
            </tr>;
          })}</tbody></table></div>
          <SubmitButton className="rounded-lg bg-red-600 px-5 py-3 font-bold text-white">Salva risultati {event === 'gp' ? 'GP' : 'Sprint'}</SubmitButton>
        </form>
        <form action={publishResults} className="mt-5 border-t border-zinc-200 pt-5"><input type="hidden" name="race_id" value={selected.id} />
          <input type="hidden" name="event" value={event} /><SubmitButton pendingLabel="Pubblicazione…" className="rounded-lg bg-zinc-950 px-5 py-3 font-bold text-white">Pubblica risultati</SubmitButton>
          <p className="mt-2 text-xs text-zinc-500">La pubblicazione richiede tutti i piloti, posizioni coerenti e i bonus della gara.</p></form>
      </div></>}
  </div></main>;
}
