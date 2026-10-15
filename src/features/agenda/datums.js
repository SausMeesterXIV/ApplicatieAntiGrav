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

/** Ligt `dag` binnen het item (van startdag tot en met de laatste dag)? */
export const valtOp = (event, dag) => {
  const d = begin(dag);
  return d >= begin(event.date) && d <= eindDag(event);
};

/** "t.e.m. zo 15 nov" voor een meerdaags item, anders null. */
export const totEnMetTekst = event =>
  event.endDate
    ? 't.e.m. ' + eindDag(event).toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' })
    : null;

/** Aankomende items, chronologisch. */
export const aankomendeEvents = events =>
  events.filter(e => isAankomend(e)).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
