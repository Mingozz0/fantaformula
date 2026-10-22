import type { TeamStats } from './league-stats';
export function standingsDetails(entries: TeamStats[]) {
  const hasPrevious = (entries[0]?.races.length ?? 0) > 1;
  const before = new Map(entries.map((entry) => [entry.team.id, entry.points - (entry.races.at(-1)?.total ?? 0)]));
  const leader = entries.length ? Math.max(...entries.map((entry) => entry.points)) : 0;
  return entries.map((entry) => {
    const previousRank = hasPrevious ? 1 + entries.filter((other) => before.get(other.team.id)! > before.get(entry.team.id)!).length : null;
    const preceding = entries.filter((other) => other.points > entry.points).sort((a,b) => a.points-b.points)[0];
    return { ...entry, previousRank, rankDelta: previousRank === null ? null : previousRank-entry.rank,
      gapToLeader: leader-entry.points, gapToNext: preceding ? preceding.points-entry.points : 0,
      lastPoints: entry.races.at(-1)?.total ?? null };
  });
}
