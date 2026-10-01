import { test } from 'node:test';
import assert from 'node:assert/strict';
import { euro } from '../src/lib/geld.js';

const NBSP = ' ';

test('bedragen in Belgische notatie met harde spatie', () => {
  assert.equal(euro(1.5), `€${NBSP}1,50`);
  assert.equal(euro(0), `€${NBSP}0,00`);
  assert.equal(euro(1234.5), `€${NBSP}1.234,50`);
  assert.equal(euro('2.4'), `€${NBSP}2,40`);
});

test('negatieve bedragen en afronding', () => {
  assert.equal(euro(-2.5), `-€${NBSP}2,50`);
  assert.equal(euro(14.285714), `€${NBSP}14,29`);
  assert.equal(euro(-0.001), `€${NBSP}0,00`); // geen "-€ 0,00"
});

test('ongeldige invoer wordt € 0,00', () => {
  assert.equal(euro(undefined), `€${NBSP}0,00`);
  assert.equal(euro('abc'), `€${NBSP}0,00`);
});
