import { test } from 'node:test';
import assert from 'node:assert/strict';
import { epcPayload, formatIban, normaliseerIban } from '../src/lib/epc.js';

test('IBAN normaliseren en opmaken', () => {
  assert.equal(normaliseerIban(' be68 5390 0754 7034 '), 'BE68539007547034');
  assert.equal(formatIban('be68539007547034'), 'BE68 5390 0754 7034');
});

test('EPC-QR volgens het BCD-formaat (versie 002)', () => {
  const regels = epcPayload({
    naam: 'KSA Aalter',
    iban: 'BE68 5390 0754 7034',
    bedrag: 12.5,
    mededeling: '+++000/0000/01295+++',
  }).split('\n');

  assert.deepEqual(regels, [
    'BCD',
    '002',
    '1',
    'SCT',
    '', // BIC is optioneel in versie 002
    'KSA Aalter',
    'BE68539007547034',
    'EUR12.50', // altijd met punt en twee decimalen
    '',
    '',
    '+++000/0000/01295+++',
  ]);
});

test('EPC-QR: te lange naam en mededeling worden ingekort (max 70 en 140 tekens)', () => {
  const regels = epcPayload({ naam: 'x'.repeat(100), iban: 'BE68539007547034', bedrag: 1, mededeling: 'y'.repeat(200) }).split(
    '\n',
  );
  assert.equal(regels[5].length, 70);
  assert.equal(regels[10].length, 140);
});
