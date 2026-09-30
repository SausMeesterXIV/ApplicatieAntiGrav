// Bollen bovenaan het startscherm (zoals Instagram-stories).
// Vaste bollen ziet iedereen; rol-bollen enkel wie dat recht heeft (hoofdleiding ziet alles).
// De volgorde kiest elke leider zelf (Instellingen > Volgorde bollen); bewaard op het profiel.
import { hasRecht, isHoofdleiding } from '../../lib/roleUtils';
import { updateProfile } from '../../lib/supabaseService';

const iedereen = () => true;
const metRecht = recht => user => hasRecht(user, recht);

// kleur: Tailwind-klassen voor de bol (licht en donker). Rol-bollen zijn donker met witte letters.
const ROL_KLEUR = 'bg-inkt text-white dark:bg-white dark:text-inkt';

export const BOLLEN = [
  {
    id: 'friet',
    afk: 'FR',
    label: 'Friet',
    route: '/frituur',
    kleur: 'bg-bol-friet dark:bg-bol-friet-d',
    zichtbaar: iedereen,
  },
  {
    id: 'agenda',
    afk: 'AG',
    label: 'Agenda',
    route: '/agenda',
    kleur: 'bg-bol-agenda dark:bg-bol-agenda-d',
    zichtbaar: iedereen,
  },
  {
    id: 'polls',
    afk: 'PO',
    label: 'Polls',
    route: '/polls',
    kleur: 'bg-bol-polls dark:bg-bol-polls-d',
    zichtbaar: iedereen,
  },
  {
    id: 'verslagen',
    afk: 'VS',
    label: 'Verslagen',
    route: '/verslagen',
    kleur: 'bg-bol-verslagen dark:bg-bol-verslagen-d',
    zichtbaar: iedereen,
  },
  {
    id: 'fotos',
    afk: 'FO',
    label: "Foto's",
    route: '/fotos',
    kleur: 'bg-bol-fotos dark:bg-bol-fotos-d',
    zichtbaar: iedereen,
  },
  {
    id: 'teamdrank',
    afk: 'DR',
    label: 'Team drank',
    rol: 'team drank',
    route: '/strepen/dashboard',
    kleur: ROL_KLEUR,
    zichtbaar: metRecht('drank_beheren'),
  },
  {
    id: 'frietbeheer',
    afk: 'FB',
    label: 'Friet beheer',
    rol: 'team drank',
    route: '/team-drank/frieten',
    kleur: ROL_KLEUR,
    zichtbaar: metRecht('drank_beheren'),
  },
  {
    id: 'agendabeheer',
    afk: 'AB',
    label: 'Agenda beheer',
    rol: 'agenda beheren',
    route: '/agenda/beheer',
    kleur: ROL_KLEUR,
    zichtbaar: metRecht('agenda_beheren'),
  },
  {
    id: 'berichten',
    afk: 'BE',
    label: 'Berichten',
    rol: 'berichten sturen',
    route: '/notificaties/nieuw',
    kleur: ROL_KLEUR,
    zichtbaar: metRecht('berichten_sturen'),
  },
  {
    id: 'nieuwepoll',
    afk: 'NP',
    label: 'Nieuwe poll',
    rol: 'polls maken',
    route: '/polls/nieuw',
    kleur: ROL_KLEUR,
    zichtbaar: metRecht('polls_maken'),
  },
  {
    id: 'financien',
    afk: 'FI',
    label: 'Financiën',
    rol: 'financiën',
    route: '/financien',
    kleur: ROL_KLEUR,
    zichtbaar: metRecht('financien'),
  },
  {
    id: 'winkeltje',
    afk: 'WK',
    label: 'Winkeltje',
    rol: 'winkeltje',
    route: '/winkeltje/dashboard',
    kleur: ROL_KLEUR,
    zichtbaar: metRecht('winkeltje_beheren'),
  },
  {
    id: 'rollen',
    afk: 'RO',
    label: 'Rollen',
    rol: 'enkel hoofdleiding',
    route: '/admin/rollen',
    kleur: ROL_KLEUR,
    zichtbaar: isHoofdleiding,
  },
];

export const STANDAARD_VOLGORDE = BOLLEN.map(b => b.id);

/** Volledige volgorde: de gekozen id's eerst, daarna nieuwe/ontbrekende bollen in standaardvolgorde. */
export function volledigeVolgorde(gekozen) {
  const geldig = (gekozen || []).filter(id => STANDAARD_VOLGORDE.includes(id));
  return [...new Set([...geldig, ...STANDAARD_VOLGORDE])];
}

/** De bollen die deze leider ziet, in de gekozen volgorde. */
export function bollenVoor(user, gekozen) {
  const perId = Object.fromEntries(BOLLEN.map(b => [b.id, b]));
  return volledigeVolgorde(gekozen)
    .map(id => perId[id])
    .filter(b => b.zichtbaar(user));
}

// Bewaren op het profiel (volgt je naar elke gsm); lukt dat niet (migratie nog niet gedraaid),
// dan enkel op dit toestel.
const LOKAAL = 'ksa_bollen_volgorde';

export function gekozenVolgorde(user) {
  if (Array.isArray(user?.startscherm_bollen)) return user.startscherm_bollen;
  try {
    return JSON.parse(localStorage.getItem(LOKAAL) || 'null');
  } catch {
    return null;
  }
}

/** volgorde: lijst id's, of null voor de standaardvolgorde */
export async function bewaarVolgorde(userId, volgorde) {
  try {
    if (volgorde) localStorage.setItem(LOKAAL, JSON.stringify(volgorde));
    else localStorage.removeItem(LOKAAL);
  } catch {
    // geen localStorage: enkel op het profiel
  }
  await updateProfile(userId, { startscherm_bollen: volgorde });
}
