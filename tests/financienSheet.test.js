import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KOLOMMEN,
  datumNaarSerie,
  serieNaarDatum,
  leesBedrag,
  leesBetaald,
  gewensteRijen,
  itemNaarRij,
  maakSnapshot,
  overzichtRijen,
  strepenRijen,
  verwerkSheet,
  zelfdeRaster,
  zoekLeider,
} from '../supabase/functions/_shared/financienSheet.js';

const profielen = [
  { id: 'u1', naam: 'Jonas Peeters', nickname: 'Jos' },
  { id: 'u2', naam: 'Lotte Ündervoort', nickname: null },
  { id: 'u3', naam: 'Emma De Smet', nickname: 'Emma' },
];

const drank = {
  sleutel: 'drank:f1',
  soort: 'drank',
  id: 'f1',
  omschrijving: 'Drank – Periode vanaf 01/09/2026',
  naam: 'Jonas Peeters',
  bedrag: 12.5,
  vervaldatum: null,
  betaald: false,
  betaald_op: null,
  mededeling: '+++000/0000/00101+++',
  opmerking: '',
};
const trui = {
  sleutel: 'betaling:p1',
  soort: 'betaling',
  id: 'p1',
  omschrijving: 'Trui 2026',
  naam: 'Lotte Ündervoort',
  bedrag: 25,
  vervaldatum: '2026-11-01',
  betaald: false,
  betaald_op: null,
  mededeling: '+++500/0000/00068+++',
  opmerking: '',
};
const items = [trui, drank];
const snapshot = maakSnapshot(items);
const sheet = () => gewensteRijen(items).map(r => [...r]);

test('datums: heen en terug via het serienummer van Sheets', () => {
  assert.equal(datumNaarSerie('2026-10-10'), 46305);
  assert.equal(serieNaarDatum(46305), '2026-10-10');
  assert.equal(serieNaarDatum('10/10/2026'), '2026-10-10');
  assert.equal(serieNaarDatum('1/2/2026'), '2026-02-01');
  assert.equal(serieNaarDatum(''), null);
  assert.equal(serieNaarDatum('morgen'), null);
  assert.equal(datumNaarSerie(null), '');
});

test('bedragen en vinkjes lezen', () => {
  assert.equal(leesBedrag(25), 25);
  assert.equal(leesBedrag('25,50'), 25.5);
  assert.equal(leesBedrag('€ 1.234,5'), 1234.5);
  assert.equal(leesBedrag('1.234'), 1234);
  assert.equal(leesBedrag('veel'), null);
  assert.equal(leesBetaald(true), true);
  assert.equal(leesBetaald('ja'), true);
  assert.equal(leesBetaald('x'), true);
  assert.equal(leesBetaald(''), false);
  assert.equal(leesBetaald(false), false);
});

test('rijen: drank eerst, dan op omschrijving en naam; kop bovenaan', () => {
  const rijen = gewensteRijen(items);
  assert.deepEqual(rijen[0], KOLOMMEN);
  assert.equal(rijen[1][0], 'Drank');
  assert.equal(rijen[2][0], 'Andere');
  assert.deepEqual(itemNaarRij(trui), ['Andere', 'Trui 2026', 'Lotte Ündervoort', 25, 46327, false, '', '+++500/0000/00068+++', '', 'betaling:p1']);
});

test('ongewijzigde Sheet: niets te doen', () => {
  const r = verwerkSheet({ rijen: sheet(), items, snapshot, profielen });
  assert.deepEqual(r, { updates: [], nieuw: [], behouden: [], problemen: [] });
  assert.ok(zelfdeRaster(sheet(), gewensteRijen(items)));
});

test('Sheets laat lege cellen achteraan weg: toch hetzelfde raster', () => {
  const ingekort = sheet().map(r => {
    const k = [...r];
    while (k.length && (k[k.length - 1] === '' || k[k.length - 1] === false)) k.pop();
    return k;
  });
  assert.ok(zelfdeRaster(ingekort, gewensteRijen(items)));
});

test('vinkje "Betaald" in de Sheet -> betaald in de app (datum zet de database)', () => {
  const s = sheet();
  s[1][5] = true; // drank
  const r = verwerkSheet({ rijen: s, items, snapshot, profielen });
  assert.deepEqual(r.updates, [{ soort: 'drank', id: 'f1', velden: { betaald: true } }]);
});

test('betaald met een eigen datum en een opmerking', () => {
  const s = sheet();
  s[2][5] = true;
  s[2][6] = datumNaarSerie('2026-10-05');
  s[2][8] = 'cash gegeven';
  const r = verwerkSheet({ rijen: s, items, snapshot, profielen });
  assert.deepEqual(r.updates, [
    { soort: 'betaling', id: 'p1', velden: { betaald: true, betaald_op: '2026-10-05', opmerking: 'cash gegeven' } },
  ]);
});

test('bedrag aanpassen kan bij andere betalingen, niet bij drank', () => {
  const s = sheet();
  s[1][3] = 99; // drank: genegeerd (komt uit de strepen)
  s[2][3] = '50,00';
  const r = verwerkSheet({ rijen: s, items, snapshot, profielen });
  assert.deepEqual(r.updates, [{ soort: 'betaling', id: 'p1', velden: { bedrag: 50 } }]);
});

test('ongeldig bedrag: probleem melden, niets aanpassen', () => {
  const s = sheet();
  s[2][3] = 'twintig';
  const r = verwerkSheet({ rijen: s, items, snapshot, profielen });
  assert.equal(r.updates.length, 0);
  assert.match(r.problemen[0], /Rij 3: bedrag "twintig"/);
});

test('conflict: veranderde dezelfde cel ook in de app, dan wint de app', () => {
  const s = sheet();
  s[2][5] = true; // in de Sheet aangevinkt
  const appItems = [{ ...trui, betaald: false, opmerking: 'in de app aangepast' }, drank];
  s[2][8] = 'in de sheet aangepast';
  const r = verwerkSheet({ rijen: s, items: appItems, snapshot, profielen });
  // betaald: enkel in de Sheet veranderd -> overnemen; opmerking: in beide -> app wint
  assert.deepEqual(r.updates, [{ soort: 'betaling', id: 'p1', velden: { betaald: true } }]);
});

test('eerste synchronisatie (geen snapshot): de app is de bron', () => {
  const s = sheet();
  s[1][5] = true;
  const r = verwerkSheet({ rijen: s, items, snapshot: {}, profielen });
  assert.equal(r.updates.length, 0);
});

test('nieuwe rij zonder ID wordt een andere betaling', () => {
  const s = sheet();
  s.push(['', 'T-shirt', 'jos', '12', '15/11/2026', false, '', '', 'maat M', '']);
  const r = verwerkSheet({ rijen: s, items, snapshot, profielen });
  assert.deepEqual(r.nieuw, [
    {
      rijNr: 4,
      titel: 'T-shirt',
      vervaldatum: '2026-11-15',
      user_id: 'u1',
      bedrag: 12,
      betaald: false,
      betaald_op: null,
      opmerking: 'maat M',
    },
  ]);
  assert.deepEqual(r.behouden, []);
});

test('nieuwe rij die nog niet af is, blijft staan (iemand is aan het typen)', () => {
  const s = sheet();
  const half = ['', 'Weekend', '', '', '', false, '', '', '', ''];
  s.push(half);
  const r = verwerkSheet({ rijen: s, items, snapshot, profielen });
  assert.equal(r.nieuw.length, 0);
  assert.equal(r.behouden.length, 1);
  assert.deepEqual(r.problemen, []);
  // en bij het terugschrijven staat ze er nog
  const terug = gewensteRijen(items, r.behouden);
  assert.equal(terug[terug.length - 1][1], 'Weekend');
});

test('onbekende leider of een drankrij zonder ID: melden en laten staan', () => {
  const s = sheet();
  s.push(['Andere', 'Trui', 'Iemand Anders', 25, '', false, '', '', '', '']);
  s.push(['Drank', 'Extra drank', 'Jos', 5, '', false, '', '', '', '']);
  const r = verwerkSheet({ rijen: s, items, snapshot, profielen });
  assert.equal(r.nieuw.length, 0);
  assert.equal(r.behouden.length, 2);
  assert.match(r.problemen[0], /niet gevonden/);
  assert.match(r.problemen[1], /Drankteam/);
});

test('leider zoeken: naam of bijnaam, zonder hoofdletters of accenten', () => {
  assert.equal(zoekLeider('lotte undervoort', profielen)?.id, 'u2');
  assert.equal(zoekLeider('JOS', profielen)?.id, 'u1');
  assert.equal(zoekLeider('Emma', profielen)?.id, 'u3');
  assert.equal(zoekLeider('', profielen), null);
  // dubbelzinnig: twee keer dezelfde naam -> niemand
  assert.equal(zoekLeider('Jos', [...profielen, { id: 'u9', naam: 'Jos' }]), null);
});

test('overzicht per leider: open bedragen, te laat en schatting', () => {
  const rijen = overzichtRijen(
    [drank, trui, { ...trui, sleutel: 'betaling:p2', id: 'p2', naam: 'Jonas Peeters', bedrag: 10, vervaldatum: '2026-10-01' }],
    [{ naam: 'Emma De Smet', totaal: 7.4 }],
    '2026-10-10',
  );
  assert.deepEqual(rijen[1], ['Lotte Ündervoort', 0, 25, 25, 0, 0]);
  assert.deepEqual(rijen[2], ['Jonas Peeters', 12.5, 10, 22.5, 10, 0]);
  assert.deepEqual(rijen[3], ['Emma De Smet', 0, 0, 0, 0, 7.4]);
  assert.deepEqual(rijen[rijen.length - 1], ['Totaal', 12.5, 35, 47.5, 10, 7.4]);
});

test('betaalde rijen tellen niet mee in het overzicht', () => {
  const rijen = overzichtRijen([{ ...drank, betaald: true, betaald_op: '2026-10-01' }], [], '2026-10-10');
  assert.equal(rijen.length, 3); // kop, lege regel, totaal
});


test('tabblad Strepen: per leider per drank, totalen en prijs', () => {
  const dranken = [
    { id: 'd1', naam: 'Freedom', prijs: 1.2 },
    { id: 'd2', naam: 'Fanta', prijs: 1 },
    { id: 'd3', naam: 'Water', prijs: 0.5 }, // niemand dronk water: geen kolom
  ];
  const strepen = [
    { user_id: 'u1', naam: 'Jos', drank_id: 'd1', aantal: 3, prijs: 1.2 },
    { user_id: 'u1', naam: 'Jos', drank_id: 'd2', aantal: 1, prijs: 1 },
    { user_id: 'u2', naam: 'Anna', drank_id: 'd1', aantal: 2, prijs: 1.1 }, // oude prijs bij het strepen
    { user_id: 'u1', naam: 'Jos', drank_id: 'd1', aantal: 1, prijs: null }, // geen bewaarde prijs: huidige
  ];
  const rijen = strepenRijen({ strepen, dranken, periode: { naam: 'Periode vanaf 01/10/2026', start_datum: '2026-10-01T08:00:00Z' } });
  assert.deepEqual(rijen[0], ['Leider', 'Fanta', 'Freedom', 'Totaal strepen', 'Schatting (€)']);
  assert.deepEqual(rijen[1], ['Anna', 0, 2, 2, 2.2]);
  assert.deepEqual(rijen[2], ['Jos', 1, 4, 5, 5.8]);
  assert.deepEqual(rijen[4], ['Totaal', 1, 6, 7, 8]);
  assert.deepEqual(rijen[5], ['Prijs per streep (app)', 1, 1.2]);
  assert.match(rijen[7][0], /sinds 01\/10\/2026/);
});

test('tabblad Strepen zonder strepen', () => {
  const rijen = strepenRijen({ strepen: [], dranken: [{ id: 'd1', naam: 'Pils', prijs: 1 }], periode: null });
  assert.deepEqual(rijen[0], ['Leider', 'Totaal strepen', 'Schatting (€)']);
  assert.deepEqual(rijen[2], ['Totaal', 0, 0]);
  assert.equal(rijen[5][0], 'Geen open periode');
});
