// Bankuittreksel (CSV) inlezen en betalingen koppelen aan openstaande facturen.
// Werkt voor elke bank: we zoeken niet op kolomnamen, maar per rij naar
//  - de gestructureerde mededeling van een openstaande factuur (+++123/4567/89012+++, ook zonder +++ of /)
//  - een positief bedrag dat gelijk is aan het factuurbedrag.
// Het bestand wordt enkel in de browser gelezen en nergens opgeslagen.

/** Leest het bestand als tekst: eerst UTF-8, anders Windows-1252 (veel Belgische banken exporteren zo). */
export async function leesBestand(file) {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buffer);
  if (!utf8.includes('�')) return utf8;
  return new TextDecoder('windows-1252').decode(buffer);
}

/** Eenvoudige CSV-parser met automatische scheiding (; , of tab) en aanhalingstekens. */
export function parseCsv(tekst) {
  const eersteRegels = tekst.split(/\r?\n/).slice(0, 10).join('\n');
  const tellen = teken => (eersteRegels.match(new RegExp(teken === '\t' ? '\t' : `\\${teken}`, 'g')) || []).length;
  const scheiding = [';', ',', '\t'].sort((a, b) => tellen(b) - tellen(a))[0];

  const rijen = [];
  let rij = [];
  let cel = '';
  let tussenQuotes = false;
  for (let i = 0; i < tekst.length; i++) {
    const c = tekst[i];
    if (tussenQuotes) {
      if (c === '"' && tekst[i + 1] === '"') {
        cel += '"';
        i++;
      } else if (c === '"') tussenQuotes = false;
      else cel += c;
    } else if (c === '"') tussenQuotes = true;
    else if (c === scheiding) {
      rij.push(cel);
      cel = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && tekst[i + 1] === '\n') i++;
      rij.push(cel);
      if (rij.some(x => x.trim() !== '')) rijen.push(rij);
      rij = [];
      cel = '';
    } else cel += c;
  }
  rij.push(cel);
  if (rij.some(x => x.trim() !== '')) rijen.push(rij);
  return rijen;
}

/** "12,50" / "1.234,56" / "+12.50" / "EUR 12,50" -> getal; anders null. */
export function leesBedrag(waarde) {
  let s = String(waarde || '')
    .replace(/EUR|€/gi, '')
    .replace(/\s/g, '');
  if (!/^[+-]?[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  const komma = s.lastIndexOf(',');
  const punt = s.lastIndexOf('.');
  if (komma > -1 && punt > -1) {
    // het laatste teken is de decimale scheiding
    s = komma > punt ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (komma > -1) {
    s = s.replace(',', '.');
  } else if (punt > -1 && !/\.\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, ''); // "1.234" = duizendtal
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const cijfers = mededeling => String(mededeling || '').replace(/\D/g, '');

/** Alle 12-cijferige mededelingen in een cel (met of zonder +++, *** of /). */
function mededelingenIn(cel) {
  const gevonden = [];
  for (const m of String(cel).matchAll(/(?:^|\D)(\d{3})[ /]?(\d{4})[ /]?(\d{5})(?=\D|$)/g)) {
    gevonden.push(m[1] + m[2] + m[3]);
  }
  return gevonden;
}

/**
 * Koppelt rijen van het uittreksel aan openstaande facturen.
 * Geeft per gevonden factuur: { factuur, rij, bedragKlopt, bedragen } (bedragen = positieve bedragen in die rij).
 */
export function zoekBetalingen(rijen, openFacturen) {
  const perCode = new Map(
    openFacturen.filter(f => cijfers(f.mededeling).length === 12).map(f => [cijfers(f.mededeling), f]),
  );
  const resultaat = new Map();

  for (const rij of rijen) {
    const codes = new Set(rij.flatMap(mededelingenIn));
    const bedragen = rij.map(leesBedrag).filter(n => n !== null && n > 0);
    for (const code of codes) {
      const factuur = perCode.get(code);
      if (!factuur) continue;
      const bedragKlopt = bedragen.some(b => Math.abs(b - Number(factuur.totaal_bedrag)) < 0.005);
      const vorig = resultaat.get(factuur.id);
      if (!vorig || (!vorig.bedragKlopt && bedragKlopt)) {
        resultaat.set(factuur.id, { factuur, rij, bedragKlopt, bedragen });
      }
    }
  }
  return [...resultaat.values()];
}

// ==================== Aankoopfacturen (uitgaande betalingen) ====================

/** "31/10/2026", "31-10-2026", "31.10.2026" of "2026-10-31" -> "2026-10-31"; anders null. */
export function leesDatum(waarde) {
  const s = String(waarde || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

/** Gestructureerde mededeling in de vorm +++123/4567/89012+++ */
export const mooieMededeling = code => `+++${code.slice(0, 3)}/${code.slice(3, 7)}/${code.slice(7)}+++`;

// Kolomnamen van Belgische banken (KBC, Belfius, BNP, ING, Argenta, ...); de eerste die past wint
const KOLOMMEN = {
  datum: [/uitvoeringsdatum/, /boekingsdatum/, /^datum/, /date/],
  bedrag: [/^bedrag$/, /^bedrag(?!.*valuta)/, /amount/],
  tegenpartij: [/naam.*tegenpartij/, /tegenpartij.*naam/, /naam.*begunstigde/, /counterparty name/, /^tegenpartij$/, /^naam$/],
  mededeling: [/mededeling/, /communicatie/, /bericht/],
  omschrijving: [/omschrijving/, /description/, /details/], // enkel als er geen mededelingskolom is
};

function kolommenUit(kop) {
  const namen = kop.map(c => c.trim().toLowerCase());
  const zoek = patronen => {
    for (const p of patronen) {
      const i = namen.findIndex(n => p.test(n) && !/rekening|saldo|iban|bic/.test(n));
      if (i > -1) return i;
    }
    return -1;
  };
  const alle = patronen => namen.map((n, i) => (patronen.some(p => p.test(n)) ? i : -1)).filter(i => i > -1);
  const mededeling = alle(KOLOMMEN.mededeling);
  return {
    datum: zoek(KOLOMMEN.datum),
    bedrag: zoek(KOLOMMEN.bedrag),
    tegenpartij: zoek(KOLOMMEN.tegenpartij),
    mededeling: mededeling.length ? mededeling : alle(KOLOMMEN.omschrijving),
  };
}

/**
 * Uitgaande verrichtingen uit een uittreksel: [{ datum, bedrag (positief), tegenpartij, mededeling, code, tekst }].
 * Met een kopregel gebruiken we de kolommen; zonder kopregel zoeken we per rij een datum en een negatief bedrag.
 */
export function uitgaandeVerrichtingen(rijen) {
  const kopIndex = rijen.slice(0, 15).findIndex(r => {
    const k = kolommenUit(r);
    return k.bedrag > -1 && k.datum > -1;
  });
  const k = kopIndex > -1 ? kolommenUit(rijen[kopIndex]) : null;
  const resultaat = [];
  for (const rij of rijen.slice(kopIndex + 1)) {
    const bedrag = k ? leesBedrag(rij[k.bedrag]) : rij.map(leesBedrag).find(n => n !== null && n < 0);
    if (bedrag == null || bedrag >= 0) continue;
    const datum = k ? leesDatum(rij[k.datum]) : rij.map(leesDatum).find(Boolean) || null;
    const vrij = k
      ? k.mededeling.map(i => (rij[i] || '').trim()).filter(Boolean).join(' ')
      : '';
    const code = rij.flatMap(mededelingenIn)[0] || null;
    resultaat.push({
      datum,
      bedrag: Math.round(-bedrag * 100) / 100,
      tegenpartij: k && k.tegenpartij > -1 ? (rij[k.tegenpartij] || '').trim() : '',
      mededeling: (code ? mooieMededeling(code) : vrij.replace(/\s+/g, ' ')).slice(0, 140),
      code,
      tekst: rij.join(' ').toLowerCase(),
    });
  }
  return resultaat;
}

/**
 * Koppelt uitgaande verrichtingen aan aankoopfacturen.
 *  - zelfde gestructureerde mededeling: zeker
 *  - zelfde bedrag en de naam van de leverancier staat in de rij: zeker
 *  - enkel zelfde bedrag: misschien (niet vooraf aangevinkt)
 * Geeft { teBetalen: [{ factuur, verrichting, zeker }], nieuw: [verrichting], alInOrde: aantal }.
 * Een verrichting die bij een al betaalde factuur hoort, telt als "al in orde" en komt niet bij nieuw.
 */
export function koppelAankopen(verrichtingen, facturen) {
  const gebruikt = new Set();
  const teBetalen = [];
  const nieuw = [];
  let alInOrde = 0;
  const zelfdeBedrag = (f, v) => Math.abs(Number(f.bedrag) - v.bedrag) < 0.005;
  const naamInRij = (f, v) => {
    const woord = String(f.leverancier || '').toLowerCase().split(/\s+/).find(w => w.length >= 3);
    return !!woord && v.tekst.includes(woord);
  };
  for (const v of verrichtingen) {
    const kandidaten = facturen.filter(f => !gebruikt.has(f.id));
    const opCode = v.code && kandidaten.find(f => cijfers(f.mededeling) === v.code);
    const opNaam = !opCode && kandidaten.find(f => zelfdeBedrag(f, v) && naamInRij(f, v));
    const opBedrag = !opCode && !opNaam && kandidaten.find(f => zelfdeBedrag(f, v) && !f.betaald);
    const factuur = opCode || opNaam || opBedrag;
    if (!factuur) {
      nieuw.push(v);
      continue;
    }
    gebruikt.add(factuur.id);
    if (factuur.betaald) alInOrde++;
    else teBetalen.push({ factuur, verrichting: v, zeker: !opBedrag });
  }
  return { teBetalen, nieuw, alInOrde };
}
