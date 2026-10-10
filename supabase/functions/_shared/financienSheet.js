// Rekenlogica voor de koppeling Financiën <-> Google Sheet (zonder netwerk, getest in tests/).
// Gebruikt door de edge function financien-sheet (Deno) en door de Node-tests.
//
// Tabblad "Betalingen": één rij per drankfactuur of andere betaling van een leider.
//   A Soort | B Omschrijving | C Leider | D Bedrag | E Te betalen voor | F Betaald | G Betaald op
//   H Mededeling | I Opmerking | J ID (verborgen)
//
// Regels:
//  - De app is de bron voor bedragen van drank (komen uit de strepen) en voor wie wat moet betalen.
//  - In de Sheet mag je aanpassen: Betaald, Betaald op en Opmerking (alle rijen) en Bedrag (andere betalingen).
//  - Een nieuwe rij zonder ID (Omschrijving + Leider + Bedrag ingevuld) wordt een nieuwe andere betaling.
//  - Wat je in de Sheet verandert, zien we door te vergelijken met de waarden van de vorige
//    synchronisatie (snapshot). Veranderde dezelfde cel ook in de app, dan wint de app.
//  - Een verwijderde rij komt terug: verwijderen gebeurt in de app.

export const TABBLAD = 'Betalingen';
export const OVERZICHT = 'Overzicht';
export const KOLOMMEN = [
  'Soort',
  'Omschrijving',
  'Leider',
  'Bedrag',
  'Te betalen voor',
  'Betaald',
  'Betaald op',
  'Mededeling',
  'Opmerking',
  'ID (niet aanpassen)',
];
const AANTAL = KOLOMMEN.length;

// Velden die je in de Sheet kan aanpassen, per soort
export const BEWERKBAAR = {
  drank: ['betaald', 'betaald_op', 'opmerking'],
  betaling: ['betaald', 'betaald_op', 'opmerking', 'bedrag'],
};

const SOORT_LABEL = { drank: 'Drank', betaling: 'Andere' };

// ---------------------------------------------------------------------------
// Datums: Google Sheets bewaart datums als serienummer (dagen sinds 30/12/1899)
// ---------------------------------------------------------------------------
const EPOCH = Date.UTC(1899, 11, 30);
const DAG = 86400000;

/** 'YYYY-MM-DD' (of een ISO-tijdstip) -> serienummer; leeg -> '' */
export function datumNaarSerie(iso) {
  if (!iso) return '';
  const [j, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!j || !m || !d) return '';
  return Math.round((Date.UTC(j, m - 1, d) - EPOCH) / DAG);
}

/** serienummer (of 'dd/mm/jjjj' / 'jjjj-mm-dd' als tekst) -> 'YYYY-MM-DD'; onleesbaar -> null */
export function serieNaarDatum(waarde) {
  if (waarde === '' || waarde === null || waarde === undefined) return null;
  if (typeof waarde === 'number' && Number.isFinite(waarde)) {
    const d = new Date(EPOCH + Math.floor(waarde) * DAG);
    return d.toISOString().slice(0, 10);
  }
  const s = String(waarde).trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

/** Brussels-datum ('YYYY-MM-DD') van een tijdstip */
export function belgischeDatum(tijdstip) {
  if (!tijdstip) return null;
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels' }).format(new Date(tijdstip));
}

// ---------------------------------------------------------------------------
// Normaliseren: één vorm voor waarden uit de app, de Sheet en de snapshot
// ---------------------------------------------------------------------------
export function leesBedrag(waarde) {
  if (typeof waarde === 'number') return Number.isFinite(waarde) ? Math.round(waarde * 100) / 100 : null;
  let s = String(waarde ?? '')
    .replace(/EUR|€/gi, '')
    .replace(/\s/g, '');
  if (!s || !/\d/.test(s) || !/^[+-]?[\d.,]+$/.test(s)) return null;
  const komma = s.lastIndexOf(',');
  const punt = s.lastIndexOf('.');
  if (komma > -1 && punt > -1) s = komma > punt ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (komma > -1) s = s.replace(',', '.');
  else if (punt > -1 && !/\.\d{1,2}$/.test(s)) s = s.replace(/\./g, ''); // '1.234' = duizendtal
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export function leesBetaald(waarde) {
  if (typeof waarde === 'boolean') return waarde;
  return ['true', 'waar', 'ja', 'x', 'betaald', '1', 'v', '✓'].includes(String(waarde ?? '').trim().toLowerCase());
}

const tekst = w => String(w ?? '').trim();

/** Bewerkbare waarden van een app-item, genormaliseerd */
export function waardenVanItem(item) {
  return {
    betaald: !!item.betaald,
    betaald_op: item.betaald ? item.betaald_op || null : null,
    opmerking: tekst(item.opmerking),
    bedrag: Math.round(Number(item.bedrag || 0) * 100) / 100,
  };
}

/** Bewerkbare waarden uit een Sheet-rij, genormaliseerd (null = onleesbaar) */
export function waardenVanRij(rij) {
  const betaald = leesBetaald(rij[5]);
  return {
    betaald,
    betaald_op: betaald ? serieNaarDatum(rij[6]) : null,
    opmerking: tekst(rij[8]),
    bedrag: leesBedrag(rij[3]),
  };
}

// ---------------------------------------------------------------------------
// App -> Sheet
// ---------------------------------------------------------------------------
export function sorteerItems(items) {
  return [...items].sort(
    (a, b) =>
      (a.soort === b.soort ? 0 : a.soort === 'drank' ? -1 : 1) ||
      tekst(a.omschrijving).localeCompare(tekst(b.omschrijving), 'nl') ||
      tekst(a.naam).localeCompare(tekst(b.naam), 'nl'),
  );
}

export function itemNaarRij(item) {
  const w = waardenVanItem(item);
  return [
    SOORT_LABEL[item.soort] || item.soort,
    tekst(item.omschrijving),
    tekst(item.naam),
    w.bedrag,
    datumNaarSerie(item.vervaldatum),
    w.betaald,
    datumNaarSerie(w.betaald_op),
    tekst(item.mededeling),
    w.opmerking,
    item.sleutel,
  ];
}

/** Volledige inhoud van het tabblad: kop, alle items, en rijen die we nog niet konden verwerken */
export function gewensteRijen(items, behouden = []) {
  return [KOLOMMEN, ...sorteerItems(items).map(itemNaarRij), ...behouden.map(vulAan)];
}

const vulAan = rij => Array.from({ length: AANTAL }, (_, i) => (rij[i] === undefined || rij[i] === null ? '' : rij[i]));

/** Vergelijkbare vorm van een raster (Sheets laat lege cellen achteraan weg) */
function vergelijkbaar(rijen) {
  const r = rijen.map(vulAan).map(rij => rij.map(c => (typeof c === 'number' ? Math.round(c * 100) / 100 : c)));
  while (r.length && r[r.length - 1].every(c => c === '' || c === false)) r.pop();
  return JSON.stringify(r);
}

export function zelfdeRaster(a, b) {
  return vergelijkbaar(a) === vergelijkbaar(b);
}

// ---------------------------------------------------------------------------
// Sheet -> App
// ---------------------------------------------------------------------------
const zonderAccenten = s =>
  tekst(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Leider zoeken op naam of bijnaam (hoofdletters en accenten maken niet uit) */
export function zoekLeider(naam, profielen) {
  const z = zonderAccenten(naam);
  if (!z) return null;
  const treffers = profielen.filter(p => [p.naam, p.nickname].some(n => n && zonderAccenten(n) === z));
  return treffers.length === 1 ? treffers[0] : null;
}

/**
 * Vergelijkt de Sheet met de app en de vorige synchronisatie.
 * @returns {{ updates: {soort, id, velden}[], nieuw: object[], behouden: any[][], problemen: string[] }}
 */
export function verwerkSheet({ rijen, items, snapshot, profielen }) {
  const perSleutel = new Map(items.map(i => [i.sleutel, i]));
  const updates = [];
  const nieuw = [];
  const behouden = [];
  const problemen = [];
  const gezien = new Set();

  rijen.slice(1).forEach((ruw, index) => {
    const rij = vulAan(ruw);
    const rijNr = index + 2;
    if (rij.every(c => c === '' || c === false)) return;
    const sleutel = tekst(rij[9]);

    if (sleutel) {
      const item = perSleutel.get(sleutel);
      if (!item || gezien.has(sleutel)) return; // onbekend of dubbel: de app zet het recht
      gezien.add(sleutel);
      const vorige = snapshot[sleutel];
      if (!vorige) return; // nog nooit gesynchroniseerd: de app is de bron
      const sheet = waardenVanRij(rij);
      const app = waardenVanItem(item);
      const velden = {};
      for (const veld of BEWERKBAAR[item.soort] || []) {
        if (veld === 'bedrag' && sheet.bedrag === null) {
          problemen.push(`Rij ${rijNr}: bedrag "${rij[3]}" is geen geldig bedrag`);
          continue;
        }
        if (veld === 'bedrag' && sheet.bedrag < 0) {
          problemen.push(`Rij ${rijNr}: een bedrag kan niet negatief zijn`);
          continue;
        }
        const inSheetVeranderd = sheet[veld] !== vorige[veld];
        const inAppVeranderd = app[veld] !== vorige[veld];
        if (inSheetVeranderd && !inAppVeranderd) velden[veld] = sheet[veld];
      }
      if (Object.keys(velden).length) updates.push({ soort: item.soort, id: item.id, velden });
      return;
    }

    // Nieuwe rij
    const soort = zonderAccenten(rij[0]);
    const omschrijving = tekst(rij[1]);
    const leiderNaam = tekst(rij[2]);
    const bedrag = leesBedrag(rij[3]);
    const onvolledig = !omschrijving || !leiderNaam || rij[3] === '' || rij[3] === null;
    if (soort && soort !== 'andere') {
      problemen.push(`Rij ${rijNr}: drankfacturen maak je niet in de Sheet; die komen van Drankteam`);
      behouden.push(rij);
      return;
    }
    if (onvolledig) {
      behouden.push(rij); // misschien is iemand nog aan het typen
      return;
    }
    const leider = zoekLeider(leiderNaam, profielen);
    if (!leider) {
      problemen.push(`Rij ${rijNr}: leider "${leiderNaam}" niet gevonden (gebruik de naam zoals in de app)`);
      behouden.push(rij);
      return;
    }
    if (bedrag === null || bedrag < 0) {
      problemen.push(`Rij ${rijNr}: bedrag "${rij[3]}" is geen geldig bedrag`);
      behouden.push(rij);
      return;
    }
    const betaald = leesBetaald(rij[5]);
    nieuw.push({
      rijNr,
      titel: omschrijving,
      vervaldatum: serieNaarDatum(rij[4]),
      user_id: leider.id,
      bedrag,
      betaald,
      betaald_op: betaald ? serieNaarDatum(rij[6]) : null,
      opmerking: tekst(rij[8]),
    });
  });

  return { updates, nieuw, behouden, problemen };
}

/** Bewerkbare waarden per rij, om bij de volgende synchronisatie te vergelijken */
export function maakSnapshot(items) {
  return Object.fromEntries(items.map(i => [i.sleutel, waardenVanItem(i)]));
}

// ---------------------------------------------------------------------------
// Tabblad "Overzicht": per leider wat er nog openstaat (enkel lezen)
// ---------------------------------------------------------------------------
export function overzichtRijen(items, schattingen = [], vandaag = belgischeDatum(new Date())) {
  const perLeider = new Map();
  const leider = naam => {
    if (!perLeider.has(naam)) perLeider.set(naam, { naam, drank: 0, andere: 0, telaat: 0, schatting: 0 });
    return perLeider.get(naam);
  };
  for (const i of items) {
    if (i.betaald || Number(i.bedrag) <= 0) continue;
    const r = leider(tekst(i.naam));
    if (i.soort === 'drank') r.drank += Number(i.bedrag);
    else r.andere += Number(i.bedrag);
    if (i.vervaldatum && i.vervaldatum < vandaag) r.telaat += Number(i.bedrag);
  }
  for (const s of schattingen) {
    if (Number(s.totaal) > 0) leider(tekst(s.naam)).schatting += Number(s.totaal);
  }
  const r2 = n => Math.round(n * 100) / 100;
  const lijst = [...perLeider.values()]
    .map(r => ({ ...r, totaal: r2(r.drank + r.andere) }))
    .sort((a, b) => b.totaal - a.totaal || a.naam.localeCompare(b.naam, 'nl'));
  const som = k => r2(lijst.reduce((t, r) => t + r[k], 0));
  return [
    ['Leider', 'Openstaand drank', 'Openstaand andere', 'Totaal openstaand', 'Waarvan te laat', 'Lopende drankperiode (schatting)'],
    ...lijst.map(r => [r.naam, r2(r.drank), r2(r.andere), r.totaal, r2(r.telaat), r2(r.schatting)]),
    [],
    ['Totaal', som('drank'), som('andere'), som('totaal'), som('telaat'), som('schatting')],
  ];
}

// ---------------------------------------------------------------------------
// Tabblad "Strepen": aantal strepen per leider per drank in de lopende periode (enkel lezen)
// ---------------------------------------------------------------------------
export const STREPEN = 'Strepen';

/**
 * @param strepen    [{ user_id, naam, drank_id, aantal, prijs }]  (prijs = bewaard bij het strepen)
 * @param dranken    [{ id, naam, prijs }]                        (huidige prijs in de app)
 * @param periode    { naam, start_datum } | null
 */
export function strepenRijen({ strepen, dranken, periode }) {
  const drankNaam = new Map(dranken.map(d => [d.id, tekst(d.naam)]));
  const drankPrijs = new Map(dranken.map(d => [d.id, Number(d.prijs) || 0]));
  const gebruikteDranken = [...new Set(strepen.filter(s => Number(s.aantal)).map(s => s.drank_id))]
    .filter(id => drankNaam.has(id))
    .sort((a, b) => drankNaam.get(a).localeCompare(drankNaam.get(b), 'nl'));

  const perLeider = new Map();
  for (const s of strepen) {
    if (!drankNaam.has(s.drank_id) || !Number(s.aantal)) continue;
    const naam = tekst(s.naam) || '?';
    if (!perLeider.has(s.user_id)) perLeider.set(s.user_id, { naam, aantallen: new Map(), schatting: 0 });
    const l = perLeider.get(s.user_id);
    l.aantallen.set(s.drank_id, (l.aantallen.get(s.drank_id) || 0) + Number(s.aantal));
    const prijs = s.prijs === null || s.prijs === undefined ? drankPrijs.get(s.drank_id) : Number(s.prijs);
    l.schatting += Number(s.aantal) * prijs;
  }
  const r2 = n => Math.round(n * 100) / 100;
  const leiders = [...perLeider.values()].sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));

  const kop = ['Leider', ...gebruikteDranken.map(id => drankNaam.get(id)), 'Totaal strepen', 'Schatting (€)'];
  const rijen = leiders.map(l => {
    const aantallen = gebruikteDranken.map(id => l.aantallen.get(id) || 0);
    return [l.naam, ...aantallen, aantallen.reduce((t, n) => t + n, 0), r2(l.schatting)];
  });
  const totaalPerDrank = gebruikteDranken.map(id => leiders.reduce((t, l) => t + (l.aantallen.get(id) || 0), 0));
  const alles = totaalPerDrank.reduce((t, n) => t + n, 0);
  const periodeTekst = periode
    ? `Lopende periode: ${tekst(periode.naam)}${periode.start_datum ? ` (sinds ${tekst(periode.start_datum).slice(0, 10).split('-').reverse().join('/')})` : ''}`
    : 'Geen open periode';

  return [
    kop,
    ...rijen,
    [],
    ['Totaal', ...totaalPerDrank, alles, r2(leiders.reduce((t, l) => t + l.schatting, 0))],
    ['Prijs per streep (app)', ...gebruikteDranken.map(id => drankPrijs.get(id))],
    [],
    [periodeTekst],
    ['Alleen lezen: strepen zet je in de app. Bij het afsluiten verdeelt Drankteam de echte kost over alle strepen.'],
  ];
}
