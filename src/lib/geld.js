// Bedragen overal op dezelfde manier: "€1,50", "€1.234,56", "-€2,50" (getal tegen het euroteken).

const getal = new Intl.NumberFormat('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function euro(bedrag) {
  const n = Number(bedrag) || 0;
  const afgerond = Math.round(Math.abs(n) * 100) / 100;
  return `${n < 0 && afgerond !== 0 ? '-' : ''}€${getal.format(afgerond)}`;
}
