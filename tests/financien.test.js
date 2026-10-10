import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isOpen, isTeLaat, totalen, perLeider, perBetaling, kiesOntvangers } from '../src/lib/financienReken.js';

const dag = '2026-10-10';
const posten = [
  { soort: 'drank', id: 'f1', user_id: 'u1', naam: 'Jos', titel: 'Drank – P1', bedrag: 12.5, status: 'onbetaald', period_id: 'p1', aangemaakt_op: '2026-09-01' },
  { soort: 'drank', id: 'f2', user_id: 'u2', naam: 'Lotte', titel: 'Drank – P1', bedrag: 8, status: 'betaald', period_id: 'p1', aangemaakt_op: '2026-09-01' },
  { soort: 'betaling', id: 'b1', user_id: 'u1', naam: 'Jos', titel: 'Trui', bedrag: 25, status: 'onbetaald', vervaldatum: '2026-10-01', betaling_id: 'B', aangemaakt_op: '2026-09-15' },
  { soort: 'betaling', id: 'b2', user_id: 'u2', naam: 'Lotte', titel: 'Trui', bedrag: 25, status: 'onbetaald', vervaldatum: '2026-10-01', betaling_id: 'B', aangemaakt_op: '2026-09-15' },
  { soort: 'drank', id: 'f3', user_id: 'u3', naam: 'Emma', titel: 'Drank – P1', bedrag: 0, status: 'onbetaald', period_id: 'p1', aangemaakt_op: '2026-09-01' },
];

test('open en te laat', () => {
  assert.equal(isOpen(posten[0]), true);
  assert.equal(isOpen(posten[1]), false);
  assert.equal(isOpen(posten[4]), false); // €0 hoeft niet betaald te worden
  assert.equal(isTeLaat(posten[2], dag), true);
  assert.equal(isTeLaat(posten[2], '2026-09-30'), false);
  assert.equal(isTeLaat(posten[0], dag), false); // geen deadline
});

test('totalen', () => {
  assert.deepEqual(totalen(posten, dag), { open: 62.5, teLaat: 50, ontvangen: 8, aantalOpen: 3 });
});

test('per leider: openstaand, te laat en schatting van de lopende periode', () => {
  const lijst = perLeider(posten, [{ user_id: 'u3', naam: 'Emma', totaal: 4.2 }], dag);
  assert.deepEqual(
    lijst.map(l => [l.naam, l.drank, l.andere, l.open, l.teLaat, l.schatting]),
    [
      ['Jos', 12.5, 25, 37.5, 25, 0],
      ['Lotte', 0, 25, 25, 25, 0],
      ['Emma', 0, 0, 0, 0, 4.2],
    ],
  );
});

test('per betaling: voortgang en totaal (zonder €0-posten)', () => {
  const groepen = perBetaling(posten);
  const trui = groepen.find(g => g.titel === 'Trui');
  assert.equal(trui.aantal, 2);
  assert.equal(trui.aantalBetaald, 0);
  assert.equal(trui.totaal, 50);
  const drank = groepen.find(g => g.soort === 'drank');
  assert.equal(drank.aantal, 2);
  assert.equal(drank.aantalBetaald, 1);
  assert.equal(drank.betaald, 8);
  assert.equal(groepen[0].titel, 'Trui'); // nieuwste eerst
});

test('ontvangers kiezen', () => {
  const users = [
    { id: 'u1', actief: true, groepIds: [1], werkgroepIds: ['w1'] },
    { id: 'u2', actief: true, groepIds: [2], werkgroepIds: [] },
    { id: 'u3', actief: false, groepIds: [1], werkgroepIds: ['w1'] },
  ];
  assert.deepEqual(kiesOntvangers(users, { doel: 'alle' }).map(u => u.id), ['u1', 'u2']);
  assert.deepEqual(kiesOntvangers(users, { doel: 'groep', doelId: '1' }).map(u => u.id), ['u1']);
  assert.deepEqual(kiesOntvangers(users, { doel: 'werkgroep', doelId: 'w1' }).map(u => u.id), ['u1']);
  assert.deepEqual(kiesOntvangers(users, { doel: 'personen', personen: ['u2', 'u3'] }).map(u => u.id), ['u2']);
});
