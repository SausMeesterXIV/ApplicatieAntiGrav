// Demomodus (npm run dev): een nep-Supabase in de browser met testdata, zodat je vrij kan testen zonder de echte
// database te raken. Vite vervangt src/lib/supabase.js door dit bestand (zie vite.config.js, mode "demo").
// Ondersteunt wat de app gebruikt: from() met select/insert/update/upsert/delete en filters, rpc(), auth,
// storage, functions en realtime. Alles staat in localStorage; "Testdata resetten" zet het terug.

import { SCHEMA } from './schema';
import { maakTestdata } from './testdata';
import { RPC, zetInvoeger } from './rpc';
import { mededelingVan } from './hulp';

const OPSLAG = 'ksa-demo-db-v2';
const SESSIE = 'ksa-demo-sessie';

// ==================== Database in het geheugen ====================

const laad = () => {
  try {
    const bewaard = JSON.parse(localStorage.getItem(OPSLAG) || 'null');
    if (bewaard?.tabellen) return bewaard;
  } catch {
    /* kapotte opslag: opnieuw beginnen */
  }
  return maakTestdata();
};

export const db = laad();
const bewaar = () => {
  try {
    localStorage.setItem(OPSLAG, JSON.stringify(db));
  } catch {
    /* vol of geblokkeerd: dan enkel in het geheugen */
  }
};
bewaar();

export function resetTestdata() {
  localStorage.removeItem(OPSLAG);
  localStorage.removeItem(SESSIE);
  location.reload();
}

export const tabel = naam => (db.tabellen[naam] ||= []);
export const nu = () => new Date().toISOString();
export const teller = (naam, start = 1) => {
  db.tellers[naam] = (db.tellers[naam] || start - 1) + 1;
  return db.tellers[naam];
};

// Primaire sleutels voor upsert zonder onConflict
const SLEUTELS = {
  app_settings: ['key'],
  event_aanwezigheid: ['event_id', 'user_id'],
  poll_stemmen: ['poll_id', 'user_id'],
  notificatie_gelezen: ['notificatie_id', 'user_id'],
  profiel_groepen: ['profile_id', 'groep_id'],
  profiel_werkgroepen: ['profile_id', 'werkgroep_id'],
};

// Wat mee verdwijnt bij het verwijderen van een rij (on delete cascade)
const CASCADE = {
  betalingen: [['betaling_posten', 'betaling_id']],
  polls: [['poll_opties', 'poll_id'], ['poll_stemmen', 'poll_id']],
  events: [['event_aanwezigheid', 'event_id'], ['bijlagen', 'event_id']],
  extra_kosten: [['billing_corrections', 'extra_kost_id']],
  notificaties: [['notificatie_gelezen', 'notificatie_id']],
  shop_products: [['shop_variants', 'product_id']],
  werkgroepen: [['profiel_werkgroepen', 'werkgroep_id']],
};

// Vreemde sleutels: welke kolom verwijst naar welke tabel (voor select('*, profiles(naam)'))
const VERWIJZINGEN = {
  profiles: ['user_id', 'profile_id', 'zender_id', 'aangemaakt_door', 'auteur_id', 'created_by', 'besteld_door', 'gemaakt_door'],
  billing_periods: ['period_id'],
  dranken: ['drank_id'],
  events: ['event_id'],
  polls: ['poll_id'],
  shop_products: ['product_id'],
  betalingen: ['betaling_id'],
  frituur_sessies: ['sessie_id'],
  verslagen: ['verslag_id'],
  facturen: ['factuur_id'],
  werkgroepen: ['werkgroep_id'],
  groepen: ['groep_id'],
};

let huidigeGebruiker = null; // id van wie ingelogd is (voor auth.uid() en standaardwaarden)
export const ingelogd = () => huidigeGebruiker;

function standaard(tabelNaam, rij) {
  const uit = { ...rij };
  for (const [kolom, s] of Object.entries(SCHEMA[tabelNaam] || {})) {
    if (uit[kolom] !== undefined) continue;
    if (s === 'uuid') uit[kolom] = crypto.randomUUID();
    else if (s === 'nu') uit[kolom] = nu();
    else if (s === 'uid') uit[kolom] = huidigeGebruiker;
    else if (s === 'vandaag') uit[kolom] = nu().slice(0, 10);
    else if (s === 'teller') uit[kolom] = teller(`${tabelNaam}.${kolom}`, 1000);
    else uit[kolom] = Array.isArray(s) ? [...s] : s;
  }
  return uit;
}

// "Triggers": wat de echte database zelf invult
function naInvoegen(tabelNaam, rij) {
  if (tabelNaam === 'facturen' && rij.nummer == null) {
    rij.nummer = teller('facturen.nummer', 1001);
    rij.mededeling ||= mededelingVan(rij.nummer);
  }
  if (tabelNaam === 'betaling_posten') rij.mededeling ||= mededelingVan(5000000 + rij.nummer);
  if ((tabelNaam === 'facturen' || tabelNaam === 'betaling_posten') && rij.status === 'betaald') rij.betaald_op ||= nu();
  if (tabelNaam === 'profiles' && !rij.naam) rij.naam = [rij.voornaam, rij.achternaam].filter(Boolean).join(' ') || rij.email;
}
function naAanpassen(tabelNaam, oud, rij) {
  if ('updated_at' in rij && SCHEMA[tabelNaam]?.updated_at === 'nu') rij.updated_at = nu();
  if ((tabelNaam === 'facturen' || tabelNaam === 'betaling_posten') && oud.status !== rij.status) {
    rij.betaald_op = rij.status === 'betaald' ? nu() : null;
  }
}

// Voor de databasefuncties in rpc.js: invoegen met standaardwaarden en "triggers"
zetInvoeger((tabelNaam, invoer) => {
  const rij = standaard(tabelNaam, invoer);
  naInvoegen(tabelNaam, rij);
  tabel(tabelNaam).push(rij);
  meld(tabelNaam, "INSERT", rij);
  return rij;
});

// ==================== Realtime ====================

const luisteraars = []; // { tabel, event, cb }
function meld(tabelNaam, eventType, nieuw, oud) {
  for (const l of luisteraars) {
    if (l.tabel !== tabelNaam || (l.event !== '*' && l.event !== eventType)) continue;
    setTimeout(() => l.cb({ eventType, new: nieuw || {}, old: oud || {}, table: tabelNaam }), 0);
  }
}

// ==================== Query's ====================

const gelijk = (a, b) => a === b || (a != null && b != null && String(a) === String(b));
function vergelijk(a, b) {
  if (a == null || b == null) return a == null ? (b == null ? 0 : -1) : 1;
  const getal = v => typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v));
  if (getal(a) && getal(b)) return Number(a) - Number(b);
  return String(a).localeCompare(String(b));
}
const waarde = v => (v === 'null' ? null : v === 'true' ? true : v === 'false' ? false : v);

function voldoet(rij, [op, kolom, v]) {
  const x = rij[kolom];
  switch (op) {
    case 'eq': return gelijk(x, v);
    case 'neq': return !gelijk(x, v);
    case 'gt': return x != null && vergelijk(x, v) > 0;
    case 'gte': return x != null && vergelijk(x, v) >= 0;
    case 'lt': return x != null && vergelijk(x, v) < 0;
    case 'lte': return x != null && vergelijk(x, v) <= 0;
    case 'in': return v.some(w => gelijk(x, w));
    case 'is': return v === null ? x == null : x === v;
    case 'like':
    case 'ilike': {
      const re = new RegExp(`^${String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`, op === 'ilike' ? 'i' : '');
      return re.test(String(x ?? ''));
    }
    case 'contains': return Array.isArray(x) && [].concat(v).every(w => x.includes(w));
    case 'not': return !voldoet(rij, v);
    case 'or': return v.some(f => voldoet(rij, f));
    default: return true;
  }
}

// "a.eq.x,b.is.null" -> filters
function leesOr(tekst) {
  return tekst.split(',').map(deel => {
    const [kolom, op, ...rest] = deel.split('.');
    const v = rest.join('.');
    return [op, kolom, op === 'in' ? v.replace(/^\(|\)$/g, '').split(',') : waarde(v)];
  });
}

// select('*, alias:tabel!hint(kolommen)') -> [{ soort: 'alles' | 'kolom' | 'embed', ... }]
function leesSelect(tekst = '*') {
  const delen = [];
  let diepte = 0;
  let huidig = '';
  for (const c of tekst.replace(/\s+/g, ' ')) {
    if (c === '(') diepte++;
    if (c === ')') diepte--;
    if (c === ',' && diepte === 0) {
      delen.push(huidig.trim());
      huidig = '';
    } else huidig += c;
  }
  if (huidig.trim()) delen.push(huidig.trim());
  return delen.map(d => {
    const m = d.match(/^(?:(\w+):)?(\w+)(?:!(\w+))?\((.*)\)$/s);
    if (m) return { soort: 'embed', alias: m[1] || m[2], tabel: m[2], hint: m[3] === 'inner' ? null : m[3], velden: leesSelect(m[4]) };
    if (d === '*') return { soort: 'alles' };
    const k = d.match(/^(?:(\w+):)?(\w+)/);
    return { soort: 'kolom', alias: k[1] || k[2], naam: k[2] };
  });
}

function relatie(ouder, doel, hint) {
  if (hint) {
    const naam = hint.replace(/_fkey$/, '');
    if (naam.startsWith(`${ouder}_`)) return { een: true, kolom: naam.slice(ouder.length + 1) };
    if (naam.startsWith(`${doel}_`)) return { een: false, kolom: naam.slice(doel.length + 1) };
    return { een: true, kolom: hint };
  }
  const kolommen = Object.keys(SCHEMA[ouder] || {});
  const heen = (VERWIJZINGEN[doel] || []).find(k => kolommen.includes(k));
  if (heen) return { een: true, kolom: heen };
  const doelKolommen = Object.keys(SCHEMA[doel] || {});
  const terug = (VERWIJZINGEN[ouder] || []).find(k => doelKolommen.includes(k));
  return { een: false, kolom: terug || `${ouder.replace(/s$/, '')}_id` };
}

function projecteer(tabelNaam, rij, velden) {
  const uit = {};
  for (const v of velden) {
    if (v.soort === 'alles') Object.assign(uit, structuredClone(rij));
    else if (v.soort === 'kolom') uit[v.alias] = rij[v.naam] ?? null;
    else {
      const r = relatie(tabelNaam, v.tabel, v.hint);
      if (r.een) {
        const doel = tabel(v.tabel).find(x => gelijk(x.id, rij[r.kolom]));
        uit[v.alias] = doel ? projecteer(v.tabel, doel, v.velden) : null;
      } else {
        uit[v.alias] = tabel(v.tabel).filter(x => gelijk(x[r.kolom], rij.id)).map(x => projecteer(v.tabel, x, v.velden));
      }
    }
  }
  return uit;
}

const fout = message => ({ data: null, error: { message, code: 'DEMO' }, count: null, status: 400 });

class Query {
  constructor(tabelNaam) {
    this.t = tabelNaam;
    this.actie = 'select';
    this.filters = [];
    this.orders = [];
    this.velden = '*';
    this.terug = null; // select() na een insert/update
  }
  select(velden = '*', opties = {}) {
    if (this.actie === 'select') {
      this.velden = velden;
      this.opties = opties;
    } else this.terug = velden || '*';
    return this;
  }
  insert(rijen) {
    this.actie = 'insert';
    this.data = rijen;
    return this;
  }
  upsert(rijen, opties = {}) {
    this.actie = 'upsert';
    this.data = rijen;
    this.upsertOpties = opties;
    return this;
  }
  update(waarden) {
    this.actie = 'update';
    this.data = waarden;
    return this;
  }
  delete() {
    this.actie = 'delete';
    return this;
  }
  eq(k, v) { this.filters.push(['eq', k, v]); return this; }
  neq(k, v) { this.filters.push(['neq', k, v]); return this; }
  gt(k, v) { this.filters.push(['gt', k, v]); return this; }
  gte(k, v) { this.filters.push(['gte', k, v]); return this; }
  lt(k, v) { this.filters.push(['lt', k, v]); return this; }
  lte(k, v) { this.filters.push(['lte', k, v]); return this; }
  in(k, v) { this.filters.push(['in', k, v]); return this; }
  is(k, v) { this.filters.push(['is', k, v]); return this; }
  like(k, v) { this.filters.push(['like', k, v]); return this; }
  ilike(k, v) { this.filters.push(['ilike', k, v]); return this; }
  contains(k, v) { this.filters.push(['contains', k, v]); return this; }
  match(obj) { for (const [k, v] of Object.entries(obj)) this.eq(k, v); return this; }
  not(k, op, v) { this.filters.push(['not', k, [op, k, waarde(v)]]); return this; }
  or(tekst) { this.filters.push(['or', null, leesOr(tekst)]); return this; }
  filter(k, op, v) { this.filters.push([op, k, waarde(v)]); return this; }
  order(k, { ascending = true, nullsFirst } = {}) { this.orders.push({ k, ascending, nullsFirst }); return this; }
  limit(n) { this.max = n; return this; }
  range(van, tot) { this.van = van; this.max = tot - van + 1; return this; }
  single() { this.enkel = 'single'; return this; }
  maybeSingle() { this.enkel = 'maybe'; return this; }
  abortSignal() { return this; }
  then(ok, nok) {
    return new Promise(r => setTimeout(r, 40)) // een beetje "netwerk", zodat laadschermen zichtbaar blijven werken
      .then(() => this.uitvoeren())
      .then(ok, nok);
  }

  past(rij) {
    return this.filters.every(f => voldoet(rij, f));
  }

  uitvoeren() {
    if (!SCHEMA[this.t]) return fout(`Tabel ${this.t} bestaat niet in de demo`);
    const rijen = tabel(this.t);
    let resultaat;

    if (this.actie === 'select') {
      resultaat = rijen.filter(r => this.past(r));
    } else if (this.actie === 'insert' || this.actie === 'upsert') {
      resultaat = [];
      const lijst = [].concat(this.data);
      const sleutels = this.upsertOpties?.onConflict?.split(',').map(s => s.trim()) || SLEUTELS[this.t] || ['id'];
      for (const invoer of lijst) {
        const bestaand =
          this.actie === 'upsert' && sleutels.every(k => invoer[k] != null)
            ? rijen.find(r => sleutels.every(k => gelijk(r[k], invoer[k])))
            : null;
        if (bestaand) {
          if (this.upsertOpties?.ignoreDuplicates) continue;
          const oud = { ...bestaand };
          Object.assign(bestaand, invoer);
          naAanpassen(this.t, oud, bestaand);
          resultaat.push(bestaand);
          meld(this.t, 'UPDATE', bestaand, oud);
        } else {
          const rij = standaard(this.t, invoer);
          naInvoegen(this.t, rij);
          rijen.push(rij);
          resultaat.push(rij);
          meld(this.t, 'INSERT', rij);
        }
      }
      bewaar();
    } else if (this.actie === 'update') {
      resultaat = rijen.filter(r => this.past(r));
      for (const rij of resultaat) {
        const oud = { ...rij };
        Object.assign(rij, this.data);
        naAanpassen(this.t, oud, rij);
        meld(this.t, 'UPDATE', rij, oud);
      }
      bewaar();
    } else if (this.actie === 'delete') {
      resultaat = rijen.filter(r => this.past(r));
      verwijderRijen(this.t, resultaat);
      bewaar();
    }

    if (this.actie !== 'select' && this.terug == null) {
      return { data: null, error: null, count: null, status: 204 };
    }

    for (const o of [...this.orders].reverse()) {
      resultaat = [...resultaat].sort((a, b) => {
        if (a[o.k] == null || b[o.k] == null) {
          if (a[o.k] == null && b[o.k] == null) return 0;
          const nullEerst = o.nullsFirst ?? !o.ascending;
          return (a[o.k] == null) === nullEerst ? -1 : 1;
        }
        const c = vergelijk(a[o.k], b[o.k]);
        return o.ascending ? c : -c;
      });
    }
    const totaal = resultaat.length;
    if (this.van) resultaat = resultaat.slice(this.van);
    if (this.max != null) resultaat = resultaat.slice(0, this.max);

    const velden = leesSelect(this.actie === 'select' ? this.velden : this.terug);
    let data = this.opties?.head ? null : resultaat.map(r => projecteer(this.t, r, velden));
    const count = this.opties?.count ? totaal : null;

    if (this.enkel) {
      if (data.length > 1) return fout('Meer dan één rij gevonden');
      if (!data.length) {
        return this.enkel === 'maybe'
          ? { data: null, error: null, count, status: 200 }
          : { data: null, error: { message: 'Geen rij gevonden', code: 'PGRST116' }, count, status: 406 };
      }
      data = data[0];
    }
    return { data, error: null, count, status: 200 };
  }
}

export function verwijderRijen(tabelNaam, weg) {
  const ids = new Set(weg);
  db.tabellen[tabelNaam] = tabel(tabelNaam).filter(r => !ids.has(r));
  for (const rij of weg) {
    meld(tabelNaam, 'DELETE', null, rij);
    for (const [kind, kolom] of CASCADE[tabelNaam] || []) {
      verwijderRijen(kind, tabel(kind).filter(r => gelijk(r[kolom], rij.id)));
    }
  }
}

// ==================== Auth ====================

const authLuisteraars = new Set();
const sessieVan = id => {
  const p = tabel('profiles').find(x => x.id === id);
  return p ? { access_token: 'demo', token_type: 'bearer', user: { id: p.id, email: p.email, role: 'authenticated' } } : null;
};
let sessie = (() => {
  try {
    return sessieVan(localStorage.getItem(SESSIE));
  } catch {
    return null;
  }
})();
huidigeGebruiker = sessie?.user.id || null;

function zetSessie(id, event) {
  sessie = id ? sessieVan(id) : null;
  huidigeGebruiker = sessie?.user.id || null;
  try {
    if (id) localStorage.setItem(SESSIE, id);
    else localStorage.removeItem(SESSIE);
  } catch {
    /* geen opslag */
  }
  for (const cb of authLuisteraars) setTimeout(() => cb(event, sessie), 0);
}

/** Demo: meteen inloggen als iemand (knoppen in de demobalk) */
export const loginAls = id => zetSessie(id, id ? 'SIGNED_IN' : 'SIGNED_OUT');

const auth = {
  getSession: async () => ({ data: { session: sessie }, error: null }),
  getUser: async () => ({ data: { user: sessie?.user || null }, error: null }),
  onAuthStateChange(cb) {
    authLuisteraars.add(cb);
    return { data: { subscription: { unsubscribe: () => authLuisteraars.delete(cb) } } };
  },
  async signInWithPassword({ email }) {
    const p = tabel('profiles').find(x => x.email?.toLowerCase() === String(email).trim().toLowerCase());
    if (!p) return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } };
    zetSessie(p.id, 'SIGNED_IN'); // in de demo werkt elk wachtwoord
    return { data: { user: sessie.user, session: sessie }, error: null };
  },
  async signUp({ email, options }) {
    if (tabel('profiles').some(x => x.email?.toLowerCase() === email.toLowerCase())) {
      return { data: { user: null }, error: { message: 'User already registered' } };
    }
    const meta = options?.data || {};
    const rij = standaard('profiles', {
      id: crypto.randomUUID(),
      email,
      voornaam: meta.voornaam || null,
      achternaam: meta.achternaam || null,
      naam: meta.naam || [meta.voornaam, meta.achternaam].filter(Boolean).join(' ') || email.split('@')[0],
      actief: false,
      goedkeuring: 'wacht',
    });
    tabel('profiles').push(rij);
    bewaar();
    zetSessie(rij.id, 'SIGNED_IN');
    return { data: { user: sessie.user, session: sessie }, error: null };
  },
  async signOut() {
    zetSessie(null, 'SIGNED_OUT');
    return { error: null };
  },
  async updateUser() {
    return { data: { user: sessie?.user || null }, error: null };
  },
  async resetPasswordForEmail() {
    return { data: {}, error: null };
  },
};

// ==================== Opslag (foto's, bijlagen) ====================

const bestanden = new Map(); // "bucket/pad" -> object-URL (enkel zolang de pagina open is)
const placeholder = naam =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#e5e7eb"/><text x="50%" y="50%" font-family="sans-serif" font-size="18" fill="#6b7280" text-anchor="middle">Demo: ${naam}</text></svg>`,
  )}`;
const storage = {
  from(bucket) {
    const sleutel = pad => `${bucket}/${pad}`;
    return {
      async upload(pad, bestand) {
        bestanden.set(sleutel(pad), URL.createObjectURL(bestand));
        return { data: { path: pad }, error: null };
      },
      async remove(paden) {
        for (const p of paden) bestanden.delete(sleutel(p));
        return { data: [], error: null };
      },
      getPublicUrl: pad => ({ data: { publicUrl: bestanden.get(sleutel(pad)) || placeholder(pad.split('/').pop()) } }),
      async createSignedUrl(pad) {
        return { data: { signedUrl: bestanden.get(sleutel(pad)) || placeholder(pad.split('/').pop()) }, error: null };
      },
      async download(pad) {
        const url = bestanden.get(sleutel(pad));
        if (!url) return { data: null, error: { message: 'Bestand niet gevonden (demo)' } };
        return { data: await (await fetch(url)).blob(), error: null };
      },
      async list() {
        return { data: [], error: null };
      },
    };
  },
};

// ==================== Edge functions ====================

const functions = {
  async invoke(naam, { body } = {}) {
    if (naam === 'drank-sheet') {
      return { data: { url: 'https://docs.google.com/spreadsheets/', demo: true, ongewijzigd: true }, error: null };
    }
    if (naam === 'drive-fotos') return { data: { albums: [], fotos: [] }, error: null };
    if (naam === 'send-push') return { data: { verzonden: 0 }, error: null };
    return { data: null, error: { message: `"${naam}" werkt niet in de demomodus (${body?.actie || 'geen actie'})` } };
  },
};

// ==================== Client ====================

export const supabase = {
  from: t => new Query(t),
  async rpc(naam, args = {}) {
    await new Promise(r => setTimeout(r, 40));
    const f = RPC[naam];
    if (!f) return fout(`Functie ${naam} bestaat niet in de demo`);
    try {
      const data = f(args, { uid: huidigeGebruiker });
      bewaar();
      return { data: data === undefined ? null : data, error: null };
    } catch (e) {
      return fout(e.message);
    }
  },
  auth,
  storage,
  functions,
  channel() {
    const kanaal = {
      on(_soort, filter, cb) {
        luisteraars.push({ tabel: filter.table, event: filter.event || '*', cb, kanaal });
        return kanaal;
      },
      subscribe(cb) {
        cb?.('SUBSCRIBED');
        return kanaal;
      },
      unsubscribe() {
        for (let i = luisteraars.length - 1; i >= 0; i--) if (luisteraars[i].kanaal === kanaal) luisteraars.splice(i, 1);
      },
    };
    return kanaal;
  },
  removeChannel(kanaal) {
    kanaal?.unsubscribe?.();
  },
};
