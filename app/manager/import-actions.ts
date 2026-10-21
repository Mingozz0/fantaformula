'use server';

import { createClient } from '@/lib/supabase/server';
import { fetchJolpicaResults } from '@/lib/jolpica';
import { parseResultImport, type ImportReply } from '@/lib/result-import';

export async function previewResultImport(raceId: number, event: string): Promise<ImportReply> {
  if (!Number.isSafeInteger(raceId) || raceId <= 0 || !['gp', 'sprint'].includes(event)) return { ok: false, error: 'Gara non valida.' };
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims?.sub) return { ok: false, error: 'Sessione scaduta. Accedi di nuovo.' };
  const { data: manager, error: managerError } = await supabase.from('game_managers').select('user_id').eq('user_id', auth.claims.sub).maybeSingle();
  if (managerError) return { ok: false, error: 'Impossibile verificare i permessi. Riprova tra poco.' };
  if (!manager) return { ok: false, error: 'Solo il gestore dei risultati può importare i dati.' };
  const { data: race, error: raceError } = await supabase.from('races').select('season_id,round,has_sprint').eq('id', raceId).maybeSingle();
  if (raceError) return { ok: false, error: 'Impossibile caricare la gara. Riprova tra poco.' };
  if (!race || event === 'sprint' && !race.has_sprint) return { ok: false, error: 'Gara non disponibile.' };
  const [{ data: season, error: seasonError }, { data: roster, error: rosterError }, { data: constructors, error: constructorsError }] = await Promise.all([
    supabase.from('seasons').select('year').eq('id', race.season_id).single(),
    supabase.from('season_drivers').select('driver_id,constructor_id,short_name,drivers!inner(id,first_name,last_name,legacy_key)').eq('season_id', race.season_id),
    supabase.from('season_constructors').select('constructor_id,display_name,constructors!inner(canonical_name)').eq('season_id', race.season_id),
  ]);
  if (seasonError || rosterError || constructorsError || !season || !roster?.length || !constructors?.length) return { ok: false, error: 'Impossibile caricare il catalogo della stagione.' };
  // Relation cardinality is defined by the foreign keys in the database.
  const driverCatalog = roster as unknown as { constructor_id: number; short_name: string | null;
    drivers: { id: number; first_name: string; last_name: string; legacy_key: string | null } }[];
  const constructorCatalog = constructors as unknown as { constructor_id: number; display_name: string; constructors: { canonical_name: string } }[];
  try {
    const kind = event as 'gp' | 'sprint';
    const response = await fetchJolpicaResults(season.year, race.round, kind);
    return { ok: true, result: parseResultImport(response, season.year, race.round, kind,
      driverCatalog.map((row) => ({ ...row.drivers, constructor_id: row.constructor_id, short_name: row.short_name })),
      constructorCatalog.map((row) => ({ constructor_id: row.constructor_id, display_name: row.display_name, canonical_name: row.constructors.canonical_name }))) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Importazione non riuscita. La bozza è conservata.' };
  }
}
