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
  assert.deepEqual(rijen[0], ['Leider', 'Cola', 'Pils', 'Cocktail (16/10 – 17/10)', 'Totaal']);
  assert.deepEqual(rijen[1], ['Anna', 1, 2, 0, 3]);
  assert.deepEqual(rijen[2], ['Bert', 0, 2, 1, 3]);
  assert.equal(rijen.length, 4); // Carl staat op 0 en valt weg; Water heeft geen strepen
  assert.deepEqual(rijen[3], ['Totaal', 1, 4, 1, 6]);
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
