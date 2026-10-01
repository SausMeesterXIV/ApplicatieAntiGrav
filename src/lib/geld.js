// Bedragen overal op dezelfde manier: "€1,50", "€1.234,56", "-€2,50" (getal tegen het euroteken).

const getal = new Intl.NumberFormat('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function euro(bedrag) {
  const n = Number(bedrag) || 0;
  const afgerond = Math.round(Math.abs(n) * 100) / 100;
  return `${n < 0 && afgerond !== 0 ? '-' : ''}€${getal.format(afgerond)}`;
}

// Echte kost verdeeld over de strepen: elke factuur wordt apart op de cent afgerond, dus de som van de
// drankbedragen wijkt enkele centen af van de kost. Positief = KSA krijgt te veel, negatief = te weinig.
export function afrondingsverschil(drankBedragen, echteKost) {
  const centen = drankBedragen.reduce((s, b) => s + Math.round((Number(b) || 0) * 100), 0);
  return (centen - Math.round((Number(echteKost) || 0) * 100)) / 100;
}

export function afrondingsTekst(verschil) {
  if (!verschil) return 'Geen afrondingsverschil: de facturen samen zijn precies de echte kost.';
  return verschil > 0
    ? `De facturen samen zijn ${euro(verschil)} meer dan de echte kost (afronding op de cent). Dat blijft bij KSA.`
    : `De facturen samen zijn ${euro(-verschil)} minder dan de echte kost (afronding op de cent). Dat legt KSA bij.`;
}
