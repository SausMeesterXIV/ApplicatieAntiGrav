import { test } from 'node:test';
import assert from 'node:assert/strict';
import { euro } from '../src/lib/geld.js';

test('bedragen in Belgische notatie, getal tegen het euroteken', () => {
  assert.equal(euro(1.5), '€1,50');
  assert.equal(euro(0), '€0,00');
  assert.equal(euro(1234.5), '€1.234,50');
  assert.equal(euro('2.4'), '€2,40');
});

test('negatieve bedragen en afronding', () => {
  assert.equal(euro(-2.5), '-€2,50');
  assert.equal(euro(14.285714), '€14,29');
  assert.equal(euro(-0.001), '€0,00'); // geen "-€0,00"
});

test('ongeldige invoer wordt €0,00', () => {
  assert.equal(euro(undefined), '€0,00');
  assert.equal(euro('abc'), '€0,00');
});
