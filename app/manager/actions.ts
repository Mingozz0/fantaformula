'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { validatePositions } from '@/lib/result-validation';

function field(form: FormData, key: string) { return String(form.get(key) ?? '').trim(); }
function message(raceId: number, event: string, value: string, leagueId?: string) {
  const params = new URLSearchParams({ race: String(raceId), event, message: value });
  if (leagueId) params.set('league', leagueId);
  return `/manager?${params}`;
}
async function manager() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect('/');
  const { data } = await supabase.from('game_managers').select('user_id').eq('user_id', userId).maybeSingle();
  if (!data) redirect('/home');
  return supabase;
}

export async function saveResults(form: FormData) {
  const supabase = await manager();
  const raceId = Number(field(form, 'race_id'));
  const event = field(form, 'event');
  const leagueId = field(form, 'league_id');
  if (!raceId || !['gp', 'sprint'].includes(event)) redirect('/manager');
  const { data: race } = await supabase.from('races').select('season_id,has_sprint').eq('id', raceId).single();
  if (!race || (event === 'sprint' && !race.has_sprint)) redirect(message(raceId, event, 'Gara non valida', leagueId));
  const { data: drivers } = await supabase.from('season_drivers').select('driver_id,constructor_id,drivers!inner(first_name,last_name)')
    .eq('season_id', race.season_id);
  if (!drivers?.length) redirect(message(raceId, event, 'Piloti mancanti', leagueId));
  const fastest = Number(field(form, 'fastest_driver_id'));
  const dotd = Number(field(form, 'dotd_driver_id'));
  const pit = Number(field(form, 'pit_constructor_id'));
  if (!fastest || (event === 'gp' && (!dotd || !pit))) {
    redirect(message(raceId, event, 'Seleziona il giro veloce e, per il Gran Premio, il pilota del giorno e la migliore sosta ai box', leagueId));
  }
  const rows = [];
  for (const driver of drivers) {
    const id = driver.driver_id;
    const status = field(form, `status_${id}`);
    const gridValue = field(form, `grid_${id}`);
    const finishValue = field(form, `finish_${id}`);
    const grid = gridValue === '' ? null : Number(gridValue);
    const finish = finishValue === '' ? null : Number(finishValue);
    const constructorId = Number(field(form, `constructor_${id}`)) || driver.constructor_id;
    rows.push({ race_id: raceId, season_id: race.season_id, driver_id: id,
      constructor_id: constructorId, grid_position: grid, finish_position: finish,
      result_status: status, formation_lap: form.get(`formation_${id}`) === 'on',
      fastest_lap: fastest === id,
      ...(event === 'gp' ? { driver_of_the_day: dotd === id } : {}),
    });
  }
  const positionErrors = validatePositions(rows.map((row) => {
    const driver = drivers.find((entry) => entry.driver_id === row.driver_id)!;
    const person = driver.drivers as unknown as { first_name: string; last_name: string };
    return { ...row, name: `${person.first_name} ${person.last_name}` };
  }));
  if (positionErrors.length) redirect(message(raceId, event, positionErrors[0].message, leagueId));
  const table = event === 'gp' ? 'race_driver_results' : 'sprint_driver_results';
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'race_id,driver_id' });
  if (error) redirect(message(raceId, event, error.message, leagueId));
  if (event === 'gp') {
    const { data: constructors } = await supabase.from('season_constructors').select('constructor_id')
      .eq('season_id', race.season_id);
    const pitRows = (constructors ?? []).map((constructor) => ({ race_id: raceId,
      season_id: race.season_id, constructor_id: constructor.constructor_id,
      fastest_pit_stop: constructor.constructor_id === pit }));
    const { error: pitError } = await supabase.from('race_constructor_results')
      .upsert(pitRows, { onConflict: 'race_id,constructor_id' });
    if (pitError) redirect(message(raceId, event, pitError.message, leagueId));
  }
  revalidatePath('/home');
  revalidatePath('/manager');
  redirect(message(raceId, event, 'Risultati salvati. Pubblicali dopo la verifica.', leagueId));
}

export async function publishResults(form: FormData) {
  const supabase = await manager();
  const raceId = Number(field(form, 'race_id'));
  const event = field(form, 'event');
  const leagueId = field(form, 'league_id');
  if (!raceId || !['gp','sprint'].includes(event)) redirect('/manager');
  const column = event === 'gp' ? 'gp_published' : 'sprint_published';
  const { error } = await supabase.from('races').update({ [column]: true }).eq('id', raceId);
  if (error) redirect(message(raceId, event, error.message, leagueId));
  revalidatePath('/home');
  revalidatePath('/manager');
  redirect(message(raceId, event, 'Risultati pubblicati', leagueId));
}
