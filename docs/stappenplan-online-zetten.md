# Stappenplan: KSA-app online zetten

Wat je zelf doet, en wat Claude doet zodra jij toegang gegeven hebt.
Werk de delen in volgorde af. Deel 4 (Google Drive) mag later.

---

## Deel 1 — Toegang geven (jij, ± 5 minuten)

### Stap 1. Cron aanzetten in Supabase
Supabase-dashboard > je project > **Integrations** > **Cron** > aanzetten.

> Doe dit vóór de migraties, anders wordt de agenda-herinnering van 18u niet ingepland.

### Stap 2. Toegangssleutel (access token) voor de Supabase-tool
(`npx supabase login` werkt niet vanuit Claude Code: het vraagt een gewone terminal.)

1. Ga naar <https://supabase.com/dashboard/account/tokens> (ingelogd als eigenaar van het project).
2. **Generate new token**, naam bv. `ksa-app-claude`, en kopieer de token (begint met `sbp_`).
3. Zet hem in `.env.local` (zie stap 3) als:

   ```
   SUPABASE_ACCESS_TOKEN=sbp_...
   ```

Hiermee kan Claude de instellingen, geheime sleutels en edge functions regelen.
Als alles online staat, kan je de token op dezelfde pagina intrekken (**Revoke**).

### Stap 3. Databaseverbinding in een lokaal bestand zetten
1. Supabase-dashboard > knop **Connect** (bovenaan) > tabblad **Connection string** > kies **Session pooler**.
2. Kopieer de link. Die begint met `postgresql://postgres.ukndvvsqreidugcfuiqq:[YOUR-PASSWORD]@…`.
3. Vervang `[YOUR-PASSWORD]` door je databasewachtwoord.
   Kwijt? Project Settings > Database > **Reset database password**.
4. Maak in `C:\dev\KSA\ksaApp` een bestand **`.env.local`** met deze regel:

   ```
   SUPABASE_DB_URL=postgresql://postgres.ukndvvsqreidugcfuiqq:JOUWWACHTWOORD@aws-0-....pooler.supabase.com:5432/postgres
   ```

> `.env.local` staat in `.gitignore`: het komt nooit op GitHub. Zet het wachtwoord nooit in de chat.

### Stap 4. Laat Claude weten dat stap 1 tot 3 klaar zijn

---

## Deel 2 — Wat Claude dan doet (jij hoeft niets te doen)

- [ ] **Back-up** van alle tabellen en gegevens naar `C:\dev\KSA\backups\` (buiten de projectmap)
- [ ] **Migraties** `000100` tot en met `001800` één voor één uitvoeren; bij een fout wordt gestopt en gemeld
- [ ] **Controlescript** `supabase/queries/controleer_migraties.sql` draaien
- [ ] **Supabase-instellingen**: "Confirm email" aan, wachtwoord minstens 8 tekens
- [ ] **Pushmeldingen**: sleutels maken, geheime sleutel rechtstreeks in Supabase zetten
- [ ] **Edge functions** `send-push` en `drive-fotos` deployen
- [ ] Je de **publieke pushsleutel** geven voor stap 6

---

## Deel 3 — Afwerken (jij, ± 10 minuten)

### Stap 5. Webhook voor pushmeldingen
Dashboard > **Database** > **Webhooks** > **Create a new hook**:

| Veld | Waarde |
|---|---|
| Naam | `send-push` |
| Tabel | `notificaties` |
| Events | **Insert** |
| Type | **Supabase Edge Functions** |
| Functie | `send-push`, methode POST |
| Auth header | "Add auth header with service key" aanzetten (als die optie er staat) |

Opslaan.

### Stap 6. Vercel-instellingen
Vercel > je project > **Settings** > **Environment Variables**:

| Naam | Waarde |
|---|---|
| `VITE_VAPID_PUBLIC_KEY` | de sleutel die Claude je geeft |
| `CRON_SECRET` (optioneel) | een willekeurige lange tekst |

### Stap 7. Online zetten
Zeg tegen Claude: **"zet online"**. Claude voegt `mvp` samen met `main` en pusht; Vercel zet de nieuwe versie automatisch live.

### Stap 8. Testen op de echte site
- [ ] Open een link rechtstreeks, bv. `…/agenda`: je ziet de app, geen foutpagina
- [ ] Inloggen werkt (ook op gsm)
- [ ] Pushmeldingen aanzetten in Instellingen; laat iemand je een nudge sturen
- [ ] Vercel > Settings > **Cron Jobs**: de taak `/api/keepalive` staat erbij

---

## Deel 4 — Google Drive voor foto's (jij, ± 15 minuten, mag later)

Doe alles met het **KSA-Google-account**.

1. Ga naar <https://console.cloud.google.com> en maak een project **"KSA app"**.
2. **Drive API aanzetten**: APIs & Services > Library > "Google Drive API" > **Enable**.
3. **Toestemmingsscherm** (Google Auth Platform):
   - type **External**, appnaam "KSA app"
   - scope toevoegen: `https://www.googleapis.com/auth/drive`
   - status op **In production** zetten (anders vervalt de koppeling na 7 dagen)
4. **Client maken**: Credentials > Create credentials > **OAuth client ID** > **Web application**.
   Redirect-URI: `https://developers.google.com/oauthplayground`
5. **Toestemming ophalen** op <https://developers.google.com/oauthplayground>:
   - tandwiel > "Use your own OAuth credentials" > client ID en secret invullen
   - Step 1: scope `https://www.googleapis.com/auth/drive` > **Authorize APIs** > inloggen met het KSA-account
     (waarschuwing "niet geverifieerd"? Kies Geavanceerd > Doorgaan)
   - Step 2: **Exchange authorization code for tokens** > kopieer de **Refresh token**
6. **Id van de fotomap**: open de map in Drive; het id is het stuk na `/folders/` in de link.
7. Zet de vier waarden in `.env.local`:

   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REFRESH_TOKEN=...
   DRIVE_FOTOS_MAP_ID=...
   ```

8. Laat het Claude weten: die zet ze als geheime sleutels in Supabase.

> Deel de fotomap in Drive enkel met de leiding, niet met "iedereen met de link".

---

## Deel 5 — Met de leiding

### Stap 9. Testen met iedereen
- [ ] Deel de **testlijst** via de knop Delen, met de rol **Contributor**:
  <https://claude.ai/artifact/YL3tJQiChNuVuVBDpwCVYG>
- [ ] Laat iedereen de app op het **beginscherm** van de gsm zetten
  (iPhone: Delen > "Zet op beginscherm"; Android: menu > "App installeren")
- [ ] Bugs noteren in de testlijst

---

## Later, bij het finetunen
- Rest van de schermen in de nieuwe stijl (strepen, friet, agenda, meldingen)
- Slepen in "Volgorde bollen"
- Opruimen: ongebruikte schermen, oude tabellen, edge function `cleanup-inactive-accounts`
- Beslissing: mag wie voor een ander bestelde, die bestelling annuleren?
