# GRIDF1

Fantacalcio per la Formula 1 con leghe private da 4 a 7 partecipanti. Un account può appartenere a più leghe, anche con ruoli diversi. L'amministratore assegna a ogni partecipante 3 piloti e una scuderia; per ciascun weekend il partecipante schiera 2 titolari e il terzo diventa la riserva.

L'app usa **Next.js 16**, **Supabase Auth** e **Supabase PostgreSQL**. Il database del progetto Mingo (`rvvrkwyikqhxspuceria`) contiene già il catalogo 2026: 22 piloti, 11 scuderie, 23 GP e 6 weekend Sprint. I risultati 2026 devono essere inseriti manualmente dal gestore del gioco, come previsto dal regolamento. Lo storico sportivo 2023 resta conservato.

## Avvio locale

Richiede Node.js 20 o superiore e npm. Copia `.env.example` in `.env.local` e inserisci **URL e chiave publishable** del progetto Supabase. La chiave publishable è destinata al browser; non inserire mai una chiave `service_role` o `sb_secret_` in una variabile `NEXT_PUBLIC_`.

```bash
npm ci
npm run dev
```

Nel progetto Supabase, in **Authentication → URL Configuration**, configura `http://localhost:3000` come Site URL e autorizza `http://localhost:3000/auth/callback` come redirect. Aggiungi anche gli indirizzi del dominio di produzione quando lo pubblichi. Se la conferma email è attiva, un nuovo utente deve confermare il messaggio prima di accedere.

## Flusso dell'app

1. L'utente si registra con nome, email e password, conferma l'email se richiesta e accede.
2. Crea una lega 2026 o entra con un codice invito. Può selezionare una delle sue leghe dalla barra laterale.
3. L'admin della lega può preparare squadre per ragazzi non ancora registrati. Quando entrano con il codice invito, assegna loro le squadre preparate; può anche creare o modificare direttamente la squadra di un membro già entrato. La lega si attiva solo con 4–7 membri registrati e una squadra assegnata a ciascuno.
4. Il partecipante vede la rosa e salva la formazione del prossimo GP: 2 titolari; il terzo pilota è automaticamente la riserva. La scuderia della rosa è sempre schierata.
5. Per i GP già conclusi, l'admin può recuperare le formazioni delle squadre della propria lega. Il recupero è registrato in `lineup_audit`.
6. Il gestore globale inserisce i risultati GP e Sprint in una bozza, salvata automaticamente e recuperabile. Solo la pubblicazione aggiorna classifica e risultati, con un’unica transazione per piloti e scuderie. Le correzioni in bozza non modificano la versione già pubblicata.

## Bozze e statistiche

- `result_drafts` conserva una bozza per gara ed evento, leggibile e modificabile soltanto dai gestori (`game_managers`). È possibile salvare dati incompleti; i controlli completi scattano alla pubblicazione.
- Ogni salvataggio usa una versione per impedire sovrascritture da altre finestre. Una copia temporanea nella sessione del browser protegge le modifiche durante un’interruzione della connessione.
- I grafici della lega permettono di scegliere le squadre, confrontarne due, filtrare GP/Sprint, punti per tappa, cumulativi e posizioni.
- Le statistiche avanzate sono visibili soltanto ai gestori e restano riferite alla lega selezionata: contributi dei piloti, punti migliorabili nelle formazioni consegnate, assenze e continuità.
- Applicare `supabase/migrations/20261021142220_result_drafts.sql` prima del codice che usa le nuove funzioni RPC.

**Scadenze:** GP normali alle 00:00 di sabato in `Europe/Rome` (fine del venerdì); weekend Sprint all'inizio della qualifica Sprint. Il database verifica la scadenza. Chi non presenta la formazione prende 0 punti nel weekend.

## Regole dei punti 2026

| Evento | GP | Sprint |
| --- | --- | --- |
| Posizioni d'arrivo | 1°–10°: 25, 18, 15, 12, 10, 8, 6, 4, 2, 1 | 1°–8°: 8, 7, 6, 5, 4, 3, 2, 1 |
| Griglia effettiva | 1° +10, 2° +6, 3° +3 | 1° +5, 2° +3, 3° +1 |
| Posizioni guadagnate/perse | +2/−2 per posizione | +1/−1 per posizione |
| Giro veloce | +5 | +3 |
| Driver of the Day | +5 | — |
| Ritiro o squalifica | Solo −10, senza altri bonus | Solo −5, senza altri bonus |
| Scuderia | Punti d'arrivo del migliore dei suoi piloti reali, più +5 per il miglior pit stop | Punti d'arrivo del migliore dei suoi piloti reali |

La riserva subentra **se un titolare è DNS (non partito) oppure non effettua il giro di formazione**. DNS attiva sempre la riserva, anche se il pilota ha effettuato il giro di formazione. Un ritiro durante la gara non attiva la riserva. Sprint e GP sono valutati separatamente. Se entrambi i titolari mancano, la riserva sostituisce il primo indicato e il secondo vale zero. Il capitano non assegna punti nel 2026. A pari punti le squadre condividono la stessa posizione in classifica.

## Gestore dei risultati

`/manager` è accessibile solo agli utenti elencati in `public.game_managers`. Per assegnare il ruolo al primo account, registralo e conferma l'email, quindi esegui nel **SQL Editor di Supabase** con i privilegi del proprietario del progetto:

```sql
insert into public.game_managers (user_id)
select id from auth.users where email = 'LA_TUA_EMAIL';
```

Un admin di lega non può modificare i risultati sportivi comuni a tutte le leghe. Nell'area gestore, scegli il GP e compila per **tutti** i piloti griglia effettiva, arrivo o stato, scuderia reale e partecipazione al giro di formazione. Seleziona anche giro veloce, Driver of the Day e miglior pit stop per il GP; per la Sprint servono risultati e giro veloce. Salva e poi pubblica.

### Importazione risultati

- “Importa risultati” recupera un’anteprima da [Jolpica-F1](https://github.com/jolpica/jolpica-f1) per la gara e l’evento selezionati. Il server verifica il ruolo di gestore prima di contattare il servizio.
- “Applica alla bozza” sostituisce i dati dei piloti associati e il giro veloce disponibile, conserva i bonus manuali e i dati mancanti dalla fonte e salva la bozza. Fonte e ora dell’importazione restano nella bozza; nulla viene pubblicato automaticamente.
- Il matching usa le chiavi esterne e, come alternativa, nome/cognome o cognome e codice pilota; le associazioni ambigue sono segnalate. Le posizioni di classificazione dei ritirati non diventano arrivi validi.
- Pilota del giorno e migliore sosta ai box restano manuali. Griglie assenti o partenze dai box richiedono verifica; i valori zero della fonte non vengono convertiti in posizioni inventate.
- Le richieste usano un User-Agent GRIDF1, cache di 60 secondi e timeout di 12 secondi. Errori del servizio e risultati non disponibili lasciano la bozza intatta. Non servono chiavi API o nuove variabili d’ambiente.

## Database e fonti

- `supabase/schema.sql`: schema iniziale, leghe, squadre, formazioni e RLS.
- `supabase/post_schema_adjustments.sql`: Sprint e permessi preesistenti.
- `supabase/seed_2023.sql`: dati sportivi parziali del vecchio MySQL, senza utenti e password.
- `supabase/full_game_flow.sql`: riserva, risultati, gestore, profili Auth, scadenze, regole di punteggio e audit.
- `supabase/seed_2026.sql`: catalogo e calendario 2026; nessun risultato sportivo.
- `supabase/policy_and_query_indexes.sql`: policy RLS consolidate e indici per classifica e risultati.
- `supabase/active_league_lineups.sql`: blocco delle formazioni finché la lega non è attiva.
- `supabase/published_result_visibility.sql`: risultati in bozza leggibili solo dal gestore.
- `supabase/migrations/20261020080516_league_names_and_team_drafts.sql`: nome lega univoco per creatore e stagione, squadre preparate prima della registrazione e assegnazione ai membri.

Il calendario è stato verificato con il [calendario ufficiale F1 2026](https://www.formula1.com/en/racing/2026), le [scuderie](https://www.formula1.com/en/teams) e il [calendario Sprint](https://corp.formula1.com/formula-1-and-fia-announce-2026-sprint-calendar/) al 15 ottobre 2026. Sono registrate le **date** dei GP e le scadenze delle formazioni; gli orari di partenza delle gare non ancora verificati restano vuoti. Il gestore deve aggiornare il calendario se la F1 cambia date o orari.

Le tabelle pubbliche hanno Row Level Security. Le chiavi segrete non sono usate dal frontend. La funzione `join_league` è intenzionalmente eseguibile dagli autenticati per permettere l'ingresso tramite codice e verifica utente, codice, stato e limite della lega.

## Verifiche

```bash
npm run lint
npm run build
npm run test:scoring
npm run test:imports
```

I test del database sono stati eseguiti in transazioni poi annullate: creazione profilo, ingresso in lega, blocco delle modifiche non autorizzate, limite minimo per l'attivazione, quattro squadre, recupero formazione e scrittura dei risultati da parte del gestore. Per lo stato puntuale del progetto vedi [docs/MODIFICHE.md](docs/MODIFICHE.md).
