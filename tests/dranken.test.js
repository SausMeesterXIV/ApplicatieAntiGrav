import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drankStatus, isBeschikbaar, drankLabel } from '../src/lib/dranken.js';

const nu = new Date('2026-10-17T12:00:00+02:00');
const cocktail = (van, tot, extra = {}) => ({
  name: 'Cocktail',
  isTemporary: true,
  geldigVan: new Date(van),
  geldigTot: new Date(tot),
  ...extra,
});

test('status van een tijdelijke drank volgt het tijdslot', () => {
  assert.equal(drankStatus(cocktail('2026-10-16T18:00:00+02:00', '2026-10-18T00:00:00+02:00'), nu), 'open');
  assert.equal(drankStatus(cocktail('2026-10-17T18:00:00+02:00', '2026-10-18T00:00:00+02:00'), nu), 'gepland');
  assert.equal(drankStatus(cocktail('2026-10-10T18:00:00+02:00', '2026-10-17T12:00:00+02:00'), nu), 'afgelopen');
  assert.equal(drankStatus({ name: 'Cola', isTemporary: false }, nu), 'vast');
});

test('gewone leiding ziet enkel vaste dranken in de lijst en open tijdelijke dranken', () => {
  assert.equal(isBeschikbaar({ name: 'Cola', isTemporary: false }, nu), true);
  assert.equal(isBeschikbaar({ name: 'Cola', isTemporary: false, uitLijst: true }, nu), false);
  assert.equal(isBeschikbaar(cocktail('2026-10-16T18:00:00+02:00', '2026-10-18T00:00:00+02:00'), nu), true);
  assert.equal(isBeschikbaar(cocktail('2026-10-10T18:00:00+02:00', '2026-10-12T00:00:00+02:00'), nu), false);
});

test('label met tijdslot houdt twee cocktails uit elkaar', () => {
  const eerste = cocktail('2026-10-09T18:00:00+02:00', '2026-10-11T00:00:00+02:00');
  const tweede = cocktail('2026-10-16T18:00:00+02:00', '2026-10-18T00:00:00+02:00');
  assert.equal(drankLabel(eerste), 'Cocktail (09/10 – 10/10)');
  assert.equal(drankLabel(tweede), 'Cocktail (16/10 – 17/10)');
  assert.notEqual(drankLabel(eerste), drankLabel(tweede));
  assert.equal(drankLabel({ name: 'Cola', isTemporary: false }), 'Cola');
  assert.equal(drankLabel(cocktail('2026-10-17T18:00:00+02:00', '2026-10-17T23:00:00+02:00')), 'Cocktail (17/10)');
});
