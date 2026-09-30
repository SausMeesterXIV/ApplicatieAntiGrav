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
| `20261001001300_herinnering_18u.sql` | Agenda-herinnering om precies 18u (zomer- en winteruur) de dag vooraf |
| `20261001001400_agenda_bijlagen_verslagen.sql` | Iedereen zet items in de agenda (eigen items verwijderen, hoofdleiding alles), bijlagen, verslagen van groepsraden |
| `20261001001500_echte_kost.sql` | Tijdens de periode schatting (aantal × prijs); bij afsluiten echte kost verdeeld over alle strepen |
| `20261001001600_beveiliging.sql` | Niets voor niet-ingelogden, RLS op alle tabellen, strepen/frietbestellingen/meldingen afgeschermd |
| `20261001001700_startscherm_bollen.sql` | Volgorde van de bollen op het startscherm, per leider |

**Na alle migraties**: draai `queries/controleer_migraties.sql` (wijzigt niets). Elke rij is een controle;
alles met `ok = false` staat bovenaan en moet opgelost worden voor je de app test.

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

## 3. Foto's (Google Drive van KSA, gratis)

De app toont de albums (submappen) van één hoofdmap in Drive en laat leiding er foto's in zetten.
De app uploadt **in naam van het KSA-Google-account**: dat account geeft één keer toestemming.
De foto's gaan rechtstreeks van de gsm naar Google (niet via Supabase).
Wie de foto's mag **bekijken**, bepaal je in Drive zelf: het zijn foto's van de leiding, dus deel de hoofdmap
enkel met de leiding en niet met "iedereen met de link".

Doe alles met het **KSA-Google-account** (dat van de Drive met de foto's):

1. **Google Cloud-project**: ga naar <https://console.cloud.google.com>, maak een project, bv. "KSA app".
2. **Drive API aanzetten**: APIs & Services > Library > "Google Drive API" > Enable.
3. **OAuth consent screen** (Google Auth Platform):
   - type **External** (of **Internal** als ksa-aalter.be een Google Workspace is), appnaam "KSA app", je e-mailadres
   - scope toevoegen: `https://www.googleapis.com/auth/drive`
   - **Publishing status op "In production" zetten**. In "Testing" vervalt de toestemming na 7 dagen.
     Een verificatie door Google is niet nodig: bij stap 5 zie je enkel een waarschuwing
     ("Google heeft deze app niet geverifieerd" > Geavanceerd > Doorgaan).
4. **OAuth-client**: Credentials > Create credentials > OAuth client ID > **Web application**.
   Bij "Authorized redirect URIs": `https://developers.google.com/oauthplayground`. Noteer client ID en secret.
5. **Refresh token** ophalen via <https://developers.google.com/oauthplayground>:
   - tandwiel rechtsboven > "Use your own OAuth credentials" > client ID en secret invullen
   - Step 1: scope `https://www.googleapis.com/auth/drive` invullen > Authorize APIs > inloggen met het KSA-account
   - Step 2: "Exchange authorization code for tokens" > kopieer de **Refresh token**
6. **Hoofdmap-id**: open de fotomap in Drive; de id is het laatste stuk van de URL
   (`https://drive.google.com/drive/folders/<ID>`).
7. **Secrets** (Supabase Dashboard > Edge Functions > Secrets), **nooit** in de app of in git:
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`
   - `DRIVE_FOTOS_MAP_ID` = de id uit stap 6
8. **Edge function deployen**:
   ```
   npx supabase functions deploy drive-fotos --project-ref <project-ref>
   ```

Werkt het niet meer (bv. wachtwoord van het KSA-account gewijzigd of toegang ingetrokken)?
Herhaal stap 5 en vervang `GOOGLE_REFRESH_TOKEN`.

## Niet meer gebruikt

- `setup_final.sql` en `../supabase.sql`: oude setup-scripts, enkel ter referentie. Niet opnieuw uitvoeren.
- Tabel `user_push_tokens` en kolom `profiles.fcm_token`: vervangen door `push_subscriptions`.
- Kolommen `profiles.rol` en `profiles.roles`: vervangen door groepen/werkgroepen; kunnen later weg.
- Tabellen `quotes`, `quote_votes`, `bierpong_games`, `bierpong_kampioenen`, `personal_todos`: niet meer gebruikt door de app.
- Edge function `google-sheets-sync`: kan uit het project verwijderd worden (Dashboard > Edge Functions).
