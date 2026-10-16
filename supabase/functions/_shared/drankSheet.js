// Rekenlogica voor de Google Sheet van Drankteam (zonder netwerk, getest in tests/drankSheet.test.js).
// Gebruikt door de edge function drank-sheet (Deno) en door de Node-tests.
//
// De Sheet is enkel om te lezen: de app is de bron, elke synchronisatie overschrijft de tabbladen.
//   Rekening  – lopende periode per leider: strepen, drank, friet, extra kosten/correcties, totaal
//   Strepen   – lopende periode: aantal strepen per leider per drank
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

/** overzicht: rijen van periode_overzicht() */
export function rekeningRijen(overzicht) {
  const rijen = [...(overzicht || [])].sort((a, b) => opNaam(a.naam, b.naam));
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

/** strepen: [{ naam, drank_id, aantal }], dranken: rijen uit de tabel dranken */
export function strepenRijen(strepen, dranken) {
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
  // Enkel dranken waarop gestreept is; vaste eerst, dan tijdelijke, telkens op naam
  const ids = [...totaalPerDrank.keys()]
    .filter(id => totaalPerDrank.get(id) !== 0)
    .sort((a, b) => {
      const da = perDrank.get(a);
      const db = perDrank.get(b);
      const ta = da?.is_temporary ? 1 : 0;
      const tb = db?.is_temporary ? 1 : 0;
      return ta - tb || opNaam(drankNaam(da), drankNaam(db));
    });
  const namen = [...per.keys()].sort(opNaam);
  const rijen = namen
    .map(naam => {
      const aantallen = ids.map(id => per.get(naam).get(id) || 0);
      return [naam, ...aantallen, aantallen.reduce((s, x) => s + x, 0)];
    })
    .filter(r => r[r.length - 1] !== 0);
  const totalen = ids.map(id => totaalPerDrank.get(id));
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
