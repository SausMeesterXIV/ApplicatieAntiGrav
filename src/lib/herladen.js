// Na een nieuwe versie op Vercel bestaan de bestanden van de oude versie niet meer.
// Een app die nog openstond, kan dan een scherm niet laden: één keer herladen haalt de nieuwe versie op.
// De vlag in sessionStorage voorkomt een eindeloze herlaadlus als er echt iets stuk is.

const SLEUTEL = 'herladen-na-update';

/** Herlaadt de pagina als dat in deze sessie nog niet gebeurde. Geeft true terug als er herladen wordt. */
export function herlaadNaUpdate() {
  try {
    if (sessionStorage.getItem(SLEUTEL)) return false;
    sessionStorage.setItem(SLEUTEL, '1');
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** Na een geslaagde lading mag een volgende update opnieuw één keer herladen. */
export function vergeetHerladen() {
  try {
    sessionStorage.removeItem(SLEUTEL);
  } catch {
    // geen sessionStorage (bv. privévenster): niets te doen
  }
}
