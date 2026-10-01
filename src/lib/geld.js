// Bedragen overal op dezelfde manier: "€ 1,50", "€ 1.234,56", "-€ 2,50" (Belgische notatie).
// Harde spatie ( ) tussen € en het bedrag, zodat die nooit over twee regels gesplitst worden.

const getal = new Intl.NumberFormat('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function euro(bedrag) {
  const n = Number(bedrag) || 0;
  const afgerond = Math.round(Math.abs(n) * 100) / 100;
  return `${n < 0 && afgerond !== 0 ? '-' : ''}€ ${getal.format(afgerond)}`;
}
