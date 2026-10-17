import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { factuurRef, maakMiniFactuur, miniFactuurNaam } from '../src/lib/miniFactuur.js';

const factuur = {
  id: '3f2a9c1b-0000-4000-8000-000000000000',
  leverancier: 'Brouwerij Van Steenberge 🍺',
  bedrag: 1245.8,
  mededeling: '+++123/4567/89012+++',
  factuurdatum: '2026-10-14',
  betaald: false,
  notitie: 'Twaalf bakken Freedom, vier bakken Cola en een heel lange notitie die over meerdere regels moet lopen zodat het afbreken getest wordt.',
  created_at: '2026-10-14T10:00:00Z',
  updated_at: '2026-10-15T10:00:00Z',
};

test('factuurRef en bestandsnaam', () => {
  assert.equal(factuurRef(factuur), 'AF-3F2A9C1B');
  assert.equal(miniFactuurNaam({ leverancier: 'A/B: "C"', factuurdatum: '2026-10-14' }), 'Aankoopfactuur AB C 2026-10-14.pdf');
});

test('maakMiniFactuur: één pagina, of meer met een PDF-bijlage; vreemde tekens geven geen fout', async () => {
  const zonder = await maakMiniFactuur({ factuur, periodeNaam: 'Oktober 2026', ingevoerdDoor: 'Céline' });
  assert.equal(Buffer.from(zonder.slice(0, 4)).toString(), '%PDF');
  assert.equal((await PDFDocument.load(zonder)).getPageCount(), 1);

  const bijlage = await PDFDocument.create();
  bijlage.addPage();
  bijlage.addPage();
  const met = await maakMiniFactuur({ factuur, bijlage: { bytes: await bijlage.save(), type: 'application/pdf' } });
  assert.equal((await PDFDocument.load(met)).getPageCount(), 3);
});
