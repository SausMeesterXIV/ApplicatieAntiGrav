export const FRITUUR_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
  ORDERING: 'ordering',
  ORDERED: 'ordered',
  COMPLETED: 'completed',
};

export const FRITUUR_DB_CATEGORIES = ['frieten', 'snacks', 'sauzen', 'huisbereid', 'burgers', 'spaghetti'];

export const SPECIAL_DRINKS = {
  PINT_FREEDOM: 'Freedom',
  BAK_FREEDOM: 'Bak Freedom',
};

// Vaste volgorde van de drankknoppen (verspringen niet na een streep); andere dranken daarna op naam
export const DRANK_VOLGORDE = ['Freedom', 'Cola', 'Fanta', 'Sprite', 'Ice Tea'];

export const inVasteVolgorde = dranken => {
  const plek = d => {
    const i = DRANK_VOLGORDE.findIndex(n => n.toLowerCase() === String(d.name || '').toLowerCase());
    return i === -1 ? DRANK_VOLGORDE.length : i;
  };
  return [...dranken].sort((a, b) => plek(a) - plek(b) || String(a.name).localeCompare(String(b.name)));
};

export const SHOP_CATEGORIES = ['hemden', 't-shirts', 'truien', 'schildjes', 'extras', 'sjaaltjes'];
