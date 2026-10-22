'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fetchCalendar, parseSchedule } from '@/lib/schedule-import';

export async function syncWeekendSchedule(raceId: number): Promise<{ok:true;count:number}|{ok:false;error:string}> {
  if (!Number.isSafeInteger(raceId) || raceId<1) return {ok:false,error:'Gara non valida.'};
  try {
    const db=await createClient();
    const {data:auth}=await db.auth.getClaims();
    if(!auth?.claims?.sub)return {ok:false,error:'Sessione scaduta. Accedi di nuovo.'};
    const {data:manager,error:managerError}=await db.from('game_managers').select('user_id').eq('user_id',auth.claims.sub).maybeSingle();
    if(managerError || !manager)return {ok:false,error:'Solo il gestore può aggiornare gli orari.'};
    const {data:race,error:raceError}=await db.from('races').select('id,season_id,round,circuit,external_circuit_id,race_date,has_sprint').eq('id',raceId).single();
    if(raceError || !race)return {ok:false,error:'Gara non trovata.'};
    const {data:season,error:seasonError}=await db.from('seasons').select('year').eq('id',race.season_id).single();
    if(seasonError || !season)return {ok:false,error:'Stagione non disponibile.'};
    const schedule=parseSchedule(await fetchCalendar(season.year),season.year,race);
    const {data,error}=await db.rpc('sync_race_schedule',{p_race_id:raceId,p_sessions:schedule.sessions,p_source_url:schedule.sourceUrl});
    if(error){console.error('Aggiornamento calendario',error);return {ok:false,error:'Orari non aggiornati. I dati precedenti sono conservati.'};}
    revalidatePath('/home');revalidatePath('/manager');
    return {ok:true,count:data.count};
  }catch(error){return {ok:false,error:error instanceof Error?error.message:'Aggiornamento non riuscito.'};}
}
