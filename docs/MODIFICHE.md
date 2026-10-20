# Modifiche e stato del progetto

## Realizzato

- Login e registrazione collegati a Supabase Auth, conferma tramite callback, sessione SSR e protezione di `/home` e `/manager`.
- Lista delle leghe dell'utente, creazione della lega 2026 e ingresso tramite codice invito.
- Ruolo admin per lega, assegnazione della rosa di 3 piloti e 1 scuderia, attivazione con 4–7 squadre complete.
- Formazione con 2 titolari e riserva automatica; salvataggio prima della scadenza e recupero auditato dei GP passati da parte dell'admin.
- Gestore globale dei risultati, separato dagli admin delle leghe, con moduli GP/Sprint e pubblicazione.
- Classifica e dettaglio dei punti calcolati dai risultati pubblicati secondo il regolamento 2026.
- Catalogo 2026: 22 piloti, 11 scuderie, 23 GP e 6 Sprint; dati sportivi 2023 conservati.
- README, configurazione locale di esempio e test del calcolo punti.

## Stato dei dati e completamento operativo

Al 15 ottobre 2026 il progetto Supabase non contiene ancora utenti Auth reali, leghe, gestori o risultati 2026. Il software è pronto per crearli attraverso l'interfaccia; la classifica resta a zero finché il gestore non inserisce e pubblica i risultati. Per usare `/manager`, bisogna registrare un account e assegnargli una volta il ruolo `game_managers` come spiegato nel README.

Il caricamento dei risultati già disputati è volutamente manuale. Per riprodurre la stagione dall'inizio, l'admin di ogni lega deve registrare le formazioni passate dei membri; la stessa rosa assegnata ora vale per tutto il 2026. I risultati sportivi sono condivisi da tutte le leghe e vengono inseriti una sola volta dal gestore globale.

## Scelte tecniche

Le nuove migrazioni non alterano né eliminano lo storico 2023. La riserva e la partecipazione al giro di formazione sono registrate per distinguere un forfait prima del via da un ritiro. Le regole sono salvate per stagione in `season_scoring_rules`. Le formazioni recuperate sono marcate `retroactive` e ogni inserimento o modifica crea una voce in `lineup_audit`.

Le query dell'app usano la chiave publishable e le policy RLS. Nessuna chiave segreta è presente nel client. I risultati in bozza sono visibili solo al gestore. Una modifica a un risultato sportivo toglie la pubblicazione della gara, affinché la classifica non mostri dati corretti solo in parte.

Una migrazione aggiuntiva consolida le policy RLS delle formazioni e dei risultati e aggiunge indici alle letture più frequenti. Il Security Advisor non segnala tabelle pubbliche senza RLS.

## Verifiche eseguite

- `npm run lint`, `npm run build`, `npm run test:scoring`.
- Verifica HTTP: `/` risponde 200; `/home` e `/manager` rimandano al login senza sessione.
- Transazioni PostgreSQL annullate: profilo creato dopo utente Auth, creazione lega, ingresso con codice, blocco dell'assegnazione squadra da parte di un membro, attivazione impedita sotto 4 membri, attivazione con 4 squadre, recupero formazione con audit, scrittura risultati consentita al gestore.
- Security Advisor: rimane un avviso atteso per `join_league`, funzione `SECURITY DEFINER` pubblica invocabile solo dagli autenticati. [Dettagli Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Limiti da conoscere

- La registrazione con email reale e l'accesso del primo gestore richiedono la configurazione Auth e l'assegnazione del ruolo nel progetto Supabase; non esiste ancora un account amministrativo.
- I risultati 2026 non sono precaricati. Ogni GP richiede inserimento e pubblicazione; ogni Sprint è separata.
- Le date dei GP e le scadenze sono presenti. Gli orari di partenza non verificati restano vuoti e vanno controllati prima di mostrarli come orari ufficiali.
