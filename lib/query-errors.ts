export function assertQuery(result: { data?: unknown; error?: unknown }, context = 'Impossibile caricare i dati') {
  if (result.error) {
    console.error(context, result.error);
    throw new Error(`${context}. Riprova tra poco.`);
  }
}

export function actionError(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : '';
  if (/DRAFT_CONFLICT/.test(message)) return 'La bozza è stata aggiornata in un’altra finestra. Ricarica la pagina prima di continuare.';
  if (/DRAFT_INCOMPLETE|incomplete|inconsistent/.test(message)) return 'Completa i risultati e i bonus prima di pubblicare.';
  if (/roster|submitted lineups/.test(message)) return 'La rosa è bloccata dopo l’inserimento della prima formazione.';
  if (/deadline|Scadenza/.test(message)) return 'La scadenza della formazione è passata.';
  if (/23505|duplicate key/.test(message)) return 'Questo elemento esiste già.';
  if (/Only|permission|Authentication|not allowed/.test(message)) return 'Non hai i permessi per questa operazione.';
  return 'Operazione non riuscita. Riprova tra poco.';
}
