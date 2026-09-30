# KSA-app (KSA Aalter)

## Wat is deze app?
Een installeerbare mobiele webapp (PWA) **enkel voor de leiding** van KSA Aalter. Leiding gebruikt ze om drank te strepen en af te rekenen, friet te bestellen, de agenda van grote evenementen en leidingsvergaderingen te volgen, berichten te ontvangen en te stemmen in polls.

## Gebruikers, groepen en rollen
- Alleen leiding heeft een account.
- **Registratie**: iedereen met de link kan registreren met e-mail + wachtwoord, maar **alleen met een e-mailadres dat eindigt op `@ksa-aalter.be`**. Controleer dit **server-side** (Supabase auth hook of database-trigger), niet enkel in de frontend.
- Iemand kan **meerdere rollen tegelijk** hebben.
- **Groepen** (vaste lijst, van jong naar oud): Pagadders, Kabouters, Sloebers, Tieners, Jim, Sim, Kim.
- **Werkgroepen**: vrij in te stellen door de hoofdleiding in de app, bv. Drankteam of Sfeerbeheer.
- **Hoofdleiding** is ook admin.
- **Alleen hoofdleiding** kent groepen en werkgroepen toe aan leiding.
- Rollen **bepalen wat je ziet en mag doen**. Dwing rechten af met **Supabase Row Level Security (RLS)**, niet alleen door knoppen te verbergen.

## Rechten per functie
| Functie | Wie |
|---|---|
| Agenda bekijken | Alle leiding |
| Agenda-items maken | Alle leiding |
| Agenda-items aanpassen | Wie het item maakte + hoofdleiding + werkgroep Sfeerbeheer |
| Agenda-items verwijderen | Wie het item maakte + hoofdleiding (alles) |
| Aftelklokken beheren | Hoofdleiding + werkgroep Sfeerbeheer |
| Verslagen lezen en toevoegen | Alle leiding |
| Verslagen aanpassen/verwijderen | Auteur + hoofdleiding |
| Zelf strepen zetten | Alle leiding (voor zichzelf); eigen streep verwijderen tot 1 uur na het zetten |
| Strepen zetten en verwijderen voor anderen | Drankteam (op elk moment, via hun dashboard) |
| Dranken, prijzen, voorraad, facturatie, archief | Drankteam |
| Frietbestelronde openen/afsluiten | Alle leiding |
| Friet bestellen voor een ander | Alle leiding (die persoon krijgt een melding) |
| Friet-menu en -prijzen beheren | Hoofdleiding + Drankteam |
| Berichten sturen | Hoofdleiding + rollen die de hoofdleiding daarvoor aanduidt |
| Nudges sturen | Alle leiding |
| Polls maken | Hoofdleiding + rollen die de hoofdleiding aanduidt |
| Rollen beheren | Hoofdleiding (er is altijd minstens één actieve hoofdleiding) |

## Functies

### Agenda — behouden
- Inhoud: **grote evenementen** (kamp, weekends, fuiven, eetfestijn) en **leidingsvergaderingen**. Geen wekelijkse activiteiten per groep.
- **Aanwezigheid**: leiding duidt aan of ze komt (komt / komt niet / misschien).
- **Meldingen**: pushmelding bij een nieuw item en een herinnering de dag vooraf om 18u (Belgische tijd).
- **Bijlagen**: bij een agenda-item kan je bestanden zetten, bv. de intro voor de groepsraad (privé-opslag, max 10 MB per bestand, enkel leiding kan ze openen).

### Verslagen — nieuw
- Verslagen van groepsraden: titel, datum, tekst en bijlagen, optioneel gekoppeld aan een agenda-item.
- Alle leiding leest en voegt toe; de auteur en hoofdleiding passen aan of verwijderen. Melding naar alle leiding bij een nieuw verslag.

### Drank en strepen — behouden
- Leiding zet **zelf** strepen en kan een eigen streep verwijderen tot 1 uur na het zetten (zolang ze niet gefactureerd is). **Drankteam** kan strepen van iedereen toevoegen en verwijderen, op elk moment, bv. bij correcties.
- **Dranken en prijzen** beheert Drankteam in de app.
- **Voorraad**: elke streep trekt automatisch af van de voorraad. Drankteam kan corrigeren na een manuele telling.
- **Facturatie**: Drankteam **sluit zelf een periode af**. Daarbij wordt per leider een factuur gemaakt, met **Excel-export**.
- **Schatting en echte kost**: tijdens de periode ziet iedereen een schatting = eigen strepen × de prijs van de drank (de laatst ingestelde prijs, bv. die van de vorige bak). Bij het afsluiten vult Drankteam de **echte kost** in (bv. factuur van de brouwer); die wordt verdeeld over alle strepen van de periode en bepaalt de factuur. Zonder echte kost blijft het aantal × prijs.
- **Archief**: afgesloten periodes terugbekijken.
- **Streaks**: een **ranking** van wie het meest streepte in de huidige periode.
- **Gewone leiding ziet**: eigen verbruik, eigen openstaande factuur en eigen historiek (eerdere facturen, betaald of niet betaald).
- **Betalen**: toon op de factuur het bedrag, het rekeningnummer en een gestructureerde mededeling, plus een **EPC-QR-code** (SEPA-overschrijvings-QR) die je scant met je bank-app of Payconiq. Er gaat **geen geld via de app** en er is geen betaalprovider. De app bewaart nooit bank- of kaartgegevens van leiding, enkel de rekening van KSA. Drankteam duidt aan wanneer een factuur betaald is, met de hand of door een **CSV-export van het bankuittreksel** in te lezen (koppeling via gestructureerde mededeling en bedrag; het bestand wordt niet opgeslagen).

### Friet — behouden
- Werkt met **bestelrondes**: iedereen kan een ronde openen, leiding voegt bestellingen toe, en iedereen kan de ronde afsluiten.
- Je bestelt uit een **menu met prijzen**, dat in de app beheerd wordt.
- **Prijzen**: de prijs van een bestelling komt altijd uit het menu (server-side afgedwongen). Enkel hoofdleiding en Drankteam passen prijzen aan, ook van bestellingen achteraf.
- **Bestellen voor een ander**: elke leider mag voor een ander bestellen. Die persoon krijgt altijd een melding (en push) met wie besteld heeft, wat en voor welk bedrag.
- Het bedrag komt **op de drankfactuur** van de leider.
- **Kasticket**: foto bij het afsluiten; enkel zichtbaar voor leiding (privé-opslag, tijdelijke links).
- Na het afsluiten volgt een overzicht per item (totalen voor de frituur) en per persoon.

### Berichten — behouden
- **Nieuw bericht**: naar alle leiding, een groep of een werkgroep. Enkel toegestane rollen mogen sturen.
- **Meldingen**: een overzicht van alle ontvangen meldingen.
- **Nudges**: iedereen kan een andere leider een kort seintje sturen.
- **Pushmeldingen**: echte web-push op je gsm. Op iPhone werkt dit alleen als de app op het beginscherm staat (iOS 16.4+).

### Polls — nieuw
- Een vraag met meerdere opties, met een deadline, en de resultaten zichtbaar voor alle leiding.
- Iedereen stemt één keer en kan zijn stem aanpassen tot de deadline.

### Beheer
- **Rollen beheren**: hoofdleiding kent groepen en werkgroepen toe, en maakt werkgroepen aan of verwijdert ze. De laatste actieve hoofdleiding kan de rol niet verliezen, niet op inactief gezet en niet verwijderd worden (server-side afgedwongen), zodat er altijd iemand rollen kan uitdelen.
- **Instellingen**: profiel, wachtwoord wijzigen, meldingen aan of uit.

### Verwijderen
- `BierpongScreen` en `QuotesScreen`: verwijderd.
- `CredentialsScreen`: **blijft**. Het is het login- en registratiescherm.

## Beslissingen
- **Registratie-uitzondering**: naast `@ksa-aalter.be` mag enkel het testaccount `it.takes.jaguarke@gmail.com` registreren (ook server-side zo afdwingen).
- **Streaks-ranking**: zichtbaar voor alle leiding.
- **Geen vaste rollen in de code**: werkgroepen (bv. Drankteam, Sfeerbeheer) maakt de hoofdleiding zelf aan in de app. Enkel de 7 groepen en de hoofdleiding zijn vast.
- **Later**: Winkeltje en Financieel dashboard blijven in de code staan, maar vallen buiten de MVP.
- **Behouden**: Friet-vergelijking en `CreditsScreen`.
- **Weggelaten**: Google Sheets-sync (Excel-export volstaat).
- **Alles gratis**: geen betaalde diensten. Pushmeldingen via standaard Web Push (VAPID) en de gratis tier van Supabase, zonder Firebase.
- **Enkel een webapp (PWA)**: geen native app, geen Capacitor. Trillen gebeurt via de Vibration API van de browser.
- **Hosting**: Vercel. Vercel Analytics en Speed Insights blijven.
- **Opslag**: kastickets (`receipts`) zijn privé; profielfoto's (`avatars`) zijn publiek, maar enkel door jezelf aan te passen.

## Tech stack
- React + Vite
- **JavaScript (JSX), geen TypeScript.**
- Tailwind CSS
- Supabase (auth, database, RLS)
- PWA: installeerbaar, met web-push

## Mappenstructuur (doel)
Groepeer per functie, niet per bestandstype:
```
src/
├── features/
│   ├── agenda/
│   ├── drank/
│   ├── friet/
│   ├── berichten/
│   ├── polls/
│   ├── beheer/
│   └── auth/
├── components/     ← herbruikbare UI (BottomNav, knoppen, ...)
├── lib/            ← supabase-client, helpers
└── App.jsx
```

## Regels voor Claude
- Antwoord in het Nederlands.
- Werk in kleine stappen. Controleer na elke stap dat `npm run dev` zonder fouten start.
- Stel een commit voor na elke werkende stap.
- Geen geheime sleutels in de code. De Supabase-URL en anon key komen uit `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), en `.env` staat in `.gitignore`. Een service_role key komt nooit in de frontend.
- Verwijder of wijzig nooit tabellen of data in Supabase zonder het eerst te vragen. Databasewijzigingen gaan via SQL-migratiebestanden in `supabase/migrations/`.
- Werk mobiel eerst.

## Commando's
- `npm install`: dependencies installeren
- `npm run dev`: app lokaal starten (http://localhost:5173)
- `npm run build`: productieversie bouwen
- `npm run preview`: gebouwde versie lokaal draaien (nodig om pushmeldingen en de PWA te testen)
- Database: migraties en instellen van push staan in `supabase/README.md`
