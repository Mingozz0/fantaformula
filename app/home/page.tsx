import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { scoreEvent, type DriverResult, type FantasyLineup, type ScoringRules } from '@/lib/scoring';
import { activateLeague, assignTeamDraft, createLeague, deleteTeamDraft, joinLeague,
  saveLineup, saveTeam, saveTeamDraft, signOut } from './actions';

type League = { id: string; name: string; season_id: number; status: string; invite_code: string };
type Member = { user_id: string; role: string };
type Profile = { id: string; display_name: string };
type Team = { id: string; league_id: string; user_id: string; name: string; constructor_id: number;
  driver_one_id: number; driver_two_id: number; driver_three_id: number };
type TeamDraft = { id: string; league_id: string; player_name: string; name: string; constructor_id: number;
  driver_one_id: number; driver_two_id: number; driver_three_id: number };
type Driver = { id: number; first_name: string; last_name: string };
type Constructor = { id: number; canonical_name: string };
type Race = { id: number; round: number; name: string; race_date: string | null;
  lineup_deadline_at: string | null; has_sprint: boolean; gp_published: boolean; sprint_published: boolean };
type Lineup = FantasyLineup & { id: string; fantasy_team_id: string; race_id: number; retroactive: boolean };
type Pit = { race_id: number; constructor_id: number; fastest_pit_stop: boolean };
type RaceResult = DriverResult & { race_id: number };

function dateLabel(date: string | null) {
  if (!date) return 'Data da confermare';
  return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Europe/Rome' }).format(new Date(`${date}T12:00:00Z`));
}
function deadlineLabel(date: string | null) {
  if (!date) return 'Scadenza da definire';
  return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', hour: '2-digit',
    minute: '2-digit', timeZone: 'Europe/Rome' }).format(new Date(date));
}
function url(leagueId: string, tab: string, raceId?: number) {
  const params = new URLSearchParams({ league: leagueId, tab });
  if (raceId) params.set('race', String(raceId));
  return `/home?${params}`;
}
async function currentTime() { return Date.now(); }

export default async function HomePage({ searchParams }: {
  searchParams: Promise<{ league?: string; tab?: string; race?: string; message?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect('/');
  const { data: memberships } = await supabase.from('league_members').select('league_id,role').eq('user_id', userId);
  const leagueIds = (memberships ?? []).map((item) => item.league_id);
  const [{ data: leaguesData }, { data: managerData }] = await Promise.all([
    leagueIds.length ? supabase.from('leagues').select('*').in('id', leagueIds) : Promise.resolve({ data: [] }),
    supabase.from('game_managers').select('user_id').eq('user_id', userId).maybeSingle(),
  ]);
  const leagues = (leaguesData ?? []) as League[];
  const selected = leagues.find((league) => league.id === params.league) ?? leagues[0];
  const tab = ['overview', 'team', 'lineup', 'standings', 'results', 'manage'].includes(params.tab ?? '')
    ? params.tab! : 'overview';
  if (!selected) return <main className="min-h-screen bg-zinc-100 px-5 py-10 text-zinc-950">
    <div className="mx-auto max-w-4xl"><Header name="Le tue leghe" manager={Boolean(managerData)} />
      <div className="mt-10 rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-3xl font-black">Inizia la tua stagione</h1>
        <p className="mt-2 text-zinc-600">Crea una lega 2026 o inserisci il codice ricevuto da un amico.</p>
        <LeagueForms /></div></div></main>;

  const [{ data: membersData }, { data: teamsData }, { data: seasonDriversData },
    { data: constructorsData }, { data: racesData }, { data: rulesData }] = await Promise.all([
    supabase.from('league_members').select('user_id,role').eq('league_id', selected.id),
    supabase.from('fantasy_teams').select('*').eq('league_id', selected.id),
    supabase.from('season_drivers').select('driver_id,constructor_id').eq('season_id', selected.season_id),
    supabase.from('season_constructors').select('constructor_id,display_name').eq('season_id', selected.season_id),
    supabase.from('races').select('*').eq('season_id', selected.season_id).order('round'),
    supabase.from('season_scoring_rules').select('*').eq('season_id', selected.season_id).maybeSingle(),
  ]);
  const members = (membersData ?? []) as Member[];
  const isAdmin = members.some((m) => m.user_id === userId && m.role === 'admin');
  const teams = (teamsData ?? []) as Team[];
  const seasonDrivers = seasonDriversData ?? [];
  const constructorRows = constructorsData ?? [];
  const races = (racesData ?? []) as Race[];
  const driverIds = seasonDrivers.map((row) => row.driver_id);
  const constructorIds = constructorRows.map((row) => row.constructor_id);
  const [{ data: profilesData }, { data: driversData }, { data: constructorsRaw },
    { data: lineupsData }, { data: gpData }, { data: sprintData }, { data: pitData },
    { data: draftsData }] = await Promise.all([
    members.length ? supabase.from('profiles').select('id,display_name').in('id', members.map((m) => m.user_id)) : Promise.resolve({ data: [] }),
    driverIds.length ? supabase.from('drivers').select('id,first_name,last_name').in('id', driverIds) : Promise.resolve({ data: [] }),
    constructorIds.length ? supabase.from('constructors').select('id,canonical_name').in('id', constructorIds) : Promise.resolve({ data: [] }),
    supabase.from('lineups').select('*').eq('league_id', selected.id),
    supabase.from('race_driver_results').select('*').eq('season_id', selected.season_id),
    supabase.from('sprint_driver_results').select('*').eq('season_id', selected.season_id),
    supabase.from('race_constructor_results').select('*').eq('season_id', selected.season_id),
    isAdmin ? supabase.from('team_drafts').select('*').eq('league_id', selected.id).order('created_at')
      : Promise.resolve({ data: [] }),
  ]);
  const profiles = (profilesData ?? []) as Profile[];
  const drivers = (driversData ?? []) as Driver[];
  const constructors = (constructorsRaw ?? []) as Constructor[];
  const lineups = (lineupsData ?? []) as Lineup[];
  const gpResults = (gpData ?? []) as RaceResult[];
  const sprintResults = (sprintData ?? []) as RaceResult[];
  const pitResults = (pitData ?? []) as Pit[];
  const drafts = (draftsData ?? []) as TeamDraft[];
  const rules = rulesData as ScoringRules | null;
  const myTeam = teams.find((team) => team.user_id === userId);
  const membersWithoutTeam = members.filter((member) => !teams.some((team) => team.user_id === member.user_id));
  const driverName = (id: number) => { const d = drivers.find((item) => item.id === id); return d ? `${d.first_name} ${d.last_name}` : `Pilota ${id}`; };
  const constructorName = (id: number) => constructorRows.find((item) => item.constructor_id === id)?.display_name
    ?? constructors.find((item) => item.id === id)?.canonical_name ?? `Scuderia ${id}`;
  const ownerName = (id: string) => profiles.find((item) => item.id === id)?.display_name ?? 'Partecipante';
  const now = await currentTime();
  const nextRace = races.find((race) => race.lineup_deadline_at && Date.parse(race.lineup_deadline_at) > now);
  const raceForLineup = races.find((race) => race.id === Number(params.race)) ?? nextRace ?? races.at(-1);
  const scoreFor = (team: Team, race: Race) => {
    const lineup = lineups.find((item) => item.fantasy_team_id === team.id && item.race_id === race.id) ?? null;
    const gp = race.gp_published && rules ? scoreEvent(lineup, team.constructor_id,
      gpResults.filter((item) => item.race_id === race.id), rules, false,
      pitResults.find((item) => item.race_id === race.id && item.fastest_pit_stop)?.constructor_id ?? null) : null;
    const sprint = race.sprint_published && rules ? scoreEvent(lineup, team.constructor_id,
      sprintResults.filter((item) => item.race_id === race.id), rules, true) : null;
    return { lineup, gp, sprint, total: (gp?.total ?? 0) + (sprint?.total ?? 0) };
  };
  const standings = teams.map((team) => ({ team,
    points: races.reduce((sum, race) => sum + scoreFor(team, race).total, 0),
  })).sort((a, b) => b.points - a.points || a.team.name.localeCompare(b.team.name));
  const provisional = races.some((race) => (race.gp_published || race.sprint_published)
    && ((race.has_sprint && !race.sprint_published) || !race.gp_published
      || teams.some((team) => !lineups.some((lineup) => lineup.fantasy_team_id === team.id && lineup.race_id === race.id))));

  return <main className="min-h-screen bg-[#f6f6f4] text-zinc-950">
    <div className="mx-auto max-w-7xl px-5 py-7"><Header name={ownerName(userId)} manager={Boolean(managerData)} />
      <div className="mt-7 grid gap-7 lg:grid-cols-[230px_1fr]">
        <aside className="h-fit rounded-2xl bg-zinc-950 p-4 text-white lg:sticky lg:top-5">
          <p className="px-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Lega attiva</p>
          <p className="mt-3 rounded-lg bg-zinc-800 p-2 text-sm font-bold">{selected.name} · {selected.status}</p>
          {leagues.length > 1 && <div className="mt-3 space-y-1">{leagues.map((league) =>
            <Link className={`block rounded-lg px-3 py-2 text-sm ${league.id === selected.id ? 'bg-red-600' : 'hover:bg-zinc-800'}`}
              key={league.id} href={url(league.id, 'overview')}>{league.name}</Link>)}</div>}
          <nav className="mt-5 space-y-1">{[
            ['overview','Panoramica'],['team','La mia squadra'],['lineup','Formazione'],
            ['standings','Classifica'],['results','Risultati'], ...(isAdmin ? [['manage','Gestione lega']] : []),
          ].map(([id,label]) => <Link key={id} href={url(selected.id,id)}
            className={`block rounded-lg px-3 py-2.5 text-sm font-semibold ${tab === id ? 'bg-red-600' : 'text-zinc-300 hover:bg-zinc-800'}`}>{label}</Link>)}</nav>
          <form action={signOut}><button className="mt-5 px-3 text-sm text-zinc-400 hover:text-white">Esci</button></form>
        </aside>
        <section className="min-w-0 space-y-6">
          {params.message && <p role="status" className="rounded-xl bg-amber-100 p-3 text-sm font-medium text-amber-950">{params.message}</p>}
          <div><p className="text-xs font-bold uppercase tracking-widest text-red-600">Stagione 2026 · {selected.status}</p>
            <h1 className="mt-1 text-4xl font-black">{selected.name}</h1>
            <p className="mt-2 text-zinc-500">{members.length} di 7 partecipanti · {isAdmin ? 'Amministratore' : 'Partecipante'}</p></div>

          {tab === 'overview' && <>
            <div className="grid gap-4 md:grid-cols-3">
              <Metric label="La tua squadra" value={myTeam?.name ?? 'Da assegnare'} />
              <Metric label="Punti" value={String(standings.find((item) => item.team.user_id === userId)?.points ?? 0)} />
              <Metric label="Prossimo GP" value={nextRace?.name ?? 'Stagione conclusa'} />
            </div>
            <Card title="Prossima formazione">
              {nextRace ? <><p>{nextRace.name} · {dateLabel(nextRace.race_date)}{nextRace.has_sprint ? ' · Sprint' : ''}</p>
                <p className="mt-2 text-sm text-zinc-500">Chiusura: {deadlineLabel(nextRace.lineup_deadline_at)}</p>
                {selected.status === 'active' ?
                  <Link className="mt-4 inline-block font-bold text-red-600" href={url(selected.id,'lineup',nextRace.id)}>Imposta formazione →</Link>
                  : <p className="mt-4 text-sm text-amber-800">La lega deve essere attivata prima di schierare la formazione.</p>}</>
                : <p>Non ci sono formazioni future da inviare.</p>}
            </Card>
            <Card title="Le tue leghe"><LeagueForms /></Card>
          </>}

          {tab === 'team' && <Card title={myTeam?.name ?? 'Squadra in attesa'}>
            {myTeam ? <><p className="text-sm text-zinc-500">Assegnata dall’amministratore della lega.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">{[myTeam.driver_one_id,myTeam.driver_two_id,myTeam.driver_three_id]
                .map((id) => <div key={id} className="rounded-xl bg-zinc-100 p-4 font-bold">{driverName(id)}</div>)}</div>
              <p className="mt-5 font-bold">Scuderia: {constructorName(myTeam.constructor_id)}</p></>
              : <p>L’amministratore non ha ancora assegnato la tua squadra.</p>}
          </Card>}

          {tab === 'lineup' && <>
            <Card title="Scegli il Gran Premio"><div className="flex flex-wrap gap-2">{races.map((race) =>
              <Link key={race.id} href={url(selected.id,'lineup',race.id)}
                className={`rounded-lg px-3 py-2 text-sm ${raceForLineup?.id === race.id ? 'bg-red-600 text-white' : 'bg-zinc-100'}`}>
                {race.round}. {race.name}</Link>)}</div></Card>
            {raceForLineup && <Card title={`${raceForLineup.name} · ${dateLabel(raceForLineup.race_date)}`}>
              <p className="mb-5 text-sm text-zinc-500">Scadenza {deadlineLabel(raceForLineup.lineup_deadline_at)}. Scegli due titolari; il terzo è la riserva.</p>
              {selected.status !== 'active' && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Attendi l’attivazione della lega.</p>}
              {selected.status === 'active' && myTeam && (!raceForLineup.lineup_deadline_at || now < Date.parse(raceForLineup.lineup_deadline_at)) &&
                <LineupForm leagueId={selected.id} race={raceForLineup} team={myTeam}
                  lineup={lineups.find((item) => item.fantasy_team_id === myTeam.id && item.race_id === raceForLineup.id)}
                  driverName={driverName} />}
              {raceForLineup.lineup_deadline_at && now >= Date.parse(raceForLineup.lineup_deadline_at) &&
                <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">La scadenza è passata. Solo l’admin può recuperare questa formazione.</p>}
              {selected.status === 'active' && isAdmin && raceForLineup.lineup_deadline_at && now >= Date.parse(raceForLineup.lineup_deadline_at) &&
                <div className="space-y-6">{teams.map((team) => <div key={team.id} className="border-t border-zinc-200 pt-5">
                  <h3 className="mb-3 font-bold">{team.name} · {ownerName(team.user_id)}</h3>
                  <LineupForm leagueId={selected.id} race={raceForLineup} team={team}
                    lineup={lineups.find((item) => item.fantasy_team_id === team.id && item.race_id === raceForLineup.id)}
                    driverName={driverName} />
                </div>)}</div>}
              {!myTeam && !isAdmin && <p>Attendi l’assegnazione della tua squadra.</p>}
            </Card>}
          </>}

          {tab === 'standings' && <Card title={`Classifica ${provisional ? '· provvisoria' : ''}`}>
            {!rules && <p className="text-amber-700">Regole di punteggio non ancora disponibili per questa stagione.</p>}
            <div className="mt-4 divide-y divide-zinc-100">{standings.map((entry) =>
              <div key={entry.team.id} className="grid grid-cols-[45px_1fr_auto] items-center gap-3 py-4">
                <span className="font-black text-zinc-400">{1 + standings.filter((other) => other.points > entry.points).length}°</span>
                <div><p className="font-bold">{entry.team.name}</p><p className="text-sm text-zinc-500">{ownerName(entry.team.user_id)}</p></div>
                <strong>{entry.points} pt</strong>
              </div>)}</div>
            {!standings.length && <p className="text-zinc-500">Le squadre non sono ancora state assegnate.</p>}
            <p className="mt-4 text-xs text-zinc-500">Contano solo i risultati pubblicati. Le formazioni mancanti valgono zero punti.</p>
          </Card>}

          {tab === 'results' && <div className="space-y-4">{races.map((race) => {
            const published = race.gp_published || race.sprint_published;
            const gp = gpResults.filter((item) => item.race_id === race.id).sort((a,b) =>
              (a.finish_position ?? 999) - (b.finish_position ?? 999));
            const sprint = sprintResults.filter((item) => item.race_id === race.id).sort((a,b) =>
              (a.finish_position ?? 999) - (b.finish_position ?? 999));
            return <Card key={race.id} title={`${race.round}. ${race.name} · ${dateLabel(race.race_date)}`}>
              <p className="text-sm text-zinc-500">{race.gp_published ? 'GP pubblicato' : 'GP in attesa'}
                {race.has_sprint ? ` · Sprint ${race.sprint_published ? 'pubblicata' : 'in attesa'}` : ''}</p>
              {published && <div className="mt-4 grid gap-4 lg:grid-cols-2"><div>
                <h3 className="font-bold">Risultato GP</h3><div className="mt-2 space-y-1 text-sm">{race.gp_published && gp.map((result) =>
                  <p key={result.driver_id}>{result.finish_position ?? '–'}. {driverName(result.driver_id)} · {result.result_status}</p>)}</div>
                {race.sprint_published && <><h3 className="mt-5 font-bold">Risultato Sprint</h3><div className="mt-2 space-y-1 text-sm">
                  {sprint.map((result) => <p key={result.driver_id}>{result.finish_position ?? '–'}. {driverName(result.driver_id)} · {result.result_status}</p>)}
                </div></>}
              </div><div><h3 className="font-bold">Punti fantasy della lega</h3>
                <div className="mt-2 space-y-2 text-sm">{teams.map((team) => {
                  const score = scoreFor(team, race);
                  return <p key={team.id}>{team.name}: <strong>{score.total} pt</strong>
                    {score.gp && ` · GP ${score.gp.total} (piloti ${score.gp.driverScores.join(' + ')}, scuderia ${score.gp.constructorScore})`}
                    {score.sprint && ` · Sprint ${score.sprint.total} (piloti ${score.sprint.driverScores.join(' + ')}, scuderia ${score.sprint.constructorScore})`}
                    {(score.gp?.reserveUsed || score.sprint?.reserveUsed) && ' · riserva subentrata'}</p>;
                })}</div></div></div>}
            </Card>;
          })}</div>}

          {tab === 'manage' && isAdmin && <>
            <Card title="Inviti e attivazione"><p>Codice invito: <strong className="font-mono text-lg">{selected.invite_code}</strong></p>
              <p className="mt-2 text-sm text-zinc-500">La lega si attiva con 4–7 membri, ciascuno con una squadra completa.</p>
              {selected.status === 'recruiting' && <form action={activateLeague} className="mt-4">
                <input type="hidden" name="league_id" value={selected.id} />
                <button className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white">Attiva lega</button></form>}</Card>
            <Card title="Assegna le squadre"><div className="space-y-8">{members.map((member) => {
              const team = teams.find((item) => item.user_id === member.user_id);
              return <form action={saveTeam} key={member.user_id} className="space-y-3 border-t border-zinc-200 pt-5">
                <h3 className="font-bold">{ownerName(member.user_id)} <span className="text-sm font-normal text-zinc-500">{member.role}</span></h3>
                <input type="hidden" name="league_id" value={selected.id} /><input type="hidden" name="user_id" value={member.user_id} />
                <input name="name" required minLength={2} defaultValue={team?.name ?? ''} placeholder="Nome squadra" className="w-full rounded-lg border p-2" />
                <div className="grid gap-3 md:grid-cols-4">
                  {[1,2,3].map((n) => <select required key={n} name={`driver_${['one','two','three'][n-1]}_id`}
                    defaultValue={team?.[`driver_${['one','two','three'][n-1]}_id` as keyof Team] ?? ''}
                    className="rounded-lg border p-2"><option value="">Pilota {n}</option>
                    {drivers.map((d) => <option key={d.id} value={d.id}>{driverName(d.id)}</option>)}</select>)}
                  <select required name="constructor_id" defaultValue={team?.constructor_id ?? ''} className="rounded-lg border p-2">
                    <option value="">Scuderia</option>{constructorRows.map((row) => <option key={row.constructor_id} value={row.constructor_id}>{constructorName(row.constructor_id)}</option>)}
                  </select>
                </div><button className="rounded-lg bg-zinc-950 px-4 py-2 font-bold text-white">Salva squadra</button>
              </form>;
            })}</div></Card>
            <Card title="Squadre per i ragazzi non ancora registrati">
              <p className="mb-5 text-sm text-zinc-600">Prepara una squadra indicando il nome del ragazzo. Quando si registra ed entra con il codice invito, assegnagli qui la squadra già pronta.</p>
              <TeamDraftForm leagueId={selected.id} drivers={drivers} constructorRows={constructorRows}
                driverName={driverName} />
              {drafts.map((draft) => <div key={draft.id} className="mt-8 border-t border-zinc-200 pt-6">
                <TeamDraftForm leagueId={selected.id} draft={draft} drivers={drivers}
                  constructorRows={constructorRows} driverName={driverName} />
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <form action={assignTeamDraft} className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="league_id" value={selected.id} />
                    <input type="hidden" name="draft_id" value={draft.id} />
                    <label className="text-sm font-semibold">Assegna a un membro entrato nella lega
                      <select name="user_id" required defaultValue="" className="mt-1 block rounded-lg border p-2.5">
                        <option value="">Seleziona partecipante</option>
                        {membersWithoutTeam.map((member) => <option key={member.user_id} value={member.user_id}>
                          {ownerName(member.user_id)}</option>)}
                      </select>
                    </label>
                    <button disabled={!membersWithoutTeam.length} className="rounded-lg bg-red-600 px-4 py-2.5 font-bold text-white disabled:opacity-50">Assegna squadra</button>
                  </form>
                  <form action={deleteTeamDraft}>
                    <input type="hidden" name="league_id" value={selected.id} />
                    <input type="hidden" name="draft_id" value={draft.id} />
                    <button className="rounded-lg border border-zinc-300 px-4 py-2.5 font-bold">Elimina bozza</button>
                  </form>
                </div>
              </div>)}
            </Card>
          </>}
        </section>
      </div>
    </div>
  </main>;
}

function Header({ name, manager }: { name: string; manager: boolean }) {
  return <header className="flex items-center justify-between border-b border-zinc-200 pb-5">
    <Link href="/home" className="text-xl font-black">GRID<span className="text-red-600">F1</span></Link>
    <div className="flex items-center gap-5 text-sm"><span>Ciao, {name}</span>
      {manager && <Link className="font-bold text-red-600" href="/manager">Gestisci risultati</Link>}</div>
  </header>;
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"><h2 className="mb-4 text-xl font-black">{title}</h2>{children}</div>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-zinc-200 bg-white p-5"><p className="text-sm text-zinc-500">{label}</p>
    <p className="mt-3 truncate text-2xl font-black">{value}</p></div>;
}
function LeagueForms() {
  return <div className="mt-5 grid gap-5 sm:grid-cols-2">
    <form action={createLeague} className="space-y-3"><h3 className="font-bold">Crea una lega</h3>
      <input name="name" required minLength={3} maxLength={100} placeholder="Nome della lega" className="w-full rounded-lg border p-3" />
      <button className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white">Crea lega 2026</button></form>
    <form action={joinLeague} className="space-y-3"><h3 className="font-bold">Entra in una lega</h3>
      <input name="code" required placeholder="Codice invito" className="w-full rounded-lg border p-3" />
      <button className="rounded-lg bg-zinc-950 px-4 py-2 font-bold text-white">Entra</button></form>
  </div>;
}
function TeamDraftForm({ leagueId, draft, drivers, constructorRows, driverName }: {
  leagueId: string; draft?: TeamDraft; drivers: Driver[];
  constructorRows: { constructor_id: number; display_name: string }[];
  driverName: (id: number) => string;
}) {
  return <form action={saveTeamDraft} className="space-y-3">
    <h3 className="font-bold">{draft ? `Squadra preparata per ${draft.player_name}` : 'Prepara una nuova squadra'}</h3>
    <input type="hidden" name="league_id" value={leagueId} />
    {draft && <input type="hidden" name="draft_id" value={draft.id} />}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold">Nome del ragazzo
        <input name="player_name" required minLength={2} maxLength={80} defaultValue={draft?.player_name ?? ''}
          placeholder="Es. Marco" className="mt-1 block w-full rounded-lg border p-2.5" />
      </label>
      <label className="text-sm font-semibold">Nome squadra
        <input name="name" required minLength={2} maxLength={80} defaultValue={draft?.name ?? ''}
          placeholder="Es. Scuderia Marco" className="mt-1 block w-full rounded-lg border p-2.5" />
      </label>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {(['one', 'two', 'three'] as const).map((slot, index) => <label key={slot} className="text-sm font-semibold">
        Pilota {index + 1}
        <select name={`driver_${slot}_id`} required defaultValue={draft?.[`driver_${slot}_id`] ?? ''}
          className="mt-1 block w-full rounded-lg border p-2.5">
          <option value="">Seleziona</option>
          {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driverName(driver.id)}</option>)}
        </select>
      </label>)}
      <label className="text-sm font-semibold">Scuderia
        <select name="constructor_id" required defaultValue={draft?.constructor_id ?? ''}
          className="mt-1 block w-full rounded-lg border p-2.5">
          <option value="">Seleziona</option>
          {constructorRows.map((row) => <option key={row.constructor_id} value={row.constructor_id}>
            {row.display_name}</option>)}
        </select>
      </label>
    </div>
    <button className="rounded-lg bg-zinc-950 px-4 py-2.5 font-bold text-white">
      {draft ? 'Aggiorna squadra in attesa' : 'Salva squadra in attesa'}
    </button>
  </form>;
}
function LineupForm({ leagueId, race, team, lineup, driverName }: {
  leagueId: string; race: Race; team: Team; lineup?: Lineup; driverName: (id: number) => string;
}) {
  const roster = [team.driver_one_id, team.driver_two_id, team.driver_three_id];
  return <form action={saveLineup} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
    <input type="hidden" name="league_id" value={leagueId} />
    <input type="hidden" name="fantasy_team_id" value={team.id} />
    <input type="hidden" name="race_id" value={race.id} />
    {['one','two'].map((slot, index) => <label key={slot} className="text-sm font-semibold">Titolare {index + 1}
      <select name={`driver_${slot}_id`} required defaultValue={index === 0 ? lineup?.driver_one_id ?? '' : lineup?.driver_two_id ?? ''}
        className="mt-1 w-full rounded-lg border p-2.5"><option value="">Seleziona</option>
        {roster.map((id) => <option key={id} value={id}>{driverName(id)}</option>)}</select></label>)}
    <button className="self-end rounded-lg bg-red-600 px-4 py-2.5 font-bold text-white">Salva</button>
    <p className="text-xs text-zinc-500 md:col-span-3">La riserva è automaticamente il terzo pilota non schierato.
      {lineup && ` Ultimo salvataggio: ${lineup.retroactive ? 'recupero admin' : 'utente'}.`}</p>
  </form>;
}
