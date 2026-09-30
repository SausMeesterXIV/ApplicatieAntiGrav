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
