import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leesBedrag, parseCsv, zoekBetalingen } from '../src/lib/uittreksel.js';

const facturen = [
  { id: 'a', mededeling: '+++000/0000/01295+++', totaal_bedrag: 12.5 },
  { id: 'b', mededeling: '+++000/0000/02391+++', totaal_bedrag: 1234.56 },
  { id: 'c', mededeling: '+++000/0000/03487+++', totaal_bedrag: 8 },
];

test('leesBedrag: Belgische en internationale notaties', () => {
  assert.equal(leesBedrag('12,50'), 12.5);
  assert.equal(leesBedrag('1.234,56'), 1234.56);
  assert.equal(leesBedrag('1,234.56'), 1234.56);
  assert.equal(leesBedrag('+12.50'), 12.5);
  assert.equal(leesBedrag('EUR 8'), 8);
  assert.equal(leesBedrag('€ 8,00'), 8);
  assert.equal(leesBedrag('1.234'), 1234); // duizendtal
  assert.equal(leesBedrag('-3,20'), -3.2);
});

test('leesBedrag: geen bedrag', () => {
  assert.equal(leesBedrag('01/10/2026'), null);
  assert.equal(leesBedrag('BE68 5390 0754 7034'), null);
  assert.equal(leesBedrag(''), null);
  assert.equal(leesBedrag('abc'), null);
});

test('parseCsv: puntkomma, aanhalingstekens en lege regels', () => {
  const rijen = parseCsv('a;b;c\r\n"x; y";"he zei ""hallo""";3\n\n');
  assert.deepEqual(rijen, [
    ['a', 'b', 'c'],
    ['x; y', 'he zei "hallo"', '3'],
  ]);
});

test('parseCsv: komma als scheiding', () => {
  assert.deepEqual(parseCsv('"Date","Amount"\n"2026-10-01","+12.50"'), [
    ['Date', 'Amount'],
    ['2026-10-01', '+12.50'],
  ]);
});

test('zoekBetalingen: KBC-achtig uittreksel', () => {
  const csv = `Rekening;Datum;Bedrag;Omschrijving;Mededeling
BE68 5390 0754 7034;01/10/2026;12,50;"OVERSCHRIJVING VAN JAN; +++000/0000/01295+++";
BE68 5390 0754 7034;02/10/2026;1.234,56;;000000002391
BE68 5390 0754 7034;03/10/2026;7,00;***000/0000/03487***;
BE68 5390 0754 7034;04/10/2026;-8,00;+++000/0000/03487+++;uitgaand`;
  const gevonden = Object.fromEntries(zoekBetalingen(parseCsv(csv), facturen).map(g => [g.factuur.id, g]));

  assert.equal(gevonden.a.bedragKlopt, true);
  assert.equal(gevonden.b.bedragKlopt, true);
  // 7 euro betaald op een factuur van 8: gevonden maar bedrag klopt niet; de uitgaande -8 telt niet
  assert.equal(gevonden.c.bedragKlopt, false);
  assert.deepEqual(gevonden.c.bedragen, [7]);
});

test('zoekBetalingen: een juiste betaling wint van een foute voor dezelfde factuur', () => {
  const csv = `x;5,00;+++000/0000/03487+++\ny;8,00;+++000/0000/03487+++`;
  const [g] = zoekBetalingen(parseCsv(csv), facturen);
  assert.equal(g.factuur.id, 'c');
  assert.equal(g.bedragKlopt, true);
});

test('zoekBetalingen: rekeningnummers en langere getallen geven geen valse treffers', () => {
  const csv = `BE00 0000 0000 0129;12,50;ref 10000000001295;000000012950`;
  assert.deepEqual(zoekBetalingen(parseCsv(csv), facturen), []);
});

test('zoekBetalingen: betaalde facturen worden niet meegegeven, dus niet gevonden', () => {
  const csv = `x;12,50;+++000/0000/01295+++`;
  assert.deepEqual(zoekBetalingen(parseCsv(csv), []), []);
});
