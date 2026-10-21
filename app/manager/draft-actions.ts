'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { actionError } from '@/lib/query-errors';
import { isDraftPayload, type DraftPayload, type DraftReply } from '@/lib/result-draft';

async function managerClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const response = await supabase.from('game_managers').select('user_id').eq('user_id', data.claims.sub).maybeSingle();
  if (response.error) throw response.error;
  return response.data ? supabase : null;
}

export async function saveResultDraft(raceId: number, event: string, payload: DraftPayload, version: number): Promise<DraftReply> {
  if (!Number.isSafeInteger(raceId) || !['gp','sprint'].includes(event) || !isDraftPayload(payload) || !Number.isSafeInteger(version) || version < 0) return { ok: false, error: 'Bozza non valida.' };
  try {
    const supabase = await managerClient();
    if (!supabase) return { ok: false, error: 'Sessione scaduta o permessi insufficienti. Accedi di nuovo.' };
    const { data, error } = await supabase.rpc('save_result_draft', { p_race_id: raceId, p_event: event, p_payload: payload, p_expected_version: version });
    if (error) return { ok: false, error: actionError(error) };
    return { ok: true, version: data.version, savedAt: data.updated_at, publishedVersion: data.published_version };
  } catch (error) { console.error('Salvataggio bozza', error); return { ok: false, error: actionError(error) }; }
}

export async function publishResultDraft(raceId: number, event: string, version: number): Promise<DraftReply> {
  if (!Number.isSafeInteger(raceId) || !['gp','sprint'].includes(event) || !Number.isSafeInteger(version)) return { ok: false, error: 'Gara non valida.' };
  try {
    const supabase = await managerClient();
    if (!supabase) return { ok: false, error: 'Sessione scaduta o permessi insufficienti. Accedi di nuovo.' };
    const { data, error } = await supabase.rpc('publish_result_draft', { p_race_id: raceId, p_event: event, p_expected_version: version });
    if (error) return { ok: false, error: actionError(error) };
    revalidatePath('/home'); revalidatePath('/manager');
    return { ok: true, version: data.version, publishedVersion: data.published_version };
  } catch (error) { console.error('Pubblicazione risultati', error); return { ok: false, error: actionError(error) }; }
}
