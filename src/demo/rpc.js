// Demomodus: de databasefuncties (rpc) nagebouwd in JavaScript, met dezelfde regels als in supabase/migrations.
// Een fout gooien = zelfde foutmelding als de echte database.

import { tabel, nu, verwijderRijen } from './fakeSupabase';
import { rond } from './hulp';

const profiel = id => tabel('profiles').find(p => p.id === id);
const isLid = uid => !!profiel(uid)?.actief;
const isHoofd = uid => !!profiel(uid)?.is_hoofdleiding;
function heeftRecht(uid, recht) {
  if (!isLid(uid)) return false;
  if (isHoofd(uid)) return true;
  const mijn = tabel('profiel_werkgroepen').filter(r => r.profile_id === uid).map(r => r.werkgroep_id);
  return tabel('werkgroepen').some(w => mijn.includes(w.id) && (w.rechten || []).includes(recht));
}
const openPeriode = () =>
  tabel('billing_periods')
    .filter(p => !p.is_closed)
    .sort((a, b) => String(b.start_datum).localeCompare(String(a.start_datum)))[0];
const naam = p => [p.voornaam, p.achternaam].filter(Boolean).join(' ').trim() || p.naam;

function periodeOverzicht({ p_period_id = null, p_echte_kost = null } = {}, { uid, alles: geforceerd = false } = {}) {
  if (!isLid(uid) && !geforceerd) return [];
  const alles = geforceerd || heeftRecht(uid, 'drank_beheren') || heeftRecht(uid, 'financien');
  const periode = p_period_id || openPeriode()?.id;
  const inPeriode = r => r.factuur_id == null && (r.period_id === periode || r.period_id == null);
  const cons = tabel('consumpties').filter(inPeriode);
  const totaalStrepen = cons.reduce((s, c) => s + c.aantal, 0);
  const perStreep = Number(p_echte_kost) > 0 && totaalStrepen > 0 ? p_echte_kost / totaalStrepen : null;
  const per = new Map();
  const rij = id => per.get(id) || per.set(id, { strepen: 0, prijs: 0, friet: 0, correctie: 0 }).get(id);
  for (const c of cons) {
    const d = tabel('dranken').find(x => x.id === c.drank_id);
    const r = rij(c.user_id);
    r.strepen += c.aantal;
    r.prijs += c.aantal * Number(c.prijs ?? d?.prijs ?? 0);
  }
  for (const b of tabel('frituur_bestellingen').filter(inPeriode)) if (b.user_id) rij(b.user_id).friet += Number(b.totaal_prijs || 0);
  for (const k of tabel('billing_corrections').filter(k => k.period_id === periode)) rij(k.user_id).correctie += Number(k.correctie_bedrag);
  return [...per.entries()]
    .filter(([id]) => profiel(id) && (alles || id === uid))
    .map(([id, r]) => {
      const drank = perStreep != null ? r.strepen * perStreep : r.prijs;
      return {
        user_id: id,
        naam: profiel(id).naam,
        strepen: r.strepen,
        drank_bedrag: rond(drank),
        friet_bedrag: rond(r.friet),
        correctie_bedrag: rond(r.correctie),
        totaal: rond(drank + r.friet + r.correctie),
      };
    });
}

export function sluitPeriodeAf(periode, { echteKost = null, nieuweStart = nu() } = {}) {
  let aantal = 0;
  for (const r of periodeOverzicht({ p_period_id: periode.id, p_echte_kost: echteKost }, { alles: true })) {
    if (r.strepen === 0 && r.totaal === 0) continue;
    const factuur = {
      id: crypto.randomUUID(),
      user_id: r.user_id,
      user_naam: r.naam,
      totaal_bedrag: r.totaal,
      periode: periode.naam,
      status: 'onbetaald',
      period_id: periode.id,
      aantal_strepen: r.strepen,
      drank_bedrag: r.drank_bedrag,
      friet_bedrag: r.friet_bedrag,
      correctie_bedrag: r.correctie_bedrag,
      created_at: nieuweStart,
      updated_at: nieuweStart,
    };
    voegToe('facturen', factuur);
    for (const t of ['consumpties', 'frituur_bestellingen']) {
      for (const x of tabel(t)) {
        if (x.user_id === r.user_id && x.factuur_id == null && (x.period_id === periode.id || x.period_id == null)) x.factuur_id = factuur.id;
      }
    }
    aantal++;
  }
  periode.is_closed = true;
  periode.eind_datum = nieuweStart;
  periode.echte_kost = Number(echteKost) > 0 ? echteKost : null;
  const d = new Date(nieuweStart);
  const jaar = d.getMonth() < 7 || (d.getMonth() === 7 && d.getDate() < 15) ? d.getFullYear() - 1 : d.getFullYear();
  const nieuw = {
    id: crypto.randomUUID(),
    naam: `Periode vanaf ${d.toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
    start_datum: nieuweStart,
    is_closed: false,
    geschatte_kost: 0,
    werkjaar: `${jaar}-${jaar + 1}`,
    created_at: nieuweStart,
  };
  voegToe('billing_periods', nieuw);
  return { closed_period_id: periode.id, new_period_id: nieuw.id, aantal_facturen: aantal };
}

// Invoegen via de gewone weg (standaardwaarden en "triggers"), zonder een query te bouwen
let voegToeIntern = null;
export const zetInvoeger = f => (voegToeIntern = f);
const voegToe = (t, rij) => voegToeIntern(t, rij);

const vereis = (voorwaarde, boodschap) => {
  if (!voorwaarde) throw new Error(boodschap);
};

export const RPC = {
  periode_overzicht: (a, { uid }) => periodeOverzicht(a, { uid }),

  ranking_huidige_periode: (_a, { uid }) => {
    if (!isLid(uid)) return [];
    const per = new Map();
    for (const c of tabel('consumpties').filter(c => c.factuur_id == null)) per.set(c.user_id, (per.get(c.user_id) || 0) + c.aantal);
    return [...per.entries()]
      .filter(([id]) => profiel(id))
      .map(([id, strepen]) => ({ user_id: id, naam: profiel(id).nickname || profiel(id).naam, strepen }))
      .sort((a, b) => b.strepen - a.strepen);
  },

  streep_drank: ({ p_user_id, p_drank_id, p_aantal = 1, p_period_id = null }, { uid }) => {
    vereis(isLid(uid), 'Niet ingelogd als actieve leiding');
    const drankteam = heeftRecht(uid, 'drank_beheren');
    vereis(p_user_id === uid || drankteam, 'Enkel Drankteam mag strepen zetten voor anderen');
    vereis(p_aantal >= 1, 'Ongeldig aantal');
    const d = tabel('dranken').find(x => x.id === p_drank_id);
    vereis(d, 'Onbekende drank');
    if (!drankteam) {
      vereis(!d.uit_lijst, `${d.naam} staat niet meer in de lijst`);
      const t = Date.now();
      vereis(
        !d.is_temporary || (t >= Date.parse(d.geldig_van) && t < Date.parse(d.geldig_tot)),
        `${d.naam} kan je enkel strepen in de afgesproken periode`,
      );
    }
    const p = profiel(p_user_id);
    vereis(p?.actief, 'Onbekende of inactieve leider');
    const periode = tabel('billing_periods').find(x => x.id === p_period_id && !x.is_closed) || openPeriode();
    vereis(periode, 'Er staat geen drankperiode open');
    const rij = { user_id: p_user_id, drank_id: p_drank_id, aantal: p_aantal, period_id: periode.id, user_naam: p.naam };
    return voegToe('consumpties', rij).id;
  },

  sluit_periode_af: ({ p_period_id = null, p_echte_kost = null }, { uid }) => {
    vereis(heeftRecht(uid, 'drank_beheren'), 'Enkel Drankteam mag een periode afsluiten');
    const periode = p_period_id ? tabel('billing_periods').find(p => p.id === p_period_id) : openPeriode();
    vereis(periode, 'Geen open periode gevonden');
    vereis(!periode.is_closed, 'Deze periode is al afgesloten');
    return sluitPeriodeAf(periode, { echteKost: p_echte_kost });
  },

  financien_overzicht: (_a, { uid }) => {
    if (!isLid(uid)) return [];
    const alles = heeftRecht(uid, 'financien');
    const drank = tabel('facturen')
      .filter(f => alles || f.user_id === uid)
      .map(f => ({
        soort: 'drank', id: f.id, user_id: f.user_id, naam: profiel(f.user_id)?.naam || f.user_naam,
        titel: `Drank – ${f.periode || 'periode'}`, bedrag: f.totaal_bedrag, mededeling: f.mededeling,
        status: f.status || 'onbetaald', betaald_op: f.betaald_op, vervaldatum: null, opmerking: f.opmerking,
        betaling_id: null, period_id: f.period_id, aangemaakt_op: f.created_at,
      }));
    const andere = tabel('betaling_posten')
      .filter(bp => alles || bp.user_id === uid)
      .map(bp => {
        const b = tabel('betalingen').find(x => x.id === bp.betaling_id);
        return b && {
          soort: 'betaling', id: bp.id, user_id: bp.user_id, naam: profiel(bp.user_id)?.naam, titel: b.titel,
          bedrag: bp.bedrag, mededeling: bp.mededeling, status: bp.status, betaald_op: bp.betaald_op,
          vervaldatum: b.vervaldatum, opmerking: bp.opmerking, betaling_id: b.id, period_id: null, aangemaakt_op: bp.created_at,
        };
      })
      .filter(Boolean);
    return [...drank, ...andere];
  },

  zet_betaald: ({ p_soort, p_id, p_betaald }, { uid }) => {
    const t = p_soort === 'drank' ? 'facturen' : p_soort === 'betaling' ? 'betaling_posten' : null;
    vereis(t, `Onbekende soort ${p_soort}`);
    if (t === 'facturen') {
      vereis(heeftRecht(uid, 'drank_beheren') || heeftRecht(uid, 'financien'), 'Enkel Drankteam, Financiën of hoofdleiding mag een drankfactuur op betaald zetten');
    } else vereis(heeftRecht(uid, 'financien'), 'Enkel Financiën of hoofdleiding mag een betaling op betaald zetten');
    const rij = tabel(t).find(x => x.id === p_id);
    vereis(rij, 'Niet gevonden');
    rij.status = p_betaald ? 'betaald' : 'onbetaald';
    rij.betaald_op = p_betaald ? nu() : null;
    rij.updated_at = nu();
  },

  maak_extra_kost: ({ p_titel, p_wijze, p_bedrag, p_user_ids }, { uid }) => {
    vereis(heeftRecht(uid, 'drank_beheren') || heeftRecht(uid, 'financien'), 'Enkel Drankteam of Financiën kan extra kosten aanrekenen');
    vereis(['verdelen', 'per_persoon'].includes(p_wijze), 'Kies: totaal verdelen of bedrag per persoon');
    vereis(p_bedrag > 0, 'Vul een bedrag groter dan 0 in');
    vereis(String(p_titel || '').trim(), "Geef de extra kost een naam, bv. Cara's weekend");
    const periode = openPeriode();
    vereis(periode, 'Er staat geen drankperiode open');
    const personen = tabel('profiles')
      .filter(p => p_user_ids.includes(p.id) && p.actief)
      .sort((a, b) => a.naam.localeCompare(b.naam) || a.id.localeCompare(b.id));
    vereis(personen.length, 'Kies minstens één persoon');
    const kost = voegToe('extra_kosten', { titel: p_titel.trim(), wijze: p_wijze, bedrag: rond(p_bedrag), period_id: periode.id, aangemaakt_door: uid });
    const centen = Math.round(p_bedrag * 100);
    const basis = Math.floor(centen / personen.length);
    const rest = centen % personen.length;
    personen.forEach((p, i) =>
      voegToe('billing_corrections', {
        user_id: p.id, period_id: periode.id, user_naam: p.naam, notitie: p_titel.trim(), extra_kost_id: kost.id,
        correctie_bedrag: p_wijze === 'per_persoon' ? rond(p_bedrag) : (basis + (i < rest ? 1 : 0)) / 100,
      }),
    );
    return kost.id;
  },

  verwijder_extra_kost: ({ p_id }, { uid }) => {
    vereis(heeftRecht(uid, 'drank_beheren') || heeftRecht(uid, 'financien'), 'Enkel Drankteam of Financiën kan extra kosten verwijderen');
    const kost = tabel('extra_kosten').find(k => k.id === p_id);
    const periode = kost && tabel('billing_periods').find(p => p.id === kost.period_id);
    vereis(!periode?.is_closed, 'Deze periode is afgesloten: de extra kost staat al op de facturen');
    if (kost) verwijderRijen('extra_kosten', [kost]);
  },

  corrigeer_voorraad: ({ p_drank_id, p_nieuwe_voorraad, p_notitie = null }, { uid }) => {
    vereis(heeftRecht(uid, 'drank_beheren'), 'Enkel Drankteam mag de voorraad corrigeren');
    const d = tabel('dranken').find(x => x.id === p_drank_id);
    vereis(d, 'Onbekende drank');
    voegToe('voorraad_correcties', { drank_id: d.id, oude_voorraad: d.huidige_voorraad, nieuwe_voorraad: p_nieuwe_voorraad, notitie: p_notitie, door: uid });
    d.huidige_voorraad = p_nieuwe_voorraad;
  },

  finalize_frituur_sessie: ({ p_sessie_id, p_actual_amount = 0 }, { uid }) => {
    vereis(isLid(uid), 'Niet ingelogd als actieve leiding');
    const s = tabel('frituur_sessies').find(x => x.id === p_sessie_id);
    vereis(s, 'Onbekende frietronde');
    vereis(s.status !== 'completed', 'Deze frietronde is al afgesloten');
    const best = tabel('frituur_bestellingen').filter(b => b.sessie_id === s.id);
    for (const b of best) b.status = 'geleverd';
    Object.assign(s, { status: 'completed', actual_amount: Number(p_actual_amount) || null, closed_at: nu() });
    return { expected_amount: rond(best.reduce((t, b) => t + Number(b.totaal_prijs || 0), 0)), actual_amount: p_actual_amount };
  },

  gooi_frietronde_weg: ({ p_sessie_id }, { uid }) => {
    vereis(isLid(uid), 'Niet ingelogd als actieve leiding');
    const s = tabel('frituur_sessies').find(x => x.id === p_sessie_id);
    vereis(s, 'Onbekende frietronde');
    vereis(!s.closed_at, 'Deze frietronde is al afgerekend en blijft bewaard');
    const best = tabel('frituur_bestellingen').filter(b => b.sessie_id === s.id);
    vereis(!best.some(b => b.factuur_id), 'Er staan al bestellingen van deze ronde op een factuur');
    for (const b of best) {
      if (b.user_id && b.user_id !== uid) {
        voegToe('notificaties', {
          zender_id: uid, ontvanger_id: b.user_id, titel: '🍟 Frietbestelling geannuleerd', type: 'order', action: 'Bekijken|/frituur',
          zender_naam: profiel(uid)?.naam, bericht: `${profiel(uid)?.naam || 'Iemand'} heeft je frietbestelling geannuleerd. Dit komt niet op je drankfactuur.`,
        });
      }
    }
    verwijderRijen('frituur_bestellingen', best);
    for (const n of tabel('notificaties')) {
      if (n.type === 'order' && n.action === 'Bestellen|/frituur' && n.verloopt_op && Date.parse(n.verloopt_op) > Date.now()) n.verloopt_op = nu();
    }
    verwijderRijen('frituur_sessies', [s]);
    return best.length;
  },

  stuur_bericht: ({ p_doel, p_doel_id, p_personen, p_titel, p_bericht, p_afzender_naam }, { uid }) => {
    if (p_doel === 'open_factuur') {
      vereis(heeftRecht(uid, 'berichten_sturen') || heeftRecht(uid, 'drank_beheren'), 'Je hebt geen recht om deze berichten te sturen');
    } else vereis(heeftRecht(uid, 'berichten_sturen'), 'Je hebt geen recht om berichten te sturen');
    vereis(String(p_titel || '').trim(), 'Onderwerp ontbreekt');
    const zitIn = (t, kol, p) => tabel(t).some(r => r.profile_id === p.id && String(r[kol]) === String(p_doel_id));
    const ontvangers = tabel('profiles').filter(
      p =>
        p.actief && p.id !== uid &&
        ((p_doel === 'alle' && !p.is_oudleiding) ||
          (p_doel === 'oudleiding' && p.is_oudleiding) ||
          (p_doel === 'groep' && zitIn('profiel_groepen', 'groep_id', p)) ||
          (p_doel === 'werkgroep' && zitIn('profiel_werkgroepen', 'werkgroep_id', p)) ||
          (p_doel === 'personen' && (p_personen || []).includes(p.id)) ||
          (p_doel === 'open_factuur' && tabel('facturen').some(f => f.user_id === p.id && f.status !== 'betaald'))),
    );
    for (const p of ontvangers) {
      voegToe('notificaties', { zender_id: uid, ontvanger_id: p.id, titel: p_titel, bericht: p_bericht, zender_naam: p_afzender_naam || profiel(uid)?.naam, type: 'official' });
    }
    return ontvangers.length;
  },

  kies_groep: ({ p_groep_id }, { uid }) => {
    vereis(isLid(uid), 'Enkel leiding kiest een groep');
    vereis(tabel('groepen').some(g => g.id === Number(p_groep_id)), 'Onbekende groep');
    const lijst = tabel('profiel_groepen');
    for (let i = lijst.length - 1; i >= 0; i--) if (lijst[i].profile_id === uid) lijst.splice(i, 1);
    lijst.push({ profile_id: uid, groep_id: Number(p_groep_id) });
    const d = new Date();
    const jaar = d.getMonth() < 7 || (d.getMonth() === 7 && d.getDate() < 15) ? d.getFullYear() - 1 : d.getFullYear();
    profiel(uid).groep_werkjaar = `${jaar}-${jaar + 1}`;
  },

  godmode_ids: () => [],
  mijn_goedkeuring: (_a, { uid }) => profiel(uid)?.goedkeuring ?? null,

  wachtende_accounts: (_a, { uid }) =>
    isLid(uid)
      ? tabel('profiles')
          .filter(p => p.goedkeuring === 'wacht')
          .map(p => ({ id: p.id, voornaam: p.voornaam, achternaam: p.achternaam, naam: p.naam, email: p.email, aangemaakt_op: p.created_at }))
      : [],

  beoordeel_account: ({ p_id, p_goedkeuren }, { uid }) => {
    vereis(isLid(uid), 'Enkel actieve leiding kan nieuwe accounts goedkeuren');
    const p = profiel(p_id);
    vereis(p, 'Account niet gevonden');
    if (p.goedkeuring !== 'wacht') return p.goedkeuring;
    p.goedkeuring = p_goedkeuren ? 'goedgekeurd' : 'afgewezen';
    p.actief = !!p_goedkeuren;
    return p.goedkeuring;
  },

  reset_leiders: () =>
    tabel('profiles')
      .filter(p => p.actief && !p.is_oudleiding)
      .map(p => ({ id: p.id, naam: naam(p) }))
      .sort((a, b) => a.naam.localeCompare(b.naam)),

  vraag_wachtwoord_reset: ({ p_email, p_leider }) => {
    const p = tabel('profiles').find(x => x.email?.toLowerCase() === String(p_email).trim().toLowerCase() && x.actief);
    if (p && p.id !== p_leider) {
      for (const r of tabel('wachtwoord_resets')) if (r.user_id === p.id && ['open', 'code'].includes(r.status)) r.status = 'vervangen';
      voegToe('wachtwoord_resets', { user_id: p.id, leider_id: p_leider });
    }
    return 'ok';
  },

  mijn_resetverzoeken: (_a, { uid }) =>
    tabel('wachtwoord_resets')
      .filter(r => r.leider_id === uid && r.status === 'open' && Date.now() - Date.parse(r.aangevraagd_op) < 3600e3)
      .map(r => ({ id: r.id, naam: naam(profiel(r.user_id)), email: profiel(r.user_id)?.email, aangevraagd_op: r.aangevraagd_op })),

  maak_resetcode: ({ p_id }, { uid }) => {
    const r = tabel('wachtwoord_resets').find(x => x.id === p_id && x.leider_id === uid && x.status === 'open');
    vereis(r, 'Dit verzoek bestaat niet meer of is al afgehandeld');
    const code = String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
    Object.assign(r, { status: 'code', code_hash: code, code_gemaakt_op: nu(), pogingen: 0 });
    return code;
  },

  weiger_reset: ({ p_id }, { uid }) => {
    const r = tabel('wachtwoord_resets').find(x => x.id === p_id && x.leider_id === uid && x.status === 'open');
    if (r) r.status = 'geweigerd';
  },

  zet_oudleidingscode: ({ p_code }, { uid }) => {
    vereis(heeftRecht(uid, 'drank_beheren'), 'Enkel Drankteam en hoofdleiding');
    vereis(p_code == null || String(p_code).trim().length >= 6, 'De code moet minstens 6 tekens lang zijn');
    const rij = tabel('oudleiding_instellingen')[0];
    Object.assign(rij, { code: String(p_code ?? '').trim() || null, code_gewijzigd_op: nu(), mislukt: 0, mislukt_sinds: null });
  },

  zet_oudleiding_actief: ({ p_user_id, p_actief }, { uid }) => {
    vereis(heeftRecht(uid, 'drank_beheren'), 'Enkel Drankteam en hoofdleiding');
    const p = profiel(p_user_id);
    vereis(p?.is_oudleiding, 'Dit is geen oudleiding');
    p.actief = !!p_actief;
  },
};

