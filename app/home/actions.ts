'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function textField(form: FormData, key: string) { return String(form.get(key) ?? '').trim(); }
function numberField(form: FormData, key: string) { return Number(textField(form, key)); }
function home(leagueId?: string, tab?: string, message?: string) {
  const params = new URLSearchParams();
  if (leagueId) params.set('league', leagueId);
  if (tab) params.set('tab', tab);
  if (message) params.set('message', message);
  return `/home?${params}`;
}
async function authenticated() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect('/');
  return { supabase, userId: data.claims.sub };
}

export async function signOut() {
  const { supabase } = await authenticated();
  await supabase.auth.signOut();
  redirect('/');
}

export async function createLeague(form: FormData) {
  const { supabase, userId } = await authenticated();
  const name = textField(form, 'name');
  const { data: season } = await supabase.from('seasons').select('id').eq('year', 2026).single();
  if (!season || name.length < 3) redirect(home(undefined, undefined, 'Nome lega non valido'));
  const { data, error } = await supabase.from('leagues')
    .insert({ name, season_id: season.id, created_by: userId })
    .select('id').single();
  if (error || !data) redirect(home(undefined, undefined, error?.message ?? 'Creazione non riuscita'));
  revalidatePath('/home');
  redirect(home(data.id, 'manage', 'Lega creata'));
}

export async function joinLeague(form: FormData) {
  const { supabase } = await authenticated();
  const code = textField(form, 'code');
  const { data, error } = await supabase.rpc('join_league', { code });
  if (error || !data) redirect(home(undefined, undefined, error?.message ?? 'Codice non valido'));
  revalidatePath('/home');
  redirect(home(String(data), 'overview', 'Sei entrato nella lega'));
}

export async function saveTeam(form: FormData) {
  const { supabase, userId: actorId } = await authenticated();
  const leagueId = textField(form, 'league_id');
  const userId = textField(form, 'user_id');
  const name = textField(form, 'name');
  const constructorId = numberField(form, 'constructor_id');
  const ids = ['driver_one_id', 'driver_two_id', 'driver_three_id'].map((key) => numberField(form, key));
  if (!leagueId || !userId || name.length < 2 || !constructorId || ids.some((id) => !id)
    || new Set(ids).size !== 3) redirect(home(leagueId, 'manage', 'Squadra non valida'));
  const { data: league } = await supabase.from('leagues').select('season_id')
    .eq('id', leagueId).single();
  if (!league) redirect(home(leagueId, 'manage', 'Lega non trovata'));
  const { data: admin } = await supabase.from('league_members').select('role')
    .eq('league_id', leagueId).eq('user_id', actorId).single();
  if (admin?.role !== 'admin') redirect(home(leagueId, 'overview', 'Solo l’amministratore può assegnare squadre'));
  const { data: existing } = await supabase.from('fantasy_teams').select('id')
    .eq('league_id', leagueId).eq('user_id', userId).maybeSingle();
  const payload = { name, constructor_id: constructorId,
    driver_one_id: ids[0], driver_two_id: ids[1], driver_three_id: ids[2] };
  const response = existing
    ? await supabase.from('fantasy_teams').update(payload).eq('id', existing.id)
    : await supabase.from('fantasy_teams').insert({ ...payload, league_id: leagueId,
      season_id: league.season_id, user_id: userId });
  if (response.error) redirect(home(leagueId, 'manage', response.error.message));
  revalidatePath('/home');
  redirect(home(leagueId, 'manage', 'Squadra salvata'));
}

export async function activateLeague(form: FormData) {
  const { supabase } = await authenticated();
  const leagueId = textField(form, 'league_id');
  const { error } = await supabase.from('leagues').update({ status: 'active' }).eq('id', leagueId);
  if (error) redirect(home(leagueId, 'manage', error.message));
  revalidatePath('/home');
  redirect(home(leagueId, 'manage', 'Lega attivata'));
}

export async function saveLineup(form: FormData) {
  const { supabase, userId } = await authenticated();
  const leagueId = textField(form, 'league_id');
  const teamId = textField(form, 'fantasy_team_id');
  const raceId = numberField(form, 'race_id');
  const one = numberField(form, 'driver_one_id');
  const two = numberField(form, 'driver_two_id');
  const { data: team } = await supabase.from('fantasy_teams').select('*')
    .eq('id', teamId).eq('league_id', leagueId).single();
  const { data: race } = await supabase.from('races').select('season_id,lineup_deadline_at')
    .eq('id', raceId).single();
  if (!team || !race || team.season_id !== race.season_id || !one || !two || one === two) {
    redirect(home(leagueId, 'lineup', 'Formazione non valida'));
  }
  const roster: number[] = [team.driver_one_id, team.driver_two_id, team.driver_three_id];
  const reserve = roster.find((id) => id !== one && id !== two);
  if (!roster.includes(one) || !roster.includes(two) || !reserve) {
    redirect(home(leagueId, 'lineup', 'I piloti devono appartenere alla rosa'));
  }
  const retroactive = race.lineup_deadline_at && Date.now() >= Date.parse(race.lineup_deadline_at);
  if (retroactive) {
    const { data: member } = await supabase.from('league_members').select('role')
      .eq('league_id', leagueId).eq('user_id', userId).single();
    if (member?.role !== 'admin') redirect(home(leagueId, 'lineup', 'Scadenza superata'));
  } else if (team.user_id !== userId) {
    redirect(home(leagueId, 'lineup', 'Puoi modificare solo la tua formazione'));
  }
  const payload = { driver_one_id: one, driver_two_id: two, reserve_driver_id: reserve,
    captain_driver_id: null, retroactive: Boolean(retroactive) };
  const { data: existing } = await supabase.from('lineups').select('id')
    .eq('fantasy_team_id', teamId).eq('race_id', raceId).maybeSingle();
  const response = existing
    ? await supabase.from('lineups').update(payload).eq('id', existing.id)
    : await supabase.from('lineups').insert({ ...payload, fantasy_team_id: teamId,
      league_id: leagueId, season_id: team.season_id, race_id: raceId });
  if (response.error) redirect(home(leagueId, 'lineup', response.error.message));
  revalidatePath('/home');
  redirect(home(leagueId, 'lineup', retroactive ? 'Formazione passata registrata' : 'Formazione salvata'));
}
