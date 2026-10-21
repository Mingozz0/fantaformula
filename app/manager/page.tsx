import { NavigationLink as Link } from '@/app/components/action-feedback';
import { PortalShell, type PortalLeague } from '@/app/components/portal-shell';
import { RacePicker } from '@/app/components/race-picker';
import { ResultsEditor } from '@/app/components/results-editor';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { assertQuery } from '@/lib/query-errors';
import type { ResultDraft } from '@/lib/result-draft';
import { ScheduleSync } from '@/app/components/schedule-sync';
import { ChangeHistory } from '@/app/components/change-history';
import { auditChanges, type AuditEntry } from '@/lib/audit';
import { sessionLabels,sessionTime,type RaceSession } from '@/lib/weekend';

type Race = { id: number; round: number; name: string; has_sprint: boolean;
  gp_published: boolean; sprint_published: boolean; race_date: string | null };
type Driver = { id: number; first_name: string; last_name: string };
type Result = { driver_id: number; constructor_id: number | null; grid_position: number | null;
  finish_position: number | null; result_status: string; formation_lap: boolean;
  fastest_lap: boolean; driver_of_the_day?: boolean };

export default async function ManagerPage({ searchParams }: {
  searchParams: Promise<{ race?: string; event?: string; league?: string; message?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect('/');
  const sidebarOpen = (await cookies()).get('sidebar_state')?.value !== 'false';
  const metadata = await Promise.all([
    supabase.from('game_managers').select('user_id').eq('user_id', userId).maybeSingle(),
    supabase.from('seasons').select('id').eq('year', 2026).single(),
    supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
    supabase.from('league_members').select('role,leagues!inner(id,name,status)').eq('user_id', userId),
  ]);
  metadata.forEach((result) => assertQuery(result, 'Impossibile caricare il gestore'));
  const [{ data: manager }, { data: season }, { data: profile }, { data: membershipData }] = metadata;
  if (!manager) redirect('/home');
  if (!season) return <p>Stagione 2026 non disponibile.</p>;
  const memberships = (membershipData ?? []) as unknown as { role: string; leagues: PortalLeague }[];
  const leagues = memberships.map((membership) => membership.leagues);
  const league = leagues.find((entry) => entry.id === params.league) ?? leagues[0];
  const isAdmin = memberships.some((entry) => entry.leagues.id === league?.id && entry.role === 'admin');
  const managerUrl = (race?: number, event = 'gp') => `/manager?${new URLSearchParams({ ...(league ? { league: league.id } : {}), ...(race ? { race: String(race) } : {}), event })}`;
  const catalog = await Promise.all([
    supabase.from('races').select('*').eq('season_id', season.id).order('round'),
    supabase.from('season_drivers').select('driver_id,constructor_id').eq('season_id', season.id),
    supabase.from('season_constructors').select('constructor_id,display_name').eq('season_id', season.id),
  ]);
  catalog.forEach((result) => assertQuery(result, 'Impossibile caricare il calendario'));
  const [{ data: racesData }, { data: rosterData }, { data: constructorData }] = catalog;
  const races = (racesData ?? []) as Race[];
  const roster = rosterData ?? [];
  const constructors = constructorData ?? [];
  const selected = races.find((race) => race.id === Number(params.race)) ?? races[0];
  const event = params.event === 'sprint' && selected?.has_sprint ? 'sprint' : 'gp';
  const raceData = await Promise.all([
    roster.length ? supabase.from('drivers').select('id,first_name,last_name').in('id', roster.map((row) => row.driver_id)) : Promise.resolve({ data: [] }),
    selected ? supabase.from(event === 'gp' ? 'race_driver_results' : 'sprint_driver_results')
      .select('*').eq('race_id', selected.id) : Promise.resolve({ data: [] }),
    selected ? supabase.from('race_constructor_results').select('constructor_id,fastest_pit_stop').eq('race_id', selected.id) : Promise.resolve({ data: [] }),
    selected ? supabase.from('result_drafts').select('payload,version,updated_at,published_version').eq('race_id', selected.id).eq('event', event).maybeSingle() : Promise.resolve({ data: null }),
    selected ? supabase.from('race_sessions').select('*').eq('race_id',selected.id).order('starts_at') : Promise.resolve({data:[]}),
    selected ? supabase.from('race_change_audit').select('*').eq('race_id',selected.id).in('event',[event,'calendar']).order('changed_at',{ascending:false}).order('id',{ascending:false}).limit(200) : Promise.resolve({data:[]}),
  ]);
  raceData.forEach((result) => assertQuery(result, 'Impossibile caricare risultati e bozze'));
  const [{ data: driversData }, { data: resultsData }, { data: pitData }, { data: draftData },{data:sessionsData},{data:auditData}] = raceData;
  const draft = draftData as ResultDraft | undefined;
  const drivers = (driversData ?? []) as Driver[];
  const results = (resultsData ?? []) as Result[];
  const pitId = (pitData ?? []).find((item) => item.fastest_pit_stop)?.constructor_id;
  const driverName = (id: number) => { const d = drivers.find((item) => item.id === id); return d ? `${d.first_name} ${d.last_name}` : `Pilota ${id}`; };
  const constructorName=(id:number)=>constructors.find((row)=>row.constructor_id===id)?.display_name??`Scuderia ${id}`;
  const actorIds=[...new Set((auditData??[]).map((row)=>row.actor_id).filter((id):id is string=>Boolean(id)))];
  const actors=actorIds.length?await supabase.from('profiles').select('id,display_name').in('id',actorIds):{data:[]};
  assertQuery(actors,'Impossibile caricare gli autori delle modifiche');
  const history:AuditEntry[]=(auditData??[]).map((row)=>({id:String(row.id),kind:row.kind,title:row.event==='calendar'?'Programma del weekend':`${selected?.name} · ${event==='gp'?'GP':'Sprint'}`,actor:row.kind==='baseline'?'Situazione iniziale':actors.data?.find((actor)=>actor.id===row.actor_id)?.display_name??'Database',changedAt:row.changed_at,version:row.version,changes:auditChanges(row.kind,row.previous_value,row.current_value,driverName,constructorName)}));
  return <PortalShell defaultOpen={sidebarOpen} name={profile?.display_name ?? 'Il tuo account'} leagues={leagues} selectedLeagueId={league?.id} activeTab="manager" isAdmin={isAdmin} isManager>
    <div><p className="text-xs font-bold uppercase tracking-widest text-red-600">Gestore del gioco</p>
      <h1 className="mt-2 text-3xl font-black sm:text-4xl">Risultati 2026</h1>
    </div>
    {selected && <><RacePicker races={races} value={selected.id} href={managerUrl(undefined, event)} />
      <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-black">Programma del weekend</h2><ScheduleSync raceId={selected.id} /></div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{((sessionsData??[]) as RaceSession[]).map((session)=><div key={session.session_key} className="rounded-xl bg-zinc-50 p-3"><p className="text-xs font-bold">{sessionLabels[session.session_key]}</p><p className="mt-1 text-xs text-zinc-500">{sessionTime(session.starts_at)}</p></div>)}</div>
        {!sessionsData?.length&&<p className="text-sm text-zinc-500">Orari ancora da importare.</p>}
      </section>
      <div className="flex gap-2"><Link href={managerUrl(selected.id, 'gp')}
      className={`min-h-11 rounded-xl px-4 py-3 text-sm font-bold ${event === 'gp' ? 'bg-zinc-950 text-white' : 'bg-white'}`}>Gran Premio</Link>
      {selected.has_sprint && <Link href={managerUrl(selected.id, 'sprint')}
        className={`min-h-11 rounded-xl px-4 py-3 text-sm font-bold ${event === 'sprint' ? 'bg-zinc-950 text-white' : 'bg-white'}`}>Gara Sprint</Link>}</div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-2xl font-black">{selected.name} · {event === 'gp' ? 'GP' : 'Sprint'}</h2>
        <p className="mt-1 text-sm text-zinc-500">{results.length}/{roster.length} piloti registrati · {(event === 'gp' ? selected.gp_published : selected.sprint_published) ? 'pubblicato' : 'non pubblicato'}</p>
        {draft && draft.version > draft.published_version && <p className="mt-3 text-xs font-semibold text-amber-700">Bozza da pubblicare</p>}
        <ResultsEditor key={`${selected.id}-${event}`} raceId={selected.id} event={event} userId={userId} draft={draft ?? undefined}
          published={event === 'gp' ? selected.gp_published : selected.sprint_published}
          drivers={roster.map((row) => ({ id: row.driver_id, name: driverName(row.driver_id), constructorId: row.constructor_id }))}
          constructors={constructors} results={results} pitId={event === 'gp' ? pitId : undefined} />
      </div><ChangeHistory key={`${selected.id}-${event}`} entries={history} /></>}
  </PortalShell>;
}
