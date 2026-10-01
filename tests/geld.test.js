import { test } from 'node:test';
import assert from 'node:assert/strict';
import { euro, afrondingsverschil } from '../src/lib/geld.js';

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

test('afrondingsverschil: € 100 over 7 strepen (1 streep elk) geeft 3 cent te veel', () => {
  assert.equal(afrondingsverschil(Array(7).fill(14.29), 100), 0.03);
  assert.equal(afrondingsverschil([33.33, 33.33, 33.33], 100), -0.01);
  assert.equal(afrondingsverschil([50, 50], 100), 0);
});
