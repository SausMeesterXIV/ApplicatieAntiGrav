import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { herlaadNaUpdate, vergeetHerladen } from '../src/lib/herladen.js';

// Minimale browser-omgeving: sessionStorage en window.location.reload
let herlaadd = 0;
beforeEach(() => {
  const opslag = new Map();
  globalThis.sessionStorage = {
    getItem: k => (opslag.has(k) ? opslag.get(k) : null),
    setItem: (k, v) => opslag.set(k, String(v)),
    removeItem: k => opslag.delete(k),
  };
  herlaadd = 0;
  globalThis.window = { location: { reload: () => herlaadd++ } };
});

test('herlaadt één keer, niet eindeloos', () => {
  assert.equal(herlaadNaUpdate(), true);
  assert.equal(herlaadNaUpdate(), false);
  assert.equal(herlaadd, 1);
});

test('na een geslaagde lading mag een volgende update opnieuw herladen', () => {
  herlaadNaUpdate();
  vergeetHerladen();
  assert.equal(herlaadNaUpdate(), true);
  assert.equal(herlaadd, 2);
});

test('zonder sessionStorage (privévenster) wordt niet herladen', () => {
  globalThis.sessionStorage = {
    getItem: () => {
      throw new Error('geblokkeerd');
    },
  };
  assert.equal(herlaadNaUpdate(), false);
  assert.equal(herlaadd, 0);
});
