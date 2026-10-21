import type { ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight, Flag, Trophy, Users, Zap } from 'lucide-react';
import { NavigationLink } from './action-feedback';
import type { TeamStats } from '@/lib/league-stats';

const colors = ['#e7000b', '#2563eb', '#059669', '#9333ea', '#d97706', '#0891b2', '#db2777'];
function number(value: number) { return new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(value); }
function teamUrl(leagueId: string, id: string) { return `/home?${new URLSearchParams({ league: leagueId, tab: 'team', team: id })}`; }

function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs sm:p-6">
    <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-lg font-black">{title}</h2>{action}</div>{children}
  </section>;
}
function Stat({ label, value, detail, icon }: { label: string; value: string; detail?: string; icon?: ReactNode }) {
  return <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
    <p className="flex items-center gap-2 text-xs font-medium text-zinc-500">{icon}{label}</p>
    <p className="mt-3 break-words text-2xl font-black tabular-nums">{value}</p>
    {detail && <p className="mt-1 break-words text-xs text-zinc-500">{detail}</p>}
  </div>;
}

function PointsChart({ entries }: { entries: TeamStats[] }) {
  const rows = entries[0]?.races ?? [];
  if (!rows.length) return <p className="py-8 text-center text-sm text-zinc-400">Nessuna gara pubblicata</p>;
  const values = entries.flatMap((entry) => [0, ...entry.races.map((row) => row.cumulative)]);
  const min = Math.min(0, ...values), max = Math.max(1, ...values), range = max - min;
  const x = (index: number) => 48 + index * (560 / rows.length);
  const y = (value: number) => 180 - (value - min) / range * 150;
  return <svg viewBox="0 0 640 220" role="img" aria-label="Punti cumulativi per tappa" className="h-auto w-full overflow-visible">
    <title>Punti cumulativi per tappa</title>
    {[min, min + range / 2, max].map((value) => <g key={value}><line x1="48" x2="608" y1={y(value)} y2={y(value)} stroke="#e4e4e7" strokeDasharray="3 5" /><text x="38" y={y(value) + 4} textAnchor="end" fontSize="11" fill="#71717a">{number(value)}</text></g>)}
    {entries.map((entry, series) => <g key={entry.team.id}>
      <polyline fill="none" stroke={colors[series % colors.length]} strokeWidth="3" strokeLinejoin="round" points={[`${x(0)},${y(0)}`, ...entry.races.map((row, index) => `${x(index + 1)},${y(row.cumulative)}`)].join(' ')} />
      {entry.races.map((row, index) => <circle key={row.race.id} cx={x(index + 1)} cy={y(row.cumulative)} r="4" fill={colors[series % colors.length]}><title>{`${entry.team.name} · ${row.race.name}: ${number(row.cumulative)} punti`}</title></circle>)}
    </g>)}
    {rows.filter((_, index) => rows.length <= 8 || index % Math.ceil(rows.length / 7) === 0 || index === rows.length - 1).map((row) => <text key={row.race.id} x={x(rows.indexOf(row) + 1)} y="208" textAnchor="middle" fontSize="11" fill="#71717a">GP {row.race.round}</text>)}
  </svg>;
}

export function LeagueDashboard({ entries, leagueId }: { entries: TeamStats[]; leagueId: string }) {
  const leader = entries[0];
  const leaders = entries.filter((entry) => entry.points === leader?.points);
  const records = entries.flatMap((entry) => entry.best ? [{ entry, row: entry.best }] : []).sort((a, b) => b.row.total - a.row.total);
  const record = records[0];
  const wins = Math.max(0, ...entries.map((entry) => entry.wins));
  const winners = entries.filter((entry) => entry.wins === wins);
  const latest = leader?.races.at(-1)?.race;
  const latestOrder = latest ? entries.map((entry) => ({ entry, row: entry.races.find((row) => row.race.id === latest.id)! })).sort((a, b) => b.row.total - a.row.total) : [];
  const played = leader?.races.length ?? 0;
  return <div className="space-y-5">
    <h2 className="text-xl font-black">Dashboard lega</h2>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label={leaders.length > 1 ? 'In testa a pari punti' : 'In testa'} value={played && leader ? `${number(leader.points)} pt` : '—'} detail={played ? leaders.map((entry) => entry.team.name).join(' · ') : undefined} icon={<Trophy className="size-3.5" />} />
      <Stat label="Record tappa" value={record ? `${number(record.row.total)} pt` : '—'} detail={record ? `${record.entry.team.name} · ${record.row.race.name}` : undefined} icon={<Zap className="size-3.5" />} />
      <Stat label="Più tappe vinte" value={wins ? String(wins) : '—'} detail={wins ? winners.map((entry) => entry.team.name).join(' · ') : undefined} icon={<Flag className="size-3.5" />} />
      <Stat label="Tappe a punteggio" value={String(played)} detail={`${entries.length} squadre`} icon={<Users className="size-3.5" />} />
    </div>
    <Panel title="Corsa al titolo"><PointsChart entries={entries} />
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3">{entries.map((entry, index) => <NavigationLink key={entry.team.id} href={teamUrl(leagueId, entry.team.id)} className="min-w-0 text-xs font-semibold hover:text-red-600"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />{entry.team.name}</NavigationLink>)}</div>
    </Panel>
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Punti totali" action={<NavigationLink href={`/home?league=${leagueId}&tab=standings`} className="text-xs font-bold text-red-600">Classifica<ArrowUpRight className="size-3.5" /></NavigationLink>}>
        <div className="space-y-4">{entries.map((entry, index) => <div key={entry.team.id}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><NavigationLink href={teamUrl(leagueId, entry.team.id)} className="min-w-0 break-words font-semibold hover:text-red-600">{entry.team.name}</NavigationLink><span className="shrink-0 font-black tabular-nums">{number(entry.points)} pt</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full" style={{ width: `${Math.abs(entry.points) / Math.max(1, ...entries.map((entry) => Math.abs(entry.points))) * 100}%`, backgroundColor: colors[index % colors.length] }} /></div>
        </div>)}</div>
        {!entries.length && <p className="text-sm text-zinc-400">Nessuna squadra</p>}
      </Panel>
      <Panel title={latest ? `Ultima tappa · ${latest.name}` : 'Ultima tappa'}>
        <div className="divide-y divide-zinc-100">{latestOrder.map(({ entry, row }) => <div key={entry.team.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
          <NavigationLink href={teamUrl(leagueId, entry.team.id)} className="min-w-0 break-words text-sm font-semibold hover:text-red-600">{entry.team.name}</NavigationLink>
          <span className="shrink-0 text-sm font-black tabular-nums">{number(row.total)} pt</span>
        </div>)}</div>
        {!latest && <p className="text-sm text-zinc-400">Nessuna gara pubblicata</p>}
      </Panel>
    </div>
  </div>;
}

export function TeamDashboard({ entry, leagueId, owner, roster, constructor, leaderPoints }: {
  entry: TeamStats; leagueId: string; owner: string; roster: string[]; constructor: string; leaderPoints: number;
}) {
  const played = entry.races.length;
  return <div className="space-y-5">
    <NavigationLink href={`/home?league=${leagueId}&tab=standings`} className="text-sm font-semibold text-zinc-500 hover:text-red-600"><ArrowLeft className="size-4" />Classifica</NavigationLink>
    <div className="rounded-2xl bg-zinc-950 p-5 text-white sm:p-7"><p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">{owner}</p><h2 className="mt-2 break-words text-3xl font-black">{entry.team.name}</h2>
      <div className="mt-5 flex flex-wrap items-end gap-6"><p className="text-4xl font-black tabular-nums">{number(entry.points)} <span className="text-sm font-medium text-zinc-400">punti</span></p>
        <p className="pb-1 text-sm font-semibold text-zinc-300">{entry.rank}º in classifica{entry.rank > 1 ? ` · ${number(leaderPoints - entry.points)} pt dalla vetta` : ''}</p></div>
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Media per tappa" value={played ? `${number(entry.average)} pt` : '—'} />
      <Stat label="Miglior tappa" value={entry.best ? `${number(entry.best.total)} pt` : '—'} detail={entry.best?.race.name} />
      <Stat label="Tappe vinte" value={String(entry.wins)} />
      <Stat label="Tappe con formazione" value={`${played - entry.missingLineups}/${played}`} />
    </div>
    <Panel title="Rosa"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{roster.map((name, index) => <div key={index} className="rounded-xl bg-zinc-50 p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Pilota {index + 1}</p><p className="mt-2 text-sm font-bold">{name}</p></div>)}
      <div className="rounded-xl border border-red-100 bg-red-50/50 p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-red-500">Scuderia</p><p className="mt-2 text-sm font-bold">{constructor}</p></div></div></Panel>
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      <Panel title="Andamento punti"><PointsChart entries={[entry]} /></Panel>
      <Panel title="Punti in dettaglio"><dl className="divide-y divide-zinc-100">{[
        ['Gran Premi', `${number(entry.gpPoints)} pt`], ['Sprint', `${number(entry.sprintPoints)} pt`],
        ['Piloti', `${number(entry.driverPoints)} pt`], ['Scuderia', `${number(entry.constructorPoints)} pt`], ['Riserve subentrate', String(entry.reserveUses)],
      ].map(([label, value]) => <div key={label} className="flex justify-between gap-3 py-3 first:pt-0"><dt className="text-sm text-zinc-500">{label}</dt><dd className="text-sm font-bold tabular-nums">{value}</dd></div>)}</dl></Panel>
    </div>
    <Panel title="Gara per gara"><div className="divide-y divide-zinc-100">{entry.races.toReversed().map((row) => <div key={row.race.id} className="flex items-center justify-between gap-3 py-4 first:pt-0">
      <div className="min-w-0"><NavigationLink href={`/home?league=${leagueId}&tab=results&race=${row.race.id}`} className="text-sm font-bold hover:text-red-600">{row.race.round}. {row.race.name}<ArrowUpRight className="size-3.5 shrink-0" /></NavigationLink>
        <p className="mt-1 text-xs text-zinc-500">GP {row.gp === null ? '—' : number(row.gp)}{row.race.has_sprint && ` · Sprint ${row.sprint === null ? '—' : number(row.sprint)}`}{!row.hasLineup ? ' · Formazione assente' : ''}{!row.complete ? ' · Provvisorio' : ''}</p></div>
      <strong className="shrink-0 text-lg tabular-nums">{number(row.total)} <span className="text-xs font-medium text-zinc-400">pt</span></strong>
    </div>)}</div>{!played && <p className="text-sm text-zinc-400">Nessuna gara pubblicata</p>}</Panel>
  </div>;
}
