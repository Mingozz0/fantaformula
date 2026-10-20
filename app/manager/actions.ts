'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function field(form: FormData, key: string) { return String(form.get(key) ?? '').trim(); }
function message(raceId: number, event: string, value: string) {
  const params = new URLSearchParams({ race: String(raceId), event, message: value });
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
  if (!raceId || !['gp', 'sprint'].includes(event)) redirect('/manager');
  const { data: race } = await supabase.from('races').select('season_id,has_sprint').eq('id', raceId).single();
  if (!race || (event === 'sprint' && !race.has_sprint)) redirect(message(raceId, event, 'Gara non valida'));
  const { data: drivers } = await supabase.from('season_drivers').select('driver_id,constructor_id')
    .eq('season_id', race.season_id);
  if (!drivers?.length) redirect(message(raceId, event, 'Piloti mancanti'));
  const fastest = Number(field(form, 'fastest_driver_id'));
  const dotd = Number(field(form, 'dotd_driver_id'));
  const pit = Number(field(form, 'pit_constructor_id'));
  if (!fastest || (event === 'gp' && (!dotd || !pit))) {
    redirect(message(raceId, event, 'Seleziona giro veloce e, per il GP, pilota del giorno e miglior pit stop'));
  }
  const gridSet = new Set<number>();
  const finishSet = new Set<number>();
  const rows = [];
  for (const driver of drivers) {
    const id = driver.driver_id;
    const status = field(form, `status_${id}`);
    const grid = Number(field(form, `grid_${id}`)) || null;
    const finish = Number(field(form, `finish_${id}`)) || null;
    const constructorId = Number(field(form, `constructor_${id}`)) || driver.constructor_id;
    if (!['finished','dnf','dns','dsq'].includes(status)
      || (status === 'finished' && !finish)
      || (status !== 'finished' && finish)
      || (grid !== null && (grid < 1 || grid > 30 || gridSet.has(grid)))
      || (finish !== null && (finish < 1 || finish > 30 || finishSet.has(finish)))) {
      redirect(message(raceId, event, `Controlla posizione e stato del pilota ${id}`));
    }
    if (grid !== null) gridSet.add(grid);
    if (finish !== null) finishSet.add(finish);
    rows.push({ race_id: raceId, season_id: race.season_id, driver_id: id,
      constructor_id: constructorId, grid_position: grid, finish_position: finish,
      result_status: status, formation_lap: form.get(`formation_${id}`) === 'on',
      fastest_lap: fastest === id,
      ...(event === 'gp' ? { driver_of_the_day: dotd === id } : {}),
    });
  }
  const table = event === 'gp' ? 'race_driver_results' : 'sprint_driver_results';
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'race_id,driver_id' });
  if (error) redirect(message(raceId, event, error.message));
  if (event === 'gp') {
    const { data: constructors } = await supabase.from('season_constructors').select('constructor_id')
      .eq('season_id', race.season_id);
    const pitRows = (constructors ?? []).map((constructor) => ({ race_id: raceId,
      season_id: race.season_id, constructor_id: constructor.constructor_id,
      fastest_pit_stop: constructor.constructor_id === pit }));
    const { error: pitError } = await supabase.from('race_constructor_results')
      .upsert(pitRows, { onConflict: 'race_id,constructor_id' });
    if (pitError) redirect(message(raceId, event, pitError.message));
  }
  revalidatePath('/home');
  revalidatePath('/manager');
  redirect(message(raceId, event, 'Risultati salvati. Pubblicali dopo la verifica.'));
}

export async function publishResults(form: FormData) {
  const supabase = await manager();
  const raceId = Number(field(form, 'race_id'));
  const event = field(form, 'event');
  if (!raceId || !['gp','sprint'].includes(event)) redirect('/manager');
  const column = event === 'gp' ? 'gp_published' : 'sprint_published';
  const { error } = await supabase.from('races').update({ [column]: true }).eq('id', raceId);
  if (error) redirect(message(raceId, event, error.message));
  revalidatePath('/home');
  revalidatePath('/manager');
  redirect(message(raceId, event, 'Risultati pubblicati'));
}
