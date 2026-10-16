// Rekenlogica voor de Google Sheet van Drankteam (zonder netwerk, getest in tests/drankSheet.test.js).
// Gebruikt door de edge function drank-sheet (Deno) en door de Node-tests.
//
// De app is de bron: elke synchronisatie (enkel als er iets veranderd is) herschrijft de tabbladen.
//   Drankrekening – zoals de vroegere Excel: strepen per leider per drank, prijs per streepje uit Bakken,
//                   subtotaal drank (SUMPRODUCT), friet, extra kosten, totaal te betalen. Kolommen en formules
//                   worden telkens opnieuw opgebouwd uit de dranken van de app (toevoegen/verwijderen klopt dus altijd).
//   Bakken        – per drank: aankoopprijs en tellingen (zelf in te vullen, blijven bewaard per drank),
//                   totaal gedronken, tekort, kost KSA en prijs per streepje (zonder aankoopprijs: prijs van de app)
//   Rekening  – lopende periode per leider: strepen, drank, friet, extra kosten/correcties, totaal
//   Strepen   – lopende periode: aantal strepen per leider per drank
// Vaste lijst (ook bij de start van een periode, met nullen): alle actieve accounts behalve Godmode
// (testaccount) en alle vaste dranken die niet uit de lijst gehaald zijn. Wie of wat daarbuiten toch
// strepen of kosten heeft (bv. Godmode of een tijdelijke drank), komt er ook bij, zodat de totalen kloppen.
//   Facturen  – alle drankfacturen van afgesloten periodes, met betaald of niet
//   Info      – wanneer bijgewerkt en uitleg

// Verhoog bij een wijziging aan de formules of de indeling: dan schrijft de app alles opnieuw, ook als de cijfers gelijk bleven
export const SHEET_VERSIE = 4;

export const TABBLADEN = ['Drankrekening', 'Bakken', 'Rekening', 'Strepen', 'Facturen', 'Info'];

// Kolommen met een bedrag in euro (0 = kolom A), per tabblad
export const EURO_KOLOMMEN = { Rekening: [2, 3, 4, 5], Facturen: [4, 5, 6, 7] };

const rond = x => Math.round((Number(x) || 0) * 100) / 100;
const opNaam = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'nl');

export function belgischTijdstip(tijdstip) {
  if (!tijdstip) return '';
  return new Intl.DateTimeFormat('nl-BE', {
    timeZone: 'Europe/Brussels',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(tijdstip));
}

const dagMaand = d =>
  new Intl.DateTimeFormat('nl-BE', { timeZone: 'Europe/Brussels', day: 'numeric', month: 'numeric' }).format(d);

// Zelfde naam als in de app (src/lib/dranken.js): tijdelijke dranken krijgen hun dagen erbij
export function drankNaam(d) {
  if (!d) return 'Onbekend';
  if (!d.is_temporary || !d.geldig_van || !d.geldig_tot) return d.naam;
  const van = dagMaand(new Date(d.geldig_van));
  const tot = dagMaand(new Date(new Date(d.geldig_tot).getTime() - 1)); // tot middernacht = t.e.m. de dag ervoor
  return `${d.naam} (${van === tot ? van : `${van} – ${tot}`})`;
}

/** overzicht: rijen van periode_overzicht(); leiders: namen die er altijd in staan */
export function rekeningRijen(overzicht, leiders = []) {
  const metKosten = new Set((overzicht || []).map(r => r.naam));
  const nullen = [...new Set(leiders)]
    .filter(naam => !metKosten.has(naam))
    .map(naam => ({ naam, strepen: 0, drank_bedrag: 0, friet_bedrag: 0, correctie_bedrag: 0, totaal: 0 }));
  const rijen = [...(overzicht || []), ...nullen].sort((a, b) => opNaam(a.naam, b.naam));
  const som = k => rond(rijen.reduce((s, r) => s + (Number(r[k]) || 0), 0));
  return [
    ['Leider', 'Strepen', 'Drank', 'Friet', 'Extra kosten', 'Totaal'],
    ...rijen.map(r => [
      r.naam ?? '?',
      Number(r.strepen) || 0,
      rond(r.drank_bedrag),
      rond(r.friet_bedrag),
      rond(r.correctie_bedrag),
      rond(r.totaal),
    ]),
    ['Totaal', rijen.reduce((s, r) => s + (Number(r.strepen) || 0), 0), som('drank_bedrag'), som('friet_bedrag'), som('correctie_bedrag'), som('totaal')],
  ];
}

// Strepen optellen per leider en per drank
function telStrepen(strepen) {
  const per = new Map(); // naam -> Map(drank_id -> aantal)
  const totaalPerDrank = new Map();
  for (const s of strepen || []) {
    const naam = s.naam ?? '?';
    const id = String(s.drank_id);
    const aantal = Number(s.aantal) || 0;
    if (!per.has(naam)) per.set(naam, new Map());
    per.get(naam).set(id, (per.get(naam).get(id) || 0) + aantal);
    totaalPerDrank.set(id, (totaalPerDrank.get(id) || 0) + aantal);
  }
  return { per, totaalPerDrank };
}

/**
 * Welke dranken in de Sheet staan, in volgorde (vaste eerst, dan tijdelijke, telkens op naam):
 *  - vaste dranken die niet uit de lijst zijn
 *  - tijdelijke dranken die nog lopen of gepland zijn (zodat Bakken al ingevuld kan worden)
 *  - elke drank waarop gestreept is (anders kloppen de totalen niet)
 */
export function drankLijst(dranken, strepen, nu = new Date()) {
  const { totaalPerDrank } = telStrepen(strepen);
  return (dranken || [])
    .filter(d => {
      if ((totaalPerDrank.get(String(d.id)) || 0) !== 0) return true;
      if (d.uit_lijst) return false;
      if (!d.is_temporary) return true;
      return !!d.geldig_tot && new Date(d.geldig_tot) > nu;
    })
    .sort((a, b) => (a.is_temporary ? 1 : 0) - (b.is_temporary ? 1 : 0) || opNaam(drankNaam(a), drankNaam(b)));
}

/** strepen: [{ naam, drank_id, aantal }], dranken: rijen uit de tabel dranken, leiders: namen die er altijd in staan */
export function strepenRijen(strepen, dranken, leiders = [], nu = new Date()) {
  const { per, totaalPerDrank } = telStrepen(strepen);
  const lijst = drankLijst(dranken, strepen, nu);
  const perDrank = new Map(lijst.map(d => [String(d.id), d]));
  const ids = lijst.map(d => String(d.id));
  const vasteNamen = new Set(leiders);
  const namen = [...new Set([...leiders, ...per.keys()])].sort(opNaam);
  const rijen = namen
    .map(naam => {
      const aantallen = ids.map(id => per.get(naam)?.get(id) || 0);
      return [naam, ...aantallen, aantallen.reduce((s, x) => s + x, 0)];
    })
    .filter(r => vasteNamen.has(r[0]) || r.slice(1).some(x => x !== 0));
  const totalen = ids.map(id => totaalPerDrank.get(id) || 0);
  return [
    ['Leider', ...ids.map(id => drankNaam(perDrank.get(id))), 'Totaal'],
    ...rijen,
    ['Totaal', ...totalen, totalen.reduce((s, x) => s + x, 0)],
  ];
}

/** facturen: rijen uit de tabel facturen, met profiles(naam) en billing_periods(naam, start_datum) */
export function factuurRijen(facturen) {
  const rijen = [...(facturen || [])].sort(
    (a, b) =>
      String(b.billing_periods?.start_datum ?? '').localeCompare(String(a.billing_periods?.start_datum ?? '')) ||
      opNaam(a.profiles?.naam ?? a.user_naam, b.profiles?.naam ?? b.user_naam),
  );
  return [
    ['Periode', 'Nummer', 'Leider', 'Strepen', 'Drank', 'Friet', 'Extra kosten', 'Totaal', 'Mededeling', 'Betaald', 'Betaald op'],
    ...rijen.map(f => [
      f.billing_periods?.naam ?? f.periode ?? '',
      f.nummer ?? '',
      f.profiles?.naam ?? f.user_naam ?? '?',
      Number(f.aantal_strepen) || 0,
      rond(f.drank_bedrag),
      rond(f.friet_bedrag),
      rond(f.correctie_bedrag),
      rond(f.totaal_bedrag),
      f.mededeling ?? '',
      f.status === 'betaald' ? 'Ja' : 'Nee',
      f.betaald_op ? belgischTijdstip(f.betaald_op).slice(0, 10) : '',
    ]),
  ];
}

export function infoRijen({ periode, nu = new Date() }) {
  return [
    ['KSA Aalter – drank', `versie ${SHEET_VERSIE}`],
    ['Bijgewerkt op', belgischTijdstip(nu)],
    ['Lopende periode', periode?.naam ?? 'geen open periode'],
    ['', ''],
    ['De app vult deze Sheet automatisch. Strepen, dranken, friet en extra kosten pas je aan in de app.', ''],
    ['Drankrekening: zoals de vroegere Excel. Wat elke leider moet betalen = strepen x prijs per streepje + friet + extra kosten.', ''],
    ['Bakken: vul hier per drank de gele vakjes in (aankoopprijs, tellingen). Die blijven bewaard; de rest rekent zichzelf uit.', ''],
    ['Zonder aankoopprijs gebruikt Bakken de prijs van de app als prijs per streepje.', ''],
    ['Rekening: wat elke leider moet betalen volgens de prijzen in de app (zo komt het op de factuur).', ''],
    ['Strepen: aantal strepen per leider per drank in de lopende periode.', ''],
    ['Facturen: de drankfacturen van afgesloten periodes, met betaald of niet.', ''],
    ['Eigen tabbladen mag je toevoegen: die laat de app met rust. Typ niet in de andere tabbladen (behalve de gele vakjes).', ''],
  ];
}

// Tabbladen die vergeleken worden om te weten of er iets veranderd is (Info heeft altijd een nieuw tijdstip)
export const INHOUD_TABBLADEN = ['Rekening', 'Strepen', 'Facturen'];

// Google laat lege cellen achteraan een rij en lege rijen achteraan weg; getallen en tekst vergelijken als tekst
const normaal = rijen => {
  const uit = (rijen || []).map(rij => {
    const r = (rij || []).map(c => (c === null || c === undefined ? '' : String(c)));
    while (r.length && r[r.length - 1] === '') r.pop();
    return r;
  });
  while (uit.length && uit[uit.length - 1].length === 0) uit.pop();
  return JSON.stringify(uit);
};

/** true als wat in de Sheet staat (oud) hetzelfde is als wat we zouden schrijven (nieuw) */
export const zelfdeInhoud = (oud, nieuw) => normaal(oud) === normaal(nieuw);

// ---------------------------------------------------------------------------
// Drankrekening en Bakken (met formules, zoals de vroegere Excel)
// ---------------------------------------------------------------------------

/** Kolomletter: 0 -> A, 25 -> Z, 26 -> AA */
export function kolom(i) {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// Tekst die Google als formule zou lezen (=, +, -, @ vooraan) als gewone tekst schrijven
const tekst = v => (typeof v === 'string' && /^[=+\-@]/.test(v) ? `'${v}` : v);

export const BAKKEN_KOP = [
  'Drank',
  'Aankoopprijs per flesje',
  'Begin telling',
  'Ophalen lege bakken',
  'Eind telling',
  'Traktatie',
  'Totaal gedronken',
  'Streepjes leiding',
  'Tekort',
  'Kost KSA',
  'Prijs per streepje',
  'Prijs in de app',
  'ID (niet aanpassen)',
];
export const BAKKEN_INVOER = [1, 2, 3, 4, 5]; // B t.e.m. F vullen jullie zelf in; blijft bewaard per drank

// In de verborgen kop van kolom M staat ook de periode: zo weet de app wanneer er een nieuwe periode begon
export const bakkenIdKop = periodeId => (periodeId ? `${ID_KOP} · periode ${periodeId}` : ID_KOP);

/**
 * De zelf ingevulde waarden uit het bestaande tabblad Bakken (formules blijven formules), per drank-id en per naam.
 * Begon er intussen een nieuwe periode (periodeId verschilt van wat in de kop staat), dan blijft enkel de
 * aankoopprijs staan en worden de tellingen leeggemaakt: die horen bij de vorige periode.
 */
export function bewaardeInvoer(oudeRijen, periodeId) {
  const perId = new Map();
  const perNaam = new Map();
  const kop = String(oudeRijen?.[0]?.[12] ?? '');
  // Een kop zonder periode (oudere versie van de Sheet) telt als dezelfde periode: niets leegmaken
  const nieuwePeriode = !!periodeId && kop.includes(' · periode ') && kop !== bakkenIdKop(periodeId);
  for (const rij of (oudeRijen || []).slice(1)) {
    const waarden = BAKKEN_INVOER.map((i, j) => (nieuwePeriode && j > 0 ? '' : (rij?.[i] ?? '')));
    if (waarden.every(w => w === '')) continue;
    if (rij?.[12]) perId.set(String(rij[12]), waarden);
    if (rij?.[0]) perNaam.set(String(rij[0]), waarden);
  }
  return { perId, perNaam };
}


// Verborgen kolom (leider) en rij (drank) met de id's: zo weet de app welk vakje bij wie en welke drank hoort,
// ook als iemand in de Sheet rijen sorteert. Dezelfde tekst staat in Bakken kolom M.
export const ID_KOP = 'ID (niet aanpassen)';

const sleutel = (userId, drankId) => `${userId}|${drankId}`;

/** Aantal strepen per leider per drank in de app: Map 'user|drank' -> aantal */
export function appTellingen(strepen) {
  const m = new Map();
  for (const s of strepen || []) {
    if (!s.user_id) continue;
    const k = sleutel(s.user_id, s.drank_id);
    m.set(k, (m.get(k) || 0) + (Number(s.aantal) || 0));
  }
  return m;
}

/**
 * rekening: rijen van periode_overzicht() (user_id, naam, friet_bedrag, correctie_bedrag)
 * strepen: [{ user_id, naam, drank_id, aantal }]
 * leiders: [{ id, naam, oud }] die er altijd in staan; oudleiding komt onder een eigen kopje
 * oudeBakken: huidige inhoud van het tabblad Bakken (render FORMULA), om de invoer te bewaren
 * scheiding: ',' of ';' tussen de delen van een formule (zie formuleScheiding)
 * Geeft { drankrekening, bakken, opmaak, stand } met waarden en formules (schrijven met USER_ENTERED);
 * stand = de aantallen die in de Sheet komen (om later te zien wat er in de Sheet veranderd is).
 * @param {{ rekening: any[], strepen: any[], dranken: any[], leiders?: { id: string, naam: string, oud?: boolean }[], oudeBakken?: unknown[][], nu?: Date, scheiding?: string, periodeId?: string }} invoer
 */
export function drankrekeningTabbladen({ rekening, strepen, dranken, leiders = [], oudeBakken = [], nu = new Date(), scheiding = ',', periodeId = undefined }) {
  const x = scheiding; // tussen de delen van een formule: , of ; (hangt af van de taal van de Sheet)
  const lijst = drankLijst(dranken, strepen, nu);
  const k = lijst.length;
  const tellingen = appTellingen(strepen);
  const perId = new Map((rekening || []).filter(r => r.user_id).map(r => [r.user_id, r]));

  // Wie: vaste lijst + iedereen met strepen of kosten; oudleiding apart
  const naamVan = new Map();
  for (const s of strepen || []) if (s.user_id) naamVan.set(s.user_id, s.naam ?? '?');
  for (const r of rekening || []) if (r.user_id) naamVan.set(r.user_id, r.naam ?? '?');
  for (const l of leiders) naamVan.set(l.id, l.naam);
  const vast = new Set(leiders.map(l => l.id));
  const oud = new Set(leiders.filter(l => l.oud).map(l => l.id));
  const heeftStrepen = new Set([...tellingen].filter(([, n]) => n !== 0).map(([kk]) => kk.split('|')[0]));
  const metIets = id =>
    heeftStrepen.has(id) || !!Number(perId.get(id)?.friet_bedrag) || !!Number(perId.get(id)?.correctie_bedrag);
  const alle = [...naamVan.keys()].filter(id => vast.has(id) || metIets(id));
  const opNaamId = (a, b) => opNaam(naamVan.get(a), naamVan.get(b));
  const leiding = alle.filter(id => !oud.has(id)).sort(opNaamId);
  const oudleiding = alle.filter(id => oud.has(id)).sort(opNaamId);

  // Kolommen: A naam, B totaal, C.. dranken, subtotaal drank, friet, extra kosten, (verborgen) ID
  const L = kolom;
  const eersteDrank = 2;
  const laatsteDrank = eersteDrank + k - 1;
  const kSub = eersteDrank + k;
  const kFriet = kSub + 1;
  const kExtra = kSub + 2;
  const kId = kSub + 3;

  const personen = [...leiding, ...(oudleiding.length ? [null, ...oudleiding] : [])]; // null = kopje Oud-leiding
  const eersteRij = 2;
  const laatsteRij = eersteRij + Math.max(personen.length, 1) - 1;
  const totaalRij = laatsteRij + 2;
  const prijsRij = totaalRij + 1;
  const idRij = prijsRij + 1;

  const stand = [];
  const rijen = [['Leiding', 'Totaal te betalen', ...lijst.map(drankNaam), 'Subtotaal drank', 'Friet', 'Extra kosten', ID_KOP]];
  personen.forEach((id, i) => {
    const r = eersteRij + i;
    if (id === null) return rijen.push(['Oud-leiding']);
    const sub = k
      ? `=SUMPRODUCT(${L(eersteDrank)}${r}:${L(laatsteDrank)}${r}${x}${L(eersteDrank)}$${prijsRij}:${L(laatsteDrank)}$${prijsRij})`
      : 0;
    const aantallen = lijst.map(d => tellingen.get(sleutel(id, d.id)) || 0);
    lijst.forEach((d, j) => stand.push({ user_id: id, drank_id: String(d.id), aantal: aantallen[j] }));
    rijen.push([
      tekst(naamVan.get(id)),
      `=${L(kSub)}${r}+${L(kFriet)}${r}+${L(kExtra)}${r}`,
      ...aantallen,
      sub,
      rond(perId.get(id)?.friet_bedrag),
      rond(perId.get(id)?.correctie_bedrag),
      id,
    ]);
  });
  if (!personen.length) rijen.push([]);
  rijen.push([]);
  const som = c => `=SUM(${L(c)}${eersteRij}:${L(c)}${laatsteRij})`;
  rijen.push(['Totaal streepjes', som(1), ...lijst.map((_, i) => som(eersteDrank + i)), som(kSub), som(kFriet), som(kExtra)]);
  rijen.push(['Prijs per streepje', '', ...lijst.map((_, i) => `=Bakken!K${2 + i}`)]);
  rijen.push([ID_KOP, '', ...lijst.map(d => String(d.id))]);

  // Bakken: één rij per drank, in dezelfde volgorde als de kolommen van Drankrekening
  const { perId: invoerPerId, perNaam: invoerPerNaam } = bewaardeInvoer(oudeBakken, periodeId);
  const bakken = [[...BAKKEN_KOP.slice(0, 12), bakkenIdKop(periodeId)]];
  lijst.forEach((d, i) => {
    const r = 2 + i;
    const invoer = invoerPerId.get(String(d.id)) || invoerPerNaam.get(drankNaam(d)) || ['', '', '', '', ''];
    bakken.push([
      tekst(drankNaam(d)),
      ...invoer,
      `=E${r}+D${r}-C${r}-F${r}`,
      `=Drankrekening!${L(eersteDrank + i)}${totaalRij}`,
      `=G${r}-H${r}`,
      `=B${r}*G${r}`,
      // Zonder aankoopprijs of zonder telling: de prijs van de app (dan is de Sheet gelijk aan de app)
      `=IF(OR(B${r}=""${x}G${r}=0)${x}L${r}${x}IFERROR(J${r}/H${r}${x}0))`,
      rond(d.prijs),
      String(d.id),
    ]);
  });
  if (k) {
    const lb = 1 + k;
    bakken.push(['Totaal', '', '', '', '', '', `=SUM(G2:G${lb})`, `=SUM(H2:H${lb})`, `=SUM(I2:I${lb})`, `=SUM(J2:J${lb})`]);
  }

  return {
    drankrekening: rijen,
    bakken,
    stand,
    opmaak: {
      aantalDranken: k,
      eersteDrank,
      euroKolommen: [1, kSub, kFriet, kExtra],
      totaalRij,
      prijsRij,
      idRij,
      idKolom: kId,
      oudKopRij: oudleiding.length ? eersteRij + leiding.length : null,
    },
  };
}

/**
 * Wat is er in de Sheet veranderd sinds de app ze de vorige keer schreef?
 * sheet: inhoud van Drankrekening (UNFORMATTED_VALUE); stand: [{ user_id, drank_id, aantal }] van de vorige keer;
 * app: appTellingen() van nu.
 * Geeft { aanpassingen: [{ user_id, drank_id, verschil }], ongeldig, botsingen }:
 *  - een aantal dat in de Sheet veranderde en in de app niet: het verschil wordt een streep "via Sheet"
 *  - in de Sheet én in de app veranderd: de app wint (botsing)
 *  - geen geheel getal van 0 of meer: genegeerd (de app zet het terug)
 */
export function sheetWijzigingen(sheet, stand, app) {
  /** @type {{ aanpassingen: { user_id: string, drank_id: string, verschil: number }[], ongeldig: number, botsingen: number }} */
  const uit = { aanpassingen: [], ongeldig: 0, botsingen: 0 };
  const rijen = sheet || [];
  const kop = rijen[0] || [];
  const kId = kop.indexOf(ID_KOP);
  const idRij = rijen.find(r => r?.[0] === ID_KOP);
  if (kId < 0 || !idRij) return uit;
  const vorige = new Map((stand || []).map(s => [sleutel(s.user_id, s.drank_id), Number(s.aantal) || 0]));

  for (const rij of rijen.slice(1)) {
    const userId = rij?.[kId];
    if (!userId || rij === idRij) continue;
    idRij.forEach((drankId, c) => {
      if (c < 2 || !drankId) return;
      const kk = sleutel(userId, drankId);
      if (!vorige.has(kk)) return; // nieuw vakje dat de app nog niet schreef
      const was = vorige.get(kk);
      const waarde = rij[c] === undefined || rij[c] === '' ? 0 : rij[c];
      if (waarde === was) return;
      if (typeof waarde !== 'number' || !Number.isInteger(waarde) || waarde < 0 || waarde > 999) {
        uit.ongeldig++;
        return;
      }
      const nuInApp = app.get(kk) || 0;
      if (nuInApp !== was) {
        uit.botsingen++;
        return;
      }
      uit.aanpassingen.push({ user_id: String(userId), drank_id: String(drankId), verschil: waarde - nuInApp });
    });
  }
  return uit;
}

/**
 * Prijs per streepje uit Bakken (UNFORMATTED_VALUE), enkel voor dranken met een ingevulde aankoopprijs en telling:
 * Map drank_id -> prijs (afgerond op 4 decimalen). Zonder aankoopprijs blijft de prijs van de app gelden.
 */
export function prijzenUitBakken(bakken) {
  const m = new Map();
  for (const rij of (bakken || []).slice(1)) {
    const id = rij?.[12];
    const aankoop = rij?.[1];
    const gedronken = rij?.[6];
    const prijs = rij?.[10];
    if (!id || aankoop === '' || aankoop === undefined || aankoop === null) continue;
    if (typeof gedronken !== 'number' || gedronken === 0) continue; // nog niet geteld
    if (typeof prijs !== 'number' || !Number.isFinite(prijs) || prijs < 0 || prijs > 1000) continue;
    m.set(String(id), Math.round(prijs * 10000) / 10000);
  }
  return m;
}


/** Google Sheets gebruikt ; tussen de delen van een formule als de taal van de Sheet een decimale komma heeft (bv. nl_BE) */
export function formuleScheiding(locale) {
  try {
    return new Intl.NumberFormat(String(locale || 'en_US').replace('_', '-')).format(1.5).includes(',') ? ';' : ',';
  } catch {
    return ',';
  }
}
