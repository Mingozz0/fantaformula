import { NavigationLink as Link, SubmitButton } from '@/app/components/action-feedback';
import { FormSelect } from '@/app/components/form-select';
import { RaceResults } from '@/app/components/race-results';
import { RacePicker } from '@/app/components/race-picker';
import { PortalShell } from '@/app/components/portal-shell';
import { LineupSelection } from '@/app/components/lineup-selection';
import { LeagueEntrance } from '@/app/components/league-entrance';
import { leagueStatusLabel } from '@/lib/labels';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { scoreEvent, type DriverResult, type FantasyLineup, type ScoringRules } from '@/lib/scoring';
import { activateLeague, assignTeamDraft, createLeague, deleteTeamDraft, joinLeague,
  saveLineup, saveTeam, saveTeamDraft } from './actions';

type League = { id: string; name: string; season_id: number; status: string; invite_code: string };
type Membership = { league_id: string; role: string; leagues: League };
type Member = { user_id: string; role: string };
type Profile = { id: string; display_name: string };
type Team = { id: string; league_id: string; user_id: string; name: string; constructor_id: number;
  driver_one_id: number; driver_two_id: number; driver_three_id: number };
type TeamDraft = { id: string; league_id: string; player_name: string; name: string; constructor_id: number;
  driver_one_id: number; driver_two_id: number; driver_three_id: number };
type Driver = { id: number; first_name: string; last_name: string };
type SeasonDriver = { driver_id: number; drivers: Driver };
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
  const sidebarOpen = (await cookies()).get('sidebar_state')?.value !== 'false';
  const [{ data: membershipsData, error: membershipsError }, { data: managerData }] = await Promise.all([
    supabase.from('league_members').select('league_id,role,leagues!inner(id,name,season_id,status,invite_code)').eq('user_id', userId),
    supabase.from('game_managers').select('user_id').eq('user_id', userId).maybeSingle(),
  ]);
  if (membershipsError) throw new Error('Impossibile caricare le leghe. Riprova tra poco.');
  const memberships = (membershipsData ?? []) as unknown as Membership[];
  const leagues = memberships.map((membership) => membership.leagues);
  const selected = leagues.find((league) => league.id === params.league);
  const tab = ['overview', 'team', 'lineup', 'standings', 'results', 'manage'].includes(params.tab ?? '')
    ? params.tab! : 'overview';
  if (!selected) {
    const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle();
    return <PortalShell defaultOpen={sidebarOpen} name={profile?.display_name ?? 'Il tuo account'} leagues={leagues} activeTab="home" isAdmin={false} isManager={Boolean(managerData)}>
      {params.message && <p role="status" className="rounded-xl bg-amber-100 p-3 text-sm text-amber-950">{params.message}</p>}
      <LeagueEntrance leagues={memberships.map((membership) => ({ ...membership.leagues, role: membership.role }))}><LeagueForms /></LeagueEntrance>
    </PortalShell>;
  }

  const isAdmin = memberships.some((membership) =>
    membership.league_id === selected.id && membership.role === 'admin');
  const needsScores = ['overview', 'standings', 'results'].includes(tab);
  const needsDrivers = ['team', 'lineup', 'results', 'manage'].includes(tab);
  const needsConstructors = ['team', 'results', 'manage'].includes(tab);
  const needsRaces = needsScores || tab === 'lineup';
  const emptyRows = { data: [] };
  const [{ data: membersData }, { data: teamsData }, { data: seasonDriversData },
    { data: constructorsData }, { data: racesData }, { data: rulesData },
    { data: lineupsData }, { data: gpData }, { data: sprintData }, { data: pitData },
    { data: draftsData }] = await Promise.all([
    supabase.from('league_members').select('user_id,role').eq('league_id', selected.id),
    supabase.from('fantasy_teams').select('*').eq('league_id', selected.id),
    needsDrivers ? supabase.from('season_drivers').select('driver_id,drivers!inner(id,first_name,last_name)')
      .eq('season_id', selected.season_id) : emptyRows,
    needsConstructors ? supabase.from('season_constructors').select('constructor_id,display_name')
      .eq('season_id', selected.season_id) : emptyRows,
    needsRaces ? supabase.from('races').select('id,round,name,race_date,lineup_deadline_at,has_sprint,gp_published,sprint_published')
      .eq('season_id', selected.season_id).order('round') : emptyRows,
    needsScores ? supabase.from('season_scoring_rules').select('*').eq('season_id', selected.season_id).maybeSingle() : { data: null },
    needsScores || tab === 'lineup' ? supabase.from('lineups').select('*').eq('league_id', selected.id) : emptyRows,
    needsScores ? supabase.from('race_driver_results').select('*').eq('season_id', selected.season_id) : emptyRows,
    needsScores ? supabase.from('sprint_driver_results').select('*').eq('season_id', selected.season_id) : emptyRows,
    needsScores ? supabase.from('race_constructor_results').select('*').eq('season_id', selected.season_id) : emptyRows,
    isAdmin && tab === 'manage' ? supabase.from('team_drafts').select('*').eq('league_id', selected.id).order('created_at') : emptyRows,
  ]);
  const members = (membersData ?? []) as Member[];
  const teams = (teamsData ?? []) as Team[];
  const constructorRows = constructorsData ?? [];
  const races = (racesData ?? []) as Race[];
  const { data: profilesData } = members.length
    ? await supabase.from('profiles').select('id,display_name').in('id', members.map((m) => m.user_id)) : emptyRows;
  const profiles = (profilesData ?? []) as Profile[];
  const drivers = ((seasonDriversData ?? []) as unknown as SeasonDriver[]).map((row) => row.drivers);
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
    ?? `Scuderia ${id}`;
  const ownerName = (id: string) => profiles.find((item) => item.id === id)?.display_name ?? 'Partecipante';
  const now = await currentTime();
  const nextRace = races.find((race) => race.lineup_deadline_at && Date.parse(race.lineup_deadline_at) > now);
  const raceForLineup = races.find((race) => race.id === Number(params.race)) ?? nextRace ?? races.at(-1);
  const raceForResults = races.find((race) => race.id === Number(params.race))
    ?? races.filter((race) => race.gp_published || race.sprint_published).at(-1) ?? races[0];
  const scoreFor = (team: Team, race: Race) => {
    const lineup = lineups.find((item) => item.fantasy_team_id === team.id && item.race_id === race.id) ?? null;
    const gp = race.gp_published && rules ? scoreEvent(lineup, team.constructor_id,
      gpResults.filter((item) => item.race_id === race.id), rules, false,
      pitResults.find((item) => item.race_id === race.id && item.fastest_pit_stop)?.constructor_id ?? null) : null;
    const sprint = race.sprint_published && rules ? scoreEvent(lineup, team.constructor_id,
      sprintResults.filter((item) => item.race_id === race.id), rules, true) : null;
    return { lineup, gp, sprint, total: (gp?.total ?? 0) + (sprint?.total ?? 0) };
  };
  const standings = (tab === 'overview' || tab === 'standings' ? teams : []).map((team) => ({ team,
    points: races.reduce((sum, race) => sum + scoreFor(team, race).total, 0),
  })).sort((a, b) => b.points - a.points || a.team.name.localeCompare(b.team.name));
  const provisional = tab === 'standings' && races.some((race) => (race.gp_published || race.sprint_published)
    && ((race.has_sprint && !race.sprint_published) || !race.gp_published
      || teams.some((team) => !lineups.some((lineup) => lineup.fantasy_team_id === team.id && lineup.race_id === race.id))));

  return <PortalShell defaultOpen={sidebarOpen} name={ownerName(userId)} leagues={leagues} selectedLeagueId={selected.id}
    activeTab={tab} isAdmin={isAdmin} isManager={Boolean(managerData)}>
        <section className="min-w-0 space-y-6">
          {params.message && <p role="status" className="rounded-xl bg-amber-100 p-3 text-sm font-medium text-amber-950">{params.message}</p>}
          <div><p className="text-xs font-bold uppercase tracking-widest text-red-600">Stagione 2026 · {leagueStatusLabel(selected.status)}</p>
            <h1 className="mt-1 break-words text-3xl font-black sm:text-4xl">{selected.name}</h1>
            <p className="mt-2 text-sm text-zinc-500 sm:text-base">{members.length} di 7 partecipanti · {isAdmin ? 'Amministratore' : 'Partecipante'}</p></div>

          {tab === 'overview' && <>
            {isAdmin && <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <h2 className="text-lg font-black">Gestisci le squadre della lega</h2>
              <p className="mt-1 text-sm text-zinc-700">Prepara le rose per i partecipanti e assegnale quando entrano nella lega.</p>
              <Link href={url(selected.id, 'manage')}
                className="mt-4 inline-block rounded-lg bg-red-600 px-4 py-2.5 font-bold text-white">Apri gestione squadre</Link>
            </div>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Metric label="La tua squadra" value={myTeam?.name ?? 'Da assegnare'} className="col-span-2 sm:col-span-1" />
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
          </>}

          {tab === 'team' && <Card title={myTeam?.name ?? 'Squadra in attesa'}>
            {myTeam ? <><p className="text-sm text-zinc-500">Assegnata dall’amministratore della lega.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">{[myTeam.driver_one_id,myTeam.driver_two_id,myTeam.driver_three_id]
                .map((id) => <div key={id} className="rounded-xl bg-zinc-100 p-4 font-bold">{driverName(id)}</div>)}</div>
              <p className="mt-5 font-bold">Scuderia: {constructorName(myTeam.constructor_id)}</p></>
              : <p>L’amministratore non ha ancora assegnato la tua squadra.</p>}
          </Card>}

          {tab === 'lineup' && <>
            {raceForLineup && <RacePicker races={races} value={raceForLineup.id} href={url(selected.id, 'lineup')} />}
            {raceForLineup && <Card title={`${raceForLineup.name} · ${dateLabel(raceForLineup.race_date)}`}>
              <p className="mb-5 text-sm text-zinc-500">Scadenza {deadlineLabel(raceForLineup.lineup_deadline_at)}. Scegli due titolari; il terzo è la riserva.</p>
              {selected.status !== 'active' && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Attendi l’attivazione della lega.</p>}
              {selected.status === 'active' && myTeam && (!raceForLineup.lineup_deadline_at || now < Date.parse(raceForLineup.lineup_deadline_at)) &&
                <LineupForm leagueId={selected.id} race={raceForLineup} team={myTeam}
                  lineup={lineups.find((item) => item.fantasy_team_id === myTeam.id && item.race_id === raceForLineup.id)}
                  driverName={driverName} />}
              {raceForLineup.lineup_deadline_at && now >= Date.parse(raceForLineup.lineup_deadline_at) &&
                <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">La scadenza è passata. Solo l’amministratore può recuperare questa formazione.</p>}
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
              <div key={entry.team.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 py-4 sm:gap-3">
                <span className="font-black text-zinc-400">{1 + standings.filter((other) => other.points > entry.points).length}°</span>
                <div className="min-w-0 break-words"><p className="font-bold">{entry.team.name}</p><p className="text-sm text-zinc-500">{ownerName(entry.team.user_id)}</p></div>
                <strong>{entry.points} pt</strong>
              </div>)}</div>
            {!standings.length && <p className="text-zinc-500">Le squadre non sono ancora state assegnate.</p>}
            <p className="mt-4 text-xs text-zinc-500">Contano solo i risultati pubblicati. Le formazioni mancanti valgono zero punti.</p>
          </Card>}

          {tab === 'results' && (raceForResults ? <RaceResults race={raceForResults} races={races} leagueId={selected.id}
            teams={teams} drivers={drivers} constructors={constructorRows} profiles={profiles} lineups={lineups}
            gpResults={gpResults} sprintResults={sprintResults} pitResults={pitResults} rules={rules} />
            : <Card title="Risultati"><p>Il calendario non è ancora disponibile.</p></Card>)}

          {tab === 'manage' && isAdmin && <>
            <div>
              <h2 className="text-2xl font-black">Gestione squadre</h2>
              <p className="mt-1 text-sm text-zinc-600">{teams.length} squadre assegnate · {drafts.length} da assegnare · {members.length} partecipanti nella lega</p>
            </div>
            <Card title="Prepara una squadra">
              <p className="mb-5 text-sm text-zinc-600">Inserisci il nome del partecipante e scegli la rosa. Puoi farlo anche prima che entri nella lega.</p>
              <TeamDraftForm leagueId={selected.id} drivers={drivers} constructorRows={constructorRows}
                driverName={driverName} />
            </Card>
            <Card title={`Squadre da assegnare (${drafts.length})`}>
              {!drafts.length && <p className="text-sm text-zinc-600">Non hai ancora preparato altre squadre.</p>}
              <div className="space-y-5">{drafts.map((draft) => <div key={draft.id} className="rounded-xl border border-zinc-200 p-4">
                <h3 className="font-bold">{draft.name} <span className="font-normal text-zinc-500">· {draft.player_name}</span></h3>
                <p className="mt-1 text-sm text-zinc-600">{driverName(draft.driver_one_id)}, {driverName(draft.driver_two_id)}, {driverName(draft.driver_three_id)} · {constructorName(draft.constructor_id)}</p>
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <form action={assignTeamDraft} className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="league_id" value={selected.id} />
                    <input type="hidden" name="draft_id" value={draft.id} />
                    <FormSelect name="user_id" label="Assegna a" required disabled={!membersWithoutTeam.length}
                      placeholder="Seleziona partecipante" options={membersWithoutTeam.map((member) => ({ value: member.user_id, label: ownerName(member.user_id) }))} />
                    <SubmitButton pendingLabel="Assegnazione…" disabled={!membersWithoutTeam.length} className="rounded-lg bg-red-600 px-4 py-2.5 font-bold text-white">Assegna</SubmitButton>
                  </form>
                  <form action={deleteTeamDraft}>
                    <input type="hidden" name="league_id" value={selected.id} />
                    <input type="hidden" name="draft_id" value={draft.id} />
                    <SubmitButton pendingLabel="Eliminazione…" className="rounded-lg border border-zinc-300 px-4 py-2.5 font-bold">Elimina</SubmitButton>
                  </form>
                </div>
                {!membersWithoutTeam.length && <p className="mt-3 text-sm text-zinc-500">Per assegnarla, il partecipante deve entrare nella lega con il codice invito.</p>}
                <details className="mt-4 border-t border-zinc-200 pt-4">
                  <summary className="cursor-pointer text-sm font-semibold text-red-700">Modifica squadra</summary>
                  <div className="mt-4"><TeamDraftForm leagueId={selected.id} draft={draft} drivers={drivers}
                    constructorRows={constructorRows} driverName={driverName} /></div>
                </details>
              </div>)}</div>
            </Card>
            <Card title={`Partecipanti nella lega (${members.length})`}>
              <div className="space-y-4">{members.map((member) => {
                const team = teams.find((item) => item.user_id === member.user_id);
                return <details key={member.user_id} open={!team} className="rounded-xl border border-zinc-200 p-4">
                  <summary className="cursor-pointer font-bold">{ownerName(member.user_id)}
                    <span className="ml-2 text-sm font-normal text-zinc-500">{team ? team.name : 'Squadra da assegnare'}</span>
                  </summary>
                  <form action={saveTeam} className="mt-4 space-y-3">
                    <input type="hidden" name="league_id" value={selected.id} /><input type="hidden" name="user_id" value={member.user_id} />
                    <input name="name" required minLength={2} defaultValue={team?.name ?? ''} placeholder="Nome squadra" className="w-full rounded-lg border p-2" />
                    <div className="grid gap-3 md:grid-cols-4">
                      {(['one','two','three'] as const).map((slot, index) => <FormSelect required key={slot} name={`driver_${slot}_id`}
                        label={`Pilota ${index + 1}`} defaultValue={team?.[`driver_${slot}_id`]}
                        options={drivers.map((driver) => ({ value: driver.id, label: driverName(driver.id) }))} />)}
                      <FormSelect required name="constructor_id" label="Scuderia" defaultValue={team?.constructor_id}
                        options={constructorRows.map((row) => ({ value: row.constructor_id, label: constructorName(row.constructor_id) }))} />
                    </div><SubmitButton className="rounded-lg bg-zinc-950 px-4 py-2 font-bold text-white">{team ? 'Aggiorna squadra' : 'Crea squadra'}</SubmitButton>
                  </form>
                </details>;
              })}</div>
            </Card>
            <Card title="Inviti e attivazione"><p>Codice invito: <strong className="font-mono text-lg">{selected.invite_code}</strong></p>
              <p className="mt-2 text-sm text-zinc-500">La lega si attiva con 4–7 membri, ciascuno con una squadra completa.</p>
              {selected.status === 'recruiting' && <form action={activateLeague} className="mt-4">
                <input type="hidden" name="league_id" value={selected.id} />
                <SubmitButton pendingLabel="Attivazione…" className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white">Attiva lega</SubmitButton></form>}
            </Card>
          </>}
        </section>
  </PortalShell>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6"><h2 className="mb-4 text-lg font-black sm:text-xl">{title}</h2>{children}</div>;
}
function Metric({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return <div className={`min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 ${className}`}><p className="text-xs text-zinc-500 sm:text-sm">{label}</p>
    <p className="mt-2 break-words text-xl font-black sm:text-2xl">{value}</p></div>;
}
function LeagueForms() {
  return <div className="mt-5 grid gap-5 sm:grid-cols-2">
    <form action={createLeague} className="space-y-3"><h3 className="font-bold">Crea una lega</h3>
      <input name="name" required minLength={3} maxLength={100} placeholder="Nome della lega" className="w-full rounded-lg border p-3" />
      <SubmitButton pendingLabel="Creazione…" className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white">Crea lega 2026</SubmitButton></form>
    <form action={joinLeague} className="space-y-3"><h3 className="font-bold">Entra in una lega</h3>
      <input name="code" required placeholder="Codice invito" className="w-full rounded-lg border p-3" />
      <SubmitButton pendingLabel="Ingresso…" className="rounded-lg bg-zinc-950 px-4 py-2 font-bold text-white">Entra</SubmitButton></form>
  </div>;
}
function TeamDraftForm({ leagueId, draft, drivers, constructorRows, driverName }: {
  leagueId: string; draft?: TeamDraft; drivers: Driver[];
  constructorRows: { constructor_id: number; display_name: string }[];
  driverName: (id: number) => string;
}) {
  return <form action={saveTeamDraft} className="space-y-3">
    {draft && <h3 className="font-bold">{draft.player_name}</h3>}
    <input type="hidden" name="league_id" value={leagueId} />
    {draft && <input type="hidden" name="draft_id" value={draft.id} />}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold">Nome del partecipante
        <input name="player_name" required minLength={2} maxLength={80} defaultValue={draft?.player_name ?? ''}
          placeholder="Es. Marco" className="mt-1 block w-full rounded-lg border p-2.5" />
      </label>
      <label className="text-sm font-semibold">Nome squadra
        <input name="name" required minLength={2} maxLength={80} defaultValue={draft?.name ?? ''}
          placeholder="Es. Scuderia Marco" className="mt-1 block w-full rounded-lg border p-2.5" />
      </label>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {(['one', 'two', 'three'] as const).map((slot, index) => <FormSelect key={slot} label={`Pilota ${index + 1}`}
        name={`driver_${slot}_id`} required defaultValue={draft?.[`driver_${slot}_id`]}
        options={drivers.map((driver) => ({ value: driver.id, label: driverName(driver.id) }))} />)}
      <FormSelect label="Scuderia" name="constructor_id" required defaultValue={draft?.constructor_id}
        options={constructorRows.map((row) => ({ value: row.constructor_id, label: row.display_name }))} />
    </div>
    <SubmitButton className="rounded-lg bg-zinc-950 px-4 py-2.5 font-bold text-white">
      {draft ? 'Salva modifiche' : 'Prepara squadra'}
    </SubmitButton>
  </form>;
}
function LineupForm({ leagueId, race, team, lineup, driverName }: {
  leagueId: string; race: Race; team: Team; lineup?: Lineup; driverName: (id: number) => string;
}) {
  const roster = [team.driver_one_id, team.driver_two_id, team.driver_three_id];
  return <form key={`${race.id}-${team.id}`} action={saveLineup} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
    <input type="hidden" name="league_id" value={leagueId} />
    <input type="hidden" name="fantasy_team_id" value={team.id} />
    <input type="hidden" name="race_id" value={race.id} />
    <LineupSelection key={`${race.id}-${team.id}-${lineup?.driver_one_id}-${lineup?.driver_two_id}`}
      initialOne={lineup?.driver_one_id} initialTwo={lineup?.driver_two_id}
      options={roster.map((id) => ({ value: id, label: driverName(id) }))} />
    {lineup && <p className="text-xs text-zinc-500 md:col-span-3">Ultimo salvataggio: {lineup.retroactive ? 'recupero dell’amministratore' : 'partecipante'}.</p>}
  </form>;
}
