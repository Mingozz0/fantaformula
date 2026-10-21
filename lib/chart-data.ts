import type { TeamStats } from './league-stats';
export type ChartSource = 'all' | 'gp' | 'sprint';
export type ChartMode = 'cumulative' | 'round' | 'position';
export function chartSeries(entries: TeamStats[], source: ChartSource, mode: ChartMode) {
  const values = entries.map((entry) => {
    let cumulative = 0;
    return entry.races.map((row) => {
      const points = source === 'gp' ? row.gp ?? 0 : source === 'sprint' ? row.sprint ?? 0 : row.total;
      cumulative += points;
      return { race: row.race, points, cumulative };
    });
  });
  return entries.map((entry, index) => ({ id: entry.team.id, name: entry.team.name,
    rows: values[index].map((row, round) => ({ ...row, value: mode === 'round' ? row.points : mode === 'position'
      ? 1 + values.filter((series) => series[round].cumulative > row.cumulative).length : row.cumulative })) }));
}
