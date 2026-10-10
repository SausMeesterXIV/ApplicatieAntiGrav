// Financiën: rekenhulp voor het overzicht (drankfacturen + andere betalingen), zonder database.
// Een "post" is één bedrag dat één leider moet betalen: een drankfactuur of een andere betaling.

const r2 = n => Math.round(Number(n || 0) * 100) / 100;

/** Vandaag als 'YYYY-MM-DD' (Belgische tijd) */
export const vandaag = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels' }).format(new Date());

/** Moet er nog iets betaald worden? (€0 of minder hoeft niet) */
export const isOpen = post => post.status !== 'betaald' && Number(post.bedrag) > 0;

/** Openstaand en de deadline is voorbij */
export const isTeLaat = (post, dag = vandaag()) => isOpen(post) && !!post.vervaldatum && post.vervaldatum < dag;

/** Totalen over een lijst posten */
export function totalen(posten, dag = vandaag()) {
  let open = 0;
  let teLaat = 0;
  let ontvangen = 0;
  let aantalOpen = 0;
  for (const p of posten) {
    const bedrag = Number(p.bedrag) || 0;
    if (isOpen(p)) {
      open += bedrag;
      aantalOpen++;
      if (isTeLaat(p, dag)) teLaat += bedrag;
    } else if (p.status === 'betaald') ontvangen += bedrag;
  }
  return { open: r2(open), teLaat: r2(teLaat), ontvangen: r2(ontvangen), aantalOpen };
}

/** Per leider: openstaand (drank/andere), te laat, schatting lopende periode en alle posten */
export function perLeider(posten, schattingen = [], dag = vandaag()) {
  const map = new Map();
  const leider = (id, naam) => {
    if (!map.has(id)) map.set(id, { userId: id, naam: naam || '?', drank: 0, andere: 0, teLaat: 0, schatting: 0, posten: [] });
    return map.get(id);
  };
  for (const p of posten) {
    const l = leider(p.user_id, p.naam);
    l.posten.push(p);
    if (!isOpen(p)) continue;
    if (p.soort === 'drank') l.drank += Number(p.bedrag);
    else l.andere += Number(p.bedrag);
    if (isTeLaat(p, dag)) l.teLaat += Number(p.bedrag);
  }
  for (const s of schattingen) {
    if (Number(s.totaal) > 0) leider(s.user_id, s.naam).schatting = r2(s.totaal);
  }
  return [...map.values()]
    .map(l => ({ ...l, drank: r2(l.drank), andere: r2(l.andere), teLaat: r2(l.teLaat), open: r2(l.drank + l.andere) }))
    .sort((a, b) => b.open - a.open || a.naam.localeCompare(b.naam, 'nl'));
}

/**
 * Posten gegroepeerd per betaling (andere betalingen) of per drankperiode.
 * Geeft [{ sleutel, soort, titel, vervaldatum, posten, totaal, betaald, aantalBetaald }]
 */
export function perBetaling(posten) {
  const map = new Map();
  for (const p of posten) {
    const sleutel = p.soort === 'drank' ? `drank:${p.period_id || p.titel}` : `betaling:${p.betaling_id}`;
    if (!map.has(sleutel)) {
      map.set(sleutel, {
        sleutel,
        soort: p.soort,
        id: p.soort === 'drank' ? p.period_id : p.betaling_id,
        titel: p.titel,
        vervaldatum: p.vervaldatum,
        aangemaakt: p.aangemaakt_op,
        posten: [],
      });
    }
    map.get(sleutel).posten.push(p);
  }
  return [...map.values()]
    .map(g => {
      const teBetalen = g.posten.filter(p => Number(p.bedrag) > 0);
      const betaald = teBetalen.filter(p => p.status === 'betaald');
      return {
        ...g,
        posten: [...g.posten].sort((a, b) => (a.naam || '').localeCompare(b.naam || '', 'nl')),
        totaal: r2(teBetalen.reduce((t, p) => t + Number(p.bedrag), 0)),
        betaald: r2(betaald.reduce((t, p) => t + Number(p.bedrag), 0)),
        aantal: teBetalen.length,
        aantalBetaald: betaald.length,
      };
    })
    .sort((a, b) => String(b.aangemaakt || '').localeCompare(String(a.aangemaakt || '')));
}

/** Ontvangers kiezen: alle actieve leiding, een groep, een werkgroep of gekozen personen */
export function kiesOntvangers(users, { doel, doelId, personen }) {
  const actief = users.filter(u => u.actief);
  if (doel === 'alle') return actief;
  if (doel === 'groep') return actief.filter(u => (u.groepIds || []).map(String).includes(String(doelId)));
  if (doel === 'werkgroep') return actief.filter(u => (u.werkgroepIds || []).includes(doelId));
  if (doel === 'personen') return actief.filter(u => (personen || []).includes(u.id));
  return [];
}
