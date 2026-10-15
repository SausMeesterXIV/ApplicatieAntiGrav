// Datumhulp voor agenda-items. Een meerdaags item loopt van `date` tot en met `endDate`.

const begin = d => {
  const dag = new Date(d);
  dag.setHours(0, 0, 0, 0);
  return dag;
};

/** Laatste dag van het item (eendaags: de startdag zelf). */
export const eindDag = event => begin(event.endDate || event.date);

/** Nog niet voorbij: start vandaag of later, of loopt nog (meerdaags). */
export const isAankomend = (event, vandaag = new Date()) => eindDag(event) >= begin(vandaag);

/** Aankomende items, chronologisch. */
export const aankomendeEvents = events =>
  events.filter(e => isAankomend(e)).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
