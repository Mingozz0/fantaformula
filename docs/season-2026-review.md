# Verifica stagione 2026

Verificata il 22 ottobre 2026.

## Fonti

- Calendario e risultati F1: https://www.formula1.com/en/racing/2026 e https://www.formula1.com/en/results/2026/races
- Sprint FIA/F1: https://api.fia.com/news/fia-and-formula-1-announce-2026-sprint-calendar
- Tsunoda nelle tre gare: https://www.formula1.com/en/results/2026/drivers/YUKTSU01/yuki-tsunoda
- Ricollocazione Bahrain a Sepang: https://www.formula1.com/en/latest/article/formula-1-and-fia-confirm-malaysia-will-join-2026-calendar-as-host-venue-for-bahrain-grand-prix.6lL7vjFEM2VVynRHvg1TCf
- Dati applicativi: https://api.jolpi.ca/ergast/f1/2026/races.json?limit=100 e classifiche GP/Sprint Jolpica.

## Calendario

Confermati 23 GP e 6 Sprint. Date e numerazione del portale corrispondono al calendario aggiornato. Las Vegas è il 21 novembre sul circuito, il 22 novembre in UTC e in Italia. Le gare Bahrain e Arabia Saudita di aprile sono state annullate; Bahrain si disputa a Sepang il 4 ottobre. Non sono state rinumerate o rimosse gare con formazioni e risultati salvati.

| Gara | Circuito Jolpica | Data sul circuito | Sprint |
| --- | --- | --- | --- |
| 1 | albert_park | 2026-03-08 | No |
| 2 | shanghai | 2026-03-15 | Sì |
| 3 | suzuka | 2026-03-29 | No |
| 4 | miami | 2026-05-03 | Sì |
| 5 | villeneuve | 2026-05-24 | Sì |
| 6 | monaco | 2026-06-07 | No |
| 7 | catalunya | 2026-06-14 | No |
| 8 | red_bull_ring | 2026-06-28 | No |
| 9 | silverstone | 2026-07-05 | Sì |
| 10 | spa | 2026-07-19 | No |
| 11 | hungaroring | 2026-07-26 | No |
| 12 | zandvoort | 2026-08-23 | Sì |
| 13 | monza | 2026-09-06 | No |
| 14 | madring | 2026-09-13 | No |
| 15 | baku | 2026-09-26 | No |
| 16 | sepang | 2026-10-04 | No |
| 17 | marina_bay | 2026-10-11 | Sì |
| 18 | americas | 2026-10-25 | No |
| 19 | rodriguez | 2026-11-01 | No |
| 20 | interlagos | 2026-11-08 | No |
| 21 | vegas | 2026-11-21 | No |
| 22 | losail | 2026-11-29 | No |
| 23 | yas_marina | 2026-12-06 | No |

Le identità dei circuiti sono ora salvate separatamente dal nome visualizzato, così nomi equivalenti (Suzuka, Zandvoort, Madrid/Madring, Monza, Miami) non bloccano gli orari. Importate 115 sessioni; conservate le scadenze delle formazioni.

## Sostituzioni

Nei weekend Olanda (12, GP e Sprint), Italia (13) e Spagna (14):

- Hadjar non è iscritto: nessuna griglia, arrivo o bonus. Se è titolare fantasy, entra la riserva della rosa.
- Lawson corre per Red Bull; i suoi punti personali restano a Lawson.
- Tsunoda corre per Racing Bulls, come pilota sostitutivo. Non cambia le rose fantasy già definite.
- Un risultato mancante non viene automaticamente interpretato come assenza. L'importazione riconosce i non iscritti soltanto quando tutti i 22 partecipanti sono associati senza ambiguità.
- Aggiornate le quattro bozze, senza pubblicarle automaticamente. Pilota del giorno e migliore sosta rimangono da completare ove mancanti.

## Verifiche

- Classifiche reali salvate in scripts/fixtures/participation-2026.json, testate con npm run test:participation.
- Pubblicazione GP/Sprint con 23 righe (22 partecipanti e Hadjar non iscritto) verificata nel database in transazione poi annullata.
- Ripubblicazione storica con 22 righe verificata; bonus a non iscritti e pubblicazione da utenti senza ruolo gestore respinti.

