import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drankLijst, drankrekeningTabbladen, kolom } from '../supabase/functions/_shared/drankSheet.js';

const nu = new Date('2026-10-16T20:00:00Z');
const dranken = [
  { id: 1, naam: 'Freedom', prijs: 1, is_temporary: false },
  { id: 2, naam: 'Fanta', prijs: 0.8, is_temporary: false },
  { id: 3, naam: 'Oud', prijs: 1, is_temporary: false, uit_lijst: true },
  { id: 4, naam: 'Cocktail', prijs: 3, is_temporary: true, geldig_van: '2026-10-16T16:00:00Z', geldig_tot: '2026-10-17T22:00:00Z' },
  { id: 5, naam: 'Duvel', prijs: 2, is_temporary: true, geldig_van: '2026-10-01T08:00:00Z', geldig_tot: '2026-10-02T22:00:00Z' },
];

test('kolomletters', () => {
  assert.deepEqual([0, 1, 25, 26, 27, 51, 52].map(kolom), ['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA']);
});

test('dranklijst: vaste, lopende/geplande tijdelijke en alles met strepen', () => {
  assert.deepEqual(drankLijst(dranken, [], nu).map(d => d.id), [2, 1, 4]);
  // Uit de lijst of afgelopen, maar met strepen: toch erbij (anders kloppen de totalen niet)
  const strepen = [{ naam: 'A', drank_id: 3, aantal: 1 }, { naam: 'A', drank_id: 5, aantal: 2 }];
  assert.deepEqual(drankLijst(dranken, strepen, nu).map(d => d.id), [2, 1, 3, 4, 5]);
});

test('drankrekening: formules verwijzen naar de juiste kolommen en rijen', () => {
  const { drankrekening: d, bakken: b, opmaak } = drankrekeningTabbladen({
    rekening: [{ naam: 'Anna', friet_bedrag: 4.5, correctie_bedrag: 2 }],
    strepen: [{ naam: 'Anna', drank_id: 1, aantal: 3 }, { naam: 'Bert', drank_id: 4, aantal: 1 }],
    dranken,
    leiders: [{ naam: 'Bert' }, { naam: 'Anna' }, { naam: 'Oskar', oud: true }],
    nu,
  });
  // Kolommen: A naam, B totaal, C Fanta, D Freedom, E Cocktail, F subtotaal, G friet, H extra
  assert.deepEqual(d[0], ['Leiding', 'Totaal te betalen', 'Fanta', 'Freedom', 'Cocktail (16/10 – 17/10)', 'Subtotaal drank', 'Friet', 'Extra kosten']);
  // Rijen: 2 Anna, 3 Bert, 4 kopje Oud-leiding, 5 Oskar, 6 leeg, 7 totaal, 8 prijs per streepje
  assert.deepEqual(d[1], ['Anna', '=F2+G2+H2', 0, 3, 0, '=SUMPRODUCT(C2:E2,C$8:E$8)', 4.5, 2]);
  assert.equal(d[2][0], 'Bert');
  assert.deepEqual(d[3], ['Oud-leiding']);
  assert.equal(d[4][0], 'Oskar');
  assert.deepEqual(d[6], ['Totaal streepjes', '=SUM(B2:B5)', '=SUM(C2:C5)', '=SUM(D2:D5)', '=SUM(E2:E5)', '=SUM(F2:F5)', '=SUM(G2:G5)', '=SUM(H2:H5)']);
  assert.deepEqual(d[7], ['Prijs per streepje', '', '=Bakken!K2', '=Bakken!K3', '=Bakken!K4']);
  assert.equal(opmaak.totaalRij, 7);
  assert.equal(opmaak.prijsRij, 8);
  assert.equal(opmaak.oudKopRij, 4);
  // Bakken rij 3 = Freedom = kolom D van Drankrekening
  assert.equal(b[2][0], 'Freedom');
  assert.deepEqual(b[2].slice(6), ['=E3+D3-C3-F3', '=Drankrekening!D7', '=G3-H3', '=B3*G3', '=IF(B3="",L3,IFERROR(J3/H3,0))', 1, '1']);
  assert.deepEqual(b[4], ['Totaal', '', '', '', '', '', '=SUM(G2:G4)', '=SUM(H2:H4)', '=SUM(I2:I4)', '=SUM(J2:J4)']);
});

test('drank erbij: kolommen schuiven op en de invoer in Bakken blijft bij de juiste drank', () => {
  const oudeBakken = [
    ['Drank'],
    ['Fanta', 0.5, 10, '', 4, '', '=E2+D2-C2-F2', '', '', '', '', 0.8, '2'],
    ['Freedom', '=6.32/24', 24, 0, 2, 1, '=E3+D3-C3-F3', '', '', '', '', 1, '1'],
  ];
  const metCola = [...dranken, { id: 6, naam: 'Cola', prijs: 0.8, is_temporary: false }];
  const { drankrekening: d, bakken: b } = drankrekeningTabbladen({ rekening: [], strepen: [], dranken: metCola, leiders: [{ naam: 'Anna' }], oudeBakken, nu });
  assert.deepEqual(d[0].slice(2, 6), ['Cola', 'Fanta', 'Freedom', 'Cocktail (16/10 – 17/10)']);
  assert.deepEqual(b.map(r => r[0]).slice(1, 5), ['Cola', 'Fanta', 'Freedom', 'Cocktail (16/10 – 17/10)']);
  assert.deepEqual(b[1].slice(1, 6), ['', '', '', '', '']); // Cola is nieuw: leeg
  assert.deepEqual(b[2].slice(1, 6), [0.5, 10, '', 4, '']); // Fanta: bewaard
  assert.deepEqual(b[3].slice(1, 6), ['=6.32/24', 24, 0, 2, 1]); // Freedom: formule blijft formule
  assert.equal(b[3][7], '=Drankrekening!E4'); // Freedom staat nu in kolom E; totaalrij 4 (1 leider)
  assert.equal(d[4][4], '=Bakken!K4'); // prijsrij 5, kolom E
});

test('namen die met = of + beginnen worden tekst, geen formule', () => {
  const { drankrekening: d } = drankrekeningTabbladen({ rekening: [], strepen: [], dranken, leiders: [{ naam: '=Hack' }], nu });
  assert.equal(d[1][0], "'=Hack");
});

test('formules met ; voor een Sheet in het Nederlands/Belgisch', async () => {
  const { formuleScheiding } = await import('../supabase/functions/_shared/drankSheet.js');
  assert.equal(formuleScheiding('nl_BE'), ';');
  assert.equal(formuleScheiding('en_US'), ',');
  assert.equal(formuleScheiding(undefined), ',');
  const { drankrekening: d, bakken: b } = drankrekeningTabbladen({ rekening: [], strepen: [], dranken, leiders: [{ naam: 'Anna' }], nu, scheiding: ';' });
  assert.equal(d[1][5], '=SUMPRODUCT(C2:E2;C$5:E$5)');
  assert.equal(b[1][10], '=IF(B2="";L2;IFERROR(J2/H2;0))');
});
