import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authFout } from '../src/lib/authFouten.js';

test('inloggen: zelfde melding voor onbestaand adres en fout wachtwoord', () => {
  // Echte antwoord van Supabase (code 400, invalid_credentials)
  const fout = { status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' };
  assert.equal(authFout(fout), 'E-mailadres of wachtwoord klopt niet.');
});

test('registreren met ander domein (trigger in de database)', () => {
  assert.match(authFout({ message: 'Database error saving new user' }), /@ksa-aalter\.be/);
});

test('te kort wachtwoord, bestaand account, niet bevestigd', () => {
  assert.match(authFout({ code: 'weak_password', message: 'Password should be at least 8 characters.' }), /8 tekens/);
  assert.match(authFout({ message: 'User already registered' }), /bestaat al een account/);
  assert.match(authFout({ code: 'email_not_confirmed', message: 'Email not confirmed' }), /Bevestig eerst/);
});

test('te veel pogingen en geen verbinding', () => {
  assert.match(authFout({ status: 429, message: 'whatever' }), /Te veel pogingen/);
  assert.match(authFout(new TypeError('Failed to fetch')), /Geen verbinding/);
});

test('onbekende fout: standaardtekst, nooit Engels', () => {
  assert.equal(authFout({ message: 'Something unexpected' }, 'Fout bij het inloggen'), 'Fout bij het inloggen');
});
