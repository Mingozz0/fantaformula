import type { FantasyLineup } from './scoring';
export type SubmissionStatus = { fantasy_team_id: string; race_id: number; is_submitted: boolean };
export function lineupClosed(deadline: string | null, now: number) {
  return deadline !== null && Number.isFinite(Date.parse(deadline)) && now >= Date.parse(deadline);
}
export function canRevealLineup(ownerId: string, viewerId: string, deadline: string | null, now: number) {
  return ownerId === viewerId || lineupClosed(deadline, now);
}
export function submissionLabel(submitted: boolean, closed: boolean) {
  return submitted ? 'Consegnata' : closed ? 'Non consegnata' : 'Da consegnare';
}
export type LeagueLineup = FantasyLineup & { fantasy_team_id: string; race_id: number; submitted_at?: string };
