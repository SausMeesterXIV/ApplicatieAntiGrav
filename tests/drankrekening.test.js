import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ID_KOP,
  appTellingen,
  drankLijst,
  drankrekeningTabbladen,
  formuleScheiding,
  kolom,
  prijzenUitBakken,
  sheetWijzigingen,
} from '../supabase/functions/_shared/drankSheet.js';

const nu = new Date('2026-10-16T20:00:00Z');
const dranken = [
  { id: 'd1', naam: 'Freedom', prijs: 1, is_temporary: false },
  { id: 'd2', naam: 'Fanta', prijs: 0.8, is_temporary: false },
  { id: 'd3', naam: 'Oud', prijs: 1, is_temporary: false, uit_lijst: true },
  { id: 'd4', naam: 'Cocktail', prijs: 3, is_temporary: true, geldig_van: '2026-10-16T16:00:00Z', geldig_tot: '2026-10-17T22:00:00Z' },
  { id: 'd5', naam: 'Duvel', prijs: 2, is_temporary: true, geldig_van: '2026-10-01T08:00:00Z', geldig_tot: '2026-10-02T22:00:00Z' },
];
const anna = { id: 'u-anna', naam: 'Anna' };
const bert = { id: 'u-bert', naam: 'Bert' };
const oskar = { id: 'u-oskar', naam: 'Oskar', oud: true };

test('kolomletters', () => {
  assert.deepEqual([0, 1, 25, 26, 27, 51, 52].map(kolom), ['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA']);
});

test('dranklijst: vaste, lopende/geplande tijdelijke en alles met strepen', () => {
  assert.deepEqual(drankLijst(dranken, [], nu).map(d => d.id), ['d2', 'd1', 'd4']);
  const strepen = [{ user_id: 'u', naam: 'A', drank_id: 'd3', aantal: 1 }, { user_id: 'u', naam: 'A', drank_id: 'd5', aantal: 2 }];
  assert.deepEqual(drankLijst(dranken, strepen, nu).map(d => d.id), ['d2', 'd1', 'd3', 'd4', 'd5']);
});

test('drankrekening: formules verwijzen naar de juiste kolommen en rijen', () => {
  const { drankrekening: d, bakken: b, opmaak, stand } = drankrekeningTabbladen({
    rekening: [{ user_id: 'u-anna', naam: 'Anna', friet_bedrag: 4.5, correctie_bedrag: 2 }],
    strepen: [
      { user_id: 'u-anna', naam: 'Anna', drank_id: 'd1', aantal: 3 },
      { user_id: 'u-bert', naam: 'Bert', drank_id: 'd4', aantal: 1 },
    ],
    dranken,
    leiders: [bert, anna, oskar],
    nu,
  });
  // Kolommen: A naam, B totaal, C Fanta, D Freedom, E Cocktail, F subtotaal, G friet, H extra, I id (verborgen)
  assert.deepEqual(d[0], ['Leiding', 'Totaal te betalen', 'Fanta', 'Freedom', 'Cocktail (16/10 – 17/10)', 'Subtotaal drank', 'Friet', 'Extra kosten', ID_KOP]);
  // Rijen: 2 Anna, 3 Bert, 4 kopje Oud-leiding, 5 Oskar, 6 leeg, 7 totaal, 8 prijs per streepje, 9 id's (verborgen)
  assert.deepEqual(d[1], ['Anna', '=F2+G2+H2', 0, 3, 0, '=SUMPRODUCT(C2:E2,C$8:E$8)', 4.5, 2, 'u-anna']);
  assert.equal(d[2][0], 'Bert');
  assert.deepEqual(d[3], ['Oud-leiding']);
  assert.equal(d[4][0], 'Oskar');
  assert.deepEqual(d[6], ['Totaal streepjes', '=SUM(B2:B5)', '=SUM(C2:C5)', '=SUM(D2:D5)', '=SUM(E2:E5)', '=SUM(F2:F5)', '=SUM(G2:G5)', '=SUM(H2:H5)']);
  assert.deepEqual(d[7], ['Prijs per streepje', '', '=Bakken!K2', '=Bakken!K3', '=Bakken!K4']);
  assert.deepEqual(d[8], [ID_KOP, '', 'd2', 'd1', 'd4']);
  assert.deepEqual([opmaak.totaalRij, opmaak.prijsRij, opmaak.idRij, opmaak.idKolom, opmaak.oudKopRij], [7, 8, 9, 8, 4]);
  // Bakken rij 3 = Freedom = kolom D van Drankrekening
  assert.equal(b[2][0], 'Freedom');
  assert.deepEqual(b[2].slice(6), ['=E3+D3-C3-F3', '=Drankrekening!D7', '=G3-H3', '=B3*G3', '=IF(OR(B3="",G3=0),L3,IFERROR(J3/H3,0))', 1, 'd1']);
  assert.deepEqual(b[4], ['Totaal', '', '', '', '', '', '=SUM(G2:G4)', '=SUM(H2:H4)', '=SUM(I2:I4)', '=SUM(J2:J4)']);
  // Stand: elk vakje van elke leider (3 leiders x 3 dranken)
  assert.equal(stand.length, 9);
  assert.deepEqual(stand.find(s => s.user_id === 'u-anna' && s.drank_id === 'd1'), { user_id: 'u-anna', drank_id: 'd1', aantal: 3 });
});

test('drank erbij: kolommen schuiven op en de invoer in Bakken blijft bij de juiste drank', () => {
  const oudeBakken = [
    ['Drank'],
    ['Fanta', 0.5, 10, '', 4, '', '=E2+D2-C2-F2', '', '', '', '', 0.8, 'd2'],
    ['Freedom', '=6,32/24', 24, 0, 2, 1, '=E3+D3-C3-F3', '', '', '', '', 1, 'd1'],
  ];
  const metCola = [...dranken, { id: 'd6', naam: 'Cola', prijs: 0.8, is_temporary: false }];
  const { drankrekening: d, bakken: b } = drankrekeningTabbladen({ rekening: [], strepen: [], dranken: metCola, leiders: [anna], oudeBakken, nu });
  assert.deepEqual(d[0].slice(2, 6), ['Cola', 'Fanta', 'Freedom', 'Cocktail (16/10 – 17/10)']);
  assert.deepEqual(b.map(r => r[0]).slice(1, 5), ['Cola', 'Fanta', 'Freedom', 'Cocktail (16/10 – 17/10)']);
  assert.deepEqual(b[1].slice(1, 6), ['', '', '', '', '']); // Cola is nieuw: leeg
  assert.deepEqual(b[2].slice(1, 6), [0.5, 10, '', 4, '']); // Fanta: bewaard
  assert.deepEqual(b[3].slice(1, 6), ['=6,32/24', 24, 0, 2, 1]); // Freedom: formule blijft formule
  assert.equal(b[3][7], '=Drankrekening!E4'); // Freedom staat nu in kolom E; totaalrij 4 (1 leider)
  assert.equal(d[4][4], '=Bakken!K4'); // prijsrij 5, kolom E
});

test('namen die met = of + beginnen worden tekst, geen formule', () => {
  const { drankrekening: d } = drankrekeningTabbladen({ rekening: [], strepen: [], dranken, leiders: [{ id: 'x', naam: '=Hack' }], nu });
  assert.equal(d[1][0], "'=Hack");
});

test('formules met ; voor een Sheet in het Nederlands/Belgisch', () => {
  assert.equal(formuleScheiding('nl_BE'), ';');
  assert.equal(formuleScheiding('en_US'), ',');
  assert.equal(formuleScheiding(undefined), ',');
  const { drankrekening: d, bakken: b } = drankrekeningTabbladen({ rekening: [], strepen: [], dranken, leiders: [anna], nu, scheiding: ';' });
  assert.equal(d[1][5], '=SUMPRODUCT(C2:E2;C$5:E$5)');
  assert.equal(b[1][10], '=IF(OR(B2="";G2=0);L2;IFERROR(J2/H2;0))');
});

// ---------------------------------------------------------------------------
// Aanpassingen in de Sheet -> strepen in de app
// ---------------------------------------------------------------------------
const basis = () => {
  const strepen = [
    { user_id: 'u-anna', naam: 'Anna', drank_id: 'd1', aantal: 3 },
    { user_id: 'u-bert', naam: 'Bert', drank_id: 'd2', aantal: 1 },
  ];
  const r = drankrekeningTabbladen({ rekening: [], strepen, dranken, leiders: [anna, bert], nu });
  // Zoals Google het teruggeeft (UNFORMATTED_VALUE): formules zijn uitgerekend, hier volstaan getallen
  const sheet = r.drankrekening.map(rij => rij.map(c => (typeof c === 'string' && c.startsWith('=') ? 0 : c)));
  return { strepen, sheet, stand: r.stand };
};
// Rij 2 = Anna, rij 3 = Bert; kolom C Fanta, D Freedom, E Cocktail
const zet = (sheet, rij, kol, waarde) => {
  sheet[rij - 1][kol] = waarde;
  return sheet;
};

test('Sheet: niets veranderd geeft geen aanpassingen', () => {
  const { strepen, sheet, stand } = basis();
  assert.deepEqual(sheetWijzigingen(sheet, stand, appTellingen(strepen)), { aanpassingen: [], ongeldig: 0, botsingen: 0 });
});

test('Sheet: strepen bijzetten en weghalen wordt het verschil', () => {
  const { strepen, sheet, stand } = basis();
  zet(sheet, 2, 3, 5); // Anna Freedom 3 -> 5
  zet(sheet, 3, 2, 0); // Bert Fanta 1 -> 0
  zet(sheet, 3, 4, 2); // Bert Cocktail 0 -> 2
  const { aanpassingen } = sheetWijzigingen(sheet, stand, appTellingen(strepen));
  assert.deepEqual(aanpassingen, [
    { user_id: 'u-anna', drank_id: 'd1', verschil: 2 },
    { user_id: 'u-bert', drank_id: 'd2', verschil: -1 },
    { user_id: 'u-bert', drank_id: 'd4', verschil: 2 },
  ]);
});

test('Sheet: leeg gemaakt vakje telt als 0', () => {
  const { strepen, sheet, stand } = basis();
  zet(sheet, 2, 3, '');
  assert.deepEqual(sheetWijzigingen(sheet, stand, appTellingen(strepen)).aanpassingen, [{ user_id: 'u-anna', drank_id: 'd1', verschil: -3 }]);
});

test('Sheet: ongeldige waarden worden genegeerd', () => {
  const { strepen, sheet, stand } = basis();
  zet(sheet, 2, 3, 'veel');
  zet(sheet, 2, 2, -1);
  zet(sheet, 3, 2, 1.5);
  const uit = sheetWijzigingen(sheet, stand, appTellingen(strepen));
  assert.deepEqual(uit.aanpassingen, []);
  assert.equal(uit.ongeldig, 3);
});

test('Sheet: zelfde vakje ook in de app veranderd -> de app wint', () => {
  const { strepen, sheet, stand } = basis();
  zet(sheet, 2, 3, 5); // Sheet: Anna Freedom 3 -> 5
  const app = appTellingen([...strepen, { user_id: 'u-anna', drank_id: 'd1', aantal: 1 }]); // app: 3 -> 4
  const uit = sheetWijzigingen(sheet, stand, app);
  assert.deepEqual(uit.aanpassingen, []);
  assert.equal(uit.botsingen, 1);
});

test('Sheet: rijen gesorteerd in de Sheet -> de id-kolom houdt het juist', () => {
  const { strepen, sheet, stand } = basis();
  [sheet[1], sheet[2]] = [sheet[2], sheet[1]]; // Bert boven Anna
  zet(sheet, 3, 3, 4); // nu staat Anna op rij 3: Freedom 3 -> 4
  assert.deepEqual(sheetWijzigingen(sheet, stand, appTellingen(strepen)).aanpassingen, [{ user_id: 'u-anna', drank_id: 'd1', verschil: 1 }]);
});

test('Sheet zonder id-kolom (oude indeling): niets doen', () => {
  assert.deepEqual(sheetWijzigingen([['Leiding'], ['Anna', 0, 9]], [], new Map()), { aanpassingen: [], ongeldig: 0, botsingen: 0 });
});

test('prijzen uit Bakken: enkel met aankoopprijs en telling', () => {
  const bakken = [
    ['Drank'],
    ['Fanta', 0.3, 0, 0, 100, 0, 100, 90, 10, 30, 0.33333333, 0.8, 'd2'], // ingevuld
    ['Freedom', '', '', '', '', '', 0, 5, -5, 0, 1, 1, 'd1'], // geen aankoopprijs: app-prijs blijft
    ['Cola', 0.3, '', '', '', '', 0, 2, -2, 0, 0.8, 0.8, 'd6'], // aankoopprijs maar nog niet geteld
    ['Kapot', 0.3, 0, 0, 5, 0, 5, 0, 5, 1.5, '#DIV/0!', 1, 'd7'], // fout: overslaan
  ];
  assert.deepEqual([...prijzenUitBakken(bakken)], [['d2', 0.3333]]);
});

test('nieuwe periode: aankoopprijs blijft, tellingen worden leeggemaakt', () => {
  const oudeBakken = [
    ['Drank', '', '', '', '', '', '', '', '', '', '', '', `${ID_KOP} · periode p-oud`],
    ['Freedom', 0.3, 20, 96, 24, 0, '', '', '', '', '', 1, 'd1'],
  ];
  const zelfde = drankrekeningTabbladen({ rekening: [], strepen: [], dranken, leiders: [anna], oudeBakken, nu, periodeId: 'p-oud' });
  assert.deepEqual(zelfde.bakken[2].slice(1, 6), [0.3, 20, 96, 24, 0]);
  assert.equal(zelfde.bakken[0][12], `${ID_KOP} · periode p-oud`);
  const nieuw = drankrekeningTabbladen({ rekening: [], strepen: [], dranken, leiders: [anna], oudeBakken, nu, periodeId: 'p-nieuw' });
  assert.deepEqual(nieuw.bakken[2].slice(1, 6), [0.3, '', '', '', '']);
  assert.equal(nieuw.bakken[0][12], `${ID_KOP} · periode p-nieuw`);
});

test('Bakken uit een oudere versie (kop zonder periode): tellingen blijven staan', () => {
  const oudeBakken = [['Drank', '', '', '', '', '', '', '', '', '', '', '', ID_KOP], ['Freedom', 0.3, 20, 96, 24, 0, '', '', '', '', '', 1, 'd1']];
  const r = drankrekeningTabbladen({ rekening: [], strepen: [], dranken, leiders: [anna], oudeBakken, nu, periodeId: 'p1' });
  assert.deepEqual(r.bakken[2].slice(1, 6), [0.3, 20, 96, 24, 0]);
});
