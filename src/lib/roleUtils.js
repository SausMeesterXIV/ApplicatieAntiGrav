// Rollen- en rechtenmodel (CLAUDE.md):
// - vaste groepen (Pagadders … Kim) en een vlag is_hoofdleiding op het profiel
// - werkgroepen die de hoofdleiding zelf aanmaakt; elke werkgroep heeft een lijst rechten
// - hoofdleiding heeft alle rechten
// De database dwingt dezelfde regels af via RLS (heeft_recht / is_hoofdleiding).

export const RECHTEN = {
  agenda_beheren: 'Agenda-items maken en aanpassen',
  drank_beheren: 'Drank: strepen voor anderen, dranken, voorraad, facturatie, friet-menu',
  berichten_sturen: 'Berichten sturen naar iedereen, groepen of werkgroepen',
  polls_maken: 'Polls maken',
  financien: 'Financiën: overzicht van wie wat moet betalen, andere betalingen, Google Sheet',
  winkeltje_beheren: 'Winkeltje (later)',
};

// Oude rolnamen die nog in de code gebruikt worden -> recht
const LEGACY_NAAR_RECHT = {
  drank: 'drank_beheren',
  team_drank: 'drank_beheren',
  'team drank': 'drank_beheren',
  drankteam: 'drank_beheren',
  sfeerbeheer: 'agenda_beheren',
  'financiën': 'financien',
  financien: 'financien',
  winkeltje: 'winkeltje_beheren',
};
const HOOFDLEIDING_NAMEN = ['hoofdleiding', 'admin', 'godmode'];

// Rechten van hoofdleiding: echte hoofdleiding of een Godmode-account (label "Godmode", migratie 003100/003300).
// Voor het label "Hoofdleiding" gebruik je user.isHoofdleiding, niet deze functie.
export const isHoofdleiding = user => !!(user?.isHoofdleiding || user?.isGodmode);

// Oudleiding heeft nooit extra rechten (ook niet als er nog een werkgroep aan hangt)
export const hasRecht = (user, recht) =>
  !!user && !user.isOudleiding && (isHoofdleiding(user) || (user.rechten || []).includes(recht));

export const isOudleiding = user => !!user?.isOudleiding;

// hasAccess(user, 'drank') / ('hoofdleiding') / ('sfeerbeheer') / of rechtstreeks een recht
export const hasAccess = (user, rolOfRecht) => {
  if (!user) return false;
  const key = String(rolOfRecht || '').toLowerCase();
  if (HOOFDLEIDING_NAMEN.includes(key)) return isHoofdleiding(user);
  return hasRecht(user, LEGACY_NAAR_RECHT[key] || key);
};

export const hasRole = hasAccess;

/**
 * Vult een profiel aan met isHoofdleiding, groepIds, werkgroepIds, rechten en roles (labels voor weergave).
 * Zonder rolData (nieuwe tabellen nog niet gemigreerd) wordt teruggevallen op de oude kolommen rol/roles.
 */
export function verrijkGebruiker(user, rolData, godmodeIds = []) {
  const isGodmode = godmodeIds.includes(user.id);
  if (!rolData) return { ...verrijkUitOudeRollen(user), isGodmode };

  const groepIds = rolData.profielGroepen.filter(pg => pg.profile_id === user.id).map(pg => pg.groep_id);
  const werkgroepIds = rolData.profielWerkgroepen.filter(pw => pw.profile_id === user.id).map(pw => pw.werkgroep_id);
  const werkgroepen = rolData.werkgroepen.filter(w => werkgroepIds.includes(w.id));
  const groepen = rolData.groepen.filter(g => groepIds.includes(g.id));
  const rechten = [...new Set(werkgroepen.flatMap(w => w.rechten || []))];
  const isHoofd = !!user.is_hoofdleiding;

  return {
    ...user,
    isHoofdleiding: isHoofd,
    // Godmode: alle rechten van hoofdleiding, eigen label; enkel in de database aan te passen (003100/003300)
    isGodmode,
    isOudleiding: !!user.is_oudleiding,
    groepIds,
    werkgroepIds,
    rechten,
    roles: [
      ...(isGodmode ? ['Godmode'] : []),
      ...(isHoofd ? ['Hoofdleiding'] : []),
      ...(user.is_oudleiding ? ['Oudleiding'] : []),
      ...groepen.map(g => g.naam),
      ...werkgroepen.map(w => w.naam),
    ],
  };
}

function verrijkUitOudeRollen(user) {
  const labels = (user.roles || []).map(r => String(r).toLowerCase().trim());
  const rol = String(user.rol || '').toLowerCase();
  const isHoofd = HOOFDLEIDING_NAMEN.includes(rol) || labels.some(l => HOOFDLEIDING_NAMEN.includes(l));
  const rechten = [...new Set([rol, ...labels].map(l => LEGACY_NAAR_RECHT[l]).filter(Boolean))];
  return {
    ...user,
    isHoofdleiding: isHoofd,
    isOudleiding: !!user.is_oudleiding,
    groepIds: [],
    werkgroepIds: [],
    rechten,
    roles: user.roles || [],
  };
}
