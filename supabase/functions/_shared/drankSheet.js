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
export const SHEET_VERSIE = 2;

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

/** De zelf ingevulde waarden uit het bestaande tabblad Bakken (formules blijven formules), per drank-id en per naam */
export function bewaardeInvoer(oudeRijen) {
  const perId = new Map();
  const perNaam = new Map();
  for (const rij of (oudeRijen || []).slice(1)) {
    const waarden = BAKKEN_INVOER.map(i => rij?.[i] ?? '');
    if (waarden.every(w => w === '')) continue;
    if (rij?.[12]) perId.set(String(rij[12]), waarden);
    if (rij?.[0]) perNaam.set(String(rij[0]), waarden);
  }
  return { perId, perNaam };
}

/**
 * rekening: rijen van periode_overzicht() (naam, friet_bedrag, correctie_bedrag)
 * leiders: [{ naam, oud }] die er altijd in staan; oudleiding komt onder een eigen kopje
 * oudeBakken: huidige inhoud van het tabblad Bakken (render FORMULA), om de invoer te bewaren
 * scheiding: ',' of ';' tussen de delen van een formule (zie formuleScheiding)
 * Geeft { drankrekening, bakken, opmaak } met waarden en formules (schrijven met USER_ENTERED).
 */
export function drankrekeningTabbladen({ rekening, strepen, dranken, leiders = [], oudeBakken = [], nu = new Date(), scheiding = ',' }) {
  const x = scheiding; // tussen de delen van een formule: , of ; (hangt af van de taal van de Sheet)
  const lijst = drankLijst(dranken, strepen, nu);
  const k = lijst.length;
  const { per } = telStrepen(strepen);
  const perNaam = new Map((rekening || []).map(r => [r.naam, r]));

  // Wie: vaste lijst + iedereen met strepen of kosten; oudleiding apart
  const vast = new Set(leiders.map(l => l.naam));
  const oud = new Set(leiders.filter(l => l.oud).map(l => l.naam));
  const metIets = naam =>
    [...(per.get(naam)?.values() || [])].some(x => x !== 0) ||
    !!Number(perNaam.get(naam)?.friet_bedrag) ||
    !!Number(perNaam.get(naam)?.correctie_bedrag);
  const alle = [...new Set([...vast, ...per.keys(), ...perNaam.keys()])].filter(n => vast.has(n) || metIets(n));
  const leiding = alle.filter(n => !oud.has(n)).sort(opNaam);
  const oudleiding = alle.filter(n => oud.has(n)).sort(opNaam);

  // Kolommen: A naam, B totaal, C.. dranken, dan subtotaal drank, friet, extra kosten
  const L = kolom;
  const eersteDrank = 2;
  const laatsteDrank = eersteDrank + k - 1;
  const kSub = eersteDrank + k;
  const kFriet = kSub + 1;
  const kExtra = kSub + 2;

  const namen = [...leiding, ...(oudleiding.length ? [null, ...oudleiding] : [])]; // null = kopje Oud-leiding
  const eersteRij = 2;
  const laatsteRij = eersteRij + Math.max(namen.length, 1) - 1;
  const totaalRij = laatsteRij + 2;
  const prijsRij = totaalRij + 1;

  const rijen = [['Leiding', 'Totaal te betalen', ...lijst.map(drankNaam), 'Subtotaal drank', 'Friet', 'Extra kosten']];
  namen.forEach((naam, i) => {
    const r = eersteRij + i;
    if (naam === null) return rijen.push(['Oud-leiding']);
    const sub = k
      ? `=SUMPRODUCT(${L(eersteDrank)}${r}:${L(laatsteDrank)}${r}${x}${L(eersteDrank)}$${prijsRij}:${L(laatsteDrank)}$${prijsRij})`
      : 0;
    rijen.push([
      tekst(naam),
      `=${L(kSub)}${r}+${L(kFriet)}${r}+${L(kExtra)}${r}`,
      ...lijst.map(d => per.get(naam)?.get(String(d.id)) || 0),
      sub,
      rond(perNaam.get(naam)?.friet_bedrag),
      rond(perNaam.get(naam)?.correctie_bedrag),
    ]);
  });
  if (!namen.length) rijen.push([]);
  rijen.push([]);
  const som = c => `=SUM(${L(c)}${eersteRij}:${L(c)}${laatsteRij})`;
  rijen.push(['Totaal streepjes', som(1), ...lijst.map((_, i) => som(eersteDrank + i)), som(kSub), som(kFriet), som(kExtra)]);
  rijen.push(['Prijs per streepje', '', ...lijst.map((_, i) => `=Bakken!K${2 + i}`)]);

  // Bakken: één rij per drank, in dezelfde volgorde als de kolommen van Drankrekening
  const { perId, perNaam: invoerPerNaam } = bewaardeInvoer(oudeBakken);
  const bakken = [BAKKEN_KOP];
  lijst.forEach((d, i) => {
    const r = 2 + i;
    const invoer = perId.get(String(d.id)) || invoerPerNaam.get(drankNaam(d)) || ['', '', '', '', ''];
    bakken.push([
      tekst(drankNaam(d)),
      ...invoer,
      `=E${r}+D${r}-C${r}-F${r}`,
      `=Drankrekening!${L(eersteDrank + i)}${totaalRij}`,
      `=G${r}-H${r}`,
      `=B${r}*G${r}`,
      // Zonder aankoopprijs: de prijs van de app (dan is de Sheet gelijk aan de app)
      `=IF(B${r}=""${x}L${r}${x}IFERROR(J${r}/H${r}${x}0))`,
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
    opmaak: {
      aantalDranken: k,
      eersteDrank,
      euroKolommen: [1, kSub, kFriet, kExtra],
      totaalRij,
      prijsRij,
      oudKopRij: oudleiding.length ? eersteRij + leiding.length : null,
    },
  };
}

/** Google Sheets gebruikt ; tussen de delen van een formule als de taal van de Sheet een decimale komma heeft (bv. nl_BE) */
export function formuleScheiding(locale) {
  try {
    return new Intl.NumberFormat(String(locale || 'en_US').replace('_', '-')).format(1.5).includes(',') ? ';' : ',';
  } catch {
    return ',';
  }
}
