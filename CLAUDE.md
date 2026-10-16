# KSA-app (KSA Aalter)

## Wat is deze app?
Een installeerbare mobiele webapp (PWA) **enkel voor de leiding** van KSA Aalter. Leiding gebruikt ze om drank te strepen en af te rekenen, friet te bestellen, de agenda van grote evenementen en leidingsvergaderingen te volgen, berichten te ontvangen en te stemmen in polls.

## Gebruikers, groepen en rollen
- Leiding heeft een account, en **oudleiding** ook (zie hieronder).
- **Registratie**: iedereen met de link kan registreren met voornaam, achternaam, e-mail + wachtwoord, maar **alleen met een e-mailadres dat eindigt op `@ksa-aalter.be`**. Controleer dit **server-side** (Supabase auth hook of database-trigger), niet enkel in de frontend.
- **Goedkeuring i.p.v. bevestigingsmail**: de app mailt nooit (DNS-records voor Resend op ksa-aalter.be komen er niet). Een nieuw account start inactief (`profiles.goedkeuring = 'wacht'`) en ziet een wachtscherm. Elke actieve leider die de app opent, krijgt een pop-up die niet weg kan: voornaam, achternaam, e-mail, "Is of wordt deze persoon leiding?" → **Verifiëren** of **Afwijzen**. De eerste beslissing telt. Geen melding of push. Oudleiding (met de code van Drankteam) is meteen actief. "Confirm email" staat uit in Supabase en blijft uit.
- Iemand kan **meerdere rollen tegelijk** hebben.
- **Groepen** (vaste lijst, van jong naar oud): Pagadders, Kabouters, Sloebers, Tieners, Jim, Sim, Kim.
- **Precies één groep per leider**, opnieuw te kiezen elk werkjaar: bij de eerste keer in de app en vanaf **1 september** vraagt de app je groep (scherm "Wat is je groep?"). Daarna past enkel de hoofdleiding ze nog aan. Werkgroepen: geen, één of meer.
- **Oudleiding**: heeft geen `@ksa-aalter.be`-mail meer en logt in met **gebruikersnaam + wachtwoord** (intern `<gebruikersnaam>@oudleiding.ksa-aalter.be`, er wordt nooit naar gemaild). Ze registreren zelf met een **code die Drankteam instelt** (edge function `oudleiding`; na 10 foute codes een uur geblokkeerd). Ze zien enkel: strepen (ook de ranking, samen met leiding), hun drankrekening (betalen met QR), friet en de agenda-items die met oudleiding gedeeld zijn (daar duiden ze ook aanwezigheid aan). Geen andere agenda-items, bijlagen, verslagen, polls, foto's of meldingen aan alle leiding. Wachtwoord vergeten: Drankteam stelt een nieuw in. Leiding die stopt, zet de hoofdleiding op "Oudleiding" (account en historiek blijven).
- **Werkgroepen**: vrij in te stellen door de hoofdleiding in de app, bv. Drankteam of Sfeerbeheer.
- **Hoofdleiding** is ook admin.
- **Godmode** (verborgen beheeraccount, migratie 003100): heeft alle rechten (telt in de database als hoofdleiding), maar ziet er in de app uit als een gewone leider (geen label). Staat in de tabel `godmode_accounts`, waar de app niet aan kan: enkel in de database toe te voegen of weg te halen. Niemand in de app (ook hoofdleiding of het account zelf) kan rollen, status of e-mail van een Godmode-account aanpassen of het verwijderen. Telt mee voor "altijd minstens één hoofdleiding". In de frontend: `isHoofdleiding(user)` = rechten (incl. Godmode), `user.isHoofdleiding` = label.
- **Alleen hoofdleiding** kent groepen en werkgroepen toe aan leiding.
- Rollen **bepalen wat je ziet en mag doen**. Dwing rechten af met **Supabase Row Level Security (RLS)**, niet alleen door knoppen te verbergen.

## Rechten per functie
| Functie | Wie |
|---|---|
| Agenda bekijken | Alle leiding; oudleiding enkel de items die met hen gedeeld zijn |
| Agenda-items maken | Alle leiding |
| Agenda-items aanpassen | Wie het item maakte + hoofdleiding + werkgroep Sfeerbeheer |
| Agenda-items verwijderen | Wie het item maakte + hoofdleiding (alles) |
| Aftelklokken beheren | Hoofdleiding + werkgroep Sfeerbeheer |
| Verslagen lezen en toevoegen | Alle leiding |
| Verslagen aanpassen/verwijderen | Auteur + hoofdleiding |
| Zelf strepen zetten | Alle leiding (voor zichzelf); eigen streep verwijderen tot 1 uur na het zetten |
| Strepen zetten en verwijderen voor anderen | Drankteam (op elk moment, via hun dashboard) |
| Dranken, prijzen, voorraad, facturatie, archief | Drankteam |
| Drankfactuur op betaald zetten | Drankteam + Financiën + hoofdleiding |
| Financiën: overzicht van iedereen, andere betalingen, herinneringen, Google Sheet | Werkgroep met recht Financiën + hoofdleiding |
| Eigen openstaande bedragen en voorlopige drankrekening zien | Alle leiding en oudleiding (enkel de eigen) |
| Strepen, ranking, friet bestellen | Alle leiding en oudleiding |
| Oudleiding: registratiecode, nieuw wachtwoord, account aan/uit | Drankteam + hoofdleiding |
| Iemand op oudleiding zetten | Hoofdleiding |
| Friet zonder account op betaald zetten | Drankteam |
| Frietbestelronde openen/afsluiten | Alle leiding |
| Friet bestellen voor een ander | Alle leiding (die persoon krijgt een melding); voor iemand zonder account: naam typen (Drankteam krijgt een melding) |
| Friet-menu en -prijzen beheren | Hoofdleiding + Drankteam |
| Berichten sturen | Hoofdleiding + rollen die de hoofdleiding daarvoor aanduidt |
| Nudges sturen | Alle leiding |
| Polls maken | Hoofdleiding + rollen die de hoofdleiding aanduidt |
| Rollen beheren | Hoofdleiding (er is altijd minstens één actieve hoofdleiding) |

## Functies

### Startscherm — design-update (Instagram-stijl)
- **Bollen** bovenaan, horizontaal scrollbaar: Friet, Agenda, Polls, Verslagen, Foto's voor iedereen; rol-bollen (Team drank, Friet beheer, Agenda beheer, Berichten, Nieuwe poll, Financiën, Winkeltje, Rollen) enkel met dat recht; hoofdleiding ziet alles. Oranje ring = iets nieuws of open. Definitie in `src/features/home/bollen.js`.
- **Groot veegbaar vierkant**: frietronde (enkel als er een ronde loopt), strepen (vandaag gestreept, snelle drank +1, twee andere dranken, "Alle…"), ranking.
- Daaronder de **twee eerstvolgende agenda-items** en onderaan de **aftelklok** (bv. kamp).
- **Instellingen**: gegroepeerde lijst; "Volgorde bollen" (per leider, bewaard op het profiel) en "Snelle drank".
- Stijl: lettertype Plus Jakarta Sans, pastels per bol en donkere knoppen (`inkt`), tokens in `tailwind.config.js`.
- **Computer** (vanaf 1024px, Tailwind `lg:`): zijbalk links i.p.v. menubalk onderaan, inhoud met leesbreedte (`max-w-3xl`), startscherm breder in twee kolommen, pop-ups als gecentreerd venster. Vaste balken onderaan krijgen `lg:left-60` zodat ze naast de zijbalk staan. Op gsm verandert er niets.

### Agenda — behouden
- Inhoud: **grote evenementen** (kamp, weekends, fuiven, eetfestijn) en **leidingsvergaderingen**. Geen wekelijkse activiteiten per groep.
- **Aanwezigheid**: leiding duidt aan of ze komt (komt / komt niet / misschien).
- **Meerdaags**: een item kan meerdere dagen duren (eerste en laatste dag, bv. weekend of kamp). Het blijft in "aankomend" staan tot de laatste dag voorbij is.
- **Delen met oudleiding**: per item aan te vinken ("Ook voor oudleiding"). Oudleiding ziet enkel die items, duidt aanwezigheid aan en krijgt een eigen melding en herinnering. Bijlagen blijven enkel voor leiding.
- **Beheerscherm** ("Maak nieuw event" naast "Nieuwe events"): toont enkel aankomende items, chronologisch.
- **Meldingen**: pushmelding bij een nieuw item en een herinnering de dag vooraf om 18u (Belgische tijd).
- **Bijlagen**: bij een agenda-item kan je bestanden zetten, bv. de intro voor de groepsraad (privé-opslag, max 10 MB per bestand, enkel leiding kan ze openen).

### Foto's — nieuw
- Foto's staan in de **Google Drive van KSA** (ook die van het cameraatje, dat rechtstreeks naar Drive uploadt).
- De app toont de albums (submappen van één hoofdmap); bekijken gebeurt in Drive, waar ook de rechten staan. Het zijn foto's van en voor de leiding (geen kinderen); deel de map enkel met de leiding, niet met "iedereen met de link".
- Alle leiding kan albums maken en foto's/video's toevoegen via de app (max 200 MB per bestand). De upload gaat rechtstreeks van de gsm naar Google, in naam van het KSA-Google-account (edge function `drive-fotos`; sleutels enkel als Supabase-secrets).

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
- **Betalen**: toon op de factuur het bedrag, het rekeningnummer en een gestructureerde mededeling, plus een **EPC-QR-code** (SEPA-overschrijvings-QR) die je scant met je bank-app of Payconiq. Er gaat **geen geld via de app** en er is geen betaalprovider. De app bewaart nooit bank- of kaartgegevens van leiding, enkel de rekening van KSA. Drankteam (of Financiën) duidt aan wanneer een factuur betaald is, met de hand of door een **CSV-export van het bankuittreksel** in te lezen (koppeling via gestructureerde mededeling en bedrag; het bestand wordt niet opgeslagen).

### Financiën — nieuw
- **Overzichtstab** (recht `financien` + hoofdleiding): wie moet nog wat betalen en wat is al binnen. De formele boekhouding blijft in aparte Excels in de Drive.
- Twee soorten bedragen per leider, samen in één overzicht (`financien_overzicht()`):
  - **Drankfacturen**: rechtstreeks die van Drankteam (bij het afsluiten van een periode). Bedragen pas je niet aan in Financiën.
  - **Andere betalingen** (t-shirts, truien, activiteiten, …): één betaling voor een selectie leiding (alle leiding, een groep, een werkgroep of gekozen personen) met hetzelfde bedrag, per leider aan te passen. Optionele deadline ("te betalen voor"); te laat = rood.
- Elke leider krijgt per bedrag een **eigen gestructureerde mededeling** (andere betalingen: nummerreeks vanaf 5 000 000 000, botst nooit met de drankfacturen) en **dezelfde EPC-QR** naar de KSA-rekening.
- Geen gedeeltelijke betalingen: betaald of niet betaald (met datum en opmerking).
- **Herinneringen**: met één knop een melding (en push) naar wie nog niet betaalde, per betaling of per leider; optioneel ook bij het aanmaken.
- **Bankuittreksel**: het CSV-inlezen werkt voor drankfacturen én andere betalingen.
- **Mijn rekening** (alle leiding): eigen open drankfacturen, eigen andere betalingen met QR en deadline, en de voorlopige rekening van de lopende drankperiode.
- **Google Sheet, in twee richtingen** (edge function `financien-sheet`, logica in `supabase/functions/_shared/financienSheet.js`, getest in `tests/financienSheet.test.js`):
  - tabblad *Betalingen*: één rij per bedrag per leider; aanpasbaar in de Sheet: Betaald, Betaald op, Opmerking en het bedrag van andere betalingen. Een nieuwe rij (Omschrijving + Leider + Bedrag) wordt een nieuwe andere betaling.
  - tabblad *Overzicht*: per leider wat openstaat (enkel lezen).
  - tabblad *Strepen*: aantal strepen per leider per drank in de lopende periode, met totalen per drank en de prijs per streep uit de app (enkel lezen). Elke streep (erbij of eraf) en elke prijswijziging staat er binnen enkele seconden; bij het afsluiten van een periode begint het opnieuw. Zo kan Financiën/Drankteam de prijs per streep ook in de Sheet berekenen.
  - app → Sheet: binnen enkele seconden (databasetrigger + pg_net). Sheet → app: elke 30 seconden (pg_cron) of met "Nu synchroniseren".
  - wijzigingen worden herkend door te vergelijken met de vorige synchronisatie; past iemand dezelfde cel tegelijk in de app en in de Sheet aan, dan wint de app. Verwijderen gebeurt enkel in de app.
  - **Noodplan (terug naar de Sheet zoals vroeger)**: schakelaar "Koppeling met de app" AAN/UIT in de Sheet zelf (tabblad Uitleg, cel B2) én in de app. Op UIT raakt de app het rekenblad niet meer aan; werkt ook als de app plat ligt. Terug op AAN: eerst een reservekopie, dan neemt de app de aanpassingen uit de Sheet over (betaald, datums, opmerkingen, bedragen, nieuwe rijen) en zet ze terug wat de app beheert (verwijderde rijen, grijze kolommen, Overzicht, Strepen).
  - **Reservekopie**: elke dag een losse, niet-gekoppelde kopie van het rekenblad in dezelfde Drive-map, 14 dagen bewaard.
  - **Veiligheid**: zijn de kolommen van Betalingen veranderd (bv. een kolom ingevoegd), dan weigert de app te synchroniseren tot ze terug kloppen.

### Friet — behouden
- Werkt met **bestelrondes**: iedereen kan een ronde openen, leiding voegt bestellingen toe, en iedereen kan de ronde afsluiten.
- Je bestelt uit een **menu met prijzen**, dat in de app beheerd wordt.
- **Prijzen**: de prijs van een bestelling komt altijd uit het menu (server-side afgedwongen). Enkel hoofdleiding en Drankteam passen prijzen aan, ook van bestellingen achteraf.
- **Bestellen voor een ander**: elke leider mag voor een ander bestellen. Die persoon krijgt altijd een melding (en push) met wie besteld heeft, wat en voor welk bedrag.
- Het bedrag komt **op de drankfactuur** van de leider.
- **Iemand zonder account** (lief, vriend, oudleiding zonder app): bij "Bestel in de naam van iemand anders" typ je de naam. Dat komt op **geen drankfactuur**: Drankteam krijgt een melding en houdt in Friet beheer > "Zonder account" bij wie al betaald heeft.
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
- **Geen e-mail**: geen bevestigingsmail en geen "wachtwoord vergeten"-mail. Nieuwe accounts keurt de leiding goed in de app (zie Gebruikers).
- **Registratie-uitzondering**: naast `@ksa-aalter.be` mag enkel het testaccount `it.takes.jaguarke@gmail.com` registreren (ook server-side zo afdwingen).
- **Streaks-ranking**: zichtbaar voor alle leiding.
- **Geen vaste rollen in de code**: werkgroepen (bv. Drankteam, Sfeerbeheer) maakt de hoofdleiding zelf aan in de app. Enkel de 7 groepen en de hoofdleiding zijn vast.
- **Later**: Winkeltje blijft in de code staan, maar valt buiten de MVP.
- **Behouden**: Friet-vergelijking en `CreditsScreen`.
- **Google Sheets**: enkel voor Financiën, in twee richtingen (zie Financiën). Voor drank blijft de Excel-export.
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
- `npm test`: automatische tests (Node-testrunner, map `tests/`) voor rekenlogica zoals betaal-QR en bankuittreksel
- Database: migraties en instellen van push staan in `supabase/README.md`
