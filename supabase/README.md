# Supabase instellen

Alle databasewijzigingen staan als SQL in `migrations/`. Voer ze **in deze volgorde** uit in de
Supabase SQL Editor (Dashboard > SQL Editor > New query > plak > Run). Elke migratie is één transactie:
lukt er iets niet, dan wordt niets van die migratie doorgevoerd.

## 0. Momentopname (read-only)

Draai eerst `queries/inspecteer_database.sql` en bewaar de resultaten (Export > CSV).
Zo weten we altijd hoe de beveiliging en de functies er vóór de migraties uitzagen.

## 1. Migraties

| Bestand | Wat |
|---|---|
| `20261001000100_rollen_en_rechten.sql` | Groepen, werkgroepen, hoofdleiding, rechten; registratie enkel `@ksa-aalter.be` |
| `20261001000200_rls_policies.sql` | Row Level Security op alle MVP-tabellen; veilige `streep_drank` |
| `20261001000300_agenda_aanwezigheid.sql` | Aanwezigheid bij agenda-items |
| `20261001000400_drank.sql` | Prijs per streep, automatische voorraad, facturen, periode afsluiten, ranking |
| `20261001000500_berichten.sql` | Berichten naar groepen/werkgroepen, melding bij nieuw agenda-item |
| `20261001000600_polls.sql` | Polls |
| `20261001000700_push.sql` | Pushabonnementen, meldingen aan/uit, dagelijkse agenda-herinnering |
| `20261001000800_friet_afsluiten.sql` | Frietronde afsluiten (functie die de app al gebruikte, nu vastgelegd met rechtencontrole) |
| `20261001000900_friet_prijzen.sql` | Frietprijs komt altijd uit het menu; enkel hoofdleiding en Drankteam passen prijzen aan |
| `20261001001000_friet_melding_voor_ander.sql` | Melding (en push) als iemand friet bestelt in jouw naam |
| `20261001001100_opslag_fotos.sql` | Kastickets privé (enkel leiding); profielfoto's: enkel je eigen foto aanpassen |
| `20261001001200_altijd_hoofdleiding.sql` | De laatste actieve hoofdleiding kan niet weg (rol, inactief of verwijderen) |

Na migratie 1: controleer dat er een hoofdleiding is:

```sql
select naam, email from public.profiles where is_hoofdleiding;
```

Staat er niemand, maak jezelf hoofdleiding:

```sql
update public.profiles set is_hoofdleiding = true where email = 'jouw.naam@ksa-aalter.be';
```

## 2. Pushmeldingen (gratis, Web Push met VAPID)

1. **Sleutels maken** (eenmalig, op je eigen computer):
   ```
   npx web-push generate-vapid-keys
   ```
2. **Publieke sleutel** in `.env` van de app: `VITE_VAPID_PUBLIC_KEY=<public key>`
   (en in de omgevingsvariabelen van de hosting, bv. Vercel).
3. **Secrets** bij de edge function (Dashboard > Edge Functions > Secrets):
   - `VAPID_PUBLIC_KEY` = public key
   - `VAPID_PRIVATE_KEY` = private key (**nooit** in de app of in git)
   - `VAPID_SUBJECT` = `mailto:<een adres van de hoofdleiding>`
4. **Edge function deployen**:
   ```
   npx supabase functions deploy send-push --project-ref <project-ref>
   ```
5. **Database Webhook** (Dashboard > Database > Webhooks > Create):
   - Tabel: `notificaties`, event: **Insert**
   - Type: **Supabase Edge Functions**, functie: `send-push`, methode POST
6. **Cron** voor de herinneringen (Dashboard > Integrations > Cron > aanzetten).
   Voer daarna het laatste `do $$ … $$`-blok van `20261001000700_push.sql` nog eens uit
   als het de eerste keer een melding "pg_cron niet beschikbaar" gaf.

Testen: pushmeldingen werken enkel in de gebouwde app (`npm run build` + `npm run preview`, of de online versie),
niet in `npm run dev`. Op iPhone moet de app op het beginscherm staan (iOS 16.4+).

## Niet meer gebruikt

- `setup_final.sql` en `../supabase.sql`: oude setup-scripts, enkel ter referentie. Niet opnieuw uitvoeren.
- Tabel `user_push_tokens` en kolom `profiles.fcm_token`: vervangen door `push_subscriptions`.
- Kolommen `profiles.rol` en `profiles.roles`: vervangen door groepen/werkgroepen; kunnen later weg.
- Tabellen `quotes`, `quote_votes`, `bierpong_games`, `bierpong_kampioenen`, `personal_todos`: niet meer gebruikt door de app.
- Edge function `google-sheets-sync`: kan uit het project verwijderd worden (Dashboard > Edge Functions).
