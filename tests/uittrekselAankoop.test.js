import { test } from 'node:test';
import assert from 'node:assert/strict';
import { koppelAankopen, leesDatum, parseCsv, uitgaandeVerrichtingen } from '../src/lib/uittreksel.js';

// Vereenvoudigde KBC-export: Naam is de eigen rekening, Naam tegenpartij de leverancier
const kbc = [
  'Rekeningnummer;Naam;Datum;Omschrijving;Bedrag;Saldo;Naam tegenpartij;gestructureerde mededeling;Vrije mededeling',
  'BE00;KSA Aalter;03/10/2026;EUROPESE OVERSCHRIJVING;-245,80;1000,00;Drankcentrale Aalter;+++123/4567/89012+++;',
  'BE00;KSA Aalter;05/10/2026;OVERSCHRIJVING;-62,00;938,00;Brouwerij Van Steenberge;;factuur 77',
  'BE00;KSA Aalter;06/10/2026;OVERSCHRIJVING;+12,50;950,50;Jan Peeters;+++000/0000/01295+++;',
  'BE00;KSA Aalter;07/10/2026;OVERSCHRIJVING;-30,00;920,50;Bakkerij;;taart',
].join('\n');

test('leesDatum', () => {
  assert.equal(leesDatum('03/10/2026'), '2026-10-03');
  assert.equal(leesDatum('3.1.2026'), '2026-01-03');
  assert.equal(leesDatum('2026-10-03'), '2026-10-03');
  assert.equal(leesDatum('12,50'), null);
});

test('uitgaandeVerrichtingen: enkel uitgaand, met kolommen uit de kopregel', () => {
  const v = uitgaandeVerrichtingen(parseCsv(kbc));
  assert.equal(v.length, 3);
  assert.deepEqual(
    v.map(x => [x.datum, x.bedrag, x.tegenpartij, x.mededeling]),
    [
      ['2026-10-03', 245.8, 'Drankcentrale Aalter', '+++123/4567/89012+++'],
      ['2026-10-05', 62, 'Brouwerij Van Steenberge', 'factuur 77'],
      ['2026-10-07', 30, 'Bakkerij', 'taart'],
    ],
  );
});

test('uitgaandeVerrichtingen: zonder kopregel', () => {
  const v = uitgaandeVerrichtingen(parseCsv('03/10/2026;Drankcentrale;-245,80;123456789012\n04/10/2026;Jan;12,00;'));
  assert.equal(v.length, 1);
  assert.equal(v[0].bedrag, 245.8);
  assert.equal(v[0].datum, '2026-10-03');
  assert.equal(v[0].mededeling, '+++123/4567/89012+++');
});

test('koppelAankopen: op mededeling, op naam + bedrag, enkel bedrag, al betaald en nieuw', () => {
  const v = uitgaandeVerrichtingen(parseCsv(kbc));
  const facturen = [
    { id: 'a', leverancier: 'Drankcentrale', bedrag: 245.8, mededeling: '+++123/4567/89012+++', betaald: false },
    { id: 'b', leverancier: 'Brouwerij Van Steenberge', bedrag: 62, mededeling: null, betaald: true },
    { id: 'c', leverancier: 'Colruyt', bedrag: 30, mededeling: null, betaald: false },
  ];
  const r = koppelAankopen(v, facturen);
  assert.deepEqual(r.teBetalen.map(x => [x.factuur.id, x.zeker]), [['a', true], ['c', false]]);
  assert.equal(r.alInOrde, 1);
  assert.equal(r.nieuw.length, 0);

  const leeg = koppelAankopen(v, []);
  assert.equal(leeg.nieuw.length, 3);
});
