// Demomodus: verzonnen testdata (geen echte personen). Datums hangen af van vandaag, zodat de demo altijd "nu" is.
// Telkens dezelfde data dankzij een vaste willekeurige reeks.

import { SCHEMA } from './schema';
import { mededelingVan, rond } from './hulp';

const DAG = 86400e3;

// Vaste willekeurige getallen (mulberry32)
function reeks(zaad) {
  return () => {
    zaad |= 0;
    zaad = (zaad + 0x6d2b79f5) | 0;
    let t = Math.imul(zaad ^ (zaad >>> 15), 1 | zaad);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Inloggen in de demo: elk wachtwoord werkt. De demobalk heeft ook snelknoppen.
export const DEMO_PERSONEN = [
  { email: 'lotte.peeters@ksa-aalter.be', voornaam: 'Lotte', achternaam: 'Peeters', groep: 2, wat: 'Gewone leiding' },
  { email: 'jens.claes@ksa-aalter.be', voornaam: 'Jens', achternaam: 'Claes', groep: 5, werkgroep: 'Drankteam', wat: 'Drankteam' },
  { email: 'sara.desmet@ksa-aalter.be', voornaam: 'Sara', achternaam: 'De Smet', groep: 4, werkgroep: 'Financiën', wat: 'Financiën' },
  { email: 'ruben.maes@ksa-aalter.be', voornaam: 'Ruben', achternaam: 'Maes', groep: 6, hoofdleiding: true, wat: 'Hoofdleiding' },
];

const ANDEREN = [
  ['Emma', 'Janssens', 7, 'Sfeerbeheer'], ['Wout', 'Wouters', 1], ['Fien', 'Mertens', 1], ['Arne', 'Willems', 3],
  ['Lien', 'Goossens', 3, 'Drankteam'], ['Bram', 'Vermeulen', 5], ['Jana', 'Dubois', 2], ['Seppe', 'Lambrecht', 6],
  ['Noor', 'Hermans', 4, 'Financiën'], ['Mathias', 'Jacobs', 5], ['Ines', 'Martens', 6], ['Lars', 'Coppens', 7],
  ['Hanne', 'Smets', 1], ['Thomas', 'De Clercq', 2],
];

export function maakTestdata() {
  const r = reeks(2026);
  const kies = lijst => lijst[Math.floor(r() * lijst.length)];
  const nu = Date.now();
  const iso = t => new Date(t).toISOString();
  const datum = t => iso(t).slice(0, 10);
  const id = () => crypto.randomUUID();
  const tellers = {};
  const tel = (naam, start) => (tellers[naam] = (tellers[naam] ?? start - 1) + 1);

  const t = Object.fromEntries(Object.keys(SCHEMA).map(k => [k, []]));
  const rij = (tabel, waarden) => {
    const uit = {};
    for (const [k, s] of Object.entries(SCHEMA[tabel])) {
      uit[k] = waarden[k] !== undefined ? waarden[k] : s === 'uuid' ? id() : s === 'nu' ? iso(nu) : s === 'vandaag' ? datum(nu) : ['uid', 'teller'].includes(s) ? null : Array.isArray(s) ? [...s] : s;
    }
    t[tabel].push(uit);
    return uit;
  };

  const jaar = new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  const werkjaar = `${jaar}-${jaar + 1}`;

  // ---------- Groepen, werkgroepen, leiding ----------
  ['Pagadders', 'Kabouters', 'Sloebers', 'Tieners', 'Jim', 'Sim', 'Kim'].forEach((naam, i) => rij('groepen', { id: i + 1, naam, volgorde: i + 1 }));
  const werkgroep = {};
  for (const [naam, rechten] of [
    ['Drankteam', ['drank_beheren']],
    ['Financiën', ['financien']],
    ['Sfeerbeheer', ['agenda_beheren']],
    ['Winkeltje', ['winkeltje_beheren']],
  ]) werkgroep[naam] = rij('werkgroepen', { naam, rechten }).id;

  const leiders = [];
  const nieuweLeider = ({ voornaam, achternaam, email, groep, werkgroep: wg, hoofdleiding = false, oudleiding = false }) => {
    const p = rij('profiles', {
      id: id(),
      voornaam,
      achternaam,
      naam: `${voornaam} ${achternaam}`,
      email,
      is_hoofdleiding: hoofdleiding,
      is_oudleiding: oudleiding,
      groep_werkjaar: oudleiding ? null : werkjaar,
      push_enabled: false,
      created_at: iso(nu - 300 * DAG),
    });
    if (groep) rij('profiel_groepen', { profile_id: p.id, groep_id: groep });
    if (wg) rij('profiel_werkgroepen', { profile_id: p.id, werkgroep_id: werkgroep[wg] });
    if (!oudleiding) leiders.push(p);
    return p;
  };
  for (const p of DEMO_PERSONEN) nieuweLeider(p);
  for (const [voornaam, achternaam, groep, wg] of ANDEREN) {
    const email = `${voornaam}.${achternaam}`.toLowerCase().replace(/\s/g, '') + '@ksa-aalter.be';
    nieuweLeider({ voornaam, achternaam, groep, werkgroep: wg, email });
  }
  nieuweLeider({ voornaam: 'Pieter', achternaam: 'Van Damme', email: 'pieter.vandamme@ksa-aalter.be', oudleiding: true });
  const [lotte, jens, sara, ruben] = leiders;
  const inGroep = g => leiders.filter(p => t.profiel_groepen.some(x => x.profile_id === p.id && x.groep_id === g));

  // ---------- Instellingen ----------
  for (const [key, value] of [
    ['betaal_naam', 'KSA Aalter (demo)'],
    ['betaal_iban', 'BE68539007547034'],
    ['betaal_bic', 'GKCCBEBB'],
  ]) rij('app_settings', { key, value });
  rij('oudleiding_instellingen', { id: 1 });

  // ---------- Dranken ----------
  const vast = [
    ['Cola', 1, 'Frisdrank', 46], ['Fanta', 1, 'Frisdrank', 30], ['Sprite', 1, 'Frisdrank', 22],
    ['Ice Tea', 1, 'Frisdrank', 18], ['Water', 0.8, 'Water', 40], ['Freedom', 1.5, 'Bier', 64],
  ].map(([naam, prijs, categorie, huidige_voorraad]) => rij('dranken', { naam, prijs, categorie, huidige_voorraad, created_at: iso(nu - 300 * DAG) }));
  rij('dranken', { naam: 'Karmeliet', prijs: 3, categorie: 'Speciaalbier', huidige_voorraad: 24, is_temporary: true, geldig_van: iso(nu - DAG), geldig_tot: iso(nu + 2 * DAG) });
  rij('dranken', { naam: 'Kriek', prijs: 2, categorie: 'Bier', huidige_voorraad: 0, is_temporary: true, geldig_van: iso(nu - 30 * DAG), geldig_tot: iso(nu - 27 * DAG) });

  // ---------- Periodes ----------
  const vorige = rij('billing_periods', {
    naam: `Periode vanaf ${new Date(nu - 45 * DAG).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
    start_datum: iso(nu - 45 * DAG), eind_datum: iso(nu - 15 * DAG), is_closed: true, werkjaar, created_at: iso(nu - 45 * DAG),
  });
  const huidige = rij('billing_periods', {
    naam: `Periode vanaf ${new Date(nu - 15 * DAG).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
    start_datum: iso(nu - 15 * DAG), is_closed: false, werkjaar, created_at: iso(nu - 15 * DAG),
  });

  // ---------- Strepen ----------
  const streep = (p, periode, van, tot, aantalKeer) => {
    for (let i = 0; i < aantalKeer; i++) {
      const d = kies(vast);
      const tijd = iso(van + r() * (tot - van));
      rij('consumpties', { user_id: p.id, user_naam: p.naam, drank_id: d.id, aantal: r() < 0.8 ? 1 : 2, period_id: periode.id, datum: tijd, created_at: tijd });
    }
  };
  for (const p of leiders) streep(p, vorige, nu - 45 * DAG, nu - 15 * DAG, 3 + Math.floor(r() * 16));
  for (const p of leiders) streep(p, huidige, nu - 15 * DAG, nu - DAG / 12, Math.floor(r() * 12));
  // Twee aanpassingen via de Google Sheet (zichtbaar in het logboek van Team Drank)
  rij('consumpties', { user_id: lotte.id, user_naam: lotte.naam, drank_id: vast[5].id, aantal: 2, period_id: huidige.id, bron: 'sheet', datum: iso(nu - 2 * DAG) });
  rij('consumpties', { user_id: jens.id, user_naam: jens.naam, drank_id: vast[0].id, aantal: -1, period_id: huidige.id, bron: 'sheet', datum: iso(nu - DAG) });

  // ---------- Extra kosten ----------
  const extraKost = (periode, titel, wijze, bedrag, personen, door) => {
    const k = rij('extra_kosten', { titel, wijze, bedrag, period_id: periode.id, aangemaakt_door: door.id, created_at: periode.start_datum });
    const lijst = [...personen].sort((a, b) => a.naam.localeCompare(b.naam));
    const centen = Math.round(bedrag * 100);
    lijst.forEach((p, i) =>
      rij('billing_corrections', {
        user_id: p.id, user_naam: p.naam, period_id: periode.id, notitie: titel, extra_kost_id: k.id,
        correctie_bedrag: wijze === 'per_persoon' ? bedrag : (Math.floor(centen / lijst.length) + (i < centen % lijst.length ? 1 : 0)) / 100,
      }),
    );
  };
  extraKost(vorige, 'Taart verjaardag Kabouters', 'per_persoon', 2.5, inGroep(2), jens);
  extraKost(huidige, "Cara's leidingsweekend", 'verdelen', 48, [...inGroep(5), ...inGroep(6)], jens);

  // ---------- Friet ----------
  const menu = [
    ['Klein', 2.8, 'frieten'], ['Middel', 3.2, 'frieten'], ['Groot', 3.7, 'frieten'], ['Bicky Burger', 4.2, 'snacks'],
    ['Frikandel', 2.6, 'snacks'], ['Kipcorn', 2.8, 'snacks'], ['Mayonnaise', 1, 'sauzen'], ['Ketchup curry', 1, 'sauzen'], ['Stoofvleessaus', 2.5, 'sauzen'],
  ].map(([name, price, category]) => rij('frituur_items', { name, price, category }));
  const frietRonde = (periode, wanneer, wie) => {
    const s = rij('frituur_sessies', { status: 'completed', created_by: jens.id, created_at: iso(wanneer), closed_at: iso(wanneer + 3600e3), pickup_time: '19:30' });
    for (const p of wie) {
      const items = [kies(menu.filter(m => m.category === 'frieten')), kies(menu.filter(m => m.category !== 'frieten'))].map(m => ({ name: m.name, price: m.price, quantity: 1 }));
      rij('frituur_bestellingen', {
        user_id: p.id, user_name: p.naam, sessie_id: s.id, items, status: 'geleverd', period_id: periode.id, besteld_door: p.id,
        totaal_prijs: rond(items.reduce((x, i) => x + i.price * i.quantity, 0)), created_at: iso(wanneer),
      });
    }
  };
  frietRonde(vorige, nu - 30 * DAG, leiders.slice(0, 9));
  frietRonde(huidige, nu - 6 * DAG, leiders.filter((_, i) => i % 2 === 0));

  // ---------- Facturen van de afgesloten periode ----------
  for (const p of leiders) {
    const cons = t.consumpties.filter(c => c.user_id === p.id && c.period_id === vorige.id);
    const strepen = cons.reduce((s, c) => s + c.aantal, 0);
    const drank = cons.reduce((s, c) => s + c.aantal * t.dranken.find(d => d.id === c.drank_id).prijs, 0);
    const friet = t.frituur_bestellingen.filter(b => b.user_id === p.id && b.period_id === vorige.id).reduce((s, b) => s + b.totaal_prijs, 0);
    const corr = t.billing_corrections.filter(k => k.user_id === p.id && k.period_id === vorige.id).reduce((s, k) => s + k.correctie_bedrag, 0);
    if (!strepen && !friet && !corr) continue;
    const nummer = tel('facturen.nummer', 1001);
    const betaald = r() < 0.6;
    const f = rij('facturen', {
      user_id: p.id, user_naam: p.naam, periode: vorige.naam, period_id: vorige.id, nummer, mededeling: mededelingVan(nummer),
      aantal_strepen: strepen, drank_bedrag: rond(drank), friet_bedrag: rond(friet), correctie_bedrag: rond(corr), totaal_bedrag: rond(drank + friet + corr),
      status: betaald ? 'betaald' : 'onbetaald', betaald_op: betaald ? iso(nu - (2 + r() * 10) * DAG) : null, created_at: vorige.eind_datum, updated_at: vorige.eind_datum,
    });
    for (const c of cons) c.factuur_id = f.id;
    for (const b of t.frituur_bestellingen) if (b.user_id === p.id && b.period_id === vorige.id) b.factuur_id = f.id;
  }

  // ---------- Andere betalingen (Financiën) ----------
  const betaling = (titel, omschrijving, bedrag, vervaldatum, wie, aantalBetaald) => {
    const b = rij('betalingen', { titel, omschrijving, standaard_bedrag: bedrag, vervaldatum, aangemaakt_door: sara.id, created_at: iso(nu - 12 * DAG) });
    wie.forEach((p, i) => {
      const nummer = tel('betaling_posten.nummer', 1);
      rij('betaling_posten', {
        betaling_id: b.id, user_id: p.id, bedrag: i === 0 ? bedrag * 2 : bedrag, nummer, mededeling: mededelingVan(5000000 + nummer),
        status: i < aantalBetaald ? 'betaald' : 'onbetaald', betaald_op: i < aantalBetaald ? iso(nu - 3 * DAG) : null,
        opmerking: i === 0 ? '2 truien' : null, created_at: iso(nu - 12 * DAG),
      });
    });
  };
  betaling('KSA-trui 2026', 'Nieuwe leidingstrui, maat doorgeven aan Sara', 25, datum(nu + 14 * DAG), leiders.slice(0, 10), 4);
  betaling('Leidingsweekend Gent', 'Overnachting en eten', 40, datum(nu - 3 * DAG), leiders.slice(4, 10), 3);

  // ---------- Aankoopfacturen ----------
  for (const [periode, leverancier, bedrag, mededeling, dagen, betaald, notitie] of [
    [vorige, 'Drankcentrale Aalter', 312.4, '+++090/1234/56789+++', 40, true, '20 bakken Freedom, 8 bakken Cola'],
    [vorige, 'Brouwerij Van Steenberge', 145.2, null, 33, true, 'Karmeliet voor de fuif'],
    [huidige, 'Drankcentrale Aalter', 268.9, '+++090/1234/57890+++', 10, false, '16 bakken Freedom, 6 bakken frisdrank'],
    [huidige, 'Colruyt Aalter', 38.75, null, 4, true, 'Chips en nootjes'],
  ]) {
    rij('aankoopfacturen', { period_id: periode.id, leverancier, bedrag, mededeling, factuurdatum: datum(nu - dagen * DAG), betaald, notitie, aangemaakt_door: jens.id, created_at: iso(nu - dagen * DAG), updated_at: iso(nu - dagen * DAG) });
  }

  // ---------- Agenda, polls, berichten, ... ----------
  const ev = [
    ['Leidingsvergadering', 3, 'vergadering', '20:00', 'Lokaal'],
    ['Zondagnamiddag: bosspel', 5, 'activiteit', '14:00', 'Bos van Aalter'],
    ['Leidingsweekend', 12, 'activiteit', '18:00', 'Gent'],
    ['Leidingsvergadering', -4, 'vergadering', '20:00', 'Lokaal'],
  ].map(([titel, dagen, type, tijd, locatie]) =>
    rij('events', { titel, datum: datum(nu + dagen * DAG), type, tijd, start_time: tijd, locatie, beschrijving: `${titel} (demo)`, created_by: ruben.id }),
  );
  for (const p of leiders.slice(0, 12)) rij('event_aanwezigheid', { event_id: ev[0].id, user_id: p.id, status: r() < 0.75 ? 'aanwezig' : 'afwezig' });
  rij('verslagen', { titel: 'Verslag leidingsvergadering', datum: ev[3].datum, event_id: ev[3].id, auteur_id: sara.id, inhoud: 'Afspraken: drankrekening afsluiten, truien bestellen, planning weekend.' });

  const poll = rij('polls', { vraag: 'Waar gaan we op leidingsweekend?', deadline: iso(nu + 5 * DAG), gemaakt_door: ruben.id });
  const opties = ['Ardennen', 'Kust', 'Gent'].map((tekst, i) => rij('poll_opties', { poll_id: poll.id, tekst, volgorde: i }));
  for (const p of leiders.slice(0, 11)) rij('poll_stemmen', { poll_id: poll.id, user_id: p.id, optie_id: kies(opties).id });

  rij('notificaties', { zender_id: ruben.id, zender_naam: ruben.naam, ontvanger_id: 'all', titel: 'Welkom in de demo', bericht: 'Dit is testdata. Probeer gerust alles uit: niets komt in de echte app terecht.', datum: iso(nu - DAG), created_at: iso(nu - DAG) });
  rij('notificaties', { zender_id: jens.id, zender_naam: jens.naam, ontvanger_id: 'all', titel: 'Drankrekening', bericht: 'De vorige periode is afgesloten. Betaal je factuur via Mijn rekening.', datum: iso(nu - 14 * DAG), created_at: iso(nu - 14 * DAG) });

  rij('countdowns', { id: '1', title: 'Kamp', target_date: datum(nu + 260 * DAG) });
  rij('countdowns', { id: '2', title: 'Leidingsweekend', target_date: datum(nu + 12 * DAG) });

  for (const [name, label, count, unit, urgent] of [
    ['Bekers', 'Plastic bekers', 120, 'stuks', false], ['Chips', 'Zakken chips', 6, 'zakken', true], ['Servetten', 'Pakken servetten', 3, 'pakken', false],
  ]) rij('stock_items', { name, label, count, unit, urgent });
  const trui = rij('shop_products', { name: 'KSA-trui', category: 'Kledij' });
  for (const [name, stock] of [['S', 3], ['M', 5], ['L', 2], ['XL', 0]]) rij('shop_variants', { product_id: trui.id, name, stock });

  return { tabellen: t, tellers };
}
