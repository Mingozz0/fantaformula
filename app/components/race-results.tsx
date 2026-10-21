import { ArrowRight, ChevronDown, Flag, Medal, Timer, Trophy, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { driverStatusLabel, signedPoints } from '@/lib/labels';
import { explainConstructorScore, explainDriverScore, scoreEvent,
  type DriverResult, type FantasyLineup, type ScoreBreakdown, type ScoringRules } from '@/lib/scoring';
import { RacePicker } from './race-picker';

export type ResultsRace = { id: number; round: number; name: string; race_date: string | null;
  has_sprint: boolean; gp_published: boolean; sprint_published: boolean };
type ResultsTeam = { id: string; user_id: string; name: string; constructor_id: number };
type ResultsLineup = FantasyLineup & { fantasy_team_id: string; race_id: number };
type ResultsDriver = { id: number; first_name: string; last_name: string };
type ResultsRow = DriverResult & { race_id: number };
type ConstructorResult = { race_id: number; constructor_id: number; fastest_pit_stop: boolean };

function Points({ value, large = false }: { value: number; large?: boolean }) {
  return <span className={`${large ? 'text-4xl' : 'text-xl'} font-black tabular-nums ${value < 0 ? 'text-red-600' : 'text-zinc-950'}`}>
    {new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(value)} <span className="text-xs font-medium text-zinc-500">punti</span>
  </span>;
}

function ScoreLines({ breakdown }: { breakdown: ScoreBreakdown }) {
  return <div className="space-y-2">
    {breakdown.explanation && <p className="text-xs leading-relaxed text-zinc-500">{breakdown.explanation}</p>}
    <dl className="space-y-1.5 text-xs">{breakdown.components.map((component) => <div key={component.label} className="flex items-start justify-between gap-3">
      <dt className="text-zinc-600">{component.label}</dt>
      <dd className={`shrink-0 font-bold tabular-nums ${component.points < 0 ? 'text-red-600' : component.points > 0 ? 'text-emerald-700' : 'text-zinc-400'}`}>{signedPoints(component.points)}</dd>
    </div>)}</dl>
  </div>;
}

function DriverPoints({ name, result, rules, sprint, reserveFor }: {
  name: string; result?: DriverResult; rules: ScoringRules; sprint: boolean; reserveFor?: string;
}) {
  const breakdown = explainDriverScore(result, rules, sprint);
  return <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><p className="font-bold">{name}</p>
        <p className="mt-1 text-xs text-zinc-500">{result ? driverStatusLabel(result.result_status) : 'Risultato non disponibile'}
          {result?.grid_position != null && ` · Griglia ${result.grid_position}º`}
          {result?.finish_position != null && ` · Arrivo ${result.finish_position}º`}</p>
      </div><Points value={breakdown.total} />
    </div>
    {reserveFor && <p className="mt-2 rounded-lg bg-amber-100 px-2.5 py-2 text-xs font-medium text-amber-900">Riserva subentrata al posto di {reserveFor}.</p>}
    <details className="group mt-3 border-t border-zinc-200/70 pt-3">
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-zinc-600">Dettaglio del punteggio<ChevronDown className="size-3.5 transition-transform group-open:rotate-180" /></summary>
      <div className="mt-3"><ScoreLines breakdown={breakdown} /></div>
    </details>
  </div>;
}

export function RaceResults({ race, races, leagueId, teams, drivers, constructors, profiles, lineups,
  gpResults, sprintResults, pitResults, rules }: {
  race: ResultsRace; races: ResultsRace[]; leagueId: string; teams: ResultsTeam[]; drivers: ResultsDriver[];
  constructors: { constructor_id: number; display_name: string }[]; profiles: { id: string; display_name: string }[];
  lineups: ResultsLineup[]; gpResults: ResultsRow[]; sprintResults: ResultsRow[];
  pitResults: ConstructorResult[]; rules: ScoringRules | null;
}) {
  const driverName = (id: number) => {
    const driver = drivers.find((entry) => entry.id === id);
    return driver ? `${driver.first_name} ${driver.last_name}` : `Pilota ${id}`;
  };
  const constructorName = (id: number) => constructors.find((entry) => entry.constructor_id === id)?.display_name ?? 'Scuderia non disponibile';
  const gp = race.gp_published ? gpResults.filter((result) => result.race_id === race.id) : [];
  const sprint = race.sprint_published ? sprintResults.filter((result) => result.race_id === race.id) : [];
  const pit = race.gp_published ? pitResults.find((result) => result.race_id === race.id && result.fastest_pit_stop)?.constructor_id ?? null : null;
  const winner = gp.find((result) => result.finish_position === 1 && result.result_status === 'finished');
  const fastest = gp.find((result) => result.fastest_lap);
  const events = [
    { key: 'gp', label: 'Gran Premio', published: race.gp_published, results: gp, sprint: false },
    ...(race.has_sprint ? [{ key: 'sprint', label: 'Gara Sprint', published: race.sprint_published, results: sprint, sprint: true }] : []),
  ];
  const entries = teams.map((team) => {
    const lineup = lineups.find((entry) => entry.fantasy_team_id === team.id && entry.race_id === race.id) ?? null;
    const scores = events.map((event) => event.published && rules
      ? scoreEvent(lineup, team.constructor_id, event.results, rules, event.sprint, pit) : null);
    return { team, lineup, scores, total: scores.reduce((sum, score) => sum + (score?.total ?? 0), 0) };
  }).sort((a, b) => b.total - a.total || a.team.name.localeCompare(b.team.name, 'it'));
  const published = events.some((event) => event.published);
  const date = race.race_date ? new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' })
    .format(new Date(`${race.race_date}T12:00:00Z`)) : 'Data da confermare';

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h2 className="text-2xl font-black">Il fine settimana di gara</h2><p className="mt-1 text-sm text-zinc-500">Risultati, punti e dettaglio del calcolo.</p></div>
      <RacePicker races={races} value={race.id} href={`/home?${new URLSearchParams({ league: leagueId, tab: 'results' })}`} />
    </div>
    <div className="overflow-hidden rounded-2xl bg-zinc-950 text-white">
      <div className="border-l-4 border-red-600 p-6 sm:p-8">
        <div className="mb-3 flex flex-wrap gap-2"><Badge className="bg-white/10 text-zinc-200">Tappa {race.round.toString().padStart(2, '0')}</Badge>
          {events.map((event) => <Badge key={event.key} variant="outline" className={event.published ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 text-zinc-400'}>{event.label} {event.published ? 'pubblicato' : 'in attesa'}</Badge>)}
        </div>
        <h3 className="text-3xl font-black sm:text-4xl">Gran Premio · {race.name}</h3><p className="mt-2 text-sm text-zinc-400">{date}</p>
        {race.gp_published && <div className="mt-7 grid gap-5 border-t border-zinc-800 pt-5 sm:grid-cols-3">
          {[{ icon: Trophy, label: 'Vincitore', value: winner ? driverName(winner.driver_id) : 'Da verificare' },
            { icon: Timer, label: 'Giro veloce', value: fastest ? driverName(fastest.driver_id) : 'Non assegnato' },
            { icon: Wrench, label: 'Migliore sosta ai box', value: pit ? constructorName(pit) : 'Non assegnata' }].map(({ icon: Icon, label, value }) =>
            <div key={label}><p className="flex items-center gap-2 text-xs font-medium text-zinc-400"><Icon className="size-3.5 text-red-400" />{label}</p><p className="mt-1.5 text-sm font-bold">{value}</p></div>)}
        </div>}
      </div>
    </div>
    {!published && <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">I risultati di questa tappa non sono ancora pubblicati. I punti compariranno dopo la pubblicazione.</div>}
    {published && <Tabs defaultValue="league" key={race.id} className="gap-6">
      <TabsList className="grid h-14! w-full max-w-lg grid-cols-2 items-stretch rounded-xl bg-zinc-200/60 p-1">
        <TabsTrigger value="league" className="h-full! min-w-0 gap-1.5 whitespace-normal rounded-lg px-2 text-xs leading-tight sm:gap-2 sm:px-4 sm:text-sm"><Trophy className="size-4 shrink-0" />Punti della lega</TabsTrigger>
        <TabsTrigger value="drivers" className="h-full! min-w-0 gap-1.5 whitespace-normal rounded-lg px-2 text-xs leading-tight sm:gap-2 sm:px-4 sm:text-sm"><Flag className="size-4 shrink-0" />Punti dei piloti</TabsTrigger>
      </TabsList>
      <TabsContent value="league" className="space-y-5">
        {!rules && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Regolamento non disponibile: impossibile calcolare i punteggi.</p>}
        <div className="grid items-start gap-5 xl:grid-cols-2">{rules && entries.map((entry) => <details key={entry.team.id} className="group/team overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs">
          <summary className="flex h-40 cursor-pointer list-none flex-col justify-between gap-3 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
            <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3">
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl text-sm font-black ${entry.total === entries[0]?.total ? 'bg-amber-100 text-amber-800' : 'bg-zinc-100 text-zinc-500'}`}>
                {1 + entries.filter((other) => other.total > entry.total).length}º</span>
              <div className="min-w-0"><h4 className="truncate font-black">{entry.team.name}</h4><p className="mt-0.5 truncate text-xs text-zinc-500">{profiles.find((profile) => profile.id === entry.team.user_id)?.display_name ?? 'Partecipante'}</p></div>
            </div><span className="shrink-0"><Points value={entry.total} /></span></div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">{events.map((event, index) => <span key={event.key}>{event.sprint ? 'Sprint' : 'GP'}: <strong className="text-zinc-800">{entry.scores[index] ? `${entry.scores[index]!.total} pt` : 'In attesa'}</strong></span>)}</div>
            <span className="flex items-center justify-between text-xs font-semibold text-red-700"><span><span className="group-open/team:hidden">Mostra dettagli</span><span className="hidden group-open/team:inline">Chiudi dettagli</span></span><ChevronDown className="size-4 transition-transform group-open/team:rotate-180" /></span>
          </summary>
          <div className="space-y-5 border-t border-zinc-100 p-4 sm:p-5">{events.map((event, index) => {
            const score = entry.scores[index];
            const replaced = entry.lineup && score?.reserveUsed
              ? [entry.lineup.driver_one_id, entry.lineup.driver_two_id].find((id) => !score.driverIds.includes(id)) : undefined;
            return <section key={event.key} className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-500"><h5>{event.label}</h5><span>{score ? `${score.total} punti` : 'In attesa'}</span></div>
              {!event.published ? <p className="text-xs text-zinc-500">Risultati non ancora pubblicati.</p> : !entry.lineup ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Formazione non inserita per questa gara: 0 punti.</p> : score && <>
                {score.driverIds.map((id) => <DriverPoints key={id} name={driverName(id)} result={event.results.find((result) => result.driver_id === id)} rules={rules} sprint={event.sprint}
                  reserveFor={score.reserveUsed && id === entry.lineup?.reserve_driver_id && replaced !== undefined ? driverName(replaced) : undefined} />)}
                <div className="rounded-xl border border-red-100 bg-red-50/50 p-4"><div className="mb-3 flex items-center justify-between gap-3"><p className="text-sm font-bold">{constructorName(entry.team.constructor_id)}<span className="ml-2 text-xs font-normal text-zinc-500">Scuderia</span></p><Points value={score.constructorScore} /></div>
                  <ScoreLines breakdown={explainConstructorScore(entry.team.constructor_id, event.results, rules, event.sprint, pit)} />
                </div>
              </>}
            </section>;
          })}</div>
        </details>)}</div>
        {!teams.length && <p className="text-sm text-zinc-500">Nessuna squadra assegnata nella lega.</p>}
      </TabsContent>
      <TabsContent value="drivers" className="space-y-8">{events.filter((event) => event.published).map((event) => <section key={event.key} className="space-y-4">
        <h3 className="text-lg font-black">{event.label} · Ordine di arrivo</h3>
        <div className="grid auto-rows-fr gap-3 md:grid-cols-2">{event.results.toSorted((a, b) => (a.finish_position ?? Infinity) - (b.finish_position ?? Infinity) || driverName(a.driver_id).localeCompare(driverName(b.driver_id), 'it')).map((result) =>
          <Card key={result.driver_id} className="h-full gap-0 rounded-2xl py-0 shadow-none"><CardContent className="flex h-full flex-col p-4">
            <div className="flex items-start gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-xl text-sm font-black ${result.finish_position !== null && result.finish_position <= 3 ? 'bg-amber-100 text-amber-800' : 'bg-zinc-100 text-zinc-500'}`}>{result.finish_position ? `${result.finish_position}º` : '—'}</span>
              <div className="min-w-0 flex-1"><h4 className="font-bold">{driverName(result.driver_id)}</h4><p className="mt-0.5 text-xs text-zinc-500">{result.constructor_id ? constructorName(result.constructor_id) : 'Scuderia non disponibile'}</p></div>
              {rules && <Points value={explainDriverScore(result, rules, event.sprint).total} />}
            </div>
            <div className="my-4 flex flex-wrap items-center gap-2"><Badge variant="outline" className={result.result_status === 'finished' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}>{driverStatusLabel(result.result_status)}</Badge>
              {result.fastest_lap && <Badge className="gap-1 bg-violet-100 text-violet-700"><Timer className="size-3" />Giro veloce</Badge>}
              {!event.sprint && result.driver_of_the_day && <Badge className="gap-1 bg-sky-100 text-sky-700"><Medal className="size-3" />Pilota del giorno</Badge>}
            </div>
            <p className="mb-3 flex items-center gap-2 text-xs text-zinc-500">Griglia: {result.grid_position ? `${result.grid_position}º` : 'Non disponibile'}<ArrowRight className="size-3" />Arrivo: {result.finish_position ? `${result.finish_position}º` : driverStatusLabel(result.result_status)}</p>
            {rules && <details className="group border-t border-zinc-100 pt-3"><summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-zinc-600">Come si ottengono i punti<ChevronDown className="size-3.5 transition-transform group-open:rotate-180" /></summary><div className="mt-3"><ScoreLines breakdown={explainDriverScore(result, rules, event.sprint)} /></div></details>}
          </CardContent></Card>)}</div>
      </section>)}</TabsContent>
    </Tabs>}
  </div>;
}
