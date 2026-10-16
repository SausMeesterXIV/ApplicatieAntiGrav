import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drankNaam, factuurRijen, rekeningRijen, strepenRijen } from '../supabase/functions/_shared/drankSheet.js';

test('rekening: op naam, met totaalrij', () => {
  const rijen = rekeningRijen([
    { naam: 'Zoë', strepen: 3, drank_bedrag: 4.5, friet_bedrag: 0, correctie_bedrag: 3.33, totaal: 7.83 },
    { naam: 'Arne', strepen: 1, drank_bedrag: 1.5, friet_bedrag: 2.1, correctie_bedrag: 0, totaal: 3.6 },
  ]);
  assert.deepEqual(rijen[0], ['Leider', 'Strepen', 'Drank', 'Friet', 'Extra kosten', 'Totaal']);
  assert.equal(rijen[1][0], 'Arne');
  assert.deepEqual(rijen[3], ['Totaal', 4, 6, 2.1, 3.33, 11.43]);
});

test('strepen: per leider per drank, vaste dranken eerst, totalen', () => {
  const dranken = [
    { id: 1, naam: 'Pils', is_temporary: false },
    { id: 2, naam: 'Cola', is_temporary: false },
    { id: 3, naam: 'Cocktail', is_temporary: true, geldig_van: '2026-10-16T16:00:00Z', geldig_tot: '2026-10-17T22:00:00Z' },
    { id: 4, naam: 'Water', is_temporary: false },
    { id: 5, naam: 'Oud', is_temporary: false, uit_lijst: true },
  ];
  const rijen = strepenRijen(
    [
      { naam: 'Bert', drank_id: 1, aantal: 2 },
      { naam: 'Bert', drank_id: 3, aantal: 1 },
      { naam: 'Anna', drank_id: 2, aantal: 1 },
      { naam: 'Anna', drank_id: 1, aantal: 1 },
      { naam: 'Anna', drank_id: 1, aantal: 1 },
      { naam: 'Carl', drank_id: 2, aantal: 1 },
      { naam: 'Carl', drank_id: 2, aantal: -1 }, // weggehaald: telt niet mee
    ],
    dranken,
  );
  // Vaste dranken altijd (ook Water zonder strepen), uit de lijst niet; tijdelijke enkel met strepen
  assert.deepEqual(rijen[0], ['Leider', 'Cola', 'Pils', 'Water', 'Cocktail (16/10 – 17/10)', 'Totaal']);
  assert.deepEqual(rijen[1], ['Anna', 1, 2, 0, 0, 3]);
  assert.deepEqual(rijen[2], ['Bert', 0, 2, 0, 1, 3]);
  assert.equal(rijen.length, 4); // Carl staat op 0 en zit niet in de vaste lijst: valt weg
  assert.deepEqual(rijen[3], ['Totaal', 1, 4, 0, 1, 6]);
});

test('tijdelijke drank tot middernacht telt t.e.m. de dag ervoor', () => {
  assert.equal(
    drankNaam({ naam: 'Cava', is_temporary: true, geldig_van: '2026-10-16T08:00:00Z', geldig_tot: '2026-10-17T22:00:00Z' }),
    'Cava (16/10 – 17/10)',
  );
});

test('facturen: nieuwste periode eerst, betaald Ja/Nee', () => {
  const rijen = factuurRijen([
    { profiles: { naam: 'Bert' }, billing_periods: { naam: 'Sept', start_datum: '2026-09-01' }, totaal_bedrag: '10', status: 'betaald', betaald_op: '2026-10-02T10:00:00Z' },
    { profiles: { naam: 'Anna' }, billing_periods: { naam: 'Okt', start_datum: '2026-10-01' }, totaal_bedrag: '5.5', status: 'onbetaald' },
  ]);
  assert.equal(rijen[1][0], 'Okt');
  assert.equal(rijen[1][9], 'Nee');
  assert.equal(rijen[2][9], 'Ja');
  assert.equal(rijen[2][10], '02/10/2026');
  assert.equal(rijen[1][7], 5.5);
});

test('zelfdeInhoud: negeert lege cellen achteraan en getal vs tekst', async () => {
  const { zelfdeInhoud } = await import('../supabase/functions/_shared/drankSheet.js');
  assert.ok(zelfdeInhoud([['Leider', 'Totaal'], ['Anna', 3.5]], [['Leider', 'Totaal'], ['Anna', 3.5, ''], []]));
  assert.ok(zelfdeInhoud([['a', '', 'b']], [['a', '', 'b']]));
  assert.ok(!zelfdeInhoud([['Anna', 3.5]], [['Anna', 4]]));
  assert.ok(!zelfdeInhoud(undefined, [['Leider']]));
});

test('start van een periode: alle leiders en vaste dranken met nullen', async () => {
  const dranken = [
    { id: 1, naam: 'Freedom', is_temporary: false },
    { id: 2, naam: 'Fanta', is_temporary: false },
    { id: 3, naam: 'Duvel', is_temporary: true, geldig_van: '2026-10-01T08:00:00Z', geldig_tot: '2026-10-02T08:00:00Z' },
  ];
  const strepen = strepenRijen([], dranken, ['Bert', 'Anna']);
  assert.deepEqual(strepen, [
    ['Leider', 'Fanta', 'Freedom', 'Totaal'],
    ['Anna', 0, 0, 0],
    ['Bert', 0, 0, 0],
    ['Totaal', 0, 0, 0],
  ]);
  const rekening = rekeningRijen([], ['Bert', 'Anna']);
  assert.deepEqual(rekening[1], ['Anna', 0, 0, 0, 0, 0]);
  assert.equal(rekening.length, 4);
});

test('iemand buiten de vaste lijst met strepen (bv. Godmode) komt er toch bij', () => {
  const rijen = strepenRijen([{ naam: 'Tibo D', drank_id: 1, aantal: 2 }], [{ id: 1, naam: 'Freedom' }], ['Anna']);
  assert.deepEqual(rijen.map(r => r[0]), ['Leider', 'Anna', 'Tibo D', 'Totaal']);
  const rek = rekeningRijen([{ naam: 'Tibo D', strepen: 2, drank_bedrag: 3, friet_bedrag: 0, correctie_bedrag: 0, totaal: 3 }], ['Anna']);
  assert.deepEqual(rek.map(r => r[0]), ['Leider', 'Anna', 'Tibo D', 'Totaal']);
});
