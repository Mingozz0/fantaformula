'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { homeUrl as home } from '@/lib/portal-navigation';
import { actionError } from '@/lib/query-errors';

function textField(form: FormData, key: string) { return String(form.get(key) ?? '').trim(); }
function numberField(form: FormData, key: string) { return Number(textField(form, key)); }
function normalizedName(value: string) { return value.trim().replace(/\s+/g, ' '); }
async function authenticated() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect('/');
  return { supabase, userId: data.claims.sub };
}

export async function signOut() {
  const { supabase } = await authenticated();
  const { error } = await supabase.auth.signOut();
  if (error) redirect(home(undefined, undefined, 'Uscita non riuscita. Riprova.'));
  redirect('/?message=Disconnessione+effettuata&outcome=success');
}

export async function createLeague(form: FormData) {
  const { supabase, userId } = await authenticated();
  const name = normalizedName(textField(form, 'name'));
  const { data: season } = await supabase.from('seasons').select('id').eq('year', 2026).single();
  if (!season || name.length < 3 || name.length > 100) {
    redirect(home(undefined, undefined, 'Il nome della lega deve avere da 3 a 100 caratteri'));
  }
  const { data, error } = await supabase.from('leagues')
    .insert({ name, season_id: season.id, created_by: userId })
    .select('id').single();
  if (error || !data) redirect(home(undefined, undefined,
    error?.code === '23505' ? 'Hai già una lega 2026 con questo nome' : actionError(error)));
  revalidatePath('/home');
  redirect(home(data.id, 'manage', 'Lega creata', undefined, 'success'));
}

export async function joinLeague(form: FormData) {
  const { supabase } = await authenticated();
  const code = textField(form, 'code');
  const { data, error } = await supabase.rpc('join_league', { code });
  if (error || !data) redirect(home(undefined, undefined, 'Codice non valido o iscrizioni chiuse'));
  revalidatePath('/home');
  redirect(home(String(data), 'overview', 'Sei entrato nella lega', undefined, 'success'));
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
  const [{ data: league }, { data: admin }, { data: existing }] = await Promise.all([
    supabase.from('leagues').select('season_id').eq('id', leagueId).single(),
    supabase.from('league_members').select('role').eq('league_id', leagueId).eq('user_id', actorId).single(),
    supabase.from('fantasy_teams').select('id').eq('league_id', leagueId).eq('user_id', userId).maybeSingle(),
  ]);
  if (!league) redirect(home(leagueId, 'manage', 'Lega non trovata'));
  if (admin?.role !== 'admin') redirect(home(leagueId, 'overview', 'Solo l’amministratore può assegnare squadre'));
  const payload = { name, constructor_id: constructorId,
    driver_one_id: ids[0], driver_two_id: ids[1], driver_three_id: ids[2] };
  const response = existing
    ? await supabase.from('fantasy_teams').update(payload).eq('id', existing.id)
    : await supabase.from('fantasy_teams').insert({ ...payload, league_id: leagueId,
      season_id: league.season_id, user_id: userId });
  if (response.error) redirect(home(leagueId, 'manage', actionError(response.error)));
  revalidatePath('/home');
  redirect(home(leagueId, 'manage', 'Squadra salvata', undefined, 'success'));
}

export async function saveTeamDraft(form: FormData) {
  const { supabase, userId } = await authenticated();
  const leagueId = textField(form, 'league_id');
  const draftId = textField(form, 'draft_id');
  const playerName = normalizedName(textField(form, 'player_name'));
  const name = normalizedName(textField(form, 'name'));
  const constructorId = numberField(form, 'constructor_id');
  const ids = ['driver_one_id', 'driver_two_id', 'driver_three_id'].map((key) => numberField(form, key));
  if (!leagueId || playerName.length < 2 || playerName.length > 80
    || name.length < 2 || name.length > 80 || !constructorId
    || ids.some((id) => !id) || new Set(ids).size !== 3) {
    redirect(home(leagueId, 'manage', 'Completa la squadra in attesa con tre piloti diversi'));
  }
  const [{ data: admin }, { data: league }] = await Promise.all([
    supabase.from('league_members').select('role').eq('league_id', leagueId).eq('user_id', userId).single(),
    supabase.from('leagues').select('season_id').eq('id', leagueId).single(),
  ]);
  if (admin?.role !== 'admin') redirect(home(leagueId, 'overview', 'Solo l’amministratore può preparare le squadre'));
  if (!league) redirect(home(leagueId, 'manage', 'Lega non trovata'));
  const payload = { player_name: playerName, name, constructor_id: constructorId,
    driver_one_id: ids[0], driver_two_id: ids[1], driver_three_id: ids[2] };
  const response = draftId
    ? await supabase.from('team_drafts').update(payload).eq('id', draftId).eq('league_id', leagueId)
      .select('id').single()
    : await supabase.from('team_drafts').insert({ ...payload, league_id: leagueId,
      season_id: league.season_id }).select('id').single();
  if (response.error) redirect(home(leagueId, 'manage', actionError(response.error)));
  revalidatePath('/home');
  redirect(home(leagueId, 'manage', draftId ? 'Squadra in attesa aggiornata' : 'Squadra in attesa salvata', undefined, 'success'));
}

export async function assignTeamDraft(form: FormData) {
  const { supabase, userId } = await authenticated();
  const leagueId = textField(form, 'league_id');
  const draftId = textField(form, 'draft_id');
  const recipientId = textField(form, 'user_id');
  if (!leagueId || !draftId || !recipientId) redirect(home(leagueId, 'manage', 'Seleziona un partecipante'));
  const [{ data: admin }, { data: draft }] = await Promise.all([
    supabase.from('league_members').select('role').eq('league_id', leagueId).eq('user_id', userId).single(),
    supabase.from('team_drafts').select('id').eq('id', draftId).eq('league_id', leagueId).single(),
  ]);
  if (admin?.role !== 'admin') redirect(home(leagueId, 'overview', 'Solo l’amministratore può assegnare le squadre'));
  if (!draft) redirect(home(leagueId, 'manage', 'Squadra in attesa non trovata'));
  const { error } = await supabase.rpc('assign_team_draft', { p_draft_id: draftId, p_user_id: recipientId });
  if (error) redirect(home(leagueId, 'manage', error.code === '23505'
    ? 'Questo partecipante ha già una squadra' : actionError(error)));
  revalidatePath('/home');
  redirect(home(leagueId, 'manage', 'Squadra assegnata al partecipante', undefined, 'success'));
}

export async function deleteTeamDraft(form: FormData) {
  const { supabase, userId } = await authenticated();
  const leagueId = textField(form, 'league_id');
  const draftId = textField(form, 'draft_id');
  const { data: admin } = await supabase.from('league_members').select('role')
    .eq('league_id', leagueId).eq('user_id', userId).single();
  if (admin?.role !== 'admin') redirect(home(leagueId, 'overview', 'Solo l’amministratore può eliminare le bozze'));
  const { error } = await supabase.from('team_drafts').delete().eq('id', draftId)
    .eq('league_id', leagueId).select('id').single();
  if (error) redirect(home(leagueId, 'manage', actionError(error)));
  revalidatePath('/home');
  redirect(home(leagueId, 'manage', 'Squadra in attesa eliminata', undefined, 'success'));
}

export async function activateLeague(form: FormData) {
  const { supabase } = await authenticated();
  const leagueId = textField(form, 'league_id');
  const { error } = await supabase.from('leagues').update({ status: 'active' }).eq('id', leagueId);
  if (error) redirect(home(leagueId, 'manage', actionError(error)));
  revalidatePath('/home');
  redirect(home(leagueId, 'manage', 'Lega attivata', undefined, 'success'));
}

export async function saveLineup(form: FormData) {
  const { supabase, userId } = await authenticated();
  const leagueId = textField(form, 'league_id');
  const teamId = textField(form, 'fantasy_team_id');
  const raceId = numberField(form, 'race_id');
  const one = numberField(form, 'driver_one_id');
  const two = numberField(form, 'driver_two_id');
  const empty = textField(form, 'is_empty') === 'true';
  const { data: team } = await supabase.from('fantasy_teams').select('*')
    .eq('id', teamId).eq('league_id', leagueId).single();
  const { data: race } = await supabase.from('races').select('season_id,lineup_deadline_at')
    .eq('id', raceId).single();
  if (!team || !race || team.season_id !== race.season_id || (!empty && (!one || !two || one === two))) {
    redirect(home(leagueId, 'lineup', 'Formazione non valida', raceId));
  }
  const roster: number[] = [team.driver_one_id, team.driver_two_id, team.driver_three_id];
  const reserve = roster.find((id) => id !== one && id !== two);
  if (!empty && (!roster.includes(one) || !roster.includes(two) || !reserve)) {
    redirect(home(leagueId, 'lineup', 'I piloti devono appartenere alla rosa', raceId));
  }
  const retroactive = race.lineup_deadline_at && Date.now() >= Date.parse(race.lineup_deadline_at);
  if (retroactive) {
    const { data: member } = await supabase.from('league_members').select('role')
      .eq('league_id', leagueId).eq('user_id', userId).single();
    if (member?.role !== 'admin') redirect(home(leagueId, 'lineup', 'Scadenza superata', raceId));
  } else if (team.user_id !== userId) {
    redirect(home(leagueId, 'lineup', 'Puoi modificare solo la tua formazione', raceId));
  }
  const payload = { driver_one_id: empty ? null : one, driver_two_id: empty ? null : two,
    reserve_driver_id: empty ? null : reserve, is_empty: empty,
    captain_driver_id: null, retroactive: Boolean(retroactive) };
  const { data: existing } = await supabase.from('lineups').select('id')
    .eq('fantasy_team_id', teamId).eq('race_id', raceId).maybeSingle();
  const response = existing
    ? await supabase.from('lineups').update(payload).eq('id', existing.id).select('id').single()
    : await supabase.from('lineups').insert({ ...payload, fantasy_team_id: teamId,
      league_id: leagueId, season_id: team.season_id, race_id: raceId }).select('id').single();
  if (response.error) redirect(home(leagueId, 'lineup', actionError(response.error), raceId));
  revalidatePath('/home');
  redirect(home(leagueId, 'lineup', empty ? 'Formazione non consegnata salvata · 0 punti' : retroactive ? 'Formazione passata registrata' : 'Formazione salvata', raceId, 'success'));
}
