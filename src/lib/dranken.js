// Dranken: vast of tijdelijk (met tijdslot), zie migratie 003400.
// - Tijdelijke dranken blijven altijd bewaard; elke tijdelijke drank is een aparte drank (zelfde naam mag).
// - Gewone leiding streept enkel op beschikbare dranken; Drankteam altijd (de database dwingt dit af).

const dagMaand = d => d.toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit' });
const uur = d => d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
const dagKort = d => d.toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'numeric' });

// 'vast' | 'gepland' | 'open' | 'afgelopen'
export const drankStatus = (d, nu = new Date()) => {
  if (!d?.isTemporary) return 'vast';
  if (d.geldigVan && nu < d.geldigVan) return 'gepland';
  if (d.geldigTot && nu >= d.geldigTot) return 'afgelopen';
  return 'open';
};

// Mag gewone leiding hier nu op strepen?
export const isBeschikbaar = (d, nu = new Date()) => !!d && !d.uitLijst && ['vast', 'open'].includes(drankStatus(d, nu));

// Naam met tijdslot voor tijdelijke dranken: "Cocktail (16/10 – 18/10)"
export const drankLabel = d => {
  if (!d) return 'Onbekend';
  if (!d.isTemporary || !d.geldigVan || !d.geldigTot) return d.name;
  // Een tijdslot dat om middernacht eindigt, telt tot en met de dag ervoor
  const laatsteDag = new Date(d.geldigTot.getTime() - 1);
  const van = dagMaand(d.geldigVan);
  const tot = dagMaand(laatsteDag);
  return `${d.name} (${van === tot ? van : `${van} – ${tot}`})`;
};

// "vr 16/10 18:00 → zo 18/10 00:00"
export const tijdslotTekst = d =>
  d?.geldigVan && d?.geldigTot
    ? `${dagKort(d.geldigVan)} ${uur(d.geldigVan)} → ${dagKort(d.geldigTot)} ${uur(d.geldigTot)}`
    : '';

export const STATUS_TEKST = { vast: 'Vast', gepland: 'Gepland', open: 'Open', afgelopen: 'Afgelopen' };

// Waarde voor <input type="datetime-local"> (lokale tijd) en terug
export const naarInvoer = d => {
  if (!d) return '';
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
export const vanInvoer = s => (s ? new Date(s) : null);
