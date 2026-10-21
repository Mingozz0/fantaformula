import { resultImportUrl } from './result-import';

export async function fetchJolpicaResults(year: number, round: number, event: 'gp' | 'sprint', fetcher: typeof fetch = fetch): Promise<unknown> {
  const url = resultImportUrl(year, round, event);
  let response: Response;
  try {
    response = await fetcher(url, { headers: { 'User-Agent': 'GRIDF1/1.0', Accept: 'application/json' },
      next: { revalidate: 60 }, signal: AbortSignal.timeout(12000) });
  } catch { throw new Error('Servizio risultati non raggiungibile. La bozza è conservata: riprova tra poco.'); }
  if (response.status === 429) throw new Error('Il servizio ha ricevuto troppe richieste. Attendi un minuto e riprova.');
  if (response.status === 404) throw new Error('Risultati non ancora disponibili per questa gara.');
  if (!response.ok) throw new Error('Servizio risultati temporaneamente non disponibile. Riprova tra poco.');
  try { return await response.json(); }
  catch { throw new Error('Risposta del servizio non valida. Riprova tra poco.'); }
}
