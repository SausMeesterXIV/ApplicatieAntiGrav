export const ROLES = {
  HOOFDLEIDING: 'hoofdleiding',
  TEAM_DRANK: 'team_drank',
  STANDAARD: 'standaard',
  SFEERBEHEER: 'sfeerbeheer',
  GODMODE: 'godmode',
  WINKELTJE: 'winkeltje',
} as const;

export const FRITUUR_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
  ORDERING: 'ordering',
  ORDERED: 'ordered',
  COMPLETED: 'completed',
} as const;

export const FRITUUR_UI_CATEGORIES = [
  'favorieten',
  'frieten',
  'snacks',
  'sauzen',
  'huisbereid',
  'burgers',
  'spaghetti'
] as const;

export const FRITUUR_DB_CATEGORIES = [
  'frieten',
  'snacks',
  'sauzen',
  'huisbereid',
  'burgers',
  'spaghetti'
] as const;

export const SPECIAL_DRINKS = {
  PINT_FREEDOM: 'Freedom',
  BAK_FREEDOM: 'Bak Freedom',
} as const;

export const SYSTEM_CONFIG = {
  STANDARD_DRINK: 'Freedom', // De referentie voor het systeem
  BAK_VALUE: 24,             // Wordt enkel gebruikt voor prijs/voorraad, niet voor bier-ranking
} as const;

export const SHOP_CATEGORIES = [
  'hemden',
  't-shirts',
  'truien',
  'schildjes',
  'extras',
  'sjaaltjes'
] as const;
