// Rekenlogica voor de Google Sheet van Drankteam (zonder netwerk, getest in tests/drankSheet.test.js).
// Gebruikt door de edge function drank-sheet (Deno) en door de Node-tests.
//
// De Sheet is enkel om te lezen: de app is de bron, elke synchronisatie overschrijft de tabbladen.
//   Rekening  – lopende periode per leider: strepen, drank, friet, extra kosten/correcties, totaal
//   Strepen   – lopende periode: aantal strepen per leider per drank
// Vaste lijst (ook bij de start van een periode, met nullen): alle actieve accounts behalve Godmode
// (testaccount) en alle vaste dranken die niet uit de lijst gehaald zijn. Wie of wat daarbuiten toch
// strepen of kosten heeft (bv. Godmode of een tijdelijke drank), komt er ook bij, zodat de totalen kloppen.
//   Facturen  – alle drankfacturen van afgesloten periodes, met betaald of niet
//   Info      – wanneer bijgewerkt en uitleg

export const TABBLADEN = ['Rekening', 'Strepen', 'Facturen', 'Info'];

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

/** strepen: [{ naam, drank_id, aantal }], dranken: rijen uit de tabel dranken, leiders: namen die er altijd in staan */
export function strepenRijen(strepen, dranken, leiders = []) {
  const perDrank = new Map((dranken || []).map(d => [String(d.id), d]));
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
  // Vaste dranken (in de lijst) altijd, andere enkel als erop gestreept is; vaste eerst, dan tijdelijke, op naam
  const vast = (dranken || []).filter(d => !d.is_temporary && !d.uit_lijst).map(d => String(d.id));
  const ids = [...new Set([...vast, ...[...totaalPerDrank.keys()].filter(id => totaalPerDrank.get(id) !== 0)])]
    .sort((a, b) => {
      const da = perDrank.get(a);
      const db = perDrank.get(b);
      const ta = da?.is_temporary ? 1 : 0;
      const tb = db?.is_temporary ? 1 : 0;
      return ta - tb || opNaam(drankNaam(da), drankNaam(db));
    });
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
    ['KSA Aalter – drank', ''],
    ['Bijgewerkt op', belgischTijdstip(nu)],
    ['Lopende periode', periode?.naam ?? 'geen open periode'],
    ['', ''],
    ['Enkel lezen: deze Sheet wordt door de app overschreven. Aanpassen doe je in de app.', ''],
    ['Rekening: wat elke leider tot nu toe moet betalen in de lopende periode.', ''],
    ['Strepen: aantal strepen per leider per drank in de lopende periode.', ''],
    ['Facturen: de drankfacturen van afgesloten periodes, met betaald of niet.', ''],
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
