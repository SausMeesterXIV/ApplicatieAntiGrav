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
| `20261001001800_keepalive.sql` | `ping()` voor de dagelijkse wektaak (project pauzeert niet meer) |
| `20261001001900_push_webhook.sql` | Elke nieuwe melding naar send-push (vervangt de dashboard-webhook); sleutel in de Vault |
| `20261001002000_functierechten.sql` | Geen functies meer uitvoerbaar via PUBLIC/zonder login; vast search_path (Security Advisor) |
| `20261001002100_triggerfuncties.sql` | Triggerfuncties niet aanroepbaar voor ingelogden (Security Advisor) |
| `20261001002200_gelezen_en_frietronde.sql` | Gelezen-status van meldingen per persoon (elk toestel); hoogstens één lopende frietronde |
| `20261001002300_streep_open_periode_en_meldingen.sql` | Strepen altijd in de open periode (ook offline gezette); meldingen enkel voor actieve leiding; wie voor een ander friet bestelde, mag annuleren (met melding) |
| `20261001002500_oudleiding_groepen_extern.sql` | Oudleiding (gebruikersnaam, registreren met code van Drankteam; enkel strepen, rekening en friet), precies één groep per leider per werkjaar, friet voor iemand zonder account (aparte lijst voor Drankteam). Daarna edge function `oudleiding` deployen en `send-push` opnieuw deployen (zie 3c) |
| `20261001002400_financien.sql` | Financiën: andere betalingen (t-shirts, truien, activiteiten) met eigen mededeling, één overzicht met de drankfacturen, betaald zetten (Drankteam/Financiën), koppeling met een Google Sheet (zie hieronder) |
| `20261001002600_agenda_meerdaags_oudleiding.sql` | Agenda: meerdaagse items (laatste dag) en items delen met oudleiding (zien, aanwezigheid, eigen melding en herinnering); na 002500 |

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
5. **Webhook**: niet via het dashboard maar via migratie `001900` (pg_net). Zet eenmalig de service-sleutel in de Vault:
   `select vault.create_secret('<service_role key>', 'send_push_service_key');`
   (Project Settings > API Keys > Legacy > service_role). Zonder sleutel gebeurt er niets.
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

## 3b. Financiën: Google Sheet (twee richtingen)

Financiën (en hoofdleiding) kan in de app een rekenblad laten maken dat in twee richtingen gekoppeld is:
wat in de app verandert, staat binnen enkele seconden in de Sheet; wat in de Sheet verandert, staat binnen
ongeveer 30 seconden in de app. Hiervoor gebruiken we **dezelfde Google-koppeling als de foto's** (sectie 3).

1. **Migratie `20261001002400_financien.sql`** uitvoeren (SQL Editor). Ze gebruikt de Vault-sleutel
   `send_push_service_key` (sectie 2) en pg_cron (sectie 2, stap 6): die moeten er dus al zijn.
   Kreeg je de melding "pg_cron niet beschikbaar"? Zet Cron aan en voer het laatste `do $ … $`-blok van de migratie nog eens uit.
2. **Google Sheets API aanzetten** in hetzelfde Google Cloud-project als de foto's:
   APIs & Services > Library > "Google Sheets API" > Enable. (De refresh token met scope `…/auth/drive` volstaat.)
3. **Map in Drive** (aangeraden): maak met het KSA-account een map, bv. "Financiën app", en deel ze **enkel**
   met Financiën en hoofdleiding. Zet de id van die map als secret:
   - `FINANCIEN_MAP_ID` = laatste stuk van de URL (`https://drive.google.com/drive/folders/<ID>`)
   Zonder deze secret komt het rekenblad bovenaan in de Drive van het KSA-account.
4. **Edge function deployen**:
   ```
   npx supabase functions deploy financien-sheet --project-ref <project-ref>
   ```
   (De map `functions/_shared` gaat automatisch mee.)
5. In de app: **Financiën > Wie moet betalen > Google Sheet > Rekenblad aanmaken**. Het blad wordt meteen gevuld.

Het rekenblad heeft vier tabbladen: *Overzicht* (wie moet wat betalen), *Betalingen* (aanpasbaar), *Strepen*
(aantal strepen per leider per drank in de lopende periode, live, enkel lezen) en *Uitleg*.

Een oud rekenblad overnemen: kopieer de rijen onderaan het tabblad *Betalingen* (Omschrijving, Leider zoals in de
app, Bedrag, optioneel Te betalen voor en Betaald). Bij de volgende synchronisatie worden het andere betalingen.
Rijen die de app niet kan verwerken (bv. onbekende naam) blijven staan en verschijnen als aandachtspunt in de app
en onderaan het tabblad *Overzicht*.

**Noodplan: terug naar enkel de Sheet, zoals vroeger**
- Zet in het rekenblad (tabblad *Uitleg*, bovenaan) "Koppeling met de app" op **UIT**, of in de app: Financiën > Google Sheet >
  "Koppeling uitzetten". Vanaf dan raakt de app het rekenblad niet meer aan en werk je erin zoals vroeger.
  Dit werkt ook als de app zelf plat ligt (de schakelaar staat in de Sheet).
- Elke dag staat er een **losse reservekopie** in dezelfde Drive-map (14 dagen bewaard): "… – reservekopie JJJJ-MM-DD".
- Terug naar de app: zet de schakelaar op **AAN**. De app maakt eerst nog een reservekopie en neemt dan Betaald,
  Betaald op, Opmerking, Bedrag (andere betalingen) en nieuwe rijen over. Verwijderde rijen, de grijze kolommen en de
  tabbladen *Overzicht* en *Strepen* worden teruggezet zoals in de app. Voeg geen kolommen in *Betalingen* in:
  dan weigert de app te synchroniseren tot ze terug kloppen.

Werkt het niet? In de app staat de laatste fout onder "Google Sheet". Meest voorkomend:
- "Google Sheets API staat nog niet aan" > stap 2
- "De koppeling met Google werkt niet (meer)" > refresh token vernieuwen (sectie 3, stap 5)
- "rekenblad niet gevonden" > het blad werd verwijderd: maak een nieuw aan

> Let op: deze koppeling hangt aan het oude Google-account en is niet meer gelinkt in de app.
> Financiën gebruikt nu de Sheet van Drankteam (3d).

## 3d. Drankteam: Google Sheet (edge function `drank-sheet`)

Werkt met een **service account** (robot), niet met iemands persoonlijke Google-account.
Uitleg voor Team Drank: `C:\dev\KSA\KSA-app Team Drank handleiding.pdf`.

1. Google Cloud-project met de **Google Sheets API** aan; service account met een JSON-sleutel.
2. Secrets (Edge Functions > Secrets): `GOOGLE_SERVICE_ACCOUNT_B64` (de JSON-sleutel in base64) en
   `DRANK_SHEET_ID` (het id uit de link van de Sheet).
3. De Sheet maakt iemand van KSA zelf aan en deelt ze als **Bewerker** met het e-mailadres van de robot.
4. Deploy: `npx supabase functions deploy drank-sheet --project-ref <project-ref>` (MET JWT-controle).
5. Migraties `003600` (pg_cron: elke 30 seconden `drank_sheet_aanroepen()`) en `003700` (twee richtingen).

Werking (rekenlogica in `functions/_shared/drankSheet.js`, getest in `tests/drank*.test.js`):
- tabbladen Drankrekening, Bakken, Rekening, Strepen, Facturen, Info; enkel geschreven als er iets veranderde
- een aantal veranderd in Drankrekening wordt een streep met `bron = 'sheet'` (geen melding; app wint bij botsing)
- prijs per streepje uit Bakken (aankoopprijs + telling ingevuld) wordt `consumpties.prijs` van de open periode
- nieuwe periode: tellingen in Bakken leeg, aankoopprijs blijft
- indeling of formules gewijzigd? Verhoog `SHEET_VERSIE`, dan wordt alles opnieuw geschreven
- het antwoord van elke ronde (o.a. `formuleFouten`, `viaSheet`) staat in `net._http_response`

## 3c. Oudleiding

1. **Migratie `20261001002500_oudleiding_groepen_extern.sql`** uitvoeren (na 002400).
2. **Edge function deployen** (zonder JWT-controle: registreren gebeurt vóór het inloggen; de functie controleert
   zelf de code en de rechten, zie `config.toml`):
   ```
   npx supabase functions deploy oudleiding --project-ref <project-ref>
   ```
3. **`send-push` opnieuw deployen**: meldingen aan iedereen gaan niet meer naar oudleiding.
   ```
   npx supabase functions deploy send-push --project-ref <project-ref>
   ```
4. In de app (Drankteam): Team drank > **Oudleiding** > een code instellen en doorgeven aan oudleiding.
   Zonder code staat registreren voor oudleiding uit.

Na de migratie vraagt de app aan alle leiding één keer hun groep voor dit werkjaar (daarna elk jaar vanaf 1 september).

## 4. Wakker houden (gratis project pauzeert na 7 dagen zonder gebruik)

Gebeurt automatisch zodra de app op Vercel staat: `vercel.json` plant elke dag om 6u (UTC) `api/keepalive.js`,
die `ping()` aanroept (migratie `001800`). Nodig op Vercel: de variabelen `VITE_SUPABASE_URL` en
`VITE_SUPABASE_ANON_KEY` (staan er al voor de app). Optioneel: zet ook `CRON_SECRET` (een willekeurige lange tekst),
dan kan enkel Vercel zelf de functie aanroepen.
Controleren: Vercel-dashboard > project > Settings > Cron Jobs (of open `/api/keepalive`: `"ok": true`).

## Niet meer gebruikt

- `setup_final.sql` en `../supabase.sql`: oude setup-scripts, enkel ter referentie. Niet opnieuw uitvoeren.
- Tabel `user_push_tokens` en kolom `profiles.fcm_token`: vervangen door `push_subscriptions`.
- Kolommen `profiles.rol` en `profiles.roles`: vervangen door groepen/werkgroepen; kunnen later weg.
- Tabellen `quotes`, `quote_votes`, `bierpong_games`, `bierpong_kampioenen`, `personal_todos`: niet meer gebruikt door de app.
- Edge function `google-sheets-sync`: kan uit het project verwijderd worden (Dashboard > Edge Functions).
