// Mini-factuur van een aankoopfactuur als PDF (pdf-lib): een nette samenvatting van wat in de app is ingevoerd,
// met de foto of PDF van de echte factuur als bijlage achteraan. Bedoeld om in de Drive te zetten.
// pdf-lib wordt pas geladen wanneer iemand een PDF maakt.

const A4 = [595.28, 841.89];
const MARGE = 56;
const GRIJS = [0.42, 0.45, 0.5];
const INKT = [0.09, 0.1, 0.12];

const euro = n => `€ ${Number(n || 0).toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const datum = d => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
const tijdstip = t =>
  t ? new Date(t).toLocaleString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

/** Korte, vaste referentie per factuur, bv. AF-3F2A9C1B */
export const factuurRef = f => `AF-${String(f.id || '').replace(/-/g, '').slice(0, 8).toUpperCase()}`;

/** De standaardletters van een PDF kennen enkel West-Europese tekens; de rest (emoji, ...) wordt "?" */
const veilig = t =>
  String(t ?? '')
    .normalize('NFC')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF€‘’“”–—…•]/g, '?');

/** Bestandsnaam: "Aankoopfactuur Brouwerij X 2026-10-14.pdf" */
export const miniFactuurNaam = f =>
  `Aankoopfactuur ${String(f.leverancier || '').replace(/[\\/:*?"<>|]+/g, '').trim()} ${f.factuurdatum || ''}`.trim() + '.pdf';

/**
 * factuur: rij uit aankoopfacturen; periodeNaam, ingevoerdDoor: tekst;
 * bijlage: { bytes: Uint8Array|ArrayBuffer, type: 'image/jpeg'|'image/png'|'application/pdf' } of null.
 * Geeft de PDF als Uint8Array.
 */
export async function maakMiniFactuur({ factuur, periodeNaam, ingevoerdDoor, bijlage = null, nu = new Date() }) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  doc.setTitle(`Aankoopfactuur ${veilig(factuur.leverancier)}`);
  doc.setAuthor('KSA Aalter');
  doc.setCreator('KSA-app');
  const gewoon = await doc.embedFont(StandardFonts.Helvetica);
  const vet = await doc.embedFont(StandardFonts.HelveticaBold);
  const kleur = c => rgb(...c);

  const blad = doc.addPage(A4);
  const breedte = A4[0] - 2 * MARGE;
  let y = A4[1] - MARGE;

  const schrijf = (tekst, { x = MARGE, grootte = 11, font = gewoon, c = INKT, rechts = false } = {}) => {
    const t = veilig(tekst);
    const w = font.widthOfTextAtSize(t, grootte);
    blad.drawText(t, { x: rechts ? A4[0] - MARGE - w : x, y, size: grootte, font, color: kleur(c) });
  };
  const regels = (tekst, maxBreedte, grootte, font = gewoon) => {
    const woorden = veilig(tekst).split(' ');
    const uit = [];
    let regel = '';
    for (const w of woorden) {
      const proef = regel ? `${regel} ${w}` : w;
      if (font.widthOfTextAtSize(proef, grootte) > maxBreedte && regel) {
        uit.push(regel);
        regel = w;
      } else regel = proef;
    }
    if (regel) uit.push(regel);
    return uit.length ? uit : [''];
  };
  const lijn = (dikte = 0.75, c = [0.85, 0.86, 0.88]) =>
    blad.drawLine({ start: { x: MARGE, y }, end: { x: A4[0] - MARGE, y }, thickness: dikte, color: kleur(c) });

  // Kop
  schrijf('KSA Aalter', { grootte: 20, font: vet });
  schrijf('AANKOOPFACTUUR', { grootte: 10, font: vet, c: GRIJS, rechts: true });
  y -= 16;
  schrijf('Intern overzicht uit de KSA-app', { grootte: 10, c: GRIJS });
  schrijf(factuurRef(factuur), { grootte: 10, c: GRIJS, rechts: true });
  y -= 22;
  lijn(1.2, INKT);
  y -= 34;

  // Leverancier en bedrag
  const naamRegels = regels(factuur.leverancier, breedte - 170, 18, vet);
  naamRegels.forEach((r, i) => {
    schrijf(r, { grootte: 18, font: vet });
    if (i === 0) schrijf(euro(factuur.bedrag), { grootte: 22, font: vet, rechts: true });
    y -= 22;
  });
  schrijf(factuur.betaald ? 'Betaald' : 'Nog niet betaald', {
    grootte: 11,
    font: vet,
    c: factuur.betaald ? [0.08, 0.5, 0.24] : [0.75, 0.35, 0.05],
    rechts: true,
  });
  y -= 30;

  // Gegevens
  const bijlageTekst = !bijlage
    ? factuur.foto_pad
      ? 'Bijlage kon niet geladen worden'
      : 'Geen'
    : bijlage.type === 'application/pdf'
      ? 'PDF van de factuur, vanaf pagina 2'
      : 'Foto van de factuur, op pagina 2';
  const velden = [
    ['Leverancier', factuur.leverancier],
    ['Factuurdatum', datum(factuur.factuurdatum)],
    ['Bedrag', euro(factuur.bedrag)],
    ['Mededeling', factuur.mededeling || '—'],
    ['Drankperiode', periodeNaam || '—'],
    ['Status', factuur.betaald ? 'Betaald' : 'Nog niet betaald'],
    ['Notitie', factuur.notitie || '—'],
    ['Bijlage', bijlageTekst],
  ];
  const labelBreedte = 120;
  for (const [label, waarde] of velden) {
    lijn();
    y -= 20;
    schrijf(label, { grootte: 10, font: vet, c: GRIJS });
    const r = regels(waarde, breedte - labelBreedte, 11, label === 'Mededeling' ? vet : gewoon);
    r.forEach((t, i) => {
      if (i) y -= 15;
      schrijf(t, { x: MARGE + labelBreedte, grootte: 11, font: label === 'Mededeling' ? vet : gewoon });
    });
    y -= 12;
  }
  lijn();
  y -= 30;

  // Wie en wanneer
  schrijf(`Ingevoerd door ${ingevoerdDoor || 'onbekend'} op ${tijdstip(factuur.created_at)}`, { grootte: 9.5, c: GRIJS });
  y -= 14;
  if (factuur.updated_at && factuur.updated_at !== factuur.created_at) {
    schrijf(`Laatst aangepast op ${tijdstip(factuur.updated_at)}`, { grootte: 9.5, c: GRIJS });
    y -= 14;
  }
  schrijf(`PDF gemaakt op ${tijdstip(nu)}`, { grootte: 9.5, c: GRIJS });

  // Voetnoot
  y = MARGE;
  for (const r of regels(
    'Dit is geen officiële factuur van de leverancier, maar een samenvatting van de gegevens die in de KSA-app zijn ingevoerd.',
    breedte,
    8.5,
  )) {
    schrijf(r, { grootte: 8.5, c: GRIJS });
    y -= 11;
  }

  // Bijlage achteraan
  if (bijlage) {
    try {
      if (bijlage.type === 'application/pdf') {
        const bron = await PDFDocument.load(bijlage.bytes, { ignoreEncryption: true });
        const paginas = await doc.copyPages(bron, bron.getPageIndices());
        paginas.forEach(p => doc.addPage(p));
      } else {
        const beeld = bijlage.type === 'image/png' ? await doc.embedPng(bijlage.bytes) : await doc.embedJpg(bijlage.bytes);
        const p = doc.addPage(A4);
        const schaal = Math.min((A4[0] - 2 * MARGE) / beeld.width, (A4[1] - 2 * MARGE) / beeld.height, 1);
        const w = beeld.width * schaal;
        const h = beeld.height * schaal;
        p.drawImage(beeld, { x: (A4[0] - w) / 2, y: (A4[1] - h) / 2, width: w, height: h });
      }
    } catch (e) {
      console.warn('Bijlage niet toegevoegd', e);
    }
  }

  return doc.save();
}

/**
 * Haalt een bijlage op en maakt er iets van dat in een PDF past: PDF blijft PDF, foto's worden JPEG
 * (ook webp en andere formaten die de browser kan tonen). Geeft null als het niet lukt.
 */
export async function laadBijlage(url) {
  try {
    const antwoord = await fetch(url);
    if (!antwoord.ok) return null;
    const blob = await antwoord.blob();
    const type = blob.type || '';
    if (type === 'application/pdf' || url.split('?')[0].toLowerCase().endsWith('.pdf')) {
      return { bytes: await blob.arrayBuffer(), type: 'application/pdf' };
    }
    if (type === 'image/jpeg' || type === 'image/png') return { bytes: await blob.arrayBuffer(), type };
    const beeld = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = beeld.width;
    canvas.height = beeld.height;
    canvas.getContext('2d').drawImage(beeld, 0, 0);
    const jpeg = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85));
    return jpeg ? { bytes: await jpeg.arrayBuffer(), type: 'image/jpeg' } : null;
  } catch {
    return null;
  }
}

/** Op de gsm: deelmenu (bv. "Opslaan in Drive"); anders gewoon downloaden. */
export async function deelOfDownload(bytes, naam) {
  const bestand = new File([bytes], naam, { type: 'application/pdf' });
  const gsm = window.matchMedia?.('(pointer: coarse)').matches;
  if (gsm && navigator.canShare?.({ files: [bestand] })) {
    try {
      await navigator.share({ files: [bestand], title: naam });
      return 'gedeeld';
    } catch (e) {
      if (e?.name === 'AbortError') return 'geannuleerd';
    }
  }
  const url = URL.createObjectURL(bestand);
  const a = document.createElement('a');
  a.href = url;
  a.download = naam;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'gedownload';
}
